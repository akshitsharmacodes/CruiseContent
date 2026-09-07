from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from accounts.models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog
from payments.models import Plan, PlanEntitlement, Subscription, UsageRecord
from workspaces.models import Workspace, WorkspaceMembership

User = get_user_model()

class AdminSubscriptionRBACTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. MASTER Admin
        self.master_user = User.objects.create_user(
            username='master_sub@test.com', email='master_sub@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER', is_active=True)

        # 2. Granular ADMIN
        self.admin_user = User.objects.create_user(
            username='admin_sub@test.com', email='admin_sub@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN', is_active=True)

        # 3. Normal User
        self.normal_user = User.objects.create_user(
            username='normal_sub@test.com', email='normal_sub@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.normal_user)

        # 4. Workspaces & Memberships
        self.workspace_a = Workspace.objects.create(name='Workspace Alpha', status='ACTIVE')
        self.workspace_b = Workspace.objects.create(name='Workspace Beta', status='ACTIVE')
        WorkspaceMembership.objects.create(user=self.normal_user, workspace=self.workspace_a, role='MEMBER', status='ACTIVE')

        # 5. Plans
        self.plan_starter = Plan.objects.create(
            name='Starter Tier', code='STARTER_PLAN', price=499.00, billing_interval='MONTHLY', is_active=True
        )
        self.plan_enterprise = Plan.objects.create(
            name='Enterprise Tier', code='ENTERPRISE_PLAN', price=4999.00, billing_interval='YEARLY', is_active=True
        )

        # 6. Subscriptions
        now = timezone.now()
        self.sub_a = Subscription.objects.create(
            workspace=self.workspace_a,
            plan=self.plan_starter,
            status='ACTIVE',
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False
        )

        self.sub_b = Subscription.objects.create(
            workspace=self.workspace_b,
            plan=self.plan_enterprise,
            status='TRIALING',
            trial_start=now,
            trial_end=now + timedelta(days=14),
            current_period_start=now,
            current_period_end=now + timedelta(days=14),
            cancel_at_period_end=False
        )

        # 7. Usage Record for Workspace A
        UsageRecord.objects.create(
            workspace=self.workspace_a,
            feature_code='AI_POSTS',
            period_start=now,
            period_end=now + timedelta(days=30),
            usage_count=42
        )

    # -------------------------------------------------------------
    # Authentication & Authorization Perimeter
    # -------------------------------------------------------------
    def test_unauthenticated_requests_receive_401(self):
        res = self.client.get('/api/payments/admin/subscriptions/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.get(f'/api/payments/admin/subscriptions/{self.sub_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {'status': 'PAST_DUE'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_a.id}/cancel/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.normal_user)

        res = self.client.get('/api/payments/admin/subscriptions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.get(f'/api/payments/admin/subscriptions/{self.sub_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {'status': 'PAST_DUE'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_a.id}/cancel/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # VIEW Permissions (List & Detail)
    # -------------------------------------------------------------
    def test_master_can_list_and_detail_subscriptions(self):
        self.client.force_authenticate(user=self.master_user)

        # List
        res = self.client.get('/api/payments/admin/subscriptions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['subscriptions']), 2)

        # Detail
        res = self.client.get(f'/api/payments/admin/subscriptions/{self.sub_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['id'], str(self.sub_a.id))
        self.assertEqual(res.data['workspace']['name'], 'Workspace Alpha')
        self.assertEqual(res.data['plan']['code'], 'STARTER_PLAN')
        self.assertEqual(len(res.data['usage_records']), 1)
        self.assertEqual(res.data['usage_records'][0]['feature_code'], 'AI_POSTS')
        self.assertEqual(res.data['usage_records'][0]['usage_count'], 42)

    def test_admin_without_view_permission_gets_403(self):
        self.client.force_authenticate(user=self.admin_user)

        res = self.client.get('/api/payments/admin/subscriptions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.get(f'/api/payments/admin/subscriptions/{self.sub_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_with_view_permission_can_list_and_filter(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        # List all
        res = self.client.get('/api/payments/admin/subscriptions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['subscriptions']), 2)

        # Filter by status
        res = self.client.get('/api/payments/admin/subscriptions/?status=TRIALING')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['subscriptions']), 1)
        self.assertEqual(res.data['subscriptions'][0]['id'], str(self.sub_b.id))

        # Filter by workspace
        res = self.client.get(f'/api/payments/admin/subscriptions/?workspace={self.workspace_a.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['subscriptions']), 1)
        self.assertEqual(res.data['subscriptions'][0]['id'], str(self.sub_a.id))

        # Filter by plan
        res = self.client.get(f'/api/payments/admin/subscriptions/?plan={self.plan_enterprise.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['subscriptions']), 1)
        self.assertEqual(res.data['subscriptions'][0]['id'], str(self.sub_b.id))

    # -------------------------------------------------------------
    # UPDATE Permissions & Field Protection
    # -------------------------------------------------------------
    def test_admin_without_update_permission_gets_403(self):
        # Admin has only VIEW
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {'status': 'PAST_DUE'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_with_update_permission_can_update_status_and_dates(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW", "UPDATE"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        new_period_end = timezone.now() + timedelta(days=60)
        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {
            'status': 'PAST_DUE',
            'current_period_end': new_period_end.isoformat()
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.status, 'PAST_DUE')

        # Check Audit Log
        audit = AdminAuditLog.objects.filter(action='ADMIN_UPDATE_SUBSCRIPTION').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.admin_user)
        self.assertEqual(audit.details['subscription_id'], str(self.sub_a.id))
        self.assertEqual(audit.details['changes']['status']['old'], 'ACTIVE')
        self.assertEqual(audit.details['changes']['status']['new'], 'PAST_DUE')

    def test_workspace_reassignment_is_strictly_forbidden(self):
        self.client.force_authenticate(user=self.master_user)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {
            'workspace': str(self.workspace_b.id),
            'workspace_id': str(self.workspace_b.id)
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be modified", res.data['error'])

        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.workspace_id, self.workspace_a.id)

    # -------------------------------------------------------------
    # Plan Change via Admin Endpoint
    # -------------------------------------------------------------
    def test_admin_can_change_subscription_plan(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW", "UPDATE"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {
            'plan_code': 'ENTERPRISE_PLAN'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.plan.code, 'ENTERPRISE_PLAN')

        # Check Audit Log
        audit = AdminAuditLog.objects.filter(action='ADMIN_CHANGE_SUBSCRIPTION_PLAN').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details['changes']['plan']['old'], 'STARTER_PLAN')
        self.assertEqual(audit.details['changes']['plan']['new'], 'ENTERPRISE_PLAN')

    def test_invalid_plan_change_rejected(self):
        self.client.force_authenticate(user=self.master_user)

        res = self.client.patch(f'/api/payments/admin/subscriptions/{self.sub_a.id}/', {
            'plan_code': 'NON_EXISTENT_TIER'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------
    # CANCEL Permissions & Flows
    # -------------------------------------------------------------
    def test_admin_without_cancel_permission_gets_403(self):
        # Admin has only UPDATE
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW", "UPDATE"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        res = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_a.id}/cancel/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_with_cancel_permission_can_cancel_period_end(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module="SUBSCRIPTIONS",
            actions=["VIEW", "CANCEL"],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)

        res = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_a.id}/cancel/', {
            'immediate': False,
            'reason': 'Customer requested cancellation'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.status, 'ACTIVE')
        self.assertTrue(self.sub_a.cancel_at_period_end)
        self.assertIsNotNone(self.sub_a.canceled_at)

        # Check Audit Log
        audit = AdminAuditLog.objects.filter(action='ADMIN_CANCEL_SUBSCRIPTION').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details['subscription_id'], str(self.sub_a.id))
        self.assertEqual(audit.details['immediate'], False)
        self.assertEqual(audit.details['reason'], 'Customer requested cancellation')

    def test_immediate_cancel_trial_and_active_subscriptions(self):
        self.client.force_authenticate(user=self.master_user)

        # Immediate cancel on active sub
        res = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_a.id}/cancel/', {
            'immediate': True,
            'reason': 'Terms of Service violation'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.status, 'CANCELED')

        # Cancel on trialing sub defaults to immediate
        res_trial = self.client.post(f'/api/payments/admin/subscriptions/{self.sub_b.id}/cancel/', {
            'reason': 'Trial cleanup'
        })
        self.assertEqual(res_trial.status_code, status.HTTP_200_OK)
        self.sub_b.refresh_from_db()
        self.assertEqual(self.sub_b.status, 'CANCELED')
