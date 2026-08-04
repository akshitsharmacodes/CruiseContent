from django.urls import path
from .views import GoogleLoginView, GoogleCallbackView, TokenRefreshView, LogoutView
from .admin_views import AdminUsersView, AdminUpdateTierView

urlpatterns = [
    path('google/login/', GoogleLoginView.as_view(), name='google_login'),
    path('google/callback/', GoogleCallbackView.as_view(), name='google_callback'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Super Admin endpoints
    path('admin/users/', AdminUsersView.as_view(), name='admin_users'),
    path('admin/users/<uuid:user_id>/tier/', AdminUpdateTierView.as_view(), name='admin_update_tier'),
]
