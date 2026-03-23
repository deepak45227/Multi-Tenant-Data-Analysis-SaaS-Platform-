import re
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from organizations.models import Membership, OrganizationInvite

User = get_user_model()

_USERNAME_CLEAN_RE = re.compile(r"[^a-zA-Z0-9@.+-_]+")


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _generate_unique_username(base: str) -> str:
    base = _USERNAME_CLEAN_RE.sub("", base.strip()) or "user"
    candidate = base
    suffix = 0
    while User.objects.filter(username=candidate).exists():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "is_email_verified"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(required=False, allow_blank=True)
    invite_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["email", "username", "password", "invite_token"]

    def validate_email(self, value):
        value = _normalize_email(value)
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        invite_token = (validated_data.pop("invite_token", "") or "").strip()
        email = validated_data["email"]
        username = (validated_data.get("username") or "").strip()
        if not username:
            username = _generate_unique_username(email.split("@")[0])

        invite = None
        if invite_token:
            invite = OrganizationInvite.objects.filter(token=invite_token, accepted_at__isnull=True).first()
            if not invite or invite.is_expired():
                raise serializers.ValidationError({"invite_token": "Invite is invalid or expired."})
            if invite.email.lower() != email.lower():
                raise serializers.ValidationError({"invite_token": "Invite email does not match registration email."})

        user = User.objects.create_user(
            email=email,
            username=username,
            password=validated_data["password"],
            is_email_verified=False,
        )

        if invite:
            Membership.objects.get_or_create(
                user=user,
                organization=invite.organization,
                defaults={"role": invite.role},
            )
            invite.accepted_at = timezone.now()
            invite.accepted_by = user
            invite.save(update_fields=["accepted_at", "accepted_by"])

        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_email_verified:
            raise AuthenticationFailed(
                "Email not verified. Please check your inbox for the verification link.",
                code="email_not_verified",
            )
        data["user"] = UserProfileSerializer(self.user).data
        return data


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return _normalize_email(value)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return _normalize_email(value)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        validate_password(attrs["new_password"])
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        validate_password(value)
        return value
