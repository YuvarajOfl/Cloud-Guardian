import hashlib
import re
import time
import logging
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Any

from backend.database.session import get_db
from backend.models.user import User
from backend.routes.auth import get_current_user
from backend.models.terraform import SecurityFinding, CostFinding, AIInsight, AIAnalysisCache, AIFollowUpCache
from backend.schemas.ai import AIInsightResponse, AIFollowUpRequest, AIFollowUpResponse
from backend.services.gemini_service import analyze_finding, ask_gemini_follow_up, get_fallback_answer_for_question, check_context_needed
from backend.config.settings import settings

logger = logging.getLogger("backend.routes.ai")
observability_logger = logging.getLogger("backend.ai_observability")


router = APIRouter(prefix="/api/ai", tags=["AI Insights Advisor"])

@router.get("/health")
async def check_ai_health(db: Session = Depends(get_db)):
    """
    Temporary endpoint to verify end-to-end Gemini API connectivity and configurations.
    """
    api_key = settings.GEMINI_API_KEY
    api_key_loaded = bool(api_key and "your_api_key" not in api_key.lower())
    gemini_configured = api_key_loaded
    model_name = "gemini-1.5-flash"
    connection_successful = False
    raw_response = None
    
    if api_key_loaded:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": "Reply with exactly: INFRASIGHT_GEMINI_ONLINE"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.0
            }
        }
        headers = {"Content-Type": "application/json"}
        import requests
        try:
            logger.info("Sending health check request to Gemini API...")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                result = response.json()
                candidates = result.get("candidates", [])
                if candidates:
                    raw_response = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    logger.info(f"Gemini API Health response received: '{raw_response}'")
                    if "INFRASIGHT_GEMINI_ONLINE" in raw_response:
                        connection_successful = True
                else:
                    logger.error("No candidates in Gemini health check response.")
            else:
                logger.error(f"Gemini health check API error {response.status_code}: {response.text}")
        except Exception as exc:
            logger.error(f"Exception during Gemini health check API call: {exc}")
            
    return {
        "gemini_configured": gemini_configured,
        "api_key_loaded": api_key_loaded,
        "model": model_name,
        "connection_successful": connection_successful,
        "raw_response": raw_response
    }

def calculate_finding_hash(finding, finding_type: str) -> str:
    """
    Computes a deterministic SHA-256 hash based on key properties of a finding.
    Excludes user_id, file_id, resource_name, and cost values to optimize global caching.
    """
    hash_input = f"{finding_type}:{finding.resource_type}:{finding.title}:{finding.description}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

