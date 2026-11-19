#!/usr/bin/env python3
"""
scripts/demo_data.py
Creates two realistic demonstration cases with verified benchmark lesion images.
"""

from datetime import datetime
import json
import os
from pathlib import Path
import sys

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import SessionLocal, engine, Base
from backend.models import User, Case, Patient, Image, UserRole, CaseStatus
from backend.quality import validate_and_assess_image
from backend.storage import storage


def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("[DEMO DATA] Seeding two benchmark clinical cases...")
        clinician = db.query(User).filter(User.role == UserRole.CLINICIAN.value).first()
        patient_user = db.query(User).filter(User.role == UserRole.PATIENT.value).first()

        if not clinician or not patient_user:
            print("[ERROR] Please run `python3 scripts/seed.py` first to create demo users.")
            return

        # Case 1: Forearm lesion (Melanocytic Nevus)
        case1_code = "CASE-2026-A101"
        existing_c1 = db.query(Case).filter(Case.case_code == case1_code).first()
        if not existing_c1:
            p1 = Patient(
                case_code="PAT-2026-4819",
                age=54,
                gender="male",
                medical_history="Moderate chronic sun exposure; family history of melanoma.",
                allergies="Penicillin",
                clinical_notes="[2026-10-24 Dr. Sarah Chen]: Patient presents with a 6mm asymmetrical pigmented macule on left dorsal forearm. Border slightly notched. Recommend dermoscopy comparison and follow-up.",
                created_by=clinician.id,
                created_at=datetime.utcnow()
            )
            db.add(p1)
            db.flush()

            c1 = Case(
                case_code=case1_code,
                patient_id=p1.id,
                owner_id=clinician.id,
                title="Asymmetrical pigmented macule on left forearm",
                body_location="upper extremity",
                status=CaseStatus.QUALITY_PASSED.value,
                created_at=datetime.utcnow()
            )
            db.add(c1)
            db.flush()

            sample1_path = Path("data/raw/ham10000/sample_images/nv_sample_1.jpg")
            if sample1_path.exists():
                with open(sample1_path, "rb") as f:
                    b1 = f.read()
                valid, msg, metrics, w, h = validate_and_assess_image(b1, sample1_path.name, "image/jpeg")
                key1 = storage.save_image(c1.id, sample1_path.name, b1)
                img1 = Image(
                    case_id=c1.id,
                    storage_key=key1,
                    original_filename=sample1_path.name,
                    content_type="image/jpeg",
                    width=w,
                    height=h,
                    size_bytes=len(b1),
                    source="camera",
                    quality_label=metrics.get("quality_label", "Good"),
                    quality_metrics_json=json.dumps(metrics),
                    created_at=datetime.utcnow()
                )
                db.add(img1)
            print(f"  [CREATED] Case 1: {case1_code} with sample image.")

        # Case 2: Upper Back Lesion (Melanoma benchmark)
        case2_code = "CASE-2026-B202"
        existing_c2 = db.query(Case).filter(Case.case_code == case2_code).first()
        if not existing_c2:
            p2 = Patient(
                case_code="PAT-2026-2301",
                age=42,
                gender="female",
                medical_history="Multiple atypical nevi syndrome; baseline total body photography on file.",
                allergies="Latex",
                clinical_notes="[2026-10-24 Dr. Sarah Chen]: Pigmented lesion on upper thoracic back with perceived border evolution over 3 months.",
                created_by=clinician.id,
                created_at=datetime.utcnow()
            )
            db.add(p2)
            db.flush()

            c2 = Case(
                case_code=case2_code,
                patient_id=p2.id,
                owner_id=patient_user.id,
                title="Evolving pigmented lesion on upper back",
                body_location="back",
                status=CaseStatus.QUALITY_PASSED.value,
                created_at=datetime.utcnow()
            )
            db.add(c2)
            db.flush()

            sample2_path = Path("data/raw/ham10000/sample_images/mel_sample_1.jpg")
            if sample2_path.exists():
                with open(sample2_path, "rb") as f:
                    b2 = f.read()
                valid, msg, metrics, w, h = validate_and_assess_image(b2, sample2_path.name, "image/jpeg")
                key2 = storage.save_image(c2.id, sample2_path.name, b2)
                img2 = Image(
                    case_id=c2.id,
                    storage_key=key2,
                    original_filename=sample2_path.name,
                    content_type="image/jpeg",
                    width=w,
                    height=h,
                    size_bytes=len(b2),
                    source="camera",
                    quality_label=metrics.get("quality_label", "Good"),
                    quality_metrics_json=json.dumps(metrics),
                    created_at=datetime.utcnow()
                )
                db.add(img2)
            print(f"  [CREATED] Case 2: {case2_code} with sample image.")

        db.commit()
        print("[DEMO DATA COMPLETED] Two realistic demo cases and images populated.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
