"""
DermAI Backend — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth_router, cases_router, images_router, users_router
from app.schemas.schemas import HealthResponse

settings = get_settings()

app = FastAPI(
    title="DermAI API",
    description=(
        "DermAI: Skin Disease Detector from Mobile Images Using Deep Learning.\n\n"
        "⚠️ **AI-assisted analysis, not a standalone medical diagnosis.**"
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(cases_router)
app.include_router(images_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Health check",
)
async def health() -> HealthResponse:
    """Returns service health status. Used by Docker healthcheck."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.app_env,
    )


@app.get("/", tags=["System"], include_in_schema=False)
async def root() -> dict:
    return {
        "message": "DermAI API is running.",
        "notice": "AI-assisted analysis, not a standalone medical diagnosis.",
        "docs": "/docs",
        "health": "/health",
    }