@router.post("/analyze/{finding_id}", response_model=AIInsightResponse, status_code=status.HTTP_201_CREATED)
async def generate_ai_analysis(
    finding_id: int,
    finding_type: str = Query(..., pattern="^(security|cost)$", description="Type of finding: 'security' or 'cost'"),
    simulate_error: str = Query(None, description="Simulate Gemini error: 'invalid_key', 'timeout', or 'quota'"),
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

    from backend.services.audit_service import log_usage_action
    log_usage_action(db, current_user.id, "RUN_ANALYSIS")

    # 2. Check Local Cache
    cached_insight = db.query(AIInsight).filter(
        AIInsight.finding_id == finding_id, 
        AIInsight.finding_type == finding_type
    ).first()
    
    if cached_insight:
        logger.info("[AI] Using Cached Fallback")
        # Ensure response has source
        if isinstance(cached_insight.response, dict) and "source" not in cached_insight.response:
            resp_copy = dict(cached_insight.response)
            resp_copy["source"] = "cache"
            cached_insight.response = resp_copy
        return cached_insight

    # 3. Calculate finding hash & Check Global Cache
    finding_hash = calculate_finding_hash(finding, finding_type)
    global_cache = db.query(AIAnalysisCache).filter(
        AIAnalysisCache.finding_hash == finding_hash,
        AIAnalysisCache.finding_type == finding_type
    ).first()

    if global_cache:
        logger.info("[AI] Using Cached Fallback")
        # Reconstruct response_dict from global cache columns
        if finding_type == "security":
            response_dict = {
                "issue_summary": global_cache.analysis,
                "why_this_matters": global_cache.why_this_matters,
                "business_impact": global_cache.business_impact,
                "recommended_fix": global_cache.recommended_fix,
                "terraform_example": global_cache.terraform_fix,
                "best_practice": global_cache.best_practice,
                "source": "cache"
            }
        else:  # cost
            response_dict = {
                "cost_concern": global_cache.analysis,
                "estimated_impact": global_cache.business_impact,
                "optimization_suggestion": global_cache.recommended_fix,
                "alternative_resource_recommendation": global_cache.terraform_fix,
                "best_practice": global_cache.best_practice,
                "source": "cache"
            }
        
        # Save to local cache
        prompt_text = f"Analyze {finding_type} finding: {finding.title} for resource {finding.resource_name}"
        db_insight = AIInsight(
            finding_id=finding_id,
            finding_type=finding_type,
            prompt=prompt_text,
            response=response_dict
        )
        try:
            db.add(db_insight)
            db.commit()
            db.refresh(db_insight)
            return db_insight
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save cached AI explanation: {str(e)}"
            )

    # 4. Call Gemini AI via Service
    try:
        is_real_gemini = bool(settings.GEMINI_API_KEY and not simulate_error)
        if is_real_gemini:
            logger.info("[AI] Using Gemini API")
        else:
            logger.info("[AI] Using Cached Fallback")
            
        response_dict = analyze_finding(finding, finding_type, simulate_error=simulate_error)
        response_dict["source"] = "gemini" if is_real_gemini else "fallback"
        
        # Determine database columns for global cache
        if finding_type == "security":
            analysis = response_dict.get("issue_summary", "")
            why_this_matters = response_dict.get("why_this_matters", "")
            business_impact = response_dict.get("business_impact", "")
            recommended_fix = response_dict.get("recommended_fix", "")
            terraform_fix = response_dict.get("terraform_example", "")
            best_practice = response_dict.get("best_practice", "")
        else:  # cost
            analysis = response_dict.get("cost_concern", "")
            why_this_matters = None
            business_impact = response_dict.get("estimated_impact", "")
            recommended_fix = response_dict.get("optimization_suggestion", "")
            terraform_fix = response_dict.get("alternative_resource_recommendation", "")
            best_practice = response_dict.get("best_practice", "")

        # Save to global cache
        global_cache_entry = AIAnalysisCache(
            finding_hash=finding_hash,
            finding_type=finding_type,
            analysis=analysis,
            why_this_matters=why_this_matters,
            business_impact=business_impact,
            recommended_fix=recommended_fix,
            terraform_fix=terraform_fix,
            best_practice=best_practice,
            source="gemini" if is_real_gemini else "fallback"
        )
        
        # Save to local cache
        prompt_text = f"Analyze {finding_type} finding: {finding.title} for resource {finding.resource_name}"
        db_insight = AIInsight(
            finding_id=finding_id,
            finding_type=finding_type,
            prompt=prompt_text,
            response=response_dict
        )

        try:
            db.add(global_cache_entry)
            db.add(db_insight)
            db.commit()
            db.refresh(db_insight)
            return db_insight
        except Exception:
            db.rollback()
            # Handle possible concurrent insert/IntegrityError on finding_hash by trying to just insert local insight
            # First, verify if global cache was inserted by another request
            db_global_existing = db.query(AIAnalysisCache).filter(
                AIAnalysisCache.finding_hash == finding_hash,
                AIAnalysisCache.finding_type == finding_type
            ).first()
            if db_global_existing:
                try:
                    db.add(db_insight)
                    db.commit()
                    db.refresh(db_insight)
                    return db_insight
                except Exception as inner_e:
                    db.rollback()
                    raise inner_e
            else:
                raise
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


# rate limit state: user_id -> list of timestamps
user_request_timestamps = defaultdict(list)
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 10

def check_rate_limit(user_id: int) -> bool:
    now = time.time()
    user_times = user_request_timestamps[user_id]
    # filter timestamps older than rate limit window
    user_times = [t for t in user_times if now - t < RATE_LIMIT_WINDOW]
    user_request_timestamps[user_id] = user_times
    
    if len(user_times) >= RATE_LIMIT_MAX_REQUESTS:
        return False
        
    user_request_timestamps[user_id].append(now)
    return True

def check_prompt_injection(question: str) -> bool:
    suspicious_patterns = [
        r"ignore\s+(?:all\s+)?previous\s+instructions",
        r"system\s+prompt",
        r"override\s+(?:the\s+)?rules",
        r"you\s+are\s+no\s+longer",
        r"acting\s+as\s+a",
        r"new\s+instruction",
        r"disregard\s+above"
    ]
    for pattern in suspicious_patterns:
        if re.search(pattern, question, re.IGNORECASE):
            return True
    return False

