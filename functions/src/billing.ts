/**
 * Stripe billing — one flat per-employee subscription with a small-company
 * minimum and an optional discounted annual cycle.
 *
 * Every account has every feature for free; a subscription is what unlocks
 * finalizing payroll runs. The subscription is a single line item priced at the
 * flat per-employee rate with quantity = max(active employees, minimum seats).
 *
 * Secrets (set with `firebase functions:secrets:set`):
 *   STRIPE_SECRET_KEY      — the secret key (sk_...)
 *   STRIPE_WEBHOOK_SECRET  — the webhook endpoint signing secret (whsec_...)
 */
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import {
  isSuperAdmin,
  requireAuth,
  requireTenantAdmin,
  type AuthContext,
} from "./authz";
import {
  calculateBilledSeats,
  calculateSubscriptionAmounts,
  effectiveAnnualPaidSeats,
  getStripeUnitAmountCents,
  normalizeBillingPricing,
  planAnnualSeatUpdates,
  type BillingInterval,
  type BillingPricingConfig,
} from "./billingPricing";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const PACKAGES_CONFIG_PATH = "platform/packagesConfig";
const DEFAULT_APP_URL = "https://xefe.tl";

/**
 * How long a freshly created checkout session holds the "one checkout at a time"
 * lock on a tenant. Long enough to cover the window between creating a Checkout
 * Session and the completion webhook landing (so two rapid clicks or two admins
 * cannot each spin up their own subscription), short enough that an abandoned
 * checkout frees the lock for a legitimate retry. The webhook clears it on
 * completion; an existing-subscription check in Stripe backstops longer delays.
 */
const CHECKOUT_LOCK_TTL_MS = 10 * 60 * 1000;

/** Stripe subscription statuses that represent a real, billable subscription
 * already attached to the customer — a second checkout must be refused. */
const BLOCKING_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["active", "trialing", "past_due", "unpaid"]);

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

async function getBillingPricing(
  db: FirebaseFirestore.Firestore,
): Promise<BillingPricingConfig> {
  const snap = await db.doc(PACKAGES_CONFIG_PATH).get();
  return normalizeBillingPricing(snap.data());
}

/**
 * Count the tenant's ACTIVE employees at checkout time. The source of truth is
 * the employees subcollection — tenants add staff themselves, so the manually
 * curated `currentEmployeeCount` field goes stale and must not drive billing.
 * Returns null if the aggregate query fails. Checkout must stop rather than
 * charge from a stale stored count; the daily sync simply retries tomorrow.
 */
async function countActiveEmployees(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
): Promise<number | null> {
  try {
    const agg = await db
      .collection(`tenants/${tenantId}/employees`)
      .where("status", "==", "active")
      .count()
      .get();
    return agg.data().count;
  } catch (error) {
    console.error(
      "Active-employee count failed; billing action deferred:",
      error,
    );
    return null;
  }
}

interface CheckoutData {
  tenantId?: string;
  returnUrl?: string;
  billingInterval?: BillingInterval;
}

function safeReturnBase(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_APP_URL;
  try {
    const url = new URL(value);
    const localDevelopment =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.protocol === "http:";
    const xefeProduction =
      (url.hostname === "xefe.tl" || url.hostname === "www.xefe.tl") &&
      url.protocol === "https:";
    return localDevelopment || xefeProduction ? url.origin : DEFAULT_APP_URL;
  } catch {
    return DEFAULT_APP_URL;
  }
}

function hasActiveManualSubscription(tenant: Record<string, unknown>): boolean {
  if (tenant.manualSubscription !== true) return false;
  const paidUntil = tenant.subscriptionPaidUntil as
    | { toMillis?: () => number }
    | undefined;
  return (
    typeof paidUntil?.toMillis === "function" &&
    paidUntil.toMillis() > Date.now()
  );
}

/**
 * True while a recent checkout is still in flight for this tenant (the marker
 * has not expired). Used to reject a second concurrent checkout before the first
 * one's webhook has set stripeSubscriptionId.
 */
function pendingCheckoutActive(
  tenant: Record<string, unknown>,
  now: number,
): boolean {
  const pending = tenant.pendingCheckout as { at?: number } | undefined;
  return (
    typeof pending?.at === "number" && now - pending.at < CHECKOUT_LOCK_TTL_MS
  );
}

