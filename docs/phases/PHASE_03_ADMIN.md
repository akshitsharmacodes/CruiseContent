# Phase 3 — Master / Admin

## 1. Objective
Create the internal administrative authorization framework for CruiseContent.

## 2. Why this phase exists
To provide internal staff with a secure, permission-driven console to manage the platform without hardcoding superuser checks.

## 3. Dependencies
Phase 1 (Identity)

## 4. Scope
- MASTER and ADMIN levels.
- Out-of-band Master bootstrap.
- Admin lifecycle management (create, disable, activate, reset, delete).
- Module-based developer-defined permission catalog.
- Permission assignment and revocation by Master.

## 5. Out of scope
- Customer workspace roles.
- Generic enterprise RBAC.

## 6. Business requirements
- Internal operations require secure access to customer data and platform settings.
- Not all internal staff should have full access.

## 7. Functional requirements
- Master cannot be created from the UI.
- Master has implicit full access.
- Admin only receives permissions explicitly granted by Master.
- Admin cannot escalate permissions, modify their own, or manage Master.

## 8. Data/model requirements
- AdminProfile model.
- PermissionDefinition model.
- AdminPermissionAssignment model.

## 9. API requirements where applicable
- Endpoints for Master to manage Admins and assign permissions.

## 10. Frontend requirements where applicable
- (To be implemented in Phase 7)

## 11. Authorization/security requirements
- All internal APIs must verify permissions server-side.
- Master actions must be restricted to Master profile.

## 12. Migration considerations
- Hardcoded superadmin email checks must be removed and replaced with the new AdminProfile.

## 13. Testing requirements
- Privilege escalation prevention tests.
- Permission enforcement tests per module.

## 14. Acceptance criteria
- Master can manage Admins and assign specific module permissions.
- Admins are blocked from unauthorized endpoints.

## 15. Risks
- Accidentally exposing Master endpoints to Admins or Workspace users.

## 16. Completion conditions
- Permission framework active and tested.
