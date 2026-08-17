# PRD: Team Collaboration

**Feature:** Team Collaboration & Role-Based Access Control
**Users:** Agency/Team Admin, Creators
**Stack:** Django 5.2, React 19

## Problem Statement
Agencies and larger creator teams need to manage social media across multiple workspaces collaboratively. Currently, a single user account owns a workspace. We need a way to invite team members to a workspace with varying permission levels to prevent accidental deletions or billing changes, and to enforce content approval workflows.
**Success Metrics:**
- >20% of active workspaces have more than one team member invited.
- 100% enforcement of role-based permissions at the API level (0 privilege escalations).

## User Stories & Acceptance Criteria

1. **Workspace Invitations (REQ-TEAM-001)**
   - *Story:* As a Workspace Owner, I want to invite my team members via email so we can collaborate.
   - *Acceptance Criteria:* Owners can send an email invite assigning an `OWNER`, `EDITOR`, or `VIEWER` role. The invited user receives a link to join the workspace.

2. **Role Permissions (REQ-TEAM-002)**
   - *Story:* As a Workspace Owner, I want to restrict what my team members can do.
   - *Acceptance Criteria:* 
     - **OWNER:** Full access (Billing, Deletion, Settings).
     - **EDITOR:** Can create, edit, and schedule posts. Cannot manage billing or delete the workspace.
     - **VIEWER:** Read-only access to posts and analytics.

3. **Content Approval Workflow (REQ-TEAM-003)**
   - *Story:* As an Owner, I want to review content created by Editors before it goes live.
   - *Acceptance Criteria:* Posts created by an `EDITOR` can optionally be flagged to require `OWNER` sign-off. The post remains in a `PENDING_APPROVAL` status and will not be auto-published by the scheduler until approved.

## Scope
- **Ships in v1:** `TeamMembership` data model, Invitation system, Role enforcement via Django permissions, Approval workflow status.
- **Does not ship in v1:** Granular custom roles (e.g., "Analyst" or "Billing Admin" - only sticking to the core 3).

## Data Model Changes
- **[NEW]** `TeamMembership` - Fields: FK Workspace, FK User, `role` (Enum: OWNER/EDITOR/VIEWER).

## Edge Cases & Failure States
- **Orphaned Workspaces:** A workspace must always have at least one OWNER. If the last OWNER attempts to leave, the system must block it.
- **Pending Invites:** Invites sent to non-existent users should create a pending invite record that is claimed upon signup.

## Open Questions
- Should the content approval workflow be strictly enforced for *all* Editors, or is it a toggle setting per workspace?
