from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Count, Prefetch
from django.contrib.auth import get_user_model, authenticate
from .models import ClientProfile, AdminProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment, AdminUserAssignment
from workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from .jwt_utils import generate_tokens_for_user
from .permissions import IsMasterAdmin, IsAdminUser
from .tasks import send_password_reset_email
from .views import _set_refresh_cookie

User = get_user_model()

class AdminLoginView(APIView):
    """
    Admin email/password login that issues custom JWTs.
    Only allows users with an active AdminProfile.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate with the existing backend
        user = authenticate(username=email, password=password)
        
        # Case-insensitive fallback if exact natural key failed
        if not user:
            candidate = User.objects.filter(email__iexact=email).first() or User.objects.filter(username__iexact=email).first()
            if candidate and candidate.check_password(password) and candidate.is_active:
                user = candidate

        if not user or not user.is_active:
            return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

        # Check AdminProfile
        admin_profile = getattr(user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'You do not have active administrative access'}, status=status.HTTP_403_FORBIDDEN)

        # Ensure ClientProfile exists as it is needed by generate_tokens_for_user
        profile, _ = ClientProfile.objects.get_or_create(user=user)

        # Generate tokens
        access, refresh = generate_tokens_for_user(user, profile)

        response = Response({'access_token': access, 'refresh_token': refresh})
        _set_refresh_cookie(response, refresh)
        return response


class AdminManagementListView(APIView):
    """
    MASTER ONLY endpoint to list and create ADMIN users.
    """
    permission_classes = [IsMasterAdmin]

    def get(self, request):
        admins = AdminProfile.objects.select_related('user').all().order_by('-created_at')
        data = []
        for admin in admins:
            user = admin.user
            data.append({
                'id': admin.id,
                'user_id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'admin_level': admin.admin_level,
                'is_active': admin.is_active,
                'created_at': admin.created_at,
                'updated_at': admin.updated_at,
                'disabled_at': admin.disabled_at.isoformat() if admin.disabled_at else None,
                'disabled_reason': admin.disabled_reason,
                'last_login': user.last_login.isoformat() if user.last_login else None
            })
        return Response(data)

    @transaction.atomic
    def post(self, request):
        email = (request.data.get('email') or '').strip()
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        password = request.data.get('password')
        permissions = request.data.get('permissions', [])
        
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        # API must never create MASTER.
        # Check if user exists (case-insensitive)
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            # Create the user
            user = User.objects.create_user(
                username=email, 
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            user.is_active = True
            if password:
                user.set_password(password)
                user.save(update_fields=['password', 'is_active'])
            else:
                user.save(update_fields=['is_active'])
                # Send initial password setup email
                from django.contrib.auth.tokens import PasswordResetTokenGenerator
                from django.utils.http import urlsafe_base64_encode
                from django.utils.encoding import force_bytes
                from django.conf import settings
                
                token_generator = PasswordResetTokenGenerator()
                token = token_generator.make_token(user)
                uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
                reset_url = f"{frontend_url}/reset-password?uid={uidb64}&token={token}"
                
                send_password_reset_email.delay(user.email, reset_url)
                
        elif hasattr(user, 'admin_profile'):
            return Response({'error': 'User already has an admin profile'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Existing user being promoted to admin
            if password:
                user.set_password(password)
            user.is_active = True
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            user.save()

        ClientProfile.objects.get_or_create(user=user)

        # Create AdminProfile (always ADMIN level)
        admin_profile = AdminProfile.objects.create(
            user=user,
            admin_level='ADMIN',
            is_active=True
        )

        if permissions and isinstance(permissions, list):
            for item in permissions:
                module = item.get('module')
                actions = item.get('actions', [])
                if module in MODULE_ACTION_MATRIX:
                    valid_actions = MODULE_ACTION_MATRIX[module]
                    clean_actions = [a for a in actions if a in valid_actions]
                    if clean_actions:
                        AdminPermission.objects.update_or_create(
                            admin_profile=admin_profile,
                            module=module,
                            defaults={'actions': clean_actions, 'is_active': True}
                        )

        AdminAuditLog.objects.create(
            actor=request.user,
            action='CREATE_ADMIN',
            target_admin=admin_profile,
            details={'email': email}
        )

        return Response({
            'id': admin_profile.id,
            'user_id': user.id,
            'email': user.email,
            'admin_level': admin_profile.admin_level,
            'is_active': admin_profile.is_active
        }, status=status.HTTP_201_CREATED)


class AdminManagementDetailView(APIView):
    """
    MASTER ONLY endpoint to modify or delete an ADMIN.
    """
    permission_classes = [IsMasterAdmin]

    def patch(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot disable or modify a MASTER account via this API'}, status=status.HTTP_400_BAD_REQUEST)

        # Activate/Deactivate
        if 'is_active' in request.data:
            new_status = bool(request.data['is_active'])
            old_status = admin_profile.is_active
            
            if new_status != old_status:
                admin_profile.is_active = new_status
                if new_status:
                    admin_profile.disabled_at = None
                    admin_profile.disabled_reason = ''
                    action = 'ACTIVATE_ADMIN'
                else:
                    from django.utils import timezone
                    admin_profile.disabled_at = timezone.now()
                    admin_profile.disabled_reason = request.data.get('disabled_reason', '')
                    action = 'DISABLE_ADMIN'
                
                admin_profile.save(update_fields=['is_active', 'disabled_at', 'disabled_reason', 'updated_at'])
                
                AdminAuditLog.objects.create(
                    actor=request.user,
                    action=action,
                    target_admin=admin_profile,
                    details={'admin_id': str(admin_profile.id)}
                )

        return Response({
            'id': admin_profile.id,
            'is_active': admin_profile.is_active,
            'disabled_at': admin_profile.disabled_at.isoformat() if admin_profile.disabled_at else None,
            'disabled_reason': admin_profile.disabled_reason,
            'admin_level': admin_profile.admin_level
        })

    def delete(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Master admins cannot be deleted'}, status=status.HTTP_403_FORBIDDEN)

        # Deleting AdminProfile revokes admin access but leaves normal User intact
        
        AdminAuditLog.objects.create(
            actor=request.user,
            action='DELETE_ADMIN',
            target_admin=None, # Cannot link if we are deleting it
            details={
                'deleted_admin_id': str(admin_profile.id),
                'deleted_admin_email': admin_profile.user.email
            }
        )
        
        admin_profile.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

class AdminManagementPasswordResetView(APIView):
    """
    MASTER ONLY endpoint to reset an ADMIN's password directly.
    """
    permission_classes = [IsMasterAdmin]
    
    def post(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot reset password for MASTER via this API'}, status=status.HTTP_400_BAD_REQUEST)
            
        new_password = request.data.get('password')
        if not new_password or len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = admin_profile.user
        user.set_password(new_password)
        user.save(update_fields=['password'])
        
        AdminAuditLog.objects.create(
            actor=request.user,
            action='RESET_ADMIN_PASSWORD',
            target_admin=admin_profile,
            details={'admin_id': str(admin_profile.id)}
        )
        
        return Response({'message': 'Password reset successfully'})

from workspaces.software_registry import SOFTWARE_FEATURE_REGISTRY

# Phase 4 Canonical Matrix
MODULE_ACTION_MATRIX = {
    "DASHBOARD": ["VIEW"],
    "USERS": ["VIEW", "CREATE", "UPDATE", "SUSPEND", "ACTIVATE", "DEACTIVATE"],
    "WORKSPACES": ["VIEW", "CREATE", "UPDATE", "SUSPEND", "ACTIVATE", "ARCHIVE"],
    "ROLES": ["VIEW", "CREATE", "UPDATE", "DELETE"],
    "MEMBERSHIPS": ["VIEW", "ASSIGN", "REMOVE"],
    "PLANS": ["VIEW", "CREATE", "UPDATE", "DELETE", "MANAGE"],
    "SUBSCRIPTIONS": ["VIEW", "UPDATE", "CANCEL", "MANAGE"],
    "BILLING": ["VIEW", "MANAGE"],
    "CONTENT": ["VIEW", "UPDATE", "DELETE", "MANAGE"],
    "PLATFORMS": ["VIEW", "UPDATE", "DELETE", "MANAGE"],
    "WHATSAPP": ["VIEW", "UPDATE", "DELETE", "MANAGE"],
    "AI_USAGE": ["VIEW", "MANAGE"],
    "ADMIN_MANAGEMENT": ["VIEW", "CREATE", "UPDATE", "DELETE", "MANAGE"],
    "AUDIT_LOGS": ["VIEW"],
    "SYSTEM_SETTINGS": ["VIEW", "UPDATE", "MANAGE"]
}

# Dynamically integrate software modules from canonical SOFTWARE_FEATURE_REGISTRY
for sw_code, sw_data in SOFTWARE_FEATURE_REGISTRY.items():
    actions_set = set()
    for feat_code, feat_data in sw_data.get("features", {}).items():
        for act in feat_data.get("actions", []):
            actions_set.add(act)
    if actions_set:
        sorted_actions = sorted(list(actions_set), key=lambda x: (0 if x == 'VIEW' else 1, x))
        MODULE_ACTION_MATRIX[sw_code] = sorted_actions


class AdminPermissionModulesView(APIView):
    """
    MASTER ONLY endpoint to retrieve the canonical list of modules and their actions.
    """
    permission_classes = [IsMasterAdmin]

    def get(self, request):
        return Response({'modules': MODULE_ACTION_MATRIX})

from django.db import transaction
from .models import AdminPermission, AdminAuditLog

class AdminPermissionManagementView(APIView):
    """
    MASTER ONLY endpoint to retrieve and update an ADMIN's permissions.
    """
    permission_classes = [IsMasterAdmin]

    def get(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)
            
        perms = AdminPermission.objects.filter(admin_profile=admin_profile)
        data = []
        for p in perms:
            data.append({
                'id': p.id,
                'module': p.module,
                'actions': p.actions,
                'is_active': p.is_active
            })
            
        return Response(data)

    def patch(self, request, admin_id):
        """
        Accepts a JSON array of permissions:
        [
            {"module": "USERS", "actions": ["VIEW", "CREATE"], "is_active": True},
            ...
        ]
        """
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot manage permissions for MASTER'}, status=status.HTTP_400_BAD_REQUEST)

        updates = request.data
        if not isinstance(updates, list):
            return Response({'error': 'Payload must be a list of permission objects'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            changed = []
            for item in updates:
                module = item.get('module')
                actions = item.get('actions', [])
                is_active = item.get('is_active', True)

                if module not in MODULE_ACTION_MATRIX:
                    return Response({'error': f'Invalid module: {module}'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Filter invalid actions
                valid_actions = MODULE_ACTION_MATRIX[module]
                clean_actions = [a for a in actions if a in valid_actions]
                
                perm, created = AdminPermission.objects.get_or_create(
                    admin_profile=admin_profile, 
                    module=module,
                    defaults={'actions': clean_actions, 'is_active': is_active}
                )
                
                if not created:
                    perm.actions = clean_actions
                    perm.is_active = is_active
                    perm.save(update_fields=['actions', 'is_active', 'updated_at'])
                    
                changed.append({'module': module, 'actions': clean_actions, 'is_active': is_active})
            
            # Audit log
            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_PERMISSIONS',
                target_admin=admin_profile,
                details={'changes': changed}
            )

        return Response({'message': 'Permissions updated', 'changes': changed})

from .permissions import HasAdminPermission

def get_admin_scoped_users(request_user):
    """
    Returns the authoritative queryset of users visible to request_user.
    - MASTER sees all users across all workspaces and admins.
    - ADMIN sees ONLY users explicitly assigned to that ADMIN within authorized workspaces.
    - Users with admin_profile.admin_level == 'MASTER' are NEVER visible to non-master ADMINs.
    """
    admin_profile = getattr(request_user, 'admin_profile', None)
    if not admin_profile or not admin_profile.is_active:
        return User.objects.none()

    if admin_profile.admin_level == 'MASTER':
        return User.objects.all()

    # Get workspaces explicitly assigned to this admin
    assigned_workspace_ids = AdminWorkspaceAssignment.objects.filter(
        admin_profile=admin_profile
    ).values_list('workspace_id', flat=True)

    # Get users explicitly assigned to this admin in those workspaces
    assigned_user_ids = AdminUserAssignment.objects.filter(
        admin_profile=admin_profile,
        workspace_id__in=assigned_workspace_ids
    ).values_list('user_id', flat=True)

    # Filter by explicit assignment and defense-in-depth: exclude any MASTER admin users
    return User.objects.filter(id__in=assigned_user_ids).exclude(admin_profile__admin_level='MASTER')


class AdminConsoleUsersView(APIView):
    """
    Phase 6 Admin Console global users endpoint.
    GET: Requires MASTER or USERS/VIEW permission.
    POST: Requires MASTER or USERS/CREATE permission.
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [HasAdminPermission(required_module="USERS", required_action="CREATE")()]
        return [HasAdminPermission(required_module="USERS", required_action="VIEW")()]

    def get(self, request):
        users_qs = get_admin_scoped_users(request.user)

        # Optional workspace filtering
        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            admin_profile = getattr(request.user, 'admin_profile', None)
            if admin_profile and admin_profile.admin_level != 'MASTER':
                if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                    return Response([])
            users_qs = users_qs.filter(workspace_memberships__workspace_id=workspace_id)

        # Optional search filtering
        search = request.query_params.get('search')
        if search:
            search = search.strip()
            users_qs = users_qs.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        users = users_qs.select_related('profile').distinct().order_by('-date_joined')
        data = []
        for u in users:
            profile = getattr(u, 'profile', None)
            data.append({
                'id': u.id,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'date_joined': u.date_joined.isoformat() if u.date_joined else None,
                'tier': profile.tier if profile else 'FREE',
                'posts_created': profile.posts_created if profile else 0,
                'publish_clicks': profile.publish_clicks if profile else 0,
                'is_active': u.is_active,
                'last_login': u.last_login.isoformat() if u.last_login else None,
            })
        return Response(data)

    def post(self, request):
        """
        Create a normal user from the Admin Console.
        Accepts: email, password, first_name, last_name, workspace_id (required for ADMIN), role_id (optional).
        Never accepts: admin_level, admin_profile_id, permissions, is_staff, is_superuser, role.
        """
        from workspaces.models import Workspace, WorkspaceRole, WorkspaceMembership

        email = (request.data.get('email') or '').strip()
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        workspace_id = request.data.get('workspace_id')
        role_id = request.data.get('role_id')
        assign_to_admin_id = request.data.get('admin_profile_id') or request.data.get('admin_id')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'A user with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        # Reject any attempt to supply privileged fields or directly inject permissions
        forbidden_fields = ['admin_level', 'permissions', 'is_staff', 'is_superuser', 'role', 'actions', 'software']
        for field in forbidden_fields:
            if field in request.data:
                return Response(
                    {'error': f'Field \'{field}\' is not allowed in user creation'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        admin_profile = getattr(request.user, 'admin_profile', None)
        is_master = admin_profile and admin_profile.admin_level == 'MASTER'

        target_workspace = None
        target_role = None
        target_admin_profile = None

        if not is_master:
            # Non-master ADMIN: workspace_id is required or inferred if exactly one assigned workspace
            if not workspace_id:
                assigned_ws = list(AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile))
                if len(assigned_ws) == 1:
                    ws_assignment = assigned_ws[0]
                    target_workspace = ws_assignment.workspace
                else:
                    return Response({'error': 'workspace_id is required for admin user creation'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Check workspace assignment
                ws_assignment = AdminWorkspaceAssignment.objects.filter(
                    admin_profile=admin_profile,
                    workspace_id=workspace_id
                ).first()
                if not ws_assignment:
                    return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)
                target_workspace = ws_assignment.workspace

            # Check user capacity limit
            current_count = AdminUserAssignment.objects.filter(
                admin_profile=admin_profile,
                workspace=target_workspace
            ).count()
            if current_count >= ws_assignment.max_users:
                return Response({
                    'error': f'User limit reached for this workspace ({ws_assignment.max_users} max users allowed)'
                }, status=status.HTTP_400_BAD_REQUEST)

            target_admin_profile = admin_profile
        else:
            # MASTER caller
            if workspace_id:
                try:
                    target_workspace = Workspace.objects.get(id=workspace_id)
                except Workspace.DoesNotExist:
                    return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

            if assign_to_admin_id:
                try:
                    target_admin_profile = AdminProfile.objects.get(id=assign_to_admin_id)
                except AdminProfile.DoesNotExist:
                    return Response({'error': 'Target admin not found'}, status=status.HTTP_404_NOT_FOUND)

                if target_workspace:
                    # Verify target admin is assigned to this workspace
                    target_ws_assign = AdminWorkspaceAssignment.objects.filter(
                        admin_profile=target_admin_profile,
                        workspace=target_workspace
                    ).first()
                    if not target_ws_assign:
                        return Response({'error': 'Target admin is not assigned to this workspace'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    cur_cnt = AdminUserAssignment.objects.filter(admin_profile=target_admin_profile, workspace=target_workspace).count()
                    if cur_cnt >= target_ws_assign.max_users:
                        return Response({'error': f'Target admin has reached user limit ({target_ws_assign.max_users}) for this workspace'}, status=status.HTTP_400_BAD_REQUEST)

        if target_workspace and role_id and role_id != 'none':
            try:
                target_role = WorkspaceRole.objects.get(id=role_id, workspace=target_workspace)
            except WorkspaceRole.DoesNotExist:
                return Response({'error': 'Custom role not found in the selected workspace'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                current_workspace=target_workspace
            )
            profile, _ = ClientProfile.objects.get_or_create(user=user)

            membership = None
            if target_workspace:
                membership = WorkspaceMembership.objects.create(
                    user=user,
                    workspace=target_workspace,
                    role='MEMBER',
                    custom_role=target_role,
                    status='ACTIVE'
                )

            # Atomically create AdminUserAssignment if an admin is assigned
            if target_workspace and target_admin_profile:
                AdminUserAssignment.objects.create(
                    admin_profile=target_admin_profile,
                    workspace=target_workspace,
                    user=user,
                    assigned_by=request.user
                )

            # Audit log
            AdminAuditLog.objects.create(
                actor=request.user,
                action='CREATE_USER',
                target_admin=target_admin_profile,
                details={
                    'created_user_id': str(user.id),
                    'created_user_email': user.email,
                    'workspace_id': str(target_workspace.id) if target_workspace else None,
                    'workspace_name': target_workspace.name if target_workspace else None,
                    'role_id': str(target_role.id) if target_role else None,
                    'role_name': target_role.name if target_role else None,
                    'assigned_to_admin': str(target_admin_profile.id) if target_admin_profile else None
                }
            )

        resp_data = {
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'is_active': user.is_active,
            'tier': profile.tier,
        }

        if target_workspace:
            resp_data['workspace'] = {
                'id': str(target_workspace.id),
                'name': target_workspace.name
            }
        if target_role:
            resp_data['custom_role'] = {
                'id': str(target_role.id),
                'name': target_role.name
            }

        return Response(resp_data, status=status.HTTP_201_CREATED)


class AdminConsoleUserDetailView(APIView):
    """
    Phase 6 Admin Console specific user endpoint.
    PATCH: Requires MASTER or USERS/UPDATE permission.
    """
    
    def get_permissions(self):
        return [HasAdminPermission(required_module="USERS", required_action="UPDATE")()]

    def patch(self, request, user_id):
        """
        Update normal user account information.
        Accepts: email, first_name, last_name.
        Never accepts: admin_level, admin_profile_id, permissions, is_staff, is_superuser, role.
        """
        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            if User.objects.filter(id=user_id).exists():
                target_user = User.objects.get(id=user_id)
                if hasattr(target_user, 'admin_profile') and target_user.admin_profile.admin_level == 'MASTER':
                    return Response({'error': 'Cannot modify MASTER accounts'}, status=status.HTTP_403_FORBIDDEN)
                return Response({'error': 'User not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Reject any attempt to supply privileged fields
        forbidden_fields = ['admin_level', 'admin_profile_id', 'permissions', 'is_staff', 'is_superuser', 'role', 'status', 'is_active']
        for field in forbidden_fields:
            if field in request.data:
                return Response(
                    {'error': f'Field \'{field}\' is not allowed in user update'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        email = request.data.get('email')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        
        updated = False
        
        if email and email != user.email:
            if User.objects.exclude(id=user.id).filter(email__iexact=email).exists():
                return Response({'error': 'A user with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
            user.username = email
            updated = True
            
        if first_name is not None and first_name != user.first_name:
            user.first_name = first_name
            updated = True
            
        if last_name is not None and last_name != user.last_name:
            user.last_name = last_name
            updated = True

        if updated:
            user.save(update_fields=['email', 'username', 'first_name', 'last_name'])
            
            # Audit log
            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_USER',
                target_admin=None,
                details={
                    'updated_user_id': str(user.id),
                    'updated_fields': list(request.data.keys())
                }
            )

        profile = getattr(user, 'profile', None)

        return Response({
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'is_active': user.is_active,
            'status': user.status,
            'tier': profile.tier if profile else 'FREE',
        })


class AdminConsoleUserStatusView(APIView):
    """
    Phase 6 Admin Console specific user status endpoint.
    PATCH: Requires MASTER or USERS granular status action (ACTIVATE, SUSPEND, DEACTIVATE).
    """
    permission_classes = [IsAdminUser]

    def patch(self, request, user_id):
        """
        Update normal user account status.
        Accepts: status ('ACTIVE', 'SUSPENDED', 'DEACTIVATED').
        Never accepts: admin_level, admin_profile_id, permissions, is_staff, is_superuser, role.
        """
        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            if User.objects.filter(id=user_id).exists():
                target_user = User.objects.get(id=user_id)
                if hasattr(target_user, 'admin_profile') and target_user.admin_profile.admin_level == 'MASTER':
                    return Response({'error': 'Cannot modify MASTER accounts'}, status=status.HTTP_403_FORBIDDEN)
                return Response({'error': 'User not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Reject any attempt to supply privileged fields
        forbidden_fields = ['admin_level', 'admin_profile_id', 'permissions', 'is_staff', 'is_superuser', 'role', 'is_active', 'email', 'first_name', 'last_name']
        for field in forbidden_fields:
            if field in request.data:
                return Response(
                    {'error': f'Field \'{field}\' is not allowed in user status update'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        new_status = request.data.get('status')
        if not new_status:
            return Response({'error': 'Status is required'}, status=status.HTTP_400_BAD_REQUEST)

        valid_statuses = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']
        if new_status not in valid_statuses:
            return Response({'error': f'Invalid status. Must be one of {valid_statuses}'}, status=status.HTTP_400_BAD_REQUEST)

        # Map status transition to canonical required USERS action
        status_action_map = {
            'ACTIVE': 'ACTIVATE',
            'SUSPENDED': 'SUSPEND',
            'DEACTIVATED': 'DEACTIVATE'
        }
        required_action = status_action_map.get(new_status)
        perm_checker = HasAdminPermission(required_module="USERS", required_action=required_action)()
        if not perm_checker.has_permission(request, self):
            # Check legacy UPDATE fallback if admin lacks granular status actions
            admin_profile = getattr(request.user, 'admin_profile', None)
            from .models import AdminPermission
            user_perm = AdminPermission.objects.filter(admin_profile=admin_profile, module="USERS", is_active=True).first() if admin_profile else None
            user_actions = set(user_perm.actions) if user_perm else set()
            if not user_actions.intersection({'ACTIVATE', 'SUSPEND', 'DEACTIVATE'}) and 'UPDATE' in user_actions:
                pass
            else:
                return Response({'error': f'You do not have permission to {required_action} users.'}, status=status.HTTP_403_FORBIDDEN)

        old_status = user.status

        if old_status != new_status:
            user.status = new_status
            if new_status == 'ACTIVE':
                user.is_active = True
            else:
                user.is_active = False

            user.save(update_fields=['status', 'is_active'])
            
            # Audit log
            AdminAuditLog.objects.create(
                actor=request.user,
                action='CHANGE_USER_STATUS',
                target_admin=None,
                details={
                    'updated_user_id': str(user.id),
                    'old_status': old_status,
                    'new_status': new_status
                }
            )

        return Response({
            'id': user.id,
            'status': user.status,
            'is_active': user.is_active
        })


class AdminConsoleUserWorkspacesView(APIView):
    """
    Phase 6 Admin Console specific user workspace memberships list.
    GET: Requires MASTER or MEMBERSHIPS/VIEW permission.
    POST: Requires MASTER or MEMBERSHIPS/ASSIGN permission.
    """
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [(HasAdminPermission(required_module="MEMBERSHIPS", required_action="ASSIGN") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]
        return [(HasAdminPermission(required_module="MEMBERSHIPS", required_action="VIEW") | HasAdminPermission(required_module="WORKSPACES", required_action="VIEW"))()]

    def get(self, request, user_id):
        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        admin_profile = getattr(request.user, 'admin_profile', None)
        memberships = WorkspaceMembership.objects.filter(user=user).select_related('workspace', 'custom_role').order_by('-created_at')
        if admin_profile and admin_profile.admin_level != 'MASTER':
            assigned_ws_ids = AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile).values_list('workspace_id', flat=True)
            memberships = memberships.filter(workspace_id__in=assigned_ws_ids)

        data = []
        for m in memberships:
            data.append({
                'workspace_id': str(m.workspace.id),
                'workspace_name': m.workspace.name,
                'role': m.role,
                'custom_role': {
                    'id': str(m.custom_role.id),
                    'name': m.custom_role.name,
                    'permissions': m.custom_role.permissions
                } if m.custom_role else None,
                'status': m.status,
                'created_at': m.created_at.isoformat() if m.created_at else None,
            })
        return Response(data)

    def post(self, request, user_id):
        from workspaces.models import WorkspaceRole

        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        workspace_id = request.data.get('workspace_id')
        role = request.data.get('role', 'MEMBER')
        role_id = request.data.get('role_id')
        
        if not workspace_id:
            return Response({'error': 'workspace_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        valid_roles = [r[0] for r in WorkspaceMembership.ROLE_CHOICES]
        if role not in valid_roles:
            return Response({'error': f'Invalid role. Must be one of {valid_roles}'}, status=status.HTTP_400_BAD_REQUEST)

        admin_profile = getattr(request.user, 'admin_profile', None)
        is_master = admin_profile and admin_profile.admin_level == 'MASTER'

        if not is_master:
            ws_assignment = AdminWorkspaceAssignment.objects.filter(
                admin_profile=admin_profile,
                workspace_id=workspace_id
            ).first()
            if not ws_assignment:
                return Response({'error': 'You are not assigned to manage this workspace'}, status=status.HTTP_403_FORBIDDEN)
            target_workspace = ws_assignment.workspace

            # If user is not yet assigned in this workspace, check limit
            if not AdminUserAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id, user=user).exists():
                cur_cnt = AdminUserAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).count()
                if cur_cnt >= ws_assignment.max_users:
                    return Response({'error': f'User limit reached for this workspace ({ws_assignment.max_users} max users allowed)'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                target_workspace = Workspace.objects.get(id=workspace_id)
            except Workspace.DoesNotExist:
                return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        target_custom_role = None
        if role_id and role_id != 'none':
            try:
                target_custom_role = WorkspaceRole.objects.get(id=role_id, workspace=target_workspace)
            except WorkspaceRole.DoesNotExist:
                return Response({'error': 'Custom role not found in the selected workspace'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if WorkspaceMembership.objects.filter(user=user, workspace=target_workspace).exists():
                return Response({'error': 'User is already a member of this workspace'}, status=status.HTTP_400_BAD_REQUEST)

            membership = WorkspaceMembership.objects.create(
                user=user,
                workspace=target_workspace,
                role=role,
                custom_role=target_custom_role,
                status='ACTIVE'
            )

            if not is_master:
                AdminUserAssignment.objects.get_or_create(
                    admin_profile=admin_profile,
                    workspace=target_workspace,
                    user=user,
                    defaults={'assigned_by': request.user}
                )

            AdminAuditLog.objects.create(
                actor=request.user,
                action='ADD_WORKSPACE_MEMBER',
                target_admin=None,
                details={
                    'target_user_id': str(user.id),
                    'workspace_id': str(target_workspace.id),
                    'role': role,
                    'custom_role_id': str(target_custom_role.id) if target_custom_role else None,
                    'custom_role_name': target_custom_role.name if target_custom_role else None
                }
            )

        return Response({
            'workspace_id': str(membership.workspace.id),
            'workspace_name': membership.workspace.name,
            'role': membership.role,
            'custom_role': {
                'id': str(membership.custom_role.id),
                'name': membership.custom_role.name
            } if membership.custom_role else None,
            'status': membership.status
        }, status=status.HTTP_201_CREATED)


class AdminConsoleUserWorkspaceDetailView(APIView):
    """
    Phase 6 Admin Console specific user workspace membership detail.
    PATCH: Requires MASTER or MEMBERSHIPS/ASSIGN permission.
    DELETE: Requires MASTER or MEMBERSHIPS/REMOVE permission.
    """
    
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [(HasAdminPermission(required_module="MEMBERSHIPS", required_action="REMOVE") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]
        return [(HasAdminPermission(required_module="MEMBERSHIPS", required_action="ASSIGN") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]

    def patch(self, request, user_id, workspace_id):
        from workspaces.models import WorkspaceRole

        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            membership = WorkspaceMembership.objects.select_related('workspace').get(user=user, workspace_id=workspace_id)
        except WorkspaceMembership.DoesNotExist:
            return Response({'error': 'Membership not found'}, status=status.HTTP_404_NOT_FOUND)

        role = request.data.get('role')
        role_id = request.data.get('role_id')

        update_fields = []
        changes = {}

        if role:
            valid_roles = [r[0] for r in WorkspaceMembership.ROLE_CHOICES]
            if role not in valid_roles:
                return Response({'error': f'Invalid role. Must be one of {valid_roles}'}, status=status.HTTP_400_BAD_REQUEST)

            old_role = membership.role
            if old_role == 'OWNER' and role != 'OWNER':
                # Prevent demoting the last owner
                owner_count = WorkspaceMembership.objects.filter(workspace_id=workspace_id, role='OWNER', status='ACTIVE').count()
                if owner_count <= 1:
                    return Response({'error': 'Cannot demote the last owner of a workspace'}, status=status.HTTP_400_BAD_REQUEST)

            if old_role != role:
                changes['role'] = {'old': old_role, 'new': role}
                membership.role = role
                update_fields.append('role')

        if 'role_id' in request.data:
            if role_id is None or role_id == '' or role_id == 'none':
                if membership.custom_role is not None:
                    changes['custom_role'] = {'old': str(membership.custom_role.id), 'new': None}
                    membership.custom_role = None
                    update_fields.append('custom_role')
            else:
                try:
                    custom_role = WorkspaceRole.objects.get(id=role_id, workspace=membership.workspace)
                except WorkspaceRole.DoesNotExist:
                    return Response({'error': 'Custom role not found in this workspace'}, status=status.HTTP_400_BAD_REQUEST)

                old_custom_role_id = str(membership.custom_role_id) if membership.custom_role_id else None
                if old_custom_role_id != str(custom_role.id):
                    changes['custom_role'] = {'old': old_custom_role_id, 'new': str(custom_role.id)}
                    membership.custom_role = custom_role
                    update_fields.append('custom_role')

        if not update_fields:
            return Response({'message': 'No changes applied'})

        with transaction.atomic():
            membership.save(update_fields=update_fields)
            
            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_WORKSPACE_MEMBER',
                target_admin=None,
                details={
                    'target_user_id': str(user_id),
                    'workspace_id': str(workspace_id),
                    'changes': changes
                }
            )

        return Response({
            'message': 'Membership updated successfully',
            'workspace_id': str(membership.workspace_id),
            'role': membership.role,
            'custom_role': {
                'id': str(membership.custom_role.id),
                'name': membership.custom_role.name
            } if membership.custom_role else None,
            'status': membership.status
        })

    def delete(self, request, user_id, workspace_id):
        scoped_users = get_admin_scoped_users(request.user)
        try:
            user = scoped_users.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            membership = WorkspaceMembership.objects.get(user=user, workspace_id=workspace_id)
        except WorkspaceMembership.DoesNotExist:
            return Response({'error': 'Membership not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if membership.role == 'OWNER':
                owner_count = WorkspaceMembership.objects.filter(workspace_id=workspace_id, role='OWNER', status='ACTIVE').count()
                if owner_count <= 1:
                    return Response({'error': 'Cannot remove the last owner of a workspace'}, status=status.HTTP_400_BAD_REQUEST)

            membership.delete()
            # Clean up user assignment in this workspace
            AdminUserAssignment.objects.filter(workspace_id=workspace_id, user=user).delete()
            
            AdminAuditLog.objects.create(
                actor=request.user,
                action='REMOVE_WORKSPACE_MEMBER',
                target_admin=None,
                details={
                    'target_user_id': str(user_id),
                    'workspace_id': str(workspace_id),
                    'old_role': membership.role
                }
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

class AdminConsoleWorkspacesView(APIView):
    """
    Phase 6 Admin Console global workspaces endpoint.
    Requires MASTER or WORKSPACES/VIEW permission.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [HasAdminPermission(required_module="WORKSPACES", required_action="CREATE")()]
        return [HasAdminPermission(required_module="WORKSPACES", required_action="VIEW")()]

    def get(self, request):
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        # Prefetch owner memberships to avoid N+1 queries
        owner_prefetch = Prefetch(
            'memberships',
            queryset=WorkspaceMembership.objects.filter(role='OWNER').select_related('user'),
            to_attr='owner_memberships'
        )

        workspaces_qs = Workspace.objects.all()
        if admin_profile.admin_level != 'MASTER':
            assigned_ws_ids = AdminWorkspaceAssignment.objects.filter(
                admin_profile=admin_profile
            ).values_list('workspace_id', flat=True)
            workspaces_qs = workspaces_qs.filter(id__in=assigned_ws_ids)

        workspaces = workspaces_qs.annotate(
            member_count=Count('memberships')
        ).prefetch_related(owner_prefetch).order_by('-created_at')

        data = []
        for w in workspaces:
            owner_member = w.owner_memberships[0] if w.owner_memberships else None
            owner_user = owner_member.user if owner_member else None
            
            owner_data = None
            if owner_user:
                owner_data = {
                    'id': str(owner_user.id),
                    'email': owner_user.email,
                    'first_name': owner_user.first_name,
                    'last_name': owner_user.last_name
                }
                
            item = {
                'id': str(w.id),
                'name': w.name,
                'owner': owner_data,
                'member_count': w.member_count,
                'is_active': w.status == 'ACTIVE',
                'status': w.status,
                'created_at': w.created_at.isoformat() if w.created_at else None,
            }
            if admin_profile.admin_level != 'MASTER':
                wa = AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace=w).first()
                if wa:
                    item['max_users'] = wa.max_users
                    item['assigned_users_count'] = AdminUserAssignment.objects.filter(
                        admin_profile=admin_profile,
                        workspace=w
                    ).count()
            data.append(item)

        return Response(data)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        owner_id = request.data.get('owner_id')
        
        if not name:
            return Response({'error': 'Workspace name is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        admin_profile = getattr(request.user, 'admin_profile', None)
        is_master = admin_profile and admin_profile.admin_level == 'MASTER'

        if not is_master:
            # For non-master ADMIN:
            # Authenticated ADMIN is automatically established as workspace owner/creator by default.
            # Do NOT ask the ADMIN to manually select an arbitrary User as workspace owner.
            # If owner_id is provided, validate that ADMIN does not assign another ADMIN or MASTER.
            if owner_id:
                try:
                    candidate_owner = User.objects.get(id=owner_id)
                except User.DoesNotExist:
                    return Response({'error': 'Owner user not found'}, status=status.HTTP_404_NOT_FOUND)
                
                if candidate_owner != request.user:
                    if candidate_owner.is_superuser or hasattr(candidate_owner, 'admin_profile'):
                        return Response({'error': 'Admins cannot assign other admins or master users as workspace owner'}, status=status.HTTP_400_BAD_REQUEST)
                owner_user = candidate_owner
            else:
                owner_user = request.user
        else:
            # MASTER can optionally supply an owner_id, or default to request.user
            if owner_id:
                try:
                    owner_user = User.objects.get(id=owner_id)
                except User.DoesNotExist:
                    return Response({'error': 'Owner user not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                owner_user = request.user

        with transaction.atomic():
            workspace = Workspace.objects.create(name=name)
            
            WorkspaceMembership.objects.create(
                user=owner_user,
                workspace=workspace,
                role='OWNER',
                status='ACTIVE'
            )
            
            from workspaces.models import BusinessProfile
            BusinessProfile.objects.create(
                workspace=workspace,
                business_name=name
            )

            # Automatically attach active Plan subscription if available so custom roles & features work
            from payments.models import Plan, Subscription
            default_plan = Plan.objects.filter(is_active=True).first()
            if default_plan:
                Subscription.objects.get_or_create(
                    workspace=workspace,
                    defaults={
                        'plan': default_plan,
                        'status': 'ACTIVE',
                    }
                )

            # If created by non-master ADMIN, automatically assign workspace to this admin
            if admin_profile and admin_profile.admin_level != 'MASTER':
                AdminWorkspaceAssignment.objects.create(
                    admin_profile=admin_profile,
                    workspace=workspace,
                    max_users=10
                )
                if owner_user != request.user:
                    WorkspaceMembership.objects.get_or_create(
                        workspace=workspace,
                        user=request.user,
                        defaults={'role': 'ADMIN', 'status': 'ACTIVE'}
                    )
                    AdminUserAssignment.objects.get_or_create(
                        admin_profile=admin_profile,
                        workspace=workspace,
                        user=owner_user
                    )
            
            AdminAuditLog.objects.create(
                actor=request.user,
                action='CREATE_WORKSPACE',
                target_admin=None,
                details={
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name,
                    'owner_id': str(owner_user.id)
                }
            )
            
        return Response({
            'id': str(workspace.id),
            'name': workspace.name,
            'owner': {
                'id': str(owner_user.id),
                'email': owner_user.email,
                'first_name': owner_user.first_name,
                'last_name': owner_user.last_name
            },
            'member_count': 1,
            'is_active': workspace.status == 'ACTIVE',
            'status': workspace.status,
            'created_at': workspace.created_at.isoformat() if workspace.created_at else None
        }, status=status.HTTP_201_CREATED)


class AdminConsoleWorkspaceManagementDetailView(APIView):
    """
    Phase 6 Admin Console workspace detail endpoint.
    GET: Requires MASTER or WORKSPACES/VIEW permission.
    PATCH: Requires MASTER or WORKSPACES/UPDATE permission.
    DELETE: Requires MASTER permission.
    """
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsMasterAdmin()]
        elif self.request.method == 'GET':
            return [HasAdminPermission(required_module="WORKSPACES", required_action="VIEW")()]
        return [HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE")()]

    def get(self, request, workspace_id):
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        owner_member = WorkspaceMembership.objects.filter(workspace=workspace, role='OWNER').select_related('user').first()
        owner_data = None
        if owner_member and owner_member.user:
            owner_data = {
                'id': str(owner_member.user.id),
                'email': owner_member.user.email,
                'first_name': owner_member.user.first_name,
                'last_name': owner_member.user.last_name
            }

        item = {
            'id': str(workspace.id),
            'name': workspace.name,
            'owner': owner_data,
            'member_count': workspace.memberships.count(),
            'is_active': workspace.status == 'ACTIVE',
            'status': workspace.status,
            'created_at': workspace.created_at.isoformat() if workspace.created_at else None,
        }
        if admin_profile.admin_level != 'MASTER':
            wa = AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace=workspace).first()
            if wa:
                item['max_users'] = wa.max_users
                item['assigned_users_count'] = AdminUserAssignment.objects.filter(
                    admin_profile=admin_profile,
                    workspace=workspace
                ).count()

        return Response(item)

    def patch(self, request, workspace_id):
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name')
        
        if not name:
            return Response({'error': 'Workspace name is required for update'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
            
        old_name = workspace.name
        workspace.name = name
        workspace.save(update_fields=['name'])
        
        AdminAuditLog.objects.create(
            actor=request.user,
            action='UPDATE_WORKSPACE',
            target_admin=None,
            details={
                'workspace_id': str(workspace.id),
                'old_name': old_name,
                'new_name': workspace.name
            }
        )
        
        return Response({'message': 'Workspace updated successfully'})

    def delete(self, request, workspace_id):
        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
            
        workspace_name = workspace.name
        with transaction.atomic():
            # Clear current_workspace for any users who have this workspace active
            User.objects.filter(current_workspace=workspace).update(current_workspace=None)
            
            AdminAuditLog.objects.create(
                actor=request.user,
                action='DELETE_WORKSPACE',
                target_admin=None,
                details={
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace_name
                }
            )
            
            workspace.delete()
            
        return Response({'message': f'Workspace "{workspace_name}" deleted successfully'}, status=status.HTTP_200_OK)

class AdminConsoleWorkspaceStatusView(APIView):
    """
    Phase 8.2 Admin Console workspace status endpoint.
    PATCH: Requires MASTER or WORKSPACES/SUSPEND, WORKSPACES/ACTIVATE, or WORKSPACES/ARCHIVE permission depending on transition.
    """
    permission_classes = [IsAdminUser]

    def patch(self, request, workspace_id):
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if not new_status:
            return Response({'error': 'Status is required'}, status=status.HTTP_400_BAD_REQUEST)

        valid_statuses = ['ACTIVE', 'SUSPENDED', 'ARCHIVED']
        if new_status not in valid_statuses:
            return Response({'error': f'Invalid status. Must be one of {valid_statuses}'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = workspace.status
        if old_status == new_status:
            return Response({'message': 'Status unchanged', 'status': workspace.status}, status=status.HTTP_200_OK)

        if old_status == 'ARCHIVED':
            return Response({'error': 'Archived workspaces cannot be reactivated or suspended.'}, status=status.HTTP_400_BAD_REQUEST)

        required_action = None
        action_name = None
        
        if new_status == 'SUSPENDED':
            required_action = 'SUSPEND'
            action_name = 'SUSPEND_WORKSPACE'
        elif new_status == 'ACTIVE':
            required_action = 'ACTIVATE'
            action_name = 'ACTIVATE_WORKSPACE'
        elif new_status == 'ARCHIVED':
            required_action = 'ARCHIVE'
            action_name = 'ARCHIVE_WORKSPACE'

        perm_checker = HasAdminPermission(required_module="WORKSPACES", required_action=required_action)()
        if not perm_checker.has_permission(request, self):
            return Response({'error': f'You do not have permission to {required_action} workspaces.'}, status=status.HTTP_403_FORBIDDEN)

        workspace.status = new_status
        workspace.save(update_fields=['status'])
        
        AdminAuditLog.objects.create(
            actor=request.user,
            action=action_name,
            target_admin=None,
            details={
                'workspace_id': str(workspace.id),
                'old_status': old_status,
                'new_status': new_status,
                'reason': request.data.get('reason', '')
            }
        )
        
        return Response({
            'id': str(workspace.id),
            'status': workspace.status,
            'is_active': workspace.status == 'ACTIVE'
        })

class AdminConsoleWorkspaceMembersView(APIView):
    """
    Phase 6 Admin Console workspace members list endpoint.
    GET: Requires MASTER or MEMBERSHIPS/VIEW permission.
    """
    def get_permissions(self):
        return [(HasAdminPermission(required_module="MEMBERSHIPS", required_action="VIEW") | HasAdminPermission(required_module="WORKSPACES", required_action="VIEW"))()]

    def get(self, request, workspace_id):
        admin_profile = getattr(request.user, 'admin_profile', None)
        if not admin_profile or not admin_profile.is_active:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace=workspace).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        memberships = WorkspaceMembership.objects.filter(workspace=workspace).select_related('user', 'custom_role').order_by('-created_at')
        
        if admin_profile.admin_level != 'MASTER':
            assigned_user_ids = AdminUserAssignment.objects.filter(
                admin_profile=admin_profile,
                workspace=workspace
            ).values_list('user_id', flat=True)
            memberships = memberships.filter(user_id__in=assigned_user_ids).exclude(user__admin_profile__admin_level='MASTER')
        
        data = []
        for m in memberships:
            data.append({
                'membership_id': str(m.id),
                'user': {
                    'id': str(m.user.id),
                    'email': m.user.email,
                    'first_name': m.user.first_name,
                    'last_name': m.user.last_name,
                },
                'role': m.role,
                'custom_role': {
                    'id': str(m.custom_role.id),
                    'name': m.custom_role.name,
                    'permissions': m.custom_role.permissions
                } if m.custom_role else None,
                'status': m.status,
                'created_at': m.created_at.isoformat() if m.created_at else None,
            })
            
        return Response(data)


class AdminWorkspaceAvailablePermissionsView(APIView):
    """
    Stage 10.1 Admin Console Workspace Available Permissions endpoint.
    GET: Requires MASTER or WORKSPACES/VIEW permission.
    Returns software, features, and actions strictly entitled to the workspace via active subscription.
    """
    def get_permissions(self):
        return [HasAdminPermission(required_module="WORKSPACES", required_action="VIEW")()]

    def get(self, request, workspace_id):
        from workspaces.software_registry import get_available_software_for_workspace
        from payments.models import Subscription

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        sub = Subscription.objects.select_related('plan').filter(workspace=workspace).first()
        subscription_data = None
        if sub:
            subscription_data = {
                'id': str(sub.id),
                'status': sub.status,
                'plan_name': sub.plan.name,
                'plan_code': sub.plan.code,
                'is_active': sub.status in ['ACTIVE', 'TRIALING']
            }

        available_software = get_available_software_for_workspace(workspace)

        return Response({
            'workspace_id': str(workspace.id),
            'workspace_name': workspace.name,
            'workspace_status': workspace.status,
            'subscription': subscription_data,
            'software': available_software
        })


class AdminWorkspaceRolesListView(APIView):
    """
    Stage 10.1 Admin Console Workspace Custom Roles listing and creation.
    GET: Requires MASTER or ROLES/VIEW permission.
    POST: Requires MASTER or ROLES/CREATE permission.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [(HasAdminPermission(required_module="ROLES", required_action="CREATE") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]
        return [(HasAdminPermission(required_module="ROLES", required_action="VIEW") | HasAdminPermission(required_module="WORKSPACES", required_action="VIEW"))()]

    def get(self, request, workspace_id):
        from workspaces.models import WorkspaceRole

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        roles = WorkspaceRole.objects.filter(workspace=workspace).order_by('-created_at')
        data = []
        for r in roles:
            data.append({
                'id': str(r.id),
                'workspace_id': str(r.workspace_id),
                'name': r.name,
                'description': r.description,
                'permissions': r.permissions,
                'created_at': r.created_at.isoformat() if r.created_at else None,
                'updated_at': r.updated_at.isoformat() if r.updated_at else None,
            })

        return Response({'roles': data})

    def post(self, request, workspace_id):
        from workspaces.models import WorkspaceRole
        from workspaces.software_registry import validate_permissions_against_workspace

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name')
        description = request.data.get('description', '')
        permissions_payload = request.data.get('permissions', [])

        if not name or not name.strip():
            return Response({'error': 'Role name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        name = name.strip()

        if WorkspaceRole.objects.filter(workspace=workspace, name__iexact=name).exists():
            return Response({'error': f"A role named '{name}' already exists in this workspace."}, status=status.HTTP_400_BAD_REQUEST)

        # Server-side validation of requested permissions against workspace entitlement
        is_valid, error_msg, cleaned_perms = validate_permissions_against_workspace(workspace, permissions_payload)
        if not is_valid:
            return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            role = WorkspaceRole.objects.create(
                workspace=workspace,
                name=name,
                description=description,
                permissions=cleaned_perms
            )

            AdminAuditLog.objects.create(
                actor=request.user,
                action='CREATE_ROLE',
                target_admin=None,
                details={
                    'role_id': str(role.id),
                    'role_name': role.name,
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name,
                    'permissions': role.permissions
                }
            )

        return Response({
            'id': str(role.id),
            'workspace_id': str(role.workspace_id),
            'name': role.name,
            'description': role.description,
            'permissions': role.permissions,
            'created_at': role.created_at.isoformat() if role.created_at else None
        }, status=status.HTTP_201_CREATED)


class AdminWorkspaceRoleDetailView(APIView):
    """
    Stage 10.1 Admin Console Workspace Custom Role detail, update, and deletion.
    GET: Requires MASTER or ROLES/VIEW.
    PATCH/PUT: Requires MASTER or ROLES/UPDATE.
    DELETE: Requires MASTER or ROLES/DELETE.
    """
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [(HasAdminPermission(required_module="ROLES", required_action="DELETE") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]
        elif self.request.method in ['PATCH', 'PUT']:
            return [(HasAdminPermission(required_module="ROLES", required_action="UPDATE") | HasAdminPermission(required_module="WORKSPACES", required_action="UPDATE"))()]
        return [(HasAdminPermission(required_module="ROLES", required_action="VIEW") | HasAdminPermission(required_module="WORKSPACES", required_action="VIEW"))()]

    def get(self, request, workspace_id, role_id):
        from workspaces.models import WorkspaceRole

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            role = WorkspaceRole.objects.get(id=role_id, workspace=workspace)
        except WorkspaceRole.DoesNotExist:
            return Response({'error': 'Role not found in this workspace'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': str(role.id),
            'workspace_id': str(role.workspace_id),
            'name': role.name,
            'description': role.description,
            'permissions': role.permissions,
            'created_at': role.created_at.isoformat() if role.created_at else None,
            'updated_at': role.updated_at.isoformat() if role.updated_at else None,
        })

    def patch(self, request, workspace_id, role_id):
        from workspaces.models import WorkspaceRole
        from workspaces.software_registry import validate_permissions_against_workspace

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            role = WorkspaceRole.objects.get(id=role_id, workspace=workspace)
        except WorkspaceRole.DoesNotExist:
            return Response({'error': 'Role not found in this workspace'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []
        changes = {}

        if 'name' in request.data:
            new_name = request.data['name'].strip()
            if not new_name:
                return Response({'error': 'Role name cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
            if WorkspaceRole.objects.filter(workspace=workspace, name__iexact=new_name).exclude(id=role.id).exists():
                return Response({'error': f"A role named '{new_name}' already exists in this workspace."}, status=status.HTTP_400_BAD_REQUEST)
            if new_name != role.name:
                changes['name'] = {'old': role.name, 'new': new_name}
                role.name = new_name
                update_fields.append('name')

        if 'description' in request.data:
            new_desc = request.data['description']
            if new_desc != role.description:
                changes['description'] = {'old': role.description, 'new': new_desc}
                role.description = new_desc
                update_fields.append('description')

        if 'permissions' in request.data:
            new_perms = request.data['permissions']
            is_valid, error_msg, cleaned_perms = validate_permissions_against_workspace(workspace, new_perms)
            if not is_valid:
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

            changes['permissions'] = {'old': role.permissions, 'new': cleaned_perms}
            role.permissions = cleaned_perms
            update_fields.append('permissions')

        if not update_fields:
            return Response({'message': 'No changes applied', 'id': str(role.id)})

        with transaction.atomic():
            role.save(update_fields=update_fields)

            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_ROLE',
                target_admin=None,
                details={
                    'role_id': str(role.id),
                    'role_name': role.name,
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name,
                    'changes': changes
                }
            )

        return Response({
            'message': 'Role updated successfully',
            'id': str(role.id),
            'name': role.name,
            'description': role.description,
            'permissions': role.permissions,
            'updated_at': role.updated_at.isoformat() if role.updated_at else None
        })

    def delete(self, request, workspace_id, role_id):
        from workspaces.models import WorkspaceRole

        admin_profile = getattr(request.user, 'admin_profile', None)
        if admin_profile and admin_profile.admin_level != 'MASTER':
            if not AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).exists():
                return Response({'error': 'Workspace not found in your assigned scope'}, status=status.HTTP_404_NOT_FOUND)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            role = WorkspaceRole.objects.get(id=role_id, workspace=workspace)
        except WorkspaceRole.DoesNotExist:
            return Response({'error': 'Role not found in this workspace'}, status=status.HTTP_404_NOT_FOUND)

        role_name = role.name

        with transaction.atomic():
            role.delete()

            AdminAuditLog.objects.create(
                actor=request.user,
                action='DELETE_ROLE',
                target_admin=None,
                details={
                    'deleted_role_id': str(role_id),
                    'deleted_role_name': role_name,
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name
                }
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminManagementWorkspaceAssignmentsView(APIView):
    """
    MASTER ONLY endpoint to list, assign, and remove workspace assignments for an ADMIN.
    GET: List workspaces assigned to the admin + their max_users limit + current user count.
    POST: Assign workspace to admin with max_users limit (or update max_users limit).
    DELETE: Remove workspace assignment from admin.
    """
    permission_classes = [IsMasterAdmin]

    def get(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        assignments = AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile).select_related('workspace')
        data = []
        for a in assignments:
            current_count = AdminUserAssignment.objects.filter(
                admin_profile=admin_profile,
                workspace=a.workspace
            ).count()
            data.append({
                'id': str(a.id),
                'workspace_id': str(a.workspace.id),
                'workspace_name': a.workspace.name,
                'max_users': a.max_users,
                'assigned_users_count': current_count,
                'created_at': a.created_at.isoformat() if a.created_at else None,
                'updated_at': a.updated_at.isoformat() if a.updated_at else None,
            })
        return Response({'workspace_assignments': data})

    def post(self, request, admin_id):
        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot set workspace assignments on MASTER admin'}, status=status.HTTP_400_BAD_REQUEST)

        workspace_id = request.data.get('workspace_id')
        max_users = request.data.get('max_users', 10)

        if not workspace_id:
            return Response({'error': 'workspace_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            max_users = int(max_users)
            if max_users < 1:
                return Response({'error': 'max_users must be at least 1'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'error': 'max_users must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check: lowering max_users below current assigned-user count must be rejected
        current_assigned = AdminUserAssignment.objects.filter(
            admin_profile=admin_profile,
            workspace=workspace
        ).count()
        if max_users < current_assigned:
            return Response({
                'error': f'Cannot reduce max_users to {max_users} because {current_assigned} users are currently assigned.'
            }, status=status.HTTP_400_BAD_REQUEST)

        assignment, created = AdminWorkspaceAssignment.objects.update_or_create(
            admin_profile=admin_profile,
            workspace=workspace,
            defaults={'max_users': max_users}
        )

        AdminAuditLog.objects.create(
            actor=request.user,
            action='ASSIGN_ADMIN_WORKSPACE' if created else 'UPDATE_ADMIN_WORKSPACE_LIMIT',
            target_admin=admin_profile,
            details={
                'workspace_id': str(workspace.id),
                'workspace_name': workspace.name,
                'max_users': max_users
            }
        )

        return Response({
            'id': str(assignment.id),
            'workspace_id': str(workspace.id),
            'workspace_name': workspace.name,
            'max_users': assignment.max_users,
            'assigned_users_count': current_assigned
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, admin_id):
        workspace_id = request.data.get('workspace_id') or request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            admin_profile = AdminProfile.objects.get(id=admin_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            AdminWorkspaceAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).delete()
            # Removing ADMIN workspace access must immediately remove effective access to all users in that workspace
            AdminUserAssignment.objects.filter(admin_profile=admin_profile, workspace_id=workspace_id).delete()

            AdminAuditLog.objects.create(
                actor=request.user,
                action='REMOVE_ADMIN_WORKSPACE',
                target_admin=admin_profile,
                details={'workspace_id': str(workspace_id)}
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminConsoleUserAssignmentView(APIView):
    """
    MASTER ONLY endpoint to assign, reassign, or unassign a user to an ADMIN within a workspace.
    POST: Assign or reassign user to admin in a workspace.
    DELETE: Unassign user from admin in a workspace.
    """
    permission_classes = [IsMasterAdmin]

    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if hasattr(target_user, 'admin_profile') and target_user.admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot assign MASTER user to an admin'}, status=status.HTTP_400_BAD_REQUEST)

        admin_profile_id = request.data.get('admin_profile_id') or request.data.get('admin_id')
        workspace_id = request.data.get('workspace_id')

        if not admin_profile_id or not workspace_id:
            return Response({'error': 'admin_profile_id and workspace_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            admin_profile = AdminProfile.objects.get(id=admin_profile_id)
        except AdminProfile.DoesNotExist:
            return Response({'error': 'Admin profile not found'}, status=status.HTTP_404_NOT_FOUND)

        if admin_profile.admin_level == 'MASTER':
            return Response({'error': 'Cannot assign user to MASTER level admin profile'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

        # Ensure target admin is assigned to this workspace
        ws_assignment = AdminWorkspaceAssignment.objects.filter(
            admin_profile=admin_profile,
            workspace=workspace
        ).first()
        if not ws_assignment:
            return Response({'error': 'Selected admin is not assigned to manage this workspace'}, status=status.HTTP_400_BAD_REQUEST)

        # Check limit if user is not already assigned to this admin in this workspace
        existing = AdminUserAssignment.objects.filter(workspace=workspace, user=target_user).first()
        if not existing or existing.admin_profile_id != admin_profile.id:
            cur_count = AdminUserAssignment.objects.filter(
                admin_profile=admin_profile,
                workspace=workspace
            ).count()
            if cur_count >= ws_assignment.max_users:
                return Response({'error': f'Selected admin has reached max user limit ({ws_assignment.max_users}) for this workspace'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            assignment, created = AdminUserAssignment.objects.update_or_create(
                workspace=workspace,
                user=target_user,
                defaults={
                    'admin_profile': admin_profile,
                    'assigned_by': request.user
                }
            )

            # Ensure user has membership in workspace
            WorkspaceMembership.objects.get_or_create(
                user=target_user,
                workspace=workspace,
                defaults={'role': 'MEMBER', 'status': 'ACTIVE'}
            )

            AdminAuditLog.objects.create(
                actor=request.user,
                action='ASSIGN_USER_TO_ADMIN',
                target_admin=admin_profile,
                details={
                    'target_user_id': str(target_user.id),
                    'target_user_email': target_user.email,
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name,
                    'reassigned': not created
                }
            )

        return Response({
            'message': 'User assigned successfully',
            'assignment_id': str(assignment.id),
            'user_id': str(target_user.id),
            'admin_profile_id': str(admin_profile.id),
            'workspace_id': str(workspace.id)
        }, status=status.HTTP_200_OK)

    def delete(self, request, user_id):
        workspace_id = request.data.get('workspace_id') or request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            deleted_count, _ = AdminUserAssignment.objects.filter(
                user_id=user_id,
                workspace_id=workspace_id
            ).delete()

            if deleted_count == 0:
                return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

            AdminAuditLog.objects.create(
                actor=request.user,
                action='UNASSIGN_USER_FROM_ADMIN',
                target_admin=None,
                details={
                    'user_id': str(user_id),
                    'workspace_id': str(workspace_id)
                }
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

