"""
backend/routers/images.py
Endpoints for accessing raw image files and executing the preprocessing pipeline.
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Image, Case, User, UserRole
from backend.schemas import ImageDetailResponse
from backend.auth import get_current_user
from backend.storage import storage
from ml.preprocessing.pipeline import preprocess

router = APIRouter(prefix="/images", tags=["Image Access & Preprocessing"])


@router.get("/{id}", response_model=ImageDetailResponse)
def get_image_details(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    img = db.query(Image).filter(Image.id == id).first()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image record not found.")

    case = db.query(Case).filter(Case.id == img.case_id).first()
    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        metrics = json.loads(img.quality_metrics_json)
    except Exception:
        metrics = {"quality_label": img.quality_label}

    return {
        "id": img.id,
        "case_id": img.case_id,
        "original_filename": img.original_filename,
        "content_type": img.content_type,
        "width": img.width,
        "height": img.height,
        "size_bytes": img.size_bytes,
        "source": img.source,
        "quality_label": img.quality_label,
        "quality_metrics": metrics,
        "created_at": img.created_at,
        "file_url": f"/api/images/{img.id}/file",
        "preprocess_url": f"/api/images/{img.id}/preprocess",
        "medical_disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
    }


@router.get("/{id}/file")
def get_image_file(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Returns the raw original uploaded image bytes.
    """
    img = db.query(Image).filter(Image.id == id).first()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    file_bytes = storage.get_image_bytes(img.storage_key)
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found in storage.")

    return Response(content=file_bytes, media_type=img.content_type)


@router.post("/{id}/preprocess")
def preprocess_case_image(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Runs the clinical preprocessing pipeline:
      - DullRazor hair removal
      - CLAHE contrast enhancement on L-channel
      - Center crop & resize to 224x224
    Returns the processed image as image/png.
    """
    img = db.query(Image).filter(Image.id == id).first()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    file_bytes = storage.get_image_bytes(img.storage_key)
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found in storage.")

    # Run ML preprocessing
    res = preprocess(
        image_input=file_bytes,
        target_size=(224, 224),
        apply_hair_removal=True,
        apply_clahe=True
    )

    png_bytes = res["display_png_bytes"]
    if not png_bytes:
        raise HTTPException(status_code=500, detail="Failed to encode preprocessed image.")

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "X-Quality-Label": res["quality"]["quality_label"],
            "X-DermAI-Notice": "AI-assisted analysis, not a standalone medical diagnosis."
        }
    )
