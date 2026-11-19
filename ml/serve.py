"""
ml/serve.py
FastAPI ML Inference Microservice complying with the DermAI ML Service Contract.

Endpoints:
  GET  /health   -> Service readiness & loaded model checkpoints
  POST /predict  -> Multipart field 'image', header 'X-Model-Version'
                    Returns JSON: { model_version, top3, confidence, risk_tag,
                                    mask_png_base64, heatmap_png_base64, latency_ms }
"""

import base64
import io
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import timm
import torch
import torch.nn as nn
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from ml.preprocessing.pipeline import preprocess

CLASSES: List[str] = ["mel", "nv", "bcc", "akiec", "bkl", "df", "vasc"]

DEFAULT_RISK_MAP: Dict[str, str] = {
    "mel": "High",
    "bcc": "Moderate",
    "akiec": "Moderate",
    "nv": "Low",
    "bkl": "Low",
    "df": "Low",
    "vasc": "Low",
}

WEIGHTS_DIR = Path(os.getenv("DERMAI_WEIGHTS_DIR", "ml/weights"))
CONFIDENCE_THRESHOLD = float(os.getenv("DERMAI_CONFIDENCE_THRESHOLD", "0.5"))

VERSION_TO_FILE = {
    "v1.0 ResNet50": "resnet50_best.pt",
    "v1.1 EfficientNet": "efficientnet_b4_best.pt",
    "v2.0 DenseNet": "densenet121_best.pt",
    "v2.1 Vision Transformer": "vit_b16_best.pt",
}

app = FastAPI(
    title="DermAI PyTorch ML Inference Service",
    version="1.0.0",
    description="Dedicated PyTorch + Grad-CAM skin lesion screening service for DermAI.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_CACHE: Dict[str, Dict[str, Any]] = {}


def load_checkpoints() -> None:
    if not WEIGHTS_DIR.exists():
        return
    for version_name, filename in VERSION_TO_FILE.items():
        ckpt_file = WEIGHTS_DIR / filename
        if not ckpt_file.exists():
            continue
        ckpt = torch.load(ckpt_file, map_location=DEVICE)
        timm_name = ckpt["timm_name"]
        model = timm.create_model(timm_name, pretrained=False, num_classes=len(CLASSES))
        model.load_state_dict(ckpt["state_dict"])
        model.to(DEVICE)
        model.eval()
        MODEL_CACHE[version_name] = {"model": model, "arch": ckpt["arch"]}


@app.on_event("startup")
def startup_event() -> None:
    load_checkpoints()


def encode_png_base64(image_arr: np.ndarray) -> str:
    pil_img = Image.fromarray(image_arr)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def compute_classical_mask(rgb_224: np.ndarray) -> str:
    hsv = cv2.cvtColor(rgb_224, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1]
    inv_v = 255 - hsv[:, :, 2]
    score = cv2.addWeighted(sat, 0.55, inv_v, 0.45, 0)
    _, thresh = cv2.threshold(score, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(thresh, connectivity=8)
    mask = np.zeros_like(thresh)
    if num_labels > 1:
        largest_idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        mask[labels == largest_idx] = 255
    return encode_png_base64(mask)


def find_last_conv_layer(model: nn.Module) -> Optional[nn.Module]:
    last_conv = None
    for module in model.modules():
        if isinstance(module, nn.Conv2d):
            last_conv = module
    return last_conv


def compute_gradcam_heatmap(
    model: nn.Module, input_tensor: torch.Tensor, target_class: int
) -> str:
    conv_layer = find_last_conv_layer(model)
    if conv_layer is None:
        # Vision Transformer gradient saliency fallback on input tensor
        inp = input_tensor.clone().detach().requires_grad_(True)
        logits = model(inp)
        logits[0, target_class].backward()
        grad = inp.grad.data.abs().squeeze(0).max(dim=0)[0].cpu().numpy()
        cam = (grad - grad.min()) / (grad.max() - grad.min() + 1e-8)
    else:
        activations: List[torch.Tensor] = []
        gradients: List[torch.Tensor] = []

        def fwd_hook(_m: nn.Module, _inp: Any, out: torch.Tensor) -> None:
            activations.append(out.detach())

        def bwd_hook(_m: nn.Module, _gin: Any, gout: Any) -> None:
            gradients.append(gout[0].detach())

        h1 = conv_layer.register_forward_hook(fwd_hook)
        h2 = conv_layer.register_full_backward_hook(bwd_hook)
        try:
            model.zero_grad()
            logits = model(input_tensor)
            logits[0, target_class].backward()
            act = activations[0][0]
            grad = gradients[0][0]
            weights = grad.mean(dim=(1, 2), keepdim=True)
            cam_t = torch.relu((weights * act).sum(dim=0))
            cam = cam_t.cpu().numpy()
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        finally:
            h1.remove()
            h2.remove()

    cam_resized = cv2.resize(cam.astype(np.float32), (224, 224))
    cam_uint8 = np.uint8(255 * cam_resized)
    heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)
    return encode_png_base64(heatmap_rgb)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "healthy" if len(MODEL_CACHE) > 0 else "no_checkpoints_loaded",
        "loaded_models": list(MODEL_CACHE.keys()),
        "weights_dir": str(WEIGHTS_DIR),
        "device": str(DEVICE),
    }


