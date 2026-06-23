import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.utils.google_auth import verify_google_id_token
from backend.utils.jwt import create_access_token
from backend.schemas.user import UserCreate, UserUpdate
from backend.schemas.auth import TokenResponse
from backend.services import user_service

logger = logging.getLogger(__name__)

def authenticate_google_user(db: Session, google_token: str) -> TokenResponse:
    """
    Verifies the Google OAuth token, fetches or creates the user in the database,
    and returns a signed JWT access token along with the user details.
    """
    # 1. Verify Google token cryptographically
    id_info = verify_google_id_token(google_token)
    if not id_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google OAuth credential token."
        )

    google_id = id_info.get("sub")
    email = id_info.get("email")
    name = id_info.get("name", "Google User")
    profile_picture = id_info.get("picture")

    # 2. Check if user already registered with this Google ID
    user = user_service.get_user_by_google_id(db, google_id)

    if not user:
        # Check if the user email already exists (linked to another login or created in advance)
        user = user_service.get_user_by_email(db, email)
        if user:
            # Link Google ID to existing account
            user.google_id = google_id
            if profile_picture:
                user.profile_picture = profile_picture
            db.commit()
            db.refresh(user)
            logger.info(f"Linked existing user account {email} with Google ID {google_id}")
        else:
            # Create a brand new user record (first-time login)
            user_in = UserCreate(
                google_id=google_id,
                email=email,
                name=name,
                profile_picture=profile_picture,
                provider="google"
            )
            user = user_service.create_user(db, user_in)
            logger.info(f"Registered new Google user: {email}")
    else:
        # Sync changes from Google profile if name or profile pic changed
        update_needed = False
        updates = {}
        if user.name != name:
            updates["name"] = name
            update_needed = True
        if user.profile_picture != profile_picture:
            updates["profile_picture"] = profile_picture
            update_needed = True

        if update_needed:
            user_service.update_user(db, user.id, UserUpdate(**updates))
            logger.info(f"Updated Google profile attributes for user: {email}")

    if not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact administrator."
        )

    # 3. Generate signed JWT token
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name
    }
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


def authenticate_email_user(db: Session, email: str, password: str) -> TokenResponse:
    """
    Verifies the email and password, and returns a signed JWT access token and user details.
    """
    from backend.utils.security import verify_password
    user = user_service.get_user_by_email(db, email)
    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact administrator."
        )

    if user.provider != "local" or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Generate signed JWT token
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name
    }
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

