import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, Landmark, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { usePackagesConfig } from "@/hooks/useAdmin";
import { useTenantBilling } from "@/hooks/useBilling";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { ALL_FEATURES, isTenantSubscribed, normalizeBillingPackagesConfig } from "@/lib/packagePricing";
import { billingService } from "@/services/billingService";
import { notificationService } from "@/services/notificationService";
import { toast } from "sonner";

// Where offline-payment (bank transfer / cash) invoice requests are sent.
const BILLING_SUPPORT_EMAIL = "info@naroman.tl";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export default function Billing() {
  const tenantId = useTenantId();
  const { canManage, session } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: packagesConfig } = usePackagesConfig();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [invoiceRequestState, setInvoiceRequestState] = useState<"idle" | "sending" | "sent">("idle");
  const autoCheckoutFired = useRef(false);

  const rate = normalizeBillingPackagesConfig(packagesConfig).pricePerEmployee;

  const { data: tenant, isLoading, refetch } = useTenantBilling();
  // Live active-employee count — checkout bills this number (the stored
  // currentEmployeeCount field goes stale for self-serve tenants).
  const { data: employeeSummary } = useActiveEmployeeSummary(canManage());

  const subscribed = tenant ? isTenantSubscribed(tenant) : false;
  const employees = employeeSummary?.active ?? tenant?.currentEmployeeCount ?? 0;
  const projected = rate * employees;
  const paidUntil = tenant?.subscriptionPaidUntil?.toDate?.();

  const startCheckout = async () => {
    if (!canManage()) {
      toast.error("Only owners and admins can manage billing");
      return;
    }
    setCheckoutBusy(true);
    try {
      await billingService.startCheckout(tenantId);
    } catch (error) {
      console.error(error);
      toast.error("Could not start checkout. Please try again.");
      setCheckoutBusy(false);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      await billingService.openBillingPortal(tenantId);
    } catch (error) {
      console.error(error);
      toast.error("Could not open the billing portal.");
      setPortalBusy(false);
    }
  };

  // Offline path for the many TL businesses without cards: queue an email to
  // us; we send an invoice, they pay by bank transfer or cash, and a
  // superadmin activates the subscription in Admin once payment lands.
  const requestInvoice = async () => {
    if (!canManage()) {
      toast.error("Only owners and admins can manage billing");
      return;
    }
    setInvoiceRequestState("sending");
    try {
      const companyName = session?.config?.name || tenantId;
      const contactEmail = user?.email || "unknown";
      await notificationService.queueEmail({
        tenantId,
        to: BILLING_SUPPORT_EMAIL,
        replyTo: user?.email || undefined,
        subject: `Xefe invoice request — ${companyName} (${employees} employees, ${formatMoney(projected)}/mo)`,
        text: [
          `Tenant: ${companyName} (${tenantId})`,
          `Requested by: ${contactEmail}`,
          `Active employees: ${employees}`,
          `Rate: ${formatMoney(rate)}/employee/month`,
          `Monthly total: ${formatMoney(projected)}`,
          "",
          "The tenant wants to subscribe by bank transfer or cash.",
          "Send them an invoice, then record the payment in Admin → Tenants once it arrives.",
        ].join("\n"),
        purpose: "billing-invoice-request",
      });
      setInvoiceRequestState("sent");
      toast.success("Request sent — we'll email your invoice with payment details.");
    } catch (error) {
      console.error(error);
      setInvoiceRequestState("idle");
      toast.error("Could not send the request. Please try again.");
    }
  };

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Subscription active — you can now run payroll. Thank you!");
      void refetch();
    } else if (status === "cancel") {
      toast.message("Checkout canceled — no charge was made.");
    }

    if (searchParams.get("checkout") && !autoCheckoutFired.current && canManage()) {
      autoCheckoutFired.current = true;
      void startCheckout();
    }

    if (status || searchParams.get("checkout")) {
      const next = new URLSearchParams(searchParams);
      next.delete("status");
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManage]);

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title="Billing & Plan"
          subtitle="Every feature is free to use. A subscription unlocks finalizing payroll runs."
          icon={CreditCard}
          iconColor="text-primary"
        />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Subscription card */}
            <Card className={subscribed ? "border-primary" : "border-border/50"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {subscribed ? "Subscription active" : "Subscribe to run payroll"}
                </CardTitle>
                <CardDescription>
                  {subscribed
                    ? "You can finalize payroll runs and use every feature."
                    : "You're on the free plan — everything works except finalizing a payroll run."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-3xl font-bold">
                      {formatMoney(rate)}
                      <span className="text-sm font-medium text-muted-foreground"> /employee/mo</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your employees</p>
                    <p className="text-3xl font-bold">{employees}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {subscribed ? "Billed monthly" : "Projected monthly"}
                    </p>
                    <p className="text-3xl font-bold">
                      {formatMoney(tenant?.monthlySubscriptionAmount ?? projected)}
                    </p>
                  </div>
                </div>

                {subscribed && paidUntil && (
                  <Badge variant="outline">
                    {tenant?.manualSubscription && !tenant?.stripeSubscriptionId ? "Paid until" : "Renews"}{" "}
                    {paidUntil.toLocaleDateString()}
                  </Badge>
                )}

                <div className="flex flex-wrap gap-3">
                  {subscribed ? (
                    tenant?.stripeCustomerId ? (
                      <Button variant="outline" className="gap-2" onClick={openPortal} disabled={portalBusy}>
                        {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Manage billing
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Paid by bank transfer or cash. To renew or make changes, email{" "}
                        <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${BILLING_SUPPORT_EMAIL}`}>
                          {BILLING_SUPPORT_EMAIL}
                        </a>
                        .
                      </p>
                    )
                  ) : (
                    <Button className="gap-2" onClick={startCheckout} disabled={checkoutBusy || !canManage()}>
                      {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Subscribe now
                    </Button>
                  )}
                  {!subscribed && tenant?.stripeCustomerId && (
                    <Button variant="ghost" onClick={openPortal} disabled={portalBusy}>
                      Manage billing
                    </Button>
                  )}
                </div>

                {!subscribed && (
                  <>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Card payments are processed securely by Stripe.
                    </p>

                    {/* Offline path — most TL businesses don't have cards */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Landmark className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">No card? Pay by bank transfer or cash.</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Request an invoice and we'll send payment details. Your subscription is
                            activated as soon as the payment is confirmed.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={requestInvoice}
                            disabled={invoiceRequestState !== "idle" || !canManage()}
                          >
                            {invoiceRequestState === "sending" && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {invoiceRequestState === "sent" ? "Request sent ✓" : "Request an invoice"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!canManage() && (
                  <p className="text-sm text-muted-foreground">
                    Only owners and HR admins can change the subscription.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Everything included */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Included with every account</CardTitle>
                <CardDescription>Free and paid — no feature is locked away.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
