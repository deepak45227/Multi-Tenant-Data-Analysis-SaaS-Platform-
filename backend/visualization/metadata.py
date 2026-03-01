from datasets.services.duckdb_manager import DuckDBManager

NUMERIC_TYPES = ["INTEGER", "INT", "BIGINT", "DOUBLE", "FLOAT", "REAL", "DECIMAL"]


def classify_column_type(data_type: str):
    upper_type = data_type.upper()
    is_numeric = any(t in upper_type for t in NUMERIC_TYPES)
    return {"is_numeric": is_numeric, "is_categorical": not is_numeric}


def get_dataset_metadata(dataset):
    if not dataset.active_version:
        raise ValueError("Dataset has no active version")

    org_id = dataset.organization.id
    table_name = dataset.active_version.get_table_name()

    duck = DuckDBManager(org_id)
    schema_result = duck.get_table_schema(table_name)

    columns = []
    for row in schema_result.to_dict(orient="records"):
        type_info = classify_column_type(row["type"])
        columns.append({"name": row["name"], "type": row["type"], **type_info})

    return columns
