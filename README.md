# DermAI: Skin Disease Detector from Mobile Images Using Deep Learning

> **Mandatory Clinical & Regulatory Notice**: **"AI-assisted analysis, not a standalone medical diagnosis."**  
> DermAI is an AI-assisted screening, research, and clinical decision-support tool, **NOT** an autonomous diagnostic system. In-person clinical evaluation by a licensed medical provider is mandatory. Zero real patient data is used; only public, de-identified datasets (HAM10000, ISIC 2018) are supported.

---

## 1. System Architecture

DermAI is built following the 19-module clinical specification from `docs/DermAI_spec.pdf`:

- **Backend API (FastAPI + SQLAlchemy 2 + Pydantic v2)**:
  - **Authentication & RBAC**: Argon2 password hashing, JWT access & refresh tokens, role-based access control for 5 roles: `patient`, `clinician`, `researcher`, `ml_engineer`, `admin`.
  - **Clinical Case & Patient Management**: Strictly de-identified patient metadata, role-isolated case workflows, clinical progress notes, and audit logs.
  - **Image Quality Gate & CV Preprocessing**: Laplacian focus blur assessment, brightness/contrast validation, OpenCV DullRazor hair removal artifact reduction, CLAHE contrast enhancement, and standardized 224x224 tensor normalization.
  - **Computer Vision & Inference Service**: Classical Otsu lesion segmentation, PyTorch `efficientnet_b0` classifier, Grad-CAM++ visual interpretability heatmaps, and `configs/risk_map.yaml` calibrated risk tiers.
  - **Reporting & Notifications**: Server-side ReportLab clinical PDF generation, JSON/CSV exports, and in-app screening notifications.
- **Frontend PWA (React + Vite + TypeScript + Tailwind CSS)**:
  - Mobile-first responsive Progressive Web App with camera intake workflow, interactive lesion segmentation view, classification confidence distribution, Grad-CAM++ saliency overlays, model management registry, and longitudinal case history.

---

## 2. Seeded Demo Accounts (Password: Argon2 Hashed)

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Clinician** | `clinician@dermai.local` | `ClinicianDoctor123!` | Case registry, review, photo intake, AI screening, clinical notes, PDF export |
| **Patient** | `patient@dermai.local` | `PatientSecure123!` | Self-case submission, own case history, photo intake |
| **Researcher** | `researcher@dermai.local` | `ResearchScience123!` | Cohort-wide de-identified analytical access, EDA viewer |
| **ML Engineer** | `ml_engineer@dermai.local` | `MLEngineerModel123!` | Model registry, risk threshold tuning, evaluation matrix |
| **Admin** | `admin@dermai.local` | `AdminSuperUser123!` | User management, audit logs, administrative privileges |

---

## 3. Quick Start & Execution

### Prerequisites
- Python 3.11+ or 3.13+
- Node.js v18+ and npm

### Backend Setup & Launch
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Seed demo user accounts
python scripts/seed.py

# 3. Launch FastAPI backend server (Port 8000)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### Frontend PWA Setup & Launch
```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Start Vite development server (Port 3000)
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

### Run Test Suite
```bash
# Run all 13 unit, integration, and contract tests
python -m pytest tests/ -v
```

---

## 4. Model Training Pipeline
```bash
# Local smoke test (200 samples, 1 epoch, CPU):
python ml/train.py --arch efficientnet_b0 --smoke

# Evaluate model metrics and generate comparison report:
python ml/evaluate.py
```

---

## 5. Planned Work (Deferred Items)

The following items from the 19-module specification are planned for subsequent milestones:
1. **U-Net Deep Lesion Segmentation (Module 7)**: Training a dedicated U-Net / Attention U-Net on ISIC 2018 lesion masks to complement the classical Otsu segmentation pipeline.
2. **Vision Transformer & Multi-Model Ensemble (Module 9)**: Training ViT-B/16, Swin Transformer, and DeiT checkpoints with weighted rank averaging ensemble.
3. **Cross-Platform Mobile App with Expo (Module 15)**: Standalone native React Native / Expo application for iOS and Android.
4. **End-to-End Automated Testing (Module 17)**: Full Playwright browser regression test suite across desktop and mobile viewports.
5. **Distributed Load & Stress Testing (Module 18)**: Locust headless stress test benchmark simulating 200+ concurrent clinicians.
6. **Production Cloud Deployment & Infrastructure (Module 19)**: Terraform AWS EKS / ECS deployment with RDS PostgreSQL 16 and MinIO S3 object storage.
7. **Clinical Observability Stack (Module 19)**: Prometheus metrics collection, Grafana dashboards, and Alertmanager routing for inference latency and drift monitoring.
