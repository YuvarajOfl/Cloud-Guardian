from sqlalchemy.orm import Session
from fastapi import Request
from backend.models.audit import LoginLog, UsageLog, FailedLogin
import logging

logger = logging.getLogger("backend.services.audit_service")

def log_login_success(db: Session, user_id: int, email: str, login_method: str, request: Request = None):
    try:
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        log = LoginLog(
            user_id=user_id,
            email=email,
            login_method=login_method,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        
        # Also log in usage logs
        usage = UsageLog(
            user_id=user_id,
            action="LOGIN"
        )
        db.add(usage)
        
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log successful login: {e}")

def log_login_failure(db: Session, email: str, request: Request = None):
    try:
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        log = FailedLogin(
            email=email,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log failed login: {e}")

def log_usage_action(db: Session, user_id: int, action: str):
    try:
        log = UsageLog(
            user_id=user_id,
            action=action
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log usage action {action}: {e}")