@router.post("/ask", response_model=AIFollowUpResponse)
async def ask_ai_question(
    payload: AIFollowUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Handles follow-up questions about security findings.
    Validates requests, caches responses, falls back to local KB on API issue or rate limit.
    """
    question = payload.question.strip()
    
    # Validation
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty or only whitespace."
        )
        
    if len(question) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question exceeds maximum length of 500 characters."
        )
        
    if check_prompt_injection(question):
        observability_logger.warning(
            f"[AI OBSERVABILITY] type=prompt_injection_blocked user_id={current_user.id} question=\"{question}\""
        )
        return AIFollowUpResponse(
            answer="The question provided contains invalid or unsafe instructions. Please ask a valid question about the cloud security finding.",
            source="fallback",
            mode="general"
        )
        
    # Coerce finding_id to int
    try:
        finding_id_int = int(payload.finding_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid finding_id format. Must be an integer."
        )
        
    # Look up finding
    finding = db.query(SecurityFinding).filter(
        SecurityFinding.id == finding_id_int,
        SecurityFinding.user_id == current_user.id
    ).first()
    
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security finding not found or access denied."
        )
        
    finding_type = "security"
    
    # Determine mode dynamically based on question and finding
    context_needed = check_context_needed(question, finding)
    mode = "context" if context_needed else "general"
    
    # Check Intelligent Cache
    cached_entry = db.query(AIFollowUpCache).filter(
        AIFollowUpCache.finding_type == finding_type,
        AIFollowUpCache.resource_type == finding.resource_type,
        AIFollowUpCache.severity == finding.severity,
        AIFollowUpCache.question == question.lower()
    ).first()
    
    if cached_entry:
        logger.info("[AI] Using Cached Fallback")
        observability_logger.info(
            f"[AI OBSERVABILITY] type=cache_hit finding_type={finding_type} resource_type={finding.resource_type} severity={finding.severity} question=\"{question}\""
        )
        return AIFollowUpResponse(
            answer=cached_entry.answer,
            source="cache",
            mode=mode
        )
        
    # Rate Limiting
    rate_limit_ok = check_rate_limit(current_user.id)
    
    answer = None
    source = "gemini"
    start_time = time.time()
    
    if not rate_limit_ok:
        logger.info("[AI] Using Cached Fallback")
        observability_logger.info(
            f"[AI OBSERVABILITY] type=fallback_activation reason=rate_limit finding_type={finding_type} resource_type={finding.resource_type} severity={finding.severity}"
        )
        answer = get_fallback_answer_for_question(finding, question)
        source = "fallback"
    else:
        try:
            # Call Real Gemini
            if settings.GEMINI_API_KEY and not payload.simulate_error:
                logger.info("[AI] Using Gemini API")
            else:
                logger.info("[AI] Using Cached Fallback")
            answer = ask_gemini_follow_up(finding, question, simulate_error=payload.simulate_error)
            response_time = time.time() - start_time
            observability_logger.info(
                f"[AI OBSERVABILITY] type=gemini_call status=success response_time={response_time:.2f}s finding_type={finding_type} resource_type={finding.resource_type} severity={finding.severity}"
            )
        except Exception as exc:
            logger.info("[AI] Using Cached Fallback")
            response_time = time.time() - start_time
            observability_logger.warning(
                f"[AI OBSERVABILITY] type=gemini_call status=failed error=\"{str(exc)}\" response_time={response_time:.2f}s finding_type={finding_type} resource_type={finding.resource_type} severity={finding.severity}"
            )
            # Automatic Fallback
            observability_logger.info(
                f"[AI OBSERVABILITY] type=fallback_activation reason=gemini_failed finding_type={finding_type} resource_type={finding.resource_type} severity={finding.severity}"
            )
            answer = get_fallback_answer_for_question(finding, question)
            source = "fallback"
            
    # Cache the result
    try:
        new_cache_entry = AIFollowUpCache(
            finding_type=finding_type,
            resource_type=finding.resource_type,
            severity=finding.severity,
            question=question.lower(),
            answer=answer,
            source=source
        )
        db.add(new_cache_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cache follow up answer: {e}")
        
    return AIFollowUpResponse(
        answer=answer,
        source=source,
        mode=mode
    )

