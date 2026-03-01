import uuid
from django.db import models
from django.conf import settings


class Dataset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="datasets"
    )

    name = models.CharField(max_length=255)
    
    active_version = models.ForeignKey(
        'datasets.DatasetVersion',
        on_delete=models.SET_NULL,          # or PROTECT if you want to prevent deletion
        null=True,
        blank=True,
        related_name='active_for_dataset'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)



class DatasetVersion(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("PROCESSING", "Processing"),
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
    ]

    
    VERSION_TYPES = [
        ("BASE", "Base"),
        ("HISTORICAL", "Historical"),
        ("LATEST", "Latest"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()
    version_type = models.CharField(max_length=20, choices=VERSION_TYPES, default="HISTORICAL")
    file_path = models.TextField(null=True, blank=True)  # None for historical; path/table for base/latest
   
    schema = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)
    transform_sql = models.TextField(null=True, blank=True)

    
    def get_table_name(self):
        # Dynamic table name inside org DuckDB
        if self.version_type == "BASE":
            return f"dataset_{self.dataset.id.hex}_base"
        elif self.version_type == "LATEST":
            return f"dataset_{self.dataset.id.hex}_latest"
        else:
            return None  # Historical: no physical table

    def activate(self):
    # Deactivate all other versions
        DatasetVersion.objects.filter(
        dataset=self.dataset,
        is_active=True
        ).update(is_active=False)

    # Activate current
        self.is_active = True
        self.save(update_fields=["is_active"])

    #  Update Dataset pointer
        self.dataset.active_version = self
        self.dataset.save(update_fields=["active_version"])

    def delete_old(self):
        # Keep base + latest + up to 5 historical
        historical = DatasetVersion.objects.filter(
            dataset=self.dataset, version_type="HISTORICAL"
        ).order_by("-created_at")
        
        if historical.count() > 5:
            for v in historical[5:]:
                v.delete()  # No file to delete since historical has no file_path

    class Meta:
        unique_together = ("dataset", "version_number", "is_active","version_type")


class IngestionJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset_version = models.OneToOneField(DatasetVersion, on_delete=models.CASCADE)
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default="PENDING")
  


class EditingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    dataset = models.ForeignKey(
        "Dataset",
        on_delete=models.CASCADE,
        related_name="editing_sessions"
    )

    base_version = models.ForeignKey(
        "DatasetVersion",
        on_delete=models.CASCADE,
        related_name="editing_sessions"
    )

    steps = models.JSONField(default=list)  # transformation steps

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"EditingSession {self.id} for {self.dataset.name}"


# class SavedQuery(models.Model):
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     name = models.CharField(max_length=255)
#     sql = models.TextField()
#     dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE)
#     created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
#     created_at = models.DateTimeField(auto_now_add=True)


# class QueryExecution(models.Model):
#     query = models.ForeignKey(SavedQuery, on_delete=models.CASCADE, null=True)
#     sql_snapshot = models.TextField()
#     executed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
#     execution_time_ms = models.IntegerField()
#     created_at = models.DateTimeField(auto_now_add=True)
