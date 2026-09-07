# CruiseContent Architecture Context

## 1. Product Vision

CruiseContent is a multi-tenant SaaS platform for social media/content management.

The long-term product should feel like a polished modern SaaS application.

Use ElevenLabs SaaS as a PRODUCT/UX REFERENCE ONLY:

https://elevenlabs.io/app/home

Do NOT copy its branding or UI.

The reference is only for:
- SaaS application quality
- workspace/account context
- usage visibility
- plan/billing visibility
- settings
- navigation
- polished SaaS information architecture

## 2. Core Architectural Principle

Separate these four concerns:

1. Authentication
   - Who is the user?

2. Workspace Authorization
   - What can the user do inside a Workspace?

3. Product Entitlements
   - What features/limits does the Workspace have?

4. Internal Admin Authorization
   - What can an internal CruiseContent Admin do?

NEVER combine these concepts.

## 3. Identity

Users can authenticate using:

- Google OAuth
- Email/password

A User is a person/account identity.

Do not create duplicate user systems if the existing authentication/user model can be reused.

Authentication credentials and authentication providers are separate from workspace authorization.

## 4. Workspace Model

Workspace is the primary SaaS tenant boundary.

Rules:

- A user can create a Workspace.
- The creator becomes Workspace Owner.
- A user can belong to multiple Workspaces.
- A Workspace has exactly one Owner initially.
- A Workspace can have multiple Members.
- Workspace roles are separate from internal Admin roles.

Initial workspace roles:

- OWNER
- ADMIN
- MEMBER
- VIEWER

Workspace roles control customer-side behavior only.

## 5. Admin Model

There are exactly two internal administrative levels:

MASTER
ADMIN

Master cannot be created from the UI.

The initial Master account is bootstrapped/out-of-band.

MASTER:
- full administrative authority
- can create Admins
- can disable Admins
- can activate Admins
- can reset Admin passwords
- can delete Admins
- can assign/revoke Admin permissions
- can manage plans
- can manage subscriptions
- can manage trials
- can manage entitlements
- can manage workspace overrides
- can view audit logs

ADMIN:
- receives permissions from Master
- has no implicit full access
- cannot create Master
- cannot manage Master
- cannot change their own permissions
- cannot escalate privileges

Master authority is implicit full control.

Do NOT create hundreds of permissions for Master.

## 6. Admin Permissions

Admin permissions are developer-defined.

Master controls which permissions an Admin receives.

Permissions must be module-based.

Example modules:

USERS
WORKSPACES
ADMINS
PLANS
SUBSCRIPTIONS
PAYMENTS
FEATURES
USAGE
PLATFORMS
CONTENT
AUDIT_LOGS
SYSTEM_SETTINGS

Example permission codes:

users.view
users.create
users.edit
users.suspend
users.activate
users.reset_password
users.delete

workspaces.view
workspaces.edit
workspaces.suspend
workspaces.activate
workspaces.delete

plans.view
plans.create
plans.edit
plans.activate
plans.deactivate

subscriptions.view
subscriptions.change_plan
subscriptions.cancel
subscriptions.extend_trial

The final permission catalogue must be based on actual product requirements and repository architecture.

Do not create a generic enterprise RBAC framework.

## 7. Plan vs Subscription

These are different concepts.

PLAN:

A product/package definition.

Example:

PRO
- price
- billing interval
- features
- limits
- default trial days

SUBSCRIPTION:

A Workspace's enrollment in a Plan.

Example:

Workspace: Acme
Plan: PRO
Status: ACTIVE
Period: Aug 1 - Aug 31

A Workspace can have historical subscriptions.

Only one subscription can be the effective/current subscription at a time.

Do NOT put customer-specific subscription state directly on User.

## 8. Trials

Trials are part of Subscription lifecycle.

A Plan may define:

default_trial_days

A specific Workspace subscription may have a different trial period if Master grants an override.

Do not create a separate Trial entity unless future requirements demonstrate that it is necessary.

Example:

Plan:
default_trial_days = 14

Subscription:
trial_start
trial_end
status = TRIALING

Master may grant a Workspace a 30-day trial.

## 9. Features

Feature definitions are developer-controlled.

Examples:

AI_CONTENT_GENERATION
FACEBOOK_PUBLISHING
TWITTER_PUBLISHING
WHATSAPP_PUBLISHING
SCHEDULING
ANALYTICS
TEAM_MEMBERS
API_ACCESS

Do NOT create one hardcoded database boolean column for every feature.

Plans determine which features are available.

## 10. Entitlements

CruiseContent should use a generic entitlement engine.

Entitlements determine:

- whether a Workspace can use a feature
- how much of a resource it can use

Evaluation concept:

