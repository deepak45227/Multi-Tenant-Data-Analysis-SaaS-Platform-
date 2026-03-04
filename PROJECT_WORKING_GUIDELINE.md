# Project Working Guideline

This guideline defines the recommended development and testing workflow for this project.

## 1) Branching and Commits

- Work on feature branches: `feature/<scope>` or `fix/<scope>`.
- Keep commits small and atomic.
- Use clear commit messages:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `refactor: ...`
  - `test: ...`

## 2) Local Environment Setup

Backend:

1. `cd backend`
2. `python -m venv ..\\env`
3. `..\\env\\Scripts\\Activate.ps1`
4. `pip install -r requirements.txt`
5. Configure `.env`
6. `python manage.py migrate`
7. `python manage.py runserver`

Worker:

1. Start Redis (`docker compose up -d` in `backend/`)
2. Run Celery worker: `celery -A config worker --loglevel=info`

Frontend:

1. `cd frontend/databi`
2. `npm install`
3. `npm run dev`

## 3) Mandatory API Smoke Test

Before pushing changes that affect backend APIs:

1. Run `test_api/full_workflow.http`.
2. Confirm no 4xx/5xx in critical flow.
3. Validate async operations:
   - dataset ingestion
   - report trigger

## 4) Backend Development Rules

- Keep all tenant-scoped resources tied to `organization`.
- Enforce permission checks (`check_permission`) in mutating endpoints.
- Restrict SQL execution to safe patterns (SELECT-only in query services).
- Preserve dataset versioning semantics (`BASE`, `LATEST`, `HISTORICAL`).
- For new async jobs, add clear status transitions and error handling.

## 5) API Design Rules

- Use consistent status codes:
  - `200` for successful reads/updates
  - `201` for creates
  - `202` for accepted async trigger
  - `400` for validation errors
  - `403` for permission errors
  - `404` for missing resources
- Return structured error bodies with actionable messages.
- Keep endpoint naming consistent with existing app routes.

## 6) Data and Migration Discipline

- Any model change must include migration files.
- Avoid manual DB edits outside migrations.
- Test migrations on a clean database before merge.

## 7) Testing and Validation Checklist

For each backend PR:

1. Run Django checks: `python manage.py check`
2. Run tests: `pytest` (or targeted tests)
3. Run smoke API workflow: `test_api/full_workflow.http`
4. Verify logs for exceptions in API and worker processes

## 8) Documentation Discipline

When adding/changing API behavior:

- Update `README.md` API section.
- Update `test_api/full_workflow.http` if request/response contracts changed.
- Add notes to this guideline if workflow assumptions changed.

## 9) Release Readiness

Before deployment:

- Restrict `ALLOWED_HOSTS`
- Restrict CORS settings
- Confirm production DB and Redis URLs
- Validate SMTP credentials for reports
- Run full smoke test on staging environment
