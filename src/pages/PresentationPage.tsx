import React, { useState } from 'react';
import { Presentation, ExternalLink, Printer, ChevronLeft, ChevronRight, MessageSquareQuote } from 'lucide-react';

export const PresentationPage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(1);
  const totalSlides = 10;
  const [showScript, setShowScript] = useState(true);

  const slidesData = [
    {
      num: 1,
      kicker: 'Milestone 1 · Project Defense Presentation',
      title: 'DermAI: Skin Disease Detector from Mobile Images Using Deep Learning',
      subtitle: 'Project Initialization, Dataset Diagnostics & Core Medical Pipeline Setup',
      points: [
        'Automated dermatological screening and decision-support platform for mobile smartphone images.',
        'Core Milestone 1 Deliverables: Monorepo architecture, HAM10000 diagnostics, zero-leakage splits, relational schema, JWT auth with 5 roles, intake quality gate, and DullRazor preprocessing pipeline.',
        'Strict regulatory positioning: Screening and clinical assistance; never a standalone medical diagnosis.',
      ],
      script:
        'Good morning evaluators. Today I am proud to present DermAI: Skin Disease Detector from Mobile Images Using Deep Learning. In this presentation, I will walk you through the completion of Milestone 1: project initialization, dataset diagnostics, and core medical pipeline setup. Notice our mandatory disclaimer on every slide: "AI-assisted analysis, not a standalone medical diagnosis." DermAI is an automated decision-support system to assist clinicians and patients, not an autonomous replacement for clinical examination.',
    },
    {
      num: 2,
      kicker: 'Clinical Motivation & Challenges',
      title: 'The Clinical Urgency & The Mobile Dermatology Gap',
      subtitle: 'Why consumer mobile dermatology requires a dedicated engineering pipeline',
      points: [
        'Melanoma Urgency: 5-year survival is >98% when caught in early intraepidermal stages, but collapses below 30% once metastatic.',
        'Access Bottleneck: Geographic shortages lead to 3–6 month specialist referral wait times in public healthcare.',
        'The Domain Shift Gap: Academic models are trained on dermoscopic epiluminescence contact images, while real patients capture smartphone photos with motion blur, poor illumination, flash glare, and occluding body hairs.',
      ],
      script:
        'Skin disease is a massive global burden. Melanoma survival exceeds 98% when caught early, but drops below 30% when metastatic. However, patients face 3 to 6-month wait times to see dermatologists. Furthermore, there is a severe domain shift: academic models are trained on pristine dermoscopic images taken with uniform immersion lenses, whereas real patients take smartphone photos with blur, bad lighting, and hair occlusions. DermAI bridges this exact gap.',
    },
    {
      num: 3,
      kicker: 'System Architecture',
      title: 'End-to-End Mobile-to-Clinical Workflow',
      subtitle: 'Standardized 6-Stage Pipeline: Screen Before You Predict',
      points: [
        '1. Mobile Capture: HTML5 camera capture or gallery selection on mobile/web.',
        '2. Real-Time Quality Gate: Computer vision evaluation of blur, luminance, contrast, and resolution. Poor photos are rejected with retake instructions.',
        '3. Secure Intake: Cryptographic JWT authentication, de-identified patient metadata, and immutable audit logs.',
        '4. Medical Preprocessing: DullRazor hair removal inpainting, L-channel CLAHE contrast, center crop & 224x224 ImageNet tensor normalization.',
        '5. AI Model Inference: Multi-class CNN and Vision Transformers (Milestones 2–3).',
      ],
      script:
        'DermAI addresses this domain gap through a disciplined end-to-end workflow. Rather than blindly passing raw smartphone photos into a neural network, we enforce: Screen before you predict. The user snaps or uploads a photo, our computer vision algorithms immediately evaluate blur, brightness, contrast, and resolution. Poor images are rejected with actionable guidance. Approved images undergo DullRazor hair inpainting and CLAHE normalization before entering deep learning models.',
    },
    {
      num: 4,
      kicker: 'Scope Boundaries & Deliverables',
      title: 'Milestone 1 Scope vs. Project Roadmap',
      subtitle: 'Strict adherence to project initialization and core pipeline foundations',
      points: [
        'Completed in Milestone 1: Monorepo scaffold (FastAPI + React 19 + Docker Compose), HAM10000 ingestion, grouped lesion_id stratification, 6-table relational schema, 5 RBAC roles, image quality gate, and preprocessing pipeline.',
        'Deferred to Milestone 2: U-Net lesion segmentation, baseline CNN classifiers (ResNet50, EfficientNet), focal loss tuning.',
        'Deferred to Milestone 3: Vision Transformers (ViT, Swin), Grad-CAM explainability, and risk categorization.',
        'Deferred to Milestone 4: Multi-model ensemble, automated PDF reports, and cloud deployment.',
      ],
      script:
        'As required by the project specifications, we have strictly focused today on Milestone 1: Project Initialization, Dataset & Core Setup. Today we have completed the monorepo architecture, full ingestion and EDA of 10,015 HAM10000 records, leakage-free splits, relational schema, JWT auth, the quality gate, and the preprocessing pipeline. We have intentionally deferred deep learning models, U-Net segmentation, Grad-CAM attention heatmaps, and automated PDF clinical reports to Milestones 2, 3, and 4.',
    },
    {
      num: 5,
      kicker: 'Dataset Selection & Analysis',
      title: 'HAM10000 Benchmark & Severe Class Imbalance',
      subtitle: '10,015 images across 7 target disease categories',
      points: [
        'Extreme Imbalance: Melanocytic Nevus (nv) represents 66.95% (6,705 images) of the dataset.',
        'Critical Malignancies: Melanoma (mel) represents 11.11% (1,113 images); Basal Cell Carcinoma (bcc) is 5.13% (514 images).',
        'Pre-Cancerous & Rare: Actinic Keratosis (akiec) 3.27%, Vascular Lesions (vasc) 1.42%, Dermatofibroma (df) 1.15%.',
        'Mitigation: Balanced training weights computed (e.g. nv: 0.21, mel: 1.29, df: 12.44) to penalize missed malignancies during loss computation.',
      ],
      script:
        'For our benchmark foundation, we ingested the official HAM10000 dataset containing 10,015 images across seven distinct diagnostic categories. Over 53% are verified by histopathology biopsy. Our analysis reveals extreme class imbalance: benign melanocytic nevi represent 67% of the dataset, while malignant melanomas make up 11% and rare vascular lesions only 1.4%. To prevent models from defaulting to nevus predictions, we computed balanced class weights in Milestone 1 ranging from 0.21 for nevi up to 12.44 for dermatofibromas.',
    },
    {
      num: 6,
      kicker: 'Methodological Rigor',
      title: 'Eliminating The Lesion ID Leakage Trap',
      subtitle: 'Grouped Stratified Splitting to ensure clinical validity',
      points: [
        'The Leakage Trap: 10,015 images represent only 7,470 unique lesions (up to 6 photos per lesion across follow-up visits).',
        'Standard random 80/20 train/test splitting leaks photos of the same lesion into both train and test partitions, yielding artificial ~96% test accuracy.',
        'DermAI Grouped Stratification (scripts/make_splits.py): Enforces that all photos of any given lesion_id reside strictly in one partition.',
        'Splits: Train 70.03% (7,014 imgs / 5,230 lesions) · Val 14.97% (1,499 imgs / 1,120 lesions) · Test 15.00% (1,502 imgs / 1,120 lesions). Verified 0 common lesions.',
      ],
      script:
        'This is one of our most important technical safeguards. In HAM10000, 10,015 images come from only 7,470 unique lesions because patients had multiple photos taken over time. Standard random train/test splits place different photos of the same patient lesion into both train and test sets, causing feature leakage where models memorize patient skin traits rather than generalizable disease features. In DermAI, we engineered scripts/make_splits.py to group strictly by lesion_id. We verified 0 common lesions between train, validation, and test splits.',
    },
    {
      num: 7,
      kicker: 'Intake Quality Gate',
      title: 'Pre-Inference Computer Vision Quality Screening',
      subtitle: 'Deterministic algorithms to screen out defective mobile inputs',
      points: [
        'Blur Detection: Laplacian operator variance Var(Laplacian). Variance < 50.0 is flagged as Poor and rejected.',
        'Luminance & Exposure: Mean grayscale level. Mean < 35.0 (underexposed) or > 230.0 (flash washout) is rejected.',
        'Contrast Check: Grayscale standard deviation. Std < 18.0 (low contrast, indistinct lesion borders) is rejected.',
        'Resolution & Format: Enforces minimum 224x224 pixels, max 10MB, valid JPEG/PNG.',
        'Actionable Feedback: Instructs user: "Hold phone steady; illuminate lesion; avoid flash reflection."',
      ],
      script:
        'Mobile phone photos often suffer from blur, lighting extremes, and low resolution. Our intake quality gate applies computer vision algorithms synchronously on upload: Laplacian variance detects motion blur with a cutoff of 50; mean gray level screens out dark or flash-washed images; contrast standard deviation ensures border visibility; and resolution must be at least 224x224. Images scoring Poor are rejected with direct advice on how to retake the photo.',
    },
    {
      num: 8,
      kicker: 'Medical Image Processing',
      title: 'Standardized Preprocessing Engine (DullRazor + CLAHE)',
      subtitle: 'Artifact removal and tensor standardization in ml/preprocessing/pipeline.py',
      points: [
        'EXIF Auto-Orientation: Transposes orientation tags from smartphone cameras.',
        'DullRazor Hair Inpainting: 17x17 morphological blackhat structuring element isolates dark hairs; Telea inpainting smoothly restores skin texture.',
        'L-Channel CLAHE: Adaptive contrast enhancement strictly on the Luminance (L) channel in LAB color space, preserving chromatic melanin/hemoglobin pigments.',
        'Center Square Crop & Resize: Aspect-ratio preserving scaling to 224x224x3.',
        'Standardization: ImageNet mean and std normalization producing model tensor [1, 3, 224, 224].',
        'Visual Verification: Endpoint POST /images/{id}/preprocess enables side-by-side inspection in UI.',
      ],
      script:
        'Once an image passes the quality gate, it enters our clinical preprocessing pipeline in ml/preprocessing/pipeline.py. We implemented DullRazor morphological blackhat filtering and Telea inpainting to remove occluding body hairs. To handle lighting variance without corrupting diagnostic color, we apply CLAHE strictly to the Luminance channel in LAB color space, preserving A and B chromatic pigments. The image is cropped, resized to 224x224, and standardized to ImageNet mean and variance, yielding a ready float32 tensor [1, 3, 224, 224].',
    },
    {
      num: 9,
      kicker: 'Software Engineering & Governance',
      title: 'Multi-Tier Architecture, Schema & RBAC Security',
      subtitle: 'HIPAA & GDPR aligned clinical data isolation',
      points: [
        'Tech Stack: FastAPI (Python 3.10), SQLAlchemy 2, Pydantic v2, PostgreSQL 16 / SQLite, React 19, TypeScript, Tailwind.',
        '6 Relational Tables: users, patients (strictly de-identified), cases, images, analyses, audit_logs.',
        '5 RBAC Roles: Patient (isolated personal cases), Clinician (all cohort cases + notes), Researcher (trends), ML Engineer (pipelines), Admin (audit logs).',
        'Data Privacy: Zero real patient PII accepted. Alphanumeric codes (e.g. PAT-2026-X) assigned.',
        'Audit Logging: Immutable tracking of registration, logins, case creation, and image uploads.',
      ],
      script:
        'The full-stack platform is designed around enterprise clinical security and privacy. We use FastAPI, PostgreSQL 16, and React 19. Our relational schema contains 6 tables with strictly de-identified patient data—zero real patient names or PII are accepted. We support 5 distinct roles: Patient, Clinician, Researcher, ML Engineer, and Admin. Patients can only query their own records, clinicians can review all cohort cases, and every action is recorded in an immutable audit log.',
    },
    {
      num: 10,
      kicker: 'Verification & Future Milestones',
      title: 'Milestone 1 Completion & Transition to Model Training',
      subtitle: 'All evaluation criteria met; ready for Milestone 2',
      points: [
        'Verification: 6/6 automated backend pytest tests pass (Health, Auth, RBAC isolation, Upload validation, Quality rejection, Preprocessing contract).',
        'Zero Leakage Verified: Grouped 70/15/15 splits by lesion_id with 0 shared lesions.',
        'Operational UI: Live role switching, drag-and-drop intake, side-by-side preprocessing inspection.',
        'Milestone 2 Next Steps: Train baseline CNN classifiers (ResNet50, EfficientNet), implement U-Net lesion segmentation, and introduce smartphone datasets (PAD-UFES-20 and SCIN).',
        'Mandatory Notice: AI-assisted analysis, not a standalone medical diagnosis.',
      ],
      script:
        'In conclusion, Milestone 1 is completely operational. All 6 automated backend tests pass, the web application is running with live quality assessment and side-by-side inspection, and our dataset is prepared with zero leakage. We are fully primed for Milestone 2, where we will train baseline CNN classifiers like ResNet50 and EfficientNet, implement U-Net lesion segmentation, and introduce smartphone datasets like PAD-UFES-20 and SCIN. Thank you, and I look forward to your questions.',
    },
  ];

  const current = slidesData[currentSlide - 1];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0B1F3A] flex items-center justify-center text-teal-400">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0B1F3A]">DermAI Project Presentation Deck</h1>
            <p className="text-xs text-slate-500">10 Structured Defense Slides with Verbatim Oral Script</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScript(!showScript)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
              showScript ? 'bg-teal-50 text-teal-800 border-teal-300' : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5 text-teal-600" />
            <span>{showScript ? 'Hide Speaker Script' : 'Show Speaker Script'}</span>
          </button>
          <a
            href="/docs/presentation.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#16365C] flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Standalone Slides</span>
          </a>
        </div>
      </div>

      {/* Slide Navigation Strip */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            disabled={currentSlide === 1}
            onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={currentSlide === totalSlides}
            onClick={() => setCurrentSlide(Math.min(totalSlides, currentSlide + 1))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-700 ml-2">
            Slide {currentSlide} of {totalSlides}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {slidesData.map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentSlide(s.num)}
              className={`w-7 h-7 rounded text-xs font-mono font-semibold transition-colors ${
                currentSlide === s.num
                  ? 'bg-[#0E9F8E] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.num}
            </button>
          ))}
        </div>
      </div>

      {/* Slide Card Viewport */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-8 space-y-6 min-h-[420px] flex flex-col justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-teal-700 font-mono mb-1">
            {current.kicker}
          </div>
          <h2 className="text-2xl font-extrabold text-[#0B1F3A] tracking-tight">{current.title}</h2>
          <div className="text-sm font-semibold text-slate-600 mt-1">{current.subtitle}</div>

          <div className="mt-6 space-y-3">
            {current.points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0 mt-1.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>DermAI Platform · Milestone 1</span>
          <span className="text-amber-800 font-medium">Notice: AI-assisted analysis, not a standalone medical diagnosis.</span>
          <span className="font-mono">Slide {current.num} / {totalSlides}</span>
        </div>
      </div>

      {/* Live Verbatim Speaker Script Box */}
      {showScript && (
        <div className="bg-[#0B1F3A] rounded-xl p-6 text-white space-y-2 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-teal-400">
            <span>Verbatim Speaker Script for Slide {current.num} (What to Say)</span>
            <span className="font-mono text-slate-400">Target Time: ~45–60 sec</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed italic bg-white/5 p-4 rounded-lg border border-white/10">
            "{current.script}"
          </p>
        </div>
      )}
    </div>
  );
};
