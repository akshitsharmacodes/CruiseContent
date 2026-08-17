# PRD: Payments & Billing Hardening

**Feature:** Payments & Billing Hardening + Subscriptions
**Users:** All Paid Tiers, Workspace Owners
**Stack:** Django 5.2, Razorpay (Stripe planned)

## Problem Statement
The current billing system handles one-off payments and relies solely on client-side signature verification, posing a security risk (spoofed upgrades). Furthermore, the application lacks a recurring `Subscription` data model, preventing automated monthly recurring revenue (MRR) tracking, self-serve cancellations, and invoice generation.
**Success Metrics:**
- 100% of payment verifications handled server-side via webhooks.
- 0 support tickets for missing invoices or failed self-serve cancellations.

## User Stories & Acceptance Criteria

1. **Webhook Authoritative Truth (REQ-PAY-004)**
   - *Story:* As the system, I must verify payments independently of the client to prevent fraud.
   - *Acceptance Criteria:* Razorpay webhooks (`payment.captured`, `payment.failed`, `refund.processed`) update the `PaymentTransaction` state. Signature verification is enforced.

2. **Recurring Subscriptions (REQ-PAY-005)**
   - *Story:* As a user, I want my workspace to auto-renew monthly so my automations don't stop.
   - *Acceptance Criteria:* A new `Subscription` model tracks `plan`, `status` (active/past_due/canceled), `current_period_end`, and `auto_renew` flag.

3. **Plan Upgrades/Downgrades (REQ-PAY-006 & REQ-PAY-007)**
   - *Story:* As a user, I want to upgrade to a higher tier and pay a prorated amount, or cancel my subscription.
   - *Acceptance Criteria:* Upgrading calculates prorated charges. Downgrading/canceling takes effect at the end of the current billing cycle.

4. **Invoice Generation (REQ-PAY-008)**
   - *Story:* As a business user, I need downloadable tax invoices (PDF) for my accounting.
   - *Acceptance Criteria:* Every successful `PaymentTransaction` generates an `Invoice` containing GST/tax line items, downloadable as a PDF.

5. **International Payments (REQ-PAY-010)**
   - *Story:* As an international user, I want to pay in USD via Stripe instead of INR via Razorpay.
   - *Acceptance Criteria:* Integrate Stripe SDK; route payments based on currency/region. (Planned for v2).

## Scope
- **Ships in v1:** Razorpay Webhooks, Subscription data model, Upgrade/Downgrade flows, Invoice generation (PDF), Cancellation.
- **Does not ship in v1:** Stripe integration, automated refund API flows (handled manually via Razorpay dashboard for now).

## Data Model Changes
- **[NEW]** `Subscription` - FK Workspace/User; `plan`, `status`, `current_period_start/end`, `auto_renew`.
- **[NEW]** `Invoice` - FK PaymentTransaction; `pdf_url`, `tax_amount`, `issued_at`.

## Edge Cases & Failure States
- **Failed Webhooks:** Webhook processing must be idempotent to handle retries without duplicate upgrades.
- **Dunning:** Failed recurring payments must trigger a dunning sequence (retry + email) before downgrading to the Free tier.

## Open Questions
- Are Subscriptions strictly scoped to a Workspace, or to a User who distributes quotas among workspaces? (Currently assumed Workspace-scoped for Team Collaboration).
