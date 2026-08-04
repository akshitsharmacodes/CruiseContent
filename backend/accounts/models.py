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