Workspace
→ effective Subscription
→ Plan
→ Features/Limits
→ Workspace Overrides
→ Usage
→ ALLOW/DENY

The entitlement engine should become the source of truth for product access.

## 11. Usage

Use a generic usage architecture.

Possible metrics:

POSTS_CREATED
POSTS_PUBLISHED
AI_GENERATIONS
AI_TOKENS
TEAM_MEMBERS
CONNECTED_PLATFORMS
STORAGE
API_REQUESTS

Do not scatter hardcoded plan checks throughout the application.

Usage should be capable of historical tracking.

Prefer a usage-record/ledger architecture over permanently relying only on counters.

Optimization/caching can be introduced later if required.

## 12. Workspace Overrides

Master may provide customer-specific exceptions.

Examples:

- Enable WhatsApp for a Workspace.
- Increase AI generations.
- Increase member limits.
- Give additional usage.

These should not require creating custom Plans.

Use explicit Workspace Feature/Limit Override concepts where appropriate.

## 13. User/Workspace Lifecycle

Do not make destructive deletion the default.

Users should support lifecycle states such as:

ACTIVE
SUSPENDED
DEACTIVATED

Workspaces should support lifecycle states such as:

ACTIVE
SUSPENDED
ARCHIVED

Permanent deletion should be highly restricted and treated separately from normal operational actions.

## 14. Audit Logging

Sensitive Admin actions must be auditable.

Examples:

- Admin created
- Admin disabled
- Admin deleted
- Admin permissions changed
- User suspended
- User activated
- Workspace suspended
- Workspace deleted/archived
- Plan changed
- Subscription changed
- Trial changed
- Entitlement override changed
- Payment/refund action
- System setting changed

Audit records should contain:

- actor
- action
- entity type
- entity ID
- timestamp
- IP address where appropriate
- user agent where appropriate
- safe metadata

NEVER store:
- passwords
- access tokens
- OAuth secrets
- encryption keys
- raw credentials

## 15. Security Principles

Admin authorization MUST be enforced server-side.

Frontend route protection is not sufficient.

Workspace users must never access Admin APIs.

Admin permissions must be checked server-side.

JWT must not become the source of truth for:
- Plan
- Subscription
- Admin permissions
- Workspace permissions

Product authorization should be resolved from server-side state.

Sensitive platform credentials must never be exposed to the frontend.

## 16. Existing Repository First

Before introducing a new model or subsystem:

1. Inspect the existing repository.
2. Determine whether an existing model already represents the concept.
3. Reuse existing models where appropriate.
4. Extend existing models when practical.
5. Avoid duplicate models.
6. Avoid duplicate authentication systems.
7. Avoid unnecessary abstractions.
8. Avoid rewriting working functionality without a clear reason.

Preferred principle:

REUSE > EXTEND > CREATE NEW

Do not follow this blindly if it creates bad architecture. Explain exceptions.

## 17. Current-to-Target Migration

Existing concepts such as:

ClientProfile.tier
ClientProfile.role
current workspace state
existing payment structures

must be investigated before migration.

Do NOT automatically migrate ClientProfile.tier to every Workspace.

The existing architecture may not have had multi-workspace semantics.

Production migration decisions must be based on actual repository/data analysis.

## 18. Implementation Phases

PHASE 0
Architecture and repository audit.

PHASE 1
Identity and authentication foundation.

PHASE 2
Workspace and membership foundation.

PHASE 3
Master/Admin identity and permissions.

PHASE 4
Plans, features and entitlement engine.

PHASE 5
Subscriptions, trials and payments.

PHASE 6
Master Admin backend APIs.

PHASE 7
Master Admin frontend.

PHASE 8
Security hardening and production readiness.

## 19. Current Phase

CURRENT_PHASE = PHASE_0

No implementation should begin until Phase 0 has been reviewed and approved.

## 20. Development Rules

For every future phase:

1. Inspect first.
2. State what already exists.
3. Identify what must change.
4. Identify what can be reused.
5. Propose architecture.
6. Implement only the approved scope.
7. Run tests.
8. Run migrations safely where applicable.
9. Report changed files.
10. Report tests.
11. Report risks.
12. Do not silently expand scope.

Never implement future phases early.

## 21. Decision Log

Maintain a decision log in this document or a linked architecture decision record.

Every major architectural decision should record:

- Decision
- Reason
- Alternatives considered
- Consequences

Do not silently reverse previously approved architectural decisions.

## 22. Agent Instructions

Future AI agents working on CruiseContent must read this file before making architectural changes.

When a future request conflicts with this document:

1. Identify the conflict.
2. Explain it.
3. Do not silently override the architecture.
4. Ask for approval if the change is architectural.
