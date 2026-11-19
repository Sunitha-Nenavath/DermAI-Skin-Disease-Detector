# DermAI: Skin Disease Detector from Mobile Images Using Deep Learning
## 10-Slide Project Presentation Deck & Complete Oral Presentation Script

> **Mandatory Clinical & Regulatory Notice**: *AI-assisted analysis, not a standalone medical diagnosis.* DermAI is engineered as an automated clinical decision-support and screening platform. It does not replace professional medical consultation, clinical examination, or histopathological biopsy.

---

# PART 1: 10-SLIDE PRESENTATION DECK STRUCTURE

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                               SLIDE INDEX                                     │
├───────────────────────────────────────────────────────────────────────────────┤
│ Slide 1  │ Title & Executive Overview (DermAI Platform)                       │
│ Slide 2  │ Clinical Problem, Motivation & The Mobile Dermatology Gap          │
│ Slide 3  │ Proposed Solution & End-to-End Workflow Architecture               │
│ Slide 4  │ Project Scope & Milestone Roadmap (Milestone 1 vs. Future)         │
│ Slide 5  │ Benchmark Dataset (HAM10000) & Severe Class Imbalance Mitigation  │
│ Slide 6  │ Critical Methodological Safeguard: Lesion ID Leakage Prevention    │
│ Slide 7  │ Automated Computer Vision Quality Assessment Gate                  │
│ Slide 8  │ Medical Image Preprocessing Engine (DullRazor + CLAHE + Tensor)    │
│ Slide 9  │ Multi-Tier System Architecture, Relational Schema & Security/RBAC  │
│ Slide 10 │ Verification Results, Live Demonstration & Milestone 2 Roadmap     │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### SLIDE 1: Title & Executive Overview
- **Header**: DermAI: Skin Disease Detector from Mobile Images Using Deep Learning
- **Subtitle**: Milestone 1: Project Initialization, Dataset Diagnostics & Core Medical Pipeline Setup
- **Visuals**:
  - DermAI Logo with Teal (`#0E9F8E`) and Deep Navy (`#0B1F3A`) branding.
  - Subtitle metadata: Full-Stack Engineering, Computer Vision & Medical Diagnostics.
  - Notice Banner: *"Notice: AI-assisted analysis, not a standalone medical diagnosis."*
- **Key Talking Points**:
  - Bridging consumer smartphone cameras and clinical deep learning.
  - Comprehensive clinical engineering: data leakage prevention, intake quality gate, standardized hair/contrast preprocessing, and role-based medical security.

---

### SLIDE 2: Clinical Problem & The Mobile Imaging Gap
- **Header**: The Clinical Problem & The Mobile Dermatology Gap
- **Key Problem Drivers**:
  1. **Epidemiological Urgency**: Skin cancers (melanoma, basal cell carcinoma) are among the fastest growing malignancies worldwide; 5-year survival drops from $>98\%$ at stage 1 to $<30\%$ once metastatic.
  2. **Access Bottleneck**: High specialist patient-to-dermatologist wait times (often 3–6 months) prevent timely early triage.
  3. **The Mobile Acquisition Gap**:
     - *Dermoscopy*: Polarized, contact lens magnification, uniform epiluminescence.
     - *Smartphone Photos*: Hand tremor motion blur, low light, harsh flash glare, occluding skin hair, and distant field of view.
- **Visuals**: Comparison diagram highlighting Dermatoscope vs. Consumer Mobile Phone artifacts.

---

### SLIDE 3: Proposed Solution & End-to-End Workflow Architecture
- **Header**: DermAI End-to-End Workflow Architecture
- **Workflow Pipeline**:
  $$\text{Mobile Camera Capture} \longrightarrow \text{Real-Time CV Quality Gate} \longrightarrow \text{User Confirmation} \longrightarrow \text{Secure Intake} \longrightarrow \text{Medical Preprocessing Engine} \longrightarrow \text{AI Model Inference}$$
- **Key Tenet**: **Screen Before You Predict**. Bad inputs create misleading diagnoses; reject low-fidelity photos at capture time rather than outputting erroneous AI classifications.
- **Visuals**: Flowchart tracing a lesion photo from phone camera through Laplacian variance check, hair removal, CLAHE equalization, to a normalized $224\times224$ float32 tensor.

---

