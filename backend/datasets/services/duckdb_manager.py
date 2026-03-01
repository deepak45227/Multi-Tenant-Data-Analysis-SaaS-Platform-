import os

import duckdb
from django.conf import settings


class QueryResult:
    def __init__(self, records):
        self._records = records

    def __len__(self):
        return len(self._records)

    def head(self, n):
        return QueryResult(self._records[:n])

    def to_dict(self, orient="records"):
        if orient != "records":
            raise ValueError("Only orient='records' is supported")
        return self._records


class DuckDBManager:
    def __init__(self, organization_id):
        self.organization_id = organization_id
        self.db_path = os.path.join(
            settings.DUCKDB_ROOT,
            f"org_{organization_id}.duckdb",
        )

    def get_connection(self, read_only=False):
        os.makedirs(settings.DUCKDB_ROOT, exist_ok=True)
        if read_only:
            return duckdb.connect(self.db_path, read_only=True)
        return duckdb.connect(self.db_path)

    def execute(self, sql):
        conn = self.get_connection(read_only=True)
        try:
            cursor = conn.execute(sql)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            records = [dict(zip(columns, row)) for row in rows]
            return QueryResult(records)
        finally:
            conn.close()

    def register_csv(self, table_name, file_path):
        conn = self.get_connection()
        try:
            conn.execute(
                f"""
                CREATE OR REPLACE TABLE {table_name} AS
                SELECT * FROM read_csv_auto('{file_path}')
                """
            )
            return conn
        except Exception:
            conn.close()
            raise

    def get_schema(self, table_name):
        conn = self.get_connection(read_only=True)
        try:
            result = conn.execute(f"DESCRIBE {table_name}").fetchall()
            schema = []
            for column in result:
                schema.append({
                    "column_name": column[0],
                    "column_type": column[1],
                })
            return schema
        finally:
            conn.close()

    def preview_table(self, table_name, limit=10):
        conn = self.get_connection(read_only=True)
        try:
            result = conn.execute(f"SELECT * FROM {table_name} LIMIT {limit}").fetchall()
            columns = [desc[0] for desc in conn.description]
            return {"columns": columns, "rows": result}
        finally:
            conn.close()

    def apply_transformation(self, base_table_name, transform_sql, latest_table_name):
        conn = self.get_connection()
        try:
            conn.execute(f"DROP TABLE IF EXISTS {latest_table_name}")
            conn.execute(f"CREATE TABLE {latest_table_name} AS {transform_sql}")
        finally:
            conn.close()

    def preview_version(self, base_table_name, transform_sql=None, limit=50):
        conn = self.get_connection(read_only=True)
        try:
            if transform_sql:
                preview_sql = f"({transform_sql}) AS temp LIMIT {limit}"
            else:
                preview_sql = f"SELECT * FROM {base_table_name} LIMIT {limit}"

            result = conn.execute(preview_sql).fetchall()
            columns = [desc[0] for desc in conn.description]
            return {"columns": columns, "rows": result}
        finally:
            conn.close()

    def get_table_schema(self, table_name):
        conn = self.get_connection(read_only=True)
        try:
            rows = conn.execute(f"PRAGMA table_info('{table_name}')").fetchall()
            records = [
                {
                    "cid": row[0],
                    "name": row[1],
                    "type": row[2],
                    "notnull": row[3],
                    "dflt_value": row[4],
                    "pk": row[5],
                }
                for row in rows
            ]
            return QueryResult(records)
        finally:
            conn.close()
