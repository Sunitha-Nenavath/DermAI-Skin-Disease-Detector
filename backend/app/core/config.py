"""
DermAI Backend — Application Configuration
Reads settings from environment variables / .env file.
"""
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_name: str = "DermAI"
    app_version: str = "1.0.0"
    debug: bool = True
    log_level: str = "INFO"

    # ── API ───────────────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://dermai_user:change_me_in_production@localhost:5432/dermai"
    )

    # ── Auth ──────────────────────────────────────────────────────────────────
    jwt_secret_key: str = "CHANGE_ME_GENERATE_WITH_SECRETS_TOKEN_HEX_32"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # ── Storage ───────────────────────────────────────────────────────────────
    storage_backend: Literal["local", "minio"] = "local"
    local_storage_path: str = "./storage"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket: str = "dermai-images"
    minio_secure: bool = False

    # ── ML ────────────────────────────────────────────────────────────────────
    model_input_size: int = 224
    hair_removal_enabled: bool = True
    clahe_enabled: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
