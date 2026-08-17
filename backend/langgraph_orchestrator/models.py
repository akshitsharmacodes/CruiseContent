import uuid
from django.db import models
from workspaces.models import Workspace
from ingestion.models import ContentSource

class GeneratedPost(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('APPROVED', 'Approved'),
        ('POSTED', 'Posted'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="generated_posts")
    source = models.ForeignKey(ContentSource, on_delete=models.SET_NULL, null=True, blank=True, related_name="posts")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scheduled_for = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.id} - {self.status}"

class PostVariation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(GeneratedPost, on_delete=models.CASCADE, related_name="variations")
    platform = models.CharField(max_length=50) # e.g. "FACEBOOK_PAGE"
    content = models.TextField(help_text="The AI generated copy")
    media_url = models.URLField(max_length=1000, blank=True, null=True, help_text="Generated image URL")
    scheduled_for = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.platform} variation for Post {self.post.id}"
