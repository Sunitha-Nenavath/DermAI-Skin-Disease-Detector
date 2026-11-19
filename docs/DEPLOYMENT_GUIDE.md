# Complete Deployment Guide for DermAI

This guide provides end-to-end instructions for deploying the **DermAI: Skin Disease Detector** application to production on **Google Cloud Run** with **Firebase Authentication, Cloud Firestore, and Cloud Storage**.

---

## 1. System Deployment Architecture

```
[User / Mobile Device] (PWA Camera Capture)
         │ HTTPS
         ▼
[Google Cloud Run] (Port 3000: Node.js + Express + React 19 PWA Bundle)
   ├── Static Asset Serving (PWA Manifest, Service Worker, Responsive UI)
   ├── Health Check Routes (/health, /api/health)
   ├── Firebase Client SDK (Auth, Multi-database Firestore, Cloud Storage)
   └── REST Proxy -> [Separate ML Model Inference Service] (POST /predict)
```

### Components & Cloud Resources
| Component | Cloud Service | Current Config / Resource ID |
|---|---|---|
| **Web App & PWA** | Google Cloud Run | Containerized Node 20 runtime |
| **Authentication** | Firebase Auth | Google Sign-In & Email/Password |
| **Primary Database** | Cloud Firestore | `ai-studio-dermaiskindiseas-34b9da67-3a4a-4c0b-952b-7cee6cb8e12c` |
| **Image Storage** | Firebase Cloud Storage | `gen-lang-client-0420421559.firebasestorage.app` |
| **Security Rules** | Firestore & Storage Rules | Hardened ABAC rules deployed via `fax.DeployRules` |
| **Deep Learning Model** | Cloud Run (Separate) | REST service endpoint (`ML_SERVICE_URL`) |

---

## 2. Option A: One-Command Deployment to Google Cloud Run (Recommended)

Google Cloud Run can build your container directly from the root `Dockerfile` using Google Cloud Build:

### Step 1: Install and Authenticate Google Cloud CLI
```bash
# 1. Log in to your Google Cloud account
gcloud auth login

# 2. Set your Google Cloud Project ID
gcloud config set project gen-lang-client-0420421559

# 3. Enable necessary Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  firestore.googleapis.com \
  firebasestorage.googleapis.com
```

### Step 2: Deploy Directly from Source Code
Run this command from the project root directory:

```bash
gcloud run deploy dermai-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,ML_SERVICE_URL="
```

### Step 3: Access Your Production URL
Once the command completes, Cloud Run will output a public HTTPS URL (e.g., `https://dermai-app-xxxxx-uc.a.run.app`).

---

## 3. Option B: Pre-building Docker Image via Google Artifact Registry

If your team uses standard CI/CD (GitHub Actions, GitLab CI, or Cloud Build):

```bash
# 1. Build and tag the Docker image
docker build -t gcr.io/gen-lang-client-0420421559/dermai-app:v1.0 .

# 2. Push image to Google Container Registry
docker push gcr.io/gen-lang-client-0420421559/dermai-app:v1.0

# 3. Deploy the container image to Cloud Run
gcloud run deploy dermai-app \
  --image gcr.io/gen-lang-client-0420421559/dermai-app:v1.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

---

## 4. Deploying the Separate Deep Learning ML Service (PyTorch / FastAPI)

If you have a trained deep learning model (e.g. ResNet50 or ViT on HAM10000):

### Step 1: Build the Python ML Service
A dedicated `backend/Dockerfile` is included in this repository:
```bash
gcloud run deploy dermai-ml-service \
  --source ./backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000 \
  --memory 4Gi \
  --cpu 2
```

### Step 2: Connect the ML Service to the Main App
Update the `ML_SERVICE_URL` environment variable on the main Cloud Run service:
```bash
gcloud run services update dermai-app \
  --region us-central1 \
  --set-env-vars "ML_SERVICE_URL=https://dermai-ml-service-xxxxx-uc.a.run.app"
```

*(Note: When `ML_SERVICE_URL` is empty, DermAI automatically operates in safe **DEMO MODE**, executing real client-side quality checks and Otsu segmentation without inventing fake probabilities).*

---

## 5. Firebase Security Rules & Storage Verification

The hardened security rules are already deployed to your project:
- **`firestore.rules`**: Enforces strict Attribute-Based Access Control (ABAC):
  - Patients can only read/write their own cases (`owner_id == request.auth.uid`).
  - Clinicians can read all cases and append progress notes.
  - Researchers read anonymized cohort data.
  - ML Engineers manage model versions and metrics.
  - Administrators manage users and read immutable HIPAA audit logs.
- **`storage.rules`**: Enforces 10 MB payload limits and image MIME type validation.

To redeploy rules at any time:
```bash
firebase deploy --only firestore:rules,storage
```

---

## 6. Testing Your Container Locally

You can test the exact production Docker build on your local machine before pushing:

```bash
# 1. Build local container
docker build -t dermai-local .

# 2. Run local container on port 3000
docker run -p 3000:3000 -e PORT=3000 dermai-local

# 3. Test health check
curl http://localhost:3000/health
# Expected Output: {"status":"healthy","service":"DermAI Skin Disease Detector",...}
```

---

## 7. Custom Domain & PWA Installation Verification

1. **Custom Domain**: In the Google Cloud Console, navigate to **Cloud Run > Manage Custom Domains** to map your institutional or hospital domain (e.g., `screening.hospital.org`). Google automatically provisions and renews SSL/TLS certificates.
2. **PWA Standalone Mode**:
   - On Android: Open the site in Chrome and tap **"Install PWA"** in the navigation bar.
   - On iOS: Open the site in Safari, tap **Share**, and select **"Add to Home Screen"**.
