# DermAI: Milestone 1 Completion Report
## Project Initialization, Dataset Diagnostics & Core Medical Pipeline Setup

> **Regulatory & Clinical Safety Notice**: *AI-assisted analysis, not a standalone medical diagnosis.* DermAI is engineered as a clinical decision-support and screening platform. It does not provide autonomous diagnosis or replace histopathological biopsy.

---

### 1. Executive Summary: What Was Built

In Milestone 1, we successfully initialized and operationalized the end-to-end core foundations for **DermAI: Skin Disease Detector from Mobile Images Using Deep Learning**:

1. **Monorepo Architecture**: Clean separation across `backend/` (FastAPI), `web/` (React 19 + TypeScript + Tailwind), `ml/` (preprocessing engine & notebooks), `data/` (HAM10000 metadata and leakage-free splits), `docs/` (formal specifications & wireframes), and `scripts/` (database seeders and split generators).
2. **HAM10000 Ingestion & Zero-Leakage Grouped Splits**: Ingested all 10,015 images and 7,470 unique lesions. Built `scripts/make_splits.py` enforcing grouped stratification by `lesion_id` to strictly prevent feature leakage between train (70.03%), validation (14.97%), and test (15.00%) splits.
3. **Database Schema & ORM**: PostgreSQL 16 (and SQLite in-memory/local dev) relational schema with 6 tables (`users`, `patients`, `cases`, `images`, `analyses`, `audit_logs`) and strict RBAC isolation.
4. **Security, Auth & Audit**: JWT access tokens, native bcrypt password hashing, role-based dependencies (`patient`, `clinician`, `researcher`, `ml_engineer`, `admin`), and immutable audit logging.
5. **Computer Vision Quality Gate**: Real-time screening measuring Laplacian blur variance ($\sigma^2$), gray-level luminance mean ($\mu$), contrast standard deviation ($\sigma$), and resolution ($W, H \ge 224\text{px}$). Automatically rejects poor images with clinical guidance to retake.
6. **Clinical Preprocessing Pipeline**: Standalone DullRazor morphological blackhat hair inpainting, CLAHE adaptive contrast equalization on the L-channel, center cropping, and ImageNet standardization into float32 tensors $[1, 3, 224, 224]$ exposed via `POST /images/{id}/preprocess`.
7. **Clinical Frontend Dashboard**: Responsive web client with top-bar navigation, 1-click role switcher, case registry, new case submission, drag-and-drop intake, and side-by-side comparative inspection between raw mobile captures and preprocessed model tensors.

---

### 2. Milestone 1 Evaluation Checklist

