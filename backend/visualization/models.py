from django.db import models

# Create your models here.
from django.db import models
from organizations.models import Organization
from query.models import SavedQuery
from django.conf import settings


class Chart(models.Model):

    CHART_TYPES = [
        ("bar", "Bar"),
        ("line", "Line"),
        ("pie", "Pie"),
        ("table", "Table"),
    ]

    AGGREGATIONS = [
        ("sum", "SUM"),
        ("avg", "AVG"),
        ("count", "COUNT"),
        ("min", "MIN"),
        ("max", "MAX"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="charts"
    )

    name = models.CharField(max_length=255)

    saved_query = models.ForeignKey(
        SavedQuery,
        on_delete=models.CASCADE,
        related_name="charts"
    )

    chart_type = models.CharField(
        max_length=20,
        choices=CHART_TYPES
    )

    group_by_column = models.CharField(max_length=255)

    metric_column = models.CharField(max_length=255)

    aggregation = models.CharField(
        max_length=20,
        choices=AGGREGATIONS
    )

    filters = models.JSONField(blank=True, null=True)

    limit = models.IntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Dashboard(models.Model):

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="dashboards"
    )

    name = models.CharField(max_length=255)

    description = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(
         settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class DashboardChart(models.Model):

    dashboard = models.ForeignKey(
        Dashboard,
        on_delete=models.CASCADE,
        related_name="dashboard_charts"
    )

    chart = models.ForeignKey(
        Chart,
        on_delete=models.CASCADE
    )

    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)

    width = models.IntegerField(default=6)
    height = models.IntegerField(default=4)

    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]



