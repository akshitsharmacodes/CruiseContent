from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Workspace, PlatformAccount, BusinessProfile

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'current_workspace', 'is_staff', 'is_active')
    search_fields = ('username', 'email', 'current_workspace__name')
    list_filter = ('is_staff', 'is_superuser', 'is_active')

@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'created_at')
    search_fields = ('name', 'id')
    readonly_fields = ('id', 'created_at')

@admin.register(PlatformAccount)
class PlatformAccountAdmin(admin.ModelAdmin):
    list_display = ('platform', 'name', 'account_id', 'workspace', 'created_at')
    search_fields = ('name', 'account_id', 'platform', 'workspace__name')
    list_filter = ('platform',)
    readonly_fields = ('id', 'created_at')

@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'owner_name', 'workspace', 'is_online_or_remote', 'created_at')
    search_fields = ('business_name', 'owner_name', 'workspace__name')
    list_filter = ('is_online_or_remote', 'physical_location_type')
    readonly_fields = ('id', 'created_at', 'updated_at')
