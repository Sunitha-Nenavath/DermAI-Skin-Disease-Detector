"""
tests/test_backend.py
Comprehensive unit and integration test suite for DermAI Milestone 1.
Covers: Health, Auth & RBAC, Case Isolation, Upload Validation, Quality Assessment, Preprocessing.
"""

import io
import os
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
from backend.config import settings
from backend.models import User, UserRole, Case, Patient
from backend.auth import create_access_token, get_password_hash
from ml.preprocessing.pipeline import assess_quality, preprocess, remove_hair_dullrazor, enhance_contrast_clahe


# Use in-memory SQLite with StaticPool so all test connections share the same memory database
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# --- Test 1: System Health Endpoint ---
def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "AI-assisted analysis" in data["medical_disclaimer"]
    assert res.headers.get("X-DermAI-Notice") is not None


# --- Test 2: User Registration & Authentication ---
def test_user_registration_and_login():
    # Register new clinician
    reg_payload = {
        "email": "dr_test@dermai.local",
        "password": "Password123!",
        "full_name": "Dr. Test Clinician",
        "role": "clinician"
    }
    reg_res = client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["role"] == "clinician"
    token = reg_data["access_token"]

    # Profile lookup
    me_res = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "dr_test@dermai.local"

    # Login with same credentials
    login_res = client.post("/auth/login", json={"email": "dr_test@dermai.local", "password": "Password123!"})
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Reject invalid password
    bad_login = client.post("/auth/login", json={"email": "dr_test@dermai.local", "password": "WrongPassword!"})
    assert bad_login.status_code == 401


# --- Test 3: Role-Based Case Isolation ---
def test_case_role_isolation():
    # Create two patients and one clinician
    p1_res = client.post("/auth/register", json={
        "email": "patient_one@dermai.local",
        "password": "Password123!",
        "full_name": "Patient Alpha",
        "role": "patient"
    })
    p1_token = p1_res.json()["access_token"]

    p2_res = client.post("/auth/register", json={
        "email": "patient_two@dermai.local",
        "password": "Password123!",
        "full_name": "Patient Beta",
        "role": "patient"
    })
    p2_token = p2_res.json()["access_token"]

    clin_res = client.post("/auth/register", json={
        "email": "clinician_review@dermai.local",
        "password": "Password123!",
        "full_name": "Dr. Reviewer",
        "role": "clinician"
    })
    clin_token = clin_res.json()["access_token"]

    # Patient 1 creates a case
    c1_res = client.post("/cases", json={
        "title": "Patient 1 Lesion on Forearm",
        "body_location": "upper extremity",
        "patient_age": 45,
        "patient_gender": "male"
    }, headers={"Authorization": f"Bearer {p1_token}"})
    assert c1_res.status_code == 201
    c1_id = c1_res.json()["id"]

    # Patient 1 sees their own case
    p1_cases = client.get("/cases", headers={"Authorization": f"Bearer {p1_token}"}).json()
    assert any(c["id"] == c1_id for c in p1_cases)

    # Patient 2 MUST NOT see Patient 1's case
    p2_cases = client.get("/cases", headers={"Authorization": f"Bearer {p2_token}"}).json()
    assert not any(c["id"] == c1_id for c in p2_cases)

    # Patient 2 attempting direct GET /cases/{c1_id} must receive 403 Forbidden
    direct_access = client.get(f"/cases/{c1_id}", headers={"Authorization": f"Bearer {p2_token}"})
    assert direct_access.status_code == 403

    # Clinician CAN see all cases across cohort
    clin_cases = client.get("/cases", headers={"Authorization": f"Bearer {clin_token}"}).json()
    assert any(c["id"] == c1_id for c in clin_cases)


