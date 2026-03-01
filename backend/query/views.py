from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Membership

from .models import QueryExecution, SavedQuery
from .serializers import (
    AdHocQueryExecuteSerializer,
    QueryExecutionSerializer,
    SavedQueryExecuteSerializer,
    SavedQuerySerializer,
)
from .services import execute_query


def _get_user_org_ids(user):
    return Membership.objects.filter(user=user).values_list("organization_id", flat=True)


class SavedQueryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedQuerySerializer

    def get_queryset(self):
        return SavedQuery.objects.filter(
            organization_id__in=_get_user_org_ids(self.request.user)
        ).select_related("organization", "dataset", "created_by")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SavedQueryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedQuerySerializer
    lookup_url_kwarg = "query_id"

    def get_queryset(self):
        return SavedQuery.objects.filter(
            organization_id__in=_get_user_org_ids(self.request.user)
        ).select_related("organization", "dataset", "created_by")


class ExecuteSavedQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, query_id):
        serializer = SavedQueryExecuteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = generics.get_object_or_404(
            SavedQuery.objects.select_related("dataset", "organization"),
            id=query_id,
            organization_id__in=_get_user_org_ids(request.user),
        )

        try:
            df = execute_query(
                user=request.user,
                dataset=query.dataset,
                sql=query.sql,
                saved_query=query,
            )
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        max_rows = serializer.validated_data["max_rows"]
        rows = df.head(max_rows).to_dict(orient="records")

        return Response(
            {
                "query_id": query.id,
                "query_name": query.name,
                "rows": rows,
                "returned_rows": len(rows),
                "total_rows": len(df),
            }
        )


class ExecuteAdHocQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AdHocQueryExecuteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dataset = serializer.validated_data["dataset"]
        sql = serializer.validated_data["sql"]
        max_rows = serializer.validated_data["max_rows"]

        is_member = Membership.objects.filter(
            user=request.user,
            organization=dataset.organization,
        ).exists()
        if not is_member and dataset.organization.owner_id != request.user.id:
            raise PermissionDenied("You are not a member of this organization")

        try:
            df = execute_query(
                user=request.user,
                dataset=dataset,
                sql=sql,
                saved_query=None,
            )
        except PermissionError as exc:
            raise PermissionDenied(str(exc)) from exc
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        rows = df.head(max_rows).to_dict(orient="records")

        return Response(
            {
                "rows": rows,
                "returned_rows": len(rows),
                "total_rows": len(df),
            }
        )


class QueryExecutionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = QueryExecutionSerializer

    def get_queryset(self):
        queryset = QueryExecution.objects.filter(
            organization_id__in=_get_user_org_ids(self.request.user)
        ).select_related("organization", "query", "executed_by")

        query_id = self.request.query_params.get("query_id")
        status_filter = self.request.query_params.get("status")

        if query_id:
            queryset = queryset.filter(query_id=query_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by("-created_at")
