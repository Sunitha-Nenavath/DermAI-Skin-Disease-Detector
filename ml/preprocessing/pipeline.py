"""
DermAI — Preprocessing Pipeline (ml/preprocessing/pipeline.py)

Implements the full preprocessing pipeline:
  Raw Image → Validation → Quality Assessment → Crop → Resize (224×224)
  → Color Normalization → ImageNet Normalization → Model Input Tensor

Optional steps (controlled by parameters):
  - Hair removal (OpenCV morphological blackhat + inpaint)
  - Contrast enhancement (CLAHE on L channel)

Usage:
    from ml.preprocessing.pipeline import preprocess

    tensor = preprocess(image_bytes)                # returns numpy array (3, H, W)
    tensor, pil = preprocess(image_bytes, return_pil=True)  # also returns PIL image
"""
from __future__ import annotations

import io
from typing import Any

import cv2
import numpy as np
from PIL import Image

# ── ImageNet normalization constants ──────────────────────────────────────────
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Default target size
DEFAULT_SIZE = 224


def preprocess(
    image_input: bytes | str | np.ndarray,
    target_size: int = DEFAULT_SIZE,
    hair_removal: bool = True,
    clahe: bool = True,
    return_pil: bool = False,
) -> np.ndarray | tuple[np.ndarray, Image.Image]:
    """
    Full preprocessing pipeline for a skin lesion image.

    Args:
        image_input:   Raw image bytes, file path (str), or numpy RGB array.
        target_size:   Output spatial size (square). Default 224.
        hair_removal:  Apply hair removal filter. Default True.
        clahe:         Apply CLAHE contrast enhancement. Default True.
        return_pil:    If True, also return the preprocessed PIL image.

    Returns:
        numpy array of shape (3, target_size, target_size) and dtype float32,
        normalized to ImageNet mean/std.
        If return_pil=True, returns (array, PIL.Image).

    Raises:
        ValueError: If the image cannot be decoded or is too small.
    """
    # ── 1. Load ───────────────────────────────────────────────────────────────
    pil_img = _load_image(image_input)

    # ── 2. Validation ─────────────────────────────────────────────────────────
    width, height = pil_img.size
    if min(width, height) < DEFAULT_SIZE:
        raise ValueError(
            f"Image too small ({width}×{height}). Minimum: {DEFAULT_SIZE}px on short side."
        )

    # ── 3. EXIF orientation fix ────────────────────────────────────────────────
    pil_img = _fix_exif_orientation(pil_img)
    pil_img = pil_img.convert("RGB")

    # ── 4. Center crop (square) ───────────────────────────────────────────────
    pil_img = _center_crop_square(pil_img)

    # ── 5. Convert to OpenCV BGR for filtering ─────────────────────────────────
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # ── 6. Hair removal (optional) ────────────────────────────────────────────
    if hair_removal:
        cv_img = _remove_hair(cv_img)

    # ── 7. CLAHE contrast enhancement (optional) ──────────────────────────────
    if clahe:
        cv_img = _apply_clahe(cv_img)

    # ── 8. Resize to target_size × target_size ────────────────────────────────
    cv_img = cv2.resize(cv_img, (target_size, target_size), interpolation=cv2.INTER_AREA)

    # ── 9. Back to RGB float32 [0, 1] ────────────────────────────────────────
    rgb_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    # ── 10. ImageNet normalization ────────────────────────────────────────────
    normalized = (rgb_img - IMAGENET_MEAN) / IMAGENET_STD  # (H, W, 3)

    # ── 11. Channel-first tensor (C, H, W) ───────────────────────────────────
    tensor = normalized.transpose(2, 0, 1).astype(np.float32)  # (3, H, W)

    if return_pil:
        # Return denormalized PIL image for display
        display_pil = Image.fromarray((rgb_img * 255).astype(np.uint8))
        return tensor, display_pil

    return tensor


# ── Private helpers ────────────────────────────────────────────────────────────

def _load_image(image_input: bytes | str | np.ndarray) -> Image.Image:
    """Load image from bytes, path, or numpy array."""
    if isinstance(image_input, bytes):
        try:
            return Image.open(io.BytesIO(image_input))
        except Exception as exc:
            raise ValueError(f"Cannot decode image bytes: {exc}") from exc
    elif isinstance(image_input, str):
        try:
            return Image.open(image_input)
        except Exception as exc:
            raise ValueError(f"Cannot open image file '{image_input}': {exc}") from exc
    elif isinstance(image_input, np.ndarray):
        return Image.fromarray(image_input)
    else:
        raise ValueError(f"Unsupported image_input type: {type(image_input)}")


def _fix_exif_orientation(img: Image.Image) -> Image.Image:
    """Rotate image based on EXIF orientation tag."""
    try:
        exif = img.getexif()
        orientation = exif.get(274, 1)  # Tag 274 = Orientation
        rotation_map = {3: 180, 6: 270, 8: 90}
        if orientation in rotation_map:
            img = img.rotate(rotation_map[orientation], expand=True)
    except Exception:
        pass
    return img


def _center_crop_square(img: Image.Image) -> Image.Image:
    """Crop the center square region of the image."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def _remove_hair(bgr_img: np.ndarray) -> np.ndarray:
    """
    Remove hair artifacts using morphological blackhat + inpainting.

    Algorithm:
    1. Convert to grayscale.
    2. Apply morphological blackhat to detect dark linear structures (hairs).
    3. Threshold to create a hair mask.
    4. Inpaint the mask region.
    """
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)

    # Blackhat: detects dark hair against lighter skin background
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 17))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)

    # Threshold: hair pixels appear as bright regions in blackhat
    _, hair_mask = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)

    # Dilate mask slightly to cover hair borders
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    hair_mask = cv2.dilate(hair_mask, dilate_kernel, iterations=1)

    # Inpaint: fill hair regions with surrounding skin texture
    result = cv2.inpaint(bgr_img, hair_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
    return result


def _apply_clahe(bgr_img: np.ndarray, clip_limit: float = 2.0, tile_size: int = 8) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization).

    Applied on the L (lightness) channel in LAB color space to avoid
    color distortion while improving local contrast.
    """
    lab = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
    l_clahe = clahe.apply(l_channel)

    lab_clahe = cv2.merge([l_clahe, a_channel, b_channel])
    return cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR)
