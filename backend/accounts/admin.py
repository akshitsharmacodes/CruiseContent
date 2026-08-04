from django.contrib import admin
from .models import ClientProfile

@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'tier', 'posts_created', 'publish_clicks')
    search_fields = ('user__email', 'user__username')
    list_filter = ('role', 'tier')
    readonly_fields = ('posts_created', 'publish_clicks')
