from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.session import Base

class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(255), nullable=False)
    login_method = Column(String(50), nullable=False) # "email" or "google"
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(512), nullable=True)
    login_timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    user = relationship("User")

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    action = Column(String(50), nullable=False) # UPLOAD_FILE, RUN_ANALYSIS, GENERATE_REPORT, DOWNLOAD_REPORT, LOGIN, LOGOUT
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    user = relationship("User")

class FailedLogin(Base):
    __tablename__ = "failed_logins"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(512), nullable=True)
    attempt_timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
