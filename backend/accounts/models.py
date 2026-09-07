from django.db import models
from django.conf import settings
from core.tier_policy import get_tier_policy

class ClientProfile(models.Model):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('CLIENT', 'Client'),
    )
    
    TIER_CHOICES = (
        ('FREE', 'Free'),
        ('STARTER', 'Starter'),
        ('CREATOR', 'Creator'),
        ('PRO', 'Pro'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='CLIENT')
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default='FREE')
    profile_picture = models.URLField(max_length=500, blank=True, null=True)
    
    posts_created = models.PositiveIntegerField(default=0)
    publish_clicks = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.tier})"

    @property
    def tier_policy(self):
        return get_tier_policy(self.tier)
    
    def can_create_post(self):
        return self.tier_policy.can_create_post(self.posts_created)
        
    def can_publish_post(self):
        return self.tier_policy.can_publish_post(self.publish_clicks)

import uuid

class AdminProfile(models.Model):
    ADMIN_LEVEL_CHOICES = (
        ('MASTER', 'Master'),
        ('ADMIN', 'Admin'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_profile')
    admin_level = models.CharField(max_length=10, choices=ADMIN_LEVEL_CHOICES, default='ADMIN')
    is_active = models.BooleanField(default=True)
    disabled_at = models.DateTimeField(null=True, blank=True)
    disabled_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.admin_level}"

class AdminPermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_profile = models.ForeignKey(AdminProfile, on_delete=models.CASCADE, related_name='permissions')
    module = models.CharField(max_length=50)
    actions = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['admin_profile', 'module'], name='unique_admin_module_permission')
        ]

    def __str__(self):
        return f"{self.admin_profile.user.email} - {self.module} ({self.actions})"

class AdminAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='admin_audit_actions')
    action = models.CharField(max_length=50)
    target_admin = models.ForeignKey(AdminProfile, on_delete=models.SET_NULL, null=True, related_name='audit_history')
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} performed {self.action} on {self.target_admin}"

class AdminWorkspaceAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_profile = models.ForeignKey(AdminProfile, on_delete=models.CASCADE, related_name='workspace_assignments')
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='admin_assignments')
    max_users = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['admin_profile', 'workspace'], name='unique_admin_workspace_assignment')
        ]

    def __str__(self):
        return f"{self.admin_profile.user.email} -> {self.workspace.name} (max: {self.max_users})"

class AdminUserAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_profile = models.ForeignKey(AdminProfile, on_delete=models.CASCADE, related_name='assigned_users')
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='admin_user_assignments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_user_assignments')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments_made')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'user'], name='unique_workspace_user_assignment')
        ]

    def __str__(self):
        return f"{self.user.email} managed by {self.admin_profile.user.email} in {self.workspace.name}"
