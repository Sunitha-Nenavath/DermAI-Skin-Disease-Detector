#!/bin/sh
set -e

echo "🔄 Running database migrations..."
alembic upgrade head

echo "🚀 Starting FastAPI backend on port 8000..."
uvicorn app.main:app --host 127.0.0.1 --port 8000 &

echo "🌐 Starting Nginx on port 80..."
nginx -g "daemon off;"
