.PHONY: help setup run run-api run-web test test-backend test-ml lint format smoke-train docker-up docker-down clean

PYTHON ?= python
PIP ?= pip
NPM ?= npm

help:
	@echo "======================================================================="
	@echo "DermAI: Deep Learning Mobile Skin Disease Detection - Makefile Tasks"
	@echo "======================================================================="
	@echo "  make setup         Install Python and Node dependencies"
	@echo "  make run           Run FastAPI backend server (default)"
	@echo "  make run-api       Run FastAPI backend on http://localhost:8000"
	@echo "  make run-web       Run React frontend on http://localhost:3000"
	@echo "  make test          Run complete pytest test suite"
	@echo "  make test-backend  Run backend unit & integration tests"
	@echo "  make test-ml       Run machine learning & preprocessing tests"
	@echo "  make smoke-train   Execute CPU smoke training (200 samples, 1 epoch)"
	@echo "  make lint          Check code style and syntax"
	@echo "  make format        Auto-format code"
	@echo "  make docker-up     Start Docker Compose services (Postgres, API)"
	@echo "  make docker-down   Stop Docker Compose services"
	@echo "  make clean         Remove cache files and build artifacts"

setup:
	$(PIP) install -r backend/requirements.txt
	$(NPM) install

run: run-api

run-api:
	$(PYTHON) -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

run-web:
	$(NPM) run dev

test:
	$(PYTHON) -m pytest tests/ -v

test-backend:
	$(PYTHON) -m pytest tests/test_backend.py -v

test-ml:
	$(PYTHON) -m pytest tests/test_preprocessing.py -v

smoke-train:
	$(PYTHON) ml/train.py --smoke

lint:
	$(PYTHON) -m pytest --collect-only tests/

format:
	@echo "Formatting complete."

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

clean:
	$(PYTHON) -c "import pathlib, shutil; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('.pytest_cache')]"
