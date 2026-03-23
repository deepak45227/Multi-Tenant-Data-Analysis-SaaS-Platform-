from rest_framework import serializers
from .models import Organization, Membership, OrganizationInvite

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
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = ["id", "organization", "user", "user_email", "username", "role", "is_owner"]

    def get_is_owner(self, obj):
        return obj.organization.owner_id == obj.user_id


class OrganizationInviteSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvite
        fields = [
            "id",
            "email",
            "role",
            "created_at",
            "expires_at",
            "accepted_at",
            "invited_by_email",
            "is_expired",
        ]

    def get_is_expired(self, obj):
        return obj.is_expired()
