from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    provider = Column(String(50), nullable=False, default="local")
    role = Column(String(50), nullable=True, default="user", server_default="user")
    profile_picture = Column(String(1024), nullable=True)
    is_active = Column(Boolean, default=True, server_default="1", nullable=False)
    is_deleted = Column(Boolean, default=False, server_default="0", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    files = relationship("TerraformFile", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("ReportHistory", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def access_level(self) -> str:
        return "Administrator" if self.role == "admin" else "Standard User"


