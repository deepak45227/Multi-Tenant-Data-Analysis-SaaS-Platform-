# Django Multi-Tenant Data Analysis SaaS Platform

A production-style, multi-tenant analytics platform built with Django REST Framework, DuckDB, Celery, Redis, and React.  
The system is designed to support full analytics workflows per organization: dataset ingestion, transformation pipelines, SQL querying, chart/dashboard execution, and scheduled report delivery.

## Table of Contents
1. Project Overview
2. Core Backend Capabilities
3. Backend Architecture
4. Tech Stack and Libraries
5. Backend Project Structure
6. Data Model (Backend)
7. Authentication and Authorization
8. API Reference
9. Dataset Versioning and Transformation Flow
10. Async Jobs and Scheduling
11. Backend Setup and Run Guide
12. Environment Variables
13. Deployment Notes
14. Frontend Overview (Concise)
15. Additional Documentation

## Project Overview

This platform is tenant-aware by organization. Every major backend resource is tied to an organization context:

- Users belong to one or more organizations (via memberships).
- Datasets are uploaded per organization and ingested into organization-specific DuckDB files.
- Queries, charts, dashboards, and reports operate inside an organization boundary.
- Role-based permissions are enforced at API level.

## Core Backend Capabilities

- Custom user auth with JWT access/refresh tokens.
- Organization and membership management.
- Secure dataset upload and versioning (`BASE`, `LATEST`, `HISTORICAL`).
- No-code + SQL hybrid transformation pipeline.
- SQL query execution with execution history logging.
- Chart execution from saved queries.
- Dashboard execution with parallel chart evaluation and cache.
- Report creation + async trigger + email delivery.
- Celery worker integration for ingestion and reporting tasks.

## Backend Architecture

### High-level flow

1. User authenticates via JWT.
2. User selects an organization.
3. Dataset file is uploaded and ingested asynchronously into DuckDB.
4. User builds transformation steps and applies them to create version updates.
5. User runs ad-hoc/saved SQL queries against active dataset versions.
6. Queries feed charts; charts feed dashboards.
7. Dashboards are delivered manually or by scheduled report tasks.

### Multi-tenant storage strategy

- Relational metadata: PostgreSQL (Django ORM models).
- Analytical compute: DuckDB, one file per organization (`org_<id>.duckdb`).
- Raw uploaded files: filesystem under organization folders.

## Tech Stack and Libraries

### Backend framework

- Django `5.2.11`
- Django REST Framework `3.16.1`
- SimpleJWT (`djangorestframework_simplejwt`) for JWT auth

### Async and scheduling

- Celery `5.6.2`
- Redis `7.x` broker/result backend
- `django-celery-beat` for periodic task scheduling

### Data and query engine

- DuckDB `1.4.4` for fast analytical queries
- PostgreSQL via `psycopg2-binary`

### Infra and deployment helpers

- Gunicorn
- WhiteNoise (static serving)
- `python-dotenv` for env loading
- `django-cors-headers` for API CORS

### Testing and dev

- `pytest`, `pytest-django`
- `django-extensions`

## Backend Project Structure

`backend/`

- `config/`: Django project settings, URL routing, Celery bootstrap.
- `accounts/`: custom user model and registration API.
- `organizations/`: organizations, memberships, role permission checks.
- `datasets/`: upload, ingestion, versioning, transformation pipeline.
- `query/`: saved/ad-hoc SQL APIs, execution logging.
- `visualization/`: chart and dashboard APIs + metadata endpoints.
- `report/`: report CRUD + trigger + scheduled report tasks.
- `analytics/`, `ai_engine/`: currently minimal/placeholder modules.
- `storage/uploads/`: uploaded source files.
- `storage/duckdb/`: per-organization DuckDB databases.

## Data Model (Backend)

### Accounts

- `User` extends `AbstractUser`.
- Email is unique and used as `USERNAME_FIELD`.

### Organizations

- `Organization`: tenant unit with `owner`.
- `Membership`: user-org relationship with `role` (`admin`, `member`).

### Datasets

- `Dataset`: logical dataset object under organization.
- `DatasetVersion`:
  - `BASE`: original ingested table
  - `LATEST`: latest materialized transformed table
  - `HISTORICAL`: metadata + SQL history snapshot
- `IngestionJob`: tracks async ingestion task status.
- `EditingSession`: holds staged transformation steps.

### Query and visualization

- `SavedQuery`: reusable SQL tied to dataset/org.
- `QueryExecution`: audit/history of query runs (success/fail, duration, row count).
- `Chart`: visualization definition using a saved query.
- `Dashboard`: collection of charts.
- `DashboardChart`: placement/layout metadata for charts in dashboards.

### Reporting

- `Report`: dashboard-linked report with frequency, recipients, active flag.

## Authentication and Authorization

### JWT endpoints

- `POST /api/token/`
- `POST /api/token/refresh/`

### Access model

- Most APIs require JWT (`IsAuthenticated`).
- Permission checks use organization context and role capabilities (`check_permission`).
- Owner has full access; admins and members are capability-limited.

## API Reference

Base URL prefix: `/api`

### Accounts

- `POST /api/accounts/register/`  
  Register user with `email`, `username`, `password`.

### Organizations

