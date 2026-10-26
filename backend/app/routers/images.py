"""
DermAI Backend — Images Router (Steps 7 & 8)
POST /cases/{id}/images              — upload image (quality check → save)
GET  /cases/{id}/images              — list images for a case
GET  /images/{id}/file               — download original image
POST /images/{id}/preprocess         — preprocess and return result image
"""
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, log_audit
from app.models.models import Case, Image, User
from app.schemas.schemas import ImageResponse
from app.services.quality import assess_quality
from app.services.storage import load_image, save_image, validate_upload

router = APIRouter(tags=["Images"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.post(
    "/cases/{case_id}/images",
    response_model=ImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image for a case (quality gate applied)",
)
async def upload_image(
    case_id: uuid.UUID,
    file: Annotated[UploadFile, File(description="Skin lesion image (JPG/PNG, max 10 MB)")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    source: str = "gallery",
) -> ImageResponse:
    # ── Fetch case ────────────────────────────────────────────────────────────
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # Role check: patients can only upload to their own cases
    if current_user.role == "patient" and case.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to upload to this case.")

    # ── Read file bytes ───────────────────────────────────────────────────────
    image_bytes = await file.read()
    size_bytes = len(image_bytes)

    # ── Format / size validation ──────────────────────────────────────────────
    content_type = file.content_type or "application/octet-stream"
    original_filename = file.filename or "upload.jpg"

    try:
        validate_upload(original_filename, content_type, size_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # ── Quality assessment ────────────────────────────────────────────────────
    try:
        quality = assess_quality(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Image decode failed: {exc}")

    if quality.quality_label == "Poor":
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Image quality is too Poor to upload. Please retake the photo.",
                "quality_label": "Poor",
                "reasons": quality.reasons,
                "metrics": quality.to_dict(),
            },
        )

    # ── Save to storage ───────────────────────────────────────────────────────
    storage_key = save_image(image_bytes, case_id, original_filename)

    # ── Persist to database ───────────────────────────────────────────────────
    image_record = Image(
        case_id=case_id,
        storage_key=storage_key,
        original_filename=original_filename,
        content_type=content_type,
        width=quality.width,
        height=quality.height,
        size_bytes=size_bytes,
        source=source if source in ("camera", "gallery") else "gallery",
        quality_label=quality.quality_label,
        quality_metrics_json=quality.to_dict(),
    )
    db.add(image_record)
    await db.flush()

    await log_audit(
        db, "image_upload",
        user_id=current_user.id,
        entity="image",
        entity_id=image_record.id,
        request=request,
    )

    # Advance case to pending_review if it was a draft
    if case.status == "draft":
        case.status = "pending_review"
        db.add(case)

    return ImageResponse.model_validate(image_record)


@router.get(
    "/cases/{case_id}/images",
    response_model=list[ImageResponse],
    summary="List images for a case",
)
async def list_images(
    case_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ImageResponse]:
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    if current_user.role == "patient" and case.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised.")

    images_result = await db.execute(
        select(Image).where(Image.case_id == case_id)
    )
    images = images_result.scalars().all()
    return [ImageResponse.model_validate(img) for img in images]


@router.get(
    "/images/{image_id}/file",
    summary="Download original image file",
    response_class=Response,
)
async def get_image_file(
    image_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(select(Image).where(Image.id == image_id))
    image_record = result.scalar_one_or_none()
    if not image_record:
        raise HTTPException(status_code=404, detail="Image not found.")

    try:
        image_bytes = load_image(image_record.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image file not found in storage.")

    return Response(
        content=image_bytes,
        media_type=image_record.content_type or "image/jpeg",
        headers={"Content-Disposition": f'inline; filename="{image_record.original_filename}"'},
    )


@router.post(
    "/images/{image_id}/preprocess",
    summary="Preprocess image and return result (PNG)",
    response_class=Response,
)
async def preprocess_image_endpoint(
    image_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """
    Runs the preprocessing pipeline on a stored image.
    Returns the preprocessed image as PNG for before/after display.
    Available to: clinician, ml_engineer, admin.
    """
    if current_user.role not in {"clinician", "ml_engineer", "admin"}:
        raise HTTPException(status_code=403, detail="Not authorised to access preprocessing.")

    result = await db.execute(select(Image).where(Image.id == image_id))
    image_record = result.scalar_one_or_none()
    if not image_record:
        raise HTTPException(status_code=404, detail="Image not found.")

    try:
        image_bytes = load_image(image_record.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image file not found in storage.")

    # Import preprocessing pipeline
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "ml"))
    from preprocessing.pipeline import preprocess

    tensor, pil_preprocessed = preprocess(image_bytes, return_pil=True)
    
    buf = io.BytesIO()
    pil_preprocessed.save(buf, format="PNG")
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="image/png",
        headers={"Content-Disposition": "inline; filename=preprocessed.png"},
    )
