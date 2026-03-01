from django.urls import path

from .views import (
    ExecuteAdHocQueryView,
    ExecuteSavedQueryView,
    QueryExecutionListView,
    SavedQueryDetailView,
    SavedQueryListCreateView,
)

urlpatterns = [
    path("queries/", SavedQueryListCreateView.as_view(), name="query-list-create"),
    path("queries/<int:query_id>/", SavedQueryDetailView.as_view(), name="query-detail"),
    path("queries/<int:query_id>/execute/", ExecuteSavedQueryView.as_view(), name="query-execute"),
    path("queries/execute/", ExecuteAdHocQueryView.as_view(), name="adhoc-query-execute"),
    path("query-executions/", QueryExecutionListView.as_view(), name="query-execution-list"),
]
