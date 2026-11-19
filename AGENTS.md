# AGENTS.md — DermAI Development Directives & Protocol

## 1. Non-Negotiable Medical & Regulatory Positioning
- **Screening & Decision-Support Only:** DermAI is strictly a screening, research, and clinical decision-support tool, **NOT** an autonomous diagnostic system.
- **Mandatory Medical Disclaimer:** Every prediction screen, API response (field `disclaimer`), PDF report, notification, and web footer **MUST** explicitly state:
  > **"AI-assisted analysis, not a standalone medical diagnosis."**
- **Zero Real Patient Data:** Real patient data and PII are strictly prohibited. Use only public, de-identified datasets (HAM10000, ISIC 2018).

---

## 2. Operating Rules
1. **Work ONE PHASE AT A TIME:**
   - Start each phase with a short plan and task list.
   - At the end of each phase, run the phase gate, print real results, update `docs/PROGRESS.md`, commit to Git, then **STOP and wait for the user to say 'continue'** before proceeding to the next phase.
   - This saves quota and enables clean cross-session resumption.
2. **docs/PROGRESS.md is Project Memory:**
   - Contains a table of phases with status (todo, in progress, done), what was built, how to run it, known issues, and the exact next step.
   - Must be read first in every new session.
3. **Zero Metric Invention:**
   - Never invent metrics, results, datasets, accuracy numbers, or screenshots.
   - If a model is not yet trained, the application MUST display `"No trained model available"` and MUST NOT show placeholder predictions.
4. **Explicit Blockers:**
   - If credentials, a dataset download, a GPU, or a user decision is required, **STOP** and inform the user with exact steps.
5. **Code Quality & Explainability for Viva:**
   - Python 3.11/3.13 with type hints, modular structure, pytest tests for every module.
   - Configuration in YAML or `.env`, zero secrets in Git, clean documentation.
   - Keep design simple and clear enough for an internship viva defense.
6. **Smallest Working Change:**
   - Prefer the smallest change that works. Do not rewrite working code.
   - In responses, summarize concisely and show diffs only.

---

## 3. Technology Stack
- **Backend:** Python, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, PostgreSQL 16 (SQLite for rapid local dev), Redis (optional), ReportLab (PDF reporting).
- **Authentication & Security:** OAuth2 password flow, JWT access & refresh tokens, `argon2` password hashing, role-based access control (RBAC) with 5 roles: `patient`, `clinician`, `researcher`, `ml_engineer`, `admin`.
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons (PWA mobile-first). Optional Expo React Native later.
- **Machine Learning & CV:** PyTorch, `timm`, `segmentation_models_pytorch`, `albumentations`, OpenCV, `scikit-image`, `scikit-learn`, `pytorch-grad-cam`, `Captum`, MLflow.
- **Storage:** Local filesystem (`STORAGE_BACKEND=local`), MinIO / AWS S3 option.
- **Infrastructure & Testing:** Docker & Docker Compose, GitHub Actions, `pytest`, Playwright.

**Model Training Strategy:**
All classification and segmentation scripts are designed to run on Kaggle or Colab with one command and YAML config, and include a `--smoke` flag (200 images, 1 epoch, CPU) so the entire pipeline can be automated and tested locally.

---

## 4. Repository Layout
```
Derm AI/
├── backend/            # FastAPI REST backend, database models, auth, routers
├── ml/                 # CV preprocessing, segmentation, classification, explainability, notebooks, configs
│   ├── configs/        # Training & risk map YAML configurations
│   ├── notebooks/      # Exploratory data analysis (01_eda.ipynb)
│   └── preprocessing/  # DullRazor hair removal, CLAHE, standardization pipeline
├── src/ (or web/)      # React + Vite + TypeScript PWA frontend
├── data/               # Git-ignored raw datasets (HAM10000, ISIC 2018) and splits
├── models/             # Git-ignored model weights (*.pt, *.onnx)
├── reports/            # Evaluation markdown reports and figures
├── docs/               # System documentation, PROGRESS.md, AUDIT.md, specs
├── scripts/            # Split generation, dataset seeds, demo data
└── tests/              # Pytest test suites (unit, integration, regression)
```

---

## 5. Standard Commands
- **Environment Setup:**
  `make setup` or `pip install -r backend/requirements.txt`
- **Run Backend API:**
  `make run-api` or `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`
- **Run Frontend Web:**
  `make run-web` or `npm run dev`
- **Run Tests:**
  `make test` or `python -m pytest tests/ -v`
- **Smoke Training (CPU, 200 samples, 1 epoch):**
  `python ml/train.py --smoke`
- **Docker Compose:**
  `docker compose up -d --build`
