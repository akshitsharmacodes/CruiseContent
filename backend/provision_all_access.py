import os
import django
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from payments.models import Plan, PlanEntitlement, Subscription
from workspaces.models import Workspace
from workspaces.software_registry import SOFTWARE_FEATURE_REGISTRY

def provision_all_access():
    plan, created = Plan.objects.get_or_create(
        code='ENTERPRISE_ALL_ACCESS',
        defaults={
            'name': 'Enterprise All Access',
            'description': 'Full access to all platform software modules and features.',
            'price': 99.00,
            'currency': 'INR',
            'billing_interval': 'MONTHLY',
            'is_active': True
        }
    )
    print(f"Plan: {plan.name} (Created: {created})")

    # Add all software module codes and their granular features
    all_software_codes = list(SOFTWARE_FEATURE_REGISTRY.keys())
    for sw_code, sw_meta in SOFTWARE_FEATURE_REGISTRY.items():
        # Top-level software entitlement
        ent, _ = PlanEntitlement.objects.get_or_create(
            plan=plan,
            feature_code=sw_code,
            defaults={'enabled': True}
        )
        if not ent.enabled:
            ent.enabled = True
            ent.save()

        # Granular features
        for feat_code in sw_meta.get('features', {}).keys():
            feat_ent, _ = PlanEntitlement.objects.get_or_create(
                plan=plan,
                feature_code=feat_code,
                defaults={'enabled': True}
            )
            if not feat_ent.enabled:
                feat_ent.enabled = True
                feat_ent.save()

    print(f"Entitled all software modules: {all_software_codes}")

    User = get_user_model()
    u = User.objects.filter(email='akshitsharmacodes@gmail.com').first()
    if u:
        workspaces = Workspace.objects.filter(memberships__user=u)
        for ws in workspaces:
            sub, sub_created = Subscription.objects.update_or_create(
                workspace=ws,
                defaults={
                    'plan': plan,
                    'status': 'ACTIVE',
                    'current_period_start': timezone.now(),
                    'current_period_end': timezone.now() + timedelta(days=365)
                }
            )
            print(f"Activated subscription for workspace '{ws.name}'")

    print("\nSUCCESS: All software entitlements and active subscriptions provisioned!")

if __name__ == '__main__':
    provision_all_access()