# --- Test 4: Image Upload Validation and Quality Gate ---
def test_image_upload_and_quality_assessment():
    # Login clinician
    login_res = client.post("/auth/login", json={"email": "dr_test@dermai.local", "password": "Password123!"})
    token = login_res.json()["access_token"]

    # Create case
    case_res = client.post("/cases", json={
        "title": "Quality Test Case",
        "body_location": "back"
    }, headers={"Authorization": f"Bearer {token}"})
    case_id = case_res.json()["id"]

    # 1. Reject invalid file extension (.txt)
    txt_file = io.BytesIO(b"Not an image")
    bad_ext_res = client.post(
        f"/cases/{case_id}/images",
        files={"file": ("notes.txt", txt_file, "text/plain")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert bad_ext_res.status_code == 400
    assert "Unsupported file extension" in bad_ext_res.json()["detail"]

    # 2. Reject corrupted image bytes
    corrupt_bytes = io.BytesIO(b"\xFF\xD8\xFF\xE0corruptpayloadnotajpeg")
    corrupt_res = client.post(
        f"/cases/{case_id}/images",
        files={"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert corrupt_res.status_code == 400

    # 3. Create synthetic Good Quality Image (300x300, sharp, optimal luminance)
    good_img = np.full((300, 300, 3), 160, dtype=np.uint8)
    cv2.circle(good_img, (150, 150), 40, (40, 40, 50), -1)
    # Add high frequency pattern to ensure high laplacian variance
    good_img[::4, ::4] = 220
    _, good_bytes = cv2.imencode(".jpg", good_img)

    good_res = client.post(
        f"/cases/{case_id}/images",
        files={"file": ("good_capture.jpg", io.BytesIO(good_bytes.tobytes()), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert good_res.status_code == 200
    good_data = good_res.json()
    assert good_data["quality_label"] in ["Good", "Acceptable"]
    assert good_data["width"] == 300
    assert good_data["height"] == 300
    img_id = good_data["id"]

    # 4. Fetch raw image file
    file_res = client.get(f"/images/{img_id}/file")
    assert file_res.status_code == 200
    assert len(file_res.content) > 0

    # 5. Run preprocessing endpoint
    prep_res = client.post(f"/images/{img_id}/preprocess")
    assert prep_res.status_code == 200
    assert prep_res.headers["content-type"] == "image/png"
    assert "AI-assisted analysis" in prep_res.headers.get("X-DermAI-Notice", "")


# --- Test 5: Quality Gate Rejection on Blurry / Poor Image ---
def test_poor_quality_rejection():
    login_res = client.post("/auth/login", json={"email": "dr_test@dermai.local", "password": "Password123!"})
    token = login_res.json()["access_token"]

    case_res = client.post("/cases", json={
        "title": "Blur Test Case",
        "body_location": "trunk"
    }, headers={"Authorization": f"Bearer {token}"})
    case_id = case_res.json()["id"]

    # Severely blurred / completely flat image (laplacian variance ~ 0)
    flat_blurred_img = np.full((300, 300, 3), 120, dtype=np.uint8)
    _, flat_bytes = cv2.imencode(".jpg", flat_blurred_img)

    blur_res = client.post(
        f"/cases/{case_id}/images",
        files={"file": ("blurry.jpg", io.BytesIO(flat_bytes.tobytes()), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"}
    )
    # Must be rejected with 422 Unprocessable Entity instruct user to retake
    assert blur_res.status_code == 422
    err_body = blur_res.json()["detail"]
    assert "retake" in err_body["message"].lower() or "poor" in err_body["message"].lower()


# --- Test 6: ML Preprocessing Pipeline Unit Tests ---
def test_ml_preprocessing_pipeline_contract():
    # Create test input image (400x300 BGR)
    sample_bgr = np.full((300, 400, 3), 150, dtype=np.uint8)
    cv2.circle(sample_bgr, (200, 150), 50, (30, 30, 45), -1)
    # Add a thin dark hair across lesion
    cv2.line(sample_bgr, (150, 100), (250, 200), (20, 20, 20), 2)

    # Test DullRazor hair removal
    clean_hair = remove_hair_dullrazor(sample_bgr)
    assert clean_hair.shape == sample_bgr.shape

    # Test CLAHE contrast enhancement
    clahe_img = enhance_contrast_clahe(sample_bgr)
    assert clahe_img.shape == sample_bgr.shape

    # Full pipeline test
    result = preprocess(sample_bgr, target_size=(224, 224))
    assert "quality" in result
    assert result["display_image_rgb"].shape == (224, 224, 3)
    assert result["model_tensor"].shape == (1, 3, 224, 224)
    assert result["model_tensor"].dtype == np.float32
    assert len(result["display_png_bytes"]) > 0
