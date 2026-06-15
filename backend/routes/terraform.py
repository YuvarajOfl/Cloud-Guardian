from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import List

from backend.database.session import get_db
from backend.models.user import User
from backend.routes.auth import get_current_user
from backend.schemas.terraform import TerraformFileResponse, FileContentResponse
from backend.services import terraform_service

router = APIRouter(prefix="/api", tags=["Terraform Analyzer"])

@router.post("/upload", response_model=TerraformFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_terraform_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts and validates .tf, .tfvars, or .zip files. Stores them securely
    in an isolated user-directory and creates a record in the database.
    """
    try:
        contents = await file.read()
        db_file = terraform_service.validate_and_save_file(
            db=db,
            user_id=current_user.id,
            original_filename=file.filename,
            file_contents=contents
        )
        return db_file
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file upload: {str(exc)}"
        )

@router.get("/files", response_model=List[TerraformFileResponse])
async def list_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns metadata of all uploaded Terraform files belonging to the logged-in user.
    """
    return terraform_service.get_user_files(db, current_user.id)

@router.get("/files/{id}", response_model=FileContentResponse)
async def view_file_contents(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves a file's metadata and contents (or archived file listing if zip) for visual display.
    """
    details = terraform_service.get_file_content_details(db, id, current_user.id)
    if not details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return details

@router.delete("/files/{id}", status_code=status.HTTP_200_OK)
async def delete_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes the file record from the database and cleans up disk storage.
    """
    deleted = terraform_service.delete_user_file(db, id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return {"success": True, "message": "File deleted successfully."}

@router.post("/files/{id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def analyze_file(
    id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Queues a Terraform file for security analysis. Spawns a background worker task
    simulating Checkov scanner execution.
    """
    file_record = terraform_service.queue_file_analysis(db, id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    
    # Spawn background task to simulate checkov scan
    background_tasks.add_task(terraform_service.simulate_checkov_scan, id)

    return {
        "success": True,
        "message": f"Analysis queued for file '{file_record.original_filename}'. Check status shortly.",
        "status": "Queued"
    }
