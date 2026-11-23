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
| **8** | **M4** | **Reports & Notifications** | **Done** | Server-side ReportLab PDF generation (`GET /cases/{id}/report.pdf`), JSON/CSV clinical data exports, in-app notifications (`/api/notifications`), audit logging. | `pytest tests/test_reports.py -v` | None | Proceed to Phase 10: App Launch & Demo Verification. |
| **9** | **M4** | **Testing, Security & Performance** | **Deferred** | (Deferred per Today Mode scope) | - | - | Listed under Planned Work in README.md. |
| **10** | **M4** | **Deployment & Documentation** | **Done** | End-to-end FastAPI backend + React PWA verified, Dockerfile and docker-compose.yml containerized, 13/13 tests passing, demo accounts seeded, 5-step demo checklist documented, GitHub repository sync ready. | `docker compose up -d` or `uvicorn backend.main:app` & `npm run dev` | None | Ready for internship demonstration, viva defense, and cloud deployment. |

---

## 2. Phase Gate Verification Results
- ML Inference: PyTorch EfficientNet-B0 inference with trained weights (`models/efficientnet_b0_best.pt`), Otsu lesion segmentation, Grad-CAM++ saliency heatmap generation, and `configs/risk_map.yaml` risk tiers verified.
- ReportLab PDF export: `GET /api/cases/{id}/report.pdf` verified (valid PDF magic bytes `%PDF`, running headers/footers with mandatory disclaimer, clinical metadata, differential table, and embedded lesion morphology maps).
- JSON export: `GET /api/cases/{id}/report.json` verified with complete patient profile and `"disclaimer": "AI-assisted analysis, not a standalone medical diagnosis."`.
- CSV export: `GET /api/cases/{id}/report.csv` verified with tabular metrics.
- Notification management: `GET /api/notifications`, `POST /api/notifications/{id}/read`, and `POST /api/notifications/read-all` verified.
- Full test suite: `pytest tests/ -v` (13/13 tests passed across all modules).
- Mandatory clinical disclaimer verified on every screen, API response, PDF report, and footer: `"AI-assisted analysis, not a standalone medical diagnosis."`


