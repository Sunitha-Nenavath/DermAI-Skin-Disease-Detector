# ==============================================================================
# DermAI Backend API Dockerfile (Python 3.11 Slim)
# Regulatory & Clinical Notice: AI-assisted analysis, not a standalone medical diagnosis.
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy source code, configs, and scripts
COPY backend/ /app/backend/
COPY ml/ /app/ml/
COPY configs/ /app/configs/
COPY scripts/ /app/scripts/

# Create persistent storage directories
RUN mkdir -p /app/backend/storage /app/models /app/data

ENV PYTHONPATH="/app"
ENV STORAGE_BACKEND="local"
ENV LOCAL_STORAGE_DIR="/app/backend/storage"

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
