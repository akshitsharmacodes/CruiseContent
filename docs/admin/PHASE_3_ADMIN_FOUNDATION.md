# Phase 3 Admin Foundation

## Overview
This document outlines the foundation of the CruiseContent internal Admin Console implemented in Phase 3. The architecture establishes a dedicated administrative backend that is rigorously isolated from regular Workspace operations, ensuring that internal staff management does not bleed into customer-facing RBAC.

## Architecture & Data Model
- **`AdminProfile`**: A new model (One-to-One with `User`) specifically built to track administrative access.
- **Admin Levels**:
  - `MASTER`: Ultimate system administrator. Can create, list, modify, and delete `ADMIN` users.
  - `ADMIN`: Standard support/admin staff. (Permissions deferred to Phase 4).
- **Independence**: The Admin Console deliberately avoids modifying or inheriting from `WorkspaceMembership`. A Workspace OWNER does not imply Admin access, and an Admin Console ADMIN does not implicitly have access to any customer Workspace.

## Authentication Flow
The system reuses the existing, production-proven authentication mechanisms:
- **Login (`POST /api/admin/auth/login/`)**: Authenticates via the standard `authenticate()` backend.
- **JWT Reuse**: Issues the exact same JWTs (access and refresh cookies) using `generate_tokens_for_user()`, allowing the frontend to utilize its existing token management libraries without maintaining a parallel JWT infrastructure.
- **Validation**: Enforces that the `User` is active, the `AdminProfile` exists, and the `AdminProfile` is active before yielding tokens.

## API Endpoints
All endpoints are strictly protected server-side by `IsMasterAdmin`:
- `GET /api/admin/admins/`: List all admins.
- `POST /api/admin/admins/`: Create a new `ADMIN` profile. (Automatically issues a password reset/setup email).
- `PATCH /api/admin/admins/<id>/`: Activate or deactivate an `ADMIN`.
- `DELETE /api/admin/admins/<id>/`: Hard-delete an `ADMIN` (revokes access without destroying the underlying `User` account).

## Security Decisions
1. **Server-Side Exclusivity**: Frontend state is completely untrusted. All admin endpoints assert authorization via backend DB queries.
2. **Master Safety**: The API explicitly blocks the creation of `MASTER` accounts to prevent privilege escalation. Existing `MASTER` accounts cannot be deleted through the API.
3. **Safe Serialization**: The API serializes only non-sensitive fields (`id`, `email`, `first_name`, `last_name`, `admin_level`, `is_active`). Passwords and tokens are strictly omitted.

## Known Limitations & Deferred Functionality
- `ADMIN` level accounts currently have no permissions configured; this is deferred to Phase 4.
- Permissions toggles, modules, billing, and dashboard APIs are not implemented.
- Legacy `IsSuperAdminPermission` remains in place for unrelated legacy endpoints but is intentionally excluded from the new `/api/admin/*` routing.
