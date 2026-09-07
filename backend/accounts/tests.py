from django.test import TestCase, override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from workspaces.models import Workspace
from .models import ClientProfile
import jwt
from django.conf import settings
from unittest.mock import patch
from django.core import mail

User = get_user_model()

@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_STORE_EAGER_RESULT=False, CELERY_RESULT_BACKEND='cache+memory://')
class AuthenticationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test@example.com', email='test@example.com', password='password123')
        self.workspace = Workspace.objects.create(name='Test Workspace')
        self.user.current_workspace = self.workspace
        self.user.save()
        self.profile = ClientProfile.objects.create(user=self.user, tier='PRO', role='ADMIN')
        
    def test_standard_login(self):
        url = reverse('standard_login')
        response = self.client.post(url, {'email': 'test@example.com', 'password': 'password123'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('access_token', response.data)
        
        # Verify HttpOnly cookie for refresh token
        self.assertIn('refresh_token', response.cookies)
        self.assertTrue(response.cookies['refresh_token']['httponly'])
        
        # Verify access token payload
        access_token = response.data['access_token']
        secret = getattr(settings, 'JWT_SECRET', 'django-insecure-development-jwt-key-change-me')
        payload = jwt.decode(access_token, secret, algorithms=['HS256'])
        
        self.assertEqual(payload['user_id'], str(self.user.id))
        self.assertEqual(payload['email'], 'test@example.com')
        self.assertEqual(payload['workspace_id'], str(self.workspace.id))
        
        # Ensure tier and role are NOT in the payload
        self.assertNotIn('tier', payload)
        self.assertNotIn('role', payload)

    @patch('accounts.views.send_password_reset_email.delay')
    def test_password_reset_flow(self, mock_reset):
        # 1. Request Password Reset
        url_request = reverse('password_reset')
        response = self.client.post(url_request, {'email': 'test@example.com'})
        self.assertEqual(response.status_code, 200)
        
        # Check if the celery task was called
        mock_reset.assert_called_once()
        
        # 2. Confirm Password Reset (Simulated directly since we mocked the email task)
        # We need to manually generate a token and uidb64 to test the confirm view
        from django.contrib.auth.tokens import PasswordResetTokenGenerator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(self.user)
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        
        url_confirm = reverse('password_reset_confirm')
        response = self.client.post(url_confirm, {
            'uidb64': uidb64,
            'token': token,
            'new_password': 'newpassword456'
        })
        self.assertEqual(response.status_code, 200)
        
        # 3. Verify Login with new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpassword456'))

    @patch('accounts.views.send_welcome_email.delay')
    @patch('accounts.views.send_password_reset_email.delay')
    @patch('requests.post')
    @patch('requests.get')
    def test_google_login(self, mock_get, mock_post, mock_reset, mock_welcome):
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {'access_token': 'fake_google_token'}
        
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = {
            'email': 'new_google_user@example.com',
            'picture': 'http://example.com/pic.jpg',
            'name': 'Google User'
        }
        
        url = reverse('google_callback')
        response = self.client.post(url, {'code': 'fake_auth_code'})
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.cookies)
        
        # Verify user was created
        new_user = User.objects.get(email='new_google_user@example.com')
        self.assertIsNotNone(new_user)

    def test_invalid_credentials(self):
        url = reverse('standard_login')
        response = self.client.post(url, {'email': 'test@example.com', 'password': 'wrongpassword'})
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.data)
        
    def test_inactive_user(self):
        # Create an inactive user
        inactive_user = User.objects.create_user(username='inactive@example.com', email='inactive@example.com', password='password123', is_active=False)
        ClientProfile.objects.create(user=inactive_user)
        
        url = reverse('standard_login')
        response = self.client.post(url, {'email': 'inactive@example.com', 'password': 'password123'})
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.data)

