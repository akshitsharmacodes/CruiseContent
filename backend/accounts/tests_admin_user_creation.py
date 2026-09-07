from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import AdminProfile, ClientProfile, AdminPermission, AdminAuditLog, AdminWorkspaceAssignment
from workspaces.models import Workspace

User = get_user_model()


class AdminConsoleCreateUserTests(TestCase):
    """
    Security tests for POST /api/auth/admin/users/ (normal user creation).
    """

    def setUp(self):
        self.client = APIClient()

        self.workspace = Workspace.objects.create(name="Test Workspace")

        # MASTER user
        self.master_user = User.objects.create_user(
            username='master_create@test.com',
            email='master_create@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.master_user)
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user, admin_level='MASTER'
        )

        # ADMIN with USERS:CREATE
        self.admin_with_create = User.objects.create_user(
            username='admin_create@test.com',
            email='admin_create@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_with_create)
        self.admin_create_profile = AdminProfile.objects.create(
            user=self.admin_with_create, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_create_profile,
            module='USERS',
            actions=['VIEW', 'CREATE'],
            is_active=True
        )
        AdminWorkspaceAssignment.objects.create(
            admin_profile=self.admin_create_profile,
            workspace=self.workspace,
            max_users=10
        )

        # ADMIN without USERS:CREATE
        self.admin_no_create = User.objects.create_user(
            username='admin_nocreate@test.com',
            email='admin_nocreate@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.admin_no_create)
        self.admin_nocreate_profile = AdminProfile.objects.create(
            user=self.admin_no_create, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=self.admin_nocreate_profile,
            module='USERS',
            actions=['VIEW'],
            is_active=True
        )

        # Normal user (no AdminProfile)
        self.normal_user = User.objects.create_user(
            username='normal_create@test.com',
            email='normal_create@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=self.normal_user)

    def _create_payload(self, email='newuser@test.com', password='securepass123'):
        return {
            'email': email,
            'password': password,
            'first_name': 'New',
            'last_name': 'User'
        }

    # --- Authorization tests ---

    def test_master_can_create_normal_user(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload(), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['email'], 'newuser@test.com')
        self.assertEqual(res.data['first_name'], 'New')
        self.assertEqual(res.data['last_name'], 'User')
        self.assertTrue(res.data['is_active'])

    def test_admin_with_users_create_can_create_normal_user(self):
        self.client.force_authenticate(user=self.admin_with_create)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('adminuser@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['email'], 'adminuser@test.com')

    def test_admin_without_users_create_receives_403(self):
        self.client.force_authenticate(user=self.admin_no_create)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('denied@test.com'), format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(User.objects.filter(email='denied@test.com').exists())

    def test_normal_user_receives_403(self):
        self.client.force_authenticate(user=self.normal_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('denied2@test.com'), format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(User.objects.filter(email='denied2@test.com').exists())

    def test_unauthenticated_receives_401(self):
        res = self.client.post('/api/auth/admin/users/', self._create_payload('denied3@test.com'), format='json')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(User.objects.filter(email='denied3@test.com').exists())

    # --- Validation tests ---

    def test_duplicate_email_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post(
            '/api/auth/admin/users/',
            self._create_payload(email=self.normal_user.email),
            format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('already exists', res.data['error'])

    def test_missing_email_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', {'password': 'securepass123'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_missing_password_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', {'email': 'nopass@test.com'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_short_password_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload(password='short'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('8 characters', res.data['error'])

    # --- Security tests ---

    def test_admin_cannot_create_admin_via_forbidden_field(self):
        self.client.force_authenticate(user=self.master_user)
        payload = self._create_payload('sneaky@test.com')
        payload['admin_level'] = 'ADMIN'
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('not allowed', res.data['error'])
        self.assertFalse(User.objects.filter(email='sneaky@test.com').exists())

    def test_is_staff_field_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = self._create_payload('staff@test.com')
        payload['is_staff'] = True
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_is_superuser_field_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = self._create_payload('super@test.com')
        payload['is_superuser'] = True
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_permissions_field_rejected(self):
        self.client.force_authenticate(user=self.master_user)
        payload = self._create_payload('perms@test.com')
        payload['permissions'] = [{'module': 'USERS', 'actions': ['VIEW']}]
        res = self.client.post('/api/auth/admin/users/', payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_password_is_hashed_correctly(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('hashed@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email='hashed@test.com')
        self.assertTrue(user.check_password('securepass123'))
        self.assertFalse(user.check_password('wrongpassword'))

    def test_response_contains_no_password(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('safe@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertNotIn('password', res.data)
        self.assertNotIn('password_hash', res.data)

    def test_response_contains_safe_fields_only(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('fields@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        allowed = {'id', 'email', 'first_name', 'last_name', 'date_joined', 'is_active', 'tier'}
        self.assertEqual(set(res.data.keys()), allowed)

    def test_audit_log_is_created(self):
        self.client.force_authenticate(user=self.master_user)
        initial = AdminAuditLog.objects.filter(action='CREATE_USER').count()
        self.client.post('/api/auth/admin/users/', self._create_payload('audit@test.com'), format='json')
        self.assertEqual(AdminAuditLog.objects.filter(action='CREATE_USER').count(), initial + 1)
        log = AdminAuditLog.objects.filter(action='CREATE_USER').latest('created_at')
        self.assertEqual(log.actor, self.master_user)
        self.assertEqual(log.details['created_user_email'], 'audit@test.com')

    def test_created_user_has_client_profile(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('profile@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email='profile@test.com')
        self.assertTrue(hasattr(user, 'profile'))
        self.assertEqual(user.profile.tier, 'FREE')

    def test_created_user_has_no_admin_profile(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.post('/api/auth/admin/users/', self._create_payload('noadmin@test.com'), format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email='noadmin@test.com')
        self.assertFalse(hasattr(user, 'admin_profile'))

    # --- Verify existing GET still works ---

    def test_get_users_still_works_for_master(self):
        self.client.force_authenticate(user=self.master_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.data, list)

    def test_get_users_still_works_for_admin_with_view(self):
        self.client.force_authenticate(user=self.admin_with_create)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 200)

    def test_get_users_denied_for_admin_without_view(self):
        # Create admin with only CREATE but no VIEW
        admin_only_create = User.objects.create_user(
            username='onlycreate@test.com',
            email='onlycreate@test.com',
            password='password123'
        )
        ClientProfile.objects.create(user=admin_only_create)
        admin_profile = AdminProfile.objects.create(
            user=admin_only_create, admin_level='ADMIN'
        )
        AdminPermission.objects.create(
            admin_profile=admin_profile,
            module='USERS',
            actions=['CREATE'],
            is_active=True
        )
        self.client.force_authenticate(user=admin_only_create)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 403)

    # --- Permission revocation is immediately enforced ---

    def test_permission_revocation_immediately_enforced(self):
        self.client.force_authenticate(user=self.admin_with_create)
        # Verify create works
        res = self.client.post('/api/auth/admin/users/', self._create_payload('before@test.com'), format='json')
        self.assertEqual(res.status_code, 201)

        # Revoke CREATE permission
        perm = AdminPermission.objects.get(
            admin_profile=self.admin_create_profile, module='USERS'
        )
        perm.actions = ['VIEW']
        perm.save()

        # Create should now fail
        res = self.client.post('/api/auth/admin/users/', self._create_payload('after@test.com'), format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(User.objects.filter(email='after@test.com').exists())
