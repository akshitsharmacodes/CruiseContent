# Phase 7 — Admin UI

## 1. Objective
Build a modern SaaS Admin Console.

## 2. Why this phase exists
To provide a polished, efficient interface for internal staff to manage the platform.

## 3. Dependencies
Phase 6 (Admin API)

## 4. Scope
- Navigation (Overview, Users, Workspaces, Admins, Plans, Features, Subscriptions, Payments, Usage, Platforms, Content, Audit Logs, Settings).
- Tables, search, filtering, detail pages.
- Actions, confirmation dialogs, status indicators.
- Permission management UI.

## 5. Out of scope
- Customer-facing dashboard UI.

## 6. Business requirements
- The interface must feel like a premium SaaS application (reference: ElevenLabs UX).

## 7. Functional requirements
- Master and Admin must see only what their permissions allow (UI must dynamically hide unauthorized sections).

## 8. Data/model requirements
- N/A (Frontend only).

## 9. API requirements where applicable
- Consumes Phase 6 APIs.

## 10. Frontend requirements where applicable
- Responsive, accessible, and fast UI built with standard frameworks.

## 11. Authorization/security requirements
- Do not expose sensitive data in the UI unnecessarily.

## 12. Migration considerations
- Replace any existing rudimentary admin panels.

## 13. Testing requirements
- E2E tests for critical admin flows.

## 14. Acceptance criteria
- Admin console is fully functional and accurately reflects permissions.

## 15. Risks
- UI state diverging from actual backend permissions.

## 16. Completion conditions
- Admin console deployed and usable by operations team.
