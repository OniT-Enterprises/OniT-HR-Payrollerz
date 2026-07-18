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
const DEFAULT_APP_URL = "https://xefe.tl";
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
    return typeof (paidUntil === null || paidUntil === void 0 ? void 0 : paidUntil.toMillis) === "function" && paidUntil.toMillis() > Date.now();
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
    const billingInterval = ((_b = request.data) === null || _b === void 0 ? void 0 : _b.billingInterval) === "year" ? "year" : "month";
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);
    const db = (0, firestore_1.getFirestore)();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
        throw new https_1.HttpsError("not-found", "Tenant not found");
    }
    const tenant = tenantSnap.data();
    if (typeof tenant.stripeSubscriptionId === "string" && tenant.stripeSubscriptionId) {
        throw new https_1.HttpsError("failed-precondition", "This tenant already has an active Stripe subscription; use the billing portal instead");
    }
    if (hasActiveManualSubscription(tenant)) {
        throw new https_1.HttpsError("failed-precondition", "This tenant already has an active offline subscription");
    }
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
            email: tenant.billingEmail || tenant.ownerEmail || undefined,
            name: tenant.name || tenantId,
            metadata: { tenantId },
        });
        customerId = customer.id;
        await tenantRef.set({ stripeCustomerId: customerId }, { merge: true });
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
});
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
async function applySubscription(db, tenantId, sub) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const item = sub.items.data[0];
    const quantity = (_a = item === null || item === void 0 ? void 0 : item.quantity) !== null && _a !== void 0 ? _a : 1;
    const unitAmount = (_c = (_b = item === null || item === void 0 ? void 0 : item.price) === null || _b === void 0 ? void 0 : _b.unit_amount) !== null && _c !== void 0 ? _c : 0;
    const billingInterval = ((_e = (_d = item === null || item === void 0 ? void 0 : item.price) === null || _d === void 0 ? void 0 : _d.recurring) === null || _e === void 0 ? void 0 : _e.interval) === "year" ? "year" : "month";
    const annualMonthsChargedRaw = Number((_f = sub.metadata) === null || _f === void 0 ? void 0 : _f.annualMonthsCharged);
    const annualMonthsCharged = Number.isInteger(annualMonthsChargedRaw) && annualMonthsChargedRaw >= 1 && annualMonthsChargedRaw <= 12
        ? annualMonthsChargedRaw
        : 10;
    const { billingAmount, monthlyAmount, billingMonths } = (0, billingPricing_1.calculateSubscriptionAmounts)(unitAmount, quantity, billingInterval, annualMonthsCharged);
    const active = sub.status === "active" || sub.status === "trialing";
    const periodEndSec = (_g = sub.current_period_end) !== null && _g !== void 0 ? _g : item === null || item === void 0 ? void 0 : item.current_period_end;
    const patch = {
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : (_h = sub.customer) === null || _h === void 0 ? void 0 : _h.id,
        monthlySubscriptionAmount: monthlyAmount,
        subscriptionBillingAmount: billingAmount,
        subscriptionBillingInterval: billingInterval,
        subscriptionBillingMonths: billingMonths,
        subscriptionBilledSeats: quantity,
        subscriptionAnnualMonthsCharged: annualMonthsCharged,
        // stripeSubscriptionId is the "can finalize payroll" gate; only set it while active.
        stripeSubscriptionId: active ? sub.id : firestore_1.FieldValue.delete(),
    };
    if (periodEndSec)
        patch.subscriptionPaidUntil = firestore_1.Timestamp.fromMillis(periodEndSec * 1000);
    await db.doc(`tenants/${tenantId}`).set(patch, { merge: true });
}
/**
 * Daily true-up: keep each subscribed tenant's Stripe quantity equal to their
 * billed employee count (active staff or the configured minimum), so "more
 * employees cost more" stays true after
 * checkout day (quantity is otherwise frozen at whatever it was on subscribe).
 * Monthly plans change on the next invoice without part-month charges. Annual
 * plans immediately prorate added seats so a customer cannot add staff for free
 * for the rest of a prepaid year; seat reductions take effect at renewal. The
 * customer.subscription.updated webhook then syncs the tenant billing snapshot.
 */
exports.syncSubscriptionQuantities = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *", // daily at 03:00 Dili time (quiet hours)
    timeZone: "Asia/Dili",
    secrets: [STRIPE_SECRET_KEY],
}, async () => {
    var _a, _b;
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
            if (item && item.quantity !== quantity) {
                const annualIncrease = ((_a = item.price.recurring) === null || _a === void 0 ? void 0 : _a.interval) === "year" && quantity > ((_b = item.quantity) !== null && _b !== void 0 ? _b : 0);
                await stripe.subscriptions.update(subId, {
                    items: [{ id: item.id, quantity }],
                    proration_behavior: annualIncrease ? "always_invoice" : "none",
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
            const stage = daysLeft < 0 ? "lapsed" : daysLeft <= 1 ? "d1" : daysLeft <= 7 ? "d7" : null;
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
    var _a, _b, _c;
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
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const tenantId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.tenantId;
                if (tenantId && session.subscription) {
                    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                    const sub = await stripe.subscriptions.retrieve(subId);
                    await applySubscription(db, tenantId, sub);
                }
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const sub = event.data.object;
                const tenantId = (_b = sub.metadata) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (tenantId)
                    await applySubscription(db, tenantId, sub);
                break;
            }
            case "customer.subscription.deleted": {
                const sub = event.data.object;
                const tenantId = (_c = sub.metadata) === null || _c === void 0 ? void 0 : _c.tenantId;
                if (tenantId) {
                    // Revert to free usage: drop the payroll-unlock, zero the amount.
                    await db.doc(`tenants/${tenantId}`).set({
                        monthlySubscriptionAmount: 0,
                        subscriptionBillingAmount: 0,
                        subscriptionBillingInterval: firestore_1.FieldValue.delete(),
                        subscriptionBillingMonths: firestore_1.FieldValue.delete(),
                        subscriptionBilledSeats: firestore_1.FieldValue.delete(),
                        subscriptionAnnualMonthsCharged: firestore_1.FieldValue.delete(),
                        stripeSubscriptionId: firestore_1.FieldValue.delete(),
                    }, { merge: true });
                }
                break;
            }
            default:
                break;
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error("Webhook handler error:", error);
        res.status(500).send("Webhook handler failed");
    }
});
//# sourceMappingURL=billing.js.map