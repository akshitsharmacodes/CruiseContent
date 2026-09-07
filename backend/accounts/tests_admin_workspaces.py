from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership
from .models import AdminProfile, AdminPermission, AdminWorkspaceAssignment, AdminUserAssignment

User = get_user_model()

class AdminWorkspaceCRUDTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.master_user = User.objects.create_user(username='master@test.com', email='master@test.com', password='password123')
        self.master_admin = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')
        
        self.normal_admin_user = User.objects.create_user(username='admin@test.com', email='admin@test.com', password='password123')
        self.normal_admin = AdminProfile.objects.create(user=self.normal_admin_user, admin_level='ADMIN')
        
        self.plain_user = User.objects.create_user(username='plain@test.com', email='plain@test.com', password='password123')
        
        self.workspace = Workspace.objects.create(name='Test Workspace')

    def test_master_can_create_workspace(self):
        self.client.force_authenticate(user=self.master_user)
        response = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'New Master Workspace',
            'owner_id': str(self.plain_user.id)
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Workspace.objects.filter(name='New Master Workspace').exists())
        
        # Verify ownership
        workspace = Workspace.objects.get(name='New Master Workspace')
        membership = WorkspaceMembership.objects.get(workspace=workspace, user=self.plain_user)
        self.assertEqual(membership.role, 'OWNER')

    def test_admin_with_permission_can_create_workspace(self):
        AdminPermission.objects.create(admin_profile=self.normal_admin, module='WORKSPACES', actions=['CREATE'])
        self.client.force_authenticate(user=self.normal_admin_user)
        
        response = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'Admin Created Workspace',
            'owner_id': str(self.plain_user.id)
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_without_permission_cannot_create_workspace(self):
        self.client.force_authenticate(user=self.normal_admin_user)
        response = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'Admin Created Workspace',
            'owner_id': str(self.plain_user.id)
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_master_can_update_workspace(self):
        self.client.force_authenticate(user=self.master_user)
        response = self.client.patch(f'/api/auth/admin/workspaces/{self.workspace.id}/', {
            'name': 'Updated Workspace Name'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.name, 'Updated Workspace Name')

    def test_admin_with_permission_can_update_workspace(self):
        AdminPermission.objects.create(admin_profile=self.normal_admin, module='WORKSPACES', actions=['UPDATE'])
        AdminWorkspaceAssignment.objects.create(admin_profile=self.normal_admin, workspace=self.workspace, max_users=10)
        self.client.force_authenticate(user=self.normal_admin_user)
        
        response = self.client.patch(f'/api/auth/admin/workspaces/{self.workspace.id}/', {
            'name': 'Admin Updated Workspace'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_without_permission_cannot_update_workspace(self):
        self.client.force_authenticate(user=self.normal_admin_user)
        response = self.client.patch(f'/api/auth/admin/workspaces/{self.workspace.id}/', {
            'name': 'Admin Updated Workspace'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_master_can_delete_workspace(self):
        from accounts.models import AdminAuditLog
        self.plain_user.current_workspace = self.workspace
        self.plain_user.save()
        
        self.client.force_authenticate(user=self.master_user)
        response = self.client.delete(f'/api/auth/admin/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Workspace.objects.filter(id=self.workspace.id).exists())
        
        self.plain_user.refresh_from_db()
        self.assertIsNone(self.plain_user.current_workspace)
        
        log = AdminAuditLog.objects.filter(action='DELETE_WORKSPACE', details__workspace_id=str(self.workspace.id)).first()
        self.assertIsNotNone(log)

    def test_non_master_admin_cannot_delete_workspace(self):
        AdminPermission.objects.create(admin_profile=self.normal_admin, module='WORKSPACES', actions=['UPDATE', 'CREATE', 'VIEW'])
        self.client.force_authenticate(user=self.normal_admin_user)
        response = self.client.delete(f'/api/auth/admin/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Workspace.objects.filter(id=self.workspace.id).exists())

    def test_unauthenticated_cannot_delete_workspace(self):
        response = self.client.delete(f'/api/auth/admin/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Workspace.objects.filter(id=self.workspace.id).exists())

class AdminWorkspaceMembersTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.master_user = User.objects.create_user(username='master2@test.com', email='master2@test.com', password='password123')
        self.master_admin = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')
        
        self.normal_admin_user = User.objects.create_user(username='admin2@test.com', email='admin2@test.com', password='password123')
        self.normal_admin = AdminProfile.objects.create(user=self.normal_admin_user, admin_level='ADMIN')
        
        self.plain_user = User.objects.create_user(username='plain2@test.com', email='plain2@test.com', password='password123')
        self.plain_user2 = User.objects.create_user(username='plain3@test.com', email='plain3@test.com', password='password123')
        
        self.workspace = Workspace.objects.create(name='Members Test Workspace')
        self.other_workspace = Workspace.objects.create(name='Other Workspace')
        
        # Add members
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.plain_user, role='OWNER')
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.plain_user2, role='MEMBER')
        
        # Add to other workspace to test isolation
        WorkspaceMembership.objects.create(workspace=self.other_workspace, user=self.plain_user, role='MEMBER')

    def test_master_can_get_workspace_members(self):
        self.client.force_authenticate(user=self.master_user)
        response = self.client.get(f'/api/auth/admin/workspaces/{self.workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Verify safe fields
        member = response.data[0]
        self.assertIn('membership_id', member)
        self.assertIn('user', member)
        self.assertIn('role', member)
        self.assertIn('status', member)
        self.assertNotIn('password', member['user'])

    def test_admin_with_permission_can_get_workspace_members(self):
        AdminPermission.objects.create(admin_profile=self.normal_admin, module='WORKSPACES', actions=['VIEW'])
        AdminWorkspaceAssignment.objects.create(admin_profile=self.normal_admin, workspace=self.workspace, max_users=10)
        AdminUserAssignment.objects.create(admin_profile=self.normal_admin, workspace=self.workspace, user=self.plain_user, assigned_by=self.master_user)
        AdminUserAssignment.objects.create(admin_profile=self.normal_admin, workspace=self.workspace, user=self.plain_user2, assigned_by=self.master_user)
        self.client.force_authenticate(user=self.normal_admin_user)
        response = self.client.get(f'/api/auth/admin/workspaces/{self.workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_without_permission_cannot_get_workspace_members(self):
        self.client.force_authenticate(user=self.normal_admin_user)
        response = self.client.get(f'/api/auth/admin/workspaces/{self.workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_normal_user_cannot_get_workspace_members(self):
        self.client.force_authenticate(user=self.plain_user)
        response = self.client.get(f'/api/auth/admin/workspaces/{self.workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_get_workspace_members(self):
        response = self.client.get(f'/api/auth/admin/workspaces/{self.workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_workspace_members_cross_workspace_isolation(self):
        self.client.force_authenticate(user=self.master_user)
        response = self.client.get(f'/api/auth/admin/workspaces/{self.other_workspace.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['user']['email'], 'plain2@test.com')

    def test_get_nonexistent_workspace_members(self):
        self.client.force_authenticate(user=self.master_user)
        import uuid
        fake_id = uuid.uuid4()
        response = self.client.get(f'/api/auth/admin/workspaces/{fake_id}/members/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
