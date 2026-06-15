from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.schemas.auth import GoogleLoginRequest, TokenResponse
from backend.schemas.user import UserResponse
from backend.services import auth_service, user_service
from backend.utils.jwt import verify_access_token
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
security_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to validate the JWT bearer token and retrieve the logged-in user.
    """
    token = credentials.credentials
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token is invalid, expired, or tampered with.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims payload is missing user ID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims contain invalid user ID structure.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account matching token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

@router.post("/google", response_model=TokenResponse)
async def login_with_google(
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies a Google OAuth ID token. If the user is new, creates their record.
    Generates a secure application JWT.
    """
    try:
        return auth_service.authenticate_google_user(db, payload.google_token)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during Google authentication: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile information of the currently authenticated user.
    """
    return current_user

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Invalidates user session. Since JWT is stateless, client destroys token.
    This endpoint verifies the token is valid, then returns a success response.
    """
    return {
        "success": True,
        "message": f"Successfully logged out user: {current_user.email}"
    }
