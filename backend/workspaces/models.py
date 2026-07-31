import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    open_ai_key = models.CharField(max_length=255, blank=True, null=True)
    hugging_face_key = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, null=True, blank=True, related_name="users")
    
    def __str__(self):
        return self.email or self.username

class PlatformAccount(models.Model):
    PLATFORM_CHOICES = [
        ('FACEBOOK_PAGE', 'Facebook Page'),
        ('TWITTER', 'Twitter'),
        ('LINKEDIN', 'LinkedIn'),
        ('INSTAGRAM', 'Instagram'),
        ('PINTEREST', 'Pinterest'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="platform_accounts")
    platform = models.CharField(max_length=50, choices=PLATFORM_CHOICES)
    account_id = models.CharField(max_length=255)
    access_token = models.TextField()
    name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.platform} - {self.name or self.account_id}"

class BusinessProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="business_profile")
    owner_name = models.CharField(max_length=255, blank=True, null=True)
    business_name = models.CharField(max_length=255, blank=True, null=True)
    established_date = models.DateField(blank=True, null=True)
    opening_hours = models.TextField(blank=True, null=True)
    operational_procedures = models.TextField(blank=True, null=True)
    is_online_or_remote = models.BooleanField(default=False)
    physical_location_type = models.CharField(max_length=100, blank=True, null=True) # e.g. Clinic, Shop, Office
    services_provided = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.business_name} ({self.user.email})"
