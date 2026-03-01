import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from organizations.permissions import check_permission
from organizations.models import Organization, Membership
from datasets.models import Dataset, DatasetVersion, IngestionJob, EditingSession
from datasets.serializers import DatasetUploadSerializer ,DatasetSerializer
from datasets.tasks import ingest_dataset_version


from rest_framework.generics import RetrieveAPIView
from datasets.services.duckdb_manager import DuckDBManager
from rest_framework.generics import ListAPIView
from rest_framework.generics import get_object_or_404


from datasets.services.transformation_engine import build_transformation_sql


class DatasetUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DatasetUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        organization_id = serializer.validated_data["organization_id"]
        file = serializer.validated_data["file"]
        name = serializer.validated_data["name"]

        organization = Organization.objects.get(id=organization_id)
        try:
            check_permission(request.user, organization, "manage_datasets")
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

        # Create dataset
        dataset = Dataset.objects.create(
            organization=organization,
            name=name,
            created_by=request.user
        )

        # Save uploaded file
        org_upload_path = os.path.join(
            settings.UPLOAD_ROOT,
            f"org_{organization_id}"
        )
        os.makedirs(org_upload_path, exist_ok=True)

        file_path = os.path.join(org_upload_path, file.name)

        with open(file_path, "wb+") as destination:
            for chunk in file.chunks():
                destination.write(chunk)


        #        IMPORTANT CHANGES – CREATE BASE VERSION       
        version = DatasetVersion.objects.create(
            dataset=dataset,
            version_number=0,                    # ← BASE = 0
            version_type="BASE",                 # ← this is the key marker
            file_path=file_path,
            status="PENDING"
        )
        # ────────────────────────────────────────────────

        # Create ingestion job
        job = IngestionJob.objects.create(
            dataset_version=version
        )

        # Trigger Celery task
        task = ingest_dataset_version.delay(str(version.id))
        job.celery_task_id = task.id
        job.save(update_fields=['celery_task_id'])

        return Response({
            "dataset_id": str(dataset.id),       # safer for UUID
            "version_id": str(version.id),
            "job_id": str(job.id),
            "status": "Processing started",
            "is_active": version.is_active,      # will be False now → True after task succeeds
            "message": "Dataset created. Base version ingestion started."
        }, status=status.HTTP_201_CREATED)

class StartEditingSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dataset_id):
        
        try:
            dataset = Dataset.objects.get(id=dataset_id)
            org = dataset.organization
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset or organization  not found"}, status=404)
        try:
            check_permission(request.user, org, "manage_datasets")
        except PermissionError as e:
            return Response({"error": str(e)}, status=403)

        # Start from active version if present, otherwise fallback to BASE.
        base_version = dataset.versions.filter(is_active=True).first()
        if not base_version:
            base_version = dataset.versions.filter(version_type="BASE").first()

        if not base_version:
            return Response({"error": "No active/base version found for preview yet"}, status=400)

        # Delete existing session if any (optional: allow only one active session per dataset)
        EditingSession.objects.filter(dataset=dataset).delete()

        session = EditingSession.objects.create(
            dataset=dataset,
            base_version=base_version,
            steps=[]
        )
        

        return Response({
            "session_id": session.id,
            "base_version": base_version.id,
            "steps": session.steps
        }, status=201)


class DatasetPreviewView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, version_id):
        try:
            version = DatasetVersion.objects.get(id=version_id)
        except DatasetVersion.DoesNotExist:
            return Response({"error": "Dataset version not found"}, status=status.HTTP_404_NOT_FOUND)

        org_id = version.dataset.organization.id
        table_name = version.get_table_name()

        if not table_name:
            return Response({"error": "Is version ka koi physical table nahi hai (historical version)"}, status=400)

        manager = DuckDBManager(org_id)
        preview = manager.preview_table(table_name, limit=10)

        return Response({
            "dataset_id": version.dataset.id,
            "version_id": version.id,
            "version_number":version.version_number,
            "preview": preview
        })




class DatasetListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DatasetSerializer

    def get_queryset(self):
        qs = Dataset.objects.filter(
            organization__memberships__user=self.request.user
        ).distinct()

        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)

        return qs


