import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.config.settings import settings
from backend.database.session import engine, Base
# Import models to ensure they are registered on Base for table creation
from backend.models.user import User
from backend.models.terraform import TerraformFile, TerraformResource, SecurityFinding, AIInsight
from backend.routes.auth import router as auth_router
from backend.routes.health import router as health_router
from backend.routes.terraform import router as terraform_router
from backend.routes.ai import router as ai_router
from backend.middleware.error_handler import setup_exception_handlers


# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("backend")

# Automatically generate database tables on startup
try:
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize database tables: {e}. If using MySQL, verify settings in .env.")

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
