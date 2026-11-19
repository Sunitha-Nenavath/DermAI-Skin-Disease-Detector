# DermAI: Skin Disease Detector from Mobile Images Using Deep Learning

> **Clinical & Regulatory Notice**: **AI-assisted analysis, not a standalone medical diagnosis.** DermAI is an AI-assisted screening and clinical decision-support tool, NOT a diagnostic tool. In-person evaluation by a licensed dermatologist is mandatory. Use only public or de-identified demo data.

---

## 1. Architecture Overview

DermAI consists of two decoupled services:

1. **Full-Stack Web & PWA Application (`server.ts` + `src/`)**:
   - **Frontend**: React 19, TypeScript, Tailwind CSS, React Router, Recharts, `jsPDF`, `vite-plugin-pwa` (installable PWA + `getUserMedia` rear camera capture).
   - **Backend Server (`server.ts`)**: Node.js + Express serving Vite middleware in development and `dist/` in production, plus ML proxy endpoints (`GET /api/ml/status`, `POST /api/ml/predict`, `GET /api/health`).
   - **Auth, Database & Storage**: Firebase Authentication (Email/Password & Google Sign-In), Cloud Firestore (multi-database), and Firebase Cloud Storage with strict security rules (`firestore.rules`, `storage.rules`).
   - **Automatic DEMO MODE**: Whenever `ML_SERVICE_URL` is unset or unreachable, the app displays the Demo Mode banner, never fabricates model probabilities or labels, and still runs genuine client-side image validation, Laplacian blur/exposure/contrast quality screening, CLAHE preprocessing, and Otsu lesion segmentation.

2. **PyTorch Deep Learning Training & Inference Microservice (`ml/`)**:
   - `ml/train.py`: Complete HAM10000 training pipeline (`resnet50`, `efficientnet_b4`, `densenet121`, `vit_b16`) with `StratifiedGroupKFold` by `lesion_id` (zero leakage), inverse-frequency class weights, DullRazor + CLAHE preprocessing, checkpoint saving, and Colab evaluation JSON export (`colab_metrics_<arch>.json`).
   - `ml/serve.py`: FastAPI REST inference server (`POST /predict`, multipart field `'image'`, `X-Model-Version` header) returning Top-3 probabilities, confidence, risk tags, Otsu ROI mask (`mask_png_base64`), live PyTorch Grad-CAM heatmap (`heatmap_png_base64`), and `latency_ms`.
   - `ml/DermAI_Colab_Training.ipynb`: Ready-to-run Google Colab notebook for GPU training on HAM10000 and exporting trained `.pt` weights + Module 10 evaluation JSON.
   - `ml/Dockerfile`: Cloud Run container definition for the standalone Python/PyTorch ML microservice.

---

## 2. Environment Variables

Configure `.env` (or Cloud Run env vars) from `.env.example`:

```bash
# Port for the Node.js + Express full-stack server
PORT=3000

# Optional PyTorch FastAPI ML Service URL (leave empty to run in truthful DEMO MODE)
ML_SERVICE_URL=

# Optional Demo Credentials (Module 16)
VITE_DEMO_PATIENT_PASSWORD=
VITE_DEMO_CLINICIAN_PASSWORD=
VITE_DEMO_RESEARCHER_PASSWORD=
VITE_DEMO_ML_PASSWORD=
VITE_DEMO_ADMIN_PASSWORD=
```

---

## 3. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack Express + Vite server on port 3000
npm run dev
```

### Running the Separate PyTorch ML Microservice (Local or GPU Machine)

```bash
pip install -r ml/requirements.txt

# Train a model on downloaded HAM10000 data (produces weights & Colab metrics JSON)
python -m ml.train --data-dir ./data/ham10000 --arch resnet50 --epochs 20 --output-dir ./ml/weights

# Start FastAPI inference service on port 8001
ML_WEIGHTS_DIR=./ml/weights uvicorn ml.serve:app --host 0.0.0.0 --port 8001

# Point DermAI web server to the ML service
export ML_SERVICE_URL=http://127.0.0.1:8001
npm run dev
```

---

## 4. Deploying to Google Cloud Run

### Step 1: Deploy the PyTorch ML Service (`ml/Dockerfile`)
Place your trained `.pt` checkpoints exported from `ml/train.py` or `ml/DermAI_Colab_Training.ipynb` inside `ml/weights/`, then deploy:

```bash
gcloud builds submit -f ml/Dockerfile --tag gcr.io/$PROJECT_ID/dermai-ml-service .
gcloud run deploy dermai-ml-service \
  --image gcr.io/$PROJECT_ID/dermai-ml-service \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --allow-unauthenticated \
  --port 8080
```

### Step 2: Deploy the Full-Stack DermAI Web App (`Dockerfile`)
Set `ML_SERVICE_URL` to the Cloud Run URL from Step 1 (or omit it to run in Demo Mode):

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/dermai-app .
gcloud run deploy dermai-app \
  --image gcr.io/$PROJECT_ID/dermai-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "ML_SERVICE_URL=https://dermai-ml-service-xxxx.a.run.app"
```

---

## 5. Security Rules

Hardened Firestore (`firestore.rules`) and Cloud Storage (`storage.rules`) RBAC rules:
- **patient**: Read/write only own cases, analyses, and images.
- **clinician**: Read all cases and append clinical notes.
- **researcher**: Read de-identified analyses/cases without editing clinical state.
- **ml_engineer**: Manage model versions, metrics, evaluation JSON, and risk config tables.
- **admin**: Manage `users/{uid}` roles, read immutable `audit_logs`, and run demo seeders.
