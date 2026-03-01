from rest_framework import serializers
from datasets.models import Dataset


class DatasetUploadSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    organization_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Dataset
        fields = ["id", "name", "organization_id", "file"]
        read_only_fields = ["id"]





class DatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ["id", "name", "created_at"]
