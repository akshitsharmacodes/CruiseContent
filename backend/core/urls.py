"""
URL configuration for SofricAI backend.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from ingestion.views import generate_post, poll_task
from core.health_views import health_check

api_patterns = [
    path('auth/', include('accounts.urls')),
    path('dashboard/', include('dashboard_api.urls')),
    path('payments/', include('payments.urls')),
    path('', include('workspaces.urls')),
    path('ingestion/', include('ingestion.urls')),
    path('generate/', generate_post, name='generate_post'),
    path('generate/<uuid:task_id>/', poll_task, name='poll_task'),
    path('platform/', include('platform_routing.urls')),
    path('health/', health_check, name='health_check'),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_patterns)),
]

# Serve media files from local filesystem in development.
# In production, media is served by Cloudinary (DEFAULT_FILE_STORAGE).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=getattr(settings, 'MEDIA_ROOT', None))
