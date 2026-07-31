from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkspaceViewSet, BusinessProfileView

router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet)

urlpatterns = [
    path('workspaces/profile/', BusinessProfileView.as_view(), name='business_profile'),
    path('', include(router.urls)),
]
