"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.sendRenewalReminders = exports.syncSubscriptionQuantities = exports.createBillingPortalSession = exports.createCheckoutSession = void 0;
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
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const authz_1 = require("./authz");
const billingPricing_1 = require("./billingPricing");
const STRIPE_SECRET_KEY = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
const PACKAGES_CONFIG_PATH = "platform/packagesConfig";
// Host split 2026-07-21: billing/checkout returns land in the app host.
const DEFAULT_APP_URL = "https://app.xefe.tl";
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
const BLOCKING_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);
function stripeClient() {
    return new stripe_1.default(STRIPE_SECRET_KEY.value());
}
async function getBillingPricing(db) {
    const snap = await db.doc(PACKAGES_CONFIG_PATH).get();
    return (0, billingPricing_1.normalizeBillingPricing)(snap.data());
}
/**
 * Count the tenant's ACTIVE employees at checkout time. The source of truth is
 * the employees subcollection — tenants add staff themselves, so the manually
 * curated `currentEmployeeCount` field goes stale and must not drive billing.
 * Returns null if the aggregate query fails. Checkout must stop rather than
 * charge from a stale stored count; the daily sync simply retries tomorrow.
 */
async function countActiveEmployees(db, tenantId) {
    try {
        const agg = await db
            .collection(`tenants/${tenantId}/employees`)
            .where("status", "==", "active")
            .count()
            .get();
        return agg.data().count;
    }
    catch (error) {
        console.error("Active-employee count failed; billing action deferred:", error);
        return null;
    }
}
function safeReturnBase(value) {
    if (typeof value !== "string")
        return DEFAULT_APP_URL;
    try {
        const url = new URL(value);
        const localDevelopment = (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
            url.protocol === "http:";
        const xefeProduction = (url.hostname === "xefe.tl" || url.hostname === "www.xefe.tl") &&
            url.protocol === "https:";
        return localDevelopment || xefeProduction ? url.origin : DEFAULT_APP_URL;
    }
    catch (_a) {
        return DEFAULT_APP_URL;
    }
}
function hasActiveManualSubscription(tenant) {
    if (tenant.manualSubscription !== true)
        return false;
    const paidUntil = tenant.subscriptionPaidUntil;
    return (typeof (paidUntil === null || paidUntil === void 0 ? void 0 : paidUntil.toMillis) === "function" &&
        paidUntil.toMillis() > Date.now());
}
/**
 * True while a recent checkout is still in flight for this tenant (the marker
 * has not expired). Used to reject a second concurrent checkout before the first
 * one's webhook has set stripeSubscriptionId.
 */
function pendingCheckoutActive(tenant, now) {
    const pending = tenant.pendingCheckout;
    return (typeof (pending === null || pending === void 0 ? void 0 : pending.at) === "number" && now - pending.at < CHECKOUT_LOCK_TTL_MS);
}
/**
 * Read a Stripe subscription period boundary (seconds). Newer Stripe API
 * versions expose current_period_start/end on the subscription item rather than
 * the subscription, so fall back to the item.
 */
function readSubscriptionPeriodSec(sub, item, field) {
    var _a;
    return ((_a = sub[field]) !== null && _a !== void 0 ? _a : item === null || item === void 0 ? void 0 : item[field]);
}
/**
 * Billing actions are for tenant owners/hr-admins — or superadmins, who can
 * run billing on any tenant (e.g. while impersonating a demo tenant). This
 * mirrors firestore.rules, where isSuperAdmin() passes everywhere; without it
 * the UI shows "Subscribe now" during impersonation but the callable 403s.
 */
async function requireBillingManager(tenantId, auth) {
    if (await (0, authz_1.isSuperAdmin)(auth.uid, auth.token))
        return;
    await (0, authz_1.requireTenantAdmin)(tenantId, auth.uid);
}
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [STRIPE_SECRET_KEY], cors: true }, async (request) => {
    var _a, _b;
    const auth = (0, authz_1.requireAuth)(request);
    const { tenantId, returnUrl } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    const billingInterval = ((_b = request.data) === null || _b === void 0 ? void 0 : _b.billingInterval) === "year"
        ? "year"
        : "month";
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);
    const db = (0, firestore_1.getFirestore)();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    // Self-heal a stale local subscription pointer before the guard below trips
    // on it. If we think we're subscribed but Stripe says the subscription is
    // gone/canceled (e.g. a past out-of-order webhook re-wrote the field, or the
    // field simply lagged a cancel), clear it so the tenant can re-subscribe
    // instead of being wedged on "already has an active subscription".
    const preData = (await tenantRef.get()).data();
    const localSubId = preData === null || preData === void 0 ? void 0 : preData.stripeSubscriptionId;
    if (typeof localSubId === "string" && localSubId) {
        const stripe = stripeClient();
        let stillBlocking = false;
        try {
            const sub = await stripe.subscriptions.retrieve(localSubId);
            stillBlocking = BLOCKING_SUBSCRIPTION_STATUSES.has(sub.status);
        }
        catch (error) {
            // Only Stripe's confirmed "no such subscription" may clear billing
            // state. A transient outage / auth / rate-limit error must never
            // revert a paying tenant to free — fail the checkout instead.
            if (!(error instanceof stripe_1.default.errors.StripeInvalidRequestError &&
                error.code === "resource_missing")) {
                console.error("Could not verify the stored subscription with Stripe:", error);
                throw new https_1.HttpsError("unavailable", "Could not verify the existing subscription; no checkout session was created");
            }
            // resource_missing → the subscription id is definitely stale.
        }
        if (!stillBlocking) {
            // This revert runs outside the lock transaction below, so it must not
            // release pendingCheckout — a concurrent createCheckoutSession call
            // may have just claimed it (two live sessions = double billing).
            await revertTenantToFree(db, tenantId, { releaseCheckoutLock: false });
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
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        const data = snap.data();
        if (typeof data.stripeSubscriptionId === "string" &&
            data.stripeSubscriptionId) {
            throw new https_1.HttpsError("failed-precondition", "This tenant already has an active Stripe subscription; use the billing portal instead");
        }
        if (hasActiveManualSubscription(data)) {
            throw new https_1.HttpsError("failed-precondition", "This tenant already has an active offline subscription");
        }
        if (pendingCheckoutActive(data, now)) {
            throw new https_1.HttpsError("failed-precondition", "A checkout was just started for this tenant; complete it or try again in a few minutes");
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
    }
    catch (error) {
        await tenantRef
            .set({ pendingCheckout: firestore_1.FieldValue.delete() }, { merge: true })
            .catch((cleanupError) => console.error("Failed to release checkout lock after error:", cleanupError));
        throw error;
    }
});
async function buildCheckoutSession(args) {
    const { db, tenantRef, tenantId, tenant, billingInterval, returnUrl } = args;
    let pricing;
    try {
        pricing = await getBillingPricing(db);
    }
    catch (error) {
        console.error("Could not verify current billing pricing:", error);
        throw new https_1.HttpsError("unavailable", "Could not verify current pricing; no checkout session was created");
    }
    // Bill for the REAL active-employee count (live query), not the manually
    // curated tenant field — self-serve tenants add staff without ever touching
    // that field. Small teams are billed at the configured minimum, which is
    // five seats ($20/month) by default.
    const activeCount = await countActiveEmployees(db, tenantId);
    if (activeCount === null) {
        throw new https_1.HttpsError("unavailable", "Could not verify the active employee count; no checkout session was created");
    }
    const billedSeats = (0, billingPricing_1.calculateBilledSeats)(activeCount, pricing);
    if (activeCount !== tenant.currentEmployeeCount) {
        // Self-heal the stored count so the billing page and admin console agree.
        await tenantRef.set({ currentEmployeeCount: activeCount }, { merge: true });
    }
    const stripe = stripeClient();
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: tenant.billingEmail ||
                tenant.ownerEmail ||
                undefined,
            name: tenant.name || tenantId,
            metadata: { tenantId },
        });
        customerId = customer.id;
        await tenantRef.set({ stripeCustomerId: customerId }, { merge: true });
    }
    else {
        // Backstop for the double-subscribe race (finding 8): if a prior checkout
        // already produced a subscription but its webhook has not yet written
        // stripeSubscriptionId back to the tenant, refuse rather than create a
        // second one. Only pre-existing customers can already have subscriptions.
        const existing = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
        });
        if (existing.data.some((s) => BLOCKING_SUBSCRIPTION_STATUSES.has(s.status))) {
            throw new https_1.HttpsError("failed-precondition", "This tenant already has a Stripe subscription; use the billing portal instead");
        }
    }
    const base = safeReturnBase(returnUrl);
    const unitAmountCents = (0, billingPricing_1.getStripeUnitAmountCents)(pricing, billingInterval);
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
                        name: billingInterval === "year"
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
exports.createBillingPortalSession = (0, https_1.onCall)({ secrets: [STRIPE_SECRET_KEY], cors: true }, async (request) => {
    var _a, _b;
    const auth = (0, authz_1.requireAuth)(request);
    const { tenantId, returnUrl } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);
    const tenantSnap = await (0, firestore_1.getFirestore)().doc(`tenants/${tenantId}`).get();
    const customerId = (_b = tenantSnap.data()) === null || _b === void 0 ? void 0 : _b.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No billing account exists yet for this tenant");
    }
    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${safeReturnBase(returnUrl)}/billing`,
    });
    return { url: portal.url };
});
/**
 * Tenant billing snapshot for a LIVE Stripe subscription. Pure — the caller
 * writes it inside the watermark transaction so the ordering check and the
 * tenant write cannot be separated by a concurrent event's write.
 */
function buildSubscriptionPatch(sub) {
    var _a, _b, _c, _d, _e, _f, _g;
    const item = sub.items.data[0];
    const quantity = (_a = item === null || item === void 0 ? void 0 : item.quantity) !== null && _a !== void 0 ? _a : 1;
    const unitAmount = (_c = (_b = item === null || item === void 0 ? void 0 : item.price) === null || _b === void 0 ? void 0 : _b.unit_amount) !== null && _c !== void 0 ? _c : 0;
    const billingInterval = ((_e = (_d = item === null || item === void 0 ? void 0 : item.price) === null || _d === void 0 ? void 0 : _d.recurring) === null || _e === void 0 ? void 0 : _e.interval) === "year" ? "year" : "month";
    const annualMonthsChargedRaw = Number((_f = sub.metadata) === null || _f === void 0 ? void 0 : _f.annualMonthsCharged);
    const annualMonthsCharged = Number.isInteger(annualMonthsChargedRaw) &&
        annualMonthsChargedRaw >= 1 &&
        annualMonthsChargedRaw <= 12
        ? annualMonthsChargedRaw
        : 10;
    const { billingAmount, monthlyAmount, billingMonths } = (0, billingPricing_1.calculateSubscriptionAmounts)(unitAmount, quantity, billingInterval, annualMonthsCharged);
    const active = sub.status === "active" || sub.status === "trialing";
    const periodEndSec = readSubscriptionPeriodSec(sub, item, "current_period_end");
    const patch = {
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : (_g = sub.customer) === null || _g === void 0 ? void 0 : _g.id,
        monthlySubscriptionAmount: monthlyAmount,
        subscriptionBillingAmount: billingAmount,
        subscriptionBillingInterval: billingInterval,
        subscriptionBillingMonths: billingMonths,
        subscriptionBilledSeats: quantity,
        subscriptionAnnualMonthsCharged: annualMonthsCharged,
        // stripeSubscriptionId is the "can finalize payroll" gate; only set it while active.
        stripeSubscriptionId: active ? sub.id : firestore_1.FieldValue.delete(),
        // A subscription now exists (or is gone); release any in-flight checkout lock.
        pendingCheckout: firestore_1.FieldValue.delete(),
    };
    if (periodEndSec)
        patch.subscriptionPaidUntil = firestore_1.Timestamp.fromMillis(periodEndSec * 1000);
    return patch;
}
/** Subscription statuses meaning the subscription is gone — revert to free. */
const GONE_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);
/**
 * Billing fields for a tenant on free usage: drop the payroll-unlock and zero
 * the amounts. `releaseCheckoutLock` must be false on the checkout self-heal
 * path — that revert runs outside the checkout-lock transaction, and deleting
 * `pendingCheckout` there could destroy a lock a concurrent
 * createCheckoutSession call had just claimed (two live Checkout Sessions,
 * double billing). Webhook-driven reverts DO release the lock: a subscription
 * outcome ends the checkout the lock was guarding.
 */
function freeTenantPatch(releaseCheckoutLock) {
    const patch = {
        monthlySubscriptionAmount: 0,
        subscriptionBillingAmount: 0,
        subscriptionBillingInterval: firestore_1.FieldValue.delete(),
        subscriptionBillingMonths: firestore_1.FieldValue.delete(),
        subscriptionBilledSeats: firestore_1.FieldValue.delete(),
        subscriptionAnnualMonthsCharged: firestore_1.FieldValue.delete(),
        stripeSubscriptionId: firestore_1.FieldValue.delete(),
    };
    if (releaseCheckoutLock)
        patch.pendingCheckout = firestore_1.FieldValue.delete();
    return patch;
}
/**
 * Revert a tenant to free usage. Idempotent — safe to run on a
 * redelivered/duplicate cancel.
 */
async function revertTenantToFree(db, tenantId, opts) {
    await db
        .doc(`tenants/${tenantId}`)
        .set(freeTenantPatch(opts.releaseCheckoutLock), { merge: true });
}
/**
 * Reconcile a tenant's stored subscription state against LIVE Stripe state in
 * response to one webhook event. Stripe guarantees neither ordering nor
 * exactly-once delivery, so three guards make this safe to run for any event,
 * any number of times, in any order:
 *
 * 1. Live re-fetch — event.data.object is a snapshot from when the event
 *    fired; the subscription is re-fetched by id BEFORE the transaction and
 *    only that live state is ever written.
 * 2. Watermark — tenants/*.lastStripeSubscriptionEventAt records the newest
 *    event.created applied. It is checked AND advanced in the SAME
 *    transaction as the tenant write, so a slower handler holding a
 *    pre-cancel "active" fetch can never land after a cancellation's revert.
 * 3. Sub-id guard — a trailing event about an OLD subscription cannot
 *    overwrite the live one after a re-subscribe.
 *
 * Decision table, evaluated inside the transaction ("activating" = live
 * status is active/trialing, i.e. the write would set stripeSubscriptionId):
 *
 *   eventCreated <  watermark                  → drop (stale)
 *   eventCreated == watermark AND activating   → drop — a tie can be a
 *     concurrent handler's stale-active fetch racing a same-second cancel;
 *     ties never resurrect. Deactivating ties DO apply, so a released claim
 *     retried at eventCreated == watermark still reprocesses a cancellation.
 *   stored sub id set and != event's sub id    → drop (trailing event about
 *     an old subscription) — UNLESS source is "checkout" AND activating: our
 *     own checkout flow activating a newer subscription replaces the stored
 *     one.
 *   stored sub id empty AND not activating     → drop — the tenant is already
 *     free, and a dying old sub's late events must not advance the watermark
 *     past a still-in-flight re-subscribe activation.
 *   otherwise                                  → write the live state and
 *     advance the watermark (activating → apply; gone/lapsed → revert or
 *     deactivate).
 *
 * Dropped events never advance the watermark. A failure before commit leaves
 * everything untouched; the released event claim lets the redelivery retry.
 */
async function reconcileSubscriptionEvent(db, stripe, tenantId, subId, eventCreated, source) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const gone = GONE_SUBSCRIPTION_STATUSES.has(sub.status);
    const activating = !gone && (sub.status === "active" || sub.status === "trialing");
    const patch = gone ? freeTenantPatch(true) : buildSubscriptionPatch(sub);
    const ref = db.doc(`tenants/${tenantId}`);
    await db.runTransaction(async (tx) => {
        var _a;
        const snap = await tx.get(ref);
        if (!snap.exists)
            return;
        const data = snap.data();
        const last = (_a = data.lastStripeSubscriptionEventAt) !== null && _a !== void 0 ? _a : 0;
        if (eventCreated < last)
            return;
        if (eventCreated === last && activating)
            return;
        const storedSubId = typeof data.stripeSubscriptionId === "string"
            ? data.stripeSubscriptionId
            : "";
        if (storedSubId &&
            storedSubId !== subId &&
            !(source === "checkout" && activating)) {
            return;
        }
        if (!storedSubId && !activating)
            return;
        tx.set(ref, Object.assign({ lastStripeSubscriptionEventAt: eventCreated }, patch), { merge: true });
    });
}
/** Firestore collection of already-handled Stripe event ids (idempotency). */
const WEBHOOK_EVENTS_COLLECTION = "stripeWebhookEvents";
/**
 * A claim stuck in 'processing' longer than this was taken by an instance that
 * died between claim and completion (timeout/OOM/deploy kill) — the function
 * timeout is well under five minutes, so the holder cannot still be running.
 * A redelivery may re-claim it; without this horizon a killed instance would
 * ACK every future redelivery as a duplicate and e.g. a
 * customer.subscription.deleted would be lost for good.
 */
const WEBHOOK_CLAIM_STALE_MS = 5 * 60 * 1000;
/** Handled-event docs are kept (status 'done') and garbage-collected by a
 * Firestore TTL policy on `expiresAt` — the policy is created out-of-band with
 * gcloud; the field name matches the authEmails.ts throttle docs. */
const WEBHOOK_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Idempotency guard. Atomically claims a Stripe event.id (Stripe redelivers on
 * any non-2xx, on its retry schedule, and occasionally at-least-once even
 * after a 2xx). Claim lifecycle: 'processing' at claim → 'done' on success
 * (markWebhookEventDone). An in-process failure deletes the claim so the
 * redelivery reprocesses; a claim still 'processing' after
 * WEBHOOK_CLAIM_STALE_MS is re-claimed in case the holder died without
 * reaching either.
 */
async function claimWebhookEvent(db, event) {
    const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
            const data = snap.data();
            if (data.status !== "processing")
                return "duplicate"; // done — handled
            const claimedAt = data.claimedAt;
            const claimedAtMs = typeof (claimedAt === null || claimedAt === void 0 ? void 0 : claimedAt.toMillis) === "function" ? claimedAt.toMillis() : 0;
            if (Date.now() - claimedAtMs < WEBHOOK_CLAIM_STALE_MS)
                return "in-flight";
            // Stale 'processing' claim — the holder is dead; re-claim it.
        }
        tx.set(ref, {
            type: event.type,
            created: event.created,
            status: "processing",
            claimedAt: firestore_1.FieldValue.serverTimestamp(),
            expiresAt: firestore_1.Timestamp.fromMillis(Date.now() + WEBHOOK_EVENT_TTL_MS),
        });
        return "claimed";
    });
}
/** Successful handling keeps the claim doc (status 'done') so redeliveries
 * stay duplicates until the TTL policy clears it. */
async function markWebhookEventDone(db, eventId) {
    await db
        .collection(WEBHOOK_EVENTS_COLLECTION)
        .doc(eventId)
        .set({ status: "done" }, { merge: true });
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
async function syncAnnualSeats(stripe, sub, item, desiredQuantity, tenantDoc) {
    var _a;
    const subId = sub.id;
    const currentQty = (_a = item.quantity) !== null && _a !== void 0 ? _a : 0;
    const startSec = readSubscriptionPeriodSec(sub, item, "current_period_start");
    const termStartMs = typeof startSec === "number" ? startSec * 1000 : undefined;
    const stored = tenantDoc.data();
    const paidSeats = (0, billingPricing_1.effectiveAnnualPaidSeats)(stored.subscriptionAnnualPaidSeats, stored.subscriptionTermStart, termStartMs, currentQty);
    const updates = (0, billingPricing_1.planAnnualSeatUpdates)(currentQty, desiredQuantity, paidSeats);
    for (const update of updates) {
        await stripe.subscriptions.update(subId, {
            items: [{ id: item.id, quantity: update.quantity }],
            proration_behavior: update.prorationBehavior,
        });
    }
    if (updates.length > 0) {
        console.log(`Tenant ${tenantDoc.id}: annual seats ${currentQty} -> ${desiredQuantity} ` +
            `(paid peak this term: ${paidSeats})`);
    }
    // Persist the banked peak (and advance the term baseline on renewal) so
    // re-adds stay free and survive a delayed/lost webhook. newPaidSeats never
    // drops: a reduction keeps the peak, an invoiced increase raises it.
    const newPaidSeats = Math.max(paidSeats, desiredQuantity);
    const patch = {};
    if (stored.subscriptionAnnualPaidSeats !== newPaidSeats) {
        patch.subscriptionAnnualPaidSeats = newPaidSeats;
    }
    if (termStartMs !== undefined &&
        stored.subscriptionTermStart !== termStartMs) {
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
exports.syncSubscriptionQuantities = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *", // daily at 03:00 Dili time (quiet hours)
    timeZone: "Asia/Dili",
    secrets: [STRIPE_SECRET_KEY],
}, async () => {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const stripe = stripeClient();
    const pricing = await getBillingPricing(db);
    // Only tenants with a live subscription flag (non-empty string field).
    const subscribed = await db
        .collection("tenants")
        .where("stripeSubscriptionId", ">", "")
        .get();
    for (const tenantDoc of subscribed.docs) {
        const tenantId = tenantDoc.id;
        const subId = tenantDoc.data().stripeSubscriptionId;
        try {
            const activeCount = await countActiveEmployees(db, tenantId);
            if (activeCount === null)
                continue; // count failed; retry tomorrow
            const quantity = (0, billingPricing_1.calculateBilledSeats)(activeCount, pricing);
            const sub = await stripe.subscriptions.retrieve(subId);
            if (sub.status !== "active" && sub.status !== "trialing")
                continue;
            const item = sub.items.data[0];
            if (item && ((_a = item.price.recurring) === null || _a === void 0 ? void 0 : _a.interval) === "year") {
                await syncAnnualSeats(stripe, sub, item, quantity, tenantDoc);
            }
            else if (item && item.quantity !== quantity) {
                // Monthly: quantity change applies on the next invoice, no part-month
                // proration in either direction (unchanged behaviour).
                await stripe.subscriptions.update(subId, {
                    items: [{ id: item.id, quantity }],
                    proration_behavior: "none",
                });
                console.log(`Tenant ${tenantId}: subscription quantity ${item.quantity} -> ${quantity}`);
            }
            // Self-heal the stored count so billing/admin pages agree.
            if (tenantDoc.data().currentEmployeeCount !== activeCount) {
                await tenantDoc.ref.set({ currentEmployeeCount: activeCount }, { merge: true });
            }
        }
        catch (error) {
            // One bad tenant must not block the rest of the sweep.
            console.error(`Quantity sync failed for tenant ${tenantId}:`, error);
        }
    }
});
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
exports.sendRenewalReminders = (0, scheduler_1.onSchedule)({
    schedule: "0 8 * * *", // daily at 08:00 Dili time — lands in the morning
    timeZone: "Asia/Dili",
}, async () => {
    var _a, _b, _c, _d, _e;
    const db = (0, firestore_1.getFirestore)();
    const snapshot = await db
        .collection("tenants")
        .where("manualSubscription", "==", true)
        .get();
    for (const tenantDoc of snapshot.docs) {
        const tenantId = tenantDoc.id;
        try {
            const data = tenantDoc.data();
            // A live Stripe subscription supersedes the manual one — skip.
            if (data.stripeSubscriptionId)
                continue;
            const paidUntilTs = data.subscriptionPaidUntil;
            if (!paidUntilTs || typeof paidUntilTs.toMillis !== "function")
                continue;
            const paidUntilMs = paidUntilTs.toMillis();
            const daysLeft = (paidUntilMs - Date.now()) / (24 * 60 * 60 * 1000);
            const stage = daysLeft < 0
                ? "lapsed"
                : daysLeft <= 1
                    ? "d1"
                    : daysLeft <= 7
                        ? "d7"
                        : null;
            if (!stage)
                continue;
            const sentFor = ((_a = data.renewalReminders) !== null && _a !== void 0 ? _a : {});
            if (sentFor[stage] === paidUntilMs)
                continue; // already sent this period
            const name = data.name || tenantId;
            const paidUntilStr = new Date(paidUntilMs).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Dili",
            });
            const daysLeftLabel = Math.max(0, Math.ceil(daysLeft));
            const tenantEmail = data.billingEmail || data.ownerEmail || null;
            const subject = stage === "lapsed"
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
                "- Request an invoice from your Billing page: https://app.xefe.tl/billing",
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
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            await mail.add({
                tenantId,
                to: [BILLING_OPS_EMAIL],
                subject: stage === "lapsed"
                    ? `[Xefe ops] ${name}: manual subscription LAPSED (${paidUntilStr})`
                    : `[Xefe ops] ${name}: manual subscription expires in ${daysLeftLabel}d (${paidUntilStr})`,
                text: [
                    `Tenant: ${name} (${tenantId})`,
                    `Paid until: ${paidUntilStr}`,
                    `Standard monthly value: $${Number((_b = data.monthlySubscriptionAmount) !== null && _b !== void 0 ? _b : 0)}`,
                    `Last payment: $${Number((_d = (_c = data.subscriptionBillingAmount) !== null && _c !== void 0 ? _c : data.monthlySubscriptionAmount) !== null && _d !== void 0 ? _d : 0)} for ${Number((_e = data.subscriptionBillingMonths) !== null && _e !== void 0 ? _e : 1)} month(s)`,
                    `Tenant contact: ${tenantEmail !== null && tenantEmail !== void 0 ? tenantEmail : "NO EMAIL ON FILE — contact them another way"}`,
                    "",
                    "Once payment arrives, record it in Admin -> Tenants -> Record offline payment.",
                ].join("\n"),
                status: "pending",
                purpose: "billing-renewal-reminder-ops",
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            await tenantDoc.ref.set({ renewalReminders: { [stage]: paidUntilMs } }, { merge: true });
        }
        catch (error) {
            // One bad tenant must not block the rest of the sweep.
            console.error(`Renewal reminder failed for tenant ${tenantId}:`, error);
        }
    }
});
exports.stripeWebhook = (0, https_1.onRequest)({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
    var _a, _b;
    const stripe = stripeClient();
    const signature = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
    }
    catch (error) {
        console.error("Webhook signature verification failed:", error);
        res.status(400).send(`Webhook Error: ${error.message}`);
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    // Idempotency: skip an event.id we have already handled (Stripe redelivers).
    const claim = await claimWebhookEvent(db, event);
    if (claim === "duplicate") {
        res.json({ received: true, duplicate: true });
        return;
    }
    if (claim === "in-flight") {
        // Another instance is mid-event. A 2xx would end Stripe's retries even
        // if that instance dies before finishing; 409 keeps the redelivery
        // schedule alive until the claim is marked done or goes stale.
        res.status(409).send("Event is already being processed");
        return;
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const tenantId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (tenantId && session.subscription) {
                    const subId = typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription.id;
                    // "checkout": completing OUR OWN session is the one signal allowed
                    // to activate a newer subscription than the stored one.
                    await reconcileSubscriptionEvent(db, stripe, tenantId, subId, event.created, "checkout");
                }
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                // event.data.object is a snapshot from when the event fired and can be
                // stale on an out-of-order/redelivered event. reconcileSubscriptionEvent
                // re-fetches LIVE state by id, so a delayed "updated" carrying a
                // pre-cancel "active" snapshot cannot resurrect a canceled sub.
                const staleSub = event.data.object;
                const tenantId = (_b = staleSub.metadata) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (tenantId) {
                    await reconcileSubscriptionEvent(db, stripe, tenantId, staleSub.id, event.created, "subscription");
                }
                break;
            }
            default:
                break;
        }
        // A failure to mark done falls into the catch below, which releases the
        // claim; reprocessing is safe because the handlers above are convergent.
        await markWebhookEventDone(db, event.id);
        res.json({ received: true });
    }
    catch (error) {
        // Release the idempotency claim so Stripe's redelivery reprocesses this
        // event instead of it being silently swallowed as a duplicate.
        await db
            .collection(WEBHOOK_EVENTS_COLLECTION)
            .doc(event.id)
            .delete()
            .catch((cleanupError) => console.error("Failed to release webhook event claim after error:", cleanupError));
        console.error("Webhook handler error:", error);
        res.status(500).send("Webhook handler failed");
    }
});
//# sourceMappingURL=billing.js.map