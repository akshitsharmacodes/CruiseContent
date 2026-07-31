"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from ingestion.views import generate_post, poll_task

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/dashboard/', include('dashboard_api.urls')),
    path('api/', include('workspaces.urls')),
    path('api/ingestion/', include('ingestion.urls')),
    path('api/generate/', generate_post, name='generate_post'),
    path('api/generate/<uuid:task_id>/', poll_task, name='poll_task'),
    path('api/platform/', include('platform_routing.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
