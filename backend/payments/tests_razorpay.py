import uuid
import json
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.utils import timezone
from workspaces.models import Workspace, WorkspaceMembership
from payments.models import Plan, SystemSetting, Subscription, PaymentTransaction

User = get_user_model()

@override_settings(RAZORPAY_KEY_SECRET='test_secret', RAZORPAY_KEY_ID='test_key')
class RazorpayWorkspaceBillingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='test@test.com', password='password123')
        self.workspace = Workspace.objects.create(name='Test Workspace')
        
        self.owner_membership = WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='OWNER', status='ACTIVE')
        
        self.plan = Plan.objects.create(name='Pro', code='PRO', price=1000.00, billing_interval='MONTHLY', is_active=True)
        
        # Disable Razorpay real client for tests by not providing keys, it will fallback to mock logic in views

    def test_owner_can_create_checkout(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/create-order/', {
            'plan_code': 'PRO'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('order_id', res.data)
        self.assertEqual(res.data['amount'], 100000) # price * 100

        # Check PaymentTransaction was created
        tx = PaymentTransaction.objects.get(id=res.data['id'])
        self.assertEqual(tx.workspace, self.workspace)
        self.assertEqual(tx.subscription_plan, self.plan)
        self.assertEqual(tx.amount, 100000)

    def test_member_cannot_create_checkout(self):
        # Downgrade to MEMBER
        self.owner_membership.role = 'MEMBER'
        self.owner_membership.save()
        
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/create-order/', {
            'plan_code': 'PRO'
        })
        self.assertEqual(res.status_code, 403)

    def test_inactive_plan_cannot_be_purchased(self):
        self.plan.is_active = False
        self.plan.save()
        
        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/create-order/', {
            'plan_code': 'PRO'
        })
        self.assertEqual(res.status_code, 400)
        
    def test_successful_payment_activates_subscription(self):
        self.client.force_authenticate(user=self.user)
        # Create order
        res1 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/create-order/', {'plan_code': 'PRO'})
        tx_id = res1.data['id']
        
        # Verify payment
        res2 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/verify-payment/', {
            'razorpay_order_id': res1.data['order_id'],
            'razorpay_payment_id': 'pay_mock123',
            'razorpay_signature': 'sig_mock123',
            'transaction_id': tx_id
        })
        self.assertEqual(res2.status_code, 200)
        
        tx = PaymentTransaction.objects.get(id=tx_id)
        self.assertEqual(tx.status, 'SUCCESSFUL')
        
        # Check subscription activated
        sub = Subscription.objects.get(workspace=self.workspace)
        self.assertEqual(sub.status, 'ACTIVE')
        self.assertEqual(sub.plan, self.plan)
        self.assertIsNotNone(sub.current_period_end)

    def test_duplicate_verification(self):
        self.client.force_authenticate(user=self.user)
        res1 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/create-order/', {'plan_code': 'PRO'})
        tx_id = res1.data['id']
        
        res2 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/verify-payment/', {
            'razorpay_order_id': res1.data['order_id'],
            'razorpay_payment_id': 'pay_mock123',
            'razorpay_signature': 'sig_mock123',
            'transaction_id': tx_id
        })
        self.assertEqual(res2.status_code, 200)
        
        sub = Subscription.objects.get(workspace=self.workspace)
        period_end_1 = sub.current_period_end
        
        # Verify again
        res3 = self.client.post(f'/api/payments/workspaces/{self.workspace.id}/verify-payment/', {
            'razorpay_order_id': res1.data['order_id'],
            'razorpay_payment_id': 'pay_mock123',
            'razorpay_signature': 'sig_mock123',
            'transaction_id': tx_id
        })
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.data['message'], 'Already processed')
        
        sub.refresh_from_db()
        self.assertEqual(sub.current_period_end, period_end_1) # Not extended twice

    def test_legacy_checkout_unaffected(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/payments/create-order/', {
            'tier': 'CREATOR',
            'amount': 50000
        })
        self.assertEqual(res.status_code, 200)
        tx = PaymentTransaction.objects.get(id=res.data['id'])
        self.assertIsNone(tx.workspace)
        self.assertEqual(tx.target_tier, 'CREATOR')
