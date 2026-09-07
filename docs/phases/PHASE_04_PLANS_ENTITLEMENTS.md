# Phase 4 — Plans / Features / Entitlements

## 1. Objective
Implement a generic, scalable entitlement engine for the product.

## 2. Why this phase exists
To decouple product capabilities from hardcoded application logic, allowing dynamic plan creation and workspace-specific exceptions.

## 3. Dependencies
Phase 2 (Workspace), Phase 3 (Admin)

## 4. Scope
- Plan and Feature definitions.
- Usage metrics and limits.
- Generic entitlement evaluation engine.
- Workspace-specific feature and limit overrides.

## 5. Out of scope
- Billing integration (Phase 5).
- Custom plans per customer (unless using overrides).

## 6. Business requirements
- Must be able to package features and limits into Plans.
- Master must be able to grant specific workspaces extra limits or features without creating custom plans.

## 7. Functional requirements
- Developer controls feature definitions in code/DB.
- Master controls plan availability and configuration.
- Entitlement flow evaluates: Workspace -> Subscription -> Plan -> Features/Limits -> Overrides -> Usage -> ALLOW/DENY.

## 8. Data/model requirements
- PLAN, FEATURE, PLAN_FEATURE, PLAN_LIMIT, USAGE_METRIC, USAGE_RECORD.
- WORKSPACE_FEATURE_OVERRIDE, WORKSPACE_LIMIT_OVERRIDE.

## 9. API requirements where applicable
- Internal APIs for entitlement checks.
- Admin APIs to manage plans and overrides.

## 10. Frontend requirements where applicable
- UI to display available features and limits based on entitlement engine.

## 11. Authorization/security requirements
- Only authorized Admins can modify plans or overrides.

## 12. Migration considerations
- Hardcoded tier checks in the codebase must be replaced by calls to the generic entitlement engine.

## 13. Testing requirements
- Extensive unit tests for the entitlement engine logic (ALLOW/DENY boundaries).

## 14. Acceptance criteria
- Entitlement engine accurately reflects plan limits, current usage, and workspace overrides.

## 15. Risks
- Performance bottleneck if entitlement checks are slow on every request.

## 16. Completion conditions
- All hardcoded plan logic replaced by the entitlement engine.
