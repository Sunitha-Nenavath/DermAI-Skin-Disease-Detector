# DermAI Project Audit & Specification Traceability Matrix

**Project:** DermAI: Skin Disease Detector from Mobile Images Using Deep Learning  
**Internship:** Infosys Springboard  
**Source of Truth:** docs/DermAI_spec.pdf (19 Modules, 4 Milestones)  
**Date of Audit:** November 19, 2026  
**Auditor:** Senior Full-Stack & ML Engineering Pair  

---

## 1. Executive Summary & Non-Negotiable Positioning

> [!IMPORTANT]
> **Clinical & Regulatory Positioning:**  
> DermAI is strictly a **screening, research, and clinical decision-support tool**, **NOT** an autonomous diagnostic system.  
> Every prediction screen, API response (field disclaimer), PDF report, notification, and footer **MUST** display:  
> **'AI-assisted analysis, not a standalone medical diagnosis.'**  
> Real patient data and PII are prohibited; only public or de-identified datasets (HAM10000, ISIC 2018) are used.

An exhaustive audit of the workspace reveals that a substantial foundation of code was previously scaffolded across backend/ (FastAPI), src/ (React + TypeScript + Tailwind CSS PWA), ml/ (OpenCV preprocessing and initial PyTorch training script), and docs/. 

Rather than rebuilding from scratch, **we strongly recommend keeping and incrementally refining this foundation**. The existing codebase contains high-quality OpenCV computer vision pipelines, clinical validation schemas, and rich responsive UI views that map directly to the 19 specification modules. What is primarily needed is completing the core ML modules (U-Net lesion segmentation, multi-model training with --smoke support, calibrated risk scoring, real Grad-CAM explainability), adding backend ReportLab PDF generation, unifying authentication with argon2, and establishing rigorous test coverage.

---

## 2. Specification Traceability Matrix (19 Modules)

