from django.urls import path
from .views import (
    GoogleLoginView, GoogleCallbackView, TokenRefreshView, LogoutView, 
    StandardLoginView, StandardSignupView, PasswordResetRequestView, PasswordResetConfirmView
)
from .admin_views import AdminUsersView, AdminUpdateTierView
from .admin_console_views import (
    AdminLoginView, AdminManagementListView, AdminManagementDetailView, AdminManagementPasswordResetView,
    AdminPermissionModulesView, AdminPermissionManagementView,
    AdminConsoleUsersView, AdminConsoleUserDetailView, AdminConsoleUserStatusView,
    AdminConsoleUserWorkspacesView, AdminConsoleUserWorkspaceDetailView, AdminConsoleWorkspacesView,
    AdminConsoleWorkspaceManagementDetailView, AdminConsoleWorkspaceMembersView,
    AdminConsoleWorkspaceStatusView,
    AdminWorkspaceAvailablePermissionsView, AdminWorkspaceRolesListView, AdminWorkspaceRoleDetailView,
    AdminManagementWorkspaceAssignmentsView, AdminConsoleUserAssignmentView
)

urlpatterns = [
    path('google/login/', GoogleLoginView.as_view(), name='google_login'),
    path('google/callback/', GoogleCallbackView.as_view(), name='google_callback'),
    path('login/', StandardLoginView.as_view(), name='standard_login'),
    path('signup/', StandardSignupView.as_view(), name='standard_signup'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Super Admin endpoints
    path('admin/users/legacy/', AdminUsersView.as_view(), name='legacy_admin_users'),
    path('admin/users/<uuid:user_id>/tier/', AdminUpdateTierView.as_view(), name='admin_update_tier'),
    
    
    # Phase 3/6 Admin Console
    path('admin/users/', AdminConsoleUsersView.as_view(), name='admin_console_users'),
    path('admin/users/<uuid:user_id>/', AdminConsoleUserDetailView.as_view(), name='admin_console_user_detail'),
    path('admin/users/<uuid:user_id>/status/', AdminConsoleUserStatusView.as_view(), name='admin_console_user_status'),
    path('admin/users/<uuid:user_id>/workspaces/', AdminConsoleUserWorkspacesView.as_view(), name='admin_console_user_workspaces'),
    path('admin/users/<uuid:user_id>/workspaces/<uuid:workspace_id>/', AdminConsoleUserWorkspaceDetailView.as_view(), name='admin_console_user_workspace_detail'),
    path('admin/users/<uuid:user_id>/assign/', AdminConsoleUserAssignmentView.as_view(), name='admin_console_user_assign'),
    path('admin/workspaces/', AdminConsoleWorkspacesView.as_view(), name='admin_console_workspaces'),
    path('admin/workspaces/<uuid:workspace_id>/', AdminConsoleWorkspaceManagementDetailView.as_view(), name='admin_console_workspace_management_detail'),
    path('admin/workspaces/<uuid:workspace_id>/status/', AdminConsoleWorkspaceStatusView.as_view(), name='admin_console_workspace_status'),
    path('admin/workspaces/<uuid:workspace_id>/members/', AdminConsoleWorkspaceMembersView.as_view(), name='admin_console_workspace_members'),
    
    # Stage 10.1 Workspace Available Permissions & Custom Roles
    path('admin/workspaces/<uuid:workspace_id>/available-permissions/', AdminWorkspaceAvailablePermissionsView.as_view(), name='admin_workspace_available_permissions'),
    path('admin/workspaces/<uuid:workspace_id>/roles/', AdminWorkspaceRolesListView.as_view(), name='admin_workspace_roles_list'),
    path('admin/workspaces/<uuid:workspace_id>/roles/<uuid:role_id>/', AdminWorkspaceRoleDetailView.as_view(), name='admin_workspace_role_detail'),

    # Phase 3 Admin Console
    path('admin/auth/login/', AdminLoginView.as_view(), name='admin_login'),
    path('admin/admins/', AdminManagementListView.as_view(), name='admin_management_list'),
    path('admin/admins/<uuid:admin_id>/', AdminManagementDetailView.as_view(), name='admin_management_detail'),
    path('admin/admins/<uuid:admin_id>/workspaces/', AdminManagementWorkspaceAssignmentsView.as_view(), name='admin_management_workspace_assignments'),
    path('admin/admins/<uuid:admin_id>/reset-password/', AdminManagementPasswordResetView.as_view(), name='admin_management_reset_password'),
    
    # Phase 4 Permissions
    path('admin/permissions/modules/', AdminPermissionModulesView.as_view(), name='admin_permission_modules'),
    path('admin/admins/<uuid:admin_id>/permissions/', AdminPermissionManagementView.as_view(), name='admin_permission_management'),
]
