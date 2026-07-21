/**
 * Payments & Banking Settings — payment methods, bank accounts, and the
 * payroll schedule, split out of the /settings hub.
 */
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useTenantId } from "@/contexts/TenantContext";
import { useSettings, settingsKeys } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO } from "@/components/SEO";
import { ArrowLeft, Landmark } from "lucide-react";
import { SettingsSkeleton, PaymentStructureTab } from "@/components/settings";

export default function PaymentsSettings() {
  const tenantId = useTenantId();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const settingsQuery = useSettings();
  const { data: settings, isLoading } = settingsQuery;

  const [saving, setSaving] = useState(false);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (settingsQuery.isError && settings === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={settingsQuery.isFetching}
          onRetry={() => settingsQuery.refetch()}
        />
      </div>
    );
  }

  if (!settings) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Payments & Banking | Xefe" description="Payment methods, bank accounts, and payroll schedule" noIndex />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
        <PageHeader
          title={t("nav.paymentsSettingsLink")}
          subtitle={t("nav.paymentsSettingsLinkDesc")}
          icon={Landmark}
          iconColor="text-primary"
        />

        <PaymentStructureTab
          tenantId={tenantId}
          saving={saving}
          setSaving={setSaving}
          onReload={handleReload}
          t={t}
          initialData={settings.paymentStructure}
        />
      </div>
    </div>
  );
}
