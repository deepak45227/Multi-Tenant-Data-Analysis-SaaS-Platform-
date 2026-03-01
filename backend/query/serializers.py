from rest_framework import serializers

from datasets.models import Dataset
from organizations.models import Membership

from .models import QueryExecution, SavedQuery


class SavedQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedQuery
        fields = [
            "id",
            "organization",
            "dataset",
            "name",
            "sql",
            "description",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        organization = attrs.get("organization")
        dataset = attrs.get("dataset")

        if self.instance is not None:
            organization = organization or self.instance.organization
            dataset = dataset or self.instance.dataset

        is_member = Membership.objects.filter(user=user, organization=organization).exists()
        if not is_member and organization.owner_id != user.id:
            raise serializers.ValidationError("You are not a member of this organization")

        if dataset.organization_id != organization.id:
            raise serializers.ValidationError("Dataset must belong to the selected organization")

        return attrs


class SavedQueryExecuteSerializer(serializers.Serializer):
    max_rows = serializers.IntegerField(required=False, min_value=1, max_value=5000, default=500)


class AdHocQueryExecuteSerializer(serializers.Serializer):
    dataset = serializers.PrimaryKeyRelatedField(queryset=Dataset.objects.all())
    sql = serializers.CharField(allow_blank=False, trim_whitespace=True)
    max_rows = serializers.IntegerField(required=False, min_value=1, max_value=5000, default=500)


class QueryExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueryExecution
        fields = [
            "id",
            "organization",
            "query",
            "executed_by",
            "sql_snapshot",
            "execution_time_ms",
            "row_count",
            "status",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields
