"""
DermAI Backend — Image Quality Assessment Service

Computes quality metrics and assigns a label (Good / Acceptable / Poor).
Called on every uploaded image before it is saved.

Quality thresholds (matching docs/04_database.md):
  Metric             Good          Acceptable        Poor
  Laplacian (blur)   ≥ 100         50–99             < 50
  Brightness mean    80–200        50–79 / 201–230   < 50 or > 230
  Contrast std       ≥ 40          20–39             < 20
  Short side (res)   ≥ 600px       224–599px         < 224px
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import cv2
import numpy as np
from PIL import Image


# ── Thresholds ────────────────────────────────────────────────────────────────
BLUR_GOOD = 100.0
BLUR_ACCEPTABLE = 50.0

BRIGHTNESS_GOOD_LOW = 80.0
BRIGHTNESS_GOOD_HIGH = 200.0
BRIGHTNESS_ACC_LOW = 50.0
BRIGHTNESS_ACC_HIGH = 230.0

CONTRAST_GOOD = 40.0
CONTRAST_ACCEPTABLE = 20.0

RESOLUTION_GOOD = 600
RESOLUTION_ACCEPTABLE = 224


@dataclass
class QualityResult:
    blur_score: float
    brightness_mean: float
    contrast_std: float
    width: int
    height: int
    quality_label: str  # "Good" | "Acceptable" | "Poor"
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "blur_score": round(self.blur_score, 2),
            "brightness_mean": round(self.brightness_mean, 2),
            "contrast_std": round(self.contrast_std, 2),
            "width": self.width,
            "height": self.height,
            "quality_label": self.quality_label,
            "reasons": self.reasons,
        }


def assess_quality(image_bytes: bytes) -> QualityResult:
    """
    Assess image quality from raw bytes.
    Returns a QualityResult with metrics and a label.
    Raises ValueError if the image cannot be decoded.
    """
    # Decode with Pillow first (handles EXIF orientation, formats)
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        # Fix EXIF orientation
        pil_img = _fix_exif_orientation(pil_img)
        pil_img = pil_img.convert("RGB")
        width, height = pil_img.size
    except Exception as exc:
        raise ValueError(f"Cannot decode image: {exc}") from exc

    # Convert to OpenCV BGR for metric computation
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # ── Blur (Laplacian variance) ──────────────────────────────────────────────
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # ── Brightness (mean of grayscale) ────────────────────────────────────────
    brightness_mean = float(gray.mean())

    # ── Contrast (std dev of grayscale) ──────────────────────────────────────
    contrast_std = float(gray.std())

    # ── Label computation ─────────────────────────────────────────────────────
    short_side = min(width, height)
    poor_reasons: list[str] = []
    acceptable_reasons: list[str] = []

    # Blur check
    if blur_score < BLUR_ACCEPTABLE:
        poor_reasons.append(
            f"Image is too blurry (score {blur_score:.1f} < {BLUR_ACCEPTABLE}). "
            "Hold the phone steady and ensure good lighting."
        )
    elif blur_score < BLUR_GOOD:
        acceptable_reasons.append(f"Slightly blurry (score {blur_score:.1f}).")

    # Brightness check
    if brightness_mean < BRIGHTNESS_ACC_LOW:
        poor_reasons.append(
            f"Image is too dark (mean gray {brightness_mean:.1f} < {BRIGHTNESS_ACC_LOW}). "
            "Move to a brighter location or use flash."
        )
    elif brightness_mean > BRIGHTNESS_ACC_HIGH:
        poor_reasons.append(
            f"Image is overexposed (mean gray {brightness_mean:.1f} > {BRIGHTNESS_ACC_HIGH}). "
            "Reduce lighting or avoid direct flash."
        )
    elif brightness_mean < BRIGHTNESS_GOOD_LOW or brightness_mean > BRIGHTNESS_GOOD_HIGH:
        acceptable_reasons.append(f"Suboptimal brightness ({brightness_mean:.1f}).")

    # Contrast check
    if contrast_std < CONTRAST_ACCEPTABLE:
        poor_reasons.append(
            f"Image has very low contrast (std {contrast_std:.1f} < {CONTRAST_ACCEPTABLE}). "
            "Ensure the lesion is visible and well-lit."
        )
    elif contrast_std < CONTRAST_GOOD:
        acceptable_reasons.append(f"Low contrast (std {contrast_std:.1f}).")

    # Resolution check
    if short_side < RESOLUTION_ACCEPTABLE:
        poor_reasons.append(
            f"Image resolution is too low ({width}×{height}). "
            f"Minimum short side: {RESOLUTION_ACCEPTABLE}px. "
            "Move the phone closer to the lesion."
        )
    elif short_side < RESOLUTION_GOOD:
        acceptable_reasons.append(f"Resolution is acceptable ({width}×{height}) but consider higher quality.")

    # Determine label
    if poor_reasons:
        label = "Poor"
        reasons = poor_reasons
    elif acceptable_reasons:
        label = "Acceptable"
        reasons = acceptable_reasons
    else:
        label = "Good"
        reasons = []

    return QualityResult(
        blur_score=blur_score,
        brightness_mean=brightness_mean,
        contrast_std=contrast_std,
        width=width,
        height=height,
        quality_label=label,
        reasons=reasons,
    )


def _fix_exif_orientation(img: Image.Image) -> Image.Image:
    """Rotate image to correct EXIF orientation tag."""
    try:
        exif = img.getexif()
        orientation_tag = 274  # EXIF orientation
        orientation = exif.get(orientation_tag, 1)
        rotation_map = {3: 180, 6: 270, 8: 90}
        if orientation in rotation_map:
            img = img.rotate(rotation_map[orientation], expand=True)
    except Exception:
        pass  # If no EXIF, continue without rotation
    return img
