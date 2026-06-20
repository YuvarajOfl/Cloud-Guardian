import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "InfraSight Auth Backend"
    APP_ENV: str = "development"
    PORT: int = 8000

    # Database Configuration
    DB_USER: str = "root"
    DB_PASSWORD: str = "rootpassword"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: str = "3306"
    DB_NAME: str = "infrasight"

    # JWT Configuration
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: str = "915887390862-fcgaqrabnob077qjicmpaf79db80cqic.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = ""

    # Gemini API Key Configuration
    GEMINI_API_KEY: str = ""

    # Database URL direct override
    DATABASE_URL: str = ""

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