- `POST /api/organizations/create/`
- `GET /api/organizations/`
- `GET /api/organizations/members/<org_id>/`
- `POST /api/organizations/members/<org_id>/add-member/`
- `PATCH /api/organizations/members/<membership_id>/update-role/`
- `DELETE /api/organizations/members/<membership_id>/delete/`
- `POST /api/organizations/organizations/<org_id>/transfer-ownership/`

### Datasets

- `POST /api/datasets/upload/` (multipart file upload)
- `GET /api/datasets/list/?organization=<org_id>`
- `GET /api/datasets/preview/<version_id>/`
- `POST /api/datasets/edit/start/<dataset_id>/`
- `POST /api/datasets/edit/add-step/<session_id>/`
- `GET /api/datasets/edit/preview/<session_id>?limit=50`
- `POST /api/datasets/edit/undo/<session_id>/`
- `POST /api/datasets/edit/apply/<session_id>/`
- `POST /api/datasets/rollback/<dataset_id>/<version_id>/`

### Query

- `GET /api/queries/`
- `POST /api/queries/`
- `GET /api/queries/<query_id>/`
- `PATCH /api/queries/<query_id>/`
- `DELETE /api/queries/<query_id>/`
- `POST /api/queries/<query_id>/execute/`
- `POST /api/queries/execute/`
- `GET /api/query-executions/?query_id=<id>&status=success|failed`

### Visualization

- `GET /api/charts/`
- `POST /api/charts/create/`
- `GET /api/charts/<chart_id>/execute/`
- `DELETE /api/charts/<chart_id>/delete/`
- `GET /api/dashboards/`
- `POST /api/dashboards/create/`
- `GET /api/dashboards/<dashboard_id>/execute/`
- `POST /api/dashboards/add-chart/`
- `DELETE /api/dashboards/<dashboard_id>/delete/`
- `GET /api/datasets/<dataset_id>/metadata/`

### Reports

- `GET /api/reports/`
- `POST /api/reports/`
- `GET /api/reports/<report_id>/`
- `PATCH /api/reports/<report_id>/`
- `DELETE /api/reports/<report_id>/`
- `POST /api/reports/<report_id>/trigger/`

## Dataset Versioning and Transformation Flow

### Ingestion

1. Upload file creates `Dataset` + `BASE` `DatasetVersion` (`version_number=0`).
2. Celery task ingests CSV into DuckDB table:
   - `dataset_<dataset_uuid_hex>_base`
3. Schema is captured and version marked `SUCCESS`.
4. Version is activated and assigned as `dataset.active_version`.

### Editing pipeline

- Session starts from active/base version.
- Steps are appended as:
  - `visual` operations (remove nulls, change type, filter, merge datasets, etc.)
  - `sql` step (SELECT-only, with `FROM data|dataset` substitution)
- Preview compiles SQL and executes with row limit.
- Apply creates/updates physical `LATEST` table and writes a new `HISTORICAL` record.
- Old historical versions are pruned (keep latest 5 historical records).

## Async Jobs and Scheduling

### Celery tasks

- `datasets.tasks.ingest_dataset_version`: async ingestion and schema extraction.
- `report.task.generate_and_send_report`: generate dashboard payload and email recipients.
- `report.task.run_scheduled_reports`: enqueue due periodic reports.

### Redis

- Used as Celery broker and result backend.
- `backend/docker-compose.yml` includes a Redis service (`6379`).

## Backend Setup and Run Guide

### 1. Create virtual environment and install dependencies

```powershell
cd backend
python -m venv ..\env
..\env\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure environment variables

Create `.env` in `backend/` (or export vars in shell).

### 3. Run migrations

```powershell
python manage.py migrate
```

### 4. Start services

Terminal 1 (API):

```powershell
python manage.py runserver
```

Terminal 2 (Celery worker):

```powershell
celery -A config worker --loglevel=info
```

Optional Redis via Docker:

```powershell
docker compose up -d
```

## Environment Variables

Minimum required:

- `SECRET_KEY`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGHOST`
- `PGPORT`
- `REDIS_URL`

Email/reporting:

- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `DEFAULT_FROM_EMAIL` (recommended)

Storage paths (currently set in settings):

- `DATA_STORAGE_ROOT=/tmp/storage`
- `UPLOAD_ROOT=/tmp/storage/uploads`
- `DUCKDB_ROOT=/tmp/storage/duckdb`

Note: adjust these paths for Windows/local development if needed.

## Deployment Notes

- Gunicorn entry: `web: gunicorn config.wsgi`
- Celery worker entry: `worker: celery -A config worker --loglevel=info`
- CORS is currently permissive (`CORS_ALLOW_ALL_ORIGINS = True`) and should be tightened for production.
- `ALLOWED_HOSTS = ["*"]` should be restricted for production.

## Frontend Overview (Concise)

Frontend lives at `frontend/databi` and is built with:

- React `19`
- Vite `7`
- Recharts for chart rendering

Main capabilities:

- Auth and token handling
- Organization switcher
- Dataset upload and pipeline editor UI
- Query, chart, dashboard, and report pages
- Sidebar role-aware navigation

Frontend run:

```powershell
cd frontend/databi
npm install
npm run dev
```

Frontend API target:

- `VITE_API_BASE_URL` (optional)
- Defaults to `http://127.0.0.1:8000/api` in dev.

## Additional Documentation

- API testing guide: `test_api/README.md`
- End-to-end API smoke test: `test_api/full_workflow.http`
- Team workflow guideline: `PROJECT_WORKING_GUIDELINE.md`