| # | Spec Module Name | Spec Milestone | Workspace Status | Existing Files / Code | Missing / Deficient Items | Recommendation |
|---|---|---|---|---|---|---|
| **1** | **User Authentication & Role-Based Access** | M1 | **Partial** | backend/routers/auth.py, backend/auth.py, src/context/AuthContext.tsx | Uses bcrypt instead of argon2; missing refresh token flow; dual Firebase/backend auth in UI | **Keep & Refine** (Migrate to argon2, add refresh tokens, clean up frontend auth) |
| **2** | **Patient & Case Management** | M1 | **Done** | backend/models.py, backend/routers/cases.py, src/pages/CasesListPage.tsx, src/pages/CaseDetailPage.tsx | Minor: Alembic migrations need formalization | **Keep** (De-identified schema & patient isolation work well) |
| **3** | **Mobile Image Capture & Upload Module** | M1 | **Done** | src/components/ImageCaptureWorkflow.tsx, backend/routers/images.py, backend/storage.py | None; handles camera guide frame, canvas crop/rotate, EXIF orientation, size/format validation | **Keep** |
| **4** | **Skin Image Preprocessing Engine** | M1/M2 | **Done** | ml/preprocessing/pipeline.py, backend/routers/images.py | None; DullRazor hair removal, CLAHE on L-channel in LAB, center-crop, 224x224 resize, ImageNet normalization all implemented | **Keep** |
| **5** | **Skin Lesion Detection & Segmentation Engine** | M2 | **Partial** | src/services/segmentation.ts, heuristic Otsu fallback in ml/serve.py | Missing trained U-Net (ResNet-34 encoder) PyTorch model, training script ml/train_segmentation.py, Dice/IoU/Hausdorff evaluation | **Complete / Rebuild ML Part** (Keep Otsu fallback; train U-Net on ISIC 2018 Task 1) |
| **6** | **Skin Disease Classification Engine** | M2 | **Partial** | ml/train.py, ml/serve.py | Training script exists, but no trained weights in models/, no MLflow tracking, no automated multi-model baseline comparison | **Enhance** (Add --smoke flag, YAML configs, MLflow, train 4 baselines on Kaggle) |
| **7** | **Advanced Deep Learning Intelligence Engine** | M3 | **Missing** | Argument stubs in ml/train.py | Swin Transformer, ViT, DeiT training, 2-model ensemble, temperature scaling calibration not yet implemented | **Build New in Phase 5** |
| **8** | **Skin Disease Severity & Risk Assessment Module** | M3 | **Partial** | ml/serve.py (DEFAULT_RISK_MAP), src/components/ClassificationResultView.tsx | Needs standalone configs/risk_map.yaml protocol; formalize low-confidence 'Requires Clinical Review' rule | **Keep & Refine** (Extract protocol into YAML, bind to calibrated confidence) |
| **9** | **Explainable AI Module** | M3 | **Partial** | src/components/ExplainableAIView.tsx, OpenCV heatmaps in ml/serve.py | Real PyTorch Grad-CAM/Grad-CAM++, Captum saliency, and heatmap-lesion mask overlap metric missing | **Complete in Phase 5** (Keep UI overlay slider; add real PyTorch Grad-CAM engine) |
| **10** | **AI Model Training & Evaluation Module** | M1/M2 | **Partial** | scripts/make_splits.py, data/splits/split_summary.json, ml/notebooks/01_eda.ipynb | Missing automated test verifying zero lesion_id leakage across splits; need Kaggle runbook | **Keep & Refine** (Add leakage test, verify 70/15/15 splits) |
| **11** | **Image Quality Evaluation Module** | M1/M2 | **Done** | ml/preprocessing/pipeline.py (assess_quality), src/components/QualityBadge.tsx, backend/routers/images.py | None; checks Laplacian blur, brightness, contrast, resolution with actionable retake reasons | **Keep** |
| **12** | **Classification Evaluation Module** | M2 | **Partial** | Metric formulas in ml/train.py, src/pages/EvaluationPage.tsx | reports/model_comparison.md not yet generated; confusion matrix images need generation | **Complete in Phase 4** |
| **13** | **Visualization & Analysis Dashboard** | M4 | **Done** | src/pages/DashboardPage.tsx, src/pages/AdminConsolePage.tsx | None; role-tailored dashboards for Patient, Clinician, and Admin with Recharts analytics | **Keep** |
| **14** | **Medical Image Analysis Screen** | M3/M4 | **Done** | src/pages/CaseDetailPage.tsx, src/components/ClassificationResultView.tsx | None; displays original, preprocessed, mask, heatmap overlay, top-3 predictions, risk tag, disclaimer | **Keep** |
| **15** | **Report Generation System** | M4 | **Partial** | src/services/reportService.ts (client-side export) | Backend ReportLab PDF generator (backend/routers/reports.py) missing; PDF export currently browser print | **Complete in Phase 8** (Add server-side ReportLab PDF generation) |
| **16** | **Prediction History & Follow-Up Module** | M4 | **Done** | src/components/CaseHistoryFollowUp.tsx, backend/routers/cases.py | None; side-by-side comparative inspection, date filtering, and longitudinal tracking present | **Keep** |
| **17** | **Notification & Alert System** | M4 | **Partial** | src/components/NotificationCenter.tsx, src/services/notificationService.ts | Backend notification table and automated API event triggers missing | **Complete in Phase 8** (Add Notification model & API) |
| **18** | **Model Management & Versioning** | M4 | **Partial** | src/pages/ModelManagementPage.tsx, ml/serve.py version maps | Database model registry table missing; need strict 'No trained model available' fallback | **Complete in Phase 6** (Add database model registry) |
| **19** | **Final Integration, Testing & Deployment** | M4 | **Partial** | docker-compose.yml, tests/test_backend.py | Missing GitHub Actions CI, Playwright e2e tests, Prometheus/logging, broken test import | **Complete in Phases 9 & 10** |

---

## 3. Detailed Component Breakdown & Findings

