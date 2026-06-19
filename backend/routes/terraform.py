import logging
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List

from backend.database.session import get_db
from backend.models.user import User
from backend.routes.auth import get_current_user
from backend.schemas.terraform import TerraformFileResponse, TerraformResourceResponse, SecurityFindingResponse, CostFindingResponse
from backend.schemas.reports import ReportResponse, ReportGenerateRequest
from backend.services import terraform_service
from backend.models.terraform import SecurityFinding, CostFinding, ReportHistory, TerraformResource
from backend.services.report_service import generate_pdf_report

router = APIRouter(prefix="/api", tags=["Terraform Analyzer"])
logger = logging.getLogger("backend.routes.terraform")

@router.post("/upload", response_model=TerraformFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_terraform_file(
    file: UploadFile = File(...),
    upload_action: str = Query(None, pattern="^(replace|version)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts, validates, and parses a terraform.tfstate, .tfstate, .json, .tf, or .tfvars file.
    Saves parsed cloud resources in MySQL. Prevents duplicates by offering replace or versioning.
    """
    from backend.models.terraform import TerraformFile
    existing_file = db.query(TerraformFile).filter(
        TerraformFile.user_id == current_user.id,
        TerraformFile.file_name == file.filename,
        TerraformFile.status != "failed"
    ).first()

    target_filename = file.filename

    if existing_file:
        if not upload_action:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A file with this name already exists. Choose replace or version suffixing."
            )
        elif upload_action == "replace":
            # Cascade delete the existing file and its findings
            db.delete(existing_file)
            db.commit()
        elif upload_action == "version":
            import re
            user_files = [f.file_name for f in db.query(TerraformFile).filter(TerraformFile.user_id == current_user.id).all()]
            
            # Extract base and extension
            filename = file.filename
            if filename.endswith(".tfstate"):
                base = filename[:-8]
                ext = ".tfstate"
            elif filename.endswith(".json"):
                base = filename[:-5]
                ext = ".json"
            else:
                import os
                base, ext = os.path.splitext(filename)

            # Strip any existing vX suffix to find clean base
            clean_base = re.sub(r"-v\d+$", "", base)
            max_ver = 1
            pattern = re.compile(rf"^{re.escape(clean_base)}(?:-v(\d+))?{re.escape(ext)}$", re.IGNORECASE)

            for name in user_files:
                match = pattern.match(name)
                if match:
                    ver_str = match.group(1)
                    if ver_str:
                        max_ver = max(max_ver, int(ver_str))
                    else:
                        max_ver = max(max_ver, 1)
            
            target_filename = f"{clean_base}-v{max_ver + 1}{ext}"

    try:
        contents = await file.read()
        lower_name = target_filename.lower()
        if lower_name.endswith(".tf") or lower_name.endswith(".tfvars"):
            db_file = terraform_service.validate_and_save_hcl(
                db=db,
                user_id=current_user.id,
                file_name=target_filename,
                file_contents=contents
            )
        else:
            db_file = terraform_service.validate_and_parse_terraform(
                db=db,
                user_id=current_user.id,
                file_name=target_filename,
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
    Returns all parsed cloud resources discovered in a specific Terraform file (or all HCL files in a workspace).
    """
    # Verify file ownership first
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )
    
    from backend.models.terraform import TerraformFile
    if file_record.file_type in ["tf", "tfvars"]:
        hcl_files = db.query(TerraformFile).filter(
            TerraformFile.user_id == current_user.id,
            TerraformFile.file_type.in_(["tf", "tfvars"])
        ).all()
        hcl_ids = [f.id for f in hcl_files]
        return db.query(TerraformResource).filter(TerraformResource.file_id.in_(hcl_ids)).all()
    
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
    Returns all security findings discovered in a specific Terraform file (or all HCL files in a workspace).
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )

    from backend.models.terraform import TerraformFile
    if file_record.file_type in ["tf", "tfvars"]:
        hcl_files = db.query(TerraformFile).filter(
            TerraformFile.user_id == current_user.id,
            TerraformFile.file_type.in_(["tf", "tfvars"])
        ).all()
        hcl_ids = [f.id for f in hcl_files]
        return db.query(SecurityFinding).filter(
            SecurityFinding.file_id.in_(hcl_ids),
            SecurityFinding.user_id == current_user.id
        ).order_by(SecurityFinding.created_at.desc()).all()

    return db.query(SecurityFinding).filter(SecurityFinding.file_id == file_id, SecurityFinding.user_id == current_user.id).order_by(SecurityFinding.created_at.desc()).all()





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
    Returns cost optimization findings discovered in a specific Terraform file (or all HCL files in a workspace).
    """
    # Verify file ownership
    file_record = terraform_service.get_file_by_id(db, file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied."
        )

    from backend.models.terraform import TerraformFile
    if file_record.file_type in ["tf", "tfvars"]:
        hcl_files = db.query(TerraformFile).filter(
            TerraformFile.user_id == current_user.id,
            TerraformFile.file_type.in_(["tf", "tfvars"])
        ).all()
        hcl_ids = [f.id for f in hcl_files]
        return db.query(CostFinding).filter(
            CostFinding.file_id.in_(hcl_ids),
            CostFinding.user_id == current_user.id
        ).order_by(CostFinding.created_at.desc()).all()

    return db.query(CostFinding).filter(CostFinding.file_id == file_id, CostFinding.user_id == current_user.id).order_by(CostFinding.created_at.desc()).all()


@router.post("/reports/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a PDF compliance report (Executive Summary, Security Audit, Cost Optimization Report,
    or Complete Assessment), saves it to disk at uploads/reports/, and stores metadata in the DB.
    """
    file_record = terraform_service.get_file_by_id(db, payload.file_id, current_user.id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terraform file not found or access denied."
        )

    valid_types = [
        "Executive Summary",
        "Security Audit",
        "Cost Optimization Report",
        "Complete Assessment"
    ]
    if payload.report_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report type. Allowed values: {valid_types}"
        )

    try:
        pdf_buffer = generate_pdf_report(db, file_record, payload.report_type)

        reports_dir = os.path.join("uploads", "reports")
        os.makedirs(reports_dir, exist_ok=True)

        safe_name = file_record.file_name.replace(" ", "_").replace("..", "")
        if safe_name.endswith(".tfstate"):
            safe_name = safe_name[:-8]
        elif safe_name.endswith(".json"):
            safe_name = safe_name[:-5]

        layout_tag = payload.report_type.lower().replace(" ", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"infrasight_{layout_tag}_{safe_name}_{timestamp}.pdf"
        file_path = os.path.join(reports_dir, report_filename)

        with open(file_path, "wb") as f:
            f.write(pdf_buffer.getvalue())

        new_report = ReportHistory(
            user_id=current_user.id,
            file_id=payload.file_id,
            report_name=report_filename,
            report_type=payload.report_type,
            file_path=file_path
        )
        db.add(new_report)
        db.commit()
        db.refresh(new_report)

        return new_report
    except Exception as e:
        logger.error(f"Failed to generate and store report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(e)}"
        )


@router.get("/reports", response_model=List[ReportResponse])
async def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a list of all persistent reports generated by the logged-in user.
    """
    results = db.query(ReportHistory).filter(ReportHistory.user_id == current_user.id).order_by(ReportHistory.created_at.desc()).all()
    
    response_data = []
    for item in results:
        response_data.append({
            "id": item.id,
            "user_id": item.user_id,
            "file_id": item.file_id,
            "file_name": item.file.file_name if item.file else "Deleted File",
            "report_name": item.report_name,
            "report_type": item.report_type,
            "file_path": item.file_path,
            "created_at": item.created_at
        })
    return response_data


@router.get("/reports/download/{id}")
async def download_stored_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Downloads a previously generated compliance report from server disk.
    """
    report = db.query(ReportHistory).filter(ReportHistory.id == id, ReportHistory.user_id == current_user.id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found or access denied."
        )

    if not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical report file not found on disk."
        )

    return FileResponse(
        path=report.file_path,
        media_type="application/pdf",
        filename=report.report_name
    )


