"""
backend/routers/cases.py
Case management, clinical notes, and image intake with computer vision quality screening.
"""

from datetime import datetime, date
import json
from typing import List, Optional
import uuid

from fastapi import (
    APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form, Query
)
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db
from backend.models import User, Case, Patient, Image, Analysis, Notification, UserRole, CaseStatus, QualityLabel
from backend.schemas import (
    CaseCreate, CaseUpdate, CaseResponse, NoteCreate, ImageUploadResponse, ImageDetailResponse
)
from backend.auth import get_current_user, log_audit_event, get_client_ip
from backend.quality import validate_and_assess_image
from backend.storage import storage
from backend.ml_service import ml_engine

router = APIRouter(prefix="/cases", tags=["Case Management"])


def generate_case_code() -> str:
    year = datetime.utcnow().year
    suffix = uuid.uuid4().hex[:6].upper()
    return f"CASE-{year}-{suffix}"


def generate_patient_code() -> str:
    year = datetime.utcnow().year
    suffix = uuid.uuid4().hex[:5].upper()
    return f"PAT-{year}-{suffix}"


def format_case_response(case: Case) -> dict:
    patient_data = None
    if case.patient:
        patient_data = {
            "id": case.patient.id,
            "case_code": case.patient.case_code,
            "age": case.patient.age,
            "gender": case.patient.gender,
            "medical_history": case.patient.medical_history,
            "allergies": case.patient.allergies,
            "clinical_notes": case.patient.clinical_notes,
            "created_at": case.patient.created_at,
            "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
        }

    images_data = []
    for img in case.images:
        metrics_dict = {}
        try:
            metrics_dict = json.loads(img.quality_metrics_json)
        except Exception:
            metrics_dict = {"quality_label": img.quality_label}

        images_data.append({
            "id": img.id,
            "case_id": img.case_id,
            "original_filename": img.original_filename,
            "content_type": img.content_type,
            "width": img.width,
            "height": img.height,
            "size_bytes": img.size_bytes,
            "source": img.source,
            "quality_label": img.quality_label,
            "quality_metrics": metrics_dict,
            "created_at": img.created_at,
            "file_url": f"/api/images/{img.id}/file",
            "preprocess_url": f"/api/images/{img.id}/preprocess",
            "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
        })

    return {
        "id": case.id,
        "case_code": case.case_code,
        "owner_id": case.owner_id,
        "owner_name": case.owner.full_name if case.owner else "Unknown",
        "title": case.title,
        "body_location": case.body_location,
        "status": case.status,
        "created_at": case.created_at,
        "patient": patient_data,
        "images": images_data,
        "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
    }


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    case_in: CaseCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new case along with a strictly de-identified patient record.
    """
    # 1. Create de-identified patient record
    patient = Patient(
        case_code=generate_patient_code(),
        age=case_in.patient_age,
        gender=case_in.patient_gender,
        medical_history=case_in.medical_history,
        clinical_notes=case_in.clinical_notes,
        created_by=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(patient)
    db.flush()

    # 2. Create case
    case = Case(
        case_code=generate_case_code(),
        patient_id=patient.id,
        owner_id=current_user.id,
        title=case_in.title,
        body_location=case_in.body_location.lower(),
        status=CaseStatus.PENDING_REVIEW.value,
        created_at=datetime.utcnow()
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # 3. Log audit event
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="CASE_CREATE",
        entity="case",
        entity_id=case.case_code,
        user_id=current_user.id,
        ip=ip
    )

    return format_case_response(case)


@router.get("", response_model=List[CaseResponse])
def list_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    body_location: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists cases with role-based filtering:
    - Patients only see their own cases.
    - Clinicians, Administrators, and Researchers see all cohort cases.
    """
    query = db.query(Case)

    if current_user.role == UserRole.PATIENT.value:
        query = query.filter(Case.owner_id == current_user.id)

    if status_filter:
        query = query.filter(Case.status == status_filter)

    if body_location:
        query = query.filter(Case.body_location == body_location.lower())

    if start_date:
        query = query.filter(Case.created_at >= datetime.combine(start_date, datetime.min.time()))

    if end_date:
        query = query.filter(Case.created_at <= datetime.combine(end_date, datetime.max.time()))

    cases = query.order_by(desc(Case.created_at)).all()
    return [format_case_response(c) for c in cases]