### SLIDE 4: Project Scope & Milestone Roadmap
- **Header**: Scope Boundaries: Milestone 1 Completion vs. Project Roadmap
- **2-Column Comparative Table**:
  - **Milestone 1 (Completed Today — Focus of this Presentation)**:
    - [x] Monorepo scaffold & Docker Compose infrastructure.
    - [x] Ingestion & EDA of 10,015 HAM10000 images across 7 classes.
    - [x] Grouped stratified splitting by `lesion_id` (Zero feature leakage).
    - [x] Relational database schema with 6 tables & de-identified patient store.
    - [x] JWT authentication, bcrypt hashing, and 5 RBAC roles.
    - [x] Computer vision quality gate (Blur, Brightness, Contrast, Resolution).
    - [x] Preprocessing pipeline (DullRazor inpainting, CLAHE, ImageNet tensor).
    - [x] Responsive React + TypeScript dashboard with side-by-side comparison.
  - **Milestones 2–4 (Deferred to Future Development)**:
    - *Milestone 2*: U-Net lesion segmentation, baseline CNN models (ResNet50, EfficientNet), focal loss.
    - *Milestone 3*: Vision Transformers (ViT, Swin), Grad-CAM explainability, risk categorization.
    - *Milestone 4*: Multi-model ensemble, automated clinical PDF reports, push notifications.

---

### SLIDE 5: Benchmark Dataset (HAM10000) & Severe Class Imbalance
- **Header**: Dataset Diagnostics & Imbalance Mitigation
- **Dataset Metrics**:
  - Source: HAM10000 (Harvard Dataverse / ISIC Archive) · 10,015 dermatoscopic images.
  - 53.3% confirmed via histopathology (gold standard biopsy).
- **The 7 Diagnostic Categories & Computed Class Weights ($w_c$)**:
  1. `nv` (Melanocytic Nevus): 6,705 images (66.95%) · Weight: **0.2134**
  2. `mel` (Melanoma — Malignant): 1,113 images (11.11%) · Weight: **1.2855**
  3. `bkl` (Benign Keratosis): 1,099 images (10.97%) · Weight: **1.3019**
  4. `bcc` (Basal Cell Carcinoma — Malignant): 514 images (5.13%) · Weight: **2.7836**
  5. `akiec` (Actinic Keratosis): 327 images (3.27%) · Weight: **4.3754**
  6. `vasc` (Vascular Lesion): 142 images (1.42%) · Weight: **10.0757**
  7. `df` (Dermatofibroma): 115 images (1.15%) · Weight: **12.4413**
- **Visuals**: Horizontal distribution bar chart showing the 67% nevus dominance and weighted loss strategy.

---

### SLIDE 6: Methodological Safeguard: Lesion ID Leakage Prevention
- **Header**: Eliminating The Hidden Data Leakage Trap
- **The Trap**:
  - 10,015 images represent only **7,470 unique lesions** (`lesion_id`).
  - Many lesions were photographed up to 6 times at different angles, dates, or magnifications.
  - *Standard random 80/20 train/test splitting leaks identical patient lesions into both train and test partitions*, yielding falsely inflated test accuracies (~96%) that fail catastrophically in clinical practice.
- **The DermAI Solution**:
  - **Grouped Stratified Splitting** (`scripts/make_splits.py`):
    - **Train**: 7,014 images (5,230 lesions, 70.03%)
    - **Validation**: 1,499 images (1,120 lesions, 14.97%)
    - **Test**: 1,502 images (1,120 lesions, 15.00%)
  - **Mathematical Guarantee**: **0 common `lesion_id`s across partitions**.
- **Visuals**: Venn diagram showing disjoint lesion sets and split proportions.

---

### SLIDE 7: Automated Computer Vision Quality Assessment Gate
- **Header**: Image Intake Quality Gate: Screen Before Inference
- **Deterministic CV Algorithms**:
  1. **Blur Detection**: Laplacian operator variance $\sigma^2 = \text{Var}(\nabla^2 I_{\text{gray}})$.
     - $\sigma^2 < 50.0 \implies$ **Poor (Rejected)**: Motion blur or out-of-focus.
     - $50 \le \sigma^2 < 85.0 \implies$ **Acceptable**.
     - $\sigma^2 \ge 85.0 \implies$ **Good (Sharp)**.
  2. **Exposure / Luminance**: Gray level mean $\mu$.
     - $\mu < 35.0 \implies$ Severely underexposed / dark.
     - $\mu > 230.0 \implies$ Flash glare / washed out.
  3. **Contrast**: Gray level standard deviation $\sigma < 18.0 \implies$ Low contrast.
  4. **Resolution Gate**: Minimum $224 \times 224$ pixels, max 10 MB, valid JPEG/PNG.
