# Phase 2 — Workspace

## 1. Objective
Establish the primary SaaS tenant boundary through the Workspace model.

## 2. Why this phase exists
To support multi-tenancy by allowing users to create, manage, and switch between multiple isolated workspaces with specific roles.

## 3. Dependencies
Phase 1 (Identity)

## 4. Scope
- Multiple workspace creation per user
- User membership in multiple workspaces
- Workspace isolation
- Workspace roles (OWNER, ADMIN, MEMBER, VIEWER)
- Membership lifecycle and invitations
- Workspace switching mechanism

## 5. Out of scope
- Admin Console permissions
- Billing and subscriptions

## 6. Business requirements
- Customers must be able to organize their work into distinct workspaces.
- Customers must be able to invite team members with restricted roles.

## 7. Functional requirements
- The creator of a workspace automatically becomes its OWNER.
- A workspace has exactly one OWNER initially.
- A workspace can have multiple members with various roles.
- Users can switch their active workspace context.

## 8. Data/model requirements
- Workspace model.
- WorkspaceMembership model linking User to Workspace with a role.

## 9. API requirements where applicable
- Endpoints for creating workspaces, inviting users, updating roles, and switching context.

## 10. Frontend requirements where applicable
- Workspace selector UI.
- Team management UI (invite, remove, change role).

## 11. Authorization/security requirements
- Strict isolation: users must only access data belonging to their active workspace.
- Workspace roles must remain completely separate from Admin Console permissions.

## 12. Migration considerations
- Existing users with legacy many-to-many workspace relations must be migrated to the new membership model, designating owners appropriately.

## 13. Testing requirements
- Tests for cross-workspace isolation.
- Tests for role-based access control within a workspace.

## 14. Acceptance criteria
- Users can seamlessly create and switch workspaces.
- Workspace members can only perform actions permitted by their role.

## 15. Risks
- Data leakage between workspaces if isolation is not strictly enforced in all queries.

## 16. Completion conditions
- Workspace isolation proven via tests.
