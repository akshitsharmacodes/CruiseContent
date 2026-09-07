from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.core.management import call_command

from accounts.models import AdminProfile, AdminPermission, AdminWorkspaceAssignment, AdminUserAssignment
from workspaces.models import Workspace, WorkspaceMembership
from payments.models import Plan, Subscription, PlanEntitlement
from workspaces.permissions import has_workspace_permission
from workspaces.software_registry import SOFTWARE_FEATURE_REGISTRY

User = get_user_model()

class SubodhManagerAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Create MASTER user and profile
        self.master_user = User.objects.create_user(
            username="master_admin",
            email="akshitsharmacodes@gmail.com",
            password="masterpassword123"
        )
        self.master_profile = AdminProfile.objects.create(
            user=self.master_user,
            admin_level="MASTER",
            is_active=True
        )

        # 2. Create Subodh ADMIN user and profile
        self.subodh_user = User.objects.create_user(
            username="subodh",
            email="subodh.moudgil@gmail.com",
            password="subodhpassword123"
        )
        self.subodh_profile = AdminProfile.objects.create(
            user=self.subodh_user,
            admin_level="ADMIN",
            is_active=True
        )

        # 3. Create Enterprise Plan with all 7 software entitlements
        self.enterprise_plan = Plan.objects.create(
            name="Enterprise All Access",
            code="ENT_ALL",
            billing_interval="MONTHLY",
            price=500
        )
        for sw_code, sw_data in SOFTWARE_FEATURE_REGISTRY.items():
            PlanEntitlement.objects.create(plan=self.enterprise_plan, feature_code=sw_code)
            for feat_code in sw_data.get("features", {}).keys():
                PlanEntitlement.objects.create(plan=self.enterprise_plan, feature_code=feat_code)

        # 4. Create Subodh's testing workspace with active subscription
        self.testing_ws = Workspace.objects.create(name="LeadManch Demo", status="ACTIVE")
        Subscription.objects.create(workspace=self.testing_ws, plan=self.enterprise_plan, status="ACTIVE")
        WorkspaceMembership.objects.create(user=self.subodh_user, workspace=self.testing_ws, role="OWNER", status="ACTIVE")
        AdminWorkspaceAssignment.objects.create(admin_profile=self.subodh_profile, workspace=self.testing_ws, max_users=10)
        self.subodh_user.current_workspace = self.testing_ws
        self.subodh_user.save()

        # 5. Create MASTER-owned workspace (not assigned to Subodh)
        self.master_ws = Workspace.objects.create(name="Gentle Tech Labs Workspace", status="ACTIVE")
        Subscription.objects.create(workspace=self.master_ws, plan=self.enterprise_plan, status="ACTIVE")
        WorkspaceMembership.objects.create(user=self.master_user, workspace=self.master_ws, role="OWNER", status="ACTIVE")

        # 6. Grant basic USERS permission for admin console directory access
        AdminPermission.objects.create(
            admin_profile=self.subodh_profile,
            module="USERS",
            actions=["VIEW", "CREATE", "UPDATE", "DELETE"],
            is_active=True
        )

        # 7. Run idempotent provisioning command for Subodh software permissions
        call_command('provision_subodh_access', email='subodh.moudgil@gmail.com', workspace='LeadManch Demo')

    def test_subodh_remains_admin_never_master(self):
        """Subodh must remain an ADMIN and must never be promoted to MASTER."""
        self.subodh_profile.refresh_from_db()
        self.assertEqual(self.subodh_profile.admin_level, "ADMIN")
        self.assertNotEqual(self.subodh_profile.admin_level, "MASTER")

    def test_subodh_receives_all_seven_software_permissions(self):
        """Subodh receives active AdminPermission records for all 7 software modules."""
        target_software = [
            "WHATSAPP_CAMPAIGN", "WHATSHOOK", "AI_CALLING",
            "CHATBOT", "DATEXT", "SOCIAL_MEDIA_MANAGER", "SHARE_AND_CARE"
        ]
        for sw in target_software:
            perm = AdminPermission.objects.filter(admin_profile=self.subodh_profile, module=sw, is_active=True).first()
            self.assertIsNotNone(perm, f"Missing AdminPermission for {sw}")
            self.assertIn("VIEW", perm.actions)

    def test_subodh_can_access_all_seven_modules_in_authorized_workspace(self):
        """Subodh can access all seven software modules inside his authorized workspace."""
        target_software = [
            ("WHATSAPP_CAMPAIGN", "CAMPAIGNS", "VIEW"),
            ("WHATSHOOK", "WEBHOOKS", "VIEW"),
            ("AI_CALLING", "CALL_SESSIONS", "VIEW"),
            ("CHATBOT", "BOT_FLOWS", "VIEW"),
            ("DATEXT", "EXTRACTION", "VIEW"),
            ("SOCIAL_MEDIA_MANAGER", "POSTS", "VIEW"),
            ("SHARE_AND_CARE", "COMMUNITY", "VIEW"),
        ]
        for sw, feat, act in target_software:
            self.assertTrue(
                has_workspace_permission(self.subodh_user, self.testing_ws, sw, feat, act),
                f"Expected permission for {sw}.{feat}.{act} in LeadManch Demo"
            )

    def test_subodh_cannot_access_unassigned_master_workspace(self):
        """Subodh must not be able to access Gentle Tech Labs Workspace (not assigned to him)."""
        self.assertFalse(
            has_workspace_permission(self.subodh_user, self.master_ws, "WHATSAPP_CAMPAIGN", "CAMPAIGNS", "VIEW")
        )

    def test_subodh_cannot_access_master_only_endpoints(self):
        """Subodh ADMIN cannot access MASTER-only admin endpoints."""
        self.client.force_authenticate(user=self.subodh_user)
        # Managing admins list is MASTER only
        res_admins = self.client.get('/api/auth/admin/admins/')
        self.assertEqual(res_admins.status_code, 403)

        # Managing permission modules list is MASTER only
        res_modules = self.client.get('/api/auth/admin/permissions/modules/')
        self.assertEqual(res_modules.status_code, 403)

    def test_subodh_cannot_see_master_users(self):
        """Subodh ADMIN must not see MASTER users in the admin users directory."""
        self.client.force_authenticate(user=self.subodh_user)
        res = self.client.get('/api/auth/admin/users/')
        self.assertEqual(res.status_code, 200)
        returned_emails = [u['email'].lower() for u in res.data]
        self.assertNotIn("akshitsharmacodes@gmail.com", returned_emails)

    def test_subodh_cannot_bypass_subscription_entitlements(self):
        """Even with AdminPermission, software not entitled to a workspace is blocked."""
        # Create an unentitled workspace
        basic_plan = Plan.objects.create(name="Basic Plan", code="BASIC", billing_interval="MONTHLY", price=10)
        # PlanEntitlement does NOT include AI_CALLING
        PlanEntitlement.objects.create(plan=basic_plan, feature_code="SOCIAL_MEDIA_MANAGER")

        unentitled_ws = Workspace.objects.create(name="Basic WS", status="ACTIVE")
        Subscription.objects.create(workspace=unentitled_ws, plan=basic_plan, status="ACTIVE")
        AdminWorkspaceAssignment.objects.create(admin_profile=self.subodh_profile, workspace=unentitled_ws, max_users=5)
        WorkspaceMembership.objects.create(user=self.subodh_user, workspace=unentitled_ws, role="OWNER", status="ACTIVE")

        # Entitled software works
        self.assertTrue(has_workspace_permission(self.subodh_user, unentitled_ws, "SOCIAL_MEDIA_MANAGER", "POSTS", "VIEW"))
        # Unentitled software fails despite AdminPermission
        self.assertFalse(has_workspace_permission(self.subodh_user, unentitled_ws, "AI_CALLING", "CALL_SESSIONS", "VIEW"))

    def test_removing_permission_immediately_revokes_runtime_access(self):
        """Deactivating an AdminPermission immediately removes runtime access without JWT recreation."""
        perm = AdminPermission.objects.get(admin_profile=self.subodh_profile, module="WHATSAPP_CAMPAIGN")
        self.assertTrue(has_workspace_permission(self.subodh_user, self.testing_ws, "WHATSAPP_CAMPAIGN", "CAMPAIGNS", "VIEW"))

        # Deactivate permission
        perm.is_active = False
        perm.save()

        # Immediate revocation without JWT change
        self.assertFalse(has_workspace_permission(self.subodh_user, self.testing_ws, "WHATSAPP_CAMPAIGN", "CAMPAIGNS", "VIEW"))

        # Reactivate
        perm.is_active = True
        perm.save()
        self.assertTrue(has_workspace_permission(self.subodh_user, self.testing_ws, "WHATSAPP_CAMPAIGN", "CAMPAIGNS", "VIEW"))
