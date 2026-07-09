"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createBillingPortalSession = exports.createCheckoutSession = void 0;
/**
 * Stripe billing — one flat per-employee subscription.
 *
 * Every account has every feature for free; a subscription is what unlocks
 * finalizing payroll runs. The subscription is a single line item priced at the
 * flat per-employee rate with quantity = the tenant's employee count.
 *
 * Secrets (set with `firebase functions:secrets:set`):
 *   STRIPE_SECRET_KEY      — the secret key (sk_...)
 *   STRIPE_WEBHOOK_SECRET  — the webhook endpoint signing secret (whsec_...)
 */
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const authz_1 = require("./authz");
const STRIPE_SECRET_KEY = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
const PACKAGES_CONFIG_PATH = "platform/packagesConfig";
const DEFAULT_APP_URL = "https://payroll.naroman.tl";
const DEFAULT_RATE = 4; // fallback per-employee rate if config is missing
function stripeClient() {
    return new stripe_1.default(STRIPE_SECRET_KEY.value());
}
async function getPerEmployeeRate(db) {
    var _a;
    try {
        const snap = await db.doc(PACKAGES_CONFIG_PATH).get();
        const rate = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.pricePerEmployee;
        if (typeof rate === "number" && Number.isFinite(rate) && rate > 0)
            return rate;
    }
    catch (error) {
        console.warn("Could not read packages config, using default rate:", error);
    }
    return DEFAULT_RATE;
}
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [STRIPE_SECRET_KEY], cors: true }, async (request) => {
    var _a, _b;
    const { uid } = (0, authz_1.requireAuth)(request);
    const { tenantId, returnUrl } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, authz_1.requireTenantAdmin)(tenantId, uid);
    const db = (0, firestore_1.getFirestore)();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
        throw new https_1.HttpsError("not-found", "Tenant not found");
    }
    const tenant = tenantSnap.data();
    const rate = await getPerEmployeeRate(db);
    // Stripe requires quantity >= 1; a tenant with 0 employees is billed for 1
    // seat until the count syncs upward.
    const employeeCount = Math.max(1, Math.floor((_b = tenant.currentEmployeeCount) !== null && _b !== void 0 ? _b : 1));
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
    const base = returnUrl || DEFAULT_APP_URL;
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
            {
                quantity: employeeCount,
                price_data: {
                    currency: "usd",
                    unit_amount: Math.round(rate * 100),
                    recurring: { interval: "month" },
                    product_data: { name: "Xefe — per employee" },
                },
            },
        ],
        metadata: { tenantId },
        subscription_data: { metadata: { tenantId } },
        allow_promotion_codes: true,
        success_url: `${base}/billing?status=success`,
        cancel_url: `${base}/billing?status=cancel`,
    });
    return { url: session.url };
});
exports.createBillingPortalSession = (0, https_1.onCall)({ secrets: [STRIPE_SECRET_KEY], cors: true }, async (request) => {
    var _a, _b;
    const { uid } = (0, authz_1.requireAuth)(request);
    const { tenantId, returnUrl } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, authz_1.requireTenantAdmin)(tenantId, uid);
    const tenantSnap = await (0, firestore_1.getFirestore)().doc(`tenants/${tenantId}`).get();
    const customerId = (_b = tenantSnap.data()) === null || _b === void 0 ? void 0 : _b.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No billing account exists yet for this tenant");
    }
    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${returnUrl || DEFAULT_APP_URL}/billing`,
    });
    return { url: portal.url };
});
async function applySubscription(db, tenantId, sub) {
    var _a, _b, _c, _d, _e;
    const item = sub.items.data[0];
    const quantity = (_a = item === null || item === void 0 ? void 0 : item.quantity) !== null && _a !== void 0 ? _a : 1;
    const unitAmount = (_c = (_b = item === null || item === void 0 ? void 0 : item.price) === null || _b === void 0 ? void 0 : _b.unit_amount) !== null && _c !== void 0 ? _c : 0;
    const amount = (unitAmount * quantity) / 100;
    const active = sub.status === "active" || sub.status === "trialing";
    const periodEndSec = (_d = sub.current_period_end) !== null && _d !== void 0 ? _d : item === null || item === void 0 ? void 0 : item.current_period_end;
    const patch = {
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : (_e = sub.customer) === null || _e === void 0 ? void 0 : _e.id,
        monthlySubscriptionAmount: amount,
        // stripeSubscriptionId is the "can finalize payroll" gate; only set it while active.
        stripeSubscriptionId: active ? sub.id : firestore_1.FieldValue.delete(),
    };
    if (periodEndSec)
        patch.subscriptionPaidUntil = firestore_1.Timestamp.fromMillis(periodEndSec * 1000);
    await db.doc(`tenants/${tenantId}`).set(patch, { merge: true });
}
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