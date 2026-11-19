"""
backend/models.py
SQLAlchemy 2 database models for DermAI.
Tables: users, patients, cases, images, analyses, audit_logs.
"""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from backend.database import Base


class UserRole(str, PyEnum):
    PATIENT = "patient"
    CLINICIAN = "clinician"
    RESEARCHER = "researcher"
    ML_ENGINEER = "ml_engineer"
    ADMIN = "admin"


class CaseStatus(str, PyEnum):
    PENDING_REVIEW = "pending_review"
    QUALITY_PASSED = "quality_passed"
    QUALITY_REJECTED = "quality_rejected"
    ANALYSIS_QUEUED = "analysis_queued"
    CLOSED = "closed"


class ImageSource(str, PyEnum):
    CAMERA = "camera"
    GALLERY = "gallery"


class QualityLabel(str, PyEnum):
    GOOD = "Good"
    ACCEPTABLE = "Acceptable"
    POOR = "Poor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(32), default=UserRole.PATIENT.value, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    cases = relationship("Case", back_populates="owner", cascade="all, delete-orphan")
    created_patients = relationship("Patient", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")


class Patient(Base):
    """
    De-identified clinical patient store. Strictly no real patient names or PII.
    """
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    case_code = Column(String(64), unique=True, index=True, nullable=False)  # e.g. PAT-2026-001
    age = Column(Integer, nullable=True)
    gender = Column(String(32), nullable=True)  # male, female, other, unknown
    medical_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    clinical_notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", back_populates="created_patients")
    cases = relationship("Case", back_populates="patient")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_code = Column(String(64), unique=True, index=True, nullable=False)  # e.g. CASE-2026-X01
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body_location = Column(String(64), nullable=False, index=True)  # back, lower extremity, trunk, face, etc.
    status = Column(String(32), default=CaseStatus.PENDING_REVIEW.value, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    owner = relationship("User", back_populates="cases")
    patient = relationship("Patient", back_populates="cases")
    images = relationship("Image", back_populates="case", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="case", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    storage_key = Column(String(512), nullable=False)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(64), nullable=False)  # image/jpeg, image/png
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    capture_date = Column(DateTime, default=datetime.utcnow, nullable=True)
    source = Column(String(32), default=ImageSource.CAMERA.value, nullable=False)
    quality_label = Column(String(32), nullable=False, index=True)  # Good, Acceptable, Poor
    quality_metrics_json = Column(Text, nullable=False)  # JSON string of metrics & reasons
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="images")
    analyses = relationship("Analysis", back_populates="image", cascade="all, delete-orphan")


class Analysis(Base):
    """
    Reserved for Milestones 2–4 deep learning predictions and Grad-CAM maps.
    Empty for Milestone 1.
    """
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    image_id = Column(Integer, ForeignKey("images.id"), nullable=False, index=True)
    status = Column(String(32), default="pending", nullable=False)  # pending, completed, failed
    model_version = Column(String(64), nullable=True)
    prediction_json = Column(Text, nullable=True)  # JSON predictions, confidences
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="analyses")
    image = relationship("Image", back_populates="analyses")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)  # REGISTER, LOGIN, CASE_CREATE, IMAGE_UPLOAD, NOTE_ADD
    entity = Column(String(64), nullable=False)  # user, patient, case, image
    entity_id = Column(String(64), nullable=True)
    ip = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