@router.get("/{id}", response_model=CaseResponse)
def get_case(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    # Isolation check: patients can only access their own cases
    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this case.")

    return format_case_response(case)


@router.put("/{id}", response_model=CaseResponse)
def update_case(
    id: int,
    case_update: CaseUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if case_update.title is not None:
        case.title = case_update.title
    if case_update.body_location is not None:
        case.body_location = case_update.body_location.lower()
    if case_update.status is not None:
        # Only clinicians and admins can update case workflow status
        if current_user.role in [UserRole.CLINICIAN.value, UserRole.ADMIN.value]:
            case.status = case_update.status

    db.commit()
    db.refresh(case)

    ip = get_client_ip(request)
    log_audit_event(db=db, action="CASE_UPDATE", entity="case", entity_id=case.case_code, user_id=current_user.id, ip=ip)

    return format_case_response(case)


@router.post("/{id}/notes", response_model=CaseResponse)
def add_case_notes(
    id: int,
    note_in: NoteCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Appends clinical notes to the associated de-identified patient record.
    """
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role not in [UserRole.CLINICIAN.value, UserRole.ADMIN.value, UserRole.RESEARCHER.value]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clinical staff can append clinical notes.")

    timestamp_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    author_tag = f"[{timestamp_str} - {current_user.full_name} ({current_user.role})]: "
    new_note = author_tag + note_in.notes

    if case.patient:
        if case.patient.clinical_notes:
            case.patient.clinical_notes += f"\n\n{new_note}"
        else:
            case.patient.clinical_notes = new_note
    else:
        patient = Patient(
            case_code=generate_patient_code(),
            clinical_notes=new_note,
            created_by=current_user.id
        )
        db.add(patient)
        db.flush()
        case.patient_id = patient.id

    db.commit()
    db.refresh(case)

    ip = get_client_ip(request)
    log_audit_event(db=db, action="NOTE_ADD", entity="case", entity_id=case.case_code, user_id=current_user.id, ip=ip)

    return format_case_response(case)


@router.post("/{id}/images", response_model=ImageUploadResponse)
async def upload_case_image(
    id: int,
    request: Request,
    file: UploadFile = File(...),
    source: str = Form("camera"),
    force: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Synchronous image upload intake with computer vision quality evaluation.
    Rejects Poor quality images with clear instructions unless force=true.
    """
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Read uploaded bytes
    file_bytes = await file.read()
    filename = file.filename or "capture.jpg"
    content_type = file.content_type or "image/jpeg"

    # Validate and assess quality
    is_valid, err_msg, metrics, width, height = validate_and_assess_image(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        min_resolution=224
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image validation rejected: {err_msg}"
        )

    quality_label = metrics.get("quality_label", "Acceptable")
    reasons = metrics.get("reasons", [])

    # Reject poor quality images unless explicitly forced
    if quality_label == QualityLabel.POOR.value and not force:
        reason_text = " · ".join(reasons)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Image quality is POOR. Please retake photo before continuing.",
                "reasons": reasons,
                "rejection_guidance": "Hold mobile phone steady to avoid motion blur. Ensure the lesion is well-lit and centered without harsh shadows or flash reflections.",
                "quality_metrics": metrics
            }
        )

    # Save to storage (local filesystem or MinIO)
    storage_key = storage.save_image(case_id=case.id, original_filename=filename, file_bytes=file_bytes)

    # Persist Image record
    image_record = Image(
        case_id=case.id,
        storage_key=storage_key,
        original_filename=filename,
        content_type=content_type,
        width=width,
        height=height,
        size_bytes=len(file_bytes),
        source=source if source in ["camera", "gallery"] else "camera",
        quality_label=quality_label,
        quality_metrics_json=json.dumps(metrics),
        created_at=datetime.utcnow()
    )
    db.add(image_record)

    # Update case status if first image
    if quality_label in [QualityLabel.GOOD.value, QualityLabel.ACCEPTABLE.value]:
        case.status = CaseStatus.QUALITY_PASSED.value
    else:
        case.status = CaseStatus.QUALITY_REJECTED.value

    db.commit()
    db.refresh(image_record)

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="IMAGE_UPLOAD",
        entity="image",
        entity_id=str(image_record.id),
        user_id=current_user.id,
        ip=ip
    )

    return {
        "id": image_record.id,
        "case_id": image_record.case_id,
        "original_filename": image_record.original_filename,
        "content_type": image_record.content_type,
        "width": image_record.width,
        "height": image_record.height,
        "size_bytes": image_record.size_bytes,
        "source": image_record.source,
        "quality_label": image_record.quality_label,
        "quality_metrics": metrics,
        "created_at": image_record.created_at,
        "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
    }


