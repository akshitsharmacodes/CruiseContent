from rest_framework import permissions

class IsWorkspaceMember(permissions.BasePermission):
    """
    Custom permission to only allow users to access objects within their workspace.
    Assumes the model has a `workspace` attribute.
    """
    def has_object_permission(self, request, view, obj):
        if not hasattr(request.user, 'current_workspace') or not request.user.current_workspace:
            return False
        
        # If the object itself is a workspace, check if it's the user's workspace
        if hasattr(obj, 'open_ai_key'): # Naive check for Workspace model
            return obj == request.user.current_workspace
            
        return obj.workspace == request.user.current_workspace

class HasWorkspaceAPIKey(permissions.BasePermission):
    """
    Checks if the user's workspace has an OpenAI API key configured.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.current_workspace and 
            request.user.current_workspace.open_ai_key
        )
