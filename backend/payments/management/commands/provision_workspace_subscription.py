import sys
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
from workspaces.models import Workspace
from payments.models import Subscription, Plan

class Command(BaseCommand):
    help = "Idempotently provisions or updates an active subscription for a target workspace."

    def add_arguments(self, parser):
        parser.add_argument(
            '--workspace',
            type=str,
            default='Gentle Estates Workspace',
            help='Name or UUID of target workspace (default: "Gentle Estates Workspace")'
        )
        parser.add_argument(
            '--plan',
            type=str,
            default='Enterprise All Access',
            help='Plan name or code to attach (default: "Enterprise All Access")'
        )

    def handle(self, *args, **options):
        workspace_arg = options['workspace'].strip()
        plan_arg = options['plan'].strip()

        # 1. Resolve Workspace
        target_ws = None
        # Check if valid UUID
        try:
            ws_uuid = uuid.UUID(workspace_arg)
            target_ws = Workspace.objects.filter(id=ws_uuid).first()
        except ValueError:
            pass

        if not target_ws:
            # Match by exact name or normalized-space / case-insensitive
            target_ws = Workspace.objects.filter(name__iexact=workspace_arg).first()

        if not target_ws:
            # Fallback to normalized space comparison or icontains
            normalized_arg = " ".join(workspace_arg.split()).lower()
            for ws in Workspace.objects.all():
                if " ".join(ws.name.split()).lower() == normalized_arg:
                    target_ws = ws
                    break

        if not target_ws:
            target_ws = Workspace.objects.filter(name__icontains=workspace_arg).first()

        if not target_ws:
            self.stderr.write(self.style.ERROR(f"Workspace matching '{workspace_arg}' was not found."))
            sys.exit(1)

        self.stdout.write(f"Target workspace: '{target_ws.name}' (ID: {target_ws.id})")

        # 2. Resolve Plan
        plan = Plan.objects.filter(
            Q(name__iexact=plan_arg) |
            Q(code__iexact=plan_arg) |
            Q(name__icontains=plan_arg)
        ).filter(is_active=True).first()

        if not plan:
            # Fallback to any active enterprise plan or first active plan
            plan = Plan.objects.filter(name__icontains='Enterprise', is_active=True).first()
            if not plan:
                plan = Plan.objects.filter(is_active=True).first()

        if not plan:
            self.stderr.write(self.style.ERROR("No active Plan found in the system to attach."))
            sys.exit(1)

        self.stdout.write(f"Target plan: '{plan.name}' (Code: {plan.code}, ID: {plan.id})")

        # 3. Idempotently create or update Subscription
        now = timezone.now()
        period_end = now + timedelta(days=365)

        sub, created = Subscription.objects.update_or_create(
            workspace=target_ws,
            defaults={
                'plan': plan,
                'status': 'ACTIVE',
                'current_period_start': now,
                'current_period_end': period_end,
                'cancel_at_period_end': False,
            }
        )

        action_str = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"Successfully {action_str} active subscription (ID: {sub.id}) for workspace '{target_ws.name}' with plan '{plan.name}'."
        ))
