from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment, AdminUserAssignment
from workspaces.models import Workspace, WorkspaceMembership

User = get_user_model()


class AdminConsoleUpdateUserTests(TestCase):
    """
    Security tests for PATCH /api/auth/admin/users/<uuid>/ (normal user update).
    """

    def setUp(self):
        self.client = APIClient()

        self.workspace = Workspace.objects.create(name="Update Test Workspace")

        # MASTER user
        self.master_user = User.objects.create_user(
            username='master_update@test.com',
            email='master_update@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user, admin_level='MASTER'
        )

        # ADMIN with USERS:UPDATE
        self.admin_with_update = User.objects.create_user(
            username='admin_update@test.com',
            email='admin_update@test.com',
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
            username='admin_noupdate@test.com',
            email='admin_noupdate@test.com',
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
            username='target@test.com',
            email='target@test.com',
            first_name='OldFirst',
            last_name='OldLast',
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
            'email': 'new_target@test.com',
            'first_name': 'NewFirst',
            'last_name': 'NewLast'
        }

    # --- Authorization tests ---

    def test_master_can_update_normal_user(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', self._patch_payload(), format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['email'], 'new_target@test.com')
        self.assertEqual(res.data['first_name'], 'NewFirst')
        self.assertEqual(res.data['last_name'], 'NewLast')
        
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.email, 'new_target@test.com')
        self.assertEqual(self.target_user.username, 'new_target@test.com')

    def test_admin_with_users_update_can_update_normal_user(self):
        self.client.force_authenticate(user=self.admin_with_update)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', {'first_name': 'AdminFirst'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['first_name'], 'AdminFirst')

    def test_admin_without_users_update_receives_403(self):
        self.client.force_authenticate(user=self.admin_no_update)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', {'first_name': 'DeniedFirst'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.target_user.refresh_from_db()
        self.assertEqual(self.target_user.first_name, 'OldFirst')

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.target_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', {'first_name': 'DeniedFirst'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_receives_401(self):
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', {'first_name': 'DeniedFirst'}, format='json')
        self.assertEqual(res.status_code, 401)

    # --- Validation tests ---

    def test_duplicate_email_rejected(self):
        existing_user = User.objects.create_user(
            username='existing@test.com',
            email='existing@test.com',
            password='password123'
        )
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', {'email': 'existing@test.com'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already exists', res.data['error'])

    # --- Security tests ---

    def test_forbidden_field_admin_level_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = self._patch_payload()
        payload['admin_level'] = 'MASTER'
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['error'])

    def test_forbidden_field_is_staff_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'is_staff': True}
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_forbidden_field_is_superuser_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'is_superuser': True}
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        
    def test_forbidden_field_status_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'status': 'SUSPENDED'}
        res = self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    # --- Audit log tests ---

    def test_audit_log_is_created(self):
        self.client.force_authenticate(user=self.master_user)
        initial = AdminAuditLog.objects.filter(action='UPDATE_USER').count()
        self.client.patch(f'/api/auth/admin/users/{self.target_user.id}/', self._patch_payload(), format='json')
        self.assertEqual(AdminAuditLog.objects.filter(action='UPDATE_USER').count(), initial + 1)
        log = AdminAuditLog.objects.filter(action='UPDATE_USER').latest('created_at')
        self.assertEqual(log.actor, self.master_user)
        self.assertEqual(log.details['updated_user_id'], str(self.target_user.id))
        self.assertIn('email', log.details['updated_fields'])
