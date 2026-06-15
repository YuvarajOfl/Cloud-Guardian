from datetime import datetime, timedelta, timezone
import jwt
import logging
from backend.config.settings import settings

logger = logging.getLogger(__name__)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generates a secure JSON Web Token (JWT) signed with the application secret.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> dict:
    """
    Decodes and verifies the authenticity and expiration of a JWT access token.
    Returns the decoded token claims, or None if invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT access token has expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT access token is invalid: {e}")
        return None
