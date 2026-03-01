import hashlib
import time
from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache

from query.services import execute_query

from .schema import get_dataset_columns


def build_where_clause(chart, valid_columns):
    if not chart.filters:
        return ""

    clauses = []
    allowed_operators = ["=", ">", "<", ">=", "<=", "IN"]

    for f in chart.filters:
        column = f.get("column")
        operator = f.get("operator")
        value = f.get("value")

        if column not in valid_columns:
            raise ValueError(f"Invalid filter column: {column}")

        if operator not in allowed_operators:
            raise ValueError(f"Invalid operator: {operator}")

        if operator == "IN":
            if not isinstance(value, list):
                raise ValueError("IN operator requires list value")

            formatted_values = ", ".join(
                [f"'{v}'" if isinstance(v, str) else str(v) for v in value]
            )
            clauses.append(f"{column} IN ({formatted_values})")
        else:
            formatted_value = f"'{value}'" if isinstance(value, str) else str(value)
            clauses.append(f"{column} {operator} {formatted_value}")

    return "WHERE " + " AND ".join(clauses)


def build_chart_sql(chart, valid_columns):
    base_sql = chart.saved_query.sql
    aggregation = chart.aggregation.upper()
    where_clause = build_where_clause(chart, valid_columns)

    return f"""
        SELECT
            {chart.group_by_column} AS dimension,
            {aggregation}({chart.metric_column}) AS value
        FROM (
            {base_sql}
        ) AS base_query
        {where_clause}
        GROUP BY {chart.group_by_column}
        ORDER BY value DESC
        LIMIT {chart.limit}
    """


def execute_chart(chart, user):
    dataset = chart.saved_query.dataset
    columns = get_dataset_columns(dataset)

    if chart.group_by_column not in columns:
        raise ValueError("Invalid group_by_column")

    if chart.metric_column not in columns:
        raise ValueError("Invalid metric_column")

    sql = build_chart_sql(chart, columns)

    return execute_query(
        user=user,
        dataset=dataset,
        sql=sql,
        saved_query=chart.saved_query,
    )


def generate_cache_key(chart):
    raw = f"{chart.id}-{chart.saved_query.updated_at}-{chart.filters}-{chart.limit}"
    return "chart_cache_" + hashlib.md5(raw.encode()).hexdigest()


def execute_dashboard(dashboard, user):
    start = time.time()

    dashboard_charts = dashboard.dashboard_charts.select_related(
        "chart__saved_query__dataset"
    )

    results = []

    def run_chart(dc):
        chart = dc.chart
        cache_key = generate_cache_key(chart)

        cached = cache.get(cache_key)
        if cached:
            return cached

        df = execute_chart(chart, user)

        result = {
            "chart_id": chart.id,
            "chart_name": chart.name,
            "chart_type": chart.chart_type,
            "position": {
                "x": dc.position_x,
                "y": dc.position_y,
                "w": dc.width,
                "h": dc.height,
            },
            "data": df.to_dict(orient="records"),
        }

        cache.set(cache_key, result, timeout=300)
        return result

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run_chart, dc) for dc in dashboard_charts]
        for future in futures:
            results.append(future.result())

    duration = int((time.time() - start) * 1000)
    return {
        "charts": results,
        "execution_time_ms": duration,
    }
