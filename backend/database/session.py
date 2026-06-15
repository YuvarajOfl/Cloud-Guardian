import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config.settings import settings

logger = logging.getLogger("backend.database")

# MySQL connection engine, with automatic fallback to SQLite for local development
try:
    # Set a short connection timeout to prevent hanging on startup if server is down
    connect_args = {"connect_timeout": 5}
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,      # Check connection health before queries
        pool_recycle=3600,       # Recycle connections after an hour
        pool_size=10,            # Core pool size
        max_overflow=20,         # Max overflow connections during spikes
        connect_args=connect_args
    )
    # Test connection
    with engine.connect() as conn:
        logger.info("Successfully connected to MySQL database.")
except Exception as conn_err:
    logger.warning(f"MySQL server connection failed: {conn_err}. Falling back to local SQLite database.")
    # Initialize SQLite database file locally
    engine = create_engine(
        "sqlite:///./cloudguardian.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to retrieve database session inside routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
