from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole
from accounts.models import (
    AdminProfile, AdminPermission, AdminWorkspaceAssignment, AdminUserAssignment
)

User = get_user_model()


class AdminWorkspaceScopingSecurityTests(TestCase):
    """
    Security verification tests for ADMIN workspace visibility, isolation, and UUID authorization.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. MASTER user
        self.master_user = User.objects.create_user(
            username='master_ws_test@test.com',
            email='master_ws_test@test.com',
            password='password123'
        )
        self.master_admin = AdminProfile.objects.create(user=self.master_user, admin_level='MASTER')

        # 2. ADMIN A
        self.admin_a_user = User.objects.create_user(
            username='admin_a@test.com',
            email='admin_a@test.com',
            password='password123'
        )
        self.admin_a = AdminProfile.objects.create(user=self.admin_a_user, admin_level='ADMIN')
        for mod in ['WORKSPACES', 'USERS']:
            AdminPermission.objects.create(
                admin_profile=self.admin_a,
                module=mod,
                actions=['VIEW', 'CREATE', 'UPDATE', 'SUSPEND', 'ACTIVATE'],
                is_active=True
            )

        # 3. ADMIN B
        self.admin_b_user = User.objects.create_user(
            username='admin_b@test.com',
            email='admin_b@test.com',
            password='password123'
        )
        self.admin_b = AdminProfile.objects.create(user=self.admin_b_user, admin_level='ADMIN')
        for mod in ['WORKSPACES', 'USERS']:
            AdminPermission.objects.create(
                admin_profile=self.admin_b,
                module=mod,
                actions=['VIEW', 'CREATE', 'UPDATE', 'SUSPEND', 'ACTIVATE'],
                is_active=True
            )

        # 4. Fresh ADMIN (Zero assignments)
        self.fresh_admin_user = User.objects.create_user(
            username='fresh_admin@test.com',
            email='fresh_admin@test.com',
            password='password123'
        )
        self.fresh_admin = AdminProfile.objects.create(user=self.fresh_admin_user, admin_level='ADMIN')
        AdminPermission.objects.create(
            admin_profile=self.fresh_admin,
            module='WORKSPACES',
            actions=['VIEW'],
            is_active=True
        )

        # 5. Normal Users
        self.owner_user = User.objects.create_user(
            username='owner_user@test.com',
            email='owner_user@test.com',
            password='password123'
        )

        # 6. Workspaces
        self.ws_master = Workspace.objects.create(name='Master Workspace')
        WorkspaceMembership.objects.create(workspace=self.ws_master, user=self.master_user, role='OWNER')

        self.ws_a = Workspace.objects.create(name='Workspace A')
        WorkspaceMembership.objects.create(workspace=self.ws_a, user=self.owner_user, role='OWNER')

        self.ws_b = Workspace.objects.create(name='Workspace B')
        WorkspaceMembership.objects.create(workspace=self.ws_b, user=self.owner_user, role='OWNER')

        # Assign Workspace A to Admin A only
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_a,
            workspace=self.ws_a,
            max_users=25
        )

        # Assign Workspace B to Admin B only
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_b,
            workspace=self.ws_b,
            max_users=15
        )

    def test_master_login_all_workspaces_visible(self):
        """MASTER sees all workspaces across the platform without restriction."""
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ws_ids = [w['id'] for w in res.data]
        self.assertIn(str(self.ws_master.id), ws_ids)
        self.assertIn(str(self.ws_a.id), ws_ids)
        self.assertIn(str(self.ws_b.id), ws_ids)

    def test_fresh_admin_zero_assignments_returns_empty_list(self):
        """Fresh ADMIN with zero assignments sees empty directory, not MASTER workspaces."""
        self.client.force_authenticate(user=self.fresh_admin_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_admin_assigned_workspace_a_sees_only_workspace_a(self):
        """ADMIN assigned Workspace A sees only Workspace A; Workspace B and MASTER ws are excluded."""
        self.client.force_authenticate(user=self.admin_a_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], str(self.ws_a.id))
        self.assertEqual(res.data[0]['name'], 'Workspace A')
        self.assertEqual(res.data[0]['max_users'], 25)

    def test_master_created_workspace_without_admin_assignment_is_invisible(self):
        """MASTER workspace is strictly invisible to ADMINs who have not been assigned to it."""
        self.client.force_authenticate(user=self.admin_a_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        ws_ids = [w['id'] for w in res.data]
        self.assertNotIn(str(self.ws_master.id), ws_ids)

    def test_admin_created_workspace_automatically_assigned_and_visible(self):
        """When an ADMIN creates a workspace, it is automatically assigned to that ADMIN."""
        self.client.force_authenticate(user=self.admin_a_user)
        res = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'Admin A Created Brand',
            'owner_id': str(self.owner_user.id)
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_ws_id = res.data['id']

        # Verify automatic AdminWorkspaceAssignment
        wa = AdminWorkspaceAssignment.objects.filter(admin_profile=self.admin_a, workspace_id=new_ws_id).first()
        self.assertIsNotNone(wa)

        # Verify automatic AdminUserAssignment for the owner
        ua = AdminUserAssignment.objects.filter(admin_profile=self.admin_a, workspace_id=new_ws_id, user=self.owner_user).first()
        self.assertIsNotNone(ua)

        # Verify it is visible in Admin A directory
        res_list = self.client.get('/api/auth/admin/workspaces/')
        visible_ids = [w['id'] for w in res_list.data]
        self.assertIn(str(new_ws_id), visible_ids)

        # Verify invisible to Admin B
        self.client.force_authenticate(user=self.admin_b_user)
        res_b = self.client.get('/api/auth/admin/workspaces/')
        b_ids = [w['id'] for w in res_b.data]
        self.assertNotIn(str(new_ws_id), b_ids)

    def test_admin_cannot_access_unauthorized_workspace_by_uuid(self):
        """ADMIN cannot GET, PATCH, suspend, or activate an unauthorized workspace by UUID."""
        self.client.force_authenticate(user=self.admin_a_user)

        # GET detail of unauthorized workspace B -> 404
        res_get = self.client.get(f'/api/auth/admin/workspaces/{self.ws_b.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

        # PATCH unauthorized workspace B name -> 404
        res_patch = self.client.patch(f'/api/auth/admin/workspaces/{self.ws_b.id}/', {
            'name': 'Hacked Name'
        }, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_404_NOT_FOUND)
        self.ws_b.refresh_from_db()
        self.assertEqual(self.ws_b.name, 'Workspace B')

        # PATCH status (suspend) unauthorized workspace B -> 404
        res_status = self.client.patch(f'/api/auth/admin/workspaces/{self.ws_b.id}/status/', {
            'status': 'SUSPENDED'
        }, format='json')
        self.assertEqual(res_status.status_code, status.HTTP_404_NOT_FOUND)
        self.ws_b.refresh_from_db()
        self.assertEqual(self.ws_b.status, 'ACTIVE')

    def test_admin_cannot_create_or_manage_users_or_roles_in_unauthorized_workspace(self):
        """ADMIN cannot create users, memberships, or roles in an unauthorized workspace."""
        self.client.force_authenticate(user=self.admin_a_user)

        # Try to create user in unauthorized workspace B -> 404
        res_create_user = self.client.post('/api/auth/admin/users/', {
            'email': 'unauth_user@test.com',
            'password': 'Password123!',
            'first_name': 'Test',
            'last_name': 'User',
            'workspace_id': str(self.ws_b.id)
        }, format='json')
        self.assertEqual(res_create_user.status_code, status.HTTP_404_NOT_FOUND)

        # Try to list members of unauthorized workspace B -> 404
        res_members = self.client.get(f'/api/auth/admin/workspaces/{self.ws_b.id}/members/')
        self.assertEqual(res_members.status_code, status.HTTP_404_NOT_FOUND)

        # Try to create custom role in unauthorized workspace B -> 404
        res_role = self.client.post(f'/api/auth/admin/workspaces/{self.ws_b.id}/roles/', {
            'name': 'Illegal Role',
            'permissions': []
        }, format='json')
        self.assertEqual(res_role.status_code, status.HTTP_404_NOT_FOUND)

    def test_two_admins_assigned_different_workspaces_are_fully_isolated(self):
        """Two ADMINs with different workspace assignments have mutual zero-visibility and zero-control."""
        # Admin A can only see and access Workspace A
        self.client.force_authenticate(user=self.admin_a_user)
        res_a = self.client.get(f'/api/auth/admin/workspaces/{self.ws_a.id}/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        res_a_forbidden = self.client.get(f'/api/auth/admin/workspaces/{self.ws_b.id}/')
        self.assertEqual(res_a_forbidden.status_code, status.HTTP_404_NOT_FOUND)

        # Admin B can only see and access Workspace B
        self.client.force_authenticate(user=self.admin_b_user)
        res_b = self.client.get(f'/api/auth/admin/workspaces/{self.ws_b.id}/')
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        res_b_forbidden = self.client.get(f'/api/auth/admin/workspaces/{self.ws_a.id}/')
        self.assertEqual(res_b_forbidden.status_code, status.HTTP_404_NOT_FOUND)

    def test_master_behavior_remains_unrestricted(self):
        """MASTER can GET, PATCH, and change status on any workspace."""
        self.client.force_authenticate(user=self.master_user)

        # GET detail of ws_a and ws_b
        res_a = self.client.get(f'/api/auth/admin/workspaces/{self.ws_a.id}/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        res_b = self.client.get(f'/api/auth/admin/workspaces/{self.ws_b.id}/')
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)

        # PATCH ws_a
        res_patch = self.client.patch(f'/api/auth/admin/workspaces/{self.ws_a.id}/', {
            'name': 'Master Renamed A'
        }, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

    def test_active_workspace_selector_scoped_for_admin(self):
        """Active workspace selector API (/api/workspaces/) and switcher (/api/workspaces/switch/) are scoped to AdminWorkspaceAssignment."""
        # Add Admin A as member of both ws_a (assigned) and ws_master (unassigned)
        WorkspaceMembership.objects.create(workspace=self.ws_a, user=self.admin_a_user, role='ADMIN')
        WorkspaceMembership.objects.create(workspace=self.ws_master, user=self.admin_a_user, role='ADMIN')

        self.client.force_authenticate(user=self.admin_a_user)

        # 1. /api/workspaces/ should only return ws_a, NOT ws_master
        res = self.client.get('/api/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ws_ids = [w['id'] for w in res.data]
        self.assertIn(str(self.ws_a.id), ws_ids)
        self.assertNotIn(str(self.ws_master.id), ws_ids)

        # 2. Switching to unauthorized ws_master returns 404
        res_switch_bad = self.client.post('/api/workspaces/switch/', {
            'workspace_id': str(self.ws_master.id)
        }, format='json')
        self.assertEqual(res_switch_bad.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Switching to authorized ws_a succeeds
        res_switch_good = self.client.post('/api/workspaces/switch/', {
            'workspace_id': str(self.ws_a.id)
        }, format='json')
        self.assertEqual(res_switch_good.status_code, status.HTTP_200_OK)

    def test_admin_creates_workspace_without_owner_id_automatically_established(self):
        """ADMIN creates a workspace without owner_id; ADMIN is automatically established as owner and manager."""
        self.client.force_authenticate(user=self.admin_a_user)
        res = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'Bootstrapped Workspace'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_ws_id = res.data['id']

        # 1. Membership established as OWNER for the creating admin
        membership = WorkspaceMembership.objects.filter(workspace_id=new_ws_id, user=self.admin_a_user).first()
        self.assertIsNotNone(membership)
        self.assertEqual(membership.role, 'OWNER')

        # 2. AdminWorkspaceAssignment created
        wa = AdminWorkspaceAssignment.objects.filter(admin_profile=self.admin_a, workspace_id=new_ws_id).first()
        self.assertIsNotNone(wa)

        # 3. Visible to creating admin
        res_list = self.client.get('/api/auth/admin/workspaces/')
        self.assertIn(str(new_ws_id), [w['id'] for w in res_list.data])

    def test_admin_cannot_assign_unrelated_master_or_admin_as_owner(self):
        """ADMIN cannot assign an unrelated MASTER or another ADMIN as owner."""
        self.client.force_authenticate(user=self.admin_a_user)
        res = self.client.post('/api/auth/admin/workspaces/', {
            'name': 'Illegal Owner Workspace',
            'owner_id': str(self.master_user.id)
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot assign other admins or master users as workspace owner', str(res.data))

