"""
backend/ml_service.py
Inference and Explainable AI Service for DermAI.

Provides:
- Otsu lesion detection and binary mask generation
- PyTorch + timm inference (EfficientNet-B0) with Top-3 predictions
- Grad-CAM++ explainability heatmap generation and alpha overlay
- Risk assessment protocol via configs/risk_map.yaml
- Strict "No trained model available" fallback
"""

import base64
import cv2
import io
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image
import yaml

from ml.preprocessing.pipeline import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    center_crop_square,
    enhance_contrast_clahe,
    remove_hair_dullrazor,
)

CLASSES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
CLASS_NAMES = {
    "akiec": "Actinic Keratosis / Intraepithelial Carcinoma",
    "bcc": "Basal Cell Carcinoma",
    "bkl": "Benign Keratosis",
    "df": "Dermatofibroma",
    "mel": "Melanoma",
    "nv": "Melanocytic Nevus",
    "vasc": "Vascular Lesion",
}

DEFAULT_WEIGHTS_PATH = "models/efficientnet_b0_best.pt"
RISK_MAP_PATH = "configs/risk_map.yaml"


class MLInferenceEngine:
    def __init__(self, weights_path: str = DEFAULT_WEIGHTS_PATH):
        self.weights_path = Path(weights_path)
        self.model: Optional[nn.Module] = None
        self.risk_config: Dict = self._load_risk_config()
        self.device = torch.device("cpu")
        self._load_model_if_available()

    def _load_risk_config(self) -> Dict:
        if os.path.exists(RISK_MAP_PATH):
            with open(RISK_MAP_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        return {
            "confidence_threshold": 0.50,
            "low_confidence_fallback": "Requires Clinical Review",
            "categories": {
                "mel": {"risk_level": "High Risk", "recommendation": "Urgent biopsy recommended."},
                "bcc": {"risk_level": "Moderate Risk", "recommendation": "Prompt review advised."},
                "akiec": {"risk_level": "Moderate Risk", "recommendation": "Prompt review advised."},
                "nv": {"risk_level": "Low Risk", "recommendation": "Routine monitoring."},
                "bkl": {"risk_level": "Low Risk", "recommendation": "Routine monitoring."},
                "df": {"risk_level": "Low Risk", "recommendation": "Routine monitoring."},
                "vasc": {"risk_level": "Low Risk", "recommendation": "Routine monitoring."},
            }
        }

    def is_model_available(self) -> bool:
        return self.weights_path.exists()

    def _load_model_if_available(self):
        if not self.is_model_available():
            self.model = None
            return

        try:
            ckpt = torch.load(self.weights_path, map_location=self.device)
            arch = ckpt.get("timm_name", "efficientnet_b0")
            num_classes = ckpt.get("num_classes", len(CLASSES))
            model = timm.create_model(arch, pretrained=False, num_classes=num_classes)
            model.load_state_dict(ckpt["state_dict"])
            model.eval()
            self.model = model
            print(f"[ML SERVICE] Successfully loaded model checkpoint from {self.weights_path}")
        except Exception as e:
            print(f"[ML SERVICE ERROR] Failed to load checkpoint {self.weights_path}: {e}")
            self.model = None

    def segment_lesion_otsu(self, bgr_224: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Classical Otsu lesion segmentation with morphological cleanup.
        Returns binary mask (224x224, uint8) and bounding box dict.
        """
        # Convert to LAB space: L channel captures luminance differences
        lab = cv2.cvtColor(bgr_224, cv2.COLOR_BGR2LAB)
        l_chan = lab[:, :, 0]

        # Invert L so lesion is foreground
        l_inv = cv2.bitwise_not(l_chan)
        blur = cv2.GaussianBlur(l_inv, (5, 5), 0)

        # Otsu thresholding
        _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Morphological closing to fill holes
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Find largest contour for lesion ROI
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        bbox = {"x": 0, "y": 0, "width": 224, "height": 224}
        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest)
            bbox = {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}

        return mask, bbox

    def generate_gradcam_plus_plus(self, input_tensor: torch.Tensor, target_class: int) -> np.ndarray:
        """
        Computes Grad-CAM++ attention map for EfficientNet-B0.
        """
        if self.model is None:
            return np.zeros((224, 224), dtype=np.float32)

        activations = []
        gradients = []

        def f_hook(mod, inp, out):
            activations.append(out)

        def b_hook(mod, gin, gout):
            gradients.append(gout[0])

        target_layer = getattr(self.model, "conv_head", None)
        if target_layer is None:
            # Fallback to last block in features
            target_layer = self.model.get_classifier()

        h1 = target_layer.register_forward_hook(f_hook)
        h2 = target_layer.register_full_backward_hook(b_hook)

        try:
            input_tensor.requires_grad = True
            output = self.model(input_tensor)
            score = output[0, target_class]
            self.model.zero_grad()
            score.backward(retain_graph=True)

            if not activations or not gradients:
                return np.zeros((224, 224), dtype=np.float32)

            act = activations[0]
            grad = gradients[0]

            # Grad-CAM++ formula
            grad_2 = grad.pow(2)
            grad_3 = grad.pow(3)
            sum_act = torch.sum(act, dim=(2, 3), keepdim=True)
            eps = 1e-7
            alpha = grad_2 / (2 * grad_2 + sum_act * grad_3 + eps)
            weights = torch.sum(alpha * torch.relu(grad), dim=(2, 3), keepdim=True)
            cam = torch.sum(weights * act, dim=1, keepdim=True)
            cam = torch.relu(cam)
            cam_np = cam.squeeze().detach().cpu().numpy()
            cam_resized = cv2.resize(cam_np, (224, 224))
            if cam_resized.max() > 0:
                cam_normalized = (cam_resized - cam_resized.min()) / (cam_resized.max() - cam_resized.min() + eps)
            else:
                cam_normalized = cam_resized
            return cam_normalized
        finally:
            h1.remove()
            h2.remove()

    def analyze_image_bytes(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        End-to-end analysis workflow:
        1. Decode and preprocess
        2. Otsu lesion segmentation
        3. EfficientNet-B0 classification
        4. Grad-CAM++ explainability heatmap
        5. Calibrated risk assessment
        """
        # Reload model if checkpoint was recently added
        if self.model is None and self.is_model_available():
            self._load_model_if_available()

        if self.model is None:
            return {
                "success": False,
                "trained_model_available": False,
                "message": "No trained model available",
                "disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
            }

        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("Corrupted image data could not be decoded.")

        # Preprocessing
        bgr = remove_hair_dullrazor(bgr)
        bgr = enhance_contrast_clahe(bgr)
        bgr = center_crop_square(bgr)
        bgr_224 = cv2.resize(bgr, (224, 224), interpolation=cv2.INTER_AREA)

        # Otsu segmentation
        mask, bbox = self.segment_lesion_otsu(bgr_224)

        # Tensor conversion
        rgb_224 = cv2.cvtColor(bgr_224, cv2.COLOR_BGR2RGB)
        norm_img = rgb_224.astype(np.float32) / 255.0
        norm_img = (norm_img - IMAGENET_MEAN) / IMAGENET_STD
        input_tensor = torch.tensor(norm_img.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0).to(self.device)

        # Inference
        self.model.eval()
        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

        top_indices = np.argsort(probs)[::-1][:3]
        top3 = []
        for idx in top_indices:
            cls = CLASSES[idx]
            top3.append({
                "class_code": cls,
                "name": CLASS_NAMES.get(cls, cls),
                "confidence": round(float(probs[idx]), 4),
            })

        predicted_code = top3[0]["class_code"]
        predicted_name = top3[0]["name"]
        confidence = top3[0]["confidence"]

        # Grad-CAM++
        cam_map = self.generate_gradcam_plus_plus(input_tensor, int(top_indices[0]))
        heatmap_uint8 = np.uint8(255 * cam_map)
        heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(bgr_224, 0.6, heatmap_color, 0.4, 0)

        # Risk Assessment
        threshold = self.risk_config.get("confidence_threshold", 0.50)
        cat_info = self.risk_config.get("categories", {}).get(predicted_code, {})
        if confidence < threshold:
            risk_category = "Requires Clinical Review"
            recommendation = "AI model confidence is below the threshold. Professional in-person dermatological evaluation is strongly recommended."
        else:
            risk_category = cat_info.get("risk_level", "Moderate Risk")
            recommendation = cat_info.get("recommendation", "Clinical correlation advised.")

        # Base64 encodings for frontend preview
        _, mask_buf = cv2.imencode(".png", mask)
        mask_b64 = "data:image/png;base64," + base64.b64encode(mask_buf).decode("utf-8")

        _, overlay_buf = cv2.imencode(".png", overlay)
        overlay_b64 = "data:image/png;base64," + base64.b64encode(overlay_buf).decode("utf-8")

        _, prep_buf = cv2.imencode(".png", bgr_224)
        prep_b64 = "data:image/png;base64," + base64.b64encode(prep_buf).decode("utf-8")

        return {
            "success": True,
            "trained_model_available": True,
            "model_version": "v1.0-efficientnet_b0",
            "predicted_condition": predicted_name,
            "condition_code": predicted_code,
            "confidence": confidence,
            "risk_category": risk_category,
            "recommendation": recommendation,
            "top3": top3,
            "bounding_box": bbox,
            "preprocessed_image_b64": prep_b64,
            "mask_png_b64": mask_b64,
            "heatmap_png_b64": overlay_b64,
            "disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."
        }


# Singleton engine instance
ml_engine = MLInferenceEngine()
