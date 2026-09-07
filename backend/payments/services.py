import logging
from datetime import timedelta
from django.utils import timezone
from django.db import transaction, IntegrityError
from django.db.models import F
from .models import Subscription, Plan, PlanEntitlement, SystemSetting, UsageRecord

logger = logging.getLogger(__name__)

class EntitlementService:
    @staticmethod
    def get_active_subscription(workspace):
        """
        Retrieves the active subscription for a workspace.
        If none exists, attempts to create a trial subscription safely.
        """
        # Quick check without locking
        sub = Subscription.objects.filter(workspace=workspace).first()
        if sub:
            return sub

        # Attempt to create trial safely
        return EntitlementService._create_trial_subscription(workspace)

    @staticmethod
    def _create_trial_subscription(workspace):
        try:
            trial_days_str = SystemSetting.objects.get(key='DEFAULT_TRIAL_DAYS').value
            trial_days = int(trial_days_str)
            if trial_days <= 0:
                raise ValueError("Trial days must be positive")
        except (SystemSetting.DoesNotExist, ValueError) as e:
            logger.error(f"Failed to create trial for workspace {workspace.id}: Invalid or missing DEFAULT_TRIAL_DAYS setting. Error: {e}")
            return None

        # Look for explicit FREE_TRIAL plan
        plan = Plan.objects.filter(code='FREE_TRIAL', is_active=True).first()
        if not plan:
            logger.error(f"Failed to create trial for workspace {workspace.id}: No active FREE_TRIAL plan found.")
            return None

        now = timezone.now()
        trial_end = now + timedelta(days=trial_days)

        try:
            with transaction.atomic():
                sub, created = Subscription.objects.get_or_create(
                    workspace=workspace,
                    defaults={
                        'plan': plan,
                        'status': 'TRIALING',
                        'trial_start': now,
                        'trial_end': trial_end,
                        'current_period_start': now,
                        'current_period_end': trial_end
                    }
                )
                return sub
        except IntegrityError:
            # Race condition: another request created it just now
            return Subscription.objects.get(workspace=workspace)

    @staticmethod
    def activate_subscription(workspace, plan):
        now = timezone.now()
        
        if plan.billing_interval == 'YEARLY':
            period_end = now + timedelta(days=365)
        else: # MONTHLY
            period_end = now + timedelta(days=30)
            
        with transaction.atomic():
            # Get or create safely
            sub, created = Subscription.objects.get_or_create(
                workspace=workspace,
                defaults={
                    'plan': plan,
                    'status': 'ACTIVE',
                    'current_period_start': now,
                    'current_period_end': period_end
                }
            )
            
            # If existed but was trailing or past due, we lock and update it
            if not created:
                sub = Subscription.objects.select_for_update().get(id=sub.id)
                sub.plan = plan
                sub.status = 'ACTIVE'
                sub.current_period_start = now
                sub.current_period_end = period_end
                sub.save()
                
            return sub

    @staticmethod
    def change_subscription_plan(workspace, new_plan):
        # NOTE: This endpoint strictly updates the state if the transition is allowed.
        # Payment verification and enforcement is expected to have occurred before this point if upgrading to a paid plan.
        with transaction.atomic():
            sub = EntitlementService.get_active_subscription(workspace)
            if not sub:
                raise ValueError("No active subscription found to change.")
                
            sub = Subscription.objects.select_for_update().get(id=sub.id)
            if sub.status in ['CANCELED', 'EXPIRED']:
                raise ValueError(f"Cannot change plan for a {sub.status} subscription.")
                
            sub.plan = new_plan
            # Reset cancellation state if they downgrade/upgrade
            sub.cancel_at_period_end = False
            sub.canceled_at = None
            sub.save()
            return sub

    @staticmethod
    def cancel_subscription(workspace):
        with transaction.atomic():
            sub = EntitlementService.get_active_subscription(workspace)
            if not sub:
                raise ValueError("No active subscription found to cancel.")
                
            sub = Subscription.objects.select_for_update().get(id=sub.id)
            if sub.status in ['CANCELED', 'EXPIRED']:
                raise ValueError(f"Subscription is already {sub.status}.")
                
            # If trial, cancel immediately since no paid period to honor.
            if sub.status == 'TRIALING':
                sub.status = 'CANCELED'
                sub.canceled_at = timezone.now()
                sub.save()
                return sub
                
            # If ACTIVE, cancel at period end
            if not sub.cancel_at_period_end:
                sub.cancel_at_period_end = True
                sub.canceled_at = timezone.now()
                sub.save()
                
            return sub

    @staticmethod
    def get_workspace_entitlement(workspace, feature_code):
        sub = EntitlementService.get_active_subscription(workspace)
        if not sub or sub.status not in ['TRIALING', 'ACTIVE']:
            return None
        
        return PlanEntitlement.objects.filter(plan=sub.plan, feature_code=feature_code, enabled=True).first()

    @staticmethod
    def workspace_has_feature(workspace, feature_code):
        return EntitlementService.get_workspace_entitlement(workspace, feature_code) is not None

    @staticmethod
    def get_feature_limit(workspace, feature_code):
        entitlement = EntitlementService.get_workspace_entitlement(workspace, feature_code)
        if not entitlement:
            return 0 # implicitly zero limit if not enabled
        return entitlement.limit_value

    @staticmethod
    def _get_period_bounds(entitlement, sub):
        now = timezone.now()
        if entitlement.limit_period == 'DAILY':
            return now.replace(hour=0, minute=0, second=0, microsecond=0), now.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif entitlement.limit_period == 'MONTHLY':
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # simplistic month end for prototype; typically would use dateutil or similar
            if start.month == 12:
                end = start.replace(year=start.year + 1, month=1) - timedelta(microseconds=1)
            else:
                end = start.replace(month=start.month + 1) - timedelta(microseconds=1)
            return start, end
        elif entitlement.limit_period == 'BILLING_PERIOD':
            return sub.current_period_start or now, sub.current_period_end or now
        return now, now # NONE or fallback

    @staticmethod
    def get_usage(workspace, feature_code):
        entitlement = EntitlementService.get_workspace_entitlement(workspace, feature_code)
        if not entitlement or entitlement.limit_period == 'NONE':
            return 0

        sub = EntitlementService.get_active_subscription(workspace)
        if not sub:
            return 0

        start, end = EntitlementService._get_period_bounds(entitlement, sub)
        record = UsageRecord.objects.filter(workspace=workspace, feature_code=feature_code, period_start=start, period_end=end).first()
        return record.usage_count if record else 0

    @staticmethod
    def check_usage_limit(workspace, feature_code, amount=1):
        entitlement = EntitlementService.get_workspace_entitlement(workspace, feature_code)
        if not entitlement:
            return False
            
        if entitlement.limit_value is None:
            return True # Unlimited
            
        if entitlement.limit_period == 'NONE':
            return True # Not metered
            
        current_usage = EntitlementService.get_usage(workspace, feature_code)
        return (current_usage + amount) <= entitlement.limit_value

    @staticmethod
    def record_usage(workspace, feature_code, amount=1):
        entitlement = EntitlementService.get_workspace_entitlement(workspace, feature_code)
        if not entitlement or entitlement.limit_period == 'NONE':
            return True # Nothing to record
            
        sub = EntitlementService.get_active_subscription(workspace)
        if not sub:
            return False

        start, end = EntitlementService._get_period_bounds(entitlement, sub)
        
        with transaction.atomic():
            # Get or create the record safely
            record, created = UsageRecord.objects.get_or_create(
                workspace=workspace,
                feature_code=feature_code,
                period_start=start,
                period_end=end,
                defaults={'usage_count': 0}
            )
            
            # Lock the row for update
            record = UsageRecord.objects.select_for_update().get(id=record.id)
            
            if entitlement.limit_value is not None:
                if record.usage_count + amount > entitlement.limit_value:
                    return False # Exceeds limit
            
            record.usage_count = F('usage_count') + amount
            record.save(update_fields=['usage_count', 'updated_at'])
            return True
