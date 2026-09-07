from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership
from accounts.models import AdminProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment

User = get_user_model()

class WorkspaceLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create normal user
        self.user = User.objects.create_user(username='user@example.com', email='user@example.com', password='password')
        
        # Create master admin
        self.master_user = User.objects.create_user(username='master@example.com', email='master@example.com', password='password')
        self.master_admin = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER', is_active=True)
        
        # Create regular admin
        self.admin_user = User.objects.create_user(username='admin@example.com', email='admin@example.com', password='password')
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN', is_active=True)
        
        # Create a workspace
        self.workspace = Workspace.objects.create(name='Test Workspace')
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_profile,
            workspace=self.workspace,
            max_users=10
        )
        
    def test_default_status(self):
        self.assertEqual(self.workspace.status, 'ACTIVE')
        
    def test_normal_user_access_denied(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'SUSPENDED'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_master_can_suspend(self):
        self.client.force_authenticate(user=self.master_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'SUSPENDED', 'reason': 'Violation'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.status, 'SUSPENDED')
        self.assertFalse(response.data['is_active'])
        
        # Verify audit log
        log = AdminAuditLog.objects.filter(action='SUSPEND_WORKSPACE').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.details['reason'], 'Violation')
        
    def test_master_can_activate(self):
        self.workspace.status = 'SUSPENDED'
        self.workspace.save()
        
        self.client.force_authenticate(user=self.master_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'ACTIVE'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.status, 'ACTIVE')
        
        log = AdminAuditLog.objects.filter(action='ACTIVATE_WORKSPACE').first()
        self.assertIsNotNone(log)

    def test_admin_with_suspend_permission(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='WORKSPACES',
            actions=['SUSPEND'],
            is_active=True
        )
        
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'SUSPENDED'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.status, 'SUSPENDED')

    def test_admin_without_suspend_permission(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='WORKSPACES',
            actions=['UPDATE'], # Update shouldn't grant suspend
            is_active=True
        )
        
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'SUSPENDED'})
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_invalid_status_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'DELETED_HARD'})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archived_is_terminal(self):
        self.workspace.status = 'ARCHIVED'
        self.workspace.save()
        
        self.client.force_authenticate(user=self.master_user)
        url = reverse('admin_console_workspace_status', kwargs={'workspace_id': self.workspace.id})
        response = self.client.patch(url, {'status': 'ACTIVE'})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be reactivated", str(response.data))
