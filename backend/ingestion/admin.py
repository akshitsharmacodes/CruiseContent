from django.contrib import admin
from .models import ContentSource, GenerationTask

@admin.register(ContentSource)
class ContentSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'source_type', 'url', 'is_active', 'created_at')
    search_fields = ('url', 'workspace__name')
    list_filter = ('source_type', 'is_active')
    readonly_fields = ('id', 'created_at')

@admin.register(GenerationTask)
class GenerationTaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'input_type', 'generate_image', 'created_at')
    search_fields = ('input_data', 'user_image_prompt', 'error_message')
    list_filter = ('status', 'input_type', 'generate_image')
    readonly_fields = ('id', 'created_at')
