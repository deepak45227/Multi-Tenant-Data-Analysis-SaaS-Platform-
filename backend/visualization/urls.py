from django.urls import path
from .views import (ExecuteChartView, ExecuteDashboardView, DatasetMetadataView, 
             DashboardListView , ChartCreateView, DashboardCreateView, DashboardChartAddView,
             ChartDeleteView, DashboardDeleteView, ChartListView)


urlpatterns = [
    path("charts/<int:chart_id>/execute/", ExecuteChartView.as_view(), name="execute-chart"),
    path("dashboards/<int:dashboard_id>/execute/", ExecuteDashboardView.as_view(), name="execute-dashboard"),
    path("dashboards/", DashboardListView.as_view(), name="list-dashboards"),
    path("charts/", ChartListView.as_view(), name="list-charts"),
    path("datasets/<uuid:dataset_id>/metadata/", DatasetMetadataView.as_view(), name="dataset-metadata"),

    path("charts/create/", ChartCreateView.as_view(), name="create-chart"),
    path("dashboards/create/", DashboardCreateView.as_view(), name="create-dashboard"),
    path("dashboards/add-chart/", DashboardChartAddView.as_view(), name="add-chart-to-dashboard"),
    path("charts/<int:chart_id>/delete/", ChartDeleteView.as_view(), name="delete-chart"),
    path("dashboards/<int:dashboard_id>/delete/", DashboardDeleteView.as_view(), name="delete-dashboard"),
]
