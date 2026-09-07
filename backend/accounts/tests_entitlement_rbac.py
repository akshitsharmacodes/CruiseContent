from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from accounts.models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog
from payments.models import Plan, PlanEntitlement, Subscription
from workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from workspaces.software_registry import (
    SOFTWARE_FEATURE_REGISTRY,
    get_available_software_for_workspace,
    validate_permissions_against_workspace
)

User = get_user_model()

class EntitlementAwareRBACTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Users
        self.master_user = User.objects.create_user(
            username='master_rbac@test.com', email='master_rbac@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER', is_active=True)

        self.admin_user = User.objects.create_user(
            username='admin_rbac@test.com', email='admin_rbac@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.admin_user)
        self.admin_profile = AdminProfile.objects.create(user=self.admin_user, admin_level='ADMIN', is_active=True)

        self.normal_user = User.objects.create_user(
            username='normal_rbac@test.com', email='normal_rbac@test.com', password='password123'
        )
        ClientProfile.objects.create(user=self.normal_user)

        # 2. Workspaces
        self.workspace_a = Workspace.objects.create(name='Workspace A (WhatsApp + Social)', status='ACTIVE')
        self.workspace_b = Workspace.objects.create(name='Workspace B (AI Calling Only)', status='ACTIVE')
        self.workspace_unsubscribed = Workspace.objects.create(name='Workspace C (Unsubscribed)', status='ACTIVE')

        # 3. Plans
        self.plan_starter = Plan.objects.create(
            name='Starter Plan', code='STARTER', price=999.00, billing_interval='MONTHLY', is_active=True
        )
        # Entitle Workspace A to WhatsApp Campaign and Social Media Manager
        PlanEntitlement.objects.create(plan=self.plan_starter, feature_code='WHATSAPP_CAMPAIGN', enabled=True)
        PlanEntitlement.objects.create(plan=self.plan_starter, feature_code='SOCIAL_MEDIA_MANAGER', enabled=True)

        self.plan_ai = Plan.objects.create(
            name='AI Calling Plan', code='AI_CALL', price=1999.00, billing_interval='MONTHLY', is_active=True
        )
        PlanEntitlement.objects.create(plan=self.plan_ai, feature_code='AI_CALLING', enabled=True)

        now = timezone.now()
        self.sub_a = Subscription.objects.create(
            workspace=self.workspace_a,
            plan=self.plan_starter,
            status='ACTIVE',
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )

        self.sub_b = Subscription.objects.create(
            workspace=self.workspace_b,
            plan=self.plan_ai,
            status='ACTIVE',
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )

    # -------------------------------------------------------------
    # 1. Authentication & Base Authorization Perimeter
    # -------------------------------------------------------------
    def test_unauthenticated_requests_receive_401(self):
        res = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/available-permissions/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.post(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/', {'name': 'Manager'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.normal_user)

        res = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/available-permissions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.post(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/', {'name': 'Manager'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # 2. Entitlement-Aware Permission Calculation
    # -------------------------------------------------------------
    def test_available_permissions_returns_only_entitled_software(self):
        self.client.force_authenticate(user=self.master_user)

        # Workspace A: Subscribed to WHATSAPP_CAMPAIGN and SOCIAL_MEDIA_MANAGER
        res_a = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/available-permissions/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        sw_codes_a = [sw['code'] for sw in res_a.data['software']]
        self.assertIn('WHATSAPP_CAMPAIGN', sw_codes_a)
        self.assertIn('SOCIAL_MEDIA_MANAGER', sw_codes_a)
        self.assertNotIn('AI_CALLING', sw_codes_a)
        self.assertNotIn('WHATSHOOK', sw_codes_a)
        self.assertNotIn('CHATBOT', sw_codes_a)
        self.assertNotIn('DATEXT', sw_codes_a)
        self.assertNotIn('SHARE_AND_CARE', sw_codes_a)

        # Workspace B: Subscribed to AI_CALLING only
        res_b = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_b.id}/available-permissions/')
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)

        sw_codes_b = [sw['code'] for sw in res_b.data['software']]
        self.assertEqual(sw_codes_b, ['AI_CALLING'])

        # Workspace C: No active subscription -> zero software
        res_c = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_unsubscribed.id}/available-permissions/')
        self.assertEqual(res_c.status_code, status.HTTP_200_OK)
        self.assertEqual(res_c.data['software'], [])

    def test_canceled_or_expired_subscription_returns_zero_software(self):
        self.client.force_authenticate(user=self.master_user)

        self.sub_a.status = 'CANCELED'
        self.sub_a.save()

        res = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/available-permissions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['software'], [])

    # -------------------------------------------------------------
    # 3. Dynamic Custom Role Creation with Server-Side Entitlement Check
    # -------------------------------------------------------------
    def test_create_role_with_valid_entitled_permissions_succeeds(self):
        self.client.force_authenticate(user=self.master_user)

        payload = {
            'name': 'Marketing Lead',
            'description': 'Handles WhatsApp and Social Media',
            'permissions': [
                {
                    'software': 'WHATSAPP_CAMPAIGN',
                    'feature': 'CAMPAIGNS',
                    'actions': ['VIEW', 'CREATE', 'SEND']
                },
                {
                    'software': 'SOCIAL_MEDIA_MANAGER',
                    'feature': 'POSTS',
                    'actions': ['VIEW', 'CREATE', 'PUBLISH']
                }
            ]
        }

        res = self.client.post(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Marketing Lead')

        role = WorkspaceRole.objects.get(id=res.data['id'])
        self.assertEqual(role.workspace, self.workspace_a)
        self.assertEqual(len(role.permissions), 2)

        # Verify audit log
        audit = AdminAuditLog.objects.filter(action='CREATE_ROLE').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.master_user)
        self.assertEqual(audit.details['role_name'], 'Marketing Lead')

    def test_create_role_with_unentitled_software_is_rejected(self):
        self.client.force_authenticate(user=self.master_user)

        # Attempting to assign AI_CALLING to Workspace A (which only has WhatsApp & Social)
        payload = {
            'name': 'Sales Rep',
            'permissions': [
                {
                    'software': 'AI_CALLING',
                    'feature': 'CALL_SESSIONS',
                    'actions': ['VIEW', 'EXECUTE']
                }
            ]
        }

        res = self.client.post(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not entitled", res.data['error'])

        # Verify no role created
        self.assertFalse(WorkspaceRole.objects.filter(workspace=self.workspace_a, name='Sales Rep').exists())

    def test_create_role_with_invalid_action_is_rejected(self):
        self.client.force_authenticate(user=self.master_user)

        # Action 'DROP_DATABASE' is completely invalid for CAMPAIGNS
        payload = {
            'name': 'Hacker Role',
            'permissions': [
                {
                    'software': 'WHATSAPP_CAMPAIGN',
                    'feature': 'CAMPAIGNS',
                    'actions': ['VIEW', 'DROP_DATABASE']
                }
            ]
        }

        res = self.client.post(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid for feature", res.data['error'])

    # -------------------------------------------------------------
    # 4. Multi-Tenancy & IDOR Isolation
    # -------------------------------------------------------------
    def test_multi_tenancy_role_access_and_cross_workspace_isolation(self):
        self.client.force_authenticate(user=self.master_user)

        # Create role in Workspace A
        role_a = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Content Creator',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )

        # Create role in Workspace B
        role_b = WorkspaceRole.objects.create(
            workspace=self.workspace_b,
            name='Voice Operator',
            permissions=[{'software': 'AI_CALLING', 'feature': 'CALL_SESSIONS', 'actions': ['VIEW']}]
        )

        # Query Workspace A roles -> should only return role_a
        res_list_a = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/')
        self.assertEqual(res_list_a.status_code, status.HTTP_200_OK)
        role_ids_a = [r['id'] for r in res_list_a.data['roles']]
        self.assertIn(str(role_a.id), role_ids_a)
        self.assertNotIn(str(role_b.id), role_ids_a)

        # Attempt to access Workspace B's role under Workspace A endpoint -> 404
        res_cross_get = self.client.get(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/{role_b.id}/')
        self.assertEqual(res_cross_get.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to patch Workspace B's role under Workspace A endpoint -> 404
        res_cross_patch = self.client.patch(
            f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/{role_b.id}/',
            {'name': 'Hijacked Name'},
            format='json'
        )
        self.assertEqual(res_cross_patch.status_code, status.HTTP_404_NOT_FOUND)

        # Attempt to delete Workspace B's role under Workspace A endpoint -> 404
        res_cross_delete = self.client.delete(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/{role_b.id}/')
        self.assertEqual(res_cross_delete.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(WorkspaceRole.objects.filter(id=role_b.id).exists())

    # -------------------------------------------------------------
    # 5. Role Update and Delete with Audit Logs
    # -------------------------------------------------------------
    def test_update_and_delete_custom_role(self):
        self.client.force_authenticate(user=self.master_user)

        role = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Copywriter',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )

        # Update name and permissions
        res_patch = self.client.patch(
            f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/{role.id}/',
            {
                'name': 'Senior Copywriter',
                'permissions': [{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE']}]
            },
            format='json'
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        role.refresh_from_db()
        self.assertEqual(role.name, 'Senior Copywriter')
        self.assertEqual(role.permissions[0]['actions'], ['VIEW', 'CREATE'])

        # Check update audit log
        update_audit = AdminAuditLog.objects.filter(action='UPDATE_ROLE').first()
        self.assertIsNotNone(update_audit)
        self.assertEqual(update_audit.details['role_id'], str(role.id))

        # Delete role
        res_del = self.client.delete(f'/api/auth/admin/workspaces/{self.workspace_a.id}/roles/{role.id}/')
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WorkspaceRole.objects.filter(id=role.id).exists())

        # Check delete audit log
        delete_audit = AdminAuditLog.objects.filter(action='DELETE_ROLE').first()
        self.assertIsNotNone(delete_audit)
        self.assertEqual(delete_audit.details['deleted_role_id'], str(role.id))

    # -------------------------------------------------------------
    # 6. User Creation + Custom Role Assignment & Multi-Tenancy
    # -------------------------------------------------------------
    def test_master_and_authorized_admin_can_create_user_with_workspace_role(self):
        self.client.force_authenticate(user=self.master_user)

        role_a = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Content Creator',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE']}]
        )

        payload = {
            'email': 'newcreator@test.com',
            'password': 'password123',
            'first_name': 'New',
            'last_name': 'Creator',
            'workspace_id': str(self.workspace_a.id),
            'role_id': str(role_a.id)
        }

        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['email'], 'newcreator@test.com')
        self.assertEqual(res.data['workspace']['id'], str(self.workspace_a.id))
        self.assertEqual(res.data['custom_role']['id'], str(role_a.id))

        # Verify DB records
        created_user = User.objects.get(email='newcreator@test.com')
        self.assertEqual(created_user.current_workspace, self.workspace_a)

        membership = WorkspaceMembership.objects.get(user=created_user, workspace=self.workspace_a)
        self.assertEqual(membership.custom_role, role_a)
        self.assertEqual(membership.status, 'ACTIVE')

    def test_create_user_with_cross_workspace_role_is_rejected(self):
        self.client.force_authenticate(user=self.master_user)

        # Role belongs to Workspace B
        role_b = WorkspaceRole.objects.create(
            workspace=self.workspace_b,
            name='Voice Operator',
            permissions=[{'software': 'AI_CALLING', 'feature': 'CALL_SESSIONS', 'actions': ['VIEW']}]
        )

        # Attempt to create user in Workspace A with Role from Workspace B
        payload = {
            'email': 'cross_user@test.com',
            'password': 'password123',
            'first_name': 'Cross',
            'last_name': 'User',
            'workspace_id': str(self.workspace_a.id),
            'role_id': str(role_b.id)
        }

        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not found in the selected workspace", res.data['error'])
        self.assertFalse(User.objects.filter(email='cross_user@test.com').exists())

    def test_create_user_with_direct_permission_injection_is_rejected(self):
        self.client.force_authenticate(user=self.master_user)

        # Attempt to supply raw permissions/actions payload directly
        payload = {
            'email': 'injector@test.com',
            'password': 'password123',
            'permissions': ['ALL'],
            'software': ['EVERYTHING']
        }

        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not allowed in user creation", res.data['error'])

    def test_add_and_update_user_workspace_membership_with_custom_role(self):
        self.client.force_authenticate(user=self.master_user)

        target_user = User.objects.create_user(
            username='existing_member@test.com', email='existing_member@test.com', password='password123'
        )
        ClientProfile.objects.create(user=target_user)

        role_a1 = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Role A1',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )
        role_a2 = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Role A2',
            permissions=[{'software': 'WHATSAPP_CAMPAIGN', 'feature': 'CAMPAIGNS', 'actions': ['VIEW']}]
        )

        # 1. Add workspace membership with Role A1
        res_add = self.client.post(
            f'/api/auth/admin/users/{target_user.id}/workspaces/',
            {
                'workspace_id': str(self.workspace_a.id),
                'role': 'MEMBER',
                'role_id': str(role_a1.id)
            },
            format='json'
        )
        self.assertEqual(res_add.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_add.data['custom_role']['id'], str(role_a1.id))

        # 2. Update membership to Role A2
        res_update = self.client.patch(
            f'/api/auth/admin/users/{target_user.id}/workspaces/{self.workspace_a.id}/',
            {
                'role_id': str(role_a2.id)
            },
            format='json'
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(res_update.data['custom_role']['id'], str(role_a2.id))

        # 3. View user workspaces list includes custom role details
        res_list = self.client.get(f'/api/auth/admin/users/{target_user.id}/workspaces/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(res_list.data[0]['custom_role']['name'], 'Role A2')

    # =========================================================================
    # STAGE 10.4 — RUNTIME USER ACCESS ENFORCEMENT TESTS
    # =========================================================================

    def test_runtime_user_workspace_permissions_endpoint(self):
        """Test GET /api/workspaces/user-permissions/ returns accurate effective granted permissions."""
        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Social Editor',
            permissions=[
                {'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE']}
            ]
        )
        membership = WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )
        self.normal_user.current_workspace = self.workspace_a
        self.normal_user.save()

        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/workspaces/user-permissions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['workspace_id'], str(self.workspace_a.id))
        self.assertEqual(res.data['custom_role']['name'], 'Social Editor')
        self.assertIn('SOCIAL_MEDIA_MANAGER', res.data['software_modules'])
        self.assertEqual(len(res.data['permissions']), 1)
        self.assertEqual(res.data['permissions'][0]['actions'], ['VIEW', 'CREATE'])

    def test_runtime_permission_checker_grants_exact_actions(self):
        """has_workspace_permission returns True for granted actions, False for ungranted."""
        from workspaces.permissions import has_workspace_permission

        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Social Editor',
            permissions=[
                {'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE']}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )

        # Granted
        self.assertTrue(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))
        self.assertTrue(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE'))

        # Ungranted action in same feature
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'DELETE'))
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'PUBLISH'))

        # Ungranted feature in same software
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'ANALYTICS', 'VIEW'))

        # Unpurchased software
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'AI_CALLING', 'CALL_SESSIONS', 'VIEW'))

    def test_dynamic_role_modification_immediately_changes_runtime_access(self):
        """When an admin modifies a role's permissions, user access updates immediately without token manipulation."""
        from workspaces.permissions import has_workspace_permission

        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Dynamic Role',
            permissions=[
                {'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE']}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )

        self.assertTrue(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE'))

        # Admin demotes role to VIEW only
        role_social.permissions = [{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        role_social.save()

        # CREATE is now immediately denied
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE'))
        self.assertTrue(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))

    def test_suspended_workspace_denies_runtime_access(self):
        """A suspended workspace denies all runtime access."""
        from workspaces.permissions import has_workspace_permission

        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Social Editor',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )

        self.workspace_a.status = 'SUSPENDED'
        self.workspace_a.save()

        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))

    def test_multi_tenancy_cross_workspace_access_denied(self):
        """User in Workspace A with POSTS:VIEW cannot access Workspace B."""
        from workspaces.permissions import has_workspace_permission

        role_a = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Role A',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_a,
            status='ACTIVE'
        )

        # Checking access against Workspace B must return False
        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_b, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))

    def test_canceled_or_expired_subscription_denies_software_access(self):
        """When workspace subscription is CANCELED or EXPIRED, runtime software permissions are denied."""
        from workspaces.permissions import has_workspace_permission

        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Social Editor',
            permissions=[{'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW']}]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )

        self.assertTrue(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))

        # Subscription canceled
        self.sub_a.status = 'CANCELED'
        self.sub_a.save()

        self.assertFalse(has_workspace_permission(self.normal_user, self.workspace_a, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW'))

    # =========================================================================
    # STAGE 12.1 — SOCIAL MEDIA MANAGER FULL API TESTS
    # =========================================================================

    def test_social_manager_posts_crud_permissions(self):
        """Verify POSTS VIEW, CREATE, UPDATE, DELETE, and PUBLISH endpoints enforce role permissions."""
        from platform_routing.models import SocialPost, PlatformAccount

        role_social = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Social Editor',
            permissions=[
                {'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'POSTS', 'actions': ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH']}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_social,
            status='ACTIVE'
        )
        self.normal_user.current_workspace = self.workspace_a
        self.normal_user.save()

        self.client.force_authenticate(user=self.normal_user)

        # 1. Create Post
        res_create = self.client.post('/api/platform/posts/', {
            'content': 'Test social post via API',
            'platform': 'TWITTER'
        }, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        post_id = res_create.data['id']

        # 2. List Posts
        res_list = self.client.get('/api/platform/posts/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data), 1)

        # 3. Retrieve Post Detail
        res_detail = self.client.get(f'/api/platform/posts/{post_id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['content'], 'Test social post via API')

        # 4. Patch/Update Post
        res_patch = self.client.patch(f'/api/platform/posts/{post_id}/', {
            'content': 'Updated content for social post'
        }, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['content'], 'Updated content for social post')

        # 5. Publish Post
        res_pub = self.client.post(f'/api/platform/posts/{post_id}/publish/')
        self.assertEqual(res_pub.status_code, status.HTTP_200_OK)

        # 6. Delete Post
        res_del = self.client.delete(f'/api/platform/posts/{post_id}/')
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)

    def test_social_manager_analytics_endpoint(self):
        """Verify /api/platform/analytics/ returns metrics and breakdown when ANALYTICS.VIEW is granted."""
        role_analytics = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name='Analytics Viewer',
            permissions=[
                {'software': 'SOCIAL_MEDIA_MANAGER', 'feature': 'ANALYTICS', 'actions': ['VIEW']}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.normal_user,
            workspace=self.workspace_a,
            role='MEMBER',
            custom_role=role_analytics,
            status='ACTIVE'
        )
        self.normal_user.current_workspace = self.workspace_a
        self.normal_user.save()

        self.client.force_authenticate(user=self.normal_user)
        res = self.client.get('/api/platform/analytics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('metrics', res.data)
        self.assertIn('platform_breakdown', res.data)
        self.assertIn('connected_platforms', res.data)



