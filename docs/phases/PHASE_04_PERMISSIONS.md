# Phase 4 Admin Module Permissions

## Overview
This document outlines the Admin Module Permissions implemented in Phase 4. Building upon the Phase 3 foundation (`MASTER`/`ADMIN` separation), Phase 4 provides fine-grained, module-level control for internal staff, strictly separating Admin Console permissions from Workspace-level customer permissions.

## Architecture & Data Model
- **`AdminPermission`**: A relational entity granting an `ADMIN` access to a specific module with specific actions.
  - Fields: `admin_profile`, `module`, `actions` (JSON array), `is_active`.
  - Enforces a unique constraint per `(admin_profile, module)`.
- **`AdminAuditLog`**: An append-only log tracking permission grants, revokes, and updates for compliance.

## Permission Model Principles
- **Default Deny**: New `ADMIN` users possess zero module permissions by default. They can log in but cannot access any functional endpoints until explicitly granted access by a `MASTER`.
- **Master Exemption**: `MASTER` administrators bypass `AdminPermission` checks completely. They retain unrestricted access natively.
- **Strict Matrix**: Modules and Actions are verified against a canonical, server-side dictionary (`MODULE_ACTION_MATRIX`).
  - Example: `USERS` supports `["VIEW", "CREATE", "UPDATE", "DELETE", "SUSPEND", "ACTIVATE"]`.
  - Example: `DASHBOARD` supports only `["VIEW"]`.

## Authorization Enforcement
Authorization is handled entirely server-side via the `HasAdminPermission(module, action)` factory function.
- It rejects unauthenticated traffic (`401`).
- It rejects inactive Admin Profiles (`403`).
- It allows `MASTER` (`200`).
- It allows `ADMIN` only if an active `AdminPermission` record matching the `module` contains the required `action` (`200`/`403`).

## Master Management Endpoints
`MASTER` administrators manage permissions via dedicated endpoints:
- `GET /api/admin/permissions/modules/`: Retrieves the canonical matrix.
- `GET /api/admin/admins/<id>/permissions/`: Retrieves the active permissions for a target admin.
- `PATCH /api/admin/admins/<id>/permissions/`: Updates permissions atomically. Automatically writes an `AdminAuditLog` entry in the same transaction. Cannot be used to modify `MASTER` accounts.

## Migration and Compatibility
- The changes were deployed via backward-compatible migrations (`0004_adminauditlog_adminpermission.py`).
- Existing `MASTER` accounts retained their global privileges.
- Existing `ADMIN` accounts defaulted to zero permissions and require manual provisioning.
- Workspace operations, billing models, and subscription tables remain untouched and segregated.
