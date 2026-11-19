# DermAI: Project Progress & Memory Tracker

**Project:** DermAI: Skin Disease Detector from Mobile Images Using Deep Learning  
**Internship:** Infosys Springboard  
**Specification Source:** `docs/DermAI_spec.pdf` (19 Modules, 4 Milestones)  
**Mandatory Clinical Disclaimer:** "AI-assisted analysis, not a standalone medical diagnosis."

---

## 1. Master Phase Tracker

| Phase | Milestone | Title | Status | What Was Built | How to Run | Known Issues / Gaps | Exact Next Step |
|---|---|---|---|---|---|---|---|
| **0** | **M1** | **Setup & Audit** | **Done** | Complete audit of 19 spec modules in `docs/AUDIT.md`, `AGENTS.md` protocol rules, `.env.example`, `.gitignore`, `Makefile`, initialized Git repository. | View `docs/AUDIT.md` & `AGENTS.md` | None | Proceed to Phase 1. |
| **1** | **M1** | **Foundation: App Skeleton & Core Services** | **Done** | Argon2 password hashing, JWT access + refresh tokens, OAuth2 login (`/auth/login`, `/auth/token`, `/auth/refresh`), RBAC for 5 roles, de-identified patient/case isolation, upload validation, quality gate, OpenCV preprocessing pipeline, `Notification` and `ModelRegistry` DB models, `scripts/seed.py`. | `pytest tests/test_backend.py -v`, `python scripts/seed.py` | None (6/6 tests passing) | Proceed to Phase 2: Data & EDA. |
| **2** | **M1** | **Data & EDA** | **In Progress** | Grouped 70/15/15 splits by `lesion_id`, zero-overlap test, EDA notebook. | `python scripts/make_splits.py` | None | Implement zero-overlap unit test and verify dataset splits. |
| **3** | **M2** | **Lesion Segmentation** | **Deferred** | (Deferred per Today Mode scope: Otsu classical segmentation used in Phase 6) | - | - | Listed under Planned Work. |
| **4** | **M2** | **Baseline Classifier (EfficientNet-B0)** | **Todo** | - | `python ml/train.py --smoke`, `python ml/evaluate.py` | Need YAML config, training script with `--smoke`, evaluate.py | Implement EfficientNet-B0 training and evaluation. |
| **5** | **M3** | **Advanced AI & Explainability** | **Deferred** | (Deferred per Today Mode scope: Grad-CAM++ integrated in Phase 6) | - | - | Listed under Planned Work. |
| **6** | **M3/M4** | **Inference Service & Model Management** | **Todo** | - | `POST /cases/{id}/analyze`, `GET /models` | None | Orchestrate analysis with Otsu segmentation, Grad-CAM++, model registry. |
| **7** | **M4** | **Frontend PWA** | **Todo** | - | `npm run dev` | None | Connect React frontend to FastAPI REST backend without Firebase. |
| **8** | **M4** | **Reports & Notifications** | **Todo** | - | `GET /cases/{id}/report.pdf` | None | Implement ReportLab PDF generator and notification endpoints. |
| **9** | **M4** | **Testing, Security & Performance** | **Deferred** | (Deferred per Today Mode scope) | - | - | Listed under Planned Work. |
| **10** | **M4** | **Deployment & Documentation** | **Todo** | - | `python backend/main.py` | None | Run end-to-end app and produce 5-step demo checklist. |

---

## 2. Phase 1 Gate Verification Results
- `pytest tests/test_backend.py -v`: 6 passed in 4.09s
- Role isolation: Verified (Patients cannot view other patients' cases; Clinicians can view cohort)
- Password hashing: Verified with Argon2id (`argon2.PasswordHasher`)
- Refresh token flow: Verified with `/auth/refresh`
- Seed script: 5 demo accounts created with Argon2 hashes (`scripts/seed.py`)
