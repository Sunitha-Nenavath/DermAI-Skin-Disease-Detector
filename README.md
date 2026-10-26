# DermAI: Skin Disease Detector from Mobile Images Using Deep Learning

> **Clinical & Regulatory Notice**: **AI-assisted analysis, not a standalone medical diagnosis.** DermAI is an AI-assisted screening and clinical decision-support tool, NOT a diagnostic tool. In-person evaluation by a licensed dermatologist is mandatory. Only public and de-identified demo data is utilized.

---

## 1. Overview & Architecture

DermAI is a mobile-first, installable Progressive Web App (PWA) and full-stack medical screening platform designed to assist in evaluating skin lesions from smartphone photographs.

### Technology Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS (Medical Teal `#0E9F8E`, Navy `#0B1F3A`, Light Grey `#F8FAFC`).
- **PWA**: `vite-plugin-pwa`, Web App Manifest, standalone display mode, rear camera `getUserMedia` with on-screen clinical guide frame, offline indicator.
- **Visuals & Charts**: Recharts, Grad-CAM class activation overlays with opacity slider, side-by-side comparative evolution.
- **Reporting**: `jsPDF` for clinical PDF report generation, structured JSON and CSV export.
- **Backend & Database**: Firebase Authentication (Email/Password & Google Popup), Cloud Firestore multi-database, Cloud Storage with client fallback.
- **ML Integration**: REST inference contract (`POST {ML_SERVICE_URL}/predict`) with automatic **DEMO MODE** fallback when disconnected.

---

## 2. All 16 Modules Implemented

1. **Authentication & Roles**: Multi-role RBAC (`patient`, `clinician`, `researcher`, `ml_engineer`, `admin`) stored in `users/{uid}`. Email/password, Google popup sign-in, session persistence, and HIPAA audit logging.
2. **Patient & Case Management**: De-identified patient records (`case_code`, `age`, `gender`, `medical_history`, `allergies`, `clinical_notes`) and case registry with filters and admin-only deletion.
3. **Image Capture & Upload**: Camera capture (rear camera `facingMode: environment` with on-screen 224x224 guide frame), gallery selection, drag-and-drop, 90° rotation, EXIF orientation, and 10 MB payload validation.
4. **Image Quality Assessment**: Real-time client-side canvas CV computing Laplacian blur variance (threshold $\ge 75$), mean luminance (45–225), contrast std dev ($\ge 18$), and lesion-center distinction. Suboptimal photos are blocked with retake advice.
5. **Preprocessing Preview**: Square aspect crop, 224x224 resize, CLAHE-style adaptive contrast stretch, and color normalization against dermoscopic references.
6. **Lesion Segmentation**: Remote U-Net mask when available; otherwise classical baseline (Otsu threshold on saturation and inverted luminance, BFS largest connected component) showing binary mask, cyan boundary contour, and cropped ROI.
7. **Classification Result**: Primary finding, confidence score, Top-3 Recharts bar chart, latency, risk tags, and low-confidence safeguard rule ($< 50\% \implies$ "Requires Clinical Review").
8. **Explainable AI (XAI)**: Feature saliency heatmap overlay with interactive opacity slider (0% to 100%), 4-panel quad comparison, and clinical interpretability disclaimer.
9. **Model Management**: Model version registry (v1.0 ResNet50, v1.1 EfficientNet, v2.0 DenseNet, v2.1 ViT-B/16, v3.0 Ensemble), active version switcher (passed via `X-Model-Version` header), rollback, and side-by-side metric comparison.
10. **Evaluation & Colab Benchmarks**: Colab JSON upload, multi-class confusion matrix heatmap, per-class bar charts, and image quality rejection rate analysis.
11. **Role-Adaptive Dashboards**: User/Patient view (recent cases, reports), Clinician view (disease distributions, confidence stratification, recent triage), Admin view (platform health, users, audit logs).
12. **Longitudinal History & Follow-Up**: Analysis timeline per case with date filters and Previous vs Current comparative image evaluation.
13. **Reports & Exports**: One-click PDF generation via `jsPDF`, JSON and CSV exports with full audit logging and mandatory disclaimer.
14. **In-App Notifications**: Firestore notification center with severity tags (Informational, Low, Medium, High) and strict terminology safeguards (prohibits "confirmed diagnosis"; uses "AI-assisted finding").
15. **Settings, Help & Legal**: User guide, consent enforcement checkbox, HIPAA data erasure request, and limitations documentation (dermoscopy vs phone, Fitzpatrick bias).
16. **Seed & Demo Data**: One-click admin utility to populate 2 clinical demo cases with pre-computed Laplacian quality scores and Otsu segmentation masks.

---

## 3. Environment Variables

Create `.env` based on `.env.example`:

```bash
# Optional Remote ML Service (if unset, runs in DEMO MODE)
VITE_ML_SERVICE_URL=https://my-dermatology-ml-service.run.app

# Firebase Configuration (loaded from firebase-applet-config.json)
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0420421559
VITE_FIREBASE_FIRESTORE_DATABASE_ID=ai-studio-dermaiskindiseas-34b9da67-3a4a-4c0b-952b-7cee6cb8e12c
```

---

## 4. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 5. Security Rules

Hardened Firestore ABAC rules (`firestore.rules`) and Cloud Storage rules (`storage.rules`) are deployed:
- **Patients**: Read and write only their own cases (`resource.data.owner_id == request.auth.uid`).
- **Clinicians**: Read all cohort cases and append clinical progress notes.
- **Researchers**: Read anonymized cases for epidemiological study.
- **ML Engineers**: Manage neural network models and evaluation benchmarks.
- **Administrators**: Manage user accounts and read HIPAA audit logs.
- **Audit Logs**: Immutable; append-only for authenticated sessions, read restricted to Admin.

---

## 6. Deploy to Google Cloud Run

Deploy as a containerized web application using Cloud Run:

```bash
# 1. Build the production assets
npm run build

# 2. Build and submit container image with Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/dermai-app

# 3. Deploy to Cloud Run
gcloud run deploy dermai-app \
  --image gcr.io/$PROJECT_ID/dermai-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "ML_SERVICE_URL=https://my-ml-service.run.app"
```
