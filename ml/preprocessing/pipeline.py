"""
ml/preprocessing/pipeline.py
Standardized clinical image preprocessing pipeline for DermAI.

Pipeline Steps:
  Raw Image -> Validation -> Quality Assessment -> Hair Removal (Blackhat + Inpaint)
  -> Contrast Enhancement (CLAHE on L-channel) -> Center Crop -> Resize (224x224)
  -> ImageNet Normalization -> Model Input Tensor [1, 3, 224, 224]
"""

from typing import Dict, Any, Tuple, Union, Optional
import numpy as np
import cv2
from PIL import Image, ImageOps
import io


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def assess_quality(image_bgr: np.ndarray, min_dimension: int = 224) -> Dict[str, Any]:
    """
    Computes computer vision quality indicators on raw input image:
    - Blur via Laplacian variance
    - Luminance via mean gray level
    - Contrast via standard deviation of gray level
    - Minimum resolution check
    """
    if image_bgr is None or image_bgr.size == 0:
        return {
            "passed": False,
            "quality_label": "Poor",
            "reasons": ["Image is empty or corrupt."],
            "blur_laplacian": 0.0,
            "mean_gray": 0.0,
            "std_gray": 0.0,
            "width": 0,
            "height": 0
        }

    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Blur detection via Laplacian variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_gray = float(np.mean(gray))
    std_gray = float(np.std(gray))

    reasons = []
    is_poor = False
    is_acceptable = False

    # Resolution check
    if w < min_dimension or h < min_dimension:
        reasons.append(f"Resolution {w}x{h} is below minimum requirement of {min_dimension}x{min_dimension} px.")
        is_poor = True

    # Blur threshold
    if laplacian_var < 50.0:
        reasons.append(f"Severe motion or optical blur detected (variance: {laplacian_var:.1f} < 50.0). Retake with steady camera.")
        is_poor = True
    elif laplacian_var < 85.0:
        reasons.append(f"Moderate blur detected (variance: {laplacian_var:.1f}). Focus could be sharper.")
        is_acceptable = True

    # Exposure / Luminance check
    if mean_gray < 35.0:
        reasons.append(f"Severely underexposed / dark image (mean brightness: {mean_gray:.1f} < 35.0). Ensure adequate illumination.")
        is_poor = True
    elif mean_gray > 230.0:
        reasons.append(f"Severely overexposed / washed out image (mean brightness: {mean_gray:.1f} > 230.0). Avoid harsh flash glare.")
        is_poor = True
    elif mean_gray < 55.0 or mean_gray > 215.0:
        reasons.append(f"Suboptimal lighting condition (mean brightness: {mean_gray:.1f}).")
        is_acceptable = True

    # Contrast check
    if std_gray < 18.0:
        reasons.append(f"Extremely low image contrast (std: {std_gray:.1f} < 18.0). Lesion borders indistinct.")
        is_poor = True
    elif std_gray < 26.0:
        reasons.append(f"Low contrast (std: {std_gray:.1f}).")
        is_acceptable = True

    if is_poor:
        quality_label = "Poor"
        passed = False
    elif is_acceptable:
        quality_label = "Acceptable"
        passed = True
    else:
        quality_label = "Good"
        passed = True
        reasons.append("Image sharpness, illumination, contrast, and resolution are optimal for AI analysis.")

    return {
        "passed": passed,
        "quality_label": quality_label,
        "reasons": reasons,
        "blur_laplacian": round(laplacian_var, 2),
        "mean_gray": round(mean_gray, 2),
        "std_gray": round(std_gray, 2),
        "width": w,
        "height": h,
    }


def remove_hair_dullrazor(image_bgr: np.ndarray, kernel_size: int = 17) -> np.ndarray:
    """
    Applies DullRazor-inspired morphological hair removal:
    1. Grayscale conversion
    2. Blackhat morphological filtering to extract thin dark hair fibers
    3. Thresholding to create hair mask
    4. Telea inpainting to interpolate underlying skin pixels
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)

    # Threshold hair structure
    _, hair_mask = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)
    # Slight dilation to cover hair boundary penumbra
    hair_mask = cv2.dilate(hair_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)

    # If substantial hair detected, inpaint
    if np.count_nonzero(hair_mask) > 100:
        inpainted = cv2.inpaint(image_bgr, hair_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
        return inpainted
    return image_bgr


def enhance_contrast_clahe(image_bgr: np.ndarray, clip_limit: float = 2.0, tile_size: int = 8) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE)
    exclusively to the Luminance (L) channel in LAB color space to preserve
    delicate diagnostic lesion pigments.
    """
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
    l_enhanced = clahe.apply(l_channel)

    lab_enhanced = cv2.merge((l_enhanced, a_channel, b_channel))
    return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


