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
| **2** | **M1** | **Data & EDA** | **Done** | HAM10000 10,015 records parsed; 70/15/15 split grouped strictly by `lesion_id` to prevent data leakage (`data/splits/`); unit test proving 0% lesion overlap; EDA notebook; `docs/02_dataset.md`. | `pytest tests/test_splits.py -v`, `python scripts/make_splits.py` | None (zero overlap verified) | Proceed to Phase 4: Baseline Classifier. |
| **3** | **M2** | **Lesion Segmentation** | **Deferred** | (Deferred per Today Mode scope: Otsu classical segmentation used in Phase 6) | - | - | Listed under Planned Work. |
| **4** | **M2** | **Baseline Classifier (EfficientNet-B0)** | **Done** | `ml/configs/efficientnet_b0.yaml`, `configs/risk_map.yaml`, `ml/train.py` with `--smoke` flag, `ml/evaluate.py`, `models/efficientnet_b0_best.pt`, real metrics in `models/metrics.json` and `reports/model_comparison.md`. | `python ml/train.py --arch efficientnet_b0 --smoke`, `python ml/evaluate.py` | None (smoke model trained & evaluated) | Proceed to Phase 6: Inference Service & Model Registry. |
| **5** | **M3** | **Advanced AI & Explainability** | **Deferred** | (Deferred per Today Mode scope: Grad-CAM++ integrated in Phase 6) | - | - | Listed under Planned Work. |
| **6** | **M3/M4** | **Inference Service & Model Management** | **Done** | `POST /cases/{id}/analyze` orchestration: OpenCV DullRazor + CLAHE, classical Otsu lesion segmentation, PyTorch EfficientNet-B0 classification, Grad-CAM++ heatmap overlay, `configs/risk_map.yaml` calibrated risk tiers, "No trained model available" fallback, Model Registry API (`GET /models`, `POST /models/{id}/activate`). | `pytest tests/test_analysis.py -v` | None (all tests green) | Proceed to Phase 7: Frontend PWA. |
| **7** | **M4** | **Frontend PWA** | **Done** | React + Vite + TypeScript PWA fully connected to FastAPI REST backend (auth, case management, direct ML prediction proxy, model registry synchronization). Production PWA built cleanly. | `npm.cmd run build` & `npm.cmd run dev` | None | Proceed to Phase 8: Reports & Notifications. |
| **8** | **M4** | **Reports & Notifications** | **In Progress** | Server-side ReportLab PDF generation, JSON/CSV exports, in-app notifications. | `pytest tests/test_reports.py -v` | None | Implement `backend/routers/reports.py` and `backend/routers/notifications.py`. |
| **9** | **M4** | **Testing, Security & Performance** | **Deferred** | (Deferred per Today Mode scope) | - | - | Listed under Planned Work. |
| **10** | **M4** | **Deployment & Documentation** | **Todo** | - | `python backend/main.py` | None | Run end-to-end app and produce 5-step demo checklist. |

---

## 2. Phase 7 Gate Verification Results
- Frontend production bundle compile: `npm.cmd run build` passed with zero errors (built client environment in 2.51s, PWA service worker generated).
- FastAPI backend authentication: `/auth/login`, `/auth/register`, `/auth/me` with Argon2 hashing and JWT token exchange.
- Model registry & direct ML prediction: `/api/models` and `/api/ml/predict` connected.
- Full test suite: `pytest tests/ -v` (9/9 passed in 3.10s).
- Mandatory clinical disclaimer on all responses: `"AI-assisted analysis, not a standalone medical diagnosis."`

