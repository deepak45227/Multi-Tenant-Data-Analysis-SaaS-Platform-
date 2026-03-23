from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .emails import send_verification_email, send_password_reset_email
from .serializers import (
    RegisterSerializer,
    ResendVerificationSerializer,
    ForgotPasswordSerializer,
    PasswordResetConfirmSerializer,
    PasswordChangeSerializer,
    UserProfileSerializer,
)
from .tokens import email_verification_token

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            send_verification_email(user)
            return Response(
                {"message": "Account created. Please verify your email to continue."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        if not uid or not token:
            return Response({"error": "uid and token are required."}, status=400)
        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Invalid verification link."}, status=400)

        if not email_verification_token.check_token(user, token):
            return Response({"error": "Verification link is invalid or expired."}, status=400)

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])

        return Response({"message": "Email verified successfully."})


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            user = User.objects.filter(email=email).first()
            if user and not user.is_email_verified:
                send_verification_email(user)
            return Response({"message": "If that account exists, a verification email has been sent."})
        return Response(serializer.errors, status=400)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            user = User.objects.filter(email=email).first()
            if user:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                send_password_reset_email(user, token, uid)
            return Response({"message": "If that email exists, a reset link has been sent."})
        return Response(serializer.errors, status=400)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uid = serializer.validated_data["uid"]
            token = serializer.validated_data["token"]
            new_password = serializer.validated_data["new_password"]
            try:
                user_id = urlsafe_base64_decode(uid).decode()
                user = User.objects.get(pk=user_id)
            except (User.DoesNotExist, ValueError, TypeError):
                return Response({"error": "Invalid reset link."}, status=400)

            if not default_token_generator.check_token(user, token):
                return Response({"error": "Reset link is invalid or expired."}, status=400)

            user.set_password(new_password)
            user.is_email_verified = True
            user.save(update_fields=["password", "is_email_verified"])
            return Response({"message": "Password updated successfully."})
        return Response(serializer.errors, status=400)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            old_password = serializer.validated_data["old_password"]
            if not user.check_password(old_password):
                return Response({"error": "Current password is incorrect."}, status=400)
            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password"])
            return Response({"message": "Password changed successfully."})
        return Response(serializer.errors, status=400)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)