### 3.1 Backend (backend/)
- **Framework:** FastAPI with modular routers (auth, users, cases, images).
- **Database:** SQLAlchemy 2 with SQLite (local) and PostgreSQL support.
- **Models:** User, Patient, Case, Image, Analysis, AuditLog.
- **Strengths:** 
  - De-identified patient models adhere strictly to privacy guidelines (no real names or PII).
  - Explicit role-based case isolation (patients see only their cases; clinicians see assigned/all cases).
  - Strict upload validation (image format, size <= 10MB, min resolution 224x224, EXIF rotation).
  - Middleware injects medical disclaimer header X-DermAI-Notice into all HTTP responses.
- **Issues to Fix:**
  - backend/auth.py imports bcrypt (which fails in current environment); spec calls for **argon2 hashing**.
  - Refresh tokens and token revocation are missing.
  - Missing database tables for ModelRegistry (Module 18) and Notification (Module 17).
  - Alembic migrations folder needs initialization and tracking.

### 3.2 Machine Learning & Computer Vision (ml/)
- **Preprocessing:** ml/preprocessing/pipeline.py is exceptionally well-written. It implements:
  - Laplacian variance blur detection.
  - Mean gray luminance / exposure detection.
  - Standard deviation contrast check.
  - DullRazor hair removal via morphological blackhat filtering and fast inpainting.
  - Contrast Limited Adaptive Histogram Equalization (CLAHE) on the L-channel in LAB space.
  - Center-square cropping and ImageNet standardization.
- **Training Script (ml/train.py):**
  - Uses timm architectures and StratifiedGroupKFold on lesion_id to prevent data leakage.
  - Computes class weights for HAM10000 imbalance.
  - Missing: --smoke flag (200 images, 1 epoch, CPU), MLflow experiment logging, YAML configuration loader.
- **Inference Service (ml/serve.py):**
  - FastAPI service contract mapping model checkpoints to /predict.
  - When models are missing, currently generates synthetic heatmaps; must be updated to return strict 'No trained model available' state without placeholder predictions.

### 3.3 Frontend (src/)
- **Stack:** React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, Recharts.
- **Architecture:** Progressive Web App (PWA) with camera guide overlay, gallery upload, image rotation, and crop.
- **Views:** Comprehensive pages for Login, Register, Dashboard (Patient/Clinician/Admin), Cases List, Case Detail, New Case, Model Management, Evaluation, and Presentation.
- **Strengths:** 
  - Medical disclaimers and clinical notices are prominently featured across every single page and component (src/components/ClinicalNotice.tsx).
  - Interactive multi-layer explainability slider (Original vs Preprocessed vs Mask vs Grad-CAM heatmap).
  - Side-by-side longitudinal case history comparison.
- **Issues to Fix:**
  - Remove Firebase Auth dependency to unify directly with the FastAPI backend JWT tokens.

---

## 4. Key Recommendations & Action Plan

### Recommended Strategy: Keep & Incrementally Refine
1. **Preserve working code:** Do not scrap the frontend UI or OpenCV preprocessing pipeline. They represent solid, working implementations that directly fulfill modules 2, 3, 4, 11, 13, 14, and 16.
2. **Execute Phase 1 (Foundation):**
   - Unify backend password hashing to argon2.
   - Add refresh token flow and Alembic migrations.
   - Add Notification and ModelRegistry database models.
   - Fix pytest suite so make test runs 100% green.
3. **Execute Phase 2 (Data & Splits):**
   - Write automated unit test verifying 0% lesion overlap across HAM10000 splits.
   - Document the Kaggle dataset download and runbook.
4. **Execute Phase 3 (Lesion Segmentation):**
   - Implement U-Net training script on ISIC 2018 Task 1 with --smoke support.
5. **Execute Phase 4 & 5 (Classification & Explainability):**
   - Add --smoke execution for ResNet50, DenseNet121, EfficientNet-B0, and MobileNetV3.
   - Implement calibrated risk mapping via configs/risk_map.yaml.
   - Integrate PyTorch Grad-CAM / Captum with mask-overlap metrics.

---

## 5. Decision Gate

> [!IMPORTANT]
> **Awaiting User Decision:**  
> Please confirm if you approve the recommendation to **KEEP AND REFINE** the existing codebase along the 10-phase roadmap, or if you prefer an alternative approach.  
> Once you confirm, we will proceed to Phase 1.