@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    x_model_version: str = Header(default="v3.0 Ensemble", alias="X-Model-Version"),
) -> Dict[str, Any]:
    if not MODEL_CACHE:
        raise HTTPException(
            status_code=503,
            detail=(
                "No trained PyTorch checkpoints found in ML service. "
                "Train models using ml/train.py or DermAI_Colab_Training.ipynb and mount weights."
            ),
        )

    start_t = time.perf_counter()
    raw_bytes = await image.read()
    prep = preprocess(raw_bytes, target_size=(224, 224), apply_hair_removal=True, apply_clahe=True)
    tensor = torch.from_numpy(prep["model_tensor"]).to(DEVICE)

    # Resolve single model or ensemble average across loaded checkpoints
    if x_model_version == "v3.0 Ensemble" and len(MODEL_CACHE) > 1:
        prob_sum = np.zeros(len(CLASSES), dtype=np.float64)
        primary_model = next(iter(MODEL_CACHE.values()))["model"]
        with torch.no_grad():
            for entry in MODEL_CACHE.values():
                logits = entry["model"](tensor)
                prob_sum += torch.softmax(logits, dim=1).cpu().numpy()[0]
        probs = prob_sum / len(MODEL_CACHE)
        used_version = "v3.0 Ensemble"
    else:
        entry = MODEL_CACHE.get(x_model_version) or next(iter(MODEL_CACHE.values()))
        used_version = x_model_version if x_model_version in MODEL_CACHE else next(iter(MODEL_CACHE.keys()))
        primary_model = entry["model"]
        with torch.no_grad():
            logits = primary_model(tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    ranked = np.argsort(probs)[::-1]
    top3 = [
        {"label": CLASSES[idx], "probability": round(float(probs[idx]), 4)}
        for idx in ranked[:3]
    ]
    top_idx = int(ranked[0])
    top_label = CLASSES[top_idx]
    confidence = round(float(probs[top_idx]), 4)
    risk_tag = (
        "Requires Clinical Review"
        if confidence < CONFIDENCE_THRESHOLD
        else DEFAULT_RISK_MAP.get(top_label, "Moderate")
    )

    heatmap_b64 = compute_gradcam_heatmap(primary_model, tensor, top_idx)
    mask_b64 = compute_classical_mask(prep["display_image_rgb"])
    latency_ms = int((time.perf_counter() - start_t) * 1000)

    return {
        "model_version": used_version,
        "top3": top3,
        "confidence": confidence,
        "risk_tag": risk_tag,
        "mask_png_base64": mask_b64,
        "heatmap_png_base64": heatmap_b64,
        "latency_ms": latency_ms,
    }
