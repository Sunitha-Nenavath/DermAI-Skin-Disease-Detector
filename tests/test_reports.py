"""
tests/test_reports.py
Unit and integration tests for ReportLab PDF generation, JSON/CSV exports,
and user notifications with regulatory disclaimer validation.
"""

import io
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def get_clinician_token():
    res = client.post("/api/auth/login", json={
        "email": "clinician_report_test@dermai.local",
        "password": "ClinicianDoctor123!"
    })
    if res.status_code == 200:
        return res.json()["access_token"]
    
    reg = client.post("/api/auth/register", json={
        "email": "clinician_report_test@dermai.local",
        "password": "ClinicianDoctor123!",
        "full_name": "Dr. Sarah Chen, MD",
        "role": "clinician"
    })
    assert reg.status_code == 201
    return reg.json()["access_token"]


def create_test_case_with_analysis(token):
    # 1. Create case
    case_res = client.post(
        "/api/cases",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Suspected Nodular Basal Cell Carcinoma",
            "body_location": "face",
            "patient_age": 62,
            "patient_gender": "male",
            "medical_history": "History of sun exposure; fair skin type.",
            "clinical_notes": "Lesion present for 6 months on left cheek."
        }
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # 2. Upload valid image (300x300, textured to pass sharpness quality gate)
    import cv2
    import numpy as np
    good_img = np.full((300, 300, 3), 160, dtype=np.uint8)
    cv2.circle(good_img, (150, 150), 40, (40, 40, 50), -1)
    good_img[::4, ::4] = 220
    _, good_bytes = cv2.imencode(".jpg", good_img)

    up_res = client.post(
        f"/api/cases/{case_id}/images",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("good_lesion.jpg", io.BytesIO(good_bytes.tobytes()), "image/jpeg")}
    )
    assert up_res.status_code in [200, 201]

    # 3. Analyze case
    an_res = client.post(
        f"/api/cases/{case_id}/analyze",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert an_res.status_code == 200

    return case_id


def test_pdf_report_generation():
    token = get_clinician_token()
    case_id = create_test_case_with_analysis(token)

    res = client.get(
        f"/api/cases/{case_id}/report.pdf",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert len(res.content) > 1000  # Non-trivial PDF size

    # Verify PDF magic bytes
    assert res.content[:4] == b"%PDF"


def test_json_report_export():
    token = get_clinician_token()
    case_id = create_test_case_with_analysis(token)

    res = client.get(
        f"/api/cases/{case_id}/report.json",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == case_id
    assert data["disclaimer"] == "AI-assisted analysis, not a standalone medical diagnosis."
    assert "patient_profile" in data
    assert "ai_prediction" in data
    assert data["ai_prediction"]["disclaimer"] == "AI-assisted analysis, not a standalone medical diagnosis."


def test_csv_report_export():
    token = get_clinician_token()
    case_id = create_test_case_with_analysis(token)

    res = client.get(
        f"/api/cases/{case_id}/report.csv",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    content_str = res.content.decode("utf-8")
    assert "AI-assisted analysis, not a standalone medical diagnosis." in content_str
    assert "Case Code" in content_str


def test_notification_workflow():
    token = get_clinician_token()
    create_test_case_with_analysis(token)

    # 1. List notifications (should include analysis notification from earlier test)
    list_res = client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert list_res.status_code == 200
    notifs = list_res.json()
    assert isinstance(notifs, list)
    assert len(notifs) > 0

    target_id = notifs[0]["id"]
    assert "disclaimer" in notifs[0]
    assert notifs[0]["disclaimer"] == "AI-assisted analysis, not a standalone medical diagnosis."

    # 2. Mark specific notification as read
    read_res = client.post(
        f"/api/notifications/{target_id}/read",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 3. Mark all read
    all_read_res = client.post(
        "/api/notifications/read-all",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert all_read_res.status_code == 200
    assert "marked_read_count" in all_read_res.json()