/**
 * Read a Stripe subscription period boundary (seconds). Newer Stripe API
 * versions expose current_period_start/end on the subscription item rather than
 * the subscription, so fall back to the item.
 */
function readSubscriptionPeriodSec(
  sub: Stripe.Subscription,
  item: Stripe.SubscriptionItem | undefined,
  field: "current_period_start" | "current_period_end",
): number | undefined {
  return (
    (sub as unknown as Record<string, number | undefined>)[field] ??
    (item as unknown as Record<string, number | undefined> | undefined)?.[field]
  );
}

/**
 * Billing actions are for tenant owners/hr-admins — or superadmins, who can
 * run billing on any tenant (e.g. while impersonating a demo tenant). This
 * mirrors firestore.rules, where isSuperAdmin() passes everywhere; without it
 * the UI shows "Subscribe now" during impersonation but the callable 403s.
 */
async function requireBillingManager(
  tenantId: string,
  auth: AuthContext,
): Promise<void> {
  if (await isSuperAdmin(auth.uid, auth.token)) return;
  await requireTenantAdmin(tenantId, auth.uid);
}

export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const auth = requireAuth(request);
    const { tenantId, returnUrl } = (request.data ?? {}) as CheckoutData;
    const billingInterval: BillingInterval =
      (request.data as CheckoutData | undefined)?.billingInterval === "year"
        ? "year"
        : "month";
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);

    const db = getFirestore();
    const tenantRef = db.doc(`tenants/${tenantId}`);

    // Self-heal a stale local subscription pointer before the guard below trips
    // on it. If we think we're subscribed but Stripe says the subscription is
    // gone/canceled (e.g. a past out-of-order webhook re-wrote the field, or the
    // field simply lagged a cancel), clear it so the tenant can re-subscribe
    // instead of being wedged on "already has an active subscription".
    const preData = (await tenantRef.get()).data() as
      | Record<string, unknown>
      | undefined;
    const localSubId = preData?.stripeSubscriptionId;
    if (typeof localSubId === "string" && localSubId) {
      const stripe = stripeClient();
      let stillBlocking = false;
      try {
        const sub = await stripe.subscriptions.retrieve(localSubId);
        stillBlocking = BLOCKING_SUBSCRIPTION_STATUSES.has(sub.status);
      } catch {
        // Not found in Stripe at all → definitely stale.
        stillBlocking = false;
      }
      if (!stillBlocking) {
        await revertTenantToFree(db, tenantId);
      }
    }

    // Atomically re-check the guards AND claim a short-lived checkout lock, so
    // two near-simultaneous callable invocations (double click / two admins)
    // cannot both create a session before the first webhook lands and end up
    // with two Stripe subscriptions (finding 8). The lock is released by the
    // completion webhook, on a short TTL, or by the failure cleanup below.
    const now = Date.now();
    const tenant = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tenantRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Tenant not found");
      }
      const data = snap.data() as Record<string, unknown>;
      if (
        typeof data.stripeSubscriptionId === "string" &&
        data.stripeSubscriptionId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "This tenant already has an active Stripe subscription; use the billing portal instead",
        );
      }
      if (hasActiveManualSubscription(data)) {
        throw new HttpsError(
          "failed-precondition",
          "This tenant already has an active offline subscription",
        );
      }
      if (pendingCheckoutActive(data, now)) {
        throw new HttpsError(
          "failed-precondition",
          "A checkout was just started for this tenant; complete it or try again in a few minutes",
        );
      }
      tx.set(tenantRef, { pendingCheckout: { at: now } }, { merge: true });
      return data;
    });

    // From here on we hold the checkout lock; release it if anything fails so
    // the tenant is not stuck unable to retry.
    try {
      return await buildCheckoutSession({
        db,
        tenantRef,
        tenantId,
        tenant,
        billingInterval,
        returnUrl,
      });
    } catch (error) {
      await tenantRef
        .set({ pendingCheckout: FieldValue.delete() }, { merge: true })
        .catch((cleanupError) =>
          console.error(
            "Failed to release checkout lock after error:",
            cleanupError,
          ),
        );
      throw error;
    }
  },
);

