from django.urls import path
from .views import (
    CreateRazorpayOrderView, VerifyRazorpayPaymentView, RazorpayWebhookView,
    WorkspaceSubscriptionView, WorkspaceUsageView,
    WorkspaceCreateRazorpayOrderView, WorkspaceVerifyRazorpayPaymentView,
    WorkspaceChangePlanView, WorkspaceCancelSubscriptionView
)
from .admin_console_views import (
    AdminPlanManagementView,
    AdminPlanEntitlementManagementView,
    AdminSubscriptionManagementView,
    AdminSubscriptionCancelView,
)

urlpatterns = [
    path('create-order/', CreateRazorpayOrderView.as_view(), name='create_razorpay_order'),
    path('verify/', VerifyRazorpayPaymentView.as_view(), name='verify_razorpay_payment'),
    path('webhook/', RazorpayWebhookView.as_view(), name='razorpay_webhook'),
    
    # Phase 5B Workspace APIs
    path('workspaces/<uuid:workspace_id>/subscription/', WorkspaceSubscriptionView.as_view(), name='workspace_subscription'),
    path('workspaces/<uuid:workspace_id>/usage/', WorkspaceUsageView.as_view(), name='workspace_usage'),
    
    # Phase 5C Workspace Checkout APIs
    path('workspaces/<uuid:workspace_id>/create-order/', WorkspaceCreateRazorpayOrderView.as_view(), name='workspace_create_order'),
    path('workspaces/<uuid:workspace_id>/verify-payment/', WorkspaceVerifyRazorpayPaymentView.as_view(), name='workspace_verify_payment'),
    
    # Phase 5D Workspace Lifecycle APIs
    path('workspaces/<uuid:workspace_id>/subscription/change-plan/', WorkspaceChangePlanView.as_view(), name='workspace_change_plan'),
    path('workspaces/<uuid:workspace_id>/subscription/cancel/', WorkspaceCancelSubscriptionView.as_view(), name='workspace_cancel_subscription'),
    
    # Phase 5D & 8.4 Admin Plan APIs
    path('admin/billing/plans/', AdminPlanManagementView.as_view(), name='admin_plans'),
    path('admin/billing/plans/<uuid:plan_id>/', AdminPlanManagementView.as_view(), name='admin_plan_detail'),
    path('admin/billing/plans/<uuid:plan_id>/entitlements/', AdminPlanEntitlementManagementView.as_view(), name='admin_plan_entitlements'),
    path('admin/billing/entitlements/<uuid:entitlement_id>/', AdminPlanEntitlementManagementView.as_view(), name='admin_entitlement_detail'),

    # Stage 9.2 Admin Subscription APIs
    path('admin/subscriptions/', AdminSubscriptionManagementView.as_view(), name='admin_subscriptions'),
    path('admin/subscriptions/<uuid:subscription_id>/', AdminSubscriptionManagementView.as_view(), name='admin_subscription_detail'),
    path('admin/subscriptions/<uuid:subscription_id>/cancel/', AdminSubscriptionCancelView.as_view(), name='admin_subscription_cancel'),
]