| Evaluation Item | Status | Verification & Evidence |
| :--- | :---: | :--- |
| **1. Project Initialization** | **MET** | Monorepo established; `docker-compose.yml`, `Makefile`, `README.md`, `.env.example`, and FastAPI `/health` endpoint operational. All 6 automated backend tests pass. |
| **2. Dataset Selected & Analyzed** | **MET** | HAM10000 selected (10,015 records). `ml/notebooks/01_eda.ipynb` and `docs/02_dataset.md` document demographics, localizations, and unique lesion distributions. |
| **3. Disease Classes Identified** | **MET** | All 7 diagnostic classes mapped (`mel`, `nv`, `bcc`, `akiec`, `bkl`, `df`, `vasc`). Balanced training weights computed (e.g. `nv`: 0.21, `mel`: 1.26, `df`: 13.01) to counter 67% nevus imbalance. |
| **4. Database Designed** | **MET** | 6 relational tables designed with Mermaid ER diagram (`docs/04_database.md`), implemented in SQLAlchemy 2 models (`backend/models.py`), with de-identified patient data isolation. |
| **5. Authentication Implemented** | **MET** | JWT bearer tokens, native bcrypt hashing, 5 demo roles seeded (`scripts/seed.py`). Strict case isolation verified by unit tests (patients cannot access other patients' cases). |
| **6. Image Upload Operational** | **MET** | Synchronous upload with MIME and byte-level corruption check, max 10MB, min 224x224, EXIF rotation fix, and automated CV quality gate scoring blur, brightness, and contrast. |
| **7. Preprocessing Pipeline Implemented** | **MET** | `ml/preprocessing/pipeline.py` implemented with DullRazor blackhat inpainting, L-channel CLAHE, and ImageNet standardization. Verified by unit tests and live side-by-side UI view. |

---

### 3. Automated Test Suite Results

Test Execution: `python3 -m pytest tests/ -v`

```text
============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-9.1.1, pluggy-1.7.0
rootdir: /app/applet
plugins: anyio-4.15.1
collected 6 items

tests/test_backend.py::test_health_endpoint PASSED                       [ 16%]
tests/test_backend.py::test_user_registration_and_login PASSED           [ 33%]
tests/test_backend.py::test_case_role_isolation PASSED                   [ 50%]
tests/test_backend.py::test_image_upload_and_quality_assessment PASSED   [ 66%]
tests/test_backend.py::test_poor_quality_rejection PASSED                [ 83%]
tests/test_backend.py::test_ml_preprocessing_pipeline_contract PASSED    [100%]

======================== 6 passed in 4.55s =========================
```

---

### 4. Key Methodological Insights & Decisions

1. **Lesion ID Leakage Elimination**:
   Standard random splits in medical imaging often place multiple photos of the same patient lesion across both train and test partitions, creating severe feature leakage. By stratifying strictly at the `lesion_id` level, we guarantee zero overlap (0 identical lesions) between train (5,230 lesions) and test (1,120 lesions).
2. **Quality Gate as a Pre-Inference Defense**:
   Consumer smartphone photos suffer from motion blur, camera shake, and flash washout. By screening images before saving or queuing for inference, we eliminate garbage-in/garbage-out degradation.
3. **Pluggable Storage Resilience**:
   `STORAGE_BACKEND` defaults to local filesystem (`./backend/storage`) while supporting MinIO S3 API in production, ensuring zero points of failure during local demonstrations.
4. **Strict Patient De-Identification**:
   No real patient identifiers (PII) are stored. Case records and patient demographics use pseudonymous system-generated codes (e.g. `PAT-2026-4819`).

---

### 5. Known Limitations & Deferred to Milestones 2–4

- **Classification Models**: Deep learning classifiers (ResNet50, EfficientNet, Swin Transformer) are deferred to Milestones 2 & 3.
- **Lesion Segmentation**: Semantic lesion mask extraction (U-Net, DeepLabV3+) is deferred to Milestone 2.
- **Explainable AI**: Grad-CAM / Grad-CAM++ saliency overlays will be implemented in Milestone 3.
- **Automated Clinical PDF Reports**: Exportable multi-page clinical reports will be completed in Milestone 4.
- **Cross-Modality Phone Datasets**: PAD-UFES-20 and SCIN datasets will be introduced in Milestone 2 for real-world phone camera fine-tuning.

---

### 6. Screenshots to Capture for Milestone 1 Submission

1. **Screenshot 1: Clinical Dashboard**: Showing metrics row, role indicator, recent clinical cases, and ubiquitous notice.
2. **Screenshot 2: Case Registry with Filters**: Showing search and anatomical location filtering.
3. **Screenshot 3: Image Intake & Quality Check**: Drag-and-drop zone with real-time blur, luminance, and contrast evaluation.
4. **Screenshot 4: Side-by-Side Preprocessing Inspection**: Original raw lesion photo alongside DullRazor-inpainted + CLAHE preprocessed 224x224 tensor.
5. **Screenshot 5: HAM10000 Dataset & Splitting Diagnostics**: Class imbalance distribution bar charts and 3-way grouped split statistics.
6. **Screenshot 6: Quality Gate Rejection State**: Poor-quality image rejected with guidance to hold the camera steady.

---

### 7. Commands to Start the Application

#### Option A: Quickstart in Current Sandbox
```bash
# 1. Start persistent FastAPI backend on port 8001:
nohup python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 > /tmp/uvicorn.log 2>&1 &

# 2. Start React development server on port 3000:
npm run dev
```

#### Option B: Clean Full Setup via Makefile
```bash
make setup      # Installs Python and Node dependencies
make dataset    # Generates splits and benchmark samples
make seed       # Seeds 5 role accounts
make test       # Executes pytest suite
make run-api    # Starts FastAPI backend
make run-web    # Starts React web server
```

#### Option C: Production Docker Compose
```bash
docker compose up -d --build
curl http://localhost:8000/health
```

---

### 8. Five-Minute Live Demonstration Script

| Time | Action | What to Explain to the Reviewer |
| :--- | :--- | :--- |
| **0:00 - 0:45** | **Login & Role System** | Navigate to `/login`. Demonstrate the 1-click demo switcher. Sign in as **Dr. Sarah Chen, MD (Clinician)**. Point out the persistent medical notice banner: *"AI-assisted analysis, not a standalone medical diagnosis."* |
| **0:45 - 1:45** | **Dashboard & RBAC Case Isolation** | Show dashboard metrics (48 cases, 91.7% quality pass rate). Switch role to **Patient (John Doe)** to demonstrate RBAC: patient only sees their personal cases; clinician sees all cohort cases. |
| **1:45 - 2:45** | **New Case Registration** | Click **New Lesion Case**. Fill out de-identified demographic details (Age 54, Male, Upper Extremity). Emphasize that no patient PII is stored; random code `PAT-2026-X` is generated. |
| **2:45 - 3:45** | **Quality Gate & Preprocessing Inspection** | Open `CASE-2026-A101`. Show the image intake area. Explain how the quality gate evaluates Laplacian blur variance, mean gray, and contrast before saving. Then highlight the **Side-by-Side Inspection View**: Left shows the raw original capture; Right shows the live output of `POST /images/{id}/preprocess` (DullRazor blackhat hair inpainting + CLAHE on L-channel + ImageNet normalized 224x224 tensor). |
| **3:45 - 4:30** | **Dataset Diagnostics & Leakage Prevention** | Click **Dataset (HAM10000)** in the top navigation. Explain the severe class imbalance (67% nevus vs 1% vascular). Show the computed class weights ($w_c$) that will govern loss calculations in Milestone 2. Explain the **7,470 unique lesions** and how `scripts/make_splits.py` grouped by `lesion_id` to eliminate test leakage. |
| **4:30 - 5:00** | **Test Pass Summary & Q&A** | Show the terminal running `python3 -m pytest tests/ -v` with all 6 tests passing (health, auth, case isolation, upload validation, quality rejection, preprocessing pipeline). Conclude Milestone 1. |
