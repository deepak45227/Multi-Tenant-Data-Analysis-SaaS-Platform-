from datasets.services.duckdb_manager import DuckDBManager


def get_dataset_columns(dataset):
    if not dataset.active_version:
        raise ValueError("Dataset has no active version")

    org_id = dataset.organization.id
    table_name = dataset.active_version.get_table_name()

    duck = DuckDBManager(org_id)
    schema_result = duck.get_table_schema(table_name)

    return [row["name"] for row in schema_result.to_dict(orient="records")]
