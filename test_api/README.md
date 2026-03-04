# API Testing Guide

This folder contains manual API test collections for the backend.

## Recommended File

Use `full_workflow.http` as the primary smoke test.

Path: `test_api/full_workflow.http`

It validates the complete flow:

1. User registration and JWT login
2. Organization creation and member management
3. Dataset upload, preview, pipeline edit, and apply
4. Saved query and ad-hoc query execution
5. Chart and dashboard creation/execution
6. Report creation and trigger

## Prerequisites

- Backend running at `http://127.0.0.1:8000`
- Redis running (for Celery tasks)
- Celery worker running (`celery -A config worker --loglevel=info`)
- VS Code REST Client extension installed

## How to Run

1. Open `test_api/full_workflow.http`.
2. Run requests sequentially from top to bottom.
3. Wait a few seconds after dataset upload before preview if ingestion is still processing.
4. For report trigger, ensure SMTP/email settings are configured in backend `.env`.

## Notes

- The file uses variable chaining (`@name` and `{{...}}`) to pass IDs/tokens automatically.
- CSV upload in the file points to `../testdata/test_copy.csv`.
- If registration fails due to duplicate emails, change `@user1_email` and `@user2_email` at the top.

## Legacy Files

Older files (`user_auth.http`, `dataset_upload_view.http`, etc.) are still available for module-specific testing, but `full_workflow.http` is the canonical flow.
