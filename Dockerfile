# ── Stage 1: Build the React/Vite Frontend ────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

# Install dependencies
COPY package.json bun.lock* ./
RUN npm install

# Copy source and build
COPY index.html tsconfig.json vite.config.ts ./
COPY src/ ./src/
COPY public/ ./public/

# Build with production API URL injected at build time
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: Python Backend + Serve Frontend ──────────────────────────────────
FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend into nginx html dir
COPY --from=frontend-build /frontend/dist /var/www/html

# Copy nginx config
COPY nginx.conf /etc/nginx/sites-available/default

# Create storage directory
RUN mkdir -p /app/storage

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
