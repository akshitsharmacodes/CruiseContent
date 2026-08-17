# PRD: Content Calendar & Scheduling

**Feature:** Content Calendar & Scheduling
**Users:** All User Tiers (Free/Starter, Pro, Agency)
**Stack:** React 19, Vite, Tailwind, shadcn/ui, Django 5.2, Celery, Redis

## Problem Statement
Users need the ability to plan their content distribution over time rather than publishing everything immediately. A visual calendar helps creators align their social media output with marketing campaigns, ensuring consistent engagement without manual daily effort. 
**Success Metrics:** 
- >60% of all generated posts are scheduled rather than published immediately.
- 0% failure rate for timely execution of scheduled posts.

## User Stories & Acceptance Criteria

1. **Visual Calendar View**
   - *Story:* As a user, I want to see a week/month view of my posts so I can understand my content distribution.
   - *Acceptance Criteria:* The UI provides a Calendar component displaying all `GeneratedPost` records for the current workspace. Posts are color-coded by status (DRAFT, APPROVED, SUCCESS, FAILED).

2. **Drag-and-Drop Rescheduling**
   - *Story:* As a user, I want to easily change a post's scheduled date by dragging it on the calendar.
   - *Acceptance Criteria:* Dragging a post to a new date updates the `scheduled_for` timestamp via API and immediately reflects in the UI. 

3. **Validation & Safeguards**
   - *Story:* As a user, I want the system to prevent me from scheduling posts in the past.
   - *Acceptance Criteria:* The UI and API reject any `scheduled_for` timestamp that is `< datetime.now()`.

4. **Automated Publishing (Backend)**
   - *Story:* As a user, I want my scheduled posts to publish automatically at the exact time without my intervention.
   - *Acceptance Criteria:* A Celery Beat task runs periodically (e.g., every minute) to query `GeneratedPost` where `scheduled_for <= now()` and `status == APPROVED`. It enqueues the publish task and updates the status to PENDING.

## Scope
- **Ships in v1:** Visual calendar (month/week views), drag-and-drop rescheduling, Celery Beat polling for execution, timezone awareness.
- **Does not ship in v1:** Recurring posting schedules (e.g., "every Tuesday"), bulk queueing slots (e.g., "Buffer-style" time slots).

## Data Model Changes
- The field `GeneratedPost.scheduled_for` already exists. 
- Ensure `status` field strictly transitions: `DRAFT` -> `APPROVED` (eligible for schedule) -> `PENDING` (publishing) -> `SUCCESS` or `FAILED`.

## Edge Cases & Failure States
- **Downtime:** If the Celery Beat worker goes down, the system should catch up and publish all missed posts (where `scheduled_for <= now()`) upon restart.
- **Approval Gate:** If a post is scheduled but left in `DRAFT` status (REQ-SAFE-002), the system must skip it and not auto-publish.
- **Rate Limits:** If a scheduled post triggers third-party API rate limits, it should fall back to the existing exponential backoff queue.

## Open Questions
- What is the default timezone behavior for the calendar? Does the backend store all times in UTC and the frontend converts to the browser's local timezone?
- What granularity should the scheduling have? (e.g., 5-minute increments).
