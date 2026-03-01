from rest_framework import serializers
from .models import Organization, Membership

class OrganizationSerializer(serializers.ModelSerializer):
    current_user_role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'created_at', 'current_user_role']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        user = self.context['request'].user
        if Organization.objects.filter(name=value, owner=user).exists():
            raise serializers.ValidationError(
                f"You already have an organization named '{value}'.")
        return value

    def get_current_user_role(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        if obj.owner_id == user.id:
            return "owner"
        membership = Membership.objects.filter(organization=obj, user=user).first()
        return membership.role if membership else None


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "organization", "user", "user_email", "username", "role"]
