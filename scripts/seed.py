#!/usr/bin/env python3
"""
scripts/seed.py
Seeds one user for each of the 5 roles with credentials loaded securely from environment variables.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import SessionLocal, engine, Base
from backend.models import User, UserRole
from backend.auth import get_password_hash
from backend.config import settings


DEMO_USERS = [
    {
        "email": "clinician@dermai.local",
        "full_name": "Dr. Sarah Chen, MD",
        "role": UserRole.CLINICIAN.value,
        "password": settings.DEMO_CLINICIAN_PASSWORD,
    },
    {
        "email": "patient@dermai.local",
        "full_name": "John Doe (Patient)",
        "role": UserRole.PATIENT.value,
        "password": settings.DEMO_PATIENT_PASSWORD,
    },
    {
        "email": "researcher@dermai.local",
        "full_name": "Prof. Elena Rostova",
        "role": UserRole.RESEARCHER.value,
        "password": settings.DEMO_RESEARCHER_PASSWORD,
    },
    {
        "email": "ml_engineer@dermai.local",
        "full_name": "Marcus Aurelius (ML Engineer)",
        "role": UserRole.ML_ENGINEER.value,
        "password": settings.DEMO_ML_ENGINEER_PASSWORD,
    },
    {
        "email": "admin@dermai.local",
        "full_name": "System Administrator",
        "role": UserRole.ADMIN.value,
        "password": settings.DEMO_ADMIN_PASSWORD,
    },
]


def seed_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("[SEED] Seeding role-based demo user accounts...")
        created_count = 0
        updated_count = 0

        for u_data in DEMO_USERS:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if existing:
                existing.full_name = u_data["full_name"]
                existing.role = u_data["role"]
                existing.password_hash = get_password_hash(u_data["password"])
                existing.is_active = True
                updated_count += 1
                print(f"  [UPDATED] {u_data['role']:<12}: {u_data['email']}")
            else:
                user = User(
                    email=u_data["email"],
                    password_hash=get_password_hash(u_data["password"]),
                    full_name=u_data["full_name"],
                    role=u_data["role"],
                    is_active=True
                )
                db.add(user)
                created_count += 1
                print(f"  [CREATED] {u_data['role']:<12}: {u_data['email']}")

        db.commit()
        print(f"[SEED COMPLETED] {created_count} users created, {updated_count} users refreshed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()
