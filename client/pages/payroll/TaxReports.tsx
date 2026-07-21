/**
 * Payroll Taxes (Timor-Leste)
 *
 * Entry point for payroll tax + social security compliance workflows:
 * - ATTL Monthly WIT return
 * - INSS Monthly contribution submission
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO, seoConfig } from "@/components/SEO";
import { useAdvancedTax, useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveAnnualIncomeTaxPreparation } from "@/hooks/useTaxFiling";
import { useToast } from "@/hooks/use-toast";
import { taxFilingService } from "@/services/taxFilingService";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTL, parseDateISO } from "@/lib/dateUtils";
import type { AnnualIncomeTaxPreparation } from "@/types/tax-filing";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const saveFormCPreparation = useSaveAnnualIncomeTaxPreparation();
  const [showFormCPreparation, setShowFormCPreparation] = useState(false);
  const [formCPreparation, setFormCPreparation] = useState({
    profitAndLossReady: false,
    balanceSheetReady: false,
    cashFlowReady: false,
    taxAdjustmentsReviewed: false,
    reviewNote: "",
  });

  const { data: dueDates = [], isLoading: loading } = useQuery({
    queryKey: ["tenants", tenantId, "taxFilings", "dueSoon", 6],
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

  const annualIncomeTax = useMemo(
    () => dueDates.find((deadline) => deadline.type === "annual_income_tax"),
    [dueDates],
  );

  const openFormCPreparation = () => {
    const snapshot = annualIncomeTax?.filing?.dataSnapshot as
      | Partial<AnnualIncomeTaxPreparation>
      | undefined;
    setFormCPreparation({
      profitAndLossReady: snapshot?.profitAndLossReady === true,
      balanceSheetReady: snapshot?.balanceSheetReady === true,
      cashFlowReady: snapshot?.cashFlowReady === true,
      taxAdjustmentsReviewed: snapshot?.taxAdjustmentsReviewed === true,
      reviewNote: snapshot?.reviewNote || "",
    });
    setShowFormCPreparation(true);
  };

  const saveFormCProgress = async () => {
    if (!annualIncomeTax || !user) return;
    try {
      await saveFormCPreparation.mutateAsync({
        taxYear: Number(annualIncomeTax.period),
        preparation: formCPreparation,
        userId: user.uid,
        audit: {
          tenantId,
          userId: user.uid,
          userEmail: user.email || "",
          userName: user.displayName || undefined,
        },
      });
      setShowFormCPreparation(false);
      toast({
        title: t("taxReports.formC.savedTitle"),
        description: t("taxReports.formC.savedDescription"),
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("taxReports.formC.saveError"),
        variant: "destructive",
      });
    }
  };

  const hasOverdue = useMemo(
    () => dueDates.some((d) => d.isOverdue),
    [dueDates],
  );

  // DL 20/2017 Art. 39 — overdue INSS payments accrue 1% interest per
  // month-or-fraction. Warning copy only; the estimate rides on the deadline.
  const overdueInssArrears = useMemo(() => {
    const overdue = dueDates
      .filter(
        (d) =>
          d.type === "inss_monthly" &&
          d.task === "payment" &&
          d.isOverdue &&
          d.arrears,
      )
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
    task === "payment"
      ? t("taxReports.inssPaymentTask")
      : t("taxReports.inssStatementTask");
  const getWitTaskLabel = (task?: "statement" | "payment") =>
    task === "payment"
      ? t("taxReports.witPaymentTask")
      : t("taxReports.witStatementTask");
  const getDeadlineLabel = (
    deadline: (typeof dueDates)[number] | undefined,
  ) => {
    if (!deadline) return "—";
    if (deadline.isOverdue) {
      return t("taxReports.daysOverdue", {
        days: Math.abs(deadline.daysUntilDue),
      });
    }
    if (deadline.daysUntilDue === 0) return t("taxReports.dueToday");
    return t("taxReports.daysRemaining", { days: deadline.daysUntilDue });
  };
  const formatDueDate = (value: string) =>
    formatDateTL(parseDateISO(value), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

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
                    <span className="font-medium">
                      {t("taxReports.monthlyWit")}
                    </span>
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
                  {t("taxReports.next")}:{" "}
                  {nextWit
                    ? `${nextWit.period} • ${getWitTaskLabel(nextWit.task)} • ${t("taxReports.due")} ${formatDueDate(nextWit.dueDate)}`
                    : t("taxReports.noPeriodsFound")}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {t("taxReports.monthlyInss")}
                    </span>
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
                  {t("taxReports.next")}:{" "}
                  {nextInss
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
            {annualIncomeTax && (
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t("taxReports.formC.title")}</p>
                    <p className="text-sm text-muted-foreground">
                      {annualIncomeTax.period} • {t("taxReports.due")}{" "}
                      {formatDueDate(annualIncomeTax.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`gap-1 ${annualIncomeTax.isOverdue ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : ""}`}
                  >
                    <Clock className="h-3 w-3" />
                    {getDeadlineLabel(annualIncomeTax)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={openFormCPreparation}
                  >
                    {annualIncomeTax.filing?.preparationStatus ===
                    "ready_for_accountant"
                      ? t("taxReports.formC.reviewProgress")
                      : t("taxReports.formC.startPreparation")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ATTL form generator is accountant-grade — the deadline card above
              still shows the WIT obligation to everyone. */}
          {showAdvancedTax && (
            <Card>
              <CardHeader>
                <CardTitle>{t("taxReports.attlTitle")}</CardTitle>
                <CardDescription>{t("taxReports.attlDesc")}</CardDescription>
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
              <CardDescription>{t("taxReports.inssDesc")}</CardDescription>
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

      <Dialog
        open={showFormCPreparation}
        onOpenChange={setShowFormCPreparation}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("taxReports.formC.dialogTitle", {
                year: annualIncomeTax?.period || "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("taxReports.formC.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t("taxReports.formC.externalWarning")}
            </p>
            {(
              [
                ["profitAndLossReady", "profitAndLoss"],
                ["balanceSheetReady", "balanceSheet"],
                ["cashFlowReady", "cashFlow"],
                ["taxAdjustmentsReviewed", "taxAdjustments"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="flex items-start gap-3">
                <Checkbox
                  id={`form-c-${field}`}
                  checked={formCPreparation[field]}
                  onCheckedChange={(checked) =>
                    setFormCPreparation((current) => ({
                      ...current,
                      [field]: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor={`form-c-${field}`}
                  className="font-normal leading-5"
                >
                  {t(`taxReports.formC.checklist.${label}`)}
                </Label>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="form-c-review-note">
                {t("taxReports.formC.reviewNote")}
              </Label>
              <Textarea
                id="form-c-review-note"
                value={formCPreparation.reviewNote}
                onChange={(event) =>
                  setFormCPreparation((current) => ({
                    ...current,
                    reviewNote: event.target.value,
                  }))
                }
                placeholder={t("taxReports.formC.reviewNotePlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormCPreparation(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void saveFormCProgress()}
              disabled={saveFormCPreparation.isPending}
            >
              {saveFormCPreparation.isPending
                ? t("common.saving")
                : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
