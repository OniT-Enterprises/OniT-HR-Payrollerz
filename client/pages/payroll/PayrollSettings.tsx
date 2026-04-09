/**
 * Payroll Settings — Dedicated page for all payroll configuration.
 * Tax/INSS/Overtime config inline, Benefits & Deductions as link cards.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { PayrollConfigTab } from "@/components/settings/PayrollConfigTab";
import { SEO } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { settingsService } from "@/services/settingsService";
import { Settings } from "lucide-react";

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
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Payroll Settings | Meza" description="Configure payroll tax rates, benefits, and deductions" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("settings.payroll.title") || "Payroll Settings"}
          subtitle={t("settings.payroll.description") || "Tax, social security, overtime, benefits, and deductions"}
          icon={Settings}
          iconColor="text-primary"
        />

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

      </div>
    </div>
  );
}
