"""
DermAI Tests — Image quality assessment: blur, brightness, contrast, resolution.
Uses synthetic PIL images — no real patient data.
"""
import io

import numpy as np
import pytest
from PIL import Image, ImageFilter

from app.services.quality import assess_quality


def _make_image_bytes(
    width: int = 640,
    height: int = 480,
    color: tuple[int, int, int] = (150, 120, 110),
    noise: bool = True,
) -> bytes:
    """Create a synthetic RGB image and return it as JPEG bytes."""
    arr = np.full((height, width, 3), color, dtype=np.uint8)
    if noise:
        arr = arr + np.random.randint(-20, 20, arr.shape, dtype=np.int16).astype(np.int8)
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _apply_blur(image_bytes: bytes, radius: int = 10) -> bytes:
    """Apply heavy Gaussian blur to simulate a blurry photo."""
    pil = Image.open(io.BytesIO(image_bytes))
    blurred = pil.filter(ImageFilter.GaussianBlur(radius=radius))
    buf = io.BytesIO()
    blurred.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _make_dark_image_bytes() -> bytes:
    """Very dark image (brightness ≈ 20)."""
    return _make_image_bytes(color=(15, 15, 15), noise=False)


def _make_bright_image_bytes() -> bytes:
    """Very bright/overexposed image (brightness ≈ 245)."""
    return _make_image_bytes(color=(245, 245, 245), noise=False)


def _make_low_res_image_bytes() -> bytes:
    """Image below minimum 224×224."""
    return _make_image_bytes(width=100, height=100)


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestQualityGood:
    def test_good_image_passes(self):
        img = _make_image_bytes(width=640, height=480, color=(140, 115, 100), noise=True)
        result = assess_quality(img)
        assert result.quality_label in ("Good", "Acceptable")
        assert result.width == 640
        assert result.height == 480

    def test_good_image_has_no_poor_reasons(self):
        img = _make_image_bytes(width=800, height=600)
        result = assess_quality(img)
        if result.quality_label == "Good":
            assert result.reasons == []


class TestQualityPoor:
    def test_blurry_image_is_poor(self):
        img = _make_image_bytes(width=640, height=480)
        blurry = _apply_blur(img, radius=15)
        result = assess_quality(blurry)
        assert result.quality_label == "Poor"
        assert result.blur_score < 50
        assert any("blurr" in r.lower() for r in result.reasons)

    def test_dark_image_is_poor(self):
        result = assess_quality(_make_dark_image_bytes())
        assert result.quality_label == "Poor"
        assert result.brightness_mean < 50
        assert any("dark" in r.lower() for r in result.reasons)

    def test_overexposed_image_is_poor(self):
        result = assess_quality(_make_bright_image_bytes())
        assert result.quality_label == "Poor"
        assert result.brightness_mean > 230
        assert any("overexposed" in r.lower() for r in result.reasons)

    def test_low_resolution_is_poor(self):
        result = assess_quality(_make_low_res_image_bytes())
        assert result.quality_label == "Poor"
        assert any("resolution" in r.lower() or "low" in r.lower() for r in result.reasons)


class TestQualityMetrics:
    def test_metrics_in_result(self):
        img = _make_image_bytes()
        result = assess_quality(img)
        assert isinstance(result.blur_score, float)
        assert isinstance(result.brightness_mean, float)
        assert isinstance(result.contrast_std, float)
        assert isinstance(result.width, int)
        assert isinstance(result.height, int)
        assert result.quality_label in ("Good", "Acceptable", "Poor")
        assert isinstance(result.reasons, list)

    def test_to_dict_serializable(self):
        img = _make_image_bytes()
        result = assess_quality(img)
        d = result.to_dict()
        assert "blur_score" in d
        assert "brightness_mean" in d
        assert "contrast_std" in d
        assert "width" in d
        assert "height" in d
        assert "quality_label" in d
        assert "reasons" in d


class TestQualityInvalidInput:
    def test_corrupt_bytes_raises_valueerror(self):
        with pytest.raises(ValueError, match="Cannot decode"):
            assess_quality(b"not_an_image_at_all_xyz")

    def test_empty_bytes_raises_valueerror(self):
        with pytest.raises(ValueError):
            assess_quality(b"")
