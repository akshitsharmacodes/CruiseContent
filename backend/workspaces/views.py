from rest_framework.views import APIView
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Workspace, BusinessProfile
from .serializers import WorkspaceSerializer, BusinessProfileSerializer
from .permissions import HasWorkspaceRole

class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        admin_profile = getattr(user, 'admin_profile', None)
        if admin_profile and admin_profile.is_active:
            if admin_profile.admin_level == 'MASTER':
                return Workspace.objects.filter(status='ACTIVE').order_by('-created_at')
            else:
                from accounts.models import AdminWorkspaceAssignment
                assigned_ws_ids = AdminWorkspaceAssignment.objects.filter(
                    admin_profile=admin_profile
                ).values_list('workspace_id', flat=True)
                return Workspace.objects.filter(
                    id__in=assigned_ws_ids,
                    status='ACTIVE'
                ).order_by('-created_at')

        # Only return workspaces where the user has an ACTIVE membership
        return Workspace.objects.filter(memberships__user=user, memberships__status='ACTIVE').order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        workspace = self.get_object()
        from workspaces.models import WorkspaceMembership
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        is_master = hasattr(request.user, 'admin_profile') and request.user.admin_profile.is_active and request.user.admin_profile.admin_level == 'MASTER'
        membership = WorkspaceMembership.objects.filter(user=request.user, workspace=workspace, status='ACTIVE').first()
        
        if not is_master and (not membership or membership.role != 'OWNER'):
            return Response({'error': 'Only the workspace owner or Master Admin can delete this workspace.'}, status=status.HTTP_403_FORBIDDEN)
            
        workspace_name = workspace.name
        User.objects.filter(current_workspace=workspace).update(current_workspace=None)
        workspace.delete()
        return Response({'message': f'Workspace "{workspace_name}" deleted successfully'}, status=status.HTTP_200_OK)

class BusinessProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasWorkspaceRole]
    
    def get_permissions(self):
        if self.request.method == 'POST':
            self.workspace_roles_required = ['OWNER', 'ADMIN']
        else:
            self.workspace_roles_required = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
        return super().get_permissions()

    def get(self, request):
        # HasWorkspaceRole already validates that request.user.current_workspace exists and is accessible
        try:
            profile = request.user.current_workspace.business_profile
            serializer = BusinessProfileSerializer(profile)
            return Response(serializer.data)
        except BusinessProfile.DoesNotExist:
            return Response({"detail": "Profile not found", "onboarding_required": True}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        user = request.user
        try:
            profile = user.current_workspace.business_profile
            serializer = BusinessProfileSerializer(profile, data=request.data, partial=True)
        except BusinessProfile.DoesNotExist:
            serializer = BusinessProfileSerializer(data=request.data)
            
        if serializer.is_valid():
            serializer.save(workspace=user.current_workspace)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OnboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        user = request.user
        data = request.data
        
        business_name = data.get('business_name', 'My Business')
        
        # 1. Create Workspace
        workspace = Workspace.objects.create(name=f"{business_name} Workspace")
        
        # 2. Create WorkspaceMembership as OWNER
        from .models import WorkspaceMembership
        WorkspaceMembership.objects.create(
            user=user,
            workspace=workspace,
            role='OWNER',
            status='ACTIVE'
        )
        
        # 3. Link Workspace to User
        user.current_workspace = workspace
        user.save(update_fields=['current_workspace'])
        
        # 4. Create BusinessProfile
        profile_serializer = BusinessProfileSerializer(data=data)
        if profile_serializer.is_valid():
            profile_serializer.save(workspace=workspace)
        else:
            # Cleanup workspace if profile creation fails
            workspace.delete()
            return Response(profile_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({"message": "Workspace created successfully!", "workspace_id": workspace.id}, status=status.HTTP_201_CREATED)

class SwitchWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({"error": "workspace_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user
        admin_profile = getattr(user, 'admin_profile', None)
        if admin_profile and admin_profile.is_active:
            if admin_profile.admin_level == 'MASTER':
                workspace = get_object_or_404(Workspace, id=workspace_id, status='ACTIVE')
            else:
                from accounts.models import AdminWorkspaceAssignment
                if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                    return Response({"error": "Workspace not found in your assigned scope"}, status=status.HTTP_404_NOT_FOUND)
                workspace = get_object_or_404(Workspace, id=workspace_id, status='ACTIVE')

            from .models import WorkspaceMembership
            WorkspaceMembership.objects.get_or_create(
                workspace=workspace,
                user=user,
                defaults={'role': 'ADMIN', 'status': 'ACTIVE'}
            )
        else:
            workspace = get_object_or_404(
                Workspace, 
                id=workspace_id, 
                memberships__user=request.user, 
                memberships__status='ACTIVE'
            )

        request.user.current_workspace = workspace
        request.user.save(update_fields=['current_workspace'])
        
        return Response({"message": "Switched workspace successfully", "current_workspace_id": workspace.id})


class UserWorkspacePermissionsView(APIView):
    """
    Returns the current user's effective entitlement-checked permissions for their active workspace.
    Used by the frontend navigation and permission helpers to conditionally render software, routes, and actions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        workspace = getattr(user, 'current_workspace', None)

        if not workspace or workspace.status != 'ACTIVE':
            return Response({
                "workspace_id": str(workspace.id) if workspace else None,
                "workspace_name": workspace.name if workspace else None,
                "workspace_status": workspace.status if workspace else None,
                "role": None,
                "custom_role": None,
                "software_modules": [],
                "permissions": []
            })

        from .models import WorkspaceMembership
        try:
            membership = WorkspaceMembership.objects.select_related('custom_role').get(
                user=user,
                workspace=workspace
            )
        except WorkspaceMembership.DoesNotExist:
            return Response({
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "workspace_status": workspace.status,
                "role": None,
                "custom_role": None,
                "software_modules": [],
                "permissions": []
            })

        if membership.status != 'ACTIVE':
            return Response({
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "workspace_status": workspace.status,
                "membership_status": membership.status,
                "role": membership.role,
                "custom_role": None,
                "software_modules": [],
                "permissions": []
            })

        custom_role = membership.custom_role
        
        # Check entitled software for the workspace
        from .software_registry import get_available_software_for_workspace
        available_software = get_available_software_for_workspace(workspace)
        allowed_map = {}
        for sw in available_software:
            allowed_map[sw["code"]] = {}
            for feat in sw["features"]:
                allowed_map[sw["code"]][feat["code"]] = set(feat["actions"])

        effective_permissions = []
        effective_software_set = set()

        # Check if user is an ADMIN with delegated AdminPermission and AdminWorkspaceAssignment
        admin_profile = getattr(user, 'admin_profile', None)
        if admin_profile and admin_profile.is_active and admin_profile.admin_level == 'ADMIN':
            from accounts.models import AdminWorkspaceAssignment, AdminPermission
            # Enforce workspace scoping
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace=workspace).exists():
                return Response({
                    "workspace_id": str(workspace.id),
                    "workspace_name": workspace.name,
                    "workspace_status": workspace.status,
                    "membership_status": membership.status,
                    "role": membership.role,
                    "custom_role": None,
                    "software_modules": [],
                    "permissions": []
                })

            # Intersect workspace entitlements with active delegated permissions for this admin
            active_admin_perms = {
                p.module: set(p.actions)
                for p in AdminPermission.objects.filter(admin_profile=admin_profile, is_active=True)
            }

            for sw in available_software:
                sw_code = sw["code"]
                if sw_code not in active_admin_perms:
                    continue
                delegated_actions = active_admin_perms[sw_code]

                for feat in sw["features"]:
                    feat_code = feat["code"]
                    actions = [a for a in feat["actions"] if a in delegated_actions]
                    if actions:
                        effective_permissions.append({
                            "software": sw_code,
                            "feature": feat_code,
                            "actions": actions
                        })
                        effective_software_set.add(sw_code)

            return Response({
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "workspace_status": workspace.status,
                "membership_status": membership.status,
                "role": membership.role,
                "custom_role": None,
                "software_modules": sorted(list(effective_software_set)),
                "permissions": effective_permissions
            })

        if not custom_role:
            # Fallback for standard workspace membership roles (OWNER, ADMIN, MEMBER, VIEWER)
            for sw in available_software:
                sw_code = sw["code"]
                for feat in sw["features"]:
                    feat_code = feat["code"]
                    actions = feat["actions"]
                    if membership.role in ['OWNER', 'ADMIN']:
                        granted = list(actions)
                    elif membership.role == 'MEMBER':
                        granted = [a for a in actions if a in ['VIEW', 'CREATE', 'UPDATE', 'PUBLISH', 'SEND', 'TEST', 'EXECUTE', 'DEPLOY']]
                    elif membership.role == 'VIEWER':
                        granted = [a for a in actions if a in ['VIEW', 'DOWNLOAD', 'EXPORT']]
                    else:
                        granted = []

                    if granted:
                        effective_permissions.append({
                            "software": sw_code,
                            "feature": feat_code,
                            "actions": granted
                        })
                        effective_software_set.add(sw_code)

            return Response({
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "workspace_status": workspace.status,
                "membership_status": membership.status,
                "role": membership.role,
                "custom_role": None,
                "software_modules": sorted(list(effective_software_set)),
                "permissions": effective_permissions
            })

        if custom_role.workspace_id != workspace.id:
            return Response({
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "workspace_status": workspace.status,
                "membership_status": membership.status,
                "role": membership.role,
                "custom_role": None,
                "software_modules": [],
                "permissions": []
            })

        # Filter custom_role.permissions to only strictly entitled items
        effective_permissions = []
        effective_software_set = set()

        role_perms = custom_role.permissions or []
        for entry in role_perms:
            if isinstance(entry, dict):
                sw_code = entry.get("software")
                feat_code = entry.get("feature")
                actions = entry.get("actions", [])
                if sw_code in allowed_map and feat_code in allowed_map[sw_code]:
                    valid_actions = [a for a in actions if a in allowed_map[sw_code][feat_code]]
                    if valid_actions:
                        effective_permissions.append({
                            "software": sw_code,
                            "feature": feat_code,
                            "actions": valid_actions
                        })
                        effective_software_set.add(sw_code)
            elif isinstance(entry, str):
                parts = entry.split('.')
                if len(parts) == 3:
                    sw_code, feat_code, act = parts[0], parts[1], parts[2]
                    if sw_code in allowed_map and feat_code in allowed_map[sw_code] and act in allowed_map[sw_code][feat_code]:
                        existing = next((p for p in effective_permissions if p["software"] == sw_code and p["feature"] == feat_code), None)
                        if existing:
                            if act not in existing["actions"]:
                                existing["actions"].append(act)
                        else:
                            effective_permissions.append({
                                "software": sw_code,
                                "feature": feat_code,
                                "actions": [act]
                            })
                        effective_software_set.add(sw_code)

        return Response({
            "workspace_id": str(workspace.id),
            "workspace_name": workspace.name,
            "workspace_status": workspace.status,
            "membership_status": membership.status,
            "role": membership.role,
            "custom_role": {
                "id": str(custom_role.id),
                "name": custom_role.name,
                "description": custom_role.description
            },
            "software_modules": sorted(list(effective_software_set)),
            "permissions": effective_permissions
        })

