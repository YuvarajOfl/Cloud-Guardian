from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Any

from backend.database.session import get_db
from backend.models.user import User
from backend.models.terraform import TerraformFile, ReportHistory
from backend.models.audit import LoginLog, UsageLog, FailedLogin
from backend.routes.auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin Operations"])

def serialize_user(user: User) -> dict:
    if not user:
        return {}
    # Convert dates to UTC string
    created_at_utc = user.created_at
    if created_at_utc.tzinfo is None:
        created_at_utc = created_at_utc.replace(tzinfo=timezone.utc)
    updated_at_utc = user.updated_at
    if updated_at_utc.tzinfo is None:
        updated_at_utc = updated_at_utc.replace(tzinfo=timezone.utc)
        
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role or "user",
        "provider": user.provider,
        "profile_picture": user.profile_picture,
        "is_active": user.is_active,
        "is_deleted": user.is_deleted,
        "is_admin": user.is_admin,
        "access_level": user.access_level,
        "created_at": created_at_utc.isoformat(),
        "updated_at": updated_at_utc.isoformat()
    }


@router.get("/dashboard")
async def get_admin_dashboard(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns high-level statistics for the admin dashboard.
    """
    total_users = db.query(User).count()
    total_logins = db.query(LoginLog).count()
    total_analyses = db.query(UsageLog).filter(UsageLog.action == "RUN_ANALYSIS").count()
    total_reports = db.query(ReportHistory).count()
    total_uploads = db.query(TerraformFile).count()
    
    # Active users today (last 24 hours)
    day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    active_users_today = db.query(UsageLog.user_id).filter(
        UsageLog.timestamp >= day_ago
    ).distinct().count()
    
    # Recent login activity
    recent_logins_query = db.query(LoginLog).order_by(LoginLog.login_timestamp.desc()).limit(10).all()
    recent_logins = []
    for log in recent_logins_query:
        # Check if user details are cached/mapped
        user_info = serialize_user(log.user) if log.user else {
            "name": "Unknown User",
            "email": log.email
        }
        
        timestamp_utc = log.login_timestamp
        if timestamp_utc.tzinfo is None:
            timestamp_utc = timestamp_utc.replace(tzinfo=timezone.utc)
            
        recent_logins.append({
            "id": log.id,
            "user_id": log.user_id,
            "email": log.email,
            "name": user_info.get("name"),
            "login_method": log.login_method,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "login_timestamp": timestamp_utc.isoformat()
        })
        
    return {
        "total_users": total_users,
        "total_logins": total_logins,
        "total_analyses": total_analyses,
        "total_reports": total_reports,
        "total_uploads": total_uploads,
        "active_users_today": active_users_today,
        "recent_logins": recent_logins
    }

@router.get("/users")
async def get_admin_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role (user or admin)"),
    provider: Optional[str] = Query(None, description="Filter by login provider"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Lists users with optional search and filters.
    """
    query = db.query(User).filter(User.is_deleted == False)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(or_(User.name.like(search_filter), User.email.like(search_filter)))
        
    if role:
        # Since database roles can be NULL (which corresponds to 'user'), handle it
        if role == "user":
            query = query.filter(or_(User.role == "user", User.role.is_(None)))
        else:
            query = query.filter(User.role == role)
            
    if provider:
        query = query.filter(User.provider == provider)
        
    users = query.order_by(User.created_at.desc()).all()
    return [serialize_user(u) for u in users]

@router.get("/user/{id}")
async def get_admin_user_detail(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns diagnostic details for a specific user.
    """
    user_record = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    # User stats
    uploads_count = db.query(TerraformFile).filter(TerraformFile.user_id == id).count()
    analysis_count = db.query(UsageLog).filter(
        UsageLog.user_id == id,
        UsageLog.action == "RUN_ANALYSIS"
    ).count()
    reports_count = db.query(ReportHistory).filter(ReportHistory.user_id == id).count()
    
    # Last login info
    last_login_log = db.query(LoginLog).filter(
        LoginLog.user_id == id
    ).order_by(LoginLog.login_timestamp.desc()).first()
    
    last_login = None
    login_method = None
    if last_login_log:
        ts_utc = last_login_log.login_timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=timezone.utc)
        last_login = ts_utc.isoformat()
        login_method = last_login_log.login_method
        
    # Activity history
    activity_query = db.query(UsageLog).filter(
        UsageLog.user_id == id
    ).order_by(UsageLog.timestamp.desc()).limit(15).all()
    
    activities = []
    for act in activity_query:
        act_ts_utc = act.timestamp
        if act_ts_utc.tzinfo is None:
            act_ts_utc = act_ts_utc.replace(tzinfo=timezone.utc)
            
        activities.append({
            "id": act.id,
            "action": act.action,
            "timestamp": act_ts_utc.isoformat()
        })
        
    return {
        "user": serialize_user(user_record),
        "uploads_count": uploads_count,
        "analysis_count": analysis_count,
        "reports_count": reports_count,
        "last_login": last_login,
        "login_method": login_method,
        "activity": activities
    }

@router.get("/login-logs")
async def get_admin_login_logs(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns login activity history records.
    """
    logs = db.query(LoginLog).order_by(LoginLog.login_timestamp.desc()).limit(100).all()
    result = []
    for log in logs:
        ts_utc = log.login_timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=timezone.utc)
            
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "email": log.email,
            "name": log.user.name if log.user else "Unknown User",
            "login_method": log.login_method,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "login_timestamp": ts_utc.isoformat()
        })
    return result

