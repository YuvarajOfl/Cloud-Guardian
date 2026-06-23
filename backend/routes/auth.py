from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.schemas.auth import GoogleLoginRequest, EmailLoginRequest, TokenResponse, UserRegisterRequest, ChangePasswordRequest
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

    if not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact administrator."
        )

    return user

async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to validate if the currently logged-in user is an administrator.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin privilege required."
        )
    return current_user

@router.post("/google", response_model=TokenResponse)
async def login_with_google(
    payload: GoogleLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Verifies a Google OAuth ID token. If the user is new, creates their record.
    Generates a secure application JWT.
    """
    from backend.services.audit_service import log_login_success, log_login_failure
    try:
        res = auth_service.authenticate_google_user(db, payload.google_token)
        log_login_success(db, res.user.id, res.user.email, "google", request)
        return res
    except HTTPException as http_exc:
        log_login_failure(db, "google_oauth_attempt", request)
        raise http_exc
    except Exception as e:
        log_login_failure(db, "google_oauth_attempt", request)
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
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Invalidates user session. Since JWT is stateless, client destroys token.
    This endpoint verifies the token is valid, then returns a success response.
    """
    from backend.services.audit_service import log_usage_action
    log_usage_action(db, current_user.id, "LOGOUT")
    return {
        "success": True,
        "message": f"Successfully logged out user: {current_user.email}"
    }

@router.get("/config")
async def get_auth_config():
    """
    Returns public Google Client ID configuration required by the frontend login flow.
    """
    from backend.config.settings import settings
    return {"google_client_id": settings.GOOGLE_CLIENT_ID}

@router.post("/login", response_model=TokenResponse)
async def login_with_email(
    payload: EmailLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Verifies email and password, and returns a signed JWT access token.
    """
    from backend.services.audit_service import log_login_success, log_login_failure
    try:
        res = auth_service.authenticate_email_user(db, payload.email, payload.password)
        log_login_success(db, res.user.id, res.user.email, "email", request)
        return res
    except HTTPException as http_exc:
        log_login_failure(db, payload.email, request)
        raise http_exc
    except Exception as e:
        log_login_failure(db, payload.email, request)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during authentication: {str(e)}"
        )

@router.post("/register", response_model=UserResponse)
async def register(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Registers a new local account. Checks for existing emails, hashes password, and persists user.
    """
    existing_user = user_service.get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )

    try:
        from backend.utils.security import get_password_hash
        from backend.schemas.user import UserCreate
        
        pwd_hash = get_password_hash(payload.password)
        user_in = UserCreate(
            google_id=None,
            email=payload.email,
            name=payload.name,
            provider="local"
        )
        new_user = user_service.create_user(db, user_in, password_hash=pwd_hash)
        return new_user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during user registration: {str(e)}"
        )

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Changes the password of a local account user.
    """
    if current_user.provider != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is only supported for local accounts."
        )

    from backend.utils.security import verify_password, get_password_hash
    if not current_user.password_hash or not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    try:
        current_user.password_hash = get_password_hash(payload.new_password)
        db.commit()
        return {"success": True, "message": "Password changed successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while changing password: {str(e)}"
        )
