import os
import uuid
import zipfile
import logging
import random
import time
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.database.session import SessionLocal
from backend.models.terraform import TerraformFile, AnalysisRecord
from backend.models.user import User

logger = logging.getLogger("backend.services.terraform")

# Storage directory config (workspace root)
UPLOAD_BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTENSIONS = {".tf", ".tfvars", ".zip"}

def validate_and_save_file(db: Session, user_id: int, original_filename: str, file_contents: bytes) -> TerraformFile:
    """
    Validates file extension, size, and structure (including corrupted ZIP checks).
    Saves the file securely to uploads/{user_id}/<uuid>.<ext> and writes to DB.
    """
    # 1. Size check
    if len(file_contents) > MAX_FILE_SIZE:
        raise ValueError("File size exceeds the 20MB limit.")

    # 2. Extension check
    _, ext = os.path.splitext(original_filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}")

    # 3. Zip file integrity check
    if ext == ".zip":
        import io
        try:
            with zipfile.ZipFile(io.BytesIO(file_contents)) as zf:
                bad_file = zf.testzip()
                if bad_file:
                    raise ValueError(f"Corrupted zip archive: first bad file is {bad_file}")
                if not zf.namelist():
                    raise ValueError("Zip archive is empty.")
        except zipfile.BadZipFile:
            raise ValueError("Invalid or corrupted ZIP file structure.")

    # 4. Create destination directory
    user_upload_dir = os.path.join(UPLOAD_BASE_DIR, str(user_id))
    os.makedirs(user_upload_dir, exist_ok=True)

    # 5. Generate secure unique filename
    unique_filename = f"{uuid.uuid4()}{ext}"
    dest_path = os.path.join(user_upload_dir, unique_filename)

    # 6. Write to disk
    with open(dest_path, "wb") as f:
        f.write(file_contents)

    # 7. Write record to Database
    db_file = TerraformFile(
        user_id=user_id,
        filename=unique_filename,
        original_filename=original_filename,
        file_path=dest_path,
        status="uploaded"
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    logger.info(f"User {user_id} uploaded {original_filename} successfully saved as {unique_filename}")
    return db_file

def get_user_files(db: Session, user_id: int) -> List[TerraformFile]:
    """
    Returns list of all terraform files uploaded by a specific user.
    """
    return db.query(TerraformFile).filter(TerraformFile.user_id == user_id).order_by(TerraformFile.upload_timestamp.desc()).all()

def get_file_by_id(db: Session, file_id: int, user_id: int) -> Optional[TerraformFile]:
    """
    Retrieves a single TerraformFile if it belongs to the authenticated user.
    """
    return db.query(TerraformFile).filter(TerraformFile.id == file_id, TerraformFile.user_id == user_id).first()

def get_file_content_details(db: Session, file_id: int, user_id: int) -> dict:
    """
    Retrieves file metadata and reads text content (or archive lists) if valid.
    """
    file_record = get_file_by_id(db, file_id, user_id)
    if not file_record:
        return {}

    _, ext = os.path.splitext(file_record.original_filename.lower())
    is_text = ext in {".tf", ".tfvars"}

    result = {
        "id": file_record.id,
        "original_filename": file_record.original_filename,
        "status": file_record.status,
        "is_text": is_text,
        "content": None,
        "zip_files": None
    }

    if not os.path.exists(file_record.file_path):
        result["content"] = "[Error: File missing from storage disk.]"
        return result

    if is_text:
        try:
            with open(file_record.file_path, "r", encoding="utf-8", errors="replace") as f:
                result["content"] = f.read()
        except Exception as e:
            result["content"] = f"[Error reading file: {str(e)}]"
    elif ext == ".zip":
        try:
            with zipfile.ZipFile(file_record.file_path) as zf:
                result["zip_files"] = zf.namelist()
        except Exception as e:
            result["zip_files"] = [f"[Error reading zip headers: {str(e)}]"]

    return result

def delete_user_file(db: Session, file_id: int, user_id: int) -> bool:
    """
    Deletes the file metadata and record from DB and deletes the file from disk.
    """
    file_record = get_file_by_id(db, file_id, user_id)
    if not file_record:
        return False

    # 1. Delete from disk
    if os.path.exists(file_record.file_path):
        try:
            os.remove(file_record.file_path)
            logger.info(f"Deleted physical file: {file_record.file_path}")
        except Exception as e:
            logger.error(f"Failed to delete physical file {file_record.file_path}: {e}")

    # 2. Delete from DB (cascade cleans up AnalysisRecords)
    db.delete(file_record)
    db.commit()
    logger.info(f"Deleted terraform file database entry #{file_id}")
    return True

def simulate_checkov_scan(file_id: int):
    """
    Background Task simulating Checkov scan.
    Waits 4 seconds, updates status to 'analyzed', and adds a placeholder analysis record.
    """
    logger.info(f"Starting simulated scanning for file #{file_id} in background task...")
    time.sleep(4)
    db = SessionLocal()
    try:
        file_record = db.query(TerraformFile).filter(TerraformFile.id == file_id).first()
        if file_record:
            file_record.status = "analyzed"
            
            # Simulated finding generation
            findings_count = random.choice([0, 1, 3, 5, 8])
            analysis_rec = AnalysisRecord(
                file_id=file_id,
                status="Completed",
                findings_count=findings_count
            )
            db.add(analysis_rec)
            db.commit()
            logger.info(f"Simulated scanning completed for file #{file_id}. Status set to analyzed. Findings: {findings_count}")
        else:
            logger.warning(f"File #{file_id} not found in database during simulated scan.")
    except Exception as e:
        logger.error(f"Error during simulated scan for file #{file_id}: {e}")
    finally:
        db.close()

def queue_file_analysis(db: Session, file_id: int, user_id: int) -> Optional[TerraformFile]:
    """
    Initiates analysis. Sets status to 'queued' and prepares simulation logic hooks.
    """
    file_record = get_file_by_id(db, file_id, user_id)
    if not file_record:
        return None

    # Update state to queued
    file_record.status = "queued"
    db.commit()
    db.refresh(file_record)
    
    return file_record
