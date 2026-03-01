from django.db import models
from django.conf import settings
from django.forms import ValidationError


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
             if self.role == "owner":
               existing_owner = Membership.objects.filter(
                   organization=self.organization,
               role="owner"
               ).exclude(pk=self.pk).exists()

               if existing_owner:
                   raise ValidationError("Organization already has an owner.")
    
    class Meta:
        unique_together = ('user', 'organization')
        indexes = [
            models.Index(fields=['organization']),
            models.Index(fields=['user']),
        ]




      

    def __str__(self):
        return f"{self.user.email} - {self.organization.name} "  
    