- **User Feedback**: Immediate actionable guidance (e.g. *"Hold camera steady; illuminate lesion"*).
- **Visuals**: Quality card breakdown with dials and badge indicators.

---

### SLIDE 8: Medical Preprocessing Engine
- **Header**: Clinical Preprocessing: Normalization & Artifact Removal
- **Multi-Stage Preprocessing Pipeline (`ml/preprocessing/pipeline.py`)**:
  1. **EXIF Transposition**: Auto-corrects mobile phone orientation tags.
  2. **DullRazor Hair Removal**:
     - Morphological blackhat filter: $B = I - (I \bullet K_{17\times17})$.
     - Thresholding \& dilation to isolate hair mask.
     - Telea inpainting ($r=3$) interpolating surrounding skin color.
  3. **L-Channel CLAHE (Contrast-Limited Adaptive Histogram Equalization)**:
     - Converts RGB $\to$ LAB color space.
     - Equalizes Luminance (L) channel ($\text{clipLimit}=2.0$, grid $8\times8$).
     - Preserves delicate chromatic lesion pigments on A/B channels.
  4. **Aspect-Preserving Center Crop & Resize**: Standardizes to $224 \times 224 \times 3$.
  5. **ImageNet Standardization**: $\mu=[0.485, 0.456, 0.406]$, $\sigma=[0.229, 0.224, 0.225]$ producing float32 tensor $[1, 3, 224, 224]$.
- **Visuals**: Side-by-side comparison: Raw capture with hair and lighting glare vs. preprocessed clean tensor.

---

### SLIDE 9: System Architecture, Relational Schema & Security
- **Header**: Multi-Tier System Architecture & Role-Based Access Control
- **Tech Stack**:
  - *Backend*: FastAPI (Python 3.10), SQLAlchemy 2, Pydantic v2, PostgreSQL 16 (or local SQLite).
  - *Frontend*: React 19, TypeScript, Tailwind CSS, Lucide icons, Vite.
  - *ML/CV*: OpenCV, Pillow, NumPy, Pandas.
- **Relational Schema (6 Tables)**:
  - `users`, `patients` (de-identified only), `cases`, `images`, `analyses`, `audit_logs`.
- **Security & Privacy (HIPAA / GDPR Aligned)**:
  - JWT access tokens with stateless validation.
  - Native bcrypt password hashing (work factor 12).
  - 5 Isolated RBAC Roles: `patient` (strictly own cases), `clinician` (all cohort cases + notes), `researcher` (de-identified analytics), `ml_engineer` (pipelines & splits), `admin` (audit logs & users).
  - Zero real patient PII allowed in database.

---

### SLIDE 10: Verification Results, Live Demo & Milestone 2 Roadmap
- **Header**: Milestone 1 Deliverables Met & Transition to Model Training
- **Deliverables Verified**:
  - [x] 100% automated test pass rate (`pytest tests/ -v`, 6/6 tests passing).
  - [x] Working FastAPI server and React SPA with live API proxying.
  - [x] Ingested 10,015 HAM10000 records, created 3-way grouped splits with 0 leakage.
  - [x] Deployed live DullRazor hair inpainting + CLAHE preprocessing endpoint (`POST /images/{id}/preprocess`).
- **Milestone 2 Next Steps**:
  - Train baseline CNN architectures (ResNet50, EfficientNet-B0, MobileNetV3).
  - Evaluate U-Net and DeepLabV3+ for automatic lesion boundary segmentation.
  - Integrate real-world smartphone datasets (PAD-UFES-20 and SCIN).
- **Closing Notice**: *"AI-assisted analysis, not a standalone medical diagnosis."*

---

# PART 2: COMPLETE VERBATIM ORAL PRESENTATION SCRIPT

*Total Estimated Delivery Time: 8 to 10 minutes (approx. 45–60 seconds per slide).*
*Tone: Confident, clinical, methodologically rigorous, and technically precise.*

---

#### SLIDE 1: Title & Executive Overview (0:00 - 0:45)

