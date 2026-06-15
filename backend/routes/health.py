from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.session import get_db

router = APIRouter(prefix="/health", tags=["System Health"])

@router.get("")
async def health_check(db: Session = Depends(get_db)):
    """
    Returns system health status and validates database connection.
    """
    try:
        # Execute basic raw SQL to verify connection health
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "database": db_status
    }
