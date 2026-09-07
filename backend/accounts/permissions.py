from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to authenticated users who have an active AdminProfile.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or not request.user.is_active:
            return False
            
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return False
            
        return True

class IsMasterAdmin(IsAdminUser):
    """
    Allows access only to authenticated users who have an active AdminProfile with MASTER level.
    """
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
            
        return request.user.admin_profile.admin_level == 'MASTER'

def HasAdminPermission(required_module, required_action):
    """
    Returns a permission class that checks if the admin has the required action in the module.
    """
    class _HasAdminPermission(IsAdminUser):
        def has_permission(self, request, view):
            if not super().has_permission(request, view):
                return False
                
            admin_profile = request.user.admin_profile
            
            # MASTER has unrestricted access
            if admin_profile.admin_level == 'MASTER':
                return True
                
            # For ADMIN level, check if they have active permission for this module/action
            from .models import AdminPermission
            try:
                perm = AdminPermission.objects.get(admin_profile=admin_profile, module=required_module, is_active=True)
                return required_action in perm.actions
            except AdminPermission.DoesNotExist:
                return False
                
    return _HasAdminPermission

