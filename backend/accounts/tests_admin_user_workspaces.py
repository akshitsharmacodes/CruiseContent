from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership
from .models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment, AdminUserAssignment

User = get_user_model()


class AdminConsoleUserWorkspacesTests(TestCase):
    """
    Security tests for user workspace membership management endpoints.
    """

    def setUp(self):
        self.client = APIClient()

        # MASTER user
        self.master_user = User.objects.create_user(
            username='master_ws@test.com',
            email='master_ws@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user, admin_level='MASTER'
        )

        # ADMIN with WORKSPACES:UPDATE (for POST/PATCH/DELETE)
        self.admin_with_update = User.objects.create_user(
            username='admin_ws_update@test.com',
            email='admin_ws_update@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_with_update)
        self.admin_update_profile = AdminProfile.objects.create(
            user=self.admin_with_update, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_update_profile,
            module='WORKSPACES',
            actions=['VIEW', 'UPDATE'],
            is_active=True
        )

        # ADMIN with WORKSPACES:VIEW only
        self.admin_with_view = User.objects.create_user(
            username='admin_ws_view@test.com',
            email='admin_ws_view@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_with_view)
        self.admin_view_profile = AdminProfile.objects.create(
            user=self.admin_with_view, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_view_profile,
            module='WORKSPACES',
            actions=['VIEW'],
            is_active=True
        )

        # Normal user
        self.target_user = User.objects.create_user(
            username='target_ws@test.com',
            email='target_ws@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.target_user)

        self.workspace = Workspace.objects.create(name='Test Workspace')
        self.other_workspace = Workspace.objects.create(name='Other Workspace')

        # Assign workspaces to test admins
        for prof in [self.admin_update_profile, self.admin_view_profile]:
            AdminWorkspaceAssignment.objects.create(admin_profile=prof, workspace=self.workspace, max_users=10)
            AdminWorkspaceAssignment.objects.create(admin_profile=prof, workspace=self.other_workspace, max_users=10)

        AdminUserAssignment.objects.create(admin_profile=self.admin_update_profile, workspace=self.workspace, user=self.target_user, assigned_by=self.master_user)

        self.membership = WorkspaceMembership.objects.create(
            user=self.target_user,
            workspace=self.workspace,
            role='MEMBER',
            status='ACTIVE'
        )

    # --- GET /admin/users/<uuid>/workspaces/ ---

    def test_master_can_get_memberships(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get(f'/api/auth/admin/users/{self.target_user.id}/workspaces/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(str(res.data[0]['workspace_id']), str(self.workspace.id))

    def test_admin_with_view_can_get_memberships(self):
        AdminUserAssignment.objects.filter(workspace=self.workspace, user=self.target_user).update(admin_profile=self.admin_view_profile)
        self.client.force_authenticate(user=self.admin_with_view)
        res = self.client.get(f'/api/auth/admin/users/{self.target_user.id}/workspaces/')
        self.assertEqual(res.status_code, 200)
        
    def test_normal_user_receives_403_on_get(self):
        self.client.force_authenticate(user=self.target_user)
        res = self.client.get(f'/api/auth/admin/users/{self.target_user.id}/workspaces/')
        self.assertEqual(res.status_code, 403)

    # --- POST /admin/users/<uuid>/workspaces/ ---

    def test_master_can_add_membership(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.other_workspace.id), 'role': 'ADMIN'},
            format='json'
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(WorkspaceMembership.objects.filter(user=self.target_user, workspace=self.other_workspace, role='ADMIN').exists())

    def test_admin_with_update_can_add_membership(self):
        self.client.force_authenticate(user=self.admin_with_update)
        res = self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.other_workspace.id), 'role': 'MEMBER'},
            format='json'
        )
        self.assertEqual(res.status_code, 201)

    def test_admin_without_update_receives_403_on_add(self):
        self.client.force_authenticate(user=self.admin_with_view)
        res = self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.other_workspace.id), 'role': 'MEMBER'},
            format='json'
        )
        self.assertEqual(res.status_code, 403)

    def test_duplicate_membership_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.workspace.id), 'role': 'MEMBER'},
            format='json'
        )
        self.assertEqual(res.status_code, 400)
        
    def test_invalid_role_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.other_workspace.id), 'role': 'SUPERUSER'},
            format='json'
        )
        self.assertEqual(res.status_code, 400)

    # --- PATCH /admin/users/<uuid>/workspaces/<uuid>/ ---

    def test_master_can_change_role(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.workspace.id}/',
            {'role': 'VIEWER'},
            format='json'
        )
        self.assertEqual(res.status_code, 200)
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.role, 'VIEWER')

    def test_prevent_demoting_last_owner(self):
        WorkspaceMembership.objects.filter(id=self.membership.id).update(role='OWNER')
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.workspace.id}/',
            {'role': 'ADMIN'},
            format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('Cannot demote the last owner', res.data['error'])

    # --- DELETE /admin/users/<uuid>/workspaces/<uuid>/ ---

    def test_master_can_remove_membership(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.workspace.id}/'
        )
        self.assertEqual(res.status_code, 204)
        self.assertFalse(WorkspaceMembership.objects.filter(user=self.target_user, workspace=self.workspace).exists())

    def test_prevent_removing_last_owner(self):
        WorkspaceMembership.objects.filter(id=self.membership.id).update(role='OWNER')
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.workspace.id}/'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('Cannot remove the last owner', res.data['error'])

    # --- Audit log tests ---

    def test_audit_logs_created(self):
        self.client.force_authenticate(user=self.master_user)
        
        # Add
        self.client.post(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/',
            {'workspace_id': str(self.other_workspace.id), 'role': 'MEMBER'},
            format='json'
        )
        self.assertTrue(AdminAuditLog.objects.filter(action='ADD_WORKSPACE_MEMBER').exists())
        
        # Update
        self.client.patch(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.other_workspace.id}/',
            {'role': 'VIEWER'},
            format='json'
        )
        self.assertTrue(AdminAuditLog.objects.filter(action='UPDATE_WORKSPACE_MEMBER').exists())
        
        # Remove
        self.client.delete(
            f'/api/auth/admin/users/{self.target_user.id}/workspaces/{self.other_workspace.id}/'
        )
        self.assertTrue(AdminAuditLog.objects.filter(action='REMOVE_WORKSPACE_MEMBER').exists())
