"""
DermAI Backend — Cases Router
POST /cases                — create a case
GET  /cases                — list cases (filtered by role)
GET  /cases/{id}           — get case detail
PUT  /cases/{id}           — update case status
POST /cases/{id}/notes     — add a clinical note
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, log_audit
from app.models.models import Case, Patient, User
from app.schemas.schemas import (
    CaseCreateRequest,
    CaseListResponse,
    CaseNoteRequest,
    CaseResponse,
)

router = APIRouter(prefix="/cases", tags=["Cases"])

CLINICIAN_ROLES = {"clinician", "admin", "researcher"}


def _generate_case_code() -> str:
    return f"CASE-{uuid.uuid4().hex[:8].upper()}"


@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new clinical case",
)
async def create_case(
    body: CaseCreateRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    # Patients can only create cases for themselves (via their patient record)
    if current_user.role == "researcher":
        raise HTTPException(status_code=403, detail="Researchers cannot create cases.")

    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == body.patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found.")

    case = Case(
        case_code=_generate_case_code(),
        patient_id=body.patient_id,
        owner_id=current_user.id,
        title=body.title,
        body_location=body.body_location,
        status="draft",
    )
    db.add(case)
    await db.flush()

    await log_audit(
        db, "case_create",
        user_id=current_user.id,
        entity="case",
        entity_id=case.id,
        request=request,
    )

    return CaseResponse.model_validate(case)


@router.get(
    "",
    response_model=CaseListResponse,
    summary="List cases (filtered by role)",
)
async def list_cases(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> CaseListResponse:
    query = select(Case)

    # Role-based filtering
    if current_user.role == "patient":
        # Patients see only cases where they are the owner
        query = query.where(Case.owner_id == current_user.id)
    elif current_user.role == "ml_engineer":
        raise HTTPException(status_code=403, detail="ML Engineers do not have case access.")

    if status_filter:
        query = query.where(Case.status == status_filter)

    # Count total
    count_result = await db.execute(query)
    all_cases = count_result.scalars().all()
    total = len(all_cases)

    # Paginate
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    cases = result.scalars().all()

    return CaseListResponse(
        total=total,
        items=[CaseResponse.model_validate(c) for c in cases],
    )


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Get case detail",
)
async def get_case(
    case_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # Patients can only see their own cases
    if current_user.role == "patient" and case.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to view this case.")

    return CaseResponse.model_validate(case)


@router.put(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Update case status",
)
async def update_case(
    case_id: uuid.UUID,
    body: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CaseResponse:
    if current_user.role not in {"clinician", "admin"}:
        raise HTTPException(status_code=403, detail="Only clinicians and admins can update cases.")

    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    valid_statuses = {"draft", "pending_review", "reviewed", "closed"}
    new_status = body.get("status")
    if new_status and new_status in valid_statuses:
        case.status = new_status

    if "title" in body:
        case.title = body["title"]
    if "body_location" in body:
        case.body_location = body["body_location"]

    db.add(case)
    return CaseResponse.model_validate(case)


@router.post(
    "/{case_id}/notes",
    response_model=CaseResponse,
    summary="Add a clinical note to a case",
)
async def add_note(
    case_id: uuid.UUID,
    body: CaseNoteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
) -> CaseResponse:
    if current_user.role not in {"clinician", "admin"}:
        raise HTTPException(status_code=403, detail="Only clinicians can add notes.")

    result = await db.execute(
        select(Case).where(Case.id == case_id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # Notes are added to the patient record via the patient_id
    patient_result = await db.execute(
        select(Patient).where(Patient.id == case.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if patient:
        existing = patient.clinical_notes or ""
        patient.clinical_notes = f"{existing}\n[{current_user.full_name}]: {body.note}".strip()
        db.add(patient)

    await log_audit(db, "note_added", user_id=current_user.id, entity="case", entity_id=case_id, request=request)

    return CaseResponse.model_validate(case)
