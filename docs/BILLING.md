# Billing & Monetization — architecture

_Last updated: 2026-07-18. Audience: agents and developers working on billing._

## The model (one sentence)

**Everything is free; a subscription unlocks exactly one action: finalizing a
payroll run.** The published price is $4/active employee/month with a five-seat
minimum ($20/month). Annual billing provides twelve months of access for ten
monthly payments. Reports, exports, and compliance filings are never gated —
they are the deliverable of the run the tenant paid for.

The three superadmin-editable values in `platform/packagesConfig` are
`pricePerEmployee`, `minimumEmployees`, and `annualMonthsCharged`. The public
landing page may read this one document so marketing, the billing screen, and
server-side checkout all use the same published values; only a superadmin may
write it.

## What "subscribed" means

`isTenantSubscribed()` in `client/lib/packagePricing.ts` — the single source
of truth, mirrored by `tenantHasActiveSubscription()` in `firestore.rules`
(keep the two in sync). Two ways to qualify:

| Path                              | Condition                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Stripe**                        | `stripeSubscriptionId` set (webhook-managed) AND `subscriptionPaidUntil` (when present) not in the past      |
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
`subscriptionBillingAmount`, `subscriptionBillingInterval`,
`subscriptionBillingMonths`, `subscriptionBilledSeats`,
`subscriptionAnnualMonthsCharged`,
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
- **`/billing` page**: shows active and billed seats, the five-seat minimum,
  monthly/annual choice and exact cycle total; subscribes through Stripe
  Checkout; opens the billing portal for Stripe subscribers; and offers "No
  card?" invoice requests for bank transfer or cash.

## Stripe flow

- `createCheckoutSession` (callable): accepts only `month` or `year`; price and
  quantity are never accepted from the browser. Quantity is
  `max(live status=='active' employee count, minimumEmployees)` (never the
  manually curated `currentEmployeeCount` field — checkout self-heals it).
  If that live count cannot be verified, checkout stops without charging; it
  never falls back to a potentially stale seat count.
  The annual Stripe unit price is `pricePerEmployee × annualMonthsCharged`.
  A tenant with an active Stripe subscription cannot accidentally create a
  second one. Superadmins may run billing for any tenant while impersonating.
- `stripeWebhook`: signature-verified; syncs `stripeCustomerId`,
  `stripeSubscriptionId` (set while active/trialing, deleted otherwise), cycle,
  cycle amount, standard monthly value, billed seats and `subscriptionPaidUntil`.
  Hardened against redelivery/reordering (Stripe guarantees neither):
  1. **Idempotent with a claim lifecycle** — every `event.id` is claimed
     transactionally in `stripeWebhookEvents/{id}` as `status: 'processing'`
     (+ `claimedAt`); successful handling marks it `'done'` (doc kept). A
     redelivery of a `'done'` claim returns 200 without reprocessing; one that
     races a fresh in-flight claim gets 409 (a 2xx would end Stripe's retries
     even if the holder then dies); a handler that throws in-process deletes
     the claim so the retry reprocesses; and a claim stuck in `'processing'`
     for 5+ minutes (instance died mid-event — longer than the function
     timeout) is re-claimed by the next redelivery, so a killed instance can
     never ACK a `customer.subscription.deleted` away forever. Claim docs carry
     `expiresAt` (now + 30 days) for a Firestore TTL policy (created
     out-of-band with gcloud; same field name as the authEmails throttle).
  2. **Re-fetches live state** — subscription events never trust `event.data.object`
     (a snapshot); the subscription is retrieved by id BEFORE the ordering
     transaction and only that live state is ever written. Canceled/expired →
     revert to free; otherwise apply.
  3. **Transactional ordering watermark** — `tenants/*.lastStripeSubscriptionEventAt`
     (event.created) is checked AND advanced in the same transaction that
     writes the tenant billing state, so a slow handler holding a pre-cancel
     "active" fetch cannot land after a cancellation's revert. Strictly older
     events are dropped; an equal-timestamp event applies only if it
     deactivates (ties never resurrect a canceled sub, but a retried
     cancellation at the watermark still reprocesses). Dropped events never
     advance the watermark.
  4. **Subscription-id guard** — an event naming a subscription other than the
     stored `stripeSubscriptionId` is ignored (a trailing event about an old
     sub can't overwrite the live one after a re-subscribe) unless the stored
     id is empty (first activation / post-revert re-subscribe) or a
     `checkout.session.completed` is activating the newer subscription.
     `createCheckoutSession` **self-heals**: before the "already subscribed" guard it
     verifies a stored `stripeSubscriptionId` against Stripe and clears it ONLY on
     Stripe's say-so — `resource_missing` or a live non-blocking status. Any other
     Stripe error (outage/auth/rate limit) fails the checkout with `unavailable`
     instead of reverting a possibly-paying tenant, and the self-heal revert never
     touches the `pendingCheckout` lock (a concurrent checkout call may have just
     claimed it).
- `syncSubscriptionQuantities` (daily 03:00 Dili): true-up — sets each Stripe
  subscription to the current billed-seat count. Monthly changes apply on the
  next invoice without part-month charges. Added annual seats are prorated and
  invoiced immediately; annual seat reductions apply at renewal.

## Offline (bank transfer / cash) flow — the main TL path

1. Tenant selects monthly or annual and clicks "Request an invoice" on
   `/billing` → email to info@naroman.tl with the published rate, active
   employees, billed seats, cycle amount and annual saving (purpose
   `billing-invoice-request`).
2. Payment arrives → superadmin records it: **Admin → Tenants → tenant →
   "Record offline payment"**. The form calculates the expected total for
   monthly or annual payment, applies the annual discount, records the amount
   actually received (which must cover the published total), sets
   `manualSubscription: true`, and extends
   `subscriptionPaidUntil` from max(now, current), with an admin audit entry.
3. `sendRenewalReminders` (daily 08:00 Dili) emails the tenant at 7 days out,
   1 day out, and once after lapse (+ ops copy to info@naroman.tl).
   Idempotent per stage per paid-until value; recording a new payment re-arms
   the stages. Lapse re-locks finalizing automatically.

## Admin console

TenantList/TenantDetail show **real** subscription state via
`isTenantSubscribed` (same source as the app chip): Active/Free badges,
live active-employee and billed-seat counts, billing cycle and cycle amount, no
fabricated price for free tenants, employee-count field read-only (auto-synced). "Record offline
payment" / "End manual subscription" live on TenantDetail.

Stripe and offline subscriptions are mutually exclusive: checkout refuses a
tenant with an unexpired offline subscription, and Admin refuses an offline
activation while a Stripe subscription is active. This prevents accidental
double billing during payment-method changes.

## Gotchas

- Pushes to `main` deploy Cloud Functions automatically after E2E, unit, rules,
  translation, and build gates pass. For an intentional standalone redeploy,
  run the **Deploy Cloud Functions (manual)** GitHub workflow; do not depend on
  a developer laptop's Firebase login.
- Stripe Dashboard public details (business name, statement descriptor,
  branding) are dashboard-only settings — keep them "Xefe"/"XEFE.TL".
- The Stripe billing account currency and several vendor billing addresses
  have tax implications — see memory note `pricing-model` for open items.
