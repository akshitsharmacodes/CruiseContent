import uuid
from django.db import models
from workspaces.models import Workspace

class ContentSource(models.Model):
    SOURCE_TYPES = [
        ('RSS', 'RSS Feed'),
        ('WEBHOOK', 'Webhook'),
        ('MANUAL', 'Manual Input'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="content_sources")
    url = models.URLField(max_length=500, blank=True, null=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source_type} - {self.url or 'Manual'}"

class GenerationTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=20, default='Pending') # Pending, Processing, Completed, Failed
    input_type = models.CharField(max_length=20) # text, image, url
    input_data = models.TextField(blank=True, null=True)
    user_image_prompt = models.TextField(blank=True, null=True)
    generate_image = models.BooleanField(default=True)
    generated_content = models.JSONField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.id} - {self.status}"
