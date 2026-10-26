"""
DermAI Tests — Preprocessing pipeline with synthetic images.
No real patient data used.
"""
import io

import numpy as np
import pytest
from PIL import Image

from ml.preprocessing.pipeline import (
    preprocess,
    _center_crop_square,
    _apply_clahe,
    _remove_hair,
    _load_image,
)
import cv2


def _make_test_image(width=512, height=384, color=(150, 110, 95)) -> bytes:
    """Create a synthetic skin-colored image."""
    arr = np.full((height, width, 3), color, dtype=np.uint8)
    # Add some noise for realistic statistics
    noise = np.random.randint(-15, 15, arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _make_tiny_image() -> bytes:
    """Image smaller than 224px — should fail."""
    arr = np.zeros((100, 100, 3), dtype=np.uint8)
    pil = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    pil.save(buf, format="JPEG")
    return buf.getvalue()


def _make_pil_image(width=256, height=256):
    """Create a synthetic PIL image."""
    arr = np.random.randint(50, 200, (height, width, 3), dtype=np.uint8)
    return Image.fromarray(arr, mode="RGB")


class TestPreprocessBasic:
    def test_returns_correct_shape(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=False, clahe=False)
        assert tensor.shape == (3, 224, 224), f"Expected (3,224,224), got {tensor.shape}"

    def test_returns_float32(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=False, clahe=False)
        assert tensor.dtype == np.float32

    def test_custom_target_size(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=128, hair_removal=False, clahe=False)
        assert tensor.shape == (3, 128, 128)

    def test_return_pil_returns_tuple(self):
        img = _make_test_image(512, 384)
        result = preprocess(img, target_size=224, hair_removal=False, clahe=False, return_pil=True)
        assert isinstance(result, tuple)
        tensor, pil_img = result
        assert tensor.shape == (3, 224, 224)
        assert isinstance(pil_img, Image.Image)
        assert pil_img.size == (224, 224)

    def test_imagenet_normalization_applied(self):
        """After normalization, values should not be in [0,255] range."""
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=False, clahe=False)
        # ImageNet-normalized values: mean ~0, std ~1; far from raw pixel range
        assert tensor.min() < 1.0, "Values should be normalized below 1.0"
        assert tensor.max() < 5.0, "Values should not be in [0,255] after normalization"


class TestPreprocessWithOptionals:
    def test_with_hair_removal(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=True, clahe=False)
        assert tensor.shape == (3, 224, 224)

    def test_with_clahe(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=False, clahe=True)
        assert tensor.shape == (3, 224, 224)

    def test_full_pipeline(self):
        img = _make_test_image(512, 384)
        tensor = preprocess(img, target_size=224, hair_removal=True, clahe=True)
        assert tensor.shape == (3, 224, 224)


class TestPreprocessErrors:
    def test_tiny_image_raises_valueerror(self):
        img = _make_tiny_image()
        with pytest.raises(ValueError, match="too small"):
            preprocess(img, target_size=224)

    def test_corrupt_bytes_raises_valueerror(self):
        with pytest.raises(ValueError, match="Cannot decode"):
            preprocess(b"not_an_image", target_size=224)

    def test_invalid_type_raises_valueerror(self):
        with pytest.raises(ValueError, match="Unsupported"):
            preprocess(12345)  # type: ignore


class TestHelpers:
    def test_center_crop_square_landscape(self):
        pil = _make_pil_image(width=400, height=200)
        cropped = _center_crop_square(pil)
        assert cropped.size == (200, 200)

    def test_center_crop_square_portrait(self):
        pil = _make_pil_image(width=200, height=400)
        cropped = _center_crop_square(pil)
        assert cropped.size == (200, 200)

    def test_center_crop_already_square(self):
        pil = _make_pil_image(width=256, height=256)
        cropped = _center_crop_square(pil)
        assert cropped.size == (256, 256)

    def test_apply_clahe_same_shape(self):
        cv_img = np.random.randint(50, 200, (224, 224, 3), dtype=np.uint8)
        result = _apply_clahe(cv_img)
        assert result.shape == cv_img.shape

    def test_remove_hair_same_shape(self):
        cv_img = np.random.randint(50, 200, (224, 224, 3), dtype=np.uint8)
        result = _remove_hair(cv_img)
        assert result.shape == cv_img.shape

    def test_load_image_from_numpy(self):
        arr = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        pil = _load_image(arr)
        assert isinstance(pil, Image.Image)
