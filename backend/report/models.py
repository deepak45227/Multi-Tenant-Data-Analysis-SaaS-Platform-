from django.conf import settings
from django.db import models


class Report(models.Model):
    FREQUENCY_CHOICES = [
        ("manual", "Manual"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    dashboard = models.ForeignKey(
        "visualization.Dashboard",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    recipients = models.JSONField(default=list, blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default="manual")
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="reports",
    )

    last_sent_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "name")
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["next_run_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.organization.name})"
