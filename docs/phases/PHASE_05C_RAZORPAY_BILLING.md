# Phase 5C: Razorpay Workspace Billing & Subscription Lifecycle

## Overview
Phase 5C transitions billing from legacy user-centric tiers to workspace-aware subscriptions. We introduce a parallel checkout and verification flow that preserves the existing `PaymentTransaction` integrity and Razorpay interactions while cleanly adopting the new `Workspace` boundary.

## Architecture Highlights
- **Additive Database Schema**: `PaymentTransaction` was enhanced with nullable `workspace` and `subscription_plan` foreign keys. This ensures zero data loss for historical user-based payments.
- **Idempotency**: Retained from the legacy flow. `Idempotency-Key` headers securely prevent users from generating duplicate checkouts for the same intent.
- **Strict Authorization**: `WorkspaceCreateRazorpayOrderView` and `WorkspaceVerifyRazorpayPaymentView` explicitly query `WorkspaceMembership` using the provided `workspace_id`, fully bypassing the UI context `request.user.current_workspace`.
- **Atomic Operations**: All critical subscription updates (creation, verification, webhook delivery) are enclosed in `transaction.atomic()` and use `select_for_update()` to eliminate race conditions.

## API Endpoints (New)
1. `POST /api/payments/workspaces/<workspace_id>/create-order/`
   - Expects `plan_code`. Rejects frontend price/amount tampering.
   - Generates an `order_id` via the Razorpay SDK (or mocked fallback).
2. `POST /api/payments/workspaces/<workspace_id>/verify-payment/`
   - Validates Razorpay signatures.
   - Activates `Subscription` state via `EntitlementService.activate_subscription`.

## Webhook Handling (`order.paid`)
The existing `RazorpayWebhookView` securely routes delivery:
- If the associated `PaymentTransaction` has a `workspace` attached, it follows the new Subscription logic, safely activating the workspace's state.
- If it does NOT have a `workspace` attached, it continues executing the legacy tier upgrade logic, ensuring backwards compatibility for active clients.

## Subscription Lifecycle
Upon successful payment:
- `TRIALING` or `PAST_DUE` Subscriptions are transitioned to `ACTIVE`.
- `current_period_end` is safely extended by either 30 days (`MONTHLY`) or 365 days (`YEARLY`).

## Legacy Compatibility & Migration Strategy
- No destructive migrations were run. Historical `PaymentTransaction` records were explicitly left alone.
- `ClientProfile.tier` operations are unaffected.
- **Future Note**: True data migration (converting historical PRO users to workspace subscriptions) is explicitly deferred to ensure stability.
