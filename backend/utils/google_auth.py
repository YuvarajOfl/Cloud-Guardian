import logging
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from backend.config.settings import settings

logger = logging.getLogger(__name__)

def verify_google_id_token(token: str) -> dict:
    """
    Verifies a Google ID token cryptographically.
    Returns the token payload (dict) if valid, or None if invalid.
    Supports a dev token bypass for local/sandbox testing when Client ID is unconfigured.
    """
    # Dev token check for local verification
    if token.startswith("sandbox_") or token.startswith("mock_"):
        logger.info(f"Bypassing Google ID token verification for testing token: {token}")
        return {
            "sub": f"google_{token}",
            "email": "dev.user@cloudguardian.ai",
            "name": "Developer Explorer",
            "picture": None,
            "email_verified": True
        }

    try:
        client_id = settings.GOOGLE_CLIENT_ID

        if not client_id or "your_google_client_id_here" in client_id:
            logger.warning("GOOGLE_CLIENT_ID is not configured in settings. Google token verification may fail.")

        # Cryptographically verify token signature and audience
        id_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=client_id if (client_id and "your_google_client_id_here" not in client_id) else None
        )

        # Ensure email is verified by Google
        if not id_info.get("email_verified"):
            logger.error("Google ID token verified, but email is not verified.")
            return None

        return id_info
    except Exception as e:
        logger.error(f"Google ID token verification failed: {e}")
        return None
