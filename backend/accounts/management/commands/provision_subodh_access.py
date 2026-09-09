import sys
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import AdminProfile, AdminPermission, AdminWorkspaceAssignment
from workspaces.software_registry import SOFTWARE_FEATURE_REGISTRY
from workspaces.models import Workspace
from payments.models import Subscription, Plan, PlanEntitlement

User = get_user_model()

TARGET_SOFTWARE_MODULES = [
    "WHATSAPP_CAMPAIGN",
    "WHATSHOOK",
    "AI_CALLING",
    "CHATBOT",
    "DATEXT",
    "SOCIAL_MEDIA_MANAGER",
    "SHARE_AND_CARE",
]

INFRASTRUCTURE_MODULES = {
    "WORKSPACES": ["VIEW", "CREATE", "UPDATE", "SUSPEND", "ACTIVATE", "ARCHIVE"],
    "USERS": ["VIEW", "CREATE", "UPDATE", "SUSPEND", "ACTIVATE", "DEACTIVATE"],
    "ROLES": ["VIEW", "CREATE", "UPDATE", "DELETE"],
    "MEMBERSHIPS": ["VIEW", "ASSIGN", "REMOVE"],
}

class Command(BaseCommand):
    help = "Idempotently provisions delegated infrastructure and software permissions for manager ADMIN Subodh"

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='subodh.moudgil@gmail.com',
            help='Email of the manager ADMIN account'
        )
        parser.add_argument(
            '--workspace',
            type=str,
            default='LeadManch Demo',
            help='Explicit target testing workspace to verify/provision'
        )

    def handle(self, *args, **options):
        email = options['email']
        workspace_name = options['workspace']

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            self.stderr.write(self.style.ERROR(f"User with email '{email}' does not exist."))
            sys.exit(1)

        admin_profile = getattr(user, 'admin_profile', None)
        if not admin_profile:
            self.stderr.write(self.style.ERROR(f"User '{email}' does not have an AdminProfile."))
            sys.exit(1)

        if admin_profile.admin_level != 'ADMIN':
            self.stderr.write(self.style.ERROR(f"User '{email}' has admin_level='{admin_profile.admin_level}', expected 'ADMIN'. Aborting."))
            sys.exit(1)

        self.stdout.write(f"Verified ADMIN identity for {user.email} (Level: {admin_profile.admin_level}).")

        # 1. Provision canonical INFRASTRUCTURE_MODULES permissions
        infra_provisioned = []
        for mod_code, actions in INFRASTRUCTURE_MODULES.items():
            sorted_actions = sorted(list(actions), key=lambda x: (0 if x == 'VIEW' else 1, x))

            perm, created = AdminPermission.objects.get_or_create(
                admin_profile=admin_profile,
                module=mod_code,
                defaults={'actions': sorted_actions, 'is_active': True}
            )
            if not created:
                perm.actions = sorted_actions
                perm.is_active = True
                perm.save(update_fields=['actions', 'is_active', 'updated_at'])

            infra_provisioned.append((mod_code, sorted_actions, "Created" if created else "Updated"))

        self.stdout.write(self.style.SUCCESS(f"Successfully provisioned {len(infra_provisioned)} infrastructure module permissions for {user.email}:"))
        for code, acts, status_str in infra_provisioned:
            self.stdout.write(f"  - [{status_str}] {code}: {acts}")

        # 2. Enumerate actions from canonical SOFTWARE_FEATURE_REGISTRY and provision AdminPermission
        provisioned = []
        for sw_code in TARGET_SOFTWARE_MODULES:
            if sw_code not in SOFTWARE_FEATURE_REGISTRY:
                self.stderr.write(self.style.WARNING(f"Software '{sw_code}' not found in registry. Skipping."))
                continue

            sw_data = SOFTWARE_FEATURE_REGISTRY[sw_code]
            actions_set = set()
            for feat_code, feat_data in sw_data.get("features", {}).items():
                for act in feat_data.get("actions", []):
                    actions_set.add(act)

            sorted_actions = sorted(list(actions_set), key=lambda x: (0 if x == 'VIEW' else 1, x))

            perm, created = AdminPermission.objects.get_or_create(
                admin_profile=admin_profile,
                module=sw_code,
                defaults={'actions': sorted_actions, 'is_active': True}
            )
            if not created:
                perm.actions = sorted_actions
                perm.is_active = True
                perm.save(update_fields=['actions', 'is_active', 'updated_at'])

            provisioned.append((sw_code, sorted_actions, "Created" if created else "Updated"))

        self.stdout.write(self.style.SUCCESS(f"Successfully provisioned {len(provisioned)} software module permissions for {user.email}:"))
        for code, acts, status_str in provisioned:
            self.stdout.write(f"  - [{status_str}] {code}: {acts}")

        # 3. Verify target testing workspace subscription and entitlements
        if workspace_name:
            target_ws = Workspace.objects.filter(name__iexact=workspace_name).first()
            if target_ws:
                # Ensure workspace is assigned to admin in AdminWorkspaceAssignment
                assignment, ass_created = AdminWorkspaceAssignment.objects.get_or_create(
                    admin_profile=admin_profile,
                    workspace=target_ws,
                    defaults={'max_users': 10}
                )
                if ass_created:
                    self.stdout.write(self.style.SUCCESS(f"Assigned workspace '{target_ws.name}' to {user.email} in AdminWorkspaceAssignment."))
                else:
                    self.stdout.write(f"Workspace '{target_ws.name}' is assigned to {user.email} (max_users={assignment.max_users}).")

                # Verify subscription
                sub = Subscription.objects.filter(workspace=target_ws, status='ACTIVE').first()
                if not sub:
                    # Find or attach Enterprise plan
                    enterprise_plan = Plan.objects.filter(name__icontains='Enterprise').first()
                    if enterprise_plan:
                        sub, sub_created = Subscription.objects.update_or_create(
                            workspace=target_ws,
                            defaults={'plan': enterprise_plan, 'status': 'ACTIVE'}
                        )
                        self.stdout.write(self.style.SUCCESS(f"Provisioned Enterprise subscription for testing workspace '{target_ws.name}'."))
                else:
                    self.stdout.write(f"Testing workspace '{target_ws.name}' has active subscription: {sub.plan.name}.")
            else:
                self.stdout.write(self.style.WARNING(f"Specified workspace '{workspace_name}' was not found."))

        self.stdout.write(self.style.SUCCESS("Provisioning completed successfully."))
