"""
backend/storage.py
Pluggable storage manager supporting local filesystem (default) and MinIO / S3.
"""

import os
from pathlib import Path
from typing import Optional
import uuid
from backend.config import settings


class StorageManager:
    def __init__(self):
        self.backend = settings.STORAGE_BACKEND.lower()
        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)
        self.local_dir.mkdir(parents=True, exist_ok=True)
        self.minio_client = None

        if self.backend == "minio":
            try:
                from minio import Minio
                self.minio_client = Minio(
                    settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=settings.MINIO_SECURE,
                )
                if not self.minio_client.bucket_exists(settings.MINIO_BUCKET):
                    self.minio_client.make_bucket(settings.MINIO_BUCKET)
                print(f"[STORAGE] Connected to MinIO bucket '{settings.MINIO_BUCKET}'")
            except Exception as e:
                print(f"[STORAGE WARNING] MinIO connection failed: {e}. Falling back to local storage.")
                self.backend = "local"

    def save_image(self, case_id: int, original_filename: str, file_bytes: bytes) -> str:
        """
        Stores image file and returns unique storage_key string.
        """
        safe_ext = Path(original_filename).suffix.lower() or ".jpg"
        unique_token = uuid.uuid4().hex[:12]
        filename = f"{case_id}_{unique_token}{safe_ext}"

        if self.backend == "minio" and self.minio_client:
            import io
            storage_key = f"cases/{case_id}/{filename}"
            self.minio_client.put_object(
                settings.MINIO_BUCKET,
                storage_key,
                io.BytesIO(file_bytes),
                length=len(file_bytes),
                content_type="image/jpeg" if safe_ext in [".jpg", ".jpeg"] else "image/png"
            )
            return storage_key

        # Default local storage
        case_folder = self.local_dir / "images" / str(case_id)
        case_folder.mkdir(parents=True, exist_ok=True)
        dest_file = case_folder / filename
        with open(dest_file, "wb") as f:
            f.write(file_bytes)
        # Store relative path
        return str(dest_file.relative_to(self.local_dir.parent.parent))

    def get_image_bytes(self, storage_key: str) -> Optional[bytes]:
        """
        Retrieves raw bytes for storage_key.
        """
        if self.backend == "minio" and self.minio_client:
            try:
                response = self.minio_client.get_object(settings.MINIO_BUCKET, storage_key)
                return response.read()
            except Exception as e:
                print(f"[STORAGE ERROR] MinIO retrieval failed: {e}")
                return None

        # Local storage lookup
        # storage_key can be relative to workspace or direct file path
        candidate_paths = [
            Path(storage_key),
            self.local_dir / storage_key,
            self.local_dir.parent.parent / storage_key
        ]
        for p in candidate_paths:
            if p.exists() and p.is_file():
                with open(p, "rb") as f:
                    return f.read()
        return None


storage = StorageManager()
