from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentSourceViewSet

router = DefaultRouter()
router.register(r'sources', ContentSourceViewSet, basename='contentsource')

urlpatterns = [
    path('', include(router.urls)),
]
