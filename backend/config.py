"""
backend/config.py
Pydantic v2 application configuration and environment settings for DermAI.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Information
    APP_NAME: str = "DermAI: Skin Disease Detector"
    APP_VERSION: str = "1.0.0-m1"
    DEBUG: bool = True
    
    # Disclaimer
    MEDICAL_DISCLAIMER: str = "AI-assisted analysis, not a standalone medical diagnosis."
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dermai.db")
    
    # Authentication & JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dermai_dev_secret_key_clinical_screening_49204")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    
    # Storage Configuration
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # 'local' or 'minio'
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "./backend/storage")
    
    # MinIO / S3 Configuration
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "dermai-images")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    
    # Seed Passwords (pulled from env, never hardcoded)
    DEMO_PATIENT_PASSWORD: str = os.getenv("DEMO_PATIENT_PASSWORD", "PatientSecure123!")
    DEMO_CLINICIAN_PASSWORD: str = os.getenv("DEMO_CLINICIAN_PASSWORD", "ClinicianDoctor123!")
    DEMO_RESEARCHER_PASSWORD: str = os.getenv("DEMO_RESEARCHER_PASSWORD", "ResearchScience123!")
    DEMO_ML_ENGINEER_PASSWORD: str = os.getenv("DEMO_ML_ENGINEER_PASSWORD", "MLEngineerModel123!")
    DEMO_ADMIN_PASSWORD: str = os.getenv("DEMO_ADMIN_PASSWORD", "AdminSuperUser123!")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