class AddEditingStepView(APIView):
    permission_classes = [IsAuthenticated]

    VISUAL_OPERATIONS = {
        "remove_nulls": ["columns"],
        "remove_duplicates": ["columns"],
        "change_type": ["column", "new_type"],
        "add_column": ["column_name", "expression"],
        "filter": ["condition"],
        "select_columns": ["columns"],
        "rename_column": ["old_name", "new_name"],
        "fill_nulls": ["column", "value"],
        "sort": ["column", "direction"],
        "limit_rows": ["limit"],
        "split_column": ["column", "delimiter", "part_index", "new_column"],
        "trim_text": ["columns"],
        "replace_values": ["column", "old_value", "new_value"],
        "delete_columns": ["columns"],
        "remove_columns": ["columns"],
        "remove_column": ["column"],
        "merge_columns": ["columns", "delimiter", "new_column"],
        "merge_datasets": ["secondary_dataset_id", "left_on", "right_on", "join_type"],
    }

    def post(self, request, session_id):
        try:
            session = EditingSession.objects.get(id=session_id)
        except EditingSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        try:
            check_permission(request.user, session.dataset.organization, "manage_datasets")
        except PermissionError as e:
            return Response({"error": str(e)}, status=403)

        step_type = request.data.get("type")

        if step_type not in ["visual", "sql"]:
            return Response({"error": "Invalid step type"}, status=400)

        steps = session.steps or []

        # --------------------------
        # VISUAL STEP
        # --------------------------
        if step_type == "visual":
            operation = request.data.get("operation")
            params = request.data.get("params", {})
            if operation == "remove_column":
                operation = "delete_columns"
                params = {**params, "columns": [params.get("column")]} if params.get("column") else params
            elif operation == "remove_columns":
                operation = "delete_columns"

            if operation not in self.VISUAL_OPERATIONS:
                return Response({"error": "Invalid visual operation"}, status=400)

            required_fields = self.VISUAL_OPERATIONS[operation]

            for field in required_fields:
                if field not in params:
                    return Response(
                        {"error": f"{field} is required for {operation}"},
                        status=400,
                    )

            if operation == "merge_datasets":
                secondary_dataset_id = params.get("secondary_dataset_id")
                if not secondary_dataset_id:
                    return Response({"error": "secondary_dataset_id is required"}, status=400)
                if str(secondary_dataset_id) == str(session.dataset.id):
                    return Response({"error": "secondary dataset must be different"}, status=400)

                secondary_dataset = get_object_or_404(Dataset, id=secondary_dataset_id)
                if secondary_dataset.organization_id != session.dataset.organization_id:
                    return Response({"error": "secondary dataset must be in the same organization"}, status=400)

                secondary_version = secondary_dataset.active_version or secondary_dataset.versions.filter(is_active=True).first() or secondary_dataset.versions.filter(version_type="BASE").first()
                if not secondary_version:
                    return Response({"error": "secondary dataset has no active/base version"}, status=400)

                params["secondary_table"] = secondary_version.get_table_name()
                params["secondary_dataset_id"] = str(secondary_dataset_id)

            step = {
                "type": "visual",
                "operation": operation,
                "params": params,
            }

        # --------------------------
        # SQL STEP
        # --------------------------
        elif step_type == "sql":
            sql = request.data.get("sql")

            if not sql:
                return Response({"error": "SQL is required"}, status=400)

            if not sql.strip().lower().startswith("select"):
                return Response(
                    {"error": "Only SELECT statements allowed in pipeline"},
                    status=400,
                )

            step = {
                "type": "sql",
                "sql": sql,
            }

        steps.append(step)
        session.steps = steps
        session.save()

        return Response({
            "session_id": session.id,
            "steps": session.steps
        }, status=200)

    



class SessionPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        # Step 1: Get session
        session = EditingSession.objects.select_related('dataset').filter(id=session_id).first()
        if not session:
            return Response({"error": "Session not found"}, status=404)
        if not Membership.objects.filter(user=request.user, organization=session.dataset.organization).exists():
            return Response({"error": "You are not a member of this organization"}, status=403)

        dataset = session.dataset

        # Step 2: Find the real starting point (active version or base)
        active_version = dataset.versions.filter(is_active=True).first()
        if not active_version:
            # Fallback to base if nothing is active yet
            active_version = dataset.versions.filter(version_type="BASE").first()
            if not active_version:
                return Response({"error": "No base or active version"}, status=400)

        table_name = active_version.get_table_name()  # this gives _base or _latest

        # Step 3: Build SQL using the correct starting table
        sql = build_transformation_sql(table_name, session.steps)
        limit = request.query_params.get("limit", "50")
        try:
            limit_int = max(1, min(int(limit), 1000))
        except Exception:
            return Response({"error": "limit must be an integer between 1 and 1000"}, status=400)

        # Step 4: Run preview
        manager = DuckDBManager(dataset.organization.id)
        conn = manager.get_connection(read_only=True)

        try:
            result = conn.execute(f"{sql} LIMIT {limit_int}").fetchall()
            columns = [desc[0] for desc in conn.description]
            colmeta_rows = conn.execute(f"DESCRIBE {sql}").fetchall()
            column_info = [{"name": r[0], "type": r[1]} for r in colmeta_rows]

            return Response({
                "columns": columns,
                "rows": result,
                "started_from": active_version.version_type,  # shows BASE or LATEST
                "steps": len(session.steps),
                "limit": limit_int,
                "column_info": column_info,
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)

        finally:
            conn.close()

class UndoEditingStepView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = EditingSession.objects.get(id=session_id)
        except EditingSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        try:
            check_permission(request.user, session.dataset.organization, "manage_datasets")
        except PermissionError as e:
            return Response({"error": str(e)}, status=403)

        if not session.steps:
            return Response({"error": "No steps to undo"}, status=400)

        steps = session.steps
        steps.pop()  # remove last step
        session.steps = steps
        session.save()

        return Response({
            "session_id": session.id,
            "steps": session.steps
        }, status=200)


class ApplyEditingSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = EditingSession.objects.get(id=session_id)
        except EditingSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        try:
            check_permission(request.user, session.dataset.organization, "manage_datasets")
        except PermissionError as e:
            return Response({"error": str(e)}, status=403)

        dataset = session.dataset
        base_version = dataset.versions.get(version_type="BASE")  # Assume one base per dataset

        from datasets.services.transformation_engine import build_transformation_sql
        from datasets.services.duckdb_manager import DuckDBManager  # Use your manager

        org_id = dataset.organization.id  # For DuckDBManager
        duck_manager = DuckDBManager(org_id)

        base_table = base_version.get_table_name()  # e.g., dataset_abcdef_base
        latest_table = f"dataset_{dataset.id.hex}_latest"

        final_sql = build_transformation_sql(base_table, session.steps)

        # Apply and save to latest physical table
        try:
            duck_manager.apply_transformation(base_table, final_sql, latest_table)
        except Exception as e:
            return Response({"error": f"Transformation failed: {str(e)}"}, status=500)

        # Get new version number
        latest_hist = dataset.versions.filter(version_type="HISTORICAL").order_by("-version_number").first()
        new_version_number = (latest_hist.version_number + 1) if latest_hist else 1

        # Create new historical version (just metadata + SQL)
        new_hist_version = DatasetVersion.objects.create(
            dataset=dataset,
            version_number=new_version_number,
            file_path=None,  # No physical
            schema=duck_manager.get_schema(latest_table),  # From new latest
            status="SUCCESS",
            version_type="HISTORICAL",
            transform_sql=final_sql,
            is_active=False,  # Historical versions are not active
        )

        # Update or create LATEST version
        latest_version, created = DatasetVersion.objects.get_or_create(
            dataset=dataset,
            version_type="LATEST",
            defaults={
                "version_number": -1,  # Fixed for latest
                "file_path": latest_table,  # Or full path if needed
                "schema": new_hist_version.schema,
                "status": "SUCCESS",
                "transform_sql": final_sql,
                "is_active": False,  # Will activate below   
            }
        )
        if not created:
            latest_version.file_path = latest_table
            latest_version.schema = new_hist_version.schema
            latest_version.transform_sql = final_sql
            latest_version.save()

        # Activate latest
        latest_version.activate()

        # Cleanup old historical
        new_hist_version.delete_old()  # Call on any, since dataset-wide

        # Delete session
        session.delete()

        return Response({
            "message": "New version created and applied",
            "version_id": latest_version.id,
            "version_number": new_hist_version.version_number,  # Historical ref
            "dataset_id": dataset.id,
            "active": latest_version.is_active
        })
class ExecuteQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sql = request.data.get("sql")
        dataset_id = request.data.get("dataset_id")

        if not sql:
            return Response({"error": "SQL required"}, status=400)

        if not sql.strip().lower().startswith("select"):
            return Response({"error": "Only SELECT allowed"}, status=400)

        sql = f"{sql} LIMIT 1000"

        try:
            conn = duckdb.connect(...)
            result = conn.execute(sql).fetchall()
            columns = [c[0] for c in conn.description]

            return Response({
                "columns": columns,
                "rows": result
            })

        except Exception as e:
            return Response({
                "error": str(e)
            }, status=400)
    

class RollbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dataset_id, version_number):
        try:
            dataset = Dataset.objects.get(id=dataset_id)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found"}, status=404)

        # Find the target version by number
        try:
            target_version = dataset.versions.get(version_number=version_number)
        except DatasetVersion.DoesNotExist:
            return Response({"error": f"Version {version_number} not found"}, status=404)

        # Your rollback logic here
        # Example: copy base to latest if version_number == 0
        if version_number == 0:
            duck = DuckDBManager(dataset.organization.id)
            base_table = target_version.get_table_name()
            latest_table = f"dataset_{dataset.id.hex}_latest"
            conn = duck.get_connection()
            conn.execute(f"DROP TABLE IF EXISTS {latest_table}")
            conn.execute(f"CREATE TABLE {latest_table} AS SELECT * FROM {base_table}")
            conn.close()

        # Or for historical: run transform_sql on base → save to latest

        # Activate the target (or LATEST after materialization)
        latest_version = dataset.versions.get(version_type="LATEST")
        latest_version.activate()

        return Response({
            "message": f"Rolled back to version {version_number}",
            "current_active_version_number": latest_version.version_number,
            "current_active_version_type": latest_version.version_type
        })
