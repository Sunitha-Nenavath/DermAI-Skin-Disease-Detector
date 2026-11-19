"""
backend/schemas.py
Pydantic v2 schemas for DermAI request validation and response serialization.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# Base model with standard medical disclaimer
class DermAIBaseModel(BaseModel):
    medical_disclaimer: str = "AI-assisted analysis, not a standalone medical diagnosis."


# --- Authentication Schemas ---
class UserRegister(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.\+\-]+@[\w\.\-]+\.[a-zA-Z0-9]{2,}$", description="Valid email address")
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=120)
    role: str = Field("patient", pattern="^(patient|clinician|researcher|ml_engineer|admin)$")


class UserLogin(BaseModel):
    email: str = Field(..., description="User email")
    password: str


class Token(DermAIBaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: str
    role: str


class UserResponse(DermAIBaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


# --- Patient Schemas ---
class PatientCreate(BaseModel):
    case_code: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = Field("unknown", pattern="^(male|female|other|unknown)$")
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    clinical_notes: Optional[str] = None


class PatientResponse(DermAIBaseModel):
    id: int
    case_code: str
    age: Optional[int]
    gender: Optional[str]
    medical_history: Optional[str]
    allergies: Optional[str]
    clinical_notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Quality Metrics Schemas ---
class QualityMetrics(BaseModel):
    passed: bool
    quality_label: str  # Good, Acceptable, Poor
    blur_laplacian: float
    mean_gray: float
    std_gray: float
    width: int
    height: int
    reasons: List[str]


# --- Image Schemas ---
class ImageUploadResponse(DermAIBaseModel):
    id: int
    case_id: int
    original_filename: str
    content_type: str
    width: int
    height: int
    size_bytes: int
    source: str
    quality_label: str
    quality_metrics: QualityMetrics
    created_at: datetime


class ImageDetailResponse(DermAIBaseModel):
    id: int
    case_id: int
    original_filename: str
    content_type: str
    width: int
    height: int
    size_bytes: int
    source: str
    quality_label: str
    quality_metrics: Dict[str, Any]
    created_at: datetime
    file_url: str
    preprocess_url: str

    model_config = ConfigDict(from_attributes=True)


# --- Case Schemas ---
class CaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body_location: str = Field(
        ...,
        description="HAM10000 body site: back, lower extremity, trunk, upper extremity, abdomen, face, chest, scalp, neck, unknown"
    )
    patient_age: Optional[int] = Field(None, ge=0, le=120)
    patient_gender: Optional[str] = Field("unknown", pattern="^(male|female|other|unknown)$")
    medical_history: Optional[str] = None
    clinical_notes: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    body_location: Optional[str] = None
    status: Optional[str] = None


class NoteCreate(BaseModel):
    notes: str = Field(..., min_length=2, max_length=5000)


class CaseResponse(DermAIBaseModel):
    id: int
    case_code: str
    owner_id: int
    owner_name: Optional[str] = None
    title: str
    body_location: str
    status: str
    created_at: datetime
    patient: Optional[PatientResponse] = None
    images: List[ImageDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- Audit Log Schema ---
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity: str
    entity_id: Optional[str]
    ip: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
