import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class Workspace(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('ARCHIVED', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    open_ai_key = models.CharField(max_length=255, blank=True, null=True)
    hugging_face_key = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class WorkspaceMembership(models.Model):
    ROLE_CHOICES = [
        ('OWNER', 'Owner'),
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
        ('VIEWER', 'Viewer'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REMOVED', 'Removed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='workspace_memberships')
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='MEMBER')
    custom_role = models.ForeignKey('WorkspaceRole', on_delete=models.SET_NULL, null=True, blank=True, related_name='memberships')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'workspace'], name='unique_workspace_membership')
        ]
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['workspace', 'role']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.status != 'ACTIVE' and self.user.current_workspace_id == self.workspace_id:
            self.user.current_workspace = None
            self.user.save(update_fields=['current_workspace'])

    def __str__(self):
        return f"{self.user} - {self.workspace} ({self.role})"

class User(AbstractUser):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('DEACTIVATED', 'Deactivated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # New fields
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE')
    current_workspace = models.ForeignKey(Workspace, on_delete=models.SET_NULL, null=True, blank=True, related_name="active_users")
    workspaces = models.ManyToManyField(Workspace, through='WorkspaceMembership', related_name="users")
    
    def __str__(self):
        return self.email or self.username

class PlatformAccount(models.Model):
    PLATFORM_CHOICES = [
        ('FACEBOOK_PAGE', 'Facebook Page'),
        ('TWITTER', 'Twitter'),
        ('LINKEDIN', 'LinkedIn'),
        ('INSTAGRAM', 'Instagram'),
        ('PINTEREST', 'Pinterest'),
        ('WHATSAPP', 'WhatsApp'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="platform_accounts")
    platform = models.CharField(max_length=50, choices=PLATFORM_CHOICES)
    account_id = models.CharField(max_length=255)
    access_token = models.TextField(blank=True, default='')
    name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.platform} - {self.name or self.account_id}"

class BusinessProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="business_profile")
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

class WhatsAppIntegration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="whatsapp_integration")
    phone_number_id = models.CharField(max_length=255)
    business_account_id = models.CharField(max_length=255)
    
    # Encrypted System User Token
    encrypted_system_user_token = models.BinaryField()
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"WhatsApp for {self.workspace.name} ({self.phone_number_id})"

class WorkspaceRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='custom_roles')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'name'], name='unique_workspace_role_name')
        ]
        indexes = [
            models.Index(fields=['workspace', 'name']),
        ]

    def __str__(self):
        return f"{self.workspace.name} - {self.name}"