@router.delete("/reports/{id}", status_code=status.HTTP_200_OK)
async def delete_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a report record from the database and removes the associated PDF file from disk.
    """
    report = db.query(ReportHistory).filter(ReportHistory.id == id, ReportHistory.user_id == current_user.id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found or access denied."
        )

    try:
        if os.path.exists(report.file_path):
            os.remove(report.file_path)
    except Exception as exc:
        logger.error(f"Error removing report file {report.file_path} from disk: {exc}")

    db.delete(report)
    db.commit()
    return {"success": True, "message": "Report record and stored file deleted successfully."}


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.models.terraform import TerraformFile, TerraformResource, SecurityFinding, CostFinding, AIInsight, ReportHistory
    
    total_files = db.query(TerraformFile).filter(TerraformFile.user_id == current_user.id).count()
    total_resources = db.query(TerraformResource).join(TerraformFile).filter(TerraformFile.user_id == current_user.id).count()
    
    security_findings = db.query(SecurityFinding).filter(SecurityFinding.user_id == current_user.id).count()
    cost_findings = db.query(CostFinding).filter(CostFinding.user_id == current_user.id).count()
    
    cost_data = db.query(CostFinding).filter(CostFinding.user_id == current_user.id).all()
    potential_savings = sum(item.estimated_monthly_cost for item in cost_data)
    
    # Filter AI insights belonging to user's findings
    sec_ids = [f[0] for f in db.query(SecurityFinding.id).filter(SecurityFinding.user_id == current_user.id).all()]
    cost_ids = [f[0] for f in db.query(CostFinding.id).filter(CostFinding.user_id == current_user.id).all()]
    
    ai_recommendations = 0
    if sec_ids or cost_ids:
        ai_recommendations = db.query(AIInsight).filter(
            ((AIInsight.finding_id.in_(sec_ids)) & (AIInsight.finding_type == "security")) |
            ((AIInsight.finding_id.in_(cost_ids)) & (AIInsight.finding_type == "cost"))
        ).count()
        
    reports_generated = db.query(ReportHistory).filter(ReportHistory.user_id == current_user.id).count()
    
    return {
        "total_files": total_files,
        "total_resources": total_resources,
        "security_findings": security_findings,
        "cost_findings": cost_findings,
        "potential_savings": potential_savings,
        "ai_recommendations": ai_recommendations,
        "reports_generated": reports_generated
    }


@router.get("/dashboard/activity")
async def get_dashboard_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.models.terraform import TerraformFile, AIInsight, ReportHistory, SecurityFinding, CostFinding
    
    activities = []
    
    # 1. Fetch recent file uploads
    files = db.query(TerraformFile).filter(TerraformFile.user_id == current_user.id).order_by(TerraformFile.upload_time.desc()).limit(5).all()
    for f in files:
        activities.append({
            "text": f"Uploaded {f.file_name}",
            "timestamp": f.upload_time,
            "type": "upload"
        })
        
    # 2. Fetch recent reports generated
    reports = db.query(ReportHistory).filter(ReportHistory.user_id == current_user.id).order_by(ReportHistory.created_at.desc()).limit(5).all()
    for r in reports:
        activities.append({
            "text": f"Generated report: {r.report_name}",
            "timestamp": r.created_at,
            "type": "report"
        })
        
    # 3. Fetch recent AI insights generated
    sec_ids = [f[0] for f in db.query(SecurityFinding.id).filter(SecurityFinding.user_id == current_user.id).all()]
    cost_ids = [f[0] for f in db.query(CostFinding.id).filter(CostFinding.user_id == current_user.id).all()]
    if sec_ids or cost_ids:
        insights = db.query(AIInsight).filter(
            ((AIInsight.finding_id.in_(sec_ids)) & (AIInsight.finding_type == "security")) |
            ((AIInsight.finding_id.in_(cost_ids)) & (AIInsight.finding_type == "cost"))
        ).order_by(AIInsight.created_at.desc()).limit(5).all()
        
        for ins in insights:
            finding_title = "Unknown finding"
            if ins.finding_type == "security":
                f_rec = db.query(SecurityFinding).filter(SecurityFinding.id == ins.finding_id).first()
                if f_rec:
                    finding_title = f_rec.title
            else:
                f_rec = db.query(CostFinding).filter(CostFinding.id == ins.finding_id).first()
                if f_rec:
                    finding_title = f_rec.title
            activities.append({
                "text": f"Generated AI recommendation for {finding_title}",
                "timestamp": ins.created_at,
                "type": "ai"
            })
            
    # Sort all activities by timestamp descending
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Limit to top 10
    return activities[:10]

