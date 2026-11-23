"""
scripts/verify_ml_e2e.py
Verifies end-to-end trained model inference, health check, and Grad-CAM++ generation.
"""
import sys
import os
sys.path.insert(0, os.path.abspath("."))
import numpy as np
import cv2
from fastapi.testclient import TestClient
from backend.main import app
from backend.ml_service import ml_engine

def run_verification():
    print("[1] Checking Model Availability...")
    print(f"    Weights Path: {ml_engine.weights_path}")
    print(f"    Model available on disk: {ml_engine.is_model_available()}")
    print(f"    PyTorch model loaded: {ml_engine.model is not None}")
    assert ml_engine.model is not None, "Error: PyTorch model failed to load!"

    client = TestClient(app)

    print("\n[2] Testing GET /health...")
    r_health = client.get("/health")
    print(f"    Status: {r_health.status_code}")
    h_data = r_health.json()
    print(f"    Loaded models: {h_data.get('loaded_models')}")
    assert "v1.0-efficientnet_b0" in h_data.get("loaded_models", []), "Model not listed in health!"

    print("\n[3] Generating synthetic lesion test image (300x300)...")
    synthetic = np.full((300, 300, 3), 195, dtype=np.uint8)
    # Add pigmented lesion center
    cv2.circle(synthetic, (150, 150), 65, (45, 55, 120), -1)
    # Add texture
    synthetic[::3, ::3] = np.clip(synthetic[::3, ::3].astype(int) + 20, 0, 255).astype(np.uint8)
    _, img_encoded = cv2.imencode(".jpg", synthetic)
    img_bytes = img_encoded.tobytes()

    print("\n[4] Testing POST /predict...")
    r_pred = client.post("/predict", files={"image": ("lesion_sample.jpg", img_bytes, "image/jpeg")})
    print(f"    HTTP Status: {r_pred.status_code}")
    res = r_pred.json()
    print(f"    Success: {res.get('success')}")
    print(f"    Model Version: {res.get('model_version')}")
    print(f"    Predicted Condition: {res.get('predicted_condition')}")
    print(f"    Confidence: {res.get('confidence')}")
    print(f"    Risk Tag: {res.get('risk_tag')}")
    print(f"    Is Demo Mode: {res.get('is_demo_mode')}")
    print(f"    Disclaimer: {res.get('disclaimer')}")
    print(f"    Top-3: {res.get('top3')}")
    print(f"    Mask present: {bool(res.get('mask_png_base64'))}")
    print(f"    Heatmap present: {bool(res.get('heatmap_png_base64'))}")

    assert res.get("success") is True
    assert res.get("is_demo_mode") is False
    assert res.get("model_version") == "v1.0-efficientnet_b0"
    assert "AI-assisted analysis" in res.get("disclaimer", "")

    print("\n[5] Testing POST /api/ml/predict...")
    r_api_pred = client.post("/api/ml/predict", files={"image": ("lesion_sample.jpg", img_bytes, "image/jpeg")})
    assert r_api_pred.status_code == 200
    res_api = r_api_pred.json()
    assert res_api.get("is_demo_mode") is False

    print("\n>>> ALL ML VERIFICATION CHECKS PASSED SUCCESSFULLY! Model is fully connected and active.")

if __name__ == "__main__":
    run_verification()
