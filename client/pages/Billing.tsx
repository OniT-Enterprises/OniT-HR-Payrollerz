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
import { calculatePackageEstimate, normalizeBillingPackagesConfig } from "@/lib/packagePricing";
import { billingService } from "@/services/billingService";
import type { TenantPlan } from "@/types/tenant";
import { toast } from "sonner";

interface TenantBilling {
  plan: TenantPlan;
  status?: string;
  currentEmployeeCount: number;
  monthlySubscriptionAmount?: number;
  stripeCustomerId?: string;
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
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const autoCheckoutFired = useRef(false);

  const config = normalizeBillingPackagesConfig(packagesConfig);

  const {
    data: tenant,
    isLoading,
    refetch,
  } = useQuery<TenantBilling>({
    queryKey: ["tenant-billing", tenantId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, paths.tenant(tenantId)));
      const d = (snap.data() ?? {}) as Record<string, unknown>;
      return {
        plan: (d.plan as TenantPlan) ?? "free",
        status: d.status as string | undefined,
        currentEmployeeCount: Math.max(0, (d.currentEmployeeCount as number) ?? 0),
        monthlySubscriptionAmount: d.monthlySubscriptionAmount as number | undefined,
        stripeCustomerId: d.stripeCustomerId as string | undefined,
        subscriptionPaidUntil: (d.subscriptionPaidUntil as TenantBilling["subscriptionPaidUntil"]) ?? null,
      };
    },
    enabled: Boolean(tenantId),
  });

  const startCheckout = async (planId: string) => {
    if (!canManage()) {
      toast.error("Only owners and admins can manage billing");
      return;
    }
    setBusyPlan(planId);
    try {
      await billingService.startCheckout(tenantId, planId);
      // On success the browser redirects to Stripe; nothing else runs.
    } catch (error) {
      console.error(error);
      toast.error("Could not start checkout. Please try again.");
      setBusyPlan(null);
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

  // Handle Stripe return + auto-start checkout when arriving from signup.
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Subscription active — thank you!");
      void refetch();
    } else if (status === "cancel") {
      toast.message("Checkout canceled — no charge was made.");
    }

    const checkoutPlan = searchParams.get("checkout");
    if (checkoutPlan && checkoutPlan !== "free" && !autoCheckoutFired.current && canManage()) {
      autoCheckoutFired.current = true;
      void startCheckout(checkoutPlan);
    }

    if (status || searchParams.get("checkout")) {
      const next = new URLSearchParams(searchParams);
      next.delete("status");
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManage]);

  const currentPlanId = tenant?.plan ?? "free";
  const paidUntil = tenant?.subscriptionPaidUntil?.toDate?.();

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title="Billing & Plan"
          subtitle="Simple per-employee pricing. Upgrade, downgrade, or manage payment anytime."
          icon={CreditCard}
          iconColor="text-primary"
        />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current subscription summary */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Current plan
                </CardTitle>
                <CardDescription>Your active subscription and next billing date.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-2xl font-bold capitalize">{currentPlanId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{tenant?.currentEmployeeCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly</p>
                  <p className="text-2xl font-bold">
                    {tenant?.monthlySubscriptionAmount
                      ? formatMoney(tenant.monthlySubscriptionAmount)
                      : currentPlanId === "free"
                        ? "Free"
                        : "—"}
                  </p>
                </div>
                {paidUntil && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid until</p>
                    <p className="text-2xl font-bold">{paidUntil.toLocaleDateString()}</p>
                  </div>
                )}
                {tenant?.status && (
                  <Badge variant={tenant.status === "active" ? "default" : "destructive"} className="capitalize">
                    {tenant.status}
                  </Badge>
                )}
                {tenant?.stripeCustomerId && (
                  <Button variant="outline" className="ml-auto gap-2" onClick={openPortal} disabled={portalBusy}>
                    {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Manage billing
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Plan cards */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {config.planDefinitions.map((plan) => {
                const estimate = calculatePackageEstimate(config, {
                  planId: plan.id,
                  employeeCount: tenant?.currentEmployeeCount ?? 0,
                });
                const isCurrent = plan.id === currentPlanId;
                return (
                  <Card key={plan.id} className={isCurrent ? "border-primary" : "border-border/50"}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>{plan.label}</CardTitle>
                        {isCurrent && <Badge>Current</Badge>}
                      </div>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-3xl font-bold">
                          {plan.pricePerEmployee === 0 ? "Free" : formatMoney(plan.pricePerEmployee)}
                          {plan.pricePerEmployee > 0 && (
                            <span className="text-sm font-medium text-muted-foreground"> /employee/mo</span>
                          )}
                        </p>
                        {plan.pricePerEmployee > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ≈ {formatMoney(estimate.monthlyTotal)}/mo for your {tenant?.currentEmployeeCount ?? 0} employees
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {plan.highlights.map((h) => (
                          <div key={h} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                      {plan.id === "free" ? (
                        <Button variant="outline" className="w-full" disabled>
                          {isCurrent ? "Current plan" : "Free"}
                        </Button>
                      ) : (
                        <Button
                          className="w-full gap-2"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={busyPlan === plan.id || !canManage()}
                          onClick={() => startCheckout(plan.id)}
                        >
                          {busyPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isCurrent ? "Manage / renew" : "Choose " + plan.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {!canManage() && (
              <p className="text-sm text-muted-foreground">
                Only owners and HR admins can change the subscription.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
