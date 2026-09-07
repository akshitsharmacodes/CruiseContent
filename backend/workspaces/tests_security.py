from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from workspaces.models import User, Workspace, WorkspaceMembership, PlatformAccount
from ingestion.models import GenerationTask, ContentSource
from platform_routing.models import SocialPost

class SecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # User 1 & Workspace 1 (OWNER)
        self.user1 = User.objects.create_user(username="u1", email="u1@test.com")
        self.workspace1 = Workspace.objects.create(name="W1")
        self.mem1 = WorkspaceMembership.objects.create(user=self.user1, workspace=self.workspace1, role='OWNER', status='ACTIVE')
        self.user1.current_workspace = self.workspace1
        self.user1.save()
        
        # User 2 & Workspace 2 (OWNER)
        self.user2 = User.objects.create_user(username="u2", email="u2@test.com")
        self.workspace2 = Workspace.objects.create(name="W2")
        self.mem2 = WorkspaceMembership.objects.create(user=self.user2, workspace=self.workspace2, role='OWNER', status='ACTIVE')
        self.user2.current_workspace = self.workspace2
        self.user2.save()
        
        # Cross-workspace data
        self.source2 = ContentSource.objects.create(workspace=self.workspace2, source_type='MANUAL')
        self.task2 = GenerationTask.objects.create(workspace=self.workspace2, input_type='text')
        self.task_null = GenerationTask.objects.create(workspace=None, input_type='text')
        self.platform_account2 = PlatformAccount.objects.create(workspace=self.workspace2, platform='FACEBOOK_PAGE')
        self.post2 = SocialPost.objects.create(platform_account=self.platform_account2, content='test', status='SCHEDULED')

    def test_cross_workspace_content_source(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/ingestion/sources/{self.source2.id}/')
        self.assertEqual(res.status_code, 404)

    def test_cross_workspace_social_post(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/platform/publish/status/{self.post2.id}/')
        self.assertEqual(res.status_code, 404)

    def test_cross_workspace_platform_account(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.delete('/api/platform/disconnect/facebook/')
        self.assertEqual(res.status_code, 404)

    def test_cross_workspace_generation_task(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/generate/{self.task2.id}/')
        self.assertEqual(res.status_code, 404)

    def test_suspended_membership(self):
        self.mem1.status = 'SUSPENDED'
        self.mem1.save()
        self.client.force_authenticate(user=self.user1)
        res = self.client.post('/api/generate/', {'input_type': 'text'})
        if res.status_code != 403: print('SUSPENDED ERR:', res.status_code, getattr(res, 'data', None))
        self.assertEqual(res.status_code, 403)

    def test_removed_membership(self):
        self.mem1.status = 'REMOVED'
        self.mem1.save()
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/platform/connected/')
        self.assertEqual(res.status_code, 403)

    def test_viewer_attempting_write(self):
        self.mem1.role = 'VIEWER'
        self.mem1.save()
        self.client.force_authenticate(user=self.user1)
        res = self.client.post('/api/platform/publish/', {'content': 'a'})
        self.assertEqual(res.status_code, 403)

    def test_member_attempting_integration(self):
        self.mem1.role = 'MEMBER'
        self.mem1.save()
        self.client.force_authenticate(user=self.user1)
        res = self.client.post('/api/platform/facebook/connect-manual/', {'page_id': '1', 'access_token': '1'})
        if res.status_code != 403: print('MEMBER INTEGRATION ERR:', res.status_code, getattr(res, 'data', None))
        self.assertEqual(res.status_code, 403)

    from unittest.mock import patch
    @patch('platform_routing.views.requests.get')
    def test_oauth_callback_no_workspace(self, mock_get):
        mock_get.side_effect = [
            type('Response', (), {'json': lambda *args, **kwargs: {'access_token': 'mock_token'}})(),
            type('Response', (), {'json': lambda *args, **kwargs: {'data': {'scopes': ['business_management']}}})(),
            type('Response', (), {'json': lambda *args, **kwargs: {'data': [{'id': 'page1', 'access_token': 't', 'name': 'P'}]}})()
        ]
        user3 = User.objects.create_user(username="u3")
        self.client.force_authenticate(user=user3)
        res = self.client.get(f'/api/platform/facebook/callback/?code=123&state={user3.id}')
        self.assertEqual(res.status_code, 302)
        self.assertIn('error=no_workspace', res.url)

    @patch('ingestion.views.start_generation_chain.delay')
    def test_new_generation_task_receives_workspace(self, mock_delay):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post('/api/generate/', {'input_type': 'text'})
        if res.status_code != 200: print('GENERATE 500 ERR:', res.status_code, getattr(res, 'data', None))
        self.assertEqual(res.status_code, 200)
        task_id = res.data['task_id']
        task = GenerationTask.objects.get(id=task_id)
        self.assertEqual(task.workspace, self.workspace1)

    def test_legacy_null_task_not_exposed(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(f'/api/generate/{self.task_null.id}/')
        self.assertEqual(res.status_code, 404)
