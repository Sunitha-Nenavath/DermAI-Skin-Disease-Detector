# DermAI — Project Objectives & Workflow

> ⚠️ **AI-assisted analysis, not a standalone medical diagnosis.**

---

## 1. Problem Statement

Skin diseases affect over 900 million people worldwide, yet access to dermatology specialists
remains limited, especially in rural and resource-poor settings. Early detection of malignant
lesions (melanoma, basal cell carcinoma) drastically improves prognosis.

**DermAI** provides a mobile-first, AI-assisted screening tool that:
- Accepts standard smartphone photos of skin lesions
- Performs automated image quality checking before upload
- Runs a deep-learning classification pipeline (7 HAM10000 classes)
- Delivers interpretable results with explainability (Grad-CAM) to clinicians
- Maintains a de-identified, audited patient record system

---

## 2. Target Users

| Role | Typical User | Access Level |
|------|-------------|--------------|
| **Patient** | Adult with a skin concern; uses mobile web | Own cases only |
| **Clinician** | Dermatologist, GP, nurse | All cases; adds clinical notes |
| **Researcher** | Academic studying skin disease epidemiology | De-identified read-only data |
| **ML Engineer** | Internal team; model tuning and monitoring | Preprocessing API; model stats |
| **Admin** | System operator | Full access; user management; audit logs |

---

## 3. End-to-End Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DermAI — End-to-End Flow                             │
└──────────────────────────────────────────────────────────────────────────────┘

  [Patient / Clinician]
        │
        ▼
  📱 Mobile Camera / Gallery
        │
        ▼
  ┌─────────────────────┐
  │  1. Capture Image   │  ← Smartphone camera or gallery
  └─────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────┐
  │  2. Client-Side Quality Preview     │  ← Resolution & format check (JS)
  └─────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────┐
  │  3. User Confirms   │  ← "Upload this image?" modal
  └─────────────────────┘
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  4. Upload to Backend (POST /cases/{id}/images)      │
  │     • Format validation (JPG/PNG, ≤10MB)             │
  │     • Minimum resolution 224×224                     │
  │     • EXIF orientation fix                           │
  │     • Quality metrics: blur, brightness, contrast    │
  │     • Label: Good / Acceptable / Poor                │
  │     • Poor → reject with retake message              │
  └──────────────────────────────────────────────────────┘
        │
        ▼
  ┌────────────────────────────────┐
  │  5. Preprocessing Pipeline     │  ← (ml/preprocessing/pipeline.py)
  │     • Crop / ROI placeholder   │
  │     • Resize → 224×224         │
  │     • CLAHE contrast enhance   │
  │     • Hair removal (optional)  │
  │     • ImageNet normalization   │
  └────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │  6. AI Analysis  [DEFERRED — Milestone 2+]  │
  │     • CNN / ViT classification (7 classes)  │
  │     • Grad-CAM heatmap                      │
  │     • Confidence scores + report            │
  └─────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │  7. Clinician Review  [DEFERRED]            │
  │     • Accept / Reject AI prediction         │
  │     • Annotate; generate PDF report         │
  └─────────────────────────────────────────────┘
```

---

## 4. Milestone 1 Scope — "Project Initialization, Dataset and Core Setup"

### ✅ Done in Milestone 1

| # | Deliverable |
|---|-------------|
| 1 | Project objectives and workflow (this document) |
| 2 | HAM10000 dataset EDA notebook + class-weight computation + train/val/test splits |
| 3 | System architecture diagram (Mermaid) + Database ER diagram |
| 4 | UI wireframes HTML (Login, Register, Dashboard, Cases, Upload, Detail) |
| 5 | Monorepo scaffold + Docker Compose (api + PostgreSQL 16) + README |
| 6 | FastAPI backend: authentication (JWT + bcrypt), RBAC, audit logging, Alembic migrations |
| 7 | Case management API + image upload with quality check (blur/brightness/contrast) |
| 8 | Preprocessing pipeline (validation → crop → resize → CLAHE → normalize) + pytest tests |
| 9 | React + TypeScript + Tailwind frontend (all pages, drag-drop upload, quality badge) |
| 10 | Tests pass, demo data script, milestone report |

### 🔜 Deferred to Later Milestones

| Milestone | Feature |
|-----------|---------|
| M2 | CNN / ViT model training on HAM10000 |
| M2 | Segmentation model (SAM / U-Net) |
| M3 | Grad-CAM explainability overlay |
| M3 | Clinical PDF report generation |
| M4 | PAD-UFES-20 and SCIN phone-photo dataset integration |
| M4 | Active learning / continual retraining loop |
| M5 | Production cloud deployment, SSL, load balancer |

---

## 5. Key Design Principles

1. **Privacy first** — No real patient data ever used in development. De-identified records only.
2. **Mobile-first** — UI optimized for smartphone screens (min-width 360px).
3. **Quality gate** — Poor images are rejected at upload time with a retake message.
4. **Auditability** — Every write action is logged to `audit_logs` with user, action, IP, timestamp.
5. **Transparency** — Every user-facing screen displays: *"AI-assisted analysis, not a standalone medical diagnosis."*
6. **Explainability** — Grad-CAM heatmaps (M3) will make model decisions interpretable to clinicians.
7. **No vendor lock-in** — Storage abstracted (`local` or `MinIO`); swap without code changes.
