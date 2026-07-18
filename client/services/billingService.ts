/**
 * Client-side Stripe billing helpers. All secret-key work happens in Cloud
 * Functions; the client only invokes callables and redirects to Stripe.
 */
import { getFunctionsLazy } from "@/lib/firebase";
import type { BillingInterval } from "@/lib/packagePricing";

async function callable<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import("firebase/functions"),
    getFunctionsLazy(),
  ]);
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const result = await fn(data);
  return result.data;
}

export const billingService = {
  /**
   * Create a Stripe Checkout session for the chosen billing cycle and redirect
   * the browser to it. Stripe recalculates seats server-side; the client does
   * not submit a price or quantity.
   */
  async startCheckout(tenantId: string, billingInterval: BillingInterval): Promise<void> {
    const { url } = await callable<
      { tenantId: string; returnUrl: string; billingInterval: BillingInterval },
      { url: string | null }
    >("createCheckoutSession", {
      tenantId,
      returnUrl: window.location.origin,
      billingInterval,
    });
    if (!url) throw new Error("Stripe did not return a checkout URL");
    window.location.assign(url);
  },

  /**
   * Open the Stripe billing portal (manage/cancel/update payment method).
   */
  async openBillingPortal(tenantId: string): Promise<void> {
    const { url } = await callable<
      { tenantId: string; returnUrl: string },
      { url: string | null }
    >("createBillingPortalSession", { tenantId, returnUrl: window.location.origin });
    if (!url) throw new Error("Stripe did not return a billing-portal URL");
    window.location.assign(url);
  },
};
