import base64
import json
import logging
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from backend.config.settings import settings

logger = logging.getLogger(__name__)

def verify_google_id_token(token: str) -> dict:
    """
    Verifies a Google ID token cryptographically.
    Returns the token payload (dict) if valid, or None if invalid.
    """
    client_id = settings.GOOGLE_CLIENT_ID
    logger.info("================== GOOGLE OAUTH VERIFICATION START ==================")
    logger.info(f"Client ID loaded from settings: '{client_id}'")
    logger.info(f"Received Google ID token: '{token}'")

    if settings.APP_ENV == "development" and token == "sandbox_developer_token":
        logger.info("Sandbox developer token bypass activated.")
        logger.info("=================== GOOGLE OAUTH VERIFICATION END ===================")
        return {
            "sub": "1234567890",
            "email": "developer@infrasight.dev",
            "name": "Sandbox Developer",
            "picture": "https://avatar.vercel.sh/developer",
            "email_verified": True
        }

    # Decode unverified token audience for logging/troubleshooting
    try:
        parts = token.split('.')
        if len(parts) >= 2:
            payload_b64 = parts[1]
            payload_b64 += '=' * (-len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
            claims = json.loads(payload_json)
            logger.info(f"Unverified token audience (aud): '{claims.get('aud')}'")
            logger.info(f"Expected audience (client_id): '{client_id}'")
        else:
            logger.warning("Token format is invalid, cannot decode claims.")
    except Exception as decode_err:
        logger.error(f"Failed to decode unverified token claims: {decode_err}")

    try:
        if not client_id or "your_google_client_id_here" in client_id:
            logger.warning("GOOGLE_CLIENT_ID is not configured in settings. Google token verification may fail.")

        # Cryptographically verify token signature and audience
        id_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=client_id if (client_id and "your_google_client_id_here" not in client_id) else None,
            clock_skew_in_seconds=300
        )

        logger.info("Google ID token cryptographically verified successfully.")
        logger.info(f"Verified token audience (aud): '{id_info.get('aud')}'")
        logger.info("Verification result: Success")
        logger.info("=================== GOOGLE OAUTH VERIFICATION END ===================")

        # Ensure email is verified by Google
        if not id_info.get("email_verified"):
            logger.error("Google ID token verified, but email is not verified.")
            return None

        return id_info
    except Exception as e:
        logger.error(f"Google ID token verification failed: {e}")
        logger.info("Verification result: Failed")
        logger.info("=================== GOOGLE OAUTH VERIFICATION END ===================")
        return None