@router.get("/{id}/images", response_model=List[ImageDetailResponse])
def get_case_images(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    results = []
    for img in case.images:
        try:
            m = json.loads(img.quality_metrics_json)
        except Exception:
            m = {}
        results.append({
            "id": img.id,
            "case_id": img.case_id,
            "original_filename": img.original_filename,
            "content_type": img.content_type,
            "width": img.width,
            "height": img.height,
            "size_bytes": img.size_bytes,
            "source": img.source,
            "quality_label": img.quality_label,
            "quality_metrics": m,
            "created_at": img.created_at,
            "file_url": f"/api/images/{img.id}/file",
            "preprocess_url": f"/api/images/{img.id}/preprocess",
            "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
        })
    return results


@router.post("/{id}/analyze")
def analyze_case(
    id: int,
    image_id: Optional[int] = None,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes AI screening analysis:
    - Preprocessing (DullRazor + CLAHE + center crop)
    - Otsu lesion detection
    - PyTorch classification (EfficientNet-B0) with Top-3 predictions
    - Grad-CAM++ explainability heatmap
    - Calibrated risk assessment & mandatory medical disclaimer
    """
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Find target image
    if image_id:
        target_image = db.query(Image).filter(Image.id == image_id, Image.case_id == id).first()
    else:
        target_image = db.query(Image).filter(Image.case_id == id).order_by(desc(Image.id)).first()

    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No uploaded image found for this case. Please upload a skin photo before requesting analysis."
        )

    # Image quality check
    if target_image.quality_label == QualityLabel.POOR.value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot analyze an image labeled as Poor quality. Please recapture the lesion with improved focus and lighting."
        )

    # Check if a trained model is available on disk
    if not ml_engine.is_model_available():
        return {
            "success": False,
            "trained_model_available": False,
            "message": "No trained model available",
            "disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
        }

    # Load image bytes from storage
    image_bytes = storage.read(target_image.storage_key)
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve stored image bytes.")

    # Run analysis
    try:
        analysis_result = ml_engine.analyze_image_bytes(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {str(e)}")

    if not analysis_result.get("success"):
        return analysis_result

    # Save Analysis record
    analysis_record = Analysis(
        case_id=case.id,
        image_id=target_image.id,
        status="completed",
        model_version=analysis_result.get("model_version", "v1.0-efficientnet_b0"),
        predicted_condition=analysis_result.get("predicted_condition"),
        confidence=analysis_result.get("confidence"),
        risk_category=analysis_result.get("risk_category"),
        prediction_json=json.dumps(analysis_result),
        disclaimer="AI-assisted analysis, not a standalone medical diagnosis."
    )
    db.add(analysis_record)

    # Update case status
    case.status = CaseStatus.ANALYSIS_COMPLETED.value

    # Create user notification
    notif = Notification(
        user_id=current_user.id,
        case_id=case.id,
        title=f"AI Screening Complete: {analysis_result['predicted_condition']}",
        message=f"Case {case.case_code} was analyzed. Risk Tag: {analysis_result['risk_category']}. AI-assisted analysis, not a standalone medical diagnosis.",
        level="High" if "High" in analysis_result['risk_category'] else "Medium",
        is_read=False,
        disclaimer="AI-assisted analysis, not a standalone medical diagnosis."
    )
    db.add(notif)
    db.commit()
    db.refresh(analysis_record)

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="ANALYSIS",
        entity="case",
        entity_id=str(case.id),
        user_id=current_user.id,
        ip=ip
    )

    return {
        "id": analysis_record.id,
        "case_id": case.id,
        "image_id": target_image.id,
        "created_at": analysis_record.created_at,
        **analysis_result
    }


@router.get("/{id}/analyses")
def get_case_analyses(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    analyses = db.query(Analysis).filter(Analysis.case_id == id).order_by(desc(Analysis.id)).all()
    results = []
    for a in analyses:
        payload = {}
        if a.prediction_json:
            try:
                payload = json.loads(a.prediction_json)
            except Exception:
                pass
        results.append({
            "id": a.id,
            "case_id": a.case_id,
            "image_id": a.image_id,
            "status": a.status,
            "model_version": a.model_version,
            "predicted_condition": a.predicted_condition,
            "confidence": a.confidence,
            "risk_category": a.risk_category,
            "created_at": a.created_at,
            "disclaimer": a.disclaimer,
            "details": payload
        })
    return results
