"""
DermAI Backend — Storage Service
Abstracts file storage: local filesystem or MinIO/S3.
Controlled by STORAGE_BACKEND env variable.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_upload(filename: str, content_type: str, size_bytes: int) -> None:
    """
    Validate upload before storage.
    Raises ValueError with a user-friendly message on failure.
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"File type '{ext}' is not allowed. Please upload a JPG or PNG image."
        )
    if content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise ValueError(
            f"Content type '{content_type}' is not accepted. Must be image/jpeg or image/png."
        )
    if size_bytes > MAX_FILE_SIZE_BYTES:
        mb = size_bytes / (1024 * 1024)
        raise ValueError(
            f"File size {mb:.1f} MB exceeds the 10 MB limit. Please compress or retake the photo."
        )


def save_local(image_bytes: bytes, case_id: uuid.UUID, original_filename: str) -> str:
    """
    Save image bytes to the local filesystem.
    Returns the storage_key (relative path).
    """
    storage_root = Path(settings.local_storage_path)
    case_dir = storage_root / str(case_id)
    case_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(original_filename).suffix.lower() or ".jpg"
    file_id = uuid.uuid4().hex
    file_name = f"{file_id}{ext}"
    file_path = case_dir / file_name

    file_path.write_bytes(image_bytes)
    return f"{case_id}/{file_name}"


def load_local(storage_key: str) -> bytes:
    """Read a locally stored image by its storage_key."""
    file_path = Path(settings.local_storage_path) / storage_key
    if not file_path.exists():
        raise FileNotFoundError(f"Image not found: {storage_key}")
    return file_path.read_bytes()


def save_image(image_bytes: bytes, case_id: uuid.UUID, original_filename: str) -> str:
    """
    Save image using the configured STORAGE_BACKEND.
    Returns storage_key.
    """
    if settings.storage_backend == "local":
        return save_local(image_bytes, case_id, original_filename)
    elif settings.storage_backend == "minio":
        return _save_minio(image_bytes, case_id, original_filename)
    else:
        raise ValueError(f"Unknown STORAGE_BACKEND: {settings.storage_backend}")


def load_image(storage_key: str) -> bytes:
    """Load image using the configured STORAGE_BACKEND."""
    if settings.storage_backend == "local":
        return load_local(storage_key)
    elif settings.storage_backend == "minio":
        return _load_minio(storage_key)
    else:
        raise ValueError(f"Unknown STORAGE_BACKEND: {settings.storage_backend}")


def _save_minio(image_bytes: bytes, case_id: uuid.UUID, original_filename: str) -> str:
    """Save to MinIO / S3-compatible storage."""
    import io
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
    )
    ext = Path(original_filename).suffix.lower() or ".jpg"
    key = f"{case_id}/{uuid.uuid4().hex}{ext}"
    s3.upload_fileobj(
        io.BytesIO(image_bytes),
        settings.minio_bucket,
        key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )
    return key


def _load_minio(storage_key: str) -> bytes:
    """Load from MinIO / S3."""
    import io
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
    )
    buf = io.BytesIO()
    s3.download_fileobj(settings.minio_bucket, storage_key, buf)
    return buf.getvalue()
