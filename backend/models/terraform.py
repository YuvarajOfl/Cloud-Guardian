from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.session import Base

class TerraformFile(Base):
    __tablename__ = "terraform_files"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False) # Unique Generated Internal Disk Name
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(1024), nullable=False)
    upload_timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(50), default="uploaded", nullable=False) # "uploaded" | "queued" | "analyzed" | "failed"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="files")
    analysis_records = relationship("AnalysisRecord", back_populates="file", cascade="all, delete-orphan")


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("terraform_files.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="Queued", nullable=False) # "Queued" | "Completed" | "Failed"
    findings_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    file = relationship("TerraformFile", back_populates="analysis_records")
