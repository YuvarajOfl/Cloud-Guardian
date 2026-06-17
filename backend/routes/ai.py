from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from backend.database.session import get_db
from backend.models.user import User
from backend.routes.auth import get_current_user
from backend.models.terraform import SecurityFinding, CostFinding, AIInsight
from backend.schemas.ai import AIInsightResponse
from backend.services.gemini_service import analyze_finding

router = APIRouter(prefix="/api/ai", tags=["AI Insights Advisor"])

@router.post("/analyze/{finding_id}", response_model=AIInsightResponse, status_code=status.HTTP_201_CREATED)
async def generate_ai_analysis(
    finding_id: int,
    finding_type: str = Query(..., pattern="^(security|cost)$", description="Type of finding: 'security' or 'cost'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates an AI explanation and remediation advice for a finding.
    First checks if a cached insight exists. If not, queries Gemini AI and caches the result.
    """
    # 1. Check permissions (Does the finding belong to the user?)
    if finding_type == "security":
        finding = db.query(SecurityFinding).filter(
            SecurityFinding.id == finding_id, 
            SecurityFinding.user_id == current_user.id
        ).first()
    else:  # cost
        finding = db.query(CostFinding).filter(
            CostFinding.id == finding_id, 
            CostFinding.user_id == current_user.id
        ).first()

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{finding_type.capitalize()} finding not found or access denied."
        )

    # 2. Check Cache
    cached_insight = db.query(AIInsight).filter(
        AIInsight.finding_id == finding_id, 
        AIInsight.finding_type == finding_type
    ).first()
    
    if cached_insight:
        # Return status 201 code but from cache
        return cached_insight

    # 3. Call Gemini AI via Service
    try:
        response_dict = analyze_finding(finding, finding_type)
        
        # Save to cache
        prompt_text = f"Analyze {finding_type} finding: {finding.title} for resource {finding.resource_name}"
        db_insight = AIInsight(
            finding_id=finding_id,
            finding_type=finding_type,
            prompt=prompt_text,
            response=response_dict
        )
        db.add(db_insight)
        db.commit()
        db.refresh(db_insight)
        return db_insight
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI explanation: {str(e)}"
        )

@router.get("/insights", response_model=List[AIInsightResponse])
async def get_all_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all AI insights generated for the logged-in user.
    """
    # Get user's security and cost finding IDs to filter cached insights securely
    security_ids = [f[0] for f in db.query(SecurityFinding.id).filter(SecurityFinding.user_id == current_user.id).all()]
    cost_ids = [f[0] for f in db.query(CostFinding.id).filter(CostFinding.user_id == current_user.id).all()]

    # Query insights belonging to this user
    insights = db.query(AIInsight).filter(
        ((AIInsight.finding_id.in_(security_ids)) & (AIInsight.finding_type == "security")) |
        ((AIInsight.finding_id.in_(cost_ids)) & (AIInsight.finding_type == "cost"))
    ).order_by(AIInsight.created_at.desc()).all() if (security_ids or cost_ids) else []

    return insights

@router.get("/insights/{finding_id}", response_model=AIInsightResponse)
async def get_insight_by_finding(
    finding_id: int,
    finding_type: str = Query(..., pattern="^(security|cost)$", description="Type of finding: 'security' or 'cost'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the AI insight for a specific finding if it exists and the user has access.
    """
    # Verify ownership
    if finding_type == "security":
        finding = db.query(SecurityFinding).filter(
            SecurityFinding.id == finding_id, 
            SecurityFinding.user_id == current_user.id
        ).first()
    else:
        finding = db.query(CostFinding).filter(
            CostFinding.id == finding_id, 
            CostFinding.user_id == current_user.id
        ).first()

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found or access denied."
        )

    insight = db.query(AIInsight).filter(
        AIInsight.finding_id == finding_id, 
        AIInsight.finding_type == finding_type
    ).first()

    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI insight not generated yet for this finding."
        )

    return insight
