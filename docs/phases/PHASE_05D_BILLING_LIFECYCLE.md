# Phase 5D: Billing Lifecycle

## Overview
Phase 5D finalizes the backend billing lifecycle by introducing robust Subscription lifecycle APIs for Workspace Owners and internal Plan management APIs for MASTER Admins.

## Features Implemented
### 1. Internal Admin Plan Management
- **Security Scope**: `IsMasterAdmin` (Strictly MASTER Admins).
- **APIs**:
  - `GET/POST /api/payments/admin/billing/plans/`: List and create Subscription Plans.
  - `PATCH /api/payments/admin/billing/plans/<uuid>/`: Edit Plan details (price, active status).
  - `GET/POST /api/payments/admin/billing/plans/<uuid>/entitlements/`: Manage the strict usage limits per feature.
  - `PATCH /api/payments/admin/billing/entitlements/<uuid>/`: Modify entitlements.

### 2. Workspace Subscription Lifecycle
- **Security Scope**: `IsAuthenticated`, manually verified against `WorkspaceMembership` (Strictly OWNER/ADMIN).
- **APIs**:
  - `POST /api/payments/workspaces/<workspace_id>/subscription/change-plan/`: Used to change the Plan attached to an active Subscription. State transitions are atomic and use `select_for_update()`.
  - `POST /api/payments/workspaces/<workspace_id>/subscription/cancel/`: Safely cancels a Subscription. Marks `cancel_at_period_end = True` (or immediately cancels if in `TRIALING` state) to preserve the paid period.

## Backward Compatibility
- **ClientProfile.tier**: Remains completely untouched. Legacy operations remain functional.
- **PaymentTransactions**: Historical payment behavior has not been modified.

## What was NOT Implemented
- Frontend user interfaces.
- Phase 6 (Admin API).
- Forced migration of historical users to workspaces.