interface BuildCheckoutArgs {
  db: FirebaseFirestore.Firestore;
  tenantRef: FirebaseFirestore.DocumentReference;
  tenantId: string;
  tenant: Record<string, unknown>;
  billingInterval: BillingInterval;
  returnUrl?: string;
}

async function buildCheckoutSession(
  args: BuildCheckoutArgs,
): Promise<{ url: string | null }> {
  const { db, tenantRef, tenantId, tenant, billingInterval, returnUrl } = args;

  let pricing: BillingPricingConfig;
  try {
    pricing = await getBillingPricing(db);
  } catch (error) {
    console.error("Could not verify current billing pricing:", error);
    throw new HttpsError(
      "unavailable",
      "Could not verify current pricing; no checkout session was created",
    );
  }
  // Bill for the REAL active-employee count (live query), not the manually
  // curated tenant field — self-serve tenants add staff without ever touching
  // that field. Small teams are billed at the configured minimum, which is
  // five seats ($20/month) by default.
  const activeCount = await countActiveEmployees(db, tenantId);
  if (activeCount === null) {
    throw new HttpsError(
      "unavailable",
      "Could not verify the active employee count; no checkout session was created",
    );
  }
  const billedSeats = calculateBilledSeats(activeCount, pricing);
  if (activeCount !== tenant.currentEmployeeCount) {
    // Self-heal the stored count so the billing page and admin console agree.
    await tenantRef.set({ currentEmployeeCount: activeCount }, { merge: true });
  }

  const stripe = stripeClient();
  let customerId = tenant.stripeCustomerId as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:
        (tenant.billingEmail as string) ||
        (tenant.ownerEmail as string) ||
        undefined,
      name: (tenant.name as string) || tenantId,
      metadata: { tenantId },
    });
    customerId = customer.id;
    await tenantRef.set({ stripeCustomerId: customerId }, { merge: true });
  } else {
    // Backstop for the double-subscribe race (finding 8): if a prior checkout
    // already produced a subscription but its webhook has not yet written
    // stripeSubscriptionId back to the tenant, refuse rather than create a
    // second one. Only pre-existing customers can already have subscriptions.
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    if (
      existing.data.some((s) => BLOCKING_SUBSCRIPTION_STATUSES.has(s.status))
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This tenant already has a Stripe subscription; use the billing portal instead",
      );
    }
  }

  const base = safeReturnBase(returnUrl);
  const unitAmountCents = getStripeUnitAmountCents(pricing, billingInterval);
  const subscriptionMetadata = {
    tenantId,
    billingInterval,
    minimumEmployees: String(pricing.minimumEmployees),
    annualMonthsCharged: String(pricing.annualMonthsCharged),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: billedSeats,
        price_data: {
          currency: "usd",
          unit_amount: unitAmountCents,
          recurring: { interval: billingInterval },
          product_data: {
            name:
              billingInterval === "year"
                ? "Xefe — annual subscription"
                : "Xefe — monthly subscription",
          },
        },
      },
    ],
    metadata: subscriptionMetadata,
    subscription_data: { metadata: subscriptionMetadata },
    allow_promotion_codes: true,
    success_url: `${base}/billing?status=success`,
    cancel_url: `${base}/billing?status=cancel`,
  });

  return { url: session.url };
}

