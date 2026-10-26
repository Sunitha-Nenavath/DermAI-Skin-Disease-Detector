"""
DermAI Backend — Pydantic v2 schemas for request/response validation.
"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ── User Schemas ──────────────────────────────────────────────────────────────
class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    full_name: str = Field(min_length=1, max_length=255)
    role: Literal["patient", "clinician", "researcher", "ml_engineer"] = "patient"

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower().strip()


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.lower().strip()


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Patient Schemas ───────────────────────────────────────────────────────────
class PatientCreateRequest(BaseModel):
    case_code: str = Field(min_length=1, max_length=50)
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    medical_history: str | None = None
    allergies: str | None = None
    clinical_notes: str | None = None


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_code: str
    age: int | None
    gender: str | None
    medical_history: str | None
    allergies: str | None
    clinical_notes: str | None
    created_by: uuid.UUID
    created_at: datetime


# ── Case Schemas ──────────────────────────────────────────────────────────────
class CaseCreateRequest(BaseModel):
    patient_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    body_location: str | None = Field(default=None, max_length=100)


class CaseNoteRequest(BaseModel):
    note: str = Field(min_length=1)


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_code: str
    patient_id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    body_location: str | None
    status: str
    created_at: datetime


class CaseListResponse(BaseModel):
    total: int
    items: list[CaseResponse]


# ── Image Schemas ─────────────────────────────────────────────────────────────
class QualityMetrics(BaseModel):
    blur_score: float
    brightness_mean: float
    contrast_std: float
    width: int
    height: int
    quality_label: Literal["Good", "Acceptable", "Poor"]
    reasons: list[str]


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    original_filename: str | None
    content_type: str | None
    width: int | None
    height: int | None
    size_bytes: int | None
    source: str
    quality_label: str | None
    quality_metrics_json: dict | None
    created_at: datetime


# ── Analysis Schemas ──────────────────────────────────────────────────────────
class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    image_id: uuid.UUID
    status: str
    model_version: str | None
    prediction_json: dict | None
    created_at: datetime


# ── Health Check ──────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str
