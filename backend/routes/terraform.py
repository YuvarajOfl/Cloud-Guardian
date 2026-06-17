from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from backend.database.session import get_db
from backend.models.user import User
from backend.routes.auth import get_current_user
from backend.schemas.terraform import TerraformFileResponse, TerraformResourceResponse, SecurityFindingResponse, CostFindingResponse
from backend.services import terraform_service
from backend.models.terraform import SecurityFinding, CostFinding
from backend.services.report_service import generate_pdf_report

router = APIRouter(prefix="/api", tags=["Terraform Analyzer"])

@router.post("/upload", response_model=TerraformFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_terraform_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts, validates, and parses a terraform.tfstate, .tfstate, or .json file.
    Saves parsed cloud resources in MySQL.
    """
    try:
        contents = await file.read()
        db_file = terraform_service.validate_and_parse_terraform(
            db=db,
            user_id=current_user.id,
            file_name=file.filename,
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
    Returns metadata and status of all uploaded Terraform files belonging to the logged-in user.
    """
    return terraform_service.get_user_files(db, current_user.id)

@router.delete("/files/{id}", status_code=status.HTTP_200_OK)
async def delete_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes the file record from the database and cleans up resources via cascading.
    """
    deleted = terraform_service.delete_user_file(db, id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return {"success": True, "message": "File and discovered resources deleted successfully."}

@router.get("/resources", response_model=List[TerraformResourceResponse])
async def get_all_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all parsed cloud resources for all files uploaded by the logged-in user.
    """
    return terraform_service.get_user_resources(db, current_user.id)

@router.get("/resources/{file_id}", response_model=List[TerraformResourceResponse])
async def get_resources_by_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all parsed cloud resources discovered in a specific Terraform file.
    """
    # Verify file ownership first
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return terraform_service.get_file_resources(db, file_id, current_user.id)


@router.get("/findings", response_model=List[SecurityFindingResponse])
async def get_all_findings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all parsed security findings for all files uploaded by the logged-in user.
    """
    return db.query(SecurityFinding).filter(SecurityFinding.user_id == current_user.id).order_by(SecurityFinding.created_at.desc()).all()


@router.get("/findings/{file_id}", response_model=List[SecurityFindingResponse])
async def get_findings_by_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all security findings discovered in a specific Terraform file.
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return db.query(SecurityFinding).filter(SecurityFinding.file_id == file_id, SecurityFinding.user_id == current_user.id).order_by(SecurityFinding.created_at.desc()).all()


@router.get("/reports/download/{file_id}")
async def download_pdf_report(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates and downloads a compliance PDF report of security findings for a specific Terraform file.
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
        
    try:
        pdf_buffer = generate_pdf_report(db, file_record)
        # Format nice safe name
        safe_name = file_record.file_name.replace(" ", "_").replace("..", "")
        if safe_name.endswith(".tfstate"):
            safe_name = safe_name[:-8]
        elif safe_name.endswith(".json"):
            safe_name = safe_name[:-5]
            
        headers = {
            'Content-Disposition': f'attachment; filename="infrasight_report_{safe_name}.pdf"'
        }
        return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF compliance report: {str(e)}"
        )


@router.post("/cost/analyze/{file_id}", response_model=List[CostFindingResponse])
async def run_cost_optimization(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clears existing cost findings, executes the cost optimization engine, and saves new findings.
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )

    # Delete existing findings
    db.query(CostFinding).filter(CostFinding.file_id == file_id, CostFinding.user_id == current_user.id).delete()
    db.commit()

    # Run cost analysis
    resources = terraform_service.get_file_resources(db, file_id, current_user.id)
    try:
        from backend.services.cost_service import run_cost_analysis
        findings = run_cost_analysis(db=db, file_id=file_id, user_id=current_user.id, resources=resources)
        return findings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cost analysis run failed: {str(e)}"
        )


@router.get("/cost/findings", response_model=List[CostFindingResponse])
async def get_all_cost_findings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all cost optimization findings discovered for the logged-in user.
    """
    return db.query(CostFinding).filter(CostFinding.user_id == current_user.id).order_by(CostFinding.created_at.desc()).all()


@router.get("/cost/findings/{file_id}", response_model=List[CostFindingResponse])
async def get_cost_findings_by_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns cost optimization findings discovered in a specific Terraform file.
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    return db.query(CostFinding).filter(CostFinding.file_id == file_id, CostFinding.user_id == current_user.id).order_by(CostFinding.created_at.desc()).all()

