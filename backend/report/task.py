import json
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone

from visualization.services import execute_dashboard

from .models import Report


def _next_run_at(report, from_dt=None):
    if report.frequency == "manual":
        return None

    anchor = from_dt or timezone.now()

    if report.frequency == "daily":
        return anchor + timedelta(days=1)
    if report.frequency == "weekly":
        return anchor + timedelta(days=7)
    if report.frequency == "monthly":
        return anchor + timedelta(days=30)

    return None


@shared_task
def generate_and_send_report(report_id):
    report = Report.objects.select_related(
        "dashboard",
        "organization",
        "created_by",
        "organization__owner",
    ).get(id=report_id)

    actor = report.created_by or report.organization.owner
    if actor is None:
        raise ValueError("Report has no valid actor user")

    dashboard_data = execute_dashboard(report.dashboard, actor)

    recipients = report.recipients or []
    if not recipients and report.created_by and report.created_by.email:
        recipients = [report.created_by.email]

    if not recipients:
        raise ValueError("No email recipients configured for this report")

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(
        settings,
        "EMAIL_HOST_USER",
        "no-reply@example.com",
    )

    send_mail(
        subject=f"Report: {report.name}",
        message=json.dumps(dashboard_data, default=str),
        from_email=from_email,
        recipient_list=recipients,
        fail_silently=False,
    )

    now = timezone.now()
    report.last_sent_at = now
    report.next_run_at = _next_run_at(report, now)
    report.save(update_fields=["last_sent_at", "next_run_at", "updated_at"])


@shared_task
def run_scheduled_reports():
    now = timezone.now()

    reports = Report.objects.filter(is_active=True).exclude(frequency="manual").filter(
        Q(next_run_at__isnull=True) | Q(next_run_at__lte=now)
    )

    for report in reports:
        generate_and_send_report.delay(report.id)
