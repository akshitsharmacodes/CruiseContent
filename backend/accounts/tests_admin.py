import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership
from .models import AdminProfile, ClientProfile
from unittest.mock import patch

User = get_user_model()

class AdminConsoleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Normal User
        self.normal_user = User.objects.create_user(username='normal@test.com', email='normal@test.com', password='password123')
        ClientProfile.objects.create(user=self.normal_user)
        
        # Workspace Owner
        self.owner_user = User.objects.create_user(username='owner@test.com', email='owner@test.com', password='password123')
        ClientProfile.objects.create(user=self.owner_user)
        self.workspace = Workspace.objects.create(name='Test WS')
        WorkspaceMembership.objects.create(user=self.owner_user, workspace=self.workspace, role='OWNER', status='ACTIVE')
        
        # Workspace Admin
        self.ws_admin = User.objects.create_user(username='wsadmin@test.com', email='wsadmin@test.com', password='password123')
        ClientProfile.objects.create(user=self.ws_admin)
        WorkspaceMembership.objects.create(user=self.ws_admin, workspace=self.workspace, role='ADMIN', status='ACTIVE')

        # Admin
        self.admin_user = User.objects.create_user(username='admin@test.com', email='admin@test.com', password='password123')
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN')
        
        # Master Admin
        self.master_user = User.objects.create_user(username='master@test.com', email='master@test.com', password='password123')
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')
        
        # Inactive Admin
        self.inactive_admin = User.objects.create_user(username='inactive@test.com', email='inactive@test.com', password='password123')
        ClientProfile.objects.create(user=self.inactive_admin)
        AdminProfile.objects.create(user=self.inactive_admin, admin_level='ADMIN', is_active=False)

    def test_valid_admin_login(self):
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'admin@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('access_token', res.data)
        
    def test_invalid_admin_credentials(self):
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'admin@test.com', 'password': 'wrong'})
        self.assertEqual(res.status_code, 401)
        
    def test_inactive_admin_login(self):
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'inactive@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 403)
        
    def test_inactive_user_login(self):
        self.admin_user.is_active = False
        self.admin_user.save()
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'admin@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 401)
        
    def test_normal_user_accessing_admin_api(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/auth/admin/admins/')
        self.assertEqual(res.status_code, 403)
        
    def test_master_can_access_admin_api(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/admins/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.data) >= 3)
        
    @patch('accounts.admin_console_views.send_password_reset_email.delay')
    def test_master_can_create_admin(self, mock_delay):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/admins/', {'email': 'newadmin@test.com'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['admin_level'], 'ADMIN')
        self.assertTrue(mock_delay.called)
        
    @patch('accounts.admin_console_views.send_password_reset_email.delay')
    def test_master_cannot_create_master(self, mock_delay):
        self.client.force_authenticate(user=self.master_user)
        # Assuming the API fundamentally ignores any 'admin_level' sent in request 
        # and always creates 'ADMIN'.
        res = self.client.post('/api/auth/admin/admins/', {'email': 'newmaster@test.com', 'admin_level': 'MASTER'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['admin_level'], 'ADMIN')
        
    def test_admin_cannot_create_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post('/api/auth/admin/admins/', {'email': 'anotheradmin@test.com'})
        self.assertEqual(res.status_code, 403)
        
    def test_admin_cannot_modify_master(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/auth/admin/admins/{self.master_profile.id}/', {'is_active': False})
        self.assertEqual(res.status_code, 403)
        
    def test_master_cannot_be_deleted(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(f'/api/auth/admin/admins/{self.master_profile.id}/')
        self.assertEqual(res.status_code, 403)
        
    def test_deactivated_admin_cannot_login(self):
        self.client.force_authenticate(user=self.master_user)
        # Deactivate admin
        self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/', {'is_active': False}, format='json')
        
        # Try login
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'admin@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 403)
        
    def test_workspace_owner_is_not_admin(self):
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'owner@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 403)
        self.client.force_authenticate(user=self.owner_user)
        res2 = self.client.get('/api/auth/admin/admins/')
        self.assertEqual(res2.status_code, 403)
        
    def test_workspace_admin_is_not_admin(self):
        res = self.client.post('/api/auth/admin/auth/login/', {'email': 'wsadmin@test.com', 'password': 'password123'})
        self.assertEqual(res.status_code, 403)
        self.client.force_authenticate(user=self.ws_admin)
        res2 = self.client.get('/api/auth/admin/admins/')
        self.assertEqual(res2.status_code, 403)
