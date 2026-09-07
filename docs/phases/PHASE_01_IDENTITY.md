# Phase 1 — Identity

## 1. Objective
Solidify the Identity and Authentication foundation.

## 2. Why this phase exists
To ensure a robust, secure authentication system that cleanly separates identity credentials from product entitlements and workspace authorization.

## 3. Dependencies
Phase 0 (Architecture Audit)

## 4. Scope
- Google OAuth integration
- Email/password registration and login
- Password hashing and secure storage
- Password reset flow
- Inactive-user protection
- Authentication and token handling
- Existing-user compatibility
- Authentication tests

## 5. Out of scope
- Workspace creation and roles
- Master/Admin capabilities
- Plan, subscription, and billing implementation

## 6. Business requirements
- Provide users with standard, secure methods to authenticate.
- Ensure existing user accounts continue to function.

## 7. Functional requirements
- Support registration and login via email/password.
- Support Google OAuth login.
- Provide a secure flow for users to reset forgotten passwords.
- Deny access to inactive/suspended users.

## 8. Data/model requirements
- User identity model storing authentication credentials, separated from workspace logic.

## 9. API requirements where applicable
- Endpoints for login, registration, password reset request, and password reset confirmation.

## 10. Frontend requirements where applicable
- Login, registration, forgot password, and reset password screens.

## 11. Authorization/security requirements
- JWT payloads must only contain identity data, not authorization or tier data.
- Passwords must be strongly hashed.

## 12. Migration considerations
- Must not disrupt existing user records or authentication methods.

## 13. Testing requirements
- Automated tests for login, registration, password reset, and token validation.

## 14. Acceptance criteria
- All authentication flows work securely.
- Inactive users are blocked.
- JWTs are clean of workspace/tier data.

## 15. Risks
- Existing frontend logic relying on tier data in JWT may break.

## 16. Completion conditions
- Code deployed and tests passing. Status: IN PROGRESS.
