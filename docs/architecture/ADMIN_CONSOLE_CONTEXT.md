# Admin Console Context

## Core Architectural Principle
**Admin Console RBAC and Workspace RBAC must remain completely independent.**

The CruiseContent platform supports two distinct permission hierarchies that must never be merged, tangled, or implicitly linked:

1. **Workspace Hierarchy** (Customer-facing):
   - `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`
   - Managed via `WorkspaceMembership`.
   - Grants access to a specific tenant/workspace.

2. **Admin Console Hierarchy** (Internal staff):
   - `MASTER`: Ultimate system administrator.
   - `ADMIN`: Internal staff/support.
   - Managed via `AdminProfile`.
   - Grants access to system-level operations across all tenants.

## Strict Rules for Future Agents & Developers

1. **Do not merge RBACs**: A Workspace OWNER must not automatically gain Admin Console access. An Admin Console ADMIN must not automatically gain Workspace ADMIN access.
2. **Master Safety**: `MASTER` accounts cannot be created, promoted, or deleted through the API or UI. They must be provisioned via backend management commands or secure database interventions.
3. **Frontend Untrusted**: Never rely on frontend route guards or state to protect Admin APIs. All `/api/admin/*` endpoints must strictly enforce `IsAdminUser` or `IsMasterAdmin` on the server side.
4. **No Duplicate Authentication**: The Admin Console relies on the identical `authenticate()` backend, JWT generator, and cookie mechanism as the primary application. Do not build a parallel JWT system.
5. **No Credential Exposure**: Admin API serializers must exclusively use an explicit list of safe fields (`id`, `email`, `first_name`, `last_name`, `admin_level`, `is_active`). Never return passwords, JWT secrets, OAuth tokens, API keys, or encrypted credentials.
7. **Phase 4 Module Access**: `ADMIN` accounts are strictly governed by `AdminPermission` records. They have no access by default. Never grant an `ADMIN` implicit access to a module.
8. **Permission Authorization**: Use the dynamic `HasAdminPermission(module, action)` DRF permission class to secure all new Admin Console endpoints.
9. **Server-Side Matrix**: The `MODULE_ACTION_MATRIX` in the backend defines the valid combinations of modules and actions. Never trust a frontend-submitted action without validating it against this canonical matrix.
10. **Plan Management Separation**: Plans, Entitlements, and System Settings are global platform objects and MUST be kept distinct from Workspace roles. Feature codes within entitlements must remain developer-controlled, while the limits and activation statuses are MASTER-controlled.
11. **Centralized Entitlement Service**: All Workspace-level subscription resolution, trial creation, and usage metering MUST occur through the `EntitlementService` to guarantee atomic operations and race-condition safety. Usage limits and access rules must not be reinvented in individual views.
12. **Master Privileges (Phase 5D)**: 
   - Change/reset user passwords.
   - Impersonate users for debugging (Requires explicit ADMIN audit log).
   - **Billing Management**: `MASTER` role has exclusive CRUD control over `Plan` and `PlanEntitlement` via internal Admin APIs (`/api/payments/admin/billing/plans/`).
   - No user-level roles can override this structure.
