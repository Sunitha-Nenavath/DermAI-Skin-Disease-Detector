"""
backend/quality.py
Image quality assessment gate for DermAI upload intake.
"""

from typing import Tuple, Dict, Any, List
import io
import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ml.preprocessing.pipeline import assess_quality, load_image_with_exif

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def validate_and_assess_image(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    min_resolution: int = 224,
) -> Tuple[bool, str, Dict[str, Any], int, int]:
    """
    Validates uploaded image file bytes and runs computer vision quality gate.

    Returns:
        (is_valid, error_message, quality_metrics, width, height)
    """
    # 1. File Size Check
    size_bytes = len(file_bytes)
    if size_bytes == 0:
        return False, "Uploaded file is empty (0 bytes).", {}, 0, 0
    if size_bytes > MAX_FILE_SIZE_BYTES:
        return False, f"File size ({size_bytes / (1024*1024):.2f} MB) exceeds maximum limit of 10 MB.", {}, 0, 0

    # 2. File Format / Extension Check
    lower_name = filename.lower()
    has_valid_ext = any(lower_name.endswith(ext) for ext in ALLOWED_EXTENSIONS)
    if not has_valid_ext:
        return False, f"Unsupported file extension. Allowed formats are JPEG (.jpg, .jpeg) and PNG (.png).", {}, 0, 0

    # 3. Integrity & Corrupt Image Check via Pillow
    try:
        with Image.open(io.BytesIO(file_bytes)) as pil_img:
            pil_img.verify()
    except (UnidentifiedImageError, OSError, ValueError) as e:
        return False, f"Corrupted or invalid image file: {str(e)}. Please choose a valid image file.", {}, 0, 0

    # 4. EXIF Orientation & Dimension Extraction
    try:
        img_bgr = load_image_with_exif(file_bytes)
        height, width = img_bgr.shape[:2]
    except Exception as e:
        return False, f"Failed to decode image data: {str(e)}", {}, 0, 0

    # 5. Quality Assessment
    metrics = assess_quality(img_bgr, min_dimension=min_resolution)

    return True, "", metrics, width, height
