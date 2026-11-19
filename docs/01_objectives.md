# DermAI: Skin Disease Detector from Mobile Images Using Deep Learning
## Milestone 1: Project Objectives and Workflow Architecture

> **Regulatory & Clinical Notice**: AI-assisted analysis, not a standalone medical diagnosis. DermAI is intended for clinical decision support, triage, screening, and research assistance. It does not replace professional clinical judgment or histopathological confirmation.

---

### 1. Executive Summary & Project Objectives

DermAI is an AI-powered dermatological analysis system engineered to bridge the clinical gap between consumer mobile image acquisition and deep learning diagnostic assistance. DermAI provides an accessible, standardized pipeline for acquiring, validating, preprocessing, and analyzing skin lesions.

#### Core Objectives:
1. **Standardized Mobile Image Acquisition**: Enable patient and clinician image capture on mobile and web clients with immediate image fidelity evaluation.
2. **Automated Pre-Analysis Quality Gate**: Screen out blurry, under/over-exposed, low-contrast, or insufficient resolution photos before model inference, instructing users on recaptures.
3. **Robust Preprocessing Pipeline**: Standardize varied smartphone photography via hair reduction, contrast adaptive histogram equalization (CLAHE), color calibration, and normalized tensor formatting.
4. **Multi-Class Disease Classification & Segmentation** *(Milestones 2–3)*: Accurate classification across 7 target skin conditions using transfer learning (CNNs and Vision Transformers) with uncertainty estimation.
5. **Explainable AI (XAI)** *(Milestones 3–4)*: Transparent Grad-CAM/attention heatmaps and audit trails for clinical decision support.
6. **Enterprise Security & Role-Based Governance**: Strict isolation, de-identified patient records, HIPAA/GDPR-aligned role separation, and comprehensive audit logging.

---

### 2. Target User Personas & Permissions

| Role | Persona Definition | Key Workflow in DermAI | Milestone 1 Scope |
| :--- | :--- | :--- | :--- |
| **Patient / General User** | Individual monitoring skin spots or seeking preliminary screening guidance. | Submits skin lesion images, fills non-identifiable questionnaire, views own case history and educational explanations. | Create case, upload images, view own cases, run quality assessment. |
| **Clinician / Dermatologist** | Healthcare professional reviewing cases and prioritizing appointments. | Accesses full patient case lists, inspects original vs. preprocessed images, reviews quality metrics, appends clinical notes. | Access all cases, filter by status/date, inspect image quality, add clinical notes. |
| **Medical Researcher** | Academic or clinical investigator analyzing epidemiological or dataset trends. | Queries de-identified cohort statistics, compares disease distribution, evaluates quality rejection rates. | Access de-identified cases, inspect dataset EDA, view quality analytics. |
| **Data Scientist / ML Engineer** | Model builder developing preprocessing, segmentation, and classification models. | Analyzes class balance, builds training/val/test splits, tests preprocessing algorithms, inspects raw tensor outputs. | Access dataset splits, run EDA notebooks, verify preprocessing pipeline and quality metrics. |
| **Administrator** | Systems and security manager overseeing compliance and operations. | Manages user accounts, enforces RBAC policies, monitors audit logs, oversees storage and health endpoints. | User management, role assignment, audit log monitoring, system health checks. |

---

### 3. Milestone Breakdown & Scope Boundaries

#### **Milestone 1 (Completed Today — Current Scope)**:
- [x] Project Initialization, Monorepo Architecture & Spec Alignment.
- [x] HAM10000 Dataset Acquisition, Schema Parsing & Grouped Lesion-ID Stratified Splits.
- [x] Exploratory Data Analysis (EDA) of 10,015 images (class imbalance, age/sex, location, image counts).
- [x] Full System Architecture & Relational Database Design (PostgreSQL ER schema, 6 tables).
- [x] Interactive UI Wireframes (Medical Teal/Navy design system).
- [x] Backend Core (FastAPI, SQLAlchemy 2, Alembic, JWT Auth, Argon2/Bcrypt, RBAC).
- [x] Case Management & Image Upload with real-time Quality Gate (blur, brightness, contrast, resolution).
- [x] Medical Image Preprocessing Pipeline (Blackhat hair removal, CLAHE, standardization, ImageNet tensor prep).
- [x] Web Application (React, Vite, TypeScript, Tailwind) with role-guarded routes, upload gate, and side-by-side comparison.
- [x] Containerization & Infrastructure Config (Docker Compose, Makefile, local storage).

#### **Milestones 2–4 (Deferred to Future Milestones)**:
- **Milestone 2 (Weeks 3–4)**: Lesion Segmentation (U-Net / DeepLabV3+), Baseline CNN classifiers (ResNet50, EfficientNet-B0), class imbalance loss tuning (Focal Loss / Class-weighted CE).
- **Milestone 3 (Weeks 5–6)**: Advanced Vision Transformers (ViT / Swin), Grad-CAM & Grad-CAM++ explainability maps, confidence calibration, severity & risk stratification.
- **Milestone 4 (Weeks 7–8)**: Multi-model ensemble, automated PDF/JSON/CSV clinical report generation, push notifications, and production cloud deployment.

---

### 4. End-to-End Workflow Architecture

```
[Mobile Device / Browser]
          │
          ▼
   1. Image Capture / Gallery Selection
          │
          ▼
   2. Real-Time Client & Server Quality Gate
          ├── Metric Evaluation:
          │     • Resolution Check (min 224 x 224 px)
          │     • Blur Detection (Laplacian Variance < 80 => Blurry)
          │     • Luminance Check (Mean Gray < 40 Under, > 225 Over)
          │     • Contrast Check (Std Dev Gray < 25 Low Contrast)
          ▼
   3. Quality Assessment Result
          ├── [Poor Quality] ──> Prompt Retake with Specific Guidance (e.g., "Image too blurry; hold device steady")
          │
          └── [Good / Acceptable] ──> Proceed
                                           │
                                           ▼
   4. User Confirmation & Metadata Form (Body location, age, symptoms)
                                           │
                                           ▼
   5. Secure Upload (POST /cases/{id}/images with JWT Auth & Audit Log)
                                           │
                                           ▼
   6. Medical Preprocessing Engine
          ├── EXIF Orientation Correction
          ├── Aspect-Preserving Center / ROI Crop & 224x224 Resize
          ├── DullRazor Hair Removal (Morphological Blackhat + Inpaint)
          ├── Contrast Enhancement (CLAHE on L-channel)
          └── Color & Tensor Normalization (ImageNet μ=[0.485, 0.456, 0.406], σ=[0.229, 0.224, 0.225])
                                           │
                                           ▼
   7. AI Model Inference & Explainability (Milestones 2–3)
                                           │
                                           ▼
   8. Clinical Decision Support Review & Notification (Milestone 4)
```

---

### 5. Regulatory & Clinical Safety Commitments
- **Zero Real Patient Identifiers**: All case codes and demographic fields are de-identified synthetic references (e.g. `CASE-2026-A101`, `PAT-4821`).
- **Ubiquitous Disclaimer**: All web screens, API payloads, and reports enforce the mandatory string:
  `"AI-assisted analysis, not a standalone medical diagnosis."`
- **Transparent Audit Trail**: Every authentication, case creation, and upload action generates an immutable `audit_logs` entry storing user ID, action, entity, and client IP.
