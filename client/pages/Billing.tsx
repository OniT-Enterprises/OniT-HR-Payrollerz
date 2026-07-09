import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, CreditCard, Loader2, Sparkles } from "lucide-react";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { usePackagesConfig } from "@/hooks/useAdmin";
import { ALL_FEATURES, isTenantSubscribed, normalizeBillingPackagesConfig } from "@/lib/packagePricing";
import { billingService } from "@/services/billingService";
import { toast } from "sonner";

interface TenantBilling {
  currentEmployeeCount: number;
  monthlySubscriptionAmount?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status?: string;
  subscriptionPaidUntil?: { toDate: () => Date } | null;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export default function Billing() {
  const tenantId = useTenantId();
  const { canManage } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: packagesConfig } = usePackagesConfig();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const autoCheckoutFired = useRef(false);

  const rate = normalizeBillingPackagesConfig(packagesConfig).pricePerEmployee;

  const { data: tenant, isLoading, refetch } = useQuery<TenantBilling>({
    queryKey: ["tenant-billing", tenantId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, paths.tenant(tenantId)));
      const d = (snap.data() ?? {}) as Record<string, unknown>;
      return {
        currentEmployeeCount: Math.max(0, (d.currentEmployeeCount as number) ?? 0),
        monthlySubscriptionAmount: d.monthlySubscriptionAmount as number | undefined,
        stripeCustomerId: d.stripeCustomerId as string | undefined,
        stripeSubscriptionId: d.stripeSubscriptionId as string | undefined,
        status: d.status as string | undefined,
        subscriptionPaidUntil: (d.subscriptionPaidUntil as TenantBilling["subscriptionPaidUntil"]) ?? null,
      };
    },
    enabled: Boolean(tenantId),
  });

  const subscribed = tenant ? isTenantSubscribed(tenant) : false;
  const employees = tenant?.currentEmployeeCount ?? 0;
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
                  <Badge variant="outline">Renews {paidUntil.toLocaleDateString()}</Badge>
                )}

                <div className="flex flex-wrap gap-3">
                  {subscribed ? (
                    <Button variant="outline" className="gap-2" onClick={openPortal} disabled={portalBusy}>
                      {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Manage billing
                    </Button>
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
