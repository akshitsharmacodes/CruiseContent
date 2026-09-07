from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.utils import timezone
from workspaces.models import Workspace, WorkspaceMembership
from payments.models import Plan, PlanEntitlement, Subscription
from accounts.models import AdminProfile

User = get_user_model()

class LifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='test@test.com', password='password123')
        self.master_user = User.objects.create_user(username='master@test.com', password='password123')
        AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')
        
        self.workspace = Workspace.objects.create(name='Test Workspace')
        self.owner_membership = WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='OWNER', status='ACTIVE')
        
        self.plan_pro = Plan.objects.create(name='Pro', code='PRO', price=1000.00, billing_interval='MONTHLY', is_active=True)
        self.plan_basic = Plan.objects.create(name='Basic', code='BASIC', price=500.00, billing_interval='MONTHLY', is_active=True)
        
        self.sub = Subscription.objects.create(
            workspace=self.workspace,
            plan=self.plan_basic,
            status='ACTIVE',
            current_period_end=timezone.now() + timezone.timedelta(days=30)
        )

    def test_admin_plan_crud_master_only(self):
        # Unauthenticated
        res = self.client.post('/api/payments/admin/billing/plans/', {'name': 'X', 'code': 'X', 'price': 100, 'billing_interval': 'MONTHLY'})
        self.assertEqual(res.status_code, 401)
        
        # Normal user
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/payments/admin/billing/plans/', {'name': 'X', 'code': 'X', 'price': 100, 'billing_interval': 'MONTHLY'})
        self.assertEqual(res.status_code, 403)
        
        # MASTER
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/payments/admin/billing/plans/', {'name': 'Enterprise', 'code': 'ENT', 'price': 5000, 'billing_interval': 'YEARLY'})
        self.assertEqual(res.status_code, 201)
        
        # Verify creation
        self.assertTrue(Plan.objects.filter(code='ENT').exists())

    def test_workspace_change_plan(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/subscription/change-plan/', {
            'plan_code': 'PRO'
        })
        self.assertEqual(res.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.plan.code, 'PRO')

    def test_workspace_cancel_subscription(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/subscription/cancel/')
        self.assertEqual(res.status_code, 200)
        
        self.sub.refresh_from_db()
        self.assertTrue(self.sub.cancel_at_period_end)
        self.assertIsNotNone(self.sub.canceled_at)
        
        # Calling cancel again should gracefully handle or raise
        res2 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/subscription/cancel/')
        self.assertEqual(res2.status_code, 200) # idempotency because it's already set to True

    def test_workspace_cancel_trial_immediately(self):
        self.sub.status = 'TRIALING'
        self.sub.save()
        
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/subscription/cancel/')
        self.assertEqual(res.status_code, 200)
        
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'CANCELED')
        self.assertIsNotNone(self.sub.canceled_at)

    def test_workspace_member_cannot_modify(self):
        self.owner_membership.role = 'MEMBER'
        self.owner_membership.save()
        self.client.force_authenticate(user=self.user)
        
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/subscription/cancel/')
        self.assertEqual(res.status_code, 403)
