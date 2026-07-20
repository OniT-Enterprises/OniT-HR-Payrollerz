/**
 * Payroll Settings — Dedicated page for all payroll configuration.
 * Tax/INSS/Overtime config inline, Benefits & Deductions as link cards.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { PayrollConfigTab } from "@/components/settings/PayrollConfigTab";
import { StatutoryRatesCard } from "@/components/settings/StatutoryRatesCard";
import { SEO } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { settingsService } from "@/services/settingsService";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  MinusCircle,
  Settings,
} from "lucide-react";

export default function PayrollSettings() {
  const tenantId = useTenantId();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: () => settingsService.getSettings(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tax (WIT) */}
              <div className="space-y-4">
                <Skeleton className="h-5 w-32" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Social Security (INSS) */}
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-10 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Overtime */}
              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <div className="max-w-md space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 13th Month */}
              <div className="space-y-4">
                <Skeleton className="h-5 w-36" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>

              <Separator />

              {/* Approval policy */}
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="flex items-start gap-4">
                  <Skeleton className="h-6 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Skeleton className="h-10 w-full sm:w-32" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Payroll Settings | Xefe" description="Configure payroll tax rates, benefits, and deductions" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
        <PageHeader
          title={t("settings.payroll.title") || "Payroll Settings"}
          subtitle={t("settings.payroll.description") || "Tax, social security, overtime, benefits, and deductions"}
          icon={Settings}
          iconColor="text-primary"
        />

        {/* Benefits & Deductions live on their own pages — link cards here
            (module navs carry no settings entries; this page is their home) */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              path: "/payroll/settings/benefits",
              icon: Heart,
              label: t("settings.payroll.benefitsCard"),
              description: t("settings.payroll.benefitsCardDesc"),
            },
            {
              path: "/payroll/settings/deductions",
              icon: MinusCircle,
              label: t("settings.payroll.deductionsCard"),
              description: t("settings.payroll.deductionsCardDesc"),
            },
          ].map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <link.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>

        {/* Tax / INSS / Overtime / 13th Month config */}
        {settings && (
          <PayrollConfigTab
            tenantId={tenantId}
            saving={saving}
            setSaving={setSaving}
            onReload={() => void refetch()}
            t={t}
            initialData={settings.payrollConfig}
          />
        )}

        {/* Statutory rules Xefe applies automatically — read-only by design */}
        <StatutoryRatesCard t={t} />

      </div>
    </div>
  );
}
