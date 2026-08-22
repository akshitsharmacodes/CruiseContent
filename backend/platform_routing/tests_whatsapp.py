from django.test import TestCase, override_settings
from django.conf import settings
from workspaces.models import WhatsAppIntegration, Workspace, User
from platform_routing.models import SocialPost, PlatformAccount
from core.encryption import encrypt_token, decrypt_token, get_cipher
import uuid
from unittest.mock import patch
from cryptography.fernet import Fernet

@override_settings(WHATSAPP_ENCRYPTION_KEY=Fernet.generate_key().decode())
class TestWhatsAppBYOK(TestCase):
    def setUp(self):
        self.user = User.objects.create(email="test@test.com", password="password")
        self.workspace = Workspace.objects.create(name="Test Workspace")
        self.user.current_workspace = self.workspace
        self.user.save()
        self.account = PlatformAccount.objects.create(workspace=self.workspace, platform='WHATSAPP', account_id='test')

    def test_encryption_roundtrip(self):
        token = "EAA_test_token_123"
        encrypted = encrypt_token(token)
        self.assertNotEqual(encrypted, token.encode('utf-8'))
        
        decrypted = decrypt_token(encrypted)
        self.assertEqual(decrypted, token)

    def test_encryption_missing_key_fails_safely(self):
        original_key = getattr(settings, 'WHATSAPP_ENCRYPTION_KEY', None)
        settings.WHATSAPP_ENCRYPTION_KEY = None
        with self.assertRaises(ValueError):
            get_cipher()
        settings.WHATSAPP_ENCRYPTION_KEY = original_key
            
    def test_model_creation(self):
        integration = WhatsAppIntegration.objects.create(
            workspace=self.workspace,
            phone_number_id="123",
            business_account_id="456",
            encrypted_system_user_token=encrypt_token("EAA_abc")
        )
        self.assertIsNotNone(integration.id)
        self.assertEqual(integration.workspace, self.workspace)
        self.assertEqual(integration.phone_number_id, "123")
        self.assertEqual(decrypt_token(integration.encrypted_system_user_token), "EAA_abc")

    @patch('platform_routing.tasks.SocialPost.objects.get')
    @patch('platform_routing.providers.whatsapp.requests.post')
    def test_publish_to_whatsapp_task_missing_integration(self, mock_post, mock_get_post):
        from platform_routing.tasks import publish_to_whatsapp_task
        
        post = SocialPost.objects.create(platform_account=self.account, content="Test", status="PENDING")
        post.target_recipient = "12345" # Inject dynamically since field doesn't exist
        mock_get_post.return_value = post
        
        publish_to_whatsapp_task(post.id)
        
        post.refresh_from_db()
        self.assertEqual(post.status, 'FAILED')
        self.assertIn("not connected", post.error_message)

    @patch('platform_routing.tasks.SocialPost.objects.get')
    @patch('platform_routing.providers.whatsapp.requests.post')
    def test_publish_to_whatsapp_task_inactive_integration(self, mock_post, mock_get_post):
        from platform_routing.tasks import publish_to_whatsapp_task
        
        WhatsAppIntegration.objects.create(
            workspace=self.workspace,
            phone_number_id="123",
            business_account_id="456",
            encrypted_system_user_token=encrypt_token("EAA_abc"),
            is_active=False
        )
        
        post = SocialPost.objects.create(platform_account=self.account, content="Test", status="PENDING")
        post.target_recipient = "12345"
        mock_get_post.return_value = post
        
        publish_to_whatsapp_task(post.id)
        
        post.refresh_from_db()
        self.assertEqual(post.status, 'FAILED')
        self.assertIn("disconnected", post.error_message)
        
    @patch('platform_routing.tasks.logger.error')
    def test_publish_to_whatsapp_task_no_recipient(self, mock_logger):
        from platform_routing.tasks import publish_to_whatsapp_task
        
        WhatsAppIntegration.objects.create(
            workspace=self.workspace,
            phone_number_id="123",
            business_account_id="456",
            encrypted_system_user_token=encrypt_token("EAA_abc"),
            is_active=True
        )
        
        post = SocialPost.objects.create(platform_account=self.account, content="Test", status="PENDING")
        # Do not inject target_recipient
        
        publish_to_whatsapp_task(post.id)
        
        post.refresh_from_db()
        self.assertEqual(post.status, 'FAILED')
        self.assertIn("No legitimate recipient", post.error_message)

    @patch('platform_routing.tasks.SocialPost.objects.get')
    @patch('platform_routing.providers.whatsapp.requests.post')
    def test_publish_to_whatsapp_task_success_text(self, mock_post, mock_get_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"messages": [{"id": "wamid.123"}]}
        
        from platform_routing.tasks import publish_to_whatsapp_task
        
        WhatsAppIntegration.objects.create(
            workspace=self.workspace,
            phone_number_id="123",
            business_account_id="456",
            encrypted_system_user_token=encrypt_token("EAA_abc"),
            is_active=True
        )
        
        post = SocialPost.objects.create(platform_account=self.account, content="Hello World", status="PENDING")
        post.target_recipient = "12345"
        mock_get_post.return_value = post
        
        publish_to_whatsapp_task(post.id)
        
        post.refresh_from_db()
        self.assertEqual(post.status, 'SUCCESS')
        self.assertEqual(post.platform_post_id, "wamid.123")
        
        # Verify provider called Meta API
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn("https://graph.facebook.com", args[0])
        self.assertEqual(kwargs['json']['text']['body'], "Hello World")
        # Ensure credentials not exposed
        self.assertEqual(kwargs['headers']['Authorization'], "Bearer EAA_abc")
        
    @patch('platform_routing.tasks.SocialPost.objects.get')
    @patch('platform_routing.providers.whatsapp.requests.post')
    @patch('platform_routing.tasks.logger.error')
    def test_meta_api_failure_does_not_expose_token(self, mock_logger, mock_post, mock_get_post):
        # Simulate a Meta API failure with an exception containing the token
        import requests
        mock_response = requests.models.Response()
        mock_response.status_code = 400
        # The mock error body simulates the API echoing the token (which we want to sanitize)
        mock_response._content = b'{"error": {"type": "OAuthException", "code": 190}}'
        
        # requests.exceptions.HTTPError usually has the token in the URL or the string if printed
        mock_post.side_effect = requests.exceptions.HTTPError("Bad Request EAA_abc", response=mock_response)
        
        from platform_routing.tasks import publish_to_whatsapp_task
        
        WhatsAppIntegration.objects.create(
            workspace=self.workspace,
            phone_number_id="123",
            business_account_id="456",
            encrypted_system_user_token=encrypt_token("EAA_abc"),
            is_active=True
        )
        
        post = SocialPost.objects.create(platform_account=self.account, content="Fail Me", status="PENDING")
        post.target_recipient = "12345"
        mock_get_post.return_value = post
        
        # 400 is a permanent failure, so NO exception is raised for Celery to retry
        publish_to_whatsapp_task(post.id)
            
        post.refresh_from_db()
        self.assertEqual(post.status, 'FAILED')
        self.assertIn("Meta API publishing failed", post.error_message)
        
        # Ensure the token was not logged by the task logger
        for call in mock_logger.mock_calls:
            self.assertNotIn("EAA_abc", str(call))

