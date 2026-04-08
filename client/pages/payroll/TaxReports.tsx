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
import { useTenantId } from "@/contexts/TenantContext";
import { taxFilingService } from "@/services/taxFilingService";
import { useI18n } from "@/i18n/I18nProvider";
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
  const getInssTaskLabel = (task?: "statement" | "payment") =>
    task === "payment" ? t("taxReports.inssPaymentTask") : t("taxReports.inssStatementTask");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
              <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.taxes} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("taxReports.title")}
          subtitle={t("taxReports.subtitle")}
          icon={Shield}
          iconColor="text-slate-500"
          actions={
            hasOverdue ? (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t("taxReports.actionRequired")}
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800">
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
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {nextWit ? `${nextWit.daysUntilDue}d` : "—"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("taxReports.next")}: {nextWit ? `${nextWit.period} • ${t("taxReports.due")} ${nextWit.dueDate}` : t("taxReports.noPeriodsFound")}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t("taxReports.monthlyInss")}</span>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {nextInss ? `${nextInss.daysUntilDue}d` : "—"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("taxReports.next")}: {nextInss
                    ? `${nextInss.period} • ${getInssTaskLabel(nextInss.task)} • ${t("taxReports.due")} ${nextInss.dueDate}`
                    : t("taxReports.noPeriodsFound")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
