import uuid
from django.db import models
from workspaces.models import PlatformAccount, Workspace
from ingestion.models import GenerationTask

class GeneratedImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="generated_images")
    task = models.ForeignKey(GenerationTask, on_delete=models.SET_NULL, null=True, blank=True, related_name="images")
    image = models.ImageField(upload_to='generated_images/')
    prompt_used = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image {self.id} for {self.workspace.name}"

class SocialPost(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    platform_account = models.ForeignKey(PlatformAccount, on_delete=models.CASCADE, related_name="posts")
    content = models.TextField()
    image = models.ForeignKey(GeneratedImage, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    error_message = models.TextField(blank=True, null=True)
    platform_post_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Post to {self.platform_account.platform} - {self.status}"