> **Speaker**:
> "Good morning, respected evaluators and colleagues.
>
> Today, I am proud to present **DermAI: Skin Disease Detector from Mobile Images Using Deep Learning**.
>
> In this presentation, I will walk you through the completion of **Milestone 1**: our project initialization, dataset diagnostics, and core medical pipeline setup.
>
> Before we dive in, I want to emphasize our core regulatory and clinical commitment, which appears across every screen and every API response in DermAI:
> *'AI-assisted analysis, not a standalone medical diagnosis.'*
> DermAI is engineered as a clinical decision-support and screening platform to assist healthcare professionals and triage patients—not an autonomous black-box replacement for qualified dermatologists or histopathological biopsy.
>
> Let's look at why this system is desperately needed."

---

#### SLIDE 2: Clinical Problem & The Mobile Imaging Gap (0:45 - 1:45)

> **Speaker**:
> "Skin disease is one of the most prevalent healthcare challenges globally. Melanoma alone accounts for the vast majority of skin cancer deaths, yet when detected in its earliest intraepidermal stages, the 5-year survival rate exceeds 98%. When diagnosis is delayed and the lesion penetrates deep dermal layers or metastasizes, survival plummets below 30%.
>
> Unfortunately, access to specialist dermatologists is constrained by geographic shortages and referral backlogs, with wait times frequently exceeding three to six months.
>
> While deep learning models trained on curated academic datasets claim high accuracy, there is a fundamental **clinical deployment gap**:
> Academic models are almost always trained on *dermoscopic images*—taken through specialized polarized immersion lenses with uniform contact illumination.
>
> In contrast, everyday patients and general practitioners take photos using **consumer smartphones**. These images suffer from camera shake, motion blur, poor bathroom lighting, harsh flash glare, and occluding skin hairs.
>
> If you feed poor-quality smartphone images directly into deep learning classifiers, the predictions will be erroneous and potentially dangerous. This brings us to DermAI's architectural solution."

---

#### SLIDE 3: Proposed Solution & End-to-End Workflow Architecture (1:45 - 2:40)

> **Speaker**:
> "DermAI bridges this gap through a disciplined, standardized six-stage pipeline:
>
> First: **Mobile Acquisition**. Patients or clinicians capture a lesion photo using a mobile camera or web browser.
>
> Second: **The Quality Gate**. Rather than blindly accepting any photo, our computer vision algorithms immediately evaluate blur, luminance, contrast, and resolution. If an image is blurry or dark, it is immediately rejected with instructions to retake the photo. We enforce a fundamental principle: *Screen before you predict*.
>
> Third: **User Confirmation**. The user confirms non-identifiable clinical context such as anatomical site and age.
>
> Fourth: **Secure Intake**. Images are uploaded with cryptographic authentication and immutable audit logging.
>
> Fifth: **Medical Preprocessing**. Our image engine eliminates artifacts through DullRazor hair inpainting, adaptive contrast enhancement, and ImageNet standardization.
>
> And finally, in subsequent milestones, the clean tensor is dispatched for deep learning classification and explainability.
>
> Let's define the scope of what we completed today in Milestone 1."

---

#### SLIDE 4: Scope Boundaries & Milestone Roadmap (2:40 - 3:30)

> **Speaker**:
> "As required by the project specifications, we have strictly focused today on **Milestone 1: Project Initialization, Dataset & Core Setup**.
>
> Today we have completed:
> - The entire monorepo architecture and Docker containerization.
> - Full ingestion and exploratory data analysis of the benchmark HAM10000 dataset.
> - Leakage-free, lesion-grouped train, validation, and test splits.
> - Complete relational database design with six tables and de-identified patient records.
> - Secure JWT authentication with five role-based access control tiers.
> - The operational image intake quality gate.
> - And the medical preprocessing engine with side-by-side visual comparison in our React frontend.
>
> We have intentionally deferred deep learning classification models, U-Net segmentation, Grad-CAM attention heatmaps, and automated PDF clinical reports to Milestones 2, 3, and 4.
>
> Let's look at our dataset findings."

---

#### SLIDE 5: Benchmark Dataset & Severe Class Imbalance (3:30 - 4:30)