export const createBillingPortalSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const auth = requireAuth(request);
    const { tenantId, returnUrl } = (request.data ?? {}) as CheckoutData;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);

    const tenantSnap = await getFirestore().doc(`tenants/${tenantId}`).get();
    const customerId = tenantSnap.data()?.stripeCustomerId as
      | string
      | undefined;
    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No billing account exists yet for this tenant",
      );
    }

    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${safeReturnBase(returnUrl)}/billing`,
    });
    return { url: portal.url };
  },
);

async function applySubscription(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const quantity = item?.quantity ?? 1;
  const unitAmount = item?.price?.unit_amount ?? 0;
  const billingInterval: BillingInterval =
    item?.price?.recurring?.interval === "year" ? "year" : "month";
  const annualMonthsChargedRaw = Number(sub.metadata?.annualMonthsCharged);
  const annualMonthsCharged =
    Number.isInteger(annualMonthsChargedRaw) &&
    annualMonthsChargedRaw >= 1 &&
    annualMonthsChargedRaw <= 12
      ? annualMonthsChargedRaw
      : 10;
  const { billingAmount, monthlyAmount, billingMonths } =
    calculateSubscriptionAmounts(
      unitAmount,
      quantity,
      billingInterval,
      annualMonthsCharged,
    );
  const active = sub.status === "active" || sub.status === "trialing";

  const periodEndSec = readSubscriptionPeriodSec(
    sub,
    item,
    "current_period_end",
  );

  const patch: Record<string, unknown> = {
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    monthlySubscriptionAmount: monthlyAmount,
    subscriptionBillingAmount: billingAmount,
    subscriptionBillingInterval: billingInterval,
    subscriptionBillingMonths: billingMonths,
    subscriptionBilledSeats: quantity,
    subscriptionAnnualMonthsCharged: annualMonthsCharged,
    // stripeSubscriptionId is the "can finalize payroll" gate; only set it while active.
    stripeSubscriptionId: active ? sub.id : FieldValue.delete(),
    // A subscription now exists (or is gone); release any in-flight checkout lock.
    pendingCheckout: FieldValue.delete(),
  };
  if (periodEndSec)
    patch.subscriptionPaidUntil = Timestamp.fromMillis(periodEndSec * 1000);

  await db.doc(`tenants/${tenantId}`).set(patch, { merge: true });
}

/** Subscription statuses meaning the subscription is gone — revert to free. */
const GONE_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["canceled", "incomplete_expired"]);

/**
 * Revert a tenant to free usage: drop the payroll-unlock and zero the billing
 * fields. Idempotent — safe to run on a redelivered/duplicate cancel.
 */
async function revertTenantToFree(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
): Promise<void> {
  await db.doc(`tenants/${tenantId}`).set(
    {
      monthlySubscriptionAmount: 0,
      subscriptionBillingAmount: 0,
      subscriptionBillingInterval: FieldValue.delete(),
      subscriptionBillingMonths: FieldValue.delete(),
      subscriptionBilledSeats: FieldValue.delete(),
      subscriptionAnnualMonthsCharged: FieldValue.delete(),
      stripeSubscriptionId: FieldValue.delete(),
      pendingCheckout: FieldValue.delete(),
    },
    { merge: true },
  );
}

/**
 * Reconcile a tenant's stored subscription state against LIVE Stripe state
 * (re-fetched by id), independent of what any particular webhook payload said.
 * Applies the live subscription when it still exists, reverts to free when it
 * is canceled/expired. This is what makes out-of-order delivery safe.
 */
async function reconcileSubscription(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  tenantId: string,
  subId: string,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subId);
  if (GONE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    await revertTenantToFree(db, tenantId);
  } else {
    await applySubscription(db, tenantId, sub);
  }
}

/** Firestore collection of already-handled Stripe event ids (idempotency). */
const WEBHOOK_EVENTS_COLLECTION = "stripeWebhookEvents";

/**
 * Idempotency guard. Atomically claims a Stripe event.id the first time it is
 * seen and returns true; returns false if it was already handled (Stripe
 * redelivers on any non-2xx, on its retry schedule, and occasionally
 * at-least-once even after a 2xx). If the handler later throws, the caller
 * releases the claim so the redelivery can reprocess.
 */
async function claimWebhookEvent(
  db: FirebaseFirestore.Firestore,
  event: Stripe.Event,
): Promise<boolean> {
  const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, {
      type: event.type,
      created: event.created,
      receivedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/**
 * Ordering guard for a tenant's subscription events. Stripe does NOT guarantee
 * delivery order, so a delayed `customer.subscription.updated` (carrying a
 * pre-cancel "active" snapshot) can arrive AFTER the cancel and, if applied,
 * resurrect the subscription — re-unlocking the paywall and wedging
 * re-subscription. We record the newest event.created applied per tenant and
 * refuse to apply an older one. `apply` re-fetches live state from Stripe, so
 * same-timestamp or newer events converge on the truth regardless of order.
 *
 * The watermark advances inside the transaction before `apply` runs; on failure
 * the event claim is released and the retry re-enters with
 * event.created == watermark (not strictly less), so it reprocesses.
 */
async function applySubscriptionEventIfNewer(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  eventCreated: number,
  apply: () => Promise<void>,
): Promise<boolean> {
  const ref = db.doc(`tenants/${tenantId}`);
  const proceed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const last =
      (snap.data()?.lastStripeSubscriptionEventAt as number | undefined) ?? 0;
    if (eventCreated < last) return false;
    tx.set(ref, { lastStripeSubscriptionEventAt: eventCreated }, { merge: true });
    return true;
  });
  if (proceed) await apply();
  return proceed;
}

/**
 * Bring an ANNUAL subscription's seat count in line with the billed employee
 * count WITHOUT double-charging seasonal staff (docs/BILLING.md finding 5).
 *
 * Annual terms are prepaid, so seats paid for at the start of the term must not
 * be billed a second time when they are removed for the low season and re-added
 * for the high season. We bank the peak seats already paid within the current
 * term (`subscriptionAnnualPaidSeats`, keyed to the term start
 * `subscriptionTermStart`, reset on renewal), re-add banked seats for free, and
 * prorate/invoice only seats that exceed that paid peak. Reductions carry no
 * credit and apply at renewal, matching docs/BILLING.md ("Added annual seats are
 * prorated and invoiced immediately; annual seat reductions apply at renewal").
 */
async function syncAnnualSeats(
  stripe: Stripe,
  sub: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
  desiredQuantity: number,
  tenantDoc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<void> {
  const subId = sub.id;
  const currentQty = item.quantity ?? 0;
  const startSec = readSubscriptionPeriodSec(sub, item, "current_period_start");
  const termStartMs =
    typeof startSec === "number" ? startSec * 1000 : undefined;

  const stored = tenantDoc.data();
  const paidSeats = effectiveAnnualPaidSeats(
    stored.subscriptionAnnualPaidSeats as number | undefined,
    stored.subscriptionTermStart as number | undefined,
    termStartMs,
    currentQty,
  );

  const updates = planAnnualSeatUpdates(currentQty, desiredQuantity, paidSeats);
  for (const update of updates) {
    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, quantity: update.quantity }],
      proration_behavior: update.prorationBehavior,
    });
  }
  if (updates.length > 0) {
    console.log(
      `Tenant ${tenantDoc.id}: annual seats ${currentQty} -> ${desiredQuantity} ` +
        `(paid peak this term: ${paidSeats})`,
    );
  }

  // Persist the banked peak (and advance the term baseline on renewal) so
  // re-adds stay free and survive a delayed/lost webhook. newPaidSeats never
  // drops: a reduction keeps the peak, an invoiced increase raises it.
  const newPaidSeats = Math.max(paidSeats, desiredQuantity);
  const patch: Record<string, unknown> = {};
  if (stored.subscriptionAnnualPaidSeats !== newPaidSeats) {
    patch.subscriptionAnnualPaidSeats = newPaidSeats;
  }
  if (
    termStartMs !== undefined &&
    stored.subscriptionTermStart !== termStartMs
  ) {
    patch.subscriptionTermStart = termStartMs;
  }
  if (Object.keys(patch).length > 0) {
    await tenantDoc.ref.set(patch, { merge: true });
  }
}

/**
 * Daily true-up: keep each subscribed tenant's Stripe quantity equal to their
 * billed employee count (active staff or the configured minimum), so "more
 * employees cost more" stays true after
 * checkout day (quantity is otherwise frozen at whatever it was on subscribe).
 * Monthly plans change on the next invoice without part-month charges. Annual
 * plans prorate genuinely new seats (above the peak already paid this term) so a
 * customer cannot add staff for free for the rest of a prepaid year, yet seats
 * already paid for are never charged twice when re-added; seat reductions take
 * effect at renewal. The customer.subscription.updated webhook then syncs the
 * tenant billing snapshot.
 */
export const syncSubscriptionQuantities = onSchedule(
  {
    schedule: "0 3 * * *", // daily at 03:00 Dili time (quiet hours)
    timeZone: "Asia/Dili",
    secrets: [STRIPE_SECRET_KEY],
  },
  async () => {
    const db = getFirestore();
    const stripe = stripeClient();
    const pricing = await getBillingPricing(db);

    // Only tenants with a live subscription flag (non-empty string field).
    const subscribed = await db
      .collection("tenants")
      .where("stripeSubscriptionId", ">", "")
      .get();

    for (const tenantDoc of subscribed.docs) {
      const tenantId = tenantDoc.id;
      const subId = tenantDoc.data().stripeSubscriptionId as string;
      try {
        const activeCount = await countActiveEmployees(db, tenantId);
        if (activeCount === null) continue; // count failed; retry tomorrow
        const quantity = calculateBilledSeats(activeCount, pricing);

        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.status !== "active" && sub.status !== "trialing") continue;

        const item = sub.items.data[0];
        if (item && item.price.recurring?.interval === "year") {
          await syncAnnualSeats(stripe, sub, item, quantity, tenantDoc);
        } else if (item && item.quantity !== quantity) {
          // Monthly: quantity change applies on the next invoice, no part-month
          // proration in either direction (unchanged behaviour).
          await stripe.subscriptions.update(subId, {
            items: [{ id: item.id, quantity }],
            proration_behavior: "none",
          });
          console.log(
            `Tenant ${tenantId}: subscription quantity ${item.quantity} -> ${quantity}`,
          );
        }

        // Self-heal the stored count so billing/admin pages agree.
        if (tenantDoc.data().currentEmployeeCount !== activeCount) {
          await tenantDoc.ref.set(
            { currentEmployeeCount: activeCount },
            { merge: true },
          );
        }
      } catch (error) {
        // One bad tenant must not block the rest of the sweep.
        console.error(`Quantity sync failed for tenant ${tenantId}:`, error);
      }
    }
  },
);

// Where renewal-reminder ops copies (and tenant replies) go.
const BILLING_OPS_EMAIL = "info@naroman.tl";

/**
 * Daily renewal reminders for MANUAL (bank transfer / cash) subscriptions.
 * Stripe subs auto-renew and get Stripe's own emails; manual subs have a hard
 * subscriptionPaidUntil, so we remind the tenant (and ops) at 7 days out,
 * 1 day out, and once after lapsing. Idempotent per stage per paid-until
 * value: sending marks renewalReminders.{stage} = paidUntilMillis on the
 * tenant doc, and recording a new payment moves paidUntil, which re-arms all
 * stages automatically.
 */
export const sendRenewalReminders = onSchedule(
  {
    schedule: "0 8 * * *", // daily at 08:00 Dili time — lands in the morning
    timeZone: "Asia/Dili",
  },
  async () => {
    const db = getFirestore();
    const snapshot = await db
      .collection("tenants")
      .where("manualSubscription", "==", true)
      .get();

    for (const tenantDoc of snapshot.docs) {
      const tenantId = tenantDoc.id;
      try {
        const data = tenantDoc.data() as Record<string, unknown>;
        // A live Stripe subscription supersedes the manual one — skip.
        if (data.stripeSubscriptionId) continue;

        const paidUntilTs = data.subscriptionPaidUntil as Timestamp | undefined;
        if (!paidUntilTs || typeof paidUntilTs.toMillis !== "function")
          continue;

        const paidUntilMs = paidUntilTs.toMillis();
        const daysLeft = (paidUntilMs - Date.now()) / (24 * 60 * 60 * 1000);
        const stage =
          daysLeft < 0
            ? "lapsed"
            : daysLeft <= 1
              ? "d1"
              : daysLeft <= 7
                ? "d7"
                : null;
        if (!stage) continue;

        const sentFor = (data.renewalReminders ?? {}) as Record<
          string,
          unknown
        >;
        if (sentFor[stage] === paidUntilMs) continue; // already sent this period

        const name = (data.name as string) || tenantId;
        const paidUntilStr = new Date(paidUntilMs).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Dili",
        });
        const daysLeftLabel = Math.max(0, Math.ceil(daysLeft));
        const tenantEmail =
          (data.billingEmail as string) || (data.ownerEmail as string) || null;

        const subject =
          stage === "lapsed"
            ? `Your Xefe subscription expired on ${paidUntilStr}`
            : stage === "d1"
              ? "Your Xefe subscription expires tomorrow"
              : `Your Xefe subscription expires on ${paidUntilStr}`;

        const tenantText = [
          `Hi ${name},`,
          "",
          stage === "lapsed"
            ? `Your Xefe subscription expired on ${paidUntilStr}, so finalizing payroll runs is locked until it's renewed.`
            : `Your Xefe subscription is paid until ${paidUntilStr}. After that date, finalizing payroll runs is locked until it's renewed.`,
          "",
          "To renew by bank transfer or cash:",
          "- Request an invoice from your Billing page: https://xefe.tl/billing",
          "- Or simply reply to this email and we'll send payment details.",
          "",
          "Everything else in Xefe stays free to use.",
          "",
          "— The Xefe team",
        ].join("\n");

        const mail = db.collection("mail");
        if (tenantEmail) {
          await mail.add({
            tenantId,
            to: [tenantEmail],
            replyTo: BILLING_OPS_EMAIL,
            subject,
            text: tenantText,
            status: "pending",
            purpose: "billing-renewal-reminder",
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await mail.add({
          tenantId,
          to: [BILLING_OPS_EMAIL],
          subject:
            stage === "lapsed"
              ? `[Xefe ops] ${name}: manual subscription LAPSED (${paidUntilStr})`
              : `[Xefe ops] ${name}: manual subscription expires in ${daysLeftLabel}d (${paidUntilStr})`,
          text: [
            `Tenant: ${name} (${tenantId})`,
            `Paid until: ${paidUntilStr}`,
            `Standard monthly value: $${Number(data.monthlySubscriptionAmount ?? 0)}`,
            `Last payment: $${Number(data.subscriptionBillingAmount ?? data.monthlySubscriptionAmount ?? 0)} for ${Number(data.subscriptionBillingMonths ?? 1)} month(s)`,
            `Tenant contact: ${tenantEmail ?? "NO EMAIL ON FILE — contact them another way"}`,
            "",
            "Once payment arrives, record it in Admin -> Tenants -> Record offline payment.",
          ].join("\n"),
          status: "pending",
          purpose: "billing-renewal-reminder-ops",
          createdAt: FieldValue.serverTimestamp(),
        });

        await tenantDoc.ref.set(
          { renewalReminders: { [stage]: paidUntilMs } },
          { merge: true },
        );
      } catch (error) {
        // One bad tenant must not block the rest of the sweep.
        console.error(`Renewal reminder failed for tenant ${tenantId}:`, error);
      }
    }
  },
);

