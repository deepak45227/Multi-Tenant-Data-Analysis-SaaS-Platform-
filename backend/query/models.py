from django.db import models
from organizations.models import Organization
from datasets.models import Dataset, DatasetVersion
from django.conf import settings


class SavedQuery(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="queries"
    )

    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.CASCADE,
        related_name="queries"
    )

    name = models.CharField(max_length=255)

    sql = models.TextField()

    description = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.organization.name})"


class QueryExecution(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE
    )

    query = models.ForeignKey(
        SavedQuery,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    sql_snapshot = models.TextField()

    execution_time_ms = models.IntegerField(null=True, blank=True)

    row_count = models.IntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ("success", "Success"),
            ("failed", "Failed"),
        ]
    )

    error_message = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    