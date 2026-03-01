from celery import shared_task
from django.utils import timezone
from datasets.models import DatasetVersion, IngestionJob
from datasets.services.duckdb_manager import DuckDBManager

@shared_task
def ingest_dataset_version(version_id):
    version = DatasetVersion.objects.select_related('dataset', 'dataset__organization').get(id=version_id)
    
    version.status = "PROCESSING"
    version.save(update_fields=['status'])

    job = IngestionJob.objects.get(dataset_version=version)
    job.started_at = timezone.now()
    job.status = "PROCESSING"
    job.save(update_fields=['started_at', 'status'])

    try:
        dataset = version.dataset
        org_id = dataset.organization.id
        manager = DuckDBManager(org_id)

        # Decide table name
        if version.version_type == "BASE":
            table_name = f"dataset_{dataset.id.hex}_base"
        elif version.version_type == "LATEST":
            table_name = f"dataset_{dataset.id.hex}_latest"
        else:
            raise ValueError("Only BASE or LATEST versions can be ingested from CSV")

        # Do the actual work
        manager.register_csv(table_name, version.file_path)

        schema = manager.get_schema(table_name)

        version.schema = schema
        version.status = "SUCCESS"
        version.save(update_fields=['schema', 'status'])

        # ─── ACTIVATE ONLY HERE ─── AFTER EVERYTHING SUCCEEDED
        if version.version_type in ("BASE", "LATEST"):
            version.activate()   # now safe to activate

        job.completed_at = timezone.now()
        job.status = "SUCCESS"
        job.save(update_fields=['completed_at', 'status'])

    except Exception as e:
        version.status = "FAILED"
        version.save(update_fields=['status'])

        job.status = "FAILED"
        job.save(update_fields=['status'])

        raise e