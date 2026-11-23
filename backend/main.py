"""
backend/main.py
FastAPI application entry point for DermAI.
"""

from datetime import datetime
from fastapi import FastAPI, Request, Response, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import engine, Base
from backend.models import *  # ensure all models are registered
from backend.routers import auth, users, cases, images, models, reports, notifications

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
    from backend.ml_service import ml_engine
    loaded_models = []
    if ml_engine.model is not None:
        loaded_models.append("v1.0-efficientnet_b0")
    return {
        "status": "ok",
        "service": "dermai-api",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "storage_backend": settings.STORAGE_BACKEND,
        "loaded_models": loaded_models,
        "model_loaded": ml_engine.model is not None,
        "medical_disclaimer": settings.MEDICAL_DISCLAIMER,
    }


# Direct predict endpoint for frontend/proxy compatibility
@app.post("/predict")
async def root_predict(image: UploadFile = File(...)):
    from backend.ml_service import ml_engine
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    return ml_engine.analyze_image_bytes(image_bytes)


# Include modular routers under /api and root
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(models.ml_router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

# Also include at root for direct /auth, /cases, /images path access
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cases.router)
app.include_router(images.router)
app.include_router(models.router)
app.include_router(models.ml_router)
app.include_router(reports.router)
app.include_router(notifications.router)




if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