@router.get("/usage-logs")
async def get_admin_usage_logs(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns general system usage audit records.
    """
    logs = db.query(UsageLog).order_by(UsageLog.timestamp.desc()).limit(100).all()
    result = []
    for log in logs:
        ts_utc = log.timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=timezone.utc)
            
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "email": log.user.email if log.user else "System/Unknown",
            "name": log.user.name if log.user else "Unknown User",
            "action": log.action,
            "timestamp": ts_utc.isoformat()
        })
    return result

@router.get("/security")
async def get_admin_security(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns security auditing information.
    """
    # 1. Failed Login Attempts
    failed_logins = db.query(FailedLogin).order_by(FailedLogin.attempt_timestamp.desc()).limit(50).all()
    failed_list = []
    for f in failed_logins:
        ts_utc = f.attempt_timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=timezone.utc)
            
        failed_list.append({
            "id": f.id,
            "email": f.email,
            "ip_address": f.ip_address,
            "user_agent": f.user_agent,
            "attempt_timestamp": ts_utc.isoformat()
        })
        
    # 2. Recent successful logins (reuse LoginLog)
    recent_logins_query = db.query(LoginLog).order_by(LoginLog.login_timestamp.desc()).limit(10).all()
    recent_list = []
    for log in recent_logins_query:
        ts_utc = log.login_timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=timezone.utc)
            
        recent_list.append({
            "id": log.id,
            "email": log.email,
            "name": log.user.name if log.user else "Unknown User",
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "login_timestamp": ts_utc.isoformat()
        })
        
    # 3. Suspicious Activity detection
    # Flag accounts/emails with > 3 failed login attempts in last 1 hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    # Query database for raw counts
    failed_attempts_by_email = db.query(
        FailedLogin.email,
        func.count(FailedLogin.id).label("failed_count")
    ).filter(
        FailedLogin.attempt_timestamp >= one_hour_ago
    ).group_by(FailedLogin.email).all()
    
    suspicious_activities = []
    for email, count in failed_attempts_by_email:
        if count >= 3:
            suspicious_activities.append({
                "type": "brute_force_risk",
                "severity": "High",
                "description": f"Multiple failed login attempts ({count}) detected for account '{email}' in the last hour.",
                "target": email,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
    # Flag IPs with multiple failed logins
    failed_attempts_by_ip = db.query(
        FailedLogin.ip_address,
        func.count(FailedLogin.id).label("failed_count")
    ).filter(
        FailedLogin.attempt_timestamp >= one_hour_ago
    ).group_by(FailedLogin.ip_address).all()
    
    for ip, count in failed_attempts_by_ip:
        if ip and count >= 5:
            suspicious_activities.append({
                "type": "ip_blocking_risk",
                "severity": "Medium",
                "description": f"IP address {ip} has registered {count} login failures in the last hour.",
                "target": ip,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

    # Flag users with excessive uploads (e.g. > 10 files in 24 hours)
    day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    active_uploads = db.query(
        UsageLog.user_id,
        func.count(UsageLog.id).label("upload_count")
    ).filter(
        UsageLog.action == "UPLOAD_FILE",
        UsageLog.timestamp >= day_ago
    ).group_by(UsageLog.user_id).all()
    
    for user_id, count in active_uploads:
        if count >= 10:
            user = db.query(User).filter(User.id == user_id).first()
            username = user.name if user else f"User ID {user_id}"
            suspicious_activities.append({
                "type": "excessive_uploads",
                "severity": "Low",
                "description": f"User '{username}' uploaded {count} Terraform configurations in the last 24 hours.",
                "target": username,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
    # 4. Most Active Users
    most_active_query = db.query(
        UsageLog.user_id,
        func.count(UsageLog.id).label("activity_count")
    ).group_by(UsageLog.user_id).order_by(desc("activity_count")).limit(5).all()
    
    most_active = []
    for u_id, count in most_active_query:
        if not u_id:
            continue
        user = db.query(User).filter(User.id == u_id).first()
        if user:
            # Stats breakdown
            uploads = db.query(TerraformFile).filter(TerraformFile.user_id == u_id).count()
            analyses = db.query(UsageLog).filter(UsageLog.user_id == u_id, UsageLog.action == "RUN_ANALYSIS").count()
            reports = db.query(ReportHistory).filter(ReportHistory.user_id == u_id).count()
            
            most_active.append({
                "id": u_id,
                "name": user.name,
                "email": user.email,
                "activity_count": count,
                "uploads": uploads,
                "analyses": analyses,
                "reports": reports
            })
            
    return {
        "failed_login_attempts": failed_list,
        "recent_logins": recent_list,
        "suspicious_activity": suspicious_activities,
        "most_active_users": most_active
    }

@router.get("/bootstrap-status")
async def get_bootstrap_status(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Returns the bootstrap status of the system administrator.
    """
    from backend.config.settings import settings
    email = settings.ADMIN_EMAIL.lower().strip() if settings.ADMIN_EMAIL else None
    admin_exists = False
    if email:
        admin_exists = db.query(User).filter(
            User.email == email,
            User.role == "admin"
        ).first() is not None
        
    return {
        "admin_exists": admin_exists,
        "email": email
    }


@router.post("/user/{id}/disable")
async def disable_user(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Disables an operator account. Safety guards:
    - Cannot disable own account.
    - Cannot disable the last active administrator account.
    """
    from backend.services.audit_service import log_usage_action
    
    target_user = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if target_user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own account."
        )
        
    if target_user.role == "admin" and target_user.is_active:
        # Check if this is the last active admin
        active_admins_count = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
            User.is_deleted == False
        ).count()
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last administrator account."
            )
            
    target_user.is_active = False
    db.commit()
    db.refresh(target_user)
    
    log_usage_action(db, admin_user.id, "user_disabled")
    return {
        "success": True,
        "message": f"Successfully disabled operator account {target_user.email}",
        "user": serialize_user(target_user)
    }


@router.post("/user/{id}/enable")
async def enable_user(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Enables a disabled operator account.
    """
    from backend.services.audit_service import log_usage_action
    
    target_user = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    target_user.is_active = True
    db.commit()
    db.refresh(target_user)
    
    log_usage_action(db, admin_user.id, "user_enabled")
    return {
        "success": True,
        "message": f"Successfully enabled operator account {target_user.email}",
        "user": serialize_user(target_user)
    }


@router.post("/user/{id}/promote")
async def promote_user(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Promotes a standard user to the admin role.
    """
    from backend.services.audit_service import log_usage_action
    
    target_user = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    target_user.role = "admin"
    db.commit()
    db.refresh(target_user)
    
    log_usage_action(db, admin_user.id, "user_promoted")
    return {
        "success": True,
        "message": f"Successfully promoted operator {target_user.email} to administrator",
        "user": serialize_user(target_user)
    }


@router.post("/user/{id}/demote")
async def demote_user(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Demotes an admin to standard user. Safety guards:
    - Cannot demote own account.
    - Cannot demote the last active administrator account.
    """
    from backend.services.audit_service import log_usage_action
    
    target_user = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if target_user.role == "admin" and target_user.is_active:
        # Check if this is the last active admin
        active_admins_count = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
            User.is_deleted == False
        ).count()
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last administrator account."
            )
            
    target_user.role = "user"
    db.commit()
    db.refresh(target_user)
    
    log_usage_action(db, admin_user.id, "user_demoted")
    return {
        "success": True,
        "message": f"Successfully demoted operator {target_user.email} to standard user",
        "user": serialize_user(target_user)
    }


@router.delete("/user/{id}")
async def delete_user(
    id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin)
):
    """
    Soft-deletes an operator account. Safety guards:
    - Cannot delete own account.
    - Cannot delete the last active administrator account.
    """
    from backend.services.audit_service import log_usage_action
    
    target_user = db.query(User).filter(User.id == id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if target_user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account."
        )
        
    if target_user.role == "admin" and target_user.is_active:
        # Check if this is the last active admin
        active_admins_count = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
            User.is_deleted == False
        ).count()
        if active_admins_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last administrator account."
            )
            
    target_user.is_deleted = True
    target_user.is_active = False
    db.commit()
    
    log_usage_action(db, admin_user.id, "user_deleted")
    return {
        "success": True,
        "message": f"Successfully deleted operator account {target_user.email}"
    }



