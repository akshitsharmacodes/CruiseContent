from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import AdminProfile, ClientProfile, AdminAuditLog

User = get_user_model()

class AdminLifecycleTests(TestCase):
    """
    Security tests for MASTER admin lifecycle operations (activate, disable, reset password, delete).
    """

    def setUp(self):
        self.client = APIClient()

        # MASTER user
        self.master_user = User.objects.create_user(
            username='master_lifecycle@test.com',
            email='master_lifecycle@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user, admin_level='MASTER'
        )

        # Another MASTER user (to test protections against modifying other masters)
        self.master_user2 = User.objects.create_user(
            username='master_lifecycle2@test.com',
            email='master_lifecycle2@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user2)
        self.master_profile2 = AdminProfile.objects.create(
            user=self.master_user2, admin_level='MASTER'
        )

        # ADMIN user to be modified
        self.admin_user = User.objects.create_user(
            username='admin_target@test.com',
            email='admin_target@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(
            user=self.admin_user, admin_level='ADMIN', is_active=True
        )

        # Normal user
        self.normal_user = User.objects.create_user(
            username='normal_target@test.com',
            email='normal_target@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.normal_user)


    # --- PATCH Status (Activate / Disable) ---

    def test_master_can_disable_admin(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/', {
            'is_active': False,
            'disabled_reason': 'Suspicious activity'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['is_active'], False)
        self.assertEqual(res.data['disabled_reason'], 'Suspicious activity')
        self.assertIsNotNone(res.data['disabled_at'])
        
        self.admin_profile.refresh_from_db()
        self.assertFalse(self.admin_profile.is_active)
        
        self.assertTrue(AdminAuditLog.objects.filter(action='DISABLE_ADMIN').exists())

    def test_master_can_activate_admin(self):
        self.admin_profile.is_active = False
        self.admin_profile.disabled_at = timezone.now()
        self.admin_profile.disabled_reason = 'Old reason'
        self.admin_profile.save()
        
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/admins/{self.admin_profile.id}/', {
            'is_active': True
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['is_active'], True)
        self.assertIsNone(res.data['disabled_at'])
        self.assertEqual(res.data['disabled_reason'], '')
        
        self.assertTrue(AdminAuditLog.objects.filter(action='ACTIVATE_ADMIN').exists())

    def test_master_cannot_disable_master(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.patch(f'/api/auth/admin/admins/{self.master_profile2.id}/', {
            'is_active': False
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Cannot disable or modify', res.data['error'])

    def test_admin_cannot_disable_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/auth/admin/admins/{self.master_profile.id}/', {
            'is_active': False
        }, format='json')
        self.assertEqual(res.status_code, 403)


    # --- POST Reset Password ---

    def test_master_can_reset_admin_password(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(f'/api/auth/admin/admins/{self.admin_profile.id}/reset-password/', {
            'password': 'newSecurePassword99!'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('newSecurePassword99!'))
        self.assertNotIn('password', res.data)
        
        self.assertTrue(AdminAuditLog.objects.filter(action='RESET_ADMIN_PASSWORD').exists())

    def test_master_cannot_reset_master_password(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(f'/api/auth/admin/admins/{self.master_profile2.id}/reset-password/', {
            'password': 'newSecurePassword99!'
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_admin_cannot_reset_password(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post(f'/api/auth/admin/admins/{self.master_profile.id}/reset-password/', {
            'password': 'newSecurePassword99!'
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_short_password_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(f'/api/auth/admin/admins/{self.admin_profile.id}/reset-password/', {
            'password': 'short'
        }, format='json')
        self.assertEqual(res.status_code, 400)


    # --- DELETE Admin ---

    def test_master_can_delete_admin(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(f'/api/auth/admin/admins/{self.admin_profile.id}/')
        self.assertEqual(res.status_code, 204)
        
        self.assertFalse(AdminProfile.objects.filter(id=self.admin_profile.id).exists())
        self.assertTrue(User.objects.filter(id=self.admin_user.id).exists()) # Normal user remains
        
        self.assertTrue(AdminAuditLog.objects.filter(action='DELETE_ADMIN').exists())

    def test_master_cannot_delete_master(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(f'/api/auth/admin/admins/{self.master_profile2.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(AdminProfile.objects.filter(id=self.master_profile2.id).exists())

    def test_admin_cannot_delete_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.delete(f'/api/auth/admin/admins/{self.master_profile.id}/')
        self.assertEqual(res.status_code, 403)
