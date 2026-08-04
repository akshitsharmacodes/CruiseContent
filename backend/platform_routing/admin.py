from django.contrib import admin
from .models import SocialPost, GeneratedImage

@admin.register(SocialPost)
class SocialPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'platform_account', 'status', 'created_at', 'platform_post_id')
    search_fields = ('content', 'platform_account__name', 'platform_post_id')
    list_filter = ('status', 'platform_account__platform')
    readonly_fields = ('id', 'created_at')

@admin.register(GeneratedImage)
class GeneratedImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'prompt_used', 'created_at')
    search_fields = ('prompt_used',)
    readonly_fields = ('id', 'created_at')
