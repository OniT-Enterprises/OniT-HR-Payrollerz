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

**Complimentary access** (testers, pilots, partners) is the manual path with
nothing received: `manualSubscription: true` + `subscriptionComped: true` +
`subscriptionCompReason`, with `subscriptionBillingAmount` and
`monthlySubscriptionAmount` written as an explicit **0**. It therefore unlocks
exactly what a paying tenant unlocks and expires on its own — a comp is never
open-ended either. `isTenantComplimentary()` (same module) is what keeps a $0
grant out of revenue and out of dunning; the explicit zeros matter because a
*missing* amount gets back-filled with a list-price estimate for subscribed
tenants in `getTenants()` enrichment, which would show a comp as revenue.

## Enforcement (two layers)

1. **Client**: `payrollService.approvePayrollRun` throws
   `SubscriptionRequiredError` → `PayrollHistory` catches → routes to
   `/billing`.
2. **Rules backstop**: the status transition **into** `approved` requires an
   active subscription on all three payroll rule paths (`/payrollRuns`,
   `/payruns`, `/tenants/{t}/payruns`). Already-approved runs stay editable if
   a subscription lapses. Tests: `tests/rules/payroll-approval.test.ts`.

**Tamper protection**: tenant owners cannot write `stripeSubscriptionId`,
`subscriptionPaidUntil`, `manualSubscription`, `subscriptionComped`,
`subscriptionCompReason`, `monthlySubscriptionAmount`,
`subscriptionBillingAmount`, `subscriptionBillingInterval`,
`subscriptionBillingMonths`, `subscriptionBilledSeats`,
`subscriptionAnnualMonthsCharged`,
`stripeCustomerId`, `status`, `plan`, or `limits` on their own tenant doc
(they could otherwise self-activate the paywall). Only the webhook and
superadmins set those fields.

## There is no plan to pick

The `plan` enum (`free`/`starter`/`professional`/`enterprise`) and `limits` on
the tenant doc are **legacy and unenforced** — nothing reads `PLAN_LIMITS` to
cap employees, users or storage. The "Subscription Plan" dropdown and "Plan
limits" panel were removed from the admin tenant form in Aug 2026 because they
read as the way to grant paid access and were not: the only thing that unlocks
anything is a subscription (Stripe, offline payment, or a comp).

Two traps that dropdown carried, both now fixed:

- `createTenant` set `features.payroll = input.plan !== "free"`, so an
  admin-created tenant on the **default** "free" plan shipped with the payroll
  module switched OFF. Every module is now on for every tenant.
- `updateTenantProfile` rewrote `plan` and `limits` on every profile save.
  Editing a name is not a billing change; it no longer touches them.

New tenants are written as `plan: "free"` with `PLAN_LIMITS.free` for the
benefit of existing readers, and `isValidPlan` still normalizes the field when
reading tenant docs. Do not reintroduce a plan picker.

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
   the stages. Lapse re-locks finalizing automatically. **Comped tenants get no
   tenant-facing reminder** (they owe nothing) — ops still gets one so a comp
   does not silently expire mid-test.

## Complimentary (free) access flow — testers, pilots, partners

**Admin → Tenants → tenant → "Grant free access"**: pick 1/3/6/12 months and a
required reason ("Testing", "Pilot", …). It extends from max(now, current
paid-until), so granting again extends rather than resets, and logs
`complimentary_subscription_granted` with the reason to the admin audit log.
The tenant sees the normal ACTIVE plan chip — nothing tells them it is free —
and the button becomes "Extend free access" once a comp is live.

Deliberate choices:

- **Never open-ended.** Same invariant as an offline payment; the longest single
  grant is 12 months and it always has a paid-until date.
- **$0, not a fake payment.** Recording a $0 "offline payment" would corrupt the
  payment record and the `expectedAmount` guard rejects it anyway. The comp
  path is separate for that reason.
- **Mutually exclusive with Stripe**, like offline payments: the grant refuses a
  tenant with a live `stripeSubscriptionId`, and a later real payment (offline
  or Stripe) clears the comp flag.
- **Not a role.** A comp changes billing only — it never grants admin,
  superadmin, or any extra feature. All features are free anyway; the comp buys
  the one paywalled action.
- **The tenant is told.** The grant queues a `billing-access-granted` email to
  the tenant's billing (or owner) contact. Both the recipient and the wording are
  composed server-side in `resolveRecipients` from the tenant record, and the
  callable REFUSES to send unless that record actually shows an unexpired comp —
  so this mail cannot announce free access that was not granted, and the browser
  cannot redirect it. No tenant role may request the purpose; only a superadmin,
  who short-circuits `memberCanRequestClientMail` in `authorizeClientMail`.
  Sending is non-fatal to the grant, and the dialog names the address before you
  click (the toast reports what actually happened).
- Admin surfaces label it honestly: a "Free access (comp)" badge with the reason
  on TenantDetail, a "Comp" badge in TenantList, and comps are **excluded from
  the "paying tenants" stat**.
- "End free access" is the same action as "End manual subscription" — it clears
  `manualSubscription` and the comp flags and logs
  `complimentary_subscription_ended`.

## Admin console

TenantList/TenantDetail show **real** subscription state via
`isTenantSubscribed` (same source as the app chip), with comps flagged by
`isTenantComplimentary`: Active/Free badges,
live active-employee and billed-seat counts, billing cycle and cycle amount, no
fabricated price for free tenants, employee-count field read-only (auto-synced). "Record offline
payment", "Grant free access" and "End manual subscription" / "End free access"
live on TenantDetail.

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
