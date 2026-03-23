import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Organization(models.Model):
    name = models.CharField(max_length=255,unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, 
        related_name="owned_organizations"
    )
    class Meta:
        # Ensure unique org name per user
        unique_together = ('name', 'owner')
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} "
    
    

class Membership(models.Model):

    ROLE_CHOICES = (
    
    ('admin', 'Admin'),
    ('member', 'Member'),
)


    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='memberships'
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    
    def clean(self):
        return
    
    class Meta:
        unique_together = ('user', 'organization')
        indexes = [
            models.Index(fields=['organization']),
            models.Index(fields=['user']),
        ]




      

    def __str__(self):
        return f"{self.user.email} - {self.organization.name} "  


class OrganizationInvite(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invites"
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=Membership.ROLE_CHOICES, default="member")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invites",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_invites",
    )

    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["token"]),
        ]

    def is_expired(self):
        return self.expires_at and self.expires_at < timezone.now()

    def __str__(self):
        return f"{self.email} -> {self.organization.name}"
    

