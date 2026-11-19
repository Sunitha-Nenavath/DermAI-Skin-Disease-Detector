# DermAI: Project Progress & Memory Tracker

**Project:** DermAI: Skin Disease Detector from Mobile Images Using Deep Learning  
**Internship:** Infosys Springboard  
**Specification Source:** `docs/DermAI_spec.pdf` (19 Modules, 4 Milestones)  
**Mandatory Clinical Disclaimer:** "AI-assisted analysis, not a standalone medical diagnosis."

---

## 1. Master Phase Tracker

| Phase | Milestone | Title | Status | What Was Built | How to Run | Known Issues / Gaps | Exact Next Step |
|---|---|---|---|---|---|---|---|
| **0** | **M1** | **Setup & Audit** | **Done** | Complete audit of 19 spec modules in `docs/AUDIT.md`, `AGENTS.md` protocol rules, `.env.example`, `.gitignore`, `Makefile`, initialized Git repository. | View `docs/AUDIT.md` & `AGENTS.md` | None | Wait for user confirmation on audit recommendation before proceeding to Phase 1. |
| **1** | **M1** | **Foundation: App Skeleton & Core Services** | **Todo** | - | `make test`, `docker compose up`, `curl` endpoints | Missing argon2 auth, refresh tokens, Alembic migrations, Notification/Model tables | Implement argon2, refresh tokens, Alembic migrations, and verify Phase 1 gate. |
| **2** | **M1** | **Data & EDA** | **Todo** | - | `python scripts/make_splits.py`, inspect `ml/notebooks/01_eda.ipynb` | Need test asserting 0% lesion overlap; Kaggle HAM10000 download guide | Run EDA, generate verified grouped splits, write `docs/02_dataset.md`. |
| **3** | **M2** | **Lesion Segmentation** | **Todo** | - | `python ml/train_segmentation.py --smoke` | Missing U-Net training script on ISIC 2018 Task 1 | Implement U-Net (ResNet34) Dice+BCE training with `--smoke` flag. |
| **4** | **M2** | **Baseline Classifiers** | **Todo** | - | `python ml/train.py --smoke`, `python ml/evaluate.py` | Need YAML configs, 4 timm models (ResNet50, DenseNet121, EfficientNet-B0, MobileNetV3) | Create `ml/configs/`, staged training, generate `reports/model_comparison.md`. |
| **5** | **M3** | **Advanced AI & Explainability** | **Todo** | - | `pytest tests/test_explain.py` | Missing Swin/ViT/DeiT models, ensemble, temperature scaling, Grad-CAM/Captum overlap | Implement ViT/Swin, 2-model ensemble, temperature scaling, `configs/risk_map.yaml`, Grad-CAM. |
| **6** | **M3/M4** | **Inference Service & Model Management** | **Todo** | - | `POST /cases/{id}/analyze`, `GET /models` | Need integration pipeline and strict "No trained model available" fallback | Build unified analysis orchestration and model registry database API. |
| **7** | **M4** | **Frontend PWA** | **Todo** | - | `npm run dev`, `npx playwright test` | Remove Firebase auth dependency, connect directly to FastAPI JWT tokens | Unify auth flow, connect camera analysis, verify Playwright smoke test. |
| **7B** | **M4** | **Expo React Native App (Optional)** | **Todo** | - | `npx expo start` | Optional phase if time permits | Scaffold mobile app using shared API if scheduled. |
| **8** | **M4** | **Reports & Notifications** | **Todo** | - | `GET /cases/{id}/report.pdf` | Missing server-side ReportLab PDF generator with disclaimer; notification router | Implement ReportLab PDF/JSON/CSV exports and notification system. |
| **9** | **M4** | **Testing, Security & Performance** | **Todo** | - | `pytest --cov`, `locust -f tests/load_test.py` | Need full test coverage report, OWASP security pass, load tests | Run full security/regression pass and document fixes table. |
| **10** | **M4** | **Deployment & Documentation** | **Todo** | - | `docker compose -f docker-compose.prod.yml up` | Need Prometheus/logging, GitHub Actions CI/CD, deployment guide, demo script | Prepare production Dockerfiles, CI workflow, final demo script, viva cards. |

---

## 2. Phase 0 Audit Summary

- **Total Spec Modules:** 19
- **Modules Done (Substantially Complete):** 7 (Modules 2, 3, 4, 11, 13, 14, 16)
- **Modules Partial:** 10 (Modules 1, 5, 6, 8, 9, 10, 12, 15, 17, 18)
- **Modules Missing:** 2 (Module 7: Advanced Deep Learning Intelligence Engine; Module 19: CI/CD & Production Hardening)
- **Recommendation:** **KEEP AND REFINE** the existing codebase. Preserve high-quality UI and OpenCV preprocessing, while completing the ML training, evaluation, explainability, ReportLab, and testing modules phase by phase.

---

## 3. Session Resumption Guide
At the start of any new session:
1. Open this file (`docs/PROGRESS.md`) first.
2. Check the row marked **In Progress** or the first **Todo**.
3. Follow the instructions in `AGENTS.md` (one phase at a time, gate verification, stop for user confirmation).
