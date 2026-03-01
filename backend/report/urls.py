from django.urls import path

from .views import ReportDetailView, ReportListCreateView, TriggerReportView

urlpatterns = [
    path("reports/", ReportListCreateView.as_view(), name="report-list-create"),
    path("reports/<int:report_id>/", ReportDetailView.as_view(), name="report-detail"),
    path("reports/<int:report_id>/trigger/", TriggerReportView.as_view(), name="report-trigger"),
]
