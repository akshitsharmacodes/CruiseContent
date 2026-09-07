# Phase 5A: Plans, Entitlements and System Settings Foundation

## Overview
Phase 5A establishes the database foundation required to migrate the billing system from a user-centric legacy model to a modern, workspace-aware subscription architecture. 

**Important:** Phase 5A strictly implements the *models only*. It does not interfere with the existing Razorpay checkout flow, nor does it migrate existing `ClientProfile` tiers. This deliberate separation minimizes production risk while paving the way for Phase 5B.

## Architectural Principles
1. **Global Configuration:** Plans and System Settings are global platform objects. They do not belong to workspaces or users.
2. **Developer-Controlled Features vs. Master-Controlled Entitlements:** Feature codes (e.g., `WHATSAPP_INTEGRATION`, `AI_GENERATIONS`) must be statically defined by developers in code. The `MASTER` admin dynamically configures whether those features are enabled and what limits apply via `PlanEntitlement` records in the database.
3. **Database Constraints:** Robust constraints ensure `Plan` codes are globally unique and `PlanEntitlements` are uniquely scoped per plan and feature code, preventing billing conflicts.

## Models Implemented (in `payments` app)

### 1. `Plan`
Defines commercially available SaaS plans.
- **Fields:** `code` (Unique string), `price` (Decimal), `billing_interval` (Monthly/Yearly), `currency`, `is_active`.

### 2. `PlanEntitlement`
Defines what a specific `Plan` allows.
- **Fields:** `plan`, `feature_code`, `enabled`, `limit_value` (nullable), `limit_period` (None, Daily, Monthly, Billing Period).
- **Constraint:** `unique_plan_entitlement(plan, feature_code)`.

### 3. `SystemSetting`
A key-value store for global platform settings, specifically added to support dynamic trial durations without requiring code deployments.
- **Example Usage:** `DEFAULT_TRIAL_DAYS = 30`.

## Why `ClientProfile.tier` Remains Temporarily
Currently, entitlements are resolved via `core/tier_policy.py`, checking `user.profile.tier`. Removing this immediately would severely break production. Phase 5A lays the groundwork so that future phases (5B/C) can implement `WorkspaceSubscriptions`, execute a careful data migration, and finally deprecate `ClientProfile.tier`.
