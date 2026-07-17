# Billing & Monetization — architecture

_Last updated: 2026-07-17. Audience: agents and developers working on billing._

## The model (one sentence)

**Everything is free; a subscription ($4/employee/month, superadmin-editable
at `platform/packagesConfig`) unlocks exactly one action: finalizing a payroll
run.** Reports, exports, and compliance filings are never gated — they are the
deliverable of the run the tenant paid for.

## What "subscribed" means

`isTenantSubscribed()` in `client/lib/packagePricing.ts` — the single source
of truth, mirrored by `tenantHasActiveSubscription()` in `firestore.rules`
(keep the two in sync). Two ways to qualify:

| Path | Condition |
|---|---|
| **Stripe** | `stripeSubscriptionId` set (webhook-managed) AND `subscriptionPaidUntil` (when present) not in the past |
| **Manual** (bank transfer / cash) | `manualSubscription == true` AND an **unexpired** `subscriptionPaidUntil` — manual subs are never open-ended |

## Enforcement (two layers)

1. **Client**: `payrollService.approvePayrollRun` throws
   `SubscriptionRequiredError` → `PayrollHistory` catches → routes to
   `/billing`.
2. **Rules backstop**: the status transition **into** `approved` requires an
   active subscription on all three payroll rule paths (`/payrollRuns`,
   `/payruns`, `/tenants/{t}/payruns`). Already-approved runs stay editable if
   a subscription lapses. Tests: `tests/rules/payroll-approval.test.ts`.

**Tamper protection**: tenant owners cannot write `stripeSubscriptionId`,
`subscriptionPaidUntil`, `manualSubscription`, `monthlySubscriptionAmount`,
`stripeCustomerId`, `status`, `plan`, or `limits` on their own tenant doc
(they could otherwise self-activate the paywall). Only the webhook and
superadmins set those fields.

## Where users see their plan

- **User menus** (TopBar + MainNavigation, incl. mobile): "Billing & Plan"
  with a live FREE/ACTIVE chip (admins only). Shared status via
  `client/hooks/useBilling.ts` (`useIsSubscribed`).
- **Settings**: "Billing & Plan" quick-link card.
- **Run Payroll wizard**: free tenants see a quiet strip — build/review is
  free, finalizing needs a subscription — so the paywall is never a surprise.
- **`/billing` page**: price × live active-employee count, subscribe (Stripe
  Checkout), billing portal (Stripe subs only), "No card? Pay by bank
  transfer or cash" → invoice-request email to info@naroman.tl.

## Stripe flow

- `createCheckoutSession` (callable): quantity = **live count of
  `status=='active'` employees** (never the manually curated
  `currentEmployeeCount` field — it goes stale; checkout self-heals it).
  Superadmins may run billing for any tenant (impersonation support).
- `stripeWebhook`: signature-verified; syncs `stripeCustomerId`,
  `stripeSubscriptionId` (set while active/trialing, deleted otherwise),
  `monthlySubscriptionAmount`, `subscriptionPaidUntil`.
- `syncSubscriptionQuantities` (daily 03:00 Dili): true-up — sets each Stripe
  sub's quantity to the current active-employee count with
  `proration_behavior: 'none'`, so the next invoice bills the real team size.

## Offline (bank transfer / cash) flow — the main TL path

1. Tenant clicks "Request an invoice" on `/billing` → email to
   info@naroman.tl (purpose `billing-invoice-request`).
2. Payment arrives → superadmin records it: **Admin → Tenants → tenant →
   "Record offline payment"** (months 1/3/6/12 + monthly amount) → sets
   `manualSubscription: true` + extends `subscriptionPaidUntil` from
   max(now, current) — with an admin audit entry.
3. `sendRenewalReminders` (daily 08:00 Dili) emails the tenant at 7 days out,
   1 day out, and once after lapse (+ ops copy to info@naroman.tl).
   Idempotent per stage per paid-until value; recording a new payment re-arms
   the stages. Lapse re-locks finalizing automatically.

## Admin console

TenantList/TenantDetail show **real** subscription state via
`isTenantSubscribed` (same source as the app chip): Active/Free badges,
live active-employee counts (= billed seats), no fabricated $/mo for free
tenants, employee-count field read-only (auto-synced). "Record offline
payment" / "End manual subscription" live on TenantDetail.

## Gotchas

- **CI does NOT deploy Cloud Functions** — every billing function change
  needs `firebase deploy --only functions:<name> --project onit-hr-payroll`.
- Stripe Dashboard public details (business name, statement descriptor,
  branding) are dashboard-only settings — keep them "Xefe"/"XEFE.TL".
- The Stripe billing account currency and several vendor billing addresses
  have tax implications — see memory note `pricing-model` for open items.
