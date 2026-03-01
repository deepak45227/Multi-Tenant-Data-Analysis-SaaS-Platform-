import re
import time

from datasets.services.duckdb_manager import DuckDBManager
from organizations.models import Membership

from .models import QueryExecution

FORBIDDEN_KEYWORDS = [
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "truncate",
    "create",
    "attach",
    "detach",
]


def validate_sql(sql: str):
    cleaned = sql.strip().lower()

    if not cleaned.startswith("select"):
        raise ValueError("Only SELECT queries are allowed")

    for keyword in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{keyword}\b", cleaned):
            raise ValueError(f"{keyword.upper()} is not allowed in analytics queries")


def _ensure_dataset_access(user, organization):
    if organization.owner_id == user.id:
        return

    is_member = Membership.objects.filter(user=user, organization=organization).exists()
    if not is_member:
        raise PermissionError("User not in organization")


def execute_query(user, dataset, sql, saved_query=None):
    validate_sql(sql)

    organization = dataset.organization
    _ensure_dataset_access(user, organization)

    active_version = dataset.active_version or dataset.versions.filter(is_active=True).first() or dataset.versions.filter(version_type="BASE").first()
    if not active_version:
        raise ValueError("Dataset has no active/base version yet")
    table_name = active_version.get_table_name()
    if not table_name:
        raise ValueError("Active dataset version has no physical table")

    # Allow Power BI-like logical references in ad-hoc and saved queries.
    # Example: SELECT * FROM data WHERE ...
    sql = re.sub(
        r"\bfrom\s+(data|dataset)\b",
        f"FROM {table_name}",
        sql,
        count=1,
        flags=re.IGNORECASE,
    )

    duck = DuckDBManager(organization.id)
    start_time = time.time()

    try:
        df = duck.execute(sql)
        duration = int((time.time() - start_time) * 1000)

        QueryExecution.objects.create(
            organization=organization,
            query=saved_query,
            executed_by=user,
            sql_snapshot=sql,
            execution_time_ms=duration,
            row_count=len(df),
            status="success",
        )

        return df

    except Exception as e:
        duration = int((time.time() - start_time) * 1000)

        QueryExecution.objects.create(
            organization=organization,
            query=saved_query,
            executed_by=user,
            sql_snapshot=sql,
            execution_time_ms=duration,
            status="failed",
            error_message=str(e),
        )

        raise

