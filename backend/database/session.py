import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config.settings import settings

logger = logging.getLogger("backend.database")

def mask_database_url(url: str) -> str:
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        if parsed.password:
            username = parsed.username or ""
            netloc = f"{username}:***"
            if parsed.hostname:
                netloc += f"@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            parsed = parsed._replace(netloc=netloc)
        return parsed.geturl()
    except Exception:
        return url

def ensure_sqlite_dir_exists(url: str):
    if url.startswith("sqlite:///"):
        import os
        path = url.replace("sqlite:///", "")
        if os.name == 'nt' and path.startswith("/") and len(path) > 2 and path[2] == ":":
            path = path.lstrip("/")
        db_dir = os.path.dirname(path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

# MySQL connection engine, with automatic fallback to SQLite for local development
def try_connect_database():
    import time
    
    # If the URL is SQLite, return immediately
    if settings.database_url.startswith("sqlite"):
        ensure_sqlite_dir_exists(settings.database_url)
        return create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False}
        )

    # For MySQL, attempt connection with retries to resolve startup race conditions
    max_retries = 5
    retry_interval = 2
    last_err = None

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempting to connect to database (attempt {attempt}/{max_retries})...")
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
                db_type = "SQLite" if settings.database_url.startswith("sqlite") else "MySQL"
                logger.info(f"Successfully connected to {db_type} database.")
            logger.info(f"Database engine initialized with URL: {mask_database_url(settings.database_url)}")
            return engine
        except Exception as e:
            last_err = e
            logger.warning(f"Database connection attempt {attempt} failed: {e}")
            if attempt < max_retries:
                time.sleep(retry_interval)

    # If all attempts failed, fallback defensively to SQLite
    logger.critical(f"All MySQL database connection attempts failed: {last_err}. Falling back to SQLite as defensive measure.")
    
    import os
    if os.path.exists("/.dockerenv") or os.environ.get("APP_ENV") == "production" or os.path.exists("/app"):
        db_dir = "/app/data"
    else:
        db_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database"))
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, "infrasight.db")
    sqlite_url = f"sqlite:///{db_path}"
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )
    logger.info(f"Database engine initialized with URL: {mask_database_url(sqlite_url)}")
    return engine

engine = try_connect_database()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to retrieve database session inside routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
