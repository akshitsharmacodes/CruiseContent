# Phase 5B: Workspace Subscriptions and Usage Metering

## Overview
Phase 5B implements the operational logic for Workspace-level Subscriptions, Trial handling, Entitlement resolution, and Usage metering. It securely centralizes all entitlement checks in a dedicated service while maintaining strict backward compatibility with legacy Razorpay flows and `ClientProfile.tier`.

## Architecture & Data Models
- **`Subscription`**: Replaces user-level billing with a Workspace-level OneToOne mapping to a `Plan`. Tracks the `status`, `current_period_start/end`, and `trial_start/end`.
- **`UsageRecord`**: Workspace-scoped metering. Unique constrained by `(workspace, feature_code, period_start, period_end)` to prevent duplicate records for the same time window.

## Core Mechanisms

### 1. Centralized Entitlement Service (`payments.services.EntitlementService`)
All subscription and usage decisions flow through this service to guarantee consistent and atomic behavior.

### 2. Race-Safe Trial Creation
Trial creation is triggered transparently via `get_active_subscription()` if no subscription exists.
- **Fail-Safe Config**: It requires an explicit `SystemSetting` (`DEFAULT_TRIAL_DAYS`) and an explicit `Plan` (`code='FREE_TRIAL'`). If either is missing, it aborts safely rather than inventing a fallback.
- **Atomic Execution**: Wraps the `get_or_create` logic in a `transaction.atomic()` block and catches `IntegrityError` to safely resolve concurrent requests trying to create the same workspace trial.

### 3. Entitlement Resolution Rules
- `enabled = False`: Feature strictly denied.
- `limit_value = None`: Feature enabled, strictly unlimited.
- `limit_period`: Maps usage to `DAILY`, `MONTHLY`, or `BILLING_PERIOD` timezone-aware bounding boxes.

### 4. Race-Safe Usage Metering
`record_usage` guarantees that limits cannot be bypassed under heavy load.
- It calculates the precise bounding box for the `limit_period`.
- Uses `select_for_update()` to exclusively lock the usage row during the transaction.
- Increments using Django's atomic `F()` expressions.

### 5. Workspace Isolation APIs
New APIs (`/api/workspaces/<id>/subscription/` and `/api/workspaces/<id>/usage/`) strictly rely on `HasWorkspaceRole` and the `WorkspaceMembership` table, explicitly refusing to trust the ephemeral `user.current_workspace` UI context.

## Legacy Compatibility and Migration Deferral
Phase 5B intentionally leaves the legacy billing path 100% operational.
- Existing `PaymentTransaction` records continue to use `ClientProfile.tier`.
- No historical data was assigned to a Workspace.
- `core/tier_policy.py` remains active for the legacy endpoints.
- **Phase 5C Prerequisites**: Phase 5C must wire up the Razorpay webhooks to update the new Workspace `Subscription` instead of the User tier, and handle the one-time data migration for users upgrading existing accounts.