> **Speaker**:
> "For our benchmark foundation, we ingested the official **HAM10000** dataset from Harvard Dataverse—comprising 10,015 dermatoscopic images across seven distinct diagnostic categories. Over 53% of these cases are confirmed by histopathology biopsy.
>
> Our exploratory data analysis revealed a critical challenge: **extreme class imbalance**.
>
> Melanocytic Nevus—common benign moles—accounts for **67%** of the entire dataset with 6,705 images.
>
> In contrast, life-threatening malignancies and rare lesions represent small fractions:
> - Melanoma is 11.1%.
> - Basal Cell Carcinoma is 5.1%.
> - Actinic Keratosis is 3.3%.
> - Vascular Lesions are only 1.4%.
> - And Dermatofibroma is just 1.1% with only 115 images.
>
> If you train a model naively on this distribution, it will achieve 67% accuracy simply by predicting 'nevus' every time—completely failing to detect deadly melanomas.
>
> To solve this for future training, we computed balanced class weights in Milestone 1:
> Melanocytic nevus receives a small loss weight of 0.21, whereas melanoma is weighted at 1.29, and rare dermatofibromas are weighted at 12.44.
>
> But there is an even more dangerous trap in this dataset: data leakage."

---

#### SLIDE 6: Methodological Safeguard: Lesion ID Leakage Prevention (4:30 - 5:25)

> **Speaker**:
> "I want to draw your attention to a critical methodological contribution we implemented in `scripts/make_splits.py`.
>
> In HAM10000, 10,015 images do NOT represent 10,015 distinct patients. There are only **7,470 unique lesions**. Many lesions were photographed up to six times—under different magnifications, polarizations, or at follow-up visits.
>
> In many published academic papers, researchers perform a naive random 80/20 train/test split. When you do that, two different photos of the exact same patient lesion end up in both the training set and the test set!
>
> The neural network memorizes individual patient skin patterns, producing artificially inflated test scores of 95% or higher. When deployed in a clinic on new patients, the model collapses.
>
> In DermAI, we engineered **Grouped Stratified Splitting strictly by `lesion_id`**.
> All photos of a given lesion are guaranteed to reside in either Train, Validation, or Test—never split across them.
>
> Our resulting splits are:
> - 7,014 images in Train (70.03%)
> - 1,499 images in Validation (14.97%)
> - 1,502 images in Test (15.00%)
> We verified with unit tests that there is **zero lesion overlap** across these partitions."

---

#### SLIDE 7: Automated Computer Vision Quality Assessment Gate (5:25 - 6:25)

> **Speaker**:
> "Next, let's look at how DermAI protects inference through our **Synchronous Quality Gate**.
>
> When a user uploads or snaps an image, we execute deterministic OpenCV computer vision checks before the image is saved:
>
> First: **Blur Detection via Laplacian Variance**.
> We compute the variance of the Laplacian of the grayscale image. If the variance is below 50, the image is flagged as blurry and rejected with a clear message: *'Motion blur detected; please hold phone steady.'*
>
> Second: **Luminance and Exposure**.
> We compute the mean pixel brightness. A mean below 35 indicates severe underexposure, while a mean above 230 indicates flash washout. Both are rejected.
>
> Third: **Contrast Check**.
> We compute the standard deviation of grayscale intensities. If it is below 18, borders cannot be segmented reliably.
>
> Fourth: **Resolution**.
> Images below 224 by 224 pixels are rejected.
>
> Only images scored as 'Good' or 'Acceptable' pass into clinical storage. This prevents downstream garbage-in, garbage-out failure."

---

#### SLIDE 8: Medical Preprocessing Engine (6:25 - 7:25)

> **Speaker**:
> "Once an image passes the quality gate, it enters our standardized preprocessing engine in `ml/preprocessing/pipeline.py`.
>
> Real skin lesions are frequently occluded by fine body hairs, which confuse convolutional filters.
>
> We implemented the classic **DullRazor algorithm**:
> 1. We apply a $17\times17$ morphological blackhat filter to isolate thin, dark linear hair structures.
> 2. We threshold and dilate this to create a clean hair mask.
> 3. We apply Alexandru Telea fast marching inpainting to smoothly interpolate underlying skin texture.
>
> Next, to handle diverse smartphone lighting without distorting clinical pigments, we apply **CLAHE—Contrast Limited Adaptive Histogram Equalization—strictly to the Luminance (L) channel** in LAB color space. The A and B color channels remain untouched to preserve diagnostic melanin and hemoglobin hues.
>
> Finally, we perform an aspect-preserving center crop, resize to $224\times224$, and apply ImageNet mean and standard deviation normalization, outputting a standardized float32 tensor $[1, 3, 224, 224]$.
>
> In our frontend, clinicians can immediately view the raw capture side-by-side with the preprocessed tensor via our `POST /images/{id}/preprocess` endpoint."

