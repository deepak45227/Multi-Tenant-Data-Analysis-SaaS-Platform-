from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Membership
from organizations.permissions import check_permission

from .models import Report
from .serializers import ReportSerializer
from .task import generate_and_send_report


def _get_user_org_ids(user):
    return Membership.objects.filter(user=user).values_list("organization_id", flat=True)


def _ensure_permission(user, organization, permission_key):
    try:
        check_permission(user, organization, permission_key)
    except PermissionError as exc:
        raise PermissionDenied(str(exc)) from exc


class ReportListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportSerializer

    def get_queryset(self):
        return Report.objects.filter(
            organization_id__in=_get_user_org_ids(self.request.user)
        ).select_related("organization", "dashboard", "created_by")

    def perform_create(self, serializer):
        organization = serializer.validated_data["organization"]
        _ensure_permission(self.request.user, organization, "send_reports")
        serializer.save(created_by=self.request.user)


class ReportDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportSerializer
    lookup_url_kwarg = "report_id"

    def get_queryset(self):
        return Report.objects.filter(
            organization_id__in=_get_user_org_ids(self.request.user)
        ).select_related("organization", "dashboard", "created_by")

    def perform_update(self, serializer):
        organization = serializer.validated_data.get("organization", serializer.instance.organization)
        _ensure_permission(self.request.user, organization, "send_reports")
        serializer.save()

    def perform_destroy(self, instance):
        _ensure_permission(self.request.user, instance.organization, "send_reports")
        instance.delete()


class TriggerReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, report_id):
        report = get_object_or_404(
            Report.objects.select_related("organization"),
            id=report_id,
            organization_id__in=_get_user_org_ids(request.user),
        )

        _ensure_permission(request.user, report.organization, "send_reports")

        task = generate_and_send_report.delay(report.id)

        return Response(
            {
                "task_id": task.id,
                "message": "Report generation started",
            },
            status=status.HTTP_202_ACCEPTED,
        )
