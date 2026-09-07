from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment, AdminUserAssignment
from workspaces.models import Workspace, WorkspaceMembership

User = get_user_model()


class AdminConsoleUserStatusTests(TestCase):
    """
    Security tests for PATCH /api/auth/admin/users/<uuid>/status/ (normal user status update).
    """

    def setUp(self):
        self.client = APIClient()

        self.workspace = Workspace.objects.create(name="Status Test Workspace")

        # MASTER user
        self.master_user = User.objects.create_user(
            username='master_status@test.com',
            email='master_status@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user, admin_level='MASTER'
        )

        # ADMIN with USERS:UPDATE
        self.admin_with_update = User.objects.create_user(
            username='admin_status_update@test.com',
            email='admin_status_update@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_with_update)
        self.admin_update_profile = AdminProfile.objects.create(
            user=self.admin_with_update, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_update_profile,
            module='USERS',
            actions=['VIEW', 'UPDATE'],
            is_active=True
        )
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_update_profile,
            workspace=self.workspace,
            max_users=10
        )

        # ADMIN without USERS:UPDATE
        self.admin_no_update = User.objects.create_user(
            username='admin_status_noupdate@test.com',
            email='admin_status_noupdate@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_no_update)
        self.admin_noupdate_profile = AdminProfile.objects.create(
            user=self.admin_no_update, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_noupdate_profile,
            module='USERS',
            actions=['VIEW'],
            is_active=True
        )
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_noupdate_profile,
            workspace=self.workspace,
            max_users=10
        )

        # Normal user
        self.target_user = User.objects.create_user(
            username='target_status@test.com',
            email='target_status@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.target_user)
        WorkspaceMembership.objects.create(user=self.target_user, workspace=self.workspace, role='MEMBER')
        AdminUserAssignment.objects.create(
            admin_profile=self.admin_update_profile,
            workspace=self.workspace,
            user=self.target_user,
            assigned_by=self.master_user
        )

    def _patch_payload(self):
        return {
            'status': 'SUSPENDED'
        }

    # --- Authorization tests ---

    def test_master_can_change_status(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', self._patch_payload(), format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'SUSPENDED')
        self.assertEqual(res.data['is_active'], False)
        
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.status, 'SUSPENDED')
        self.assertFalse(self.target_user.is_active)

    def test_admin_with_users_update_can_change_status(self):
        self.client.force_authenticate(user=self.admin_with_update)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', {'status': 'DEACTIVATED'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'DEACTIVATED')
        self.assertEqual(res.data['is_active'], False)

    def test_admin_without_users_update_receives_403(self):
        self.client.force_authenticate(user=self.admin_no_update)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', self._patch_payload(), format='json')
        self.assertEqual(res.status_code, 403)

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.target_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', self._patch_payload(), format='json')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_receives_401(self):
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', self._patch_payload(), format='json')
        self.assertEqual(res.status_code, 401)

    # --- Validation tests ---

    def test_invalid_status_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', {'status': 'UNKNOWN'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Invalid status', res.data['error'])

    # --- Security tests ---

    def test_forbidden_field_admin_level_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'status': 'SUSPENDED', 'admin_level': 'MASTER'}
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['error'])

    def test_forbidden_field_is_staff_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'status': 'SUSPENDED', 'is_staff': True}
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    # --- Audit log tests ---

    def test_audit_log_is_created_on_status_change(self):
        self.client.force_authenticate(user=self.master_user)
        initial = AdminAuditLog.objects.filter(action='CHANGE_USER_STATUS').count()
        self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/status/', self._patch_payload(), format='json')
        self.assertEqual(AdminAuditLog.objects.filter(action='CHANGE_USER_STATUS').count(), initial + 1)
        log = AdminAuditLog.objects.filter(action='CHANGE_USER_STATUS').latest('created_at')
        self.assertEqual(log.actor, self.master_user)
        self.assertEqual(log.details['updated_user_id'], str(self.target_user.id))
        self.assertEqual(log.details['old_status'], 'ACTIVE')
        self.assertEqual(log.details['new_status'], 'SUSPENDED')
