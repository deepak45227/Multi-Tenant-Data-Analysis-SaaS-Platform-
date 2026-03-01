from rest_framework import serializers

from organizations.models import Membership

from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = [
            "id",
            "organization",
            "dashboard",
            "name",
            "description",
            "recipients",
            "frequency",
            "is_active",
            "created_by",
            "last_sent_at",
            "next_run_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "last_sent_at",
            "next_run_at",
            "created_at",
            "updated_at",
        ]

    def validate_recipients(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Recipients must be a list")

        for email in value:
            if not isinstance(email, str) or "@" not in email:
                raise serializers.ValidationError("Each recipient must be a valid email")

        return value

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        organization = attrs.get("organization")
        dashboard = attrs.get("dashboard")

        if self.instance is not None:
            organization = organization or self.instance.organization
            dashboard = dashboard or self.instance.dashboard

        is_member = Membership.objects.filter(user=user, organization=organization).exists()
        if not is_member and organization.owner_id != user.id:
            raise serializers.ValidationError("You are not a member of this organization")

        if dashboard.organization_id != organization.id:
            raise serializers.ValidationError("Dashboard must belong to the selected organization")

        return attrs
