/**
 * Stripe billing — per-employee subscriptions.
 *
 * Pricing is purely per-employee: a subscription has a single line item priced
 * at the plan's per-employee rate with quantity = the tenant's employee count.
 *
 * Secrets (set with `firebase functions:secrets:set`):
 *   STRIPE_SECRET_KEY      — the ROTATED live/test secret key (sk_...)
 *   STRIPE_WEBHOOK_SECRET  — the signing secret of the webhook endpoint (whsec_...)
 */
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { requireAuth, requireTenantAdmin } from "./authz";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const PACKAGES_CONFIG_PATH = "platform/packagesConfig";
const DEFAULT_APP_URL = "https://payroll.naroman.tl";

// Fallback per-employee rates if the packages config doc is missing a plan.
const DEFAULT_RATES: Record<string, number> = {
  free: 0,
  starter: 2,
  professional: 4,
  enterprise: 6,
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

async function getPlanRate(
  db: FirebaseFirestore.Firestore,
  planId: string,
): Promise<number> {
  try {
    const snap = await db.doc(PACKAGES_CONFIG_PATH).get();
    const plans = (snap.data()?.planDefinitions ?? []) as Array<{
      id?: string;
      pricePerEmployee?: number;
    }>;
    const match = plans.find((p) => p.id === planId);
    if (match && typeof match.pricePerEmployee === "number" && Number.isFinite(match.pricePerEmployee)) {
      return Math.max(0, match.pricePerEmployee);
    }
  } catch (error) {
    console.warn("Could not read packages config, using default rate:", error);
  }
  return DEFAULT_RATES[planId] ?? 0;
}

interface CheckoutData {
  tenantId?: string;
  planId?: string;
  returnUrl?: string;
}

export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const { uid } = requireAuth(request);
    const { tenantId, planId, returnUrl } = (request.data ?? {}) as CheckoutData;
    if (!tenantId || !planId) {
      throw new HttpsError("invalid-argument", "tenantId and planId are required");
    }
    if (planId === "free") {
      throw new HttpsError("failed-precondition", "The Free plan does not require checkout");
    }
    await requireTenantAdmin(tenantId, uid);

    const db = getFirestore();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw new HttpsError("not-found", "Tenant not found");
    }
    const tenant = tenantSnap.data() as Record<string, unknown>;

    const rate = await getPlanRate(db, planId);
    if (rate <= 0) {
      throw new HttpsError("failed-precondition", "This plan has no per-employee price set");
    }
    // Stripe requires quantity >= 1; a brand-new tenant with 0 employees is
    // billed for 1 seat until the count syncs upward.
    const employeeCount = Math.max(1, Math.floor((tenant.currentEmployeeCount as number) ?? 1));

    const stripe = stripeClient();
    let customerId = tenant.stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (tenant.billingEmail as string) || (tenant.ownerEmail as string) || undefined,
        name: (tenant.name as string) || tenantId,
        metadata: { tenantId },
      });
      customerId = customer.id;
      await tenantRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const base = (returnUrl as string) || DEFAULT_APP_URL;
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
            product_data: { name: `Xefe ${PLAN_LABELS[planId] ?? planId} — per employee` },
          },
        },
      ],
      metadata: { tenantId, planId },
      subscription_data: { metadata: { tenantId, planId } },
      allow_promotion_codes: true,
      success_url: `${base}/billing?status=success`,
      cancel_url: `${base}/billing?status=cancel`,
    });

    return { url: session.url };
  },
);

export const createBillingPortalSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const { uid } = requireAuth(request);
    const { tenantId, returnUrl } = (request.data ?? {}) as CheckoutData;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    await requireTenantAdmin(tenantId, uid);

    const tenantSnap = await getFirestore().doc(`tenants/${tenantId}`).get();
    const customerId = tenantSnap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) {
      throw new HttpsError("failed-precondition", "No billing account exists yet for this tenant");
    }

    const stripe = stripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${(returnUrl as string) || DEFAULT_APP_URL}/billing`,
    });
    return { url: portal.url };
  },
);

async function applySubscription(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  planId: string | undefined,
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const quantity = item?.quantity ?? 1;
  const unitAmount = item?.price?.unit_amount ?? 0;
  const amount = (unitAmount * quantity) / 100;
  const active = sub.status === "active" || sub.status === "trialing";

  // current_period_end lives on the subscription (older API) or its items (newer).
  const periodEndSec =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number })?.current_period_end;

  const patch: Record<string, unknown> = {
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    monthlySubscriptionAmount: amount,
    status: active ? "active" : "suspended",
  };
  if (planId) patch.plan = planId;
  if (periodEndSec) patch.subscriptionPaidUntil = Timestamp.fromMillis(periodEndSec * 1000);

  await db.doc(`tenants/${tenantId}`).set(patch, { merge: true });
}

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
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const tenantId = session.metadata?.tenantId;
          const planId = session.metadata?.planId;
          if (tenantId && session.subscription) {
            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
            const sub = await stripe.subscriptions.retrieve(subId);
            await applySubscription(db, tenantId, planId, sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenantId;
          if (tenantId) await applySubscription(db, tenantId, sub.metadata?.planId, sub);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenantId;
          if (tenantId) {
            await db.doc(`tenants/${tenantId}`).set(
              {
                status: "active",
                plan: "free",
                monthlySubscriptionAmount: 0,
                stripeSubscriptionId: FieldValue.delete(),
              },
              { merge: true },
            );
          }
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook handler error:", error);
      res.status(500).send("Webhook handler failed");
    }
  },
);
