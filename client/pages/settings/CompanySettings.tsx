/**
 * Company Settings — company details and structure, split out of the
 * /settings hub (which is a pure directory of settings pages).
 */
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useTenantId } from "@/contexts/TenantContext";
import { useSettings, settingsKeys } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO } from "@/components/SEO";
import { ArrowLeft, Building, Building2 } from "lucide-react";
import {
  SettingsSkeleton,
  CompanyDetailsTab,
  CompanyStructureTab,
} from "@/components/settings";

export default function CompanySettings() {
  const tenantId = useTenantId();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const settingsQuery = useSettings();
  const { data: settings, isLoading } = settingsQuery;

  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "structure" ? "structure" : "company";

  const handleTabChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === "company") nextParams.delete("tab");
    else nextParams.set("tab", value);
    setSearchParams(nextParams, { replace: true });
  };

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
      <SEO title="Company Settings | Xefe" description="Company details and structure" noIndex />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:p-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
        <PageHeader
          title={t("nav.companySettingsLink")}
          subtitle={t("nav.companySettingsLinkDesc")}
          icon={Building}
          iconColor="text-primary"
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 sm:w-auto sm:inline-grid">
            <TabsTrigger value="company" className="gap-2" disabled={saving}>
              <Building className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{t("settings.tabs.company")}</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2" disabled={saving}>
              <Building2 className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{t("settings.tabs.structure")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyDetailsTab
              tenantId={tenantId}
              saving={saving}
              setSaving={setSaving}
              onReload={handleReload}
              t={t}
              initialData={settings.companyDetails}
            />
          </TabsContent>

          <TabsContent value="structure">
            <CompanyStructureTab
              tenantId={tenantId}
              saving={saving}
              setSaving={setSaving}
              onReload={handleReload}
              t={t}
              initialData={settings.companyStructure}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
