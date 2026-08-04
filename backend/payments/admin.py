from django.contrib import admin
from .models import PaymentTransaction

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'target_tier', 'amount', 'currency', 'status', 'created_at')
    search_fields = ('user__email', 'razorpay_order_id', 'razorpay_payment_id', 'idempotency_key')
    list_filter = ('status', 'target_tier', 'currency')
    readonly_fields = ('id', 'created_at', 'updated_at', 'idempotency_key')
