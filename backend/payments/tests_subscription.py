from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.utils import timezone
from workspaces.models import Workspace, WorkspaceMembership
from payments.models import Plan, PlanEntitlement, SystemSetting, Subscription, UsageRecord
from payments.services import EntitlementService
from datetime import timedelta

User = get_user_model()

class SubscriptionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='test@test.com', password='password123')
        self.workspace = Workspace.objects.create(name='Test Workspace')
        self.membership = WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='OWNER', status='ACTIVE')
        
        self.plan = Plan.objects.create(name='Free Trial', code='FREE_TRIAL', price=0, billing_interval='MONTHLY')
        self.entitlement = PlanEntitlement.objects.create(plan=self.plan, feature_code='FEATURE_X', enabled=True, limit_value=10, limit_period='MONTHLY')
        
    def test_trial_creation_fails_without_setting(self):
        sub = EntitlementService.get_active_subscription(self.workspace)
        self.assertIsNone(sub)

    def test_trial_creation_succeeds_with_setting(self):
        SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='14')
        sub = EntitlementService.get_active_subscription(self.workspace)
        self.assertIsNotNone(sub)
        self.assertEqual(sub.status, 'TRIALING')
        self.assertEqual(sub.plan.code, 'FREE_TRIAL')
        self.assertIsNotNone(sub.trial_end)

    def test_usage_atomic_increment(self):
        SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='14')
        # Create subscription
        EntitlementService.get_active_subscription(self.workspace)
        
        # Record usage
        success = EntitlementService.record_usage(self.workspace, 'FEATURE_X', 5)
        self.assertTrue(success)
        self.assertEqual(EntitlementService.get_usage(self.workspace, 'FEATURE_X'), 5)
        
        # Exceed limit
        success = EntitlementService.record_usage(self.workspace, 'FEATURE_X', 6)
        self.assertFalse(success)
        self.assertEqual(EntitlementService.get_usage(self.workspace, 'FEATURE_X'), 5)

    def test_api_access(self):
        SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='14')
        self.client.force_authenticate(user=self.user)
        self.user.current_workspace = self.workspace
        self.user.save()
        
        res = self.client.get(f'/api/payments/workspaces/{self.workspace.id}/subscription/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'TRIALING')

    def test_api_access_unauthorized_workspace(self):
        SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='14')
        other_workspace = Workspace.objects.create(name='Other')
        # user has no membership to other_workspace
        self.client.force_authenticate(user=self.user)
        
        res = self.client.get(f'/api/payments/workspaces/{other_workspace.id}/subscription/')
        # DRF HasWorkspaceRole should return False -> 403. However we catch DoesNotExist and return False, then API returns 403.
        self.assertEqual(res.status_code, 403)
