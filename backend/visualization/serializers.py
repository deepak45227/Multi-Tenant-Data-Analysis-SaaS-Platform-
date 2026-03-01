from rest_framework import serializers
from .models import Chart, Dashboard, DashboardChart

from .models import Chart, Dashboard, DashboardChart

class ChartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chart
        fields = [
            "id", "organization", "name", "saved_query",
            "chart_type", "group_by_column", "metric_column",
            "aggregation", "filters", "limit", "created_at"
        ]
        read_only_fields = ["id", "created_at"]

class DashboardChartSerializer(serializers.ModelSerializer):
    chart = ChartSerializer(read_only=True)

    class Meta:
        model = DashboardChart
        fields = ["id", "dashboard", "chart", "position_x", "position_y", "width", "height", "order"]

class DashboardSerializer(serializers.ModelSerializer):
    dashboard_charts = DashboardChartSerializer(many=True, read_only=True)

    class Meta:
        model = Dashboard
        fields = ["id", "organization", "name", "description", "created_by", "created_at", "dashboard_charts"]
        read_only_fields = ["id", "created_at", "dashboard_charts"]





class ChartCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chart
        fields = [
            "organization", "name", "saved_query", 
            "chart_type", "group_by_column", "metric_column", 
            "aggregation", "filters", "limit"
        ]

class DashboardCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dashboard
        fields = ["organization", "name", "description"]

class DashboardChartCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardChart
        fields = ["dashboard", "chart", "position_x", "position_y", "width", "height", "order"]