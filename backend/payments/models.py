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
