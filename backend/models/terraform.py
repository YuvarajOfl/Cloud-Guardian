from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.session import Base

class TerraformFile(Base):
    __tablename__ = "terraform_files"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    upload_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(50), default="uploaded", nullable=False) # "uploaded" | "parsed" | "failed"

    # Relationships
    user = relationship("User", back_populates="files")
    resources = relationship("TerraformResource", back_populates="file", cascade="all, delete-orphan")
    findings = relationship("SecurityFinding", back_populates="file", cascade="all, delete-orphan")
    cost_findings = relationship("CostFinding", back_populates="file", cascade="all, delete-orphan")


class TerraformResource(Base):
    __tablename__ = "terraform_resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("terraform_files.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(255), nullable=False)
    resource_name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)
    region = Column(String(100), nullable=False)
    resource_metadata = Column(JSON, nullable=True)
    status = Column(String(50), default="Managed", nullable=False)

    # Relationships
    file = relationship("TerraformFile", back_populates="resources")


class SecurityFinding(Base):
    __tablename__ = "security_findings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("terraform_files.id", ondelete="CASCADE"), nullable=False)
    resource_name = Column(String(255), nullable=False)
    resource_type = Column(String(255), nullable=False)
    severity = Column(String(50), nullable=False) # "Critical" | "High" | "Medium" | "Low"
    title = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=False)
    recommendation = Column(String(1024), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    file = relationship("TerraformFile", back_populates="findings")


class CostFinding(Base):
    __tablename__ = "cost_findings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("terraform_files.id", ondelete="CASCADE"), nullable=False)
    resource_name = Column(String(255), nullable=False)
    resource_type = Column(String(255), nullable=False)
    estimated_monthly_cost = Column(Float, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=False)
    recommendation = Column(String(1024), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    file = relationship("TerraformFile", back_populates="cost_findings")


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    finding_id = Column(Integer, nullable=False)
    finding_type = Column(String(50), nullable=False) # "security" or "cost"
    prompt = Column(String(2048), nullable=False)
    response = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)



