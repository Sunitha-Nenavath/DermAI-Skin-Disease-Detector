"""
backend/routers/models.py
Model registry and versioning management endpoints.
"""

from datetime import datetime
from typing import List, Optional
import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ModelRegistry, User, UserRole
from backend.schemas import ModelRegistryResponse
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/models", tags=["Model Management"])


@router.get("", response_model=List[ModelRegistryResponse])
def list_models(db: Session = Depends(get_db)):
    # Auto-seed baseline efficientnet_b0 if table is empty
    models = db.query(ModelRegistry).all()
    if not models:
        metrics_file = Path("models/metrics.json")
        metrics_str = None
        acc = None
        bal_acc = None
        f1 = None
        if metrics_file.exists():
            with open(metrics_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                metrics_str = json.dumps(data)
                m = data.get("metrics", {})
                acc = m.get("accuracy")
                bal_acc = m.get("balanced_accuracy")
                f1 = m.get("macro_f1")

        weights_exist = Path("models/efficientnet_b0_best.pt").exists()
        baseline = ModelRegistry(
            name="EfficientNet-B0 Baseline",
            version="v1.0-efficientnet_b0",
            architecture="efficientnet_b0",
            weights_path="models/efficientnet_b0_best.pt" if weights_exist else None,
            is_active=weights_exist,
            accuracy=acc,
            balanced_accuracy=bal_acc,
            macro_f1=f1,
            metrics_json=metrics_str,
            created_at=datetime.utcnow()
        )
        db.add(baseline)
        db.commit()
        models = [baseline]

    return models


@router.get("/active", response_model=ModelRegistryResponse)
def get_active_model(db: Session = Depends(get_db)):
    active = db.query(ModelRegistry).filter(ModelRegistry.is_active == True).first()
    if not active:
        # Check first available
        active = db.query(ModelRegistry).first()
        if not active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No trained model available.")
    return active


@router.post("/{id}/activate", response_model=ModelRegistryResponse)
def activate_model(
    id: int,
    current_user: User = Depends(require_role("admin", "ml_engineer")),
    db: Session = Depends(get_db)
):
    target = db.query(ModelRegistry).filter(ModelRegistry.id == id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model record not found.")

    if not target.weights_path or not os.path.exists(target.weights_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate model: weights file not found on disk."
        )

    # Deactivate all others
    db.query(ModelRegistry).update({ModelRegistry.is_active: False})
    target.is_active = True
    db.commit()
    db.refresh(target)
    return target
