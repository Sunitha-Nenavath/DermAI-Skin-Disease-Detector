"""
backend/main.py
FastAPI application entry point for DermAI.
"""

from datetime import datetime
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import engine, Base
from backend.models import *  # ensure all models are registered
from backend.routers import auth, users, cases, images

# Create tables automatically for SQLite/Postgres
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "DermAI: AI-assisted dermatological screening and skin lesion analysis platform. "
        "Regulatory & Clinical Notice: AI-assisted analysis, not a standalone medical diagnosis."
    ),
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for Web Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_medical_notice_header(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-DermAI-Notice"] = settings.MEDICAL_DISCLAIMER
    return response


# Health check endpoint
@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "dermai-api",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "storage_backend": settings.STORAGE_BACKEND,
        "medical_disclaimer": settings.MEDICAL_DISCLAIMER,
    }


# Include modular routers under /api and root
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(images.router, prefix="/api")

# Also include at root for direct /auth, /cases, /images path access
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cases.router)
app.include_router(images.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