export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = stripeClient();
    const signature = req.headers["stripe-signature"];
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as unknown as { rawBody: Buffer }).rawBody,
        signature as string,
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
      return;
    }

    const db = getFirestore();

    // Idempotency: skip an event.id we have already handled (Stripe redelivers).
    const claimed = await claimWebhookEvent(db, event);
    if (!claimed) {
      res.json({ received: true, duplicate: true });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const tenantId = session.metadata?.tenantId;
          if (tenantId && session.subscription) {
            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
            await applySubscriptionEventIfNewer(db, tenantId, event.created, () =>
              reconcileSubscription(db, stripe, tenantId, subId),
            );
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          // event.data.object is a snapshot from when the event fired and can be
          // stale on an out-of-order/redelivered event. reconcileSubscription
          // re-fetches LIVE state by id, so a delayed "updated" carrying a
          // pre-cancel "active" snapshot cannot resurrect a canceled sub.
          const staleSub = event.data.object;
          const tenantId = staleSub.metadata?.tenantId;
          if (tenantId) {
            await applySubscriptionEventIfNewer(db, tenantId, event.created, () =>
              reconcileSubscription(db, stripe, tenantId, staleSub.id),
            );
          }
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (error) {
      // Release the idempotency claim so Stripe's redelivery reprocesses this
      // event instead of it being silently swallowed as a duplicate.
      await db
        .collection(WEBHOOK_EVENTS_COLLECTION)
        .doc(event.id)
        .delete()
        .catch((cleanupError) =>
          console.error(
            "Failed to release webhook event claim after error:",
            cleanupError,
          ),
        );
      console.error("Webhook handler error:", error);
      res.status(500).send("Webhook handler failed");
    }
  },
);