def center_crop_square(image: np.ndarray) -> np.ndarray:
    """
    Extracts an aspect-preserving center square crop from the image.
    """
    h, w = image.shape[:2]
    min_dim = min(h, w)
    start_y = (h - min_dim) // 2
    start_x = (w - min_dim) // 2
    return image[start_y:start_y + min_dim, start_x:start_x + min_dim]


def load_image_with_exif(image_bytes: bytes) -> np.ndarray:
    """
    Loads raw image bytes with EXIF orientation correction, returning BGR numpy array.
    """
    pil_img = Image.open(io.BytesIO(image_bytes))
    pil_img = ImageOps.exif_transpose(pil_img)
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    rgb = np.array(pil_img)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def preprocess(
    image_input: Union[bytes, np.ndarray, str],
    target_size: Tuple[int, int] = (224, 224),
    apply_hair_removal: bool = True,
    apply_clahe: bool = True,
    min_resolution: int = 224,
) -> Dict[str, Any]:
    """
    End-to-end preprocessing pipeline for DermAI.

    Args:
        image_input: Raw image bytes, BGR/RGB numpy array, or file path.
        target_size: Output resolution for deep learning inference (default 224x224).
        apply_hair_removal: Toggle for morphological DullRazor inpainting.
        apply_clahe: Toggle for L-channel adaptive contrast equalization.
        min_resolution: Minimum dimension allowed for quality validation.

    Returns:
        Dict containing:
            - "quality": Quality assessment metrics dict
            - "display_image_rgb": uint8 array [H, W, 3] for UI visualization
            - "model_tensor": float32 normalized tensor [1, 3, H, W]
            - "display_png_bytes": PNG bytes of preprocessed image
    """
    # 1. Image Ingestion
    if isinstance(image_input, bytes):
        img_bgr = load_image_with_exif(image_input)
    elif isinstance(image_input, str):
        with open(image_input, "rb") as f:
            img_bgr = load_image_with_exif(f.read())
    elif isinstance(image_input, np.ndarray):
        img_bgr = image_input.copy()
        if len(img_bgr.shape) == 2:
            img_bgr = cv2.cvtColor(img_bgr, cv2.COLOR_GRAY2BGR)
    else:
        raise ValueError("Unsupported image input format. Provide bytes, filepath, or ndarray.")

    # 2. Quality Assessment
    quality_metrics = assess_quality(img_bgr, min_dimension=min_resolution)

    # 3. Optional Hair Removal
    processed_bgr = img_bgr
    if apply_hair_removal:
        processed_bgr = remove_hair_dullrazor(processed_bgr)

    # 4. Optional CLAHE Contrast Enhancement
    if apply_clahe:
        processed_bgr = enhance_contrast_clahe(processed_bgr)

    # 5. Aspect-Preserving Center Crop
    cropped_bgr = center_crop_square(processed_bgr)

    # 6. Resize to Target Dimensions
    resized_bgr = cv2.resize(cropped_bgr, target_size, interpolation=cv2.INTER_AREA)

    # Convert to RGB
    resized_rgb = cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2RGB)

    # 7. Model Tensor Normalization (ImageNet standardization)
    # Scale to [0, 1]
    norm_float = resized_rgb.astype(np.float32) / 255.0
    # Subtract mean and divide by std
    standardized = (norm_float - IMAGENET_MEAN) / IMAGENET_STD

    # Transpose to Channel-First format: [C, H, W] -> Add batch dim: [1, C, H, W]
    channel_first = np.transpose(standardized, (2, 0, 1))
    model_tensor = np.expand_dims(channel_first, axis=0).astype(np.float32)

    # Encode preprocessed RGB image to PNG bytes for immediate UI display
    success, png_buffer = cv2.imencode(".png", cv2.cvtColor(resized_rgb, cv2.COLOR_RGB2BGR))
    png_bytes = png_buffer.tobytes() if success else b""

    return {
        "quality": quality_metrics,
        "display_image_rgb": resized_rgb,
        "model_tensor": model_tensor,
        "display_png_bytes": png_bytes,
        "target_size": target_size,
    }
