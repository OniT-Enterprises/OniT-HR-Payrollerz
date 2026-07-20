/**
 * Payroll Taxes (Timor-Leste)
 *
 * Entry point for payroll tax + social security compliance workflows:
 * - ATTL Monthly WIT return
 * - INSS Monthly contribution submission
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO, seoConfig } from "@/components/SEO";
import { useAdvancedTax, useTenantId } from "@/contexts/TenantContext";
import { taxFilingService } from "@/services/taxFilingService";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTL, parseDateISO } from "@/lib/dateUtils";
import {
  ArrowRight,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  Shield,
  AlertTriangle,
} from "lucide-react";

export default function TaxReports() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const showAdvancedTax = useAdvancedTax();
  const { t } = useI18n();

  const { data: dueDates = [], isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'taxFilings', 'dueSoon', 6],
    queryFn: () => taxFilingService.getFilingsDueSoon(tenantId, 6),
    staleTime: 5 * 60 * 1000,
  });

  const nextWit = useMemo(() => {
    const outstanding = dueDates
      .filter((d) => d.type === "monthly_wit")
      .filter((d) => d.status !== "filed")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return outstanding[0];
  }, [dueDates]);

  const nextInss = useMemo(() => {
    const outstanding = dueDates
      .filter((d) => d.type === "inss_monthly")
      .filter((d) => d.status !== "filed")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return outstanding[0];
  }, [dueDates]);

  const hasOverdue = useMemo(() => dueDates.some((d) => d.isOverdue), [dueDates]);

  // DL 20/2017 Art. 39 — overdue INSS payments accrue 1% interest per
  // month-or-fraction. Warning copy only; the estimate rides on the deadline.
  const overdueInssArrears = useMemo(() => {
    const overdue = dueDates
      .filter((d) => d.type === "inss_monthly" && d.task === "payment" && d.isOverdue && d.arrears)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return overdue[0];
  }, [dueDates]);

  const arrearsText = useMemo(() => {
    if (!overdueInssArrears?.arrears) return null;
    const base =
      t("taxReports.inssArrearsNotice") ||
      "Late INSS payment accrues 1% interest per month or fraction (DL 20/2017 Art. 39).";
    const { estimatedInterest, monthsLate } = overdueInssArrears.arrears;
    if (typeof estimatedInterest === "number") {
      const monthsLabel =
        monthsLate === 1
          ? t("taxReports.inssArrearsMonth") || "month"
          : t("taxReports.inssArrearsMonths") || "months";
      return `${base} ${
        t("taxReports.inssArrearsEstimate", {
          amount: estimatedInterest.toFixed(2),
          period: overdueInssArrears.period,
          months: monthsLate,
        }) ||
        `Estimated so far for ${overdueInssArrears.period}: US$ ${estimatedInterest.toFixed(2)} (${monthsLate} ${monthsLabel}).`
      }`;
    }
    return base;
  }, [overdueInssArrears, t]);
  const getInssTaskLabel = (task?: "statement" | "payment") =>
    task === "payment" ? t("taxReports.inssPaymentTask") : t("taxReports.inssStatementTask");
  const getDeadlineLabel = (deadline: (typeof dueDates)[number] | undefined) => {
    if (!deadline) return "—";
    if (deadline.isOverdue) {
      return t("taxReports.daysOverdue", { days: Math.abs(deadline.daysUntilDue) });
    }
    if (deadline.daysUntilDue === 0) return t("taxReports.dueToday");
    return t("taxReports.daysRemaining", { days: deadline.daysUntilDue });
  };
  const formatDueDate = (value: string) =>
    formatDateTL(parseDateISO(value), { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                {t("taxReports.upcomingDeadlines")}
              </CardTitle>
              <CardDescription>
                {t("taxReports.upcomingDeadlinesDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-56 mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: showAdvancedTax ? 2 : 1 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Skeleton className="h-10 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.taxes} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("taxReports.title")}
          subtitle={t("taxReports.subtitle")}
          icon={Shield}
          iconColor="text-primary"
          actions={
            hasOverdue ? (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t("taxReports.actionRequired")}
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("taxReports.onTrack")}
              </Badge>
            )
          }
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              {t("taxReports.upcomingDeadlines")}
            </CardTitle>
            <CardDescription>
              {t("taxReports.upcomingDeadlinesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t("taxReports.monthlyWit")}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 ${nextWit?.isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : ""}`}
                  >
                    <Clock className="h-3 w-3" />
                    {getDeadlineLabel(nextWit)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("taxReports.next")}: {nextWit ? `${nextWit.period} • ${t("taxReports.due")} ${formatDueDate(nextWit.dueDate)}` : t("taxReports.noPeriodsFound")}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t("taxReports.monthlyInss")}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`gap-1 ${nextInss?.isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : ""}`}
                  >
                    <Clock className="h-3 w-3" />
                    {getDeadlineLabel(nextInss)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("taxReports.next")}: {nextInss
                    ? `${nextInss.period} • ${getInssTaskLabel(nextInss.task)} • ${t("taxReports.due")} ${formatDueDate(nextInss.dueDate)}`
                    : t("taxReports.noPeriodsFound")}
                </p>
                {arrearsText && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{arrearsText}</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ATTL form generator is accountant-grade — the deadline card above
              still shows the WIT obligation to everyone. */}
          {showAdvancedTax && (
            <Card>
              <CardHeader>
                <CardTitle>{t("taxReports.attlTitle")}</CardTitle>
                <CardDescription>
                  {t("taxReports.attlDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Button onClick={() => navigate("/payroll/tax/monthly-wit")}>
                  {t("taxReports.openWitFiling")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("taxReports.inssTitle")}</CardTitle>
              <CardDescription>
                {t("taxReports.inssDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Button onClick={() => navigate("/payroll/tax/inss-monthly")}>
                {t("taxReports.openInssFiling")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
