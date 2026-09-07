import uuid
from django.db import models
from django.conf import settings

class PaymentTransaction(models.Model):
    STATUS_CHOICES = (
        ('INITIATED', 'Initiated'),
        ('PROCESSING', 'Processing'),
        ('SUCCESSFUL', 'Successful'),
        ('FAILED', 'Failed'),
        ('DUPLICATE', 'Duplicate'),
        ('REFUNDED', 'Refunded'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_transactions')
    
    # Target tier for this payment (e.g. 'PRO', 'CREATOR')
    target_tier = models.CharField(max_length=20)
    
    # New Phase 5C Workspace/Plan FKs (nullable for legacy support)
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.SET_NULL, related_name='payment_transactions', null=True, blank=True)
    subscription_plan = models.ForeignKey('Plan', on_delete=models.SET_NULL, related_name='payment_transactions', null=True, blank=True)
    
    # Amount in smallest currency unit (e.g., paise for INR)
    amount = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default='INR')
    
    # Gateway identifiers (Razorpay)
    gateway_order_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_payment_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_signature = models.CharField(max_length=255, blank=True, null=True)
    
    # Status and idempotency tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INITIATED')
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.target_tier} - {self.status}"

class Plan(models.Model):
    BILLING_INTERVAL_CHOICES = (
        ('MONTHLY', 'Monthly'),
        ('YEARLY', 'Yearly'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    billing_interval = models.CharField(max_length=20, choices=BILLING_INTERVAL_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

class PlanEntitlement(models.Model):
    LIMIT_PERIOD_CHOICES = (
        ('NONE', 'None'),
        ('DAILY', 'Daily'),
        ('MONTHLY', 'Monthly'),
        ('BILLING_PERIOD', 'Billing Period'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='entitlements')
    feature_code = models.CharField(max_length=100)
    enabled = models.BooleanField(default=True)
    limit_value = models.IntegerField(null=True, blank=True)
    limit_period = models.CharField(max_length=20, choices=LIMIT_PERIOD_CHOICES, default='NONE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['plan', 'feature_code'], name='unique_plan_entitlement')
        ]

    def __str__(self):
        return f"{self.plan.code} - {self.feature_code}"

class SystemSetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True)
    value = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key

class Subscription(models.Model):
    STATUS_CHOICES = (
        ('TRIALING', 'Trialing'),
        ('ACTIVE', 'Active'),
        ('PAST_DUE', 'Past Due'),
        ('CANCELED', 'Canceled'),
        ('EXPIRED', 'Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField('workspaces.Workspace', on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.workspace.name} - {self.plan.code} - {self.status}"

class UsageRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='usage_records')
    feature_code = models.CharField(max_length=100)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    usage_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'feature_code', 'period_start', 'period_end'], name='unique_usage_record')
        ]

    def __str__(self):
        return f"{self.workspace.name} - {self.feature_code}: {self.usage_count}"