---

#### SLIDE 9: System Architecture, Database & Security (7:25 - 8:25)

> **Speaker**:
> "Let's examine the software architecture.
>
> DermAI is built as a production-grade full-stack monorepo:
> - **Backend**: FastAPI with Python 3.10, SQLAlchemy 2, and Pydantic v2.
> - **Frontend**: React 19 with TypeScript, Tailwind CSS, and Vite.
> - **Database**: PostgreSQL 16 in Docker, and SQLite for zero-setup local dev.
> - **Storage**: Pluggable storage architecture defaulting to local filesystem storage with MinIO S3 support.
>
> Our database has six relational tables: `users`, `patients`, `cases`, `images`, `analyses`, and `audit_logs`.
>
> To comply with clinical privacy standards:
> 1. **Zero Real Patient PII**: Patients are identified strictly by pseudonymous system codes like `PAT-2026-4819`.
> 2. **Role-Based Access Control (RBAC)**: We support five roles—Patient, Clinician, Researcher, ML Engineer, and Admin. Patients can strictly only view their own cases. Clinicians can review all cases across the cohort and append clinical notes.
> 3. **Immutable Audit Trails**: Every registration, login, case creation, and upload generates an audit log recording timestamp, user ID, and IP address."

---

#### SLIDE 10: Verification Results, Live Demo & Roadmap (8:25 - 9:30)

> **Speaker**:
> "To conclude: all objectives and evaluation criteria for Milestone 1 are met:
> - We have 100% automated test coverage across authentication, role isolation, upload validation, quality rejection, and preprocessing contracts.
> - Our Docker Compose environment and Makefile enable one-command reproducibility.
> - Our live web interface demonstrates real-time quality gate feedback and side-by-side preprocessing inspection.
>
> With Milestone 1 successfully established, we are primed for **Milestone 2**, where we will train baseline CNN classifiers (ResNet50 and EfficientNet-B0), evaluate U-Net lesion segmentation, and introduce smartphone datasets like PAD-UFES-20 and SCIN.
>
> I would now be delighted to walk you through our live demonstration and answer any questions you may have.
>
> Thank you."

---

# PART 3: EVALUATOR DEFENSE QUESTIONS & ANSWERS (Q&A CHEAT-SHEET)

### Question 1: "Why did you split the dataset by `lesion_id` instead of a standard `train_test_split`?"
- **Answer**: "In HAM10000, 10,015 images represent only 7,470 unique lesions. Many lesions were photographed multiple times across different visits or angles. A standard random train/test split puts photos of the *same lesion* into both train and test sets. This creates severe feature leakage where the model simply recognizes patient-specific skin features rather than generalizable disease patterns. Grouping by `lesion_id` mathematically guarantees 0 common lesions between train, validation, and test sets, reflecting true clinical generalization."

### Question 2: "Why reject poor quality images instead of letting the neural network handle them?"
- **Answer**: "In clinical AI, outputting a high-confidence prediction on a motion-blurred or washed-out image is dangerous. Convolutional neural networks cannot recover high-frequency diagnostic border details that were lost due to focal blur or flash overexposure. Rejecting poor images at the point of capture empowers the user to immediately hold the camera steady and retake a diagnostic-quality image, eliminating garbage-in/garbage-out clinical errors."

### Question 3: "Why did you apply CLAHE only to the L channel in LAB color space rather than RGB?"
- **Answer**: "Applying histogram equalization directly to RGB channels alters the color balance, turning brownish moles reddish or bluish. In dermatology, the color of a lesion—such as the red of vascular lesions or the variegated dark tones of melanoma—is a critical diagnostic criterion. By converting to LAB and equalizing *only* the Luminance (L) channel, we enhance edge and pigment contrast while preserving true chromatic color ratios on the A and B channels."

### Question 4: "How does DermAI prevent patient privacy violations?"
- **Answer**: "First, the system does not accept real names, telephone numbers, or government IDs. Patients are assigned de-identified identifiers such as `PAT-2026-X`. Second, role-based access control enforces data isolation at the database query level: patient tokens can never retrieve cases belonging to other patient IDs. Third, every read and write is captured in an immutable audit log."
