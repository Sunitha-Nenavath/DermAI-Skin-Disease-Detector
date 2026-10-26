"""
DermAI — scripts/seed.py
Creates one demo user per role for development/demo purposes.
Passwords are read from environment variables — never hardcoded.

Usage:
    cd backend
    python ../scripts/seed.py

Requires DATABASE_URL to be set in environment or .env file.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.future import select

from app.core.security import hash_password
from app.core.database import Base
from app.models.models import User

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://dermai_user:change_me_in_production@localhost:5432/dermai",
)

DEMO_USERS = [
    {
        "email": os.environ.get("SEED_ADMIN_EMAIL", "admin@dermai.local"),
        "password": os.environ.get("SEED_ADMIN_PASSWORD", "Admin@DermAI2024"),
        "full_name": "Admin User",
        "role": "admin",
    },
    {
        "email": os.environ.get("SEED_CLINICIAN_EMAIL", "clinician@dermai.local"),
        "password": os.environ.get("SEED_CLINICIAN_PASSWORD", "Clinician@DermAI2024"),
        "full_name": "Dr. Jane Clinician",
        "role": "clinician",
    },
    {
        "email": os.environ.get("SEED_PATIENT_EMAIL", "patient@dermai.local"),
        "password": os.environ.get("SEED_PATIENT_PASSWORD", "Patient@DermAI2024"),
        "full_name": "Demo Patient",
        "role": "patient",
    },
    {
        "email": os.environ.get("SEED_RESEARCHER_EMAIL", "researcher@dermai.local"),
        "password": os.environ.get("SEED_RESEARCHER_PASSWORD", "Researcher@DermAI2024"),
        "full_name": "Dr. Research",
        "role": "researcher",
    },
    {
        "email": os.environ.get("SEED_ML_EMAIL", "mlengineer@dermai.local"),
        "password": os.environ.get("SEED_ML_PASSWORD", "MLEngineer@DermAI2024"),
        "full_name": "ML Engineer",
        "role": "ml_engineer",
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        print("Seeding demo users...")
        created = 0
        for user_data in DEMO_USERS:
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  [SKIP] {user_data['email']} already exists (role: {existing.role})")
                continue

            user = User(
                email=user_data["email"],
                password_hash=hash_password(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                is_active=True,
            )
            session.add(user)
            print(f"  [CREATE] {user_data['email']} — role: {user_data['role']}")
            created += 1

        await session.commit()
        print(f"\nDone. Created {created} new user(s).")
        print("\nDemo Credentials (change before production!):")
        for u in DEMO_USERS:
            print(f"  {u['role']:<15} {u['email']:<35} password: {u['password']}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
