.PHONY: help setup dataset test seed run-api run-web docker-up docker-down clean

PYTHON ?= python3
PIP ?= /root/.local/bin/pip

help:
	@echo "DermAI: Milestone 1 Management Tasks"
	@echo "  make setup       Install python & npm dependencies"
	@echo "  make dataset     Generate HAM10000 splits and benchmark samples"
	@echo "  make seed        Seed initial users for all roles"
	@echo "  make test        Execute backend & preprocessing unit tests"
	@echo "  make run-api     Launch FastAPI backend on http://localhost:8000"
	@echo "  make run-web     Launch React frontend on http://localhost:3000"
	@echo "  make docker-up   Start Postgres and API via Docker Compose"
	@echo "  make docker-down Stop Docker containers"
	@echo "  make clean       Remove temporary caches and build artifacts"

setup:
	@echo "[SETUP] Installing Python requirements..."
	$(PIP) install -r backend/requirements.txt
	@echo "[SETUP] Installing Node.js requirements..."
	npm install

dataset:
	@echo "[DATASET] Running leakage-free grouped stratification..."
	$(PYTHON) scripts/make_splits.py
	@echo "[DATASET] Preparing benchmark samples..."
	$(PYTHON) scripts/prepare_sample_images.py

seed:
	@echo "[SEED] Populating database with role-based demo accounts..."
	$(PYTHON) scripts/seed.py

test:
	@echo "[TEST] Running test suite..."
	$(PYTHON) -m pytest tests/ -v

run-api:
	@echo "[API] Starting FastAPI on 0.0.0.0:8000..."
	$(PYTHON) -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

run-web:
	@echo "[WEB] Starting Vite dev server..."
	npm run dev

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
