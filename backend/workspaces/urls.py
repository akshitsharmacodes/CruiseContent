from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkspaceViewSet, BusinessProfileView, OnboardView, SwitchWorkspaceView

router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')

urlpatterns = [
    path('workspaces/switch/', SwitchWorkspaceView.as_view(), name='switch_workspace'),
    path('workspaces/profile/', BusinessProfileView.as_view(), name='business_profile'),
    path('onboard/', OnboardView.as_view(), name='onboard'),
    path('', include(router.urls)),
]
