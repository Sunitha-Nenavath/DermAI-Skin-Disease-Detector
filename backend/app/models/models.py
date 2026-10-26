"""
DermAI Backend — SQLAlchemy ORM Models
All tables defined here match docs/04_database.md exactly.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────
UserRole = Enum(
    "patient", "clinician", "researcher", "ml_engineer", "admin",
    name="user_role"
)

CaseStatus = Enum(
    "draft", "pending_review", "reviewed", "closed",
    name="case_status"
)

AnalysisStatus = Enum(
    "pending", "running", "complete", "failed",
    name="analysis_status"
)

ImageSource = Enum("camera", "gallery", name="image_source")

QualityLabel = Enum("Good", "Acceptable", "Poor", name="quality_label")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Users ─────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(UserRole, nullable=False, default="patient")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # Relationships
    cases: Mapped[list["Case"]] = relationship("Case", back_populates="owner", foreign_keys="Case.owner_id")
    created_patients: Mapped[list["Patient"]] = relationship("Patient", back_populates="creator")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")


# ── Patients ──────────────────────────────────────────────────────────────────
class Patient(Base):
    """De-identified patient record. Never store full name, DOB, contact."""
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    medical_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="created_patients")
    cases: Mapped[list["Case"]] = relationship("Case", back_populates="patient")


# ── Cases ─────────────────────────────────────────────────────────────────────
class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(CaseStatus, nullable=False, default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="cases")
    owner: Mapped["User"] = relationship("User", back_populates="cases", foreign_keys=[owner_id])
    images: Mapped[list["Image"]] = relationship("Image", back_populates="case_")
    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="case_")


# ── Images ────────────────────────────────────────────────────────────────────
class Image(Base):
    __tablename__ = "images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str] = mapped_column(String(50), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    capture_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(ImageSource, nullable=False, default="gallery")
    quality_label: Mapped[str | None] = mapped_column(QualityLabel, nullable=True)
    quality_metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # Relationships
    case_: Mapped["Case"] = relationship("Case", back_populates="images")
    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="image")


# ── Analyses ──────────────────────────────────────────────────────────────────
class Analysis(Base):
    """Stores AI analysis results. prediction_json is empty until Milestone 2."""
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("images.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(AnalysisStatus, nullable=False, default="pending")
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prediction_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # Relationships
    case_: Mapped["Case"] = relationship("Case", back_populates="analyses")
    image: Mapped["Image"] = relationship("Image", back_populates="analyses")


# ── Audit Logs ────────────────────────────────────────────────────────────────
class AuditLog(Base):
    """Append-only audit trail. Never deleted."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )

    # Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="audit_logs")
