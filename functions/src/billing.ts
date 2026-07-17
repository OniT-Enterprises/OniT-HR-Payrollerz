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
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { isSuperAdmin, requireAuth, requireTenantAdmin, type AuthContext } from "./authz";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

const PACKAGES_CONFIG_PATH = "platform/packagesConfig";
const DEFAULT_APP_URL = "https://xefe.tl";
const DEFAULT_RATE = 4; // fallback per-employee rate if config is missing

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

async function getPerEmployeeRate(db: FirebaseFirestore.Firestore): Promise<number> {
  try {
    const snap = await db.doc(PACKAGES_CONFIG_PATH).get();
    const rate = snap.data()?.pricePerEmployee;
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
  } catch (error) {
    console.warn("Could not read packages config, using default rate:", error);
  }
  return DEFAULT_RATE;
}

/**
 * Count the tenant's ACTIVE employees at checkout time. The source of truth is
 * the employees subcollection — tenants add staff themselves, so the manually
 * curated `currentEmployeeCount` field goes stale and must not drive billing.
 * Returns null if the aggregate query fails (caller falls back to the field).
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
    console.error("Active-employee count failed, falling back to stored count:", error);
    return null;
  }
}

interface CheckoutData {
  tenantId?: string;
  returnUrl?: string;
}

/**
 * Billing actions are for tenant owners/hr-admins — or superadmins, who can
 * run billing on any tenant (e.g. while impersonating a demo tenant). This
 * mirrors firestore.rules, where isSuperAdmin() passes everywhere; without it
 * the UI shows "Subscribe now" during impersonation but the callable 403s.
 */
async function requireBillingManager(tenantId: string, auth: AuthContext): Promise<void> {
  if (await isSuperAdmin(auth.uid, auth.token)) return;
  await requireTenantAdmin(tenantId, auth.uid);
}

export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const auth = requireAuth(request);
    const { tenantId, returnUrl } = (request.data ?? {}) as CheckoutData;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    await requireBillingManager(tenantId, auth);

    const db = getFirestore();
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw new HttpsError("not-found", "Tenant not found");
    }
    const tenant = tenantSnap.data() as Record<string, unknown>;

    const rate = await getPerEmployeeRate(db);
    // Bill for the REAL active-employee count (live query), not the manually
    // curated tenant field — self-serve tenants add staff without ever touching
    // that field. Stripe requires quantity >= 1, so a tenant with 0 employees
    // is billed for 1 seat until the count syncs upward.
    const activeCount = await countActiveEmployees(db, tenantId);
    const employeeCount = Math.max(
      1,
      activeCount ?? Math.floor((tenant.currentEmployeeCount as number) ?? 1),
    );
    if (activeCount !== null && activeCount !== tenant.currentEmployeeCount) {
      // Self-heal the stored count so the billing page and admin console agree.
      await tenantRef.set({ currentEmployeeCount: activeCount }, { merge: true });
    }

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
  },
);

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
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const quantity = item?.quantity ?? 1;
  const unitAmount = item?.price?.unit_amount ?? 0;
  const amount = (unitAmount * quantity) / 100;
  const active = sub.status === "active" || sub.status === "trialing";

  const periodEndSec =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number })?.current_period_end;

  const patch: Record<string, unknown> = {
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    monthlySubscriptionAmount: amount,
    // stripeSubscriptionId is the "can finalize payroll" gate; only set it while active.
    stripeSubscriptionId: active ? sub.id : FieldValue.delete(),
  };
  if (periodEndSec) patch.subscriptionPaidUntil = Timestamp.fromMillis(periodEndSec * 1000);

  await db.doc(`tenants/${tenantId}`).set(patch, { merge: true });
}

/**
 * Daily true-up: keep each subscribed tenant's Stripe quantity equal to their
 * ACTIVE employee count, so "more employees cost more" stays true after
 * checkout day (quantity is otherwise frozen at whatever it was on subscribe).
 * proration_behavior 'none' means no mid-cycle part-charges — the next monthly
 * invoice simply bills the current team size. The customer.subscription.updated
 * webhook then syncs monthlySubscriptionAmount on the tenant doc.
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
        const quantity = Math.max(1, activeCount);

        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.status !== "active" && sub.status !== "trialing") continue;

        const item = sub.items.data[0];
        if (item && item.quantity !== quantity) {
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
          await tenantDoc.ref.set({ currentEmployeeCount: activeCount }, { merge: true });
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
        if (!paidUntilTs || typeof paidUntilTs.toMillis !== "function") continue;

        const paidUntilMs = paidUntilTs.toMillis();
        const daysLeft = (paidUntilMs - Date.now()) / (24 * 60 * 60 * 1000);
        const stage =
          daysLeft < 0 ? "lapsed" : daysLeft <= 1 ? "d1" : daysLeft <= 7 ? "d7" : null;
        if (!stage) continue;

        const sentFor = (data.renewalReminders ?? {}) as Record<string, unknown>;
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
            `Monthly amount: $${Number(data.monthlySubscriptionAmount ?? 0)}`,
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
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const tenantId = session.metadata?.tenantId;
          if (tenantId && session.subscription) {
            const subId =
              typeof session.subscription === "string" ? session.subscription : session.subscription.id;
            const sub = await stripe.subscriptions.retrieve(subId);
            await applySubscription(db, tenantId, sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenantId;
          if (tenantId) await applySubscription(db, tenantId, sub);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const tenantId = sub.metadata?.tenantId;
          if (tenantId) {
            // Revert to free usage: drop the payroll-unlock, zero the amount.
            await db.doc(`tenants/${tenantId}`).set(
              {
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
