from urllib.parse import urlencode
from django.conf import settings
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

from .tokens import email_verification_token


def _frontend_url(params: dict) -> str:
    base = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    query = urlencode(params)
    return f"{base}/?{query}"


def send_verification_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    link = _frontend_url({"action": "verify", "uid": uid, "token": token})

    subject = "Verify your email for Databi"
    message = (
        f"Hi {user.username},\n\n"
        "Thanks for signing up. Please verify your email address to activate your account:\n\n"
        f"{link}\n\n"
        "If you did not create this account, you can ignore this email."
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)


def send_password_reset_email(user, token, uid):
    link = _frontend_url({"action": "reset", "uid": uid, "token": token})
    subject = "Reset your Databi password"
    message = (
        f"Hi {user.username},\n\n"
        "We received a request to reset your password. Use the link below to set a new password:\n\n"
        f"{link}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
