# DermAI — System Architecture

> ⚠️ **AI-assisted analysis, not a standalone medical diagnosis.**

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph Clients["👥 Clients"]
        MobileWeb["📱 Mobile Web Browser<br/>(React + PWA)"]
        DesktopWeb["🖥️ Desktop Browser<br/>(React App)"]
        API_Client["🔧 API Client<br/>(Clinician / ML Engineer)"]
    end

    subgraph Gateway["🔀 API Gateway"]
        NGINX["NGINX / Traefik<br/>(TLS termination, rate limit)"]
    end

    subgraph Backend["⚙️ Backend Services"]
        FastAPI["FastAPI<br/>(Python 3.11)<br/>Port 8000"]
        AuthSvc["Auth Service<br/>(JWT + bcrypt)"]
        CaseSvc["Case Service<br/>(CRUD)"]
        ImageSvc["Image Service<br/>(upload + quality)"]
        PreprocSvc["Preprocessing Service<br/>(pipeline.py)"]
        AnalysisSvc["Analysis Service<br/>⏳ STUB — M2"]
        AuditSvc["Audit Logger<br/>(every write)"]
    end

    subgraph DataLayer["💾 Data Layer"]
        PG["PostgreSQL 16<br/>Port 5432"]
        LocalFS["Local Filesystem<br/>backend/storage/<br/>(dev default)"]
        MinIO["MinIO / S3<br/>(optional prod)"]
    end

    subgraph ML["🧠 ML Pipeline"]
        Notebook["EDA Notebooks<br/>(ml/notebooks/)"]
        Pipeline["Preprocessing<br/>(ml/preprocessing/)"]
        Models["Models<br/>⏳ M2 — Training"]
    end

    MobileWeb --> NGINX
    DesktopWeb --> NGINX
    API_Client --> NGINX
    NGINX --> FastAPI
    FastAPI --> AuthSvc
    FastAPI --> CaseSvc
    FastAPI --> ImageSvc
    FastAPI --> PreprocSvc
    FastAPI --> AnalysisSvc
    FastAPI --> AuditSvc
    CaseSvc --> PG
    ImageSvc --> PG
    ImageSvc --> LocalFS
    ImageSvc --> MinIO
    PreprocSvc --> Pipeline
    AnalysisSvc --> Models
    AuditSvc --> PG

    style Clients fill:#E8F4FD,stroke:#0B1F3A
    style Gateway fill:#FFF3E0,stroke:#F39C12
    style Backend fill:#E8F8F5,stroke:#0E9F8E
    style DataLayer fill:#EEE8F8,stroke:#8E44AD
    style ML fill:#FDE8E8,stroke:#E74C3C
```

---

## 2. Request Flow — Image Upload

```mermaid
sequenceDiagram
    autonumber
    actor User as 📱 User
    participant FE as React Frontend
    participant API as FastAPI
    participant QC as Quality Check
    participant PP as Preprocessing
    participant DB as PostgreSQL
    participant FS as File Storage

    User->>FE: Select/capture image
    FE->>FE: Client-side preview & basic check
    User->>FE: Confirm upload
    FE->>API: POST /cases/{id}/images (multipart)
    API->>API: Validate JWT token
    API->>API: Check format (JPG/PNG), size ≤10MB
    API->>QC: Compute blur, brightness, contrast
    QC-->>API: quality_label + quality_metrics_json
    alt quality_label == "Poor"
        API-->>FE: 422 — "Image too blurry, please retake"
        FE-->>User: Show retake message with reason
    else quality_label in Good / Acceptable
        API->>FS: Save original file
        API->>DB: INSERT images row
        API->>DB: INSERT audit_log row
        API-->>FE: 201 — image record + quality info
        FE-->>User: Show quality badge + preprocessed preview
    end
```

---

## 3. Deployment Architecture (Milestone 1 — Local Docker)

```mermaid
graph LR
    subgraph docker["🐳 docker compose (local dev)"]
        web_container["web container<br/>Vite dev server<br/>Port 5173"]
        api_container["api container<br/>FastAPI + uvicorn<br/>Port 8000"]
        db_container["db container<br/>PostgreSQL 16<br/>Port 5432"]
        minio_container["minio container<br/>(optional)<br/>Port 9000"]
    end
    Browser["Browser"] --> web_container
    Browser --> api_container
    api_container --> db_container
    api_container --> minio_container

    style docker fill:#F0F8FF,stroke:#2980B9
```

---

## 4. Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **API Framework** | FastAPI | Async, auto OpenAPI docs, Pydantic v2 validation |
| **ORM** | SQLAlchemy 2 | Async sessions, type-safe, Alembic migration support |
| **Auth** | JWT (HS256) + bcrypt | Stateless tokens; industry standard |
| **Database** | PostgreSQL 16 | JSON columns for metrics; full ACID; JSONB indexing |
| **Storage** | Local FS → MinIO | Start simple; abstract via `STORAGE_BACKEND` env var |
| **Frontend** | React + Vite + TypeScript | Fast HMR; type safety; large ecosystem |
| **Styling** | Tailwind CSS | Utility-first; responsive; no CSS battles |
| **ML** | NumPy + OpenCV + Pillow | Standard; no heavy framework for preprocessing |
| **Container** | Docker + compose | Reproducible; one-command startup |

---

## 5. Security Design

| Concern | Mitigation |
|---------|-----------|
| Authentication | JWT with short expiry (30min access) + refresh tokens |
| Authorization | Role-based middleware (`require_role`) per endpoint |
| Data privacy | No real patient data in dev; de-identified records only |
| Secrets | All credentials in `.env` (excluded from Git) |
| Upload safety | File type check (magic bytes), size limit, sanitized filenames |
| Audit trail | Every write logged to `audit_logs` with user + IP + timestamp |
| CORS | Restricted to `CORS_ORIGINS` env variable |
| SQL injection | SQLAlchemy ORM (parameterized queries) |
