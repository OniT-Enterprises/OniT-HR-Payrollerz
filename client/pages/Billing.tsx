import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, Info, Landmark, Loader2, ShieldCheck, Sparkles } from "lucide-react";
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
import {
  calculatePackageEstimate,
  getPackageBillingAmount,
  isTenantSubscribed,
  normalizeBillingPackagesConfig,
  type BillingInterval,
} from "@/lib/packagePricing";
import { billingService } from "@/services/billingService";
import { notificationService } from "@/services/notificationService";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

// Where offline-payment (bank transfer / cash) invoice requests are sent.
const BILLING_SUPPORT_EMAIL = "info@naroman.tl";

// ALL_FEATURES (packagePricing) stays English for the superadmin packages
// page; the customer-facing card translates through these keys instead.
const FEATURE_KEYS = [
  "people",
  "hiring",
  "timeLeave",
  "performance",
  "payroll",
  "money",
  "accounting",
  "reports",
  "ekipa",
] as const;

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export default function Billing() {
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { canManage, session } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: packagesConfig } = usePackagesConfig();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [invoiceRequestState, setInvoiceRequestState] = useState<"idle" | "sending" | "sent">("idle");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(() =>
    searchParams.get("cycle") === "year" ? "year" : "month",
  );
  const autoCheckoutFired = useRef(false);

  const pricing = normalizeBillingPackagesConfig(packagesConfig);
  const rate = pricing.pricePerEmployee;

  const { data: tenant, isLoading, refetch } = useTenantBilling();
  // Live active-employee count — checkout bills this number (the stored
  // currentEmployeeCount field goes stale for self-serve tenants).
  const { data: employeeSummary } = useActiveEmployeeSummary(canManage());

  const subscribed = tenant ? isTenantSubscribed(tenant) : false;
  const employees = employeeSummary?.active ?? tenant?.currentEmployeeCount ?? 0;
  const estimate = calculatePackageEstimate(pricing, { employeeCount: employees });
  const minimumMonthly = calculatePackageEstimate(pricing, { employeeCount: 0 }).monthlyTotal;
  const projected = getPackageBillingAmount(estimate, billingInterval);
  const activeBillingInterval = tenant?.subscriptionBillingInterval ?? "month";
  const activeBillingAmount =
    tenant?.subscriptionBillingAmount ??
    tenant?.monthlySubscriptionAmount ??
    estimate.monthlyTotal;
  const paidUntil = tenant?.subscriptionPaidUntil?.toDate?.();

  // How team-size changes reach the bill — mirrors syncSubscriptionQuantities
  // in functions/src/billing.ts: monthly Stripe true-ups at the next invoice,
  // annual seat additions are prorated and invoiced right away, and manual
  // (bank transfer / cash) prices are fixed until renewal.
  const billedSeatsNow = tenant?.subscriptionBilledSeats ?? estimate.billedEmployees;
  const isManualOnly = Boolean(tenant?.manualSubscription && !tenant?.stripeSubscriptionId);
  const seatAdjustmentNote = isManualOnly
    ? t("billing.seatNote.manual")
    : activeBillingInterval === "year"
      ? estimate.billedEmployees > billedSeatsNow
        ? t("billing.seatNote.annualIncrease", {
            count: estimate.billedEmployees,
            total: formatMoney(estimate.annualTotal),
          })
        : t("billing.seatNote.annual")
      : estimate.billedEmployees !== billedSeatsNow
        ? t("billing.seatNote.monthlyChanged", {
            count: estimate.billedEmployees,
            total: formatMoney(estimate.monthlyTotal),
          })
        : t("billing.seatNote.monthly");

  const startCheckout = async () => {
    if (!canManage()) {
      toast.error(t("billing.toasts.adminsOnly"));
      return;
    }
    setCheckoutBusy(true);
    try {
      await billingService.startCheckout(tenantId, billingInterval);
    } catch (error) {
      console.error(error);
      toast.error(t("billing.toasts.checkoutFailed"));
      setCheckoutBusy(false);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      await billingService.openBillingPortal(tenantId);
    } catch (error) {
      console.error(error);
      toast.error(t("billing.toasts.portalFailed"));
      setPortalBusy(false);
    }
  };

  // Offline path for the many TL businesses without cards: queue an email to
  // us; we send an invoice, they pay by bank transfer or cash, and a
  // superadmin activates the subscription in Admin once payment lands.
  const requestInvoice = async () => {
    if (!canManage()) {
      toast.error(t("billing.toasts.adminsOnly"));
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
        subject: `Xefe invoice request — ${companyName} (${employees} employees, ${formatMoney(projected)}/${billingInterval})`,
        text: [
          `Tenant: ${companyName} (${tenantId})`,
          `Requested by: ${contactEmail}`,
          `Active employees: ${employees}`,
          `Billed seats: ${estimate.billedEmployees} (${estimate.minimumEmployees}-seat minimum)`,
          `Rate: ${formatMoney(rate)}/employee/month`,
          `Selected billing: ${billingInterval === "year" ? "Annual" : "Monthly"}`,
          `Amount due: ${formatMoney(projected)}`,
          ...(billingInterval === "year"
            ? [`Annual saving: ${formatMoney(estimate.annualSavings)}`]
            : []),
          "",
          "The tenant wants to subscribe by bank transfer or cash.",
          "Send them an invoice, then record the payment in Admin → Tenants once it arrives.",
        ].join("\n"),
        purpose: "billing-invoice-request",
      });
      setInvoiceRequestState("sent");
      toast.success(t("billing.toasts.requestSent"));
    } catch (error) {
      console.error(error);
      setInvoiceRequestState("idle");
      toast.error(t("billing.toasts.requestFailed"));
    }
  };

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success(t("billing.toasts.subscribed"));
      void refetch();
    } else if (status === "cancel") {
      toast.message(t("billing.toasts.canceled"));
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
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("billing.title")}
          subtitle={t("billing.subtitle")}
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
                  {subscribed ? t("billing.active.title") : t("billing.free.title")}
                </CardTitle>
                <CardDescription>
                  {subscribed
                    ? t("billing.active.description")
                    : t("billing.free.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!subscribed && (
                  <div className="grid w-full grid-cols-2 rounded-lg border border-border/60 bg-muted/30 p-1 sm:w-fit">
                    <Button
                      type="button"
                      size="sm"
                      className="h-auto py-2"
                      variant={billingInterval === "month" ? "default" : "ghost"}
                      onClick={() => setBillingInterval("month")}
                    >
                      {t("billing.interval.monthly")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-auto py-2"
                      variant={billingInterval === "year" ? "default" : "ghost"}
                      onClick={() => setBillingInterval("year")}
                    >
                      {estimate.annualSavings > 0
                        ? t("billing.interval.annualSave", {
                            savings: formatMoney(estimate.annualSavings),
                          })
                        : t("billing.interval.annual")}
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-x-8 gap-y-3 tabular-nums">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("billing.price")}</p>
                    <p className="text-3xl font-bold">
                      {formatMoney(rate)}
                      <span className="text-sm font-medium text-muted-foreground">
                        {" "}
                        {t("billing.perEmployeeMo")}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("billing.minimum")}</p>
                    <p className="text-3xl font-bold">{formatMoney(minimumMonthly)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("billing.includesEmployees", { count: estimate.minimumEmployees })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {subscribed
                        ? activeBillingInterval === "year"
                          ? t("billing.billedAnnually")
                          : t("billing.billedMonthly")
                        : billingInterval === "year"
                          ? t("billing.annualTotal")
                          : t("billing.monthlyTotal")}
                    </p>
                    <p className="text-3xl font-bold">
                      {formatMoney(subscribed ? activeBillingAmount : projected)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("billing.seats", {
                        active: employees,
                        billed: subscribed
                          ? tenant?.subscriptionBilledSeats ?? estimate.billedEmployees
                          : estimate.billedEmployees,
                      })}
                    </p>
                  </div>
                </div>

                {subscribed && (
                  <p className="flex max-w-2xl items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{seatAdjustmentNote}</span>
                  </p>
                )}

                {subscribed && paidUntil && (
                  <Badge variant="outline">
                    {isManualOnly ? t("billing.paidUntil") : t("billing.renews")}{" "}
                    {paidUntil.toLocaleDateString()}
                  </Badge>
                )}

                <div className="flex flex-wrap gap-3">
                  {subscribed ? (
                    tenant?.stripeCustomerId ? (
                      <Button variant="outline" className="gap-2" onClick={openPortal} disabled={portalBusy}>
                        {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        {t("billing.manageBilling")}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("billing.manualContact")}{" "}
                        <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${BILLING_SUPPORT_EMAIL}`}>
                          {BILLING_SUPPORT_EMAIL}
                        </a>
                        .
                      </p>
                    )
                  ) : (
                    <Button className="gap-2" onClick={startCheckout} disabled={checkoutBusy || !canManage()}>
                      {checkoutBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {billingInterval === "year"
                        ? t("billing.subscribeAnnually")
                        : t("billing.subscribeMonthly")}
                    </Button>
                  )}
                  {!subscribed && tenant?.stripeCustomerId && (
                    <Button variant="ghost" onClick={openPortal} disabled={portalBusy}>
                      {t("billing.manageBilling")}
                    </Button>
                  )}
                </div>

                {!subscribed && (
                  <>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("billing.stripeSecure")}
                    </p>

                    {/* Offline path — most TL businesses don't have cards */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Landmark className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{t("billing.offline.title")}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {t("billing.offline.description")}
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
                            {invoiceRequestState === "sent"
                              ? t("billing.offline.sent")
                              : t("billing.offline.request")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!canManage() && (
                  <p className="text-sm text-muted-foreground">{t("billing.onlyAdmins")}</p>
                )}
              </CardContent>
            </Card>

            {/* Everything included */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>{t("billing.included.title")}</CardTitle>
                <CardDescription>{t("billing.included.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {FEATURE_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>{t(`billing.features.${key}`)}</span>
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
