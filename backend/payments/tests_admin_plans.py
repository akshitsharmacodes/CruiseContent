from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog
from payments.models import Plan, PlanEntitlement, Subscription
from workspaces.models import Workspace

User = get_user_model()

class AdminPlanRBACTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # MASTER admin
        self.master_user = User.objects.create_user(username='master_plan@test.com', email='master_plan@test.com', password='password123')
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER', is_active=True)

        # ADMIN user (no initial permissions)
        self.admin_user = User.objects.create_user(username='admin_plan@test.com', email='admin_plan@test.com', password='password123')
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN', is_active=True)

        # Normal User (non-admin)
        self.normal_user = User.objects.create_user(username='normal_plan@test.com', email='normal_plan@test.com', password='password123')
        ClientProfile.objects.create(user=self.normal_user)

        # Existing sample plan
        self.plan = Plan.objects.create(
            name='Starter Plan',
            code='STARTER_TEST',
            description='Test Starter Plan',
            price=499.00,
            currency='INR',
            billing_interval='MONTHLY',
            is_active=True
        )

    # -------------------------------------------------------------
    # Unauthenticated / Normal User Tests
    # -------------------------------------------------------------
    def test_unauthenticated_requests_receive_401(self):
        res = self.client.get('/api/payments/admin/billing/plans/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.post('/api/payments/admin/billing/plans/', {'name': 'X', 'code': 'X', 'price': 100, 'billing_interval': 'MONTHLY'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/payments/admin/billing/plans/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.post('/api/payments/admin/billing/plans/', {'name': 'X', 'code': 'X', 'price': 100, 'billing_interval': 'MONTHLY'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # LIST / VIEW Plans
    # -------------------------------------------------------------
    def test_master_can_list_and_view_plans(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/payments/admin/billing/plans/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('plans', res.data)
        self.assertEqual(len(res.data['plans']), 1)

        res_detail = self.client.get(f'/api/payments/admin/billing/plans/{self.plan.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['code'], 'STARTER_TEST')

    def test_admin_without_view_permission_gets_403(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/payments/admin/billing/plans/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_with_view_permission_can_list_plans(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW'],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/payments/admin/billing/plans/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['plans']), 1)

    # -------------------------------------------------------------
    # CREATE Plan
    # -------------------------------------------------------------
    def test_master_can_create_plan_and_generates_audit_log(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {
            'name': 'Pro Plan',
            'code': 'PRO_TEST',
            'description': 'Pro tier',
            'price': 1499.00,
            'currency': 'INR',
            'billing_interval': 'MONTHLY',
            'is_active': True
        }
        res = self.client.post('/api/payments/admin/billing/plans/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Plan.objects.filter(code='PRO_TEST').exists())

        audit = AdminAuditLog.objects.filter(action='CREATE_PLAN').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details['plan_code'], 'PRO_TEST')

    def test_admin_without_create_permission_gets_403(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW'], # Only VIEW, no CREATE
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            'name': 'Pro Plan',
            'code': 'PRO_FAIL',
            'price': 1499.00,
            'billing_interval': 'MONTHLY'
        }
        res = self.client.post('/api/payments/admin/billing/plans/', payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Plan.objects.filter(code='PRO_FAIL').exists())

    def test_admin_with_create_permission_can_create_plan(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW', 'CREATE'],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            'name': 'Creator Plan',
            'code': 'CREATOR_TEST',
            'price': 999.00,
            'billing_interval': 'MONTHLY'
        }
        res = self.client.post('/api/payments/admin/billing/plans/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Plan.objects.filter(code='CREATOR_TEST').exists())

    # -------------------------------------------------------------
    # UPDATE Plan
    # -------------------------------------------------------------
    def test_master_can_update_plan_and_generates_audit_log(self):
        self.client.force_authenticate(user=self.master_user)
        payload = {'name': 'Starter Plan Updated', 'price': 599.00}
        res = self.client.patch(f'/api/payments/admin/billing/plans/{self.plan.id}/', payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.name, 'Starter Plan Updated')
        self.assertEqual(float(self.plan.price), 599.00)

        audit = AdminAuditLog.objects.filter(action='UPDATE_PLAN').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details['plan_code'], 'STARTER_TEST')

    def test_admin_without_update_permission_gets_403(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW', 'CREATE'], # No UPDATE
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/payments/admin/billing/plans/{self.plan.id}/', {'name': 'Hacked'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.name, 'Starter Plan')

    def test_admin_with_update_permission_can_update_plan(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW', 'UPDATE'],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/payments/admin/billing/plans/{self.plan.id}/', {'is_active': False})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.plan.refresh_from_db()
        self.assertFalse(self.plan.is_active)

    # -------------------------------------------------------------
    # DELETE Plan
    # -------------------------------------------------------------
    def test_master_can_delete_unused_plan(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(f'/api/payments/admin/billing/plans/{self.plan.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Plan.objects.filter(id=self.plan.id).exists())

        audit = AdminAuditLog.objects.filter(action='DELETE_PLAN').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details['deleted_plan_code'], 'STARTER_TEST')

    def test_delete_blocked_if_plan_has_subscriptions(self):
        ws = Workspace.objects.create(name="Subscribed Workspace")
        Subscription.objects.create(
            workspace=ws,
            plan=self.plan,
            status='ACTIVE'
        )

        self.client.force_authenticate(user=self.master_user)
        res = self.client.delete(f'/api/payments/admin/billing/plans/{self.plan.id}/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Plan.objects.filter(id=self.plan.id).exists())
        self.assertIn("active or past subscriptions", res.data['error'])

    def test_admin_without_delete_permission_gets_403(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW', 'UPDATE'], # No DELETE
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.delete(f'/api/payments/admin/billing/plans/{self.plan.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Plan.objects.filter(id=self.plan.id).exists())

    def test_admin_with_delete_permission_can_delete_plan(self):
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW', 'DELETE'],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.delete(f'/api/payments/admin/billing/plans/{self.plan.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Plan.objects.filter(id=self.plan.id).exists())

    # -------------------------------------------------------------
    # Plan Entitlements RBAC
    # -------------------------------------------------------------
    def test_entitlements_view_and_mutation_rbac(self):
        # Admin with only VIEW cannot add entitlement
        AdminPermission.objects.create(
            admin_profile=self.admin_profile,
            module='PLANS',
            actions=['VIEW'],
            is_active=True
        )
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get(f'/api/payments/admin/billing/plans/{self.plan.id}/entitlements/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        res_post = self.client.post(f'/api/payments/admin/billing/plans/{self.plan.id}/entitlements/', {
            'feature_code': 'AI_POSTS',
            'limit_value': 50,
            'limit_period': 'MONTHLY'
        })
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

        # Grant UPDATE action
        perm = AdminPermission.objects.get(admin_profile=self.admin_profile, module='PLANS')
        perm.actions = ['VIEW', 'UPDATE']
        perm.save()

        res_post2 = self.client.post(f'/api/payments/admin/billing/plans/{self.plan.id}/entitlements/', {
            'feature_code': 'AI_POSTS',
            'limit_value': 50,
            'limit_period': 'MONTHLY'
        })
        self.assertEqual(res_post2.status_code, status.HTTP_201_CREATED)
        ent_id = res_post2.data['id']

        # Edit entitlement
        res_patch = self.client.patch(f'/api/payments/admin/billing/entitlements/{ent_id}/', {'limit_value': 100})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # Delete entitlement
        res_del = self.client.delete(f'/api/payments/admin/billing/entitlements/{ent_id}/')
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PlanEntitlement.objects.filter(id=ent_id).exists())
