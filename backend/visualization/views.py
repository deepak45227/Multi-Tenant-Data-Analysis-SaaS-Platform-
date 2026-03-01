from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView, get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Membership
from organizations.permissions import check_permission

from .metadata import get_dataset_metadata
from .models import Chart, Dashboard
from .serializers import (
    ChartSerializer,
    ChartCreateSerializer,
    DashboardChartCreateSerializer,
    DashboardCreateSerializer,
    DashboardSerializer,
)
from .services import execute_chart, execute_dashboard


def _get_user_org_ids(user):
    return Membership.objects.filter(user=user).values_list("organization_id", flat=True)


class ExecuteChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, chart_id):
        chart = get_object_or_404(
            Chart.objects.select_related("saved_query__dataset"),
            id=chart_id,
            organization_id__in=_get_user_org_ids(request.user),
        )

        df = execute_chart(chart, request.user)
        return Response(
            {
                "chart_id": chart.id,
                "chart_name": chart.name,
                "data": df.to_dict(orient="records"),
            }
        )


class ExecuteDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, dashboard_id):
        dashboard = get_object_or_404(
            Dashboard,
            id=dashboard_id,
            organization_id__in=_get_user_org_ids(request.user),
        )
        result = execute_dashboard(dashboard, request.user)

        return Response(
            {
                "dashboard_id": dashboard.id,
                "dashboard_name": dashboard.name,
                **result,
            }
        )


class DatasetMetadataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, dataset_id):
        from datasets.models import Dataset

        dataset = get_object_or_404(
            Dataset,
            id=dataset_id,
            organization_id__in=_get_user_org_ids(request.user),
        )
        metadata = get_dataset_metadata(dataset)
        return Response({"dataset_id": dataset.id, "columns": metadata})


class DashboardListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DashboardSerializer

    def get_queryset(self):
        return Dashboard.objects.filter(organization_id__in=_get_user_org_ids(self.request.user))


class ChartListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChartSerializer

    def get_queryset(self):
        queryset = Chart.objects.filter(organization_id__in=_get_user_org_ids(self.request.user)).select_related("saved_query")
        org_id = self.request.query_params.get("organization")
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.order_by("-id")


class ChartCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChartCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        organization = serializer.validated_data["organization"]
        try:
            check_permission(request.user, organization, "create_charts")
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc

        chart = serializer.save()
        return Response({"chart_id": chart.id, "message": "Chart created"}, status=status.HTTP_201_CREATED)


class DashboardCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DashboardCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        organization = serializer.validated_data["organization"]
        try:
            check_permission(request.user, organization, "manage_dashboards")
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc

        dashboard = serializer.save(created_by=request.user)
        return Response({"dashboard_id": dashboard.id, "message": "Dashboard created"}, status=status.HTTP_201_CREATED)


class DashboardChartAddView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DashboardChartCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dashboard = serializer.validated_data["dashboard"]
        chart = serializer.validated_data["chart"]

        if dashboard.organization_id != chart.organization_id:
            return Response(
                {"detail": "Chart and dashboard must belong to the same organization"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            check_permission(request.user, dashboard.organization, "manage_dashboards")
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc

        dc = serializer.save()
        return Response({"dashboard_chart_id": dc.id, "message": "Chart added to dashboard"}, status=status.HTTP_201_CREATED)


class ChartDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, chart_id):
        chart = get_object_or_404(
            Chart,
            id=chart_id,
            organization_id__in=_get_user_org_ids(request.user),
        )
        try:
            check_permission(request.user, chart.organization, "create_charts")
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        chart.delete()
        return Response({"message": "Chart deleted"}, status=status.HTTP_200_OK)


class DashboardDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, dashboard_id):
        dashboard = get_object_or_404(
            Dashboard,
            id=dashboard_id,
            organization_id__in=_get_user_org_ids(request.user),
        )
        try:
            check_permission(request.user, dashboard.organization, "manage_dashboards")
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        dashboard.delete()
        return Response({"message": "Dashboard deleted"}, status=status.HTTP_200_OK)
