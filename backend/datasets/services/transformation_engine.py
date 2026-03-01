import re


class TransformationEngine:

    def __init__(self, base_table):
        self.base_query = f"SELECT * FROM {base_table}"
        self.current_query = self.base_query

    # -------------------------
    # Public API
    # -------------------------

    def apply_step(self, step):
        step_type = step.get("type")

        if step_type == "visual":
            self._apply_visual(step)

        elif step_type == "sql":
            self._apply_sql(step)

        else:
            raise ValueError(f"Unsupported step type: {step_type}")

    def compile(self):
        return self.current_query

    # -------------------------
    # Visual Steps
    # -------------------------

    def _apply_visual(self, step):
        operation = step.get("operation")
        params = step.get("params", {})

        if operation == "remove_nulls":
            self._remove_nulls(params)

        elif operation == "remove_duplicates":
            self._remove_duplicates(params)

        elif operation == "change_type":
            self._change_type(params)

        elif operation == "add_column":
            self._add_column(params)

        elif operation == "filter":
            self._filter(params)

        elif operation == "select_columns":
            self._select_columns(params)
        elif operation == "rename_column":
            self._rename_column(params)
        elif operation == "fill_nulls":
            self._fill_nulls(params)
        elif operation == "sort":
            self._sort(params)
        elif operation == "limit_rows":
            self._limit_rows(params)
        elif operation == "split_column":
            self._split_column(params)
        elif operation == "trim_text":
            self._trim_text(params)
        elif operation == "replace_values":
            self._replace_values(params)
        elif operation in ("delete_columns", "remove_columns", "remove_column"):
            self._delete_columns(params)
        elif operation == "merge_columns":
            self._merge_columns(params)
        elif operation == "merge_datasets":
            self._merge_datasets(params)

        else:
            raise ValueError(f"Unsupported visual operation: {operation}")

    # -------------------------
    # SQL Step (Hybrid Mode)
    # -------------------------

    def _apply_sql(self, step):
        sql = step.get("sql")
        if not sql:
            raise ValueError("SQL step requires 'sql'")

        # Enforce SELECT-only
        if not sql.strip().lower().startswith("select"):
            raise ValueError("Only SELECT statements allowed in SQL step")

        # Replace logical dataset reference (case-insensitive).
        # User can write FROM data or FROM dataset in any casing.
        pattern = r"\bfrom\s+(dataset|data)\b"
        replacement = f"FROM ({self.current_query}) sub"
        sql, replaced = re.subn(pattern, replacement, sql, count=1, flags=re.IGNORECASE)
        if replaced == 0:
            raise ValueError("SQL must include FROM data or FROM dataset")
            
        # Wrap safely
        self.current_query = f"""
            SELECT *
            FROM (
                {sql}
            ) pipeline_sql
        """

    # -------------------------
    # Visual Implementations
    # -------------------------

    def _remove_nulls(self, params):
        columns = params.get("columns")
        if not columns:
            raise ValueError("remove_nulls requires 'columns'")

        condition = " AND ".join([f'"{col}" IS NOT NULL' for col in columns])

        self.current_query = f"""
            SELECT *
            FROM ({self.current_query}) sub
            WHERE {condition}
        """

    def _remove_duplicates(self, params):
        columns = params.get("columns")
        if not columns:
            raise ValueError("remove_duplicates requires 'columns'")

        self.current_query = f"""
            SELECT DISTINCT *
            FROM ({self.current_query}) sub
        """

    def _change_type(self, params):
        column = params.get("column")
        new_type = params.get("new_type")

        if not column or not new_type:
            raise ValueError("change_type requires column and new_type")

        self.current_query = f"""
            SELECT
                sub.* EXCLUDE ("{column}"),
                TRY_CAST("{column}" AS {new_type}) AS "{column}"
            FROM ({self.current_query}) sub
        """

    def _add_column(self, params):
        column_name = params.get("column_name")
        expression = params.get("expression")

        if not column_name or not expression:
            raise ValueError("add_column requires column_name and expression")

        self.current_query = f"""
            SELECT
                *,
                {expression} AS "{column_name}"
            FROM ({self.current_query}) sub
        """

    def _filter(self, params):
        condition = params.get("condition")
        if not condition:
            raise ValueError("filter requires condition")

        self.current_query = f"""
            SELECT *
            FROM ({self.current_query}) sub
            WHERE {condition}
        """

    def _select_columns(self, params):
        columns = params.get("columns")
        if not columns:
            raise ValueError("select_columns requires columns")

        cols = ", ".join([f'"{c}"' for c in columns])

        self.current_query = f"""
            SELECT {cols}
            FROM ({self.current_query}) sub
   
             """

    def _rename_column(self, params):
        old_name = params.get("old_name")
        new_name = params.get("new_name")
        if not old_name or not new_name:
            raise ValueError("rename_column requires old_name and new_name")

        self.current_query = f"""
            SELECT
                sub.* EXCLUDE ("{old_name}"),
                "{old_name}" AS "{new_name}"
            FROM ({self.current_query}) sub
        """

    def _fill_nulls(self, params):
        column = params.get("column")
        value = params.get("value")
        if not column:
            raise ValueError("fill_nulls requires column")
        if value is None:
            raise ValueError("fill_nulls requires value")

        if isinstance(value, bool):
            value_sql = "TRUE" if value else "FALSE"
        elif isinstance(value, (int, float)):
            value_sql = str(value)
        else:
            safe_value = str(value).replace("'", "''")
            value_sql = f"'{safe_value}'"

        self.current_query = f"""
            SELECT
                sub.* EXCLUDE ("{column}"),
                COALESCE("{column}", {value_sql}) AS "{column}"
            FROM ({self.current_query}) sub
        """

    def _sort(self, params):
        column = params.get("column")
        direction = str(params.get("direction", "asc")).upper()
        if not column:
            raise ValueError("sort requires column")
        if direction not in ("ASC", "DESC"):
            raise ValueError("sort direction must be ASC or DESC")

        self.current_query = f"""
            SELECT *
            FROM ({self.current_query}) sub
            ORDER BY "{column}" {direction}
        """

    def _limit_rows(self, params):
        limit = params.get("limit")
        if limit is None:
            raise ValueError("limit_rows requires limit")
        try:
            limit_int = int(limit)
        except Exception as e:
            raise ValueError("limit_rows requires integer limit") from e
        if limit_int <= 0:
            raise ValueError("limit_rows requires limit > 0")

        self.current_query = f"""
            SELECT *
            FROM ({self.current_query}) sub
            LIMIT {limit_int}
        """

    def _split_column(self, params):
        column = params.get("column")
        delimiter = params.get("delimiter")
        part_index = params.get("part_index")
        new_column = params.get("new_column")
        if not column or delimiter is None or part_index is None or not new_column:
            raise ValueError("split_column requires column, delimiter, part_index, and new_column")
        try:
            idx = int(part_index)
        except Exception as e:
            raise ValueError("split_column part_index must be an integer") from e
        if idx < 1:
            raise ValueError("split_column part_index must be >= 1")
        safe_delim = str(delimiter).replace("'", "''")

        self.current_query = f"""
            SELECT
                *,
                split_part(CAST("{column}" AS VARCHAR), '{safe_delim}', {idx}) AS "{new_column}"
            FROM ({self.current_query}) sub
        """

    def _trim_text(self, params):
        columns = params.get("columns")
        if not columns:
            raise ValueError("trim_text requires columns")
        select_cols = []
        for c in columns:
            select_cols.append(f'TRIM(CAST("{c}" AS VARCHAR)) AS "{c}"')
        transformed = ", ".join(select_cols)

        self.current_query = f"""
            SELECT
                sub.* EXCLUDE ({", ".join([f'"{c}"' for c in columns])}),
                {transformed}
            FROM ({self.current_query}) sub
        """

    def _replace_values(self, params):
        column = params.get("column")
        old_value = params.get("old_value")
        new_value = params.get("new_value")
        if not column:
            raise ValueError("replace_values requires column")
        if old_value is None or new_value is None:
            raise ValueError("replace_values requires old_value and new_value")

        old_safe = str(old_value).replace("'", "''")
        new_safe = str(new_value).replace("'", "''")
        self.current_query = f"""
            SELECT
                sub.* EXCLUDE ("{column}"),
                REPLACE(CAST("{column}" AS VARCHAR), '{old_safe}', '{new_safe}') AS "{column}"
            FROM ({self.current_query}) sub
        """

    def _delete_columns(self, params):
        columns = params.get("columns")
        if not columns and params.get("column"):
            columns = [params.get("column")]
        if not columns:
            raise ValueError("delete_columns requires columns")
        excludes = ", ".join([f'"{c}"' for c in columns])
        self.current_query = f"""
            SELECT sub.* EXCLUDE ({excludes})
            FROM ({self.current_query}) sub
        """

    def _merge_columns(self, params):
        columns = params.get("columns")
        delimiter = params.get("delimiter", "")
        new_column = params.get("new_column")
        if not columns or not new_column:
            raise ValueError("merge_columns requires columns and new_column")
        safe_delim = str(delimiter).replace("'", "''")
        expr = ", ".join([f"COALESCE(CAST(\"{c}\" AS VARCHAR), '')" for c in columns])
        self.current_query = f"""
            SELECT
                *,
                CONCAT_WS('{safe_delim}', {expr}) AS "{new_column}"
            FROM ({self.current_query}) sub
        """

    def _merge_datasets(self, params):
        secondary_table = params.get("secondary_table")
        left_on = params.get("left_on")
        right_on = params.get("right_on")
        join_type = str(params.get("join_type", "left")).upper()
        if not secondary_table or not left_on or not right_on:
            raise ValueError("merge_datasets requires secondary_table, left_on, and right_on")
        if join_type not in ("LEFT", "INNER", "RIGHT", "FULL"):
            raise ValueError("merge_datasets join_type must be LEFT/INNER/RIGHT/FULL")

        self.current_query = f"""
            SELECT *
            FROM ({self.current_query}) sub
            {join_type} JOIN {secondary_table} sec
            ON sub."{left_on}" = sec."{right_on}"
        """


def build_transformation_sql(table_name, steps):
    engine = TransformationEngine(table_name)

    for step in steps:
        engine.apply_step(step)

    return engine.compile()

