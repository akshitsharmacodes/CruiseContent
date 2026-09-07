from rest_framework import permissions
from .models import WorkspaceMembership

class HasWorkspaceRole(permissions.BasePermission):
    """
    Validates that the user has an ACTIVE WorkspaceMembership for the requested workspace,
    and has the required role (if specified by the view).
    
    The workspace is typically inferred from the request's current_workspace, 
    but this permission actually validates it against the database.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        workspace = getattr(request.user, 'current_workspace', None)
        if not workspace:
            return False
            
        try:
            membership = WorkspaceMembership.objects.get(user=request.user, workspace=workspace)
        except WorkspaceMembership.DoesNotExist:
            return False
            
        if membership.status != 'ACTIVE':
            return False
            
        if workspace.status != 'ACTIVE':
            return False
            
        # Check role if the view requires a specific one
        required_roles = getattr(view, 'workspace_roles_required', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
        if membership.role not in required_roles:
            return False
            
        # Attach membership to request for easy access in views
        request.workspace_membership = membership
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
            
        workspace = None
        if hasattr(obj, 'open_ai_key'): # It's a Workspace
            workspace = obj
        elif hasattr(obj, 'workspace'): # It's a workspace-scoped object
            workspace = obj.workspace
            
        if not workspace:
            return False
            
        try:
            membership = WorkspaceMembership.objects.get(user=request.user, workspace=workspace)
        except WorkspaceMembership.DoesNotExist:
            return False
            
        if membership.status != 'ACTIVE':
            return False
            
        if workspace.status != 'ACTIVE':
            return False
            
        required_roles = getattr(view, 'workspace_roles_required', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
        if membership.role not in required_roles:
            return False
            
        return True

class HasWorkspaceAPIKey(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        workspace = getattr(request.user, 'current_workspace', None)
        if not workspace:
            return False
            
        try:
            membership = WorkspaceMembership.objects.get(user=request.user, workspace=workspace)
        except WorkspaceMembership.DoesNotExist:
            return False
            
        if membership.status != 'ACTIVE':
            return False
            
        if workspace.status != 'ACTIVE':
            return False
            
        # Validate that the actual workspace has the key
        return bool(workspace.open_ai_key)


def has_workspace_permission(user, workspace, software, feature, action):
    """
    Central runtime permission checker answering:
    "Does this authenticated user have permission for action in feature under software inside workspace?"

    Validates:
    1. User is authenticated and active.
    2. Workspace exists and status is ACTIVE.
    3. User has an ACTIVE WorkspaceMembership in the workspace.
    4. Software is entitled to workspace via active Subscription/PlanEntitlement.
    5. User has an assigned WorkspaceRole (custom_role) on that membership.
    6. The role belongs to that same workspace.
    7. The role explicitly grants the requested software, feature, and action.
    """
    if not user or not user.is_authenticated or not user.is_active:
        return False

    if not workspace or workspace.status != 'ACTIVE':
        return False

    try:
        membership = WorkspaceMembership.objects.select_related('custom_role', 'workspace').get(
            user=user,
            workspace=workspace
        )
    except WorkspaceMembership.DoesNotExist:
        return False

    if membership.status != 'ACTIVE':
        return False

    # 4. Check workspace subscription / software entitlement
    from .software_registry import get_available_software_for_workspace
    available_software = get_available_software_for_workspace(workspace)
    sw_match = next((s for s in available_software if s['code'] == software), None)
    if not sw_match:
        return False

    feat_match = next((f for f in sw_match['features'] if f['code'] == feature), None)
    if not feat_match:
        return False

    if action not in feat_match['actions']:
        return False

    # 5. Check if user is an ADMIN with delegated AdminPermission and AdminWorkspaceAssignment
    admin_profile = getattr(user, 'admin_profile', None)
    if admin_profile and admin_profile.is_active and admin_profile.admin_level == 'ADMIN':
        from accounts.models import AdminWorkspaceAssignment, AdminPermission
        # Enforce workspace assignment boundary for ADMIN
        if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace=workspace).exists():
            return False
        # Enforce delegated AdminPermission for this software module and action
        perm = AdminPermission.objects.filter(admin_profile=admin_profile, module=software, is_active=True).first()
        if not perm or action not in perm.actions:
            return False
        return True

    # 6. Check user's assigned custom role or default membership role fallback
    role = membership.custom_role
    if not role:
        # Default membership role fallback for entitled features
        if membership.role in ['OWNER', 'ADMIN']:
            return True
        elif membership.role == 'MEMBER':
            return action in ['VIEW', 'CREATE', 'UPDATE', 'PUBLISH', 'SEND', 'TEST', 'EXECUTE', 'DEPLOY']
        elif membership.role == 'VIEWER':
            return action in ['VIEW', 'DOWNLOAD', 'EXPORT']
        return False

    if role.workspace_id != workspace.id:
        return False

    # 6. Check explicit permissions in the role
    role_perms = role.permissions or []
    for entry in role_perms:
        if isinstance(entry, dict):
            if (entry.get('software') == software and 
                entry.get('feature') == feature and 
                action in entry.get('actions', [])):
                return True
        elif isinstance(entry, str):
            parts = entry.split('.')
            if len(parts) == 3:
                if parts[0] == software and parts[1] == feature and parts[2] == action:
                    return True

    return False


def HasSoftwarePermission(required_software, required_feature, required_action):
    """
    Returns a DRF permission class that verifies user has the required software, feature, and action permissions.
    """
    class _HasSoftwarePermission(permissions.BasePermission):
        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False

            workspace = getattr(request.user, 'current_workspace', None)
            if not workspace:
                return False

            allowed = has_workspace_permission(
                user=request.user,
                workspace=workspace,
                software=required_software,
                feature=required_feature,
                action=required_action
            )
            if allowed:
                try:
                    request.workspace_membership = WorkspaceMembership.objects.get(
                        user=request.user,
                        workspace=workspace
                    )
                except WorkspaceMembership.DoesNotExist:
                    pass
            return allowed

        def has_object_permission(self, request, view, obj):
            if not request.user or not request.user.is_authenticated:
                return False

            workspace = None
            if hasattr(obj, 'workspace'):
                workspace = obj.workspace
            elif hasattr(obj, 'open_ai_key'):
                workspace = obj
            else:
                workspace = getattr(request.user, 'current_workspace', None)

            if not workspace:
                return False

            return has_workspace_permission(
                user=request.user,
                workspace=workspace,
                software=required_software,
                feature=required_feature,
                action=required_action
            )

    return _HasSoftwarePermission
