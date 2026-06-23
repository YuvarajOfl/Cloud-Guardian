import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("backend")

from backend.config.settings import settings

# Startup checks and validation
# 1. Critical validation for JWT_SECRET
if not settings.JWT_SECRET or settings.JWT_SECRET.strip() == "":
    logger.critical("FATAL: JWT_SECRET environment variable is missing or empty! JWT tokens cannot be signed.")
    raise RuntimeError("JWT_SECRET is missing")

# 2. Informative warning checks for optional external API credentials
if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.strip() == "":
    logger.warning("WARNING: GEMINI_API_KEY is not configured. AI advisor queries will fall back to mock analysis.")

if not settings.GOOGLE_CLIENT_ID or settings.GOOGLE_CLIENT_ID.strip() == "":
    logger.warning("WARNING: GOOGLE_CLIENT_ID is not configured. Google OAuth button will fallback to developer ID.")

if not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_SECRET.strip() == "":
    logger.warning("WARNING: GOOGLE_CLIENT_SECRET is not configured. Google OAuth authentication will not function.")

from backend.database.session import engine, Base, mask_database_url

def mask_secret(value: str) -> str:
    if not value:
        return "empty"
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}...{value[-4:]}"

logger.info("--------- Backend Runtime Configuration ---------")
logger.info(f"APP_ENV: {settings.APP_ENV}")
logger.info(f"PORT: {settings.PORT}")
logger.info(f"GOOGLE_CLIENT_ID: {settings.GOOGLE_CLIENT_ID}")
logger.info(f"JWT_SECRET (SECRET_KEY): {mask_secret(settings.JWT_SECRET)}")
logger.info(f"DATABASE_URL: {mask_database_url(settings.database_url)}")
logger.info("-------------------------------------------------")

# Import models to ensure they are registered on Base for table creation
from backend.models.user import User
from backend.models.terraform import TerraformFile, TerraformResource, SecurityFinding, AIInsight, ReportHistory, AIAnalysisCache, AIFollowUpCache
from backend.models.audit import LoginLog, UsageLog, FailedLogin
from backend.routes.auth import router as auth_router
from backend.routes.health import router as health_router
from backend.routes.terraform import router as terraform_router
from backend.routes.ai import router as ai_router
from backend.routes.admin import router as admin_router
from backend.middleware.error_handler import setup_exception_handlers

# Automatically generate database tables and directories on startup
try:
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

    # Schema migration: check and add missing columns defensively
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("users")]
        with engine.begin() as conn:
            if "is_active" not in columns:
                logger.info("Adding is_active column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            if "is_deleted" not in columns:
                logger.info("Adding is_deleted column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0"))

    # Backfill role/active/deleted columns for any existing users
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET role = 'user' WHERE role IS NULL"))
        conn.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
        conn.execute(text("UPDATE users SET is_deleted = 0 WHERE is_deleted IS NULL"))
    logger.info("Database role and active status backfill completed successfully.")


    # 3. Bootstrap Administrator account if configured
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
        email = settings.ADMIN_EMAIL.lower().strip()
        logger.info(f"Checking for bootstrap administrator: {email}...")
        
        from backend.database.session import SessionLocal
        from backend.models.user import User
        from backend.utils.security import get_password_hash
        from backend.models.terraform import TerraformFile, ReportHistory  # Register relationship mappers
        
        db = SessionLocal()
        try:
            admin_user = db.query(User).filter(User.email == email).first()
            if admin_user:
                if admin_user.role != "admin":
                    admin_user.role = "admin"
                    db.commit()
                    logger.info(f"[ADMIN] Elevated existing user {email} to admin role.")
            else:
                pwd_hash = get_password_hash(settings.ADMIN_PASSWORD)
                new_admin = User(
                    name="System Administrator",
                    email=email,
                    password_hash=pwd_hash,
                    provider="local",
                    role="admin"
                )
                db.add(new_admin)
                db.commit()
                logger.info(f"[ADMIN] Created new admin user: {email}")
                
            logger.info("[ADMIN] Bootstrap admin verified")
        except Exception as bootstrap_err:
            db.rollback()
            logger.error(f"Failed to verify/bootstrap admin: {bootstrap_err}")
        finally:
            db.close()

    # Ensure uploads folders exist defensively on startup
    import os
    for dir_path in [
        os.path.join("uploads"),
        os.path.join("uploads", "reports"),
        os.path.join("uploads", "user_1")
    ]:
        try:
            os.makedirs(dir_path, exist_ok=True)
            logger.info(f"Startup directory verified/created: {dir_path}")
        except Exception as dir_err:
            logger.error(f"Startup directory verification warning: Failed to create {dir_path} due to: {dir_err}. Permissions review required.")
    
    # Log GEMINI_API_KEY loading state on startup
    if settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY is loaded successfully from environment variables.")
    else:
        logger.warning("GEMINI_API_KEY is NOT configured. Gemini AI functionality will fall back to mock analysis.")
except Exception as e:
    logger.error(f"Failed to initialize database tables or directories: {e}. If using MySQL, verify settings in .env.")

# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Secure Production Auth Backend for InfraSight",
    version="1.0.0",
    debug=settings.APP_ENV == "development"
)

# Register global custom exceptions (HTTP, Validation, Server errors)
setup_exception_handlers(app)

# Configure CORS Middleware to allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router)
app.include_router(health_router)
app.include_router(terraform_router)
app.include_router(ai_router)
app.include_router(admin_router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to the InfraSight Auth Backend API. Access /docs for Swagger documentation.",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.APP_ENV == "development"
    )
