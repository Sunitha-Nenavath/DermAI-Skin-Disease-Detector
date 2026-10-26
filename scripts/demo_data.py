"""
DermAI — scripts/demo_data.py
Creates two demo cases with synthetic sample images for demonstration.
NO real patient data — all images are generated synthetically.

Usage:
    cd backend
    python ../scripts/demo_data.py
"""
import asyncio
import io
import os
import sys
import uuid
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.future import select

from app.models.models import Case, Image as ImageModel, Patient, User
from app.services.quality import assess_quality
from app.services.storage import save_image

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://dermai_user:change_me_in_production@localhost:5432/dermai",
)


def _make_synthetic_lesion(
    width: int = 640,
    height: int = 480,
    lesion_color: tuple = (160, 80, 70),
    skin_color: tuple = (220, 170, 140),
    lesion_radius: int = 80,
) -> bytes:
    """
    Create a synthetic skin lesion image (skin background + dark circular lesion).
    NOT a real image. For demo/testing only.
    """
    # Skin background with slight noise
    arr = np.full((height, width, 3), skin_color, dtype=np.uint8)
    noise = np.random.randint(-10, 10, arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr, mode="RGB")

    # Draw lesion circle
    draw = ImageDraw.Draw(pil)
    cx, cy = width // 2, height // 2
    draw.ellipse(
        [cx - lesion_radius, cy - lesion_radius, cx + lesion_radius, cy + lesion_radius],
        fill=lesion_color,
        outline=(100, 50, 40),
        width=3,
    )

    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


async def create_demo_data():
    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        # Find clinician user
        result = await session.execute(
            select(User).where(User.role == "clinician")
        )
        clinician = result.scalar_one_or_none()
        if not clinician:
            print("[ERROR] No clinician user found. Run scripts/seed.py first.")
            return

        # Find or create patient record
        result = await session.execute(
            select(Patient).where(Patient.case_code == "DEMO-PT-001")
        )
        patient = result.scalar_one_or_none()
        if not patient:
            patient = Patient(
                case_code="DEMO-PT-001",
                age=45,
                gender="female",
                medical_history="Synthetic demo patient. No real data.",
                allergies="None known",
                clinical_notes="Demo patient created by demo_data.py",
                created_by=clinician.id,
            )
            session.add(patient)
            await session.flush()
            print(f"  [CREATE] Patient: DEMO-PT-001")

        # ── Demo Case 1: Suspected Melanoma ──────────────────────────────────
        result = await session.execute(
            select(Case).where(Case.case_code == "DEMO-CASE-001")
        )
        if not result.scalar_one_or_none():
            case1 = Case(
                case_code="DEMO-CASE-001",
                patient_id=patient.id,
                owner_id=clinician.id,
                title="Suspected melanoma — left upper arm",
                body_location="upper extremity",
                status="pending_review",
            )
            session.add(case1)
            await session.flush()
            print(f"  [CREATE] Case: DEMO-CASE-001")

            # Add 2 synthetic images
            for i, (lc, lr) in enumerate(
                [((120, 60, 55), 90), ((100, 55, 50), 100)], 1
            ):
                img_bytes = _make_synthetic_lesion(
                    width=640, height=480,
                    lesion_color=lc,
                    skin_color=(215, 175, 145),
                    lesion_radius=lr,
                )
                quality = assess_quality(img_bytes)
                storage_key = save_image(img_bytes, case1.id, f"demo_melanoma_{i}.jpg")
                img_record = ImageModel(
                    case_id=case1.id,
                    storage_key=storage_key,
                    original_filename=f"demo_melanoma_{i}.jpg",
                    content_type="image/jpeg",
                    width=quality.width,
                    height=quality.height,
                    size_bytes=len(img_bytes),
                    source="camera",
                    quality_label=quality.quality_label,
                    quality_metrics_json=quality.to_dict(),
                )
                session.add(img_record)
                print(f"    [CREATE] Image {i}: quality={quality.quality_label}")

        # ── Demo Case 2: Benign Nevus ─────────────────────────────────────────
        result = await session.execute(
            select(Case).where(Case.case_code == "DEMO-CASE-002")
        )
        if not result.scalar_one_or_none():
            case2 = Case(
                case_code="DEMO-CASE-002",
                patient_id=patient.id,
                owner_id=clinician.id,
                title="Benign nevus — back",
                body_location="back",
                status="reviewed",
            )
            session.add(case2)
            await session.flush()
            print(f"  [CREATE] Case: DEMO-CASE-002")

            img_bytes = _make_synthetic_lesion(
                width=640, height=480,
                lesion_color=(90, 70, 60),
                skin_color=(230, 185, 155),
                lesion_radius=50,
            )
            quality = assess_quality(img_bytes)
            storage_key = save_image(img_bytes, case2.id, "demo_nevus_1.jpg")
            img_record = ImageModel(
                case_id=case2.id,
                storage_key=storage_key,
                original_filename="demo_nevus_1.jpg",
                content_type="image/jpeg",
                width=quality.width,
                height=quality.height,
                size_bytes=len(img_bytes),
                source="gallery",
                quality_label=quality.quality_label,
                quality_metrics_json=quality.to_dict(),
            )
            session.add(img_record)
            print(f"    [CREATE] Image 1: quality={quality.quality_label}")

        await session.commit()
        print("\n[OK] Demo data created successfully.")
        print("  Cases: DEMO-CASE-001 (pending_review), DEMO-CASE-002 (reviewed)")
        print("  Login as clinician@dermai.local to view them.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_demo_data())
