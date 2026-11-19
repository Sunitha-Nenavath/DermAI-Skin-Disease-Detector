"""
tests/test_analysis.py
Integration test for Phase 6: AI Inference Service, Otsu Lesion Segmentation,
Grad-CAM++ heatmap generation, and Model Registry.
"""

import io
import json
import pytest
import numpy as np
import cv2
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models import User, Case, ModelRegistry


client = TestClient(app)


def test_model_registry_list():
    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) >= 1
    m0 = models[0]
    assert m0["architecture"] == "efficientnet_b0"
    assert "AI-assisted analysis" in m0["medical_disclaimer"]


def test_case_analyze_integration():
    # 1. Register clinician
    reg_res = client.post("/auth/register", json={
        "email": "dr_neuro@dermai.local",
        "password": "Password123!",
        "full_name": "Dr. Neuro",
        "role": "clinician"
    })
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create case
    case_res = client.post("/cases", json={
        "title": "Suspected Forearm Lesion",
        "body_location": "upper extremity",
        "patient_age": 52,
        "patient_gender": "female"
    }, headers=headers)
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # 3. Create synthetic 300x300 lesion image
    img = np.full((300, 300, 3), 190, dtype=np.uint8)
    cv2.circle(img, (150, 150), 45, (60, 50, 40), -1) # lesion spot
    is_success, buffer = cv2.imencode(".jpg", img)
    assert is_success

    # Upload image
    upload_res = client.post(
        f"/cases/{case_id}/images",
        files={"file": ("lesion_test.jpg", io.BytesIO(buffer.tobytes()), "image/jpeg")},
        headers=headers
    )
    assert upload_res.status_code in [200, 201]
    image_id = upload_res.json()["id"]

    # 4. Trigger /analyze endpoint
    analyze_res = client.post(f"/cases/{case_id}/analyze", headers=headers)
    assert analyze_res.status_code == 200
    data = analyze_res.json()

    assert data["success"] is True
    assert data["trained_model_available"] is True
    assert "predicted_condition" in data
    assert isinstance(data["confidence"], float)
    assert len(data["top3"]) == 3
    assert data["risk_category"] in ["High Risk", "Moderate Risk", "Low Risk", "Requires Clinical Review"]
    assert data["mask_png_b64"].startswith("data:image/png;base64,")
    assert data["heatmap_png_b64"].startswith("data:image/png;base64,")
    assert "AI-assisted analysis, not a standalone medical diagnosis." in data["disclaimer"]

    # 5. Verify /analyses listing
    list_res = client.get(f"/cases/{case_id}/analyses", headers=headers)
    assert list_res.status_code == 200
    analyses = list_res.json()
    assert len(analyses) >= 1
    assert analyses[0]["predicted_condition"] == data["predicted_condition"]
