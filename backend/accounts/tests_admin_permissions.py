from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership
from .models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog

User = get_user_model()

class AdminPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Users
        self.master_user = User.objects.create_user(username='master2@test.com', email='master2@test.com', password='password123')
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')
        
        self.admin_user = User.objects.create_user(username='admin2@test.com', email='admin2@test.com', password='password123')
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN')
        
        self.normal_user = User.objects.create_user(username='normal2@test.com', email='normal2@test.com', password='password123')
        ClientProfile.objects.create(user=self.normal_user)

    def test_master_can_view_modules(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/permissions/modules/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('USERS', res.data['modules'])
        
    def test_master_can_view_admin_permissions(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_master_can_grant_revoke_permissions(self):
        self.client.force_authenticate(user=self.master_user)
        
        # Grant
        payload = [{"module": "USERS", "actions": ["VIEW", "CREATE"], "is_active": True}]
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/', payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(AdminPermission.objects.filter(admin_profile=self.admin_profile, module="USERS").exists())
        
        # Check audit log
        self.assertTrue(AdminAuditLog.objects.filter(action='UPDATE_PERMISSIONS').exists())
        
        # Revoke (Update actions or deactivate)
        payload = [{"module": "USERS", "actions": ["VIEW"], "is_active": False}]
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/', payload, format='json')
        self.assertEqual(res.status_code, 200)
        
        perm = AdminPermission.objects.get(admin_profile=self.admin_profile, module="USERS")
        self.assertFalse(perm.is_active)
        self.assertEqual(perm.actions, ["VIEW"])

    def test_admin_cannot_modify_permissions(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = [{"module": "USERS", "actions": ["VIEW"], "is_active": True}]
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/', payload, format='json')
        self.assertEqual(res.status_code, 403)

    def test_invalid_module_action_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = [{"module": "INVALID_MOD", "actions": ["VIEW"], "is_active": True}]
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        
        # Valid module, invalid action (should be stripped or ignored based on our logic, we filter invalid actions)
        payload2 = [{"module": "DASHBOARD", "actions": ["VIEW", "EXPLODE"], "is_active": True}]
        res2 = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/permissions/', payload2, format='json')
        self.assertEqual(res2.status_code, 200)
        
        perm = AdminPermission.objects.get(admin_profile=self.admin_profile, module="DASHBOARD")
        self.assertNotIn("EXPLODE", perm.actions)
        self.assertIn("VIEW", perm.actions)

    def test_master_can_get_admin_console_users(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(isinstance(res.data, list))

    def test_admin_with_permission_can_get_admin_console_users(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="USERS",
            actions=["VIEW"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(isinstance(res.data, list))

    def test_admin_without_permission_cannot_get_admin_console_users(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 403)

    def test_normal_user_cannot_get_admin_console_users(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_cannot_get_admin_console_users(self):
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 401)

    def test_master_can_get_admin_console_workspaces(self):
        # Create a workspace to ensure the query works
        workspace = Workspace.objects.create(name="Test Master WS")
        WorkspaceMembership.objects.create(user=self.master_user, workspace=workspace, role="OWNER")
        
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(isinstance(res.data, list))
        self.assertTrue(len(res.data) > 0)
        
        # Verify safe fields
        workspace_data = res.data[0]
        self.assertIn("id", workspace_data)
        self.assertIn("name", workspace_data)
        self.assertIn("owner", workspace_data)
        self.assertIn("member_count", workspace_data)
        self.assertIn("is_active", workspace_data)
        self.assertIn("created_at", workspace_data)
        self.assertEqual(workspace_data["member_count"], 1)

    def test_admin_with_permission_can_get_admin_console_workspaces(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="WORKSPACES",
            actions=["VIEW"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(isinstance(res.data, list))

    def test_admin_without_permission_cannot_get_admin_console_workspaces(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, 403)

    def test_normal_user_cannot_get_admin_console_workspaces(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_cannot_get_admin_console_workspaces(self):
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, 401)
