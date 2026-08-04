from django.contrib import admin
from .models import GeneratedPost, PostVariation

class PostVariationInline(admin.TabularInline):
    model = PostVariation
    extra = 1

@admin.register(GeneratedPost)
class GeneratedPostAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'status', 'scheduled_for', 'created_at')
    search_fields = ('workspace__name', 'id')
    list_filter = ('status', 'workspace')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [PostVariationInline]

@admin.register(PostVariation)
class PostVariationAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'platform', 'content')
    search_fields = ('content', 'platform', 'post__id')
    list_filter = ('platform',)
    readonly_fields = ('id',)
