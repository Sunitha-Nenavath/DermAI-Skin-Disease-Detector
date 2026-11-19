#!/usr/bin/env python3
"""
scripts/prepare_sample_images.py
Generates realistic sample benchmark skin lesion images (600x450, standard HAM10000 dimensions)
for each of the 7 classes to enable visual EDA, unit testing, and offline pipeline demonstrations.
"""

import os
from pathlib import Path
import numpy as np
import cv2

CLASSES = {
    "mel": {"name": "Melanoma", "base_color": (50, 45, 60), "spot_color": (20, 20, 25), "asymmetric": True, "border": "irregular"},
    "nv": {"name": "Melanocytic Nevus", "base_color": (70, 75, 120), "spot_color": (35, 40, 70), "asymmetric": False, "border": "smooth"},
    "bcc": {"name": "Basal Cell Carcinoma", "base_color": (110, 100, 130), "spot_color": (60, 60, 100), "asymmetric": True, "border": "pearly_nodular"},
    "akiec": {"name": "Actinic Keratosis", "base_color": (120, 110, 150), "spot_color": (80, 80, 130), "asymmetric": True, "border": "scaly_erythematous"},
    "bkl": {"name": "Benign Keratosis", "base_color": (60, 80, 110), "spot_color": (30, 45, 70), "asymmetric": False, "border": "verrucous"},
    "df": {"name": "Dermatofibroma", "base_color": (80, 90, 130), "spot_color": (50, 60, 95), "asymmetric": False, "border": "central_white_rim"},
    "vasc": {"name": "Vascular Lesion", "base_color": (60, 50, 140), "spot_color": (30, 20, 110), "asymmetric": False, "border": "lacunar_red"}
}

def create_sample_lesion_image(cls_key: str, sample_idx: int, width: int = 600, height: int = 450) -> np.ndarray:
    rng = np.random.RandomState(hash(cls_key) % 10000 + sample_idx * 17)
    
    # Healthy skin background texture (phototype II-IV tones in BGR)
    skin_b = rng.randint(145, 185)
    skin_g = rng.randint(165, 205)
    skin_r = rng.randint(200, 235)
    
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (skin_b, skin_g, skin_r)
    
    # Add subtle skin texture noise
    noise = rng.normal(0, 4, (height, width, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    # Lesion center
    cx = width // 2 + rng.randint(-30, 30)
    cy = height // 2 + rng.randint(-25, 25)
    rx = rng.randint(55, 95)
    ry = rng.randint(50, 90)
    
    cfg = CLASSES[cls_key]
    mask = np.zeros((height, width), dtype=np.uint8)
    
    if cfg["asymmetric"]:
        # Irregular polygonal blob
        angles = np.linspace(0, 2 * np.pi, 24, endpoint=False)
        radii = [rx * (1.0 + rng.uniform(-0.35, 0.35)) for _ in angles]
        pts = np.array([
            [int(cx + r * np.cos(a)), int(cy + r * np.sin(a))]
            for a, r in zip(angles, radii)
        ], dtype=np.int32)
        cv2.fillPoly(mask, [pts], 255)
    else:
        # Oval or smooth ellipse
        angle = rng.randint(0, 180)
        cv2.ellipse(mask, (cx, cy), (rx, ry), angle, 0, 360, 255, -1)
        
    mask = cv2.GaussianBlur(mask, (21, 21), 11)
    norm_mask = mask.astype(np.float32) / 255.0
    norm_mask = np.expand_dims(norm_mask, axis=-1)
    
    # Lesion color rendering
    lesion_patch = np.zeros_like(img)
    base_bgr = cfg["base_color"]
    spot_bgr = cfg["spot_color"]
    
    lesion_patch[:, :] = base_bgr
    # Add internal pigment variations
    internal_noise = rng.normal(0, 12, (height, width, 3)).astype(np.int16)
    lesion_patch = np.clip(lesion_patch.astype(np.int16) + internal_noise, 0, 255).astype(np.uint8)
    
    # Central darker pigment core
    cv2.circle(lesion_patch, (cx, cy), int(min(rx, ry) * 0.45), spot_bgr, -1)
    lesion_patch = cv2.GaussianBlur(lesion_patch, (15, 15), 7)
    
    # Blend onto skin image
    blended = (img.astype(np.float32) * (1.0 - norm_mask) + lesion_patch.astype(np.float32) * norm_mask)
    result = np.clip(blended, 0, 255).astype(np.uint8)
    
    # Add 1-2 fine hairs across lesion for realistic artifact reduction testing
    if sample_idx == 1:
        cv2.line(result, (cx - 80, cy - 60), (cx + 90, cy + 70), (25, 20, 20), 2, cv2.LINE_AA)
    elif sample_idx == 2:
        cv2.line(result, (cx - 100, cy + 40), (cx + 110, cy - 50), (30, 25, 25), 2, cv2.LINE_AA)
        cv2.line(result, (cx - 20, cy - 80), (cx + 30, cy + 85), (20, 20, 20), 1, cv2.LINE_AA)
        
    return result

def main():
    out_dir = Path("data/raw/ham10000/sample_images")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    count = 0
    for cls_key in CLASSES:
        for idx in range(1, 4):
            img = create_sample_lesion_image(cls_key, idx)
            filename = f"{cls_key}_sample_{idx}.jpg"
            filepath = out_dir / filename
            cv2.imwrite(str(filepath), img, [cv2.IMWRITE_JPEG_QUALITY, 94])
            count += 1
            
    print(f"[SAMPLE_IMAGES] Successfully generated {count} benchmark lesion samples in {out_dir}")

if __name__ == "__main__":
    main()
