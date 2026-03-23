from urllib.parse import urlencode
from django.conf import settings
from django.core.mail import send_mail


def _frontend_url(params: dict) -> str:
    base = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    query = urlencode(params)
    return f"{base}/?{query}"


def send_invite_email(invite):
    link = _frontend_url(
        {"action": "register", "invite": str(invite.token), "email": invite.email}
    )
    subject = f"You've been invited to {invite.organization.name}"
    message = (
        f"You've been invited to join {invite.organization.name} on Databi.\n\n"
        f"Use this link to create your account and join the organization:\n{link}\n\n"
        "If you were not expecting this invitation, you can ignore this email."
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [invite.email], fail_silently=False)


def send_member_added_email(user, organization):
    subject = f"You're now a member of {organization.name}"
    message = (
        f"Hi {user.username},\n\n"
        f"You've been added to the organization {organization.name} on Databi. "
        "You can sign in to access your workspace.\n"
    )
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
