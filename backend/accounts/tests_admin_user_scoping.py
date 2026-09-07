import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import (
    AdminProfile, AdminPermission, AdminWorkspaceAssignment, AdminUserAssignment, ClientProfile
)
from workspaces.models import Workspace, WorkspaceMembership

User = get_user_model()

class AdminUserScopingSecurityTests(TestCase):
    """
    Comprehensive security test suite verifying:
    - Scoped ADMIN user visibility
    - Strict isolation between ADMINs
    - Atomic user creation and assignment mapping
    - Workspace limit enforcement
    - Direct object access protection (IDOR)
    - MASTER unrestricted access and management capabilities
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Create MASTER user
        self.master_user = User.objects.create_user(
            username='akshitsharmacodes@gmail.com',
            email='akshitsharmacodes@gmail.com',
            password='Password123!',
            first_name='Master',
            last_name='Akshit'
        )
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user,
            admin_level='MASTER',
            is_active=True
        )
        ClientProfile.objects.create(user=self.master_user)

        # 2. Create Subodh ADMIN user
        self.subodh_user = User.objects.create_user(
            username='subodh.moudgil@gmail.com',
            email='subodh.moudgil@gmail.com',
            password='Password123!',
            first_name='Subodh',
            last_name='Moudgil'
        )
        self.subodh_profile = AdminProfile.objects.create(
            user=self.subodh_user,
            admin_level='ADMIN',
            is_active=True
        )
        ClientProfile.objects.create(user=self.subodh_user)
        AdminPermission.objects.create(
            admin_profile=self.subodh_profile,
            module='USERS',
            actions=['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'ACTIVATE']
        )
        AdminPermission.objects.create(
            admin_profile=self.subodh_profile,
            module='WORKSPACES',
            actions=['VIEW', 'UPDATE']
        )

        # 3. Create another ADMIN user (Admin Bob)
        self.bob_user = User.objects.create_user(
            username='bob.admin@gmail.com',
            email='bob.admin@gmail.com',
            password='Password123!',
            first_name='Bob',
            last_name='Admin'
        )
        self.bob_profile = AdminProfile.objects.create(
            user=self.bob_user,
            admin_level='ADMIN',
            is_active=True
        )
        ClientProfile.objects.create(user=self.bob_user)
        AdminPermission.objects.create(
            admin_profile=self.bob_profile,
            module='USERS',
            actions=['VIEW', 'CREATE', 'UPDATE']
        )
        AdminPermission.objects.create(
            admin_profile=self.bob_profile,
            module='WORKSPACES',
            actions=['VIEW']
        )

        # 4. Create Workspaces
        self.workspace_a = Workspace.objects.create(name='Workspace Alpha', status='ACTIVE')
        self.workspace_b = Workspace.objects.create(name='Workspace Beta', status='ACTIVE')

        # Assign Subodh to Workspace Alpha (max_users = 2)
        self.subodh_wa = AdminWorkspaceAssignment.objects.create(
            admin_profile=self.subodh_profile,
            workspace=self.workspace_a,
            max_users=2
        )
        WorkspaceMembership.objects.create(
            user=self.subodh_user,
            workspace=self.workspace_a,
            role='ADMIN',
            status='ACTIVE'
        )

        # Assign Bob to Workspace Alpha (max_users = 5) and Workspace Beta (max_users = 5)
        self.bob_wa_a = AdminWorkspaceAssignment.objects.create(
            admin_profile=self.bob_profile,
            workspace=self.workspace_a,
            max_users=5
        )
        self.bob_wa_b = AdminWorkspaceAssignment.objects.create(
            admin_profile=self.bob_profile,
            workspace=self.workspace_b,
            max_users=5
        )

        # 5. Create Master-only users
        self.master_only_users = []
        for email in [
            'akshitsharma1@gmail.com',
            'gentleakshit@gmail.com',
            'demo@gmail.com',
            'u1@test.com'
        ]:
            u = User.objects.create_user(
                username=email,
                email=email,
                password='Password123!',
                first_name='Test',
                last_name='User'
            )
            ClientProfile.objects.create(user=u)
            WorkspaceMembership.objects.create(user=u, workspace=self.workspace_a, role='MEMBER')
            self.master_only_users.append(u)

    def test_master_sees_all_users(self):
        """MASTER retains unrestricted visibility across all users."""
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_emails = [u['email'] for u in res.data]

        for u in self.master_only_users:
            self.assertIn(u.email, returned_emails)
        self.assertIn(self.subodh_user.email, returned_emails)
        self.assertIn(self.bob_user.email, returned_emails)

    def test_fresh_admin_with_no_assignments_sees_zero_users(self):
        """A fresh ADMIN with zero user assignments sees exactly 0 users."""
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_subodh_cannot_see_master_users(self):
        """Subodh must NOT see MASTER users or unassigned users."""
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_emails = [u['email'] for u in res.data]

        for email in [
            'akshitsharmacodes@gmail.com',
            'akshitsharma1@gmail.com',
            'gentleakshit@gmail.com',
            'demo@gmail.com',
            'u1@test.com'
        ]:
            self.assertNotIn(email, returned_emails)

    def test_subodh_creates_user_atomic_mapping(self):
        """When Subodh creates a user, AdminUserAssignment is created atomically and user is visible to Subodh."""
        self.client.force_authenticate(user=self.subodh_user)
        payload = {
            'email': 'subodh.client1@gmail.com',
            'password': 'SecurePassword123!',
            'first_name': 'Subodh',
            'last_name': 'Client',
            'workspace_id': str(self.workspace_a.id)
        }
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_user_id = res.data['id']

        # Verify assignment in DB
        self.assertTrue(AdminUserAssignment.objects.filter(
            admin_profile=self.subodh_profile,
            workspace=self.workspace_a,
            user_id=new_user_id
        ).exists())

        # Subodh sees the user
        res_list = self.client.get('/api/auth/admin/users/')
        self.assertEqual(len(res_list.data), 1)
        self.assertEqual(res_list.data[0]['email'], 'subodh.client1@gmail.com')

        # Another ADMIN (Bob) cannot see Subodh's user
        self.client.force_authenticate(user=self.bob_user)
        res_bob = self.client.get('/api/auth/admin/users/')
        self.assertEqual(len(res_bob.data), 0)

        # MASTER can see Subodh's user
        self.client.force_authenticate(user=self.master_user)
        res_master = self.client.get('/api/auth/admin/users/')
        self.assertTrue(any(u['email'] == 'subodh.client1@gmail.com' for u in res_master.data))

    def test_subodh_user_creation_requires_assigned_workspace(self):
        """Subodh cannot create a user in an unassigned workspace (Workspace Beta)."""
        self.client.force_authenticate(user=self.subodh_user)
        payload = {
            'email': 'unauth.workspace@gmail.com',
            'password': 'SecurePassword123!',
            'workspace_id': str(self.workspace_b.id)
        }
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('not found in your assigned scope', res.data['error'])

    def test_workspace_user_limit_enforcement(self):
        """Subodh has max_users=2 in Workspace Alpha. The 3rd creation must be rejected."""
        self.client.force_authenticate(user=self.subodh_user)

        # 1st user
        res1 = self.client.post('/api/auth/admin/users/', {
            'email': 'sub.user1@gmail.com',
            'password': 'Password123!',
            'workspace_id': str(self.workspace_a.id)
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # 2nd user
        res2 = self.client.post('/api/auth/admin/users/', {
            'email': 'sub.user2@gmail.com',
            'password': 'Password123!',
            'workspace_id': str(self.workspace_a.id)
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

        # 3rd user -> should fail due to max_users=2
        res3 = self.client.post('/api/auth/admin/users/', {
            'email': 'sub.user3@gmail.com',
            'password': 'Password123!',
            'workspace_id': str(self.workspace_a.id)
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit reached', res3.data['error'].lower())

    def test_master_explicit_user_assignment_and_reassignment(self):
        """MASTER can explicitly assign a user to Subodh, and reassign to Bob, immediately updating visibility."""
        target_user = self.master_only_users[0]

        # 1. Initially Subodh cannot see target_user
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertNotIn(target_user.email, [u['email'] for u in res.data])

        # 2. MASTER assigns target_user to Subodh in Workspace Alpha
        self.client.force_authenticate(user=self.master_user)
        assign_res = self.client.post(f'/api/auth/admin/users/{target_user.id}/assign/', {
            'admin_profile_id': str(self.subodh_profile.id),
            'workspace_id': str(self.workspace_a.id)
        }, format='json')
        self.assertEqual(assign_res.status_code, status.HTTP_200_OK)

        # 3. Subodh immediately sees target_user
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertIn(target_user.email, [u['email'] for u in res.data])

        # 4. Bob cannot see target_user
        self.client.force_authenticate(user=self.bob_user)
        res_bob = self.client.get('/api/auth/admin/users/')
        self.assertNotIn(target_user.email, [u['email'] for u in res_bob.data])

        # 5. MASTER reassigns target_user to Bob
        self.client.force_authenticate(user=self.master_user)
        reassign_res = self.client.post(f'/api/auth/admin/users/{target_user.id}/assign/', {
            'admin_profile_id': str(self.bob_profile.id),
            'workspace_id': str(self.workspace_a.id)
        }, format='json')
        self.assertEqual(reassign_res.status_code, status.HTTP_200_OK)

        # 6. Immediately removed from Subodh
        self.client.force_authenticate(user=self.subodh_user)
        res_subodh_after = self.client.get('/api/auth/admin/users/')
        self.assertNotIn(target_user.email, [u['email'] for u in res_subodh_after.data])

        # 7. Immediately visible to Bob
        self.client.force_authenticate(user=self.bob_user)
        res_bob_after = self.client.get('/api/auth/admin/users/')
        self.assertIn(target_user.email, [u['email'] for u in res_bob_after.data])

    def test_direct_idor_access_prevented(self):
        """Direct PATCH/status update on an unauthorized user UUID returns 404."""
        unauthorized_user = self.master_only_users[0]

        self.client.force_authenticate(user=self.subodh_user)

        # Detail update attempt
        patch_res = self.client.patch(f'/api/auth/admin/users/{unauthorized_user.id}/', {
            'first_name': 'Hacked'
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_404_NOT_FOUND)

        # Status update attempt
        status_res = self.client.patch(f'/api/auth/admin/users/{unauthorized_user.id}/status/', {
            'status': 'SUSPENDED'
        }, format='json')
        self.assertEqual(status_res.status_code, status.HTTP_404_NOT_FOUND)

        # Workspaces list attempt
        ws_res = self.client.get(f'/api/auth/admin/users/{unauthorized_user.id}/workspaces/')
        self.assertEqual(ws_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_modify_master_user(self):
        """Direct action targeting a MASTER user returns 403 Forbidden."""
        self.client.force_authenticate(user=self.subodh_user)

        patch_res = self.client.patch(f'/api/auth/admin/users/{self.master_user.id}/', {
            'first_name': 'HackedMaster'
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_403_FORBIDDEN)

        status_res = self.client.patch(f'/api/auth/admin/users/{self.master_user.id}/status/', {
            'status': 'SUSPENDED'
        }, format='json')
        self.assertEqual(status_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_workspace_listing_scoped_to_assigned_workspaces(self):
        """ADMIN sees only explicitly assigned workspaces."""
        # Subodh is only assigned to Workspace Alpha
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/workspaces/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ws_names = [w['name'] for w in res.data]
        self.assertIn('Workspace Alpha', ws_names)
        self.assertNotIn('Workspace Beta', ws_names)

        # Bob is assigned to both Alpha and Beta
        self.client.force_authenticate(user=self.bob_user)
        res_bob = self.client.get('/api/auth/admin/workspaces/')
        bob_ws_names = [w['name'] for w in res_bob.data]
        self.assertIn('Workspace Alpha', bob_ws_names)
        self.assertIn('Workspace Beta', bob_ws_names)

    def test_master_cannot_reduce_limit_below_assigned_count(self):
        """MASTER cannot lower max_users below the current assigned user count."""
        # Assign 1 user to Subodh
        target_user = self.master_only_users[0]
        AdminUserAssignment.objects.create(
            admin_profile=self.subodh_profile,
            workspace=self.workspace_a,
            user=target_user
        )

        self.client.force_authenticate(user=self.master_user)
        # Try to reduce limit to 0
        res = self.client.post(f'/api/auth/admin/admins/{self.subodh_profile.id}/workspaces/', {
            'workspace_id': str(self.workspace_a.id),
            'max_users': 0
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('at least 1', res.data['error'])
