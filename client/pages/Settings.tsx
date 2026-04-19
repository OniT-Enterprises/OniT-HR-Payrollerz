/**
 * Settings Page — Orchestrator
 * Loads TenantSettings, renders tab components
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";

import { useTenantId } from "@/contexts/TenantContext";

import { useSettings, settingsKeys } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Settings as SettingsIcon,
  Building,
  Building2,
  CreditCard,
  Plug,
  ChevronRight,
} from "lucide-react";
import {
  QuickBooksSettings,
  SettingsSkeleton,
  SetupProgress,
  CompanyDetailsTab,
  CompanyStructureTab,
  PaymentStructureTab,
} from "@/components/settings";

export default function Settings() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { t } = useI18n();

  const queryClient = useQueryClient();
  const { data: settings = null, isLoading: settingsLoading } = useSettings();

  const loading = settingsLoading;

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const organizationLinks: { label: string; path: string; icon: typeof Building; description: string }[] = [];

  // onReload for child tabs — invalidate queries so React Query refetches
  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.settings} />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("settings.headerTitle")}
          subtitle={t("settings.headerSubtitle")}
          icon={SettingsIcon}
          iconColor="text-primary"
        />

        {/* Organization Quick Links */}
        {organizationLinks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Organization
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {organizationLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
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
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Setup Progress */}
        {settings && !settings.setupComplete && (
          <SetupProgress progress={settings.setupProgress} />
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="company" className="gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.company")}</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.structure")}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.payment")}</span>
            </TabsTrigger>
            {/* Time Off moved to /time-leave/settings, Payroll to /payroll/settings */}
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.integrations")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            {settings && (
              <CompanyDetailsTab
                tenantId={tenantId}
                saving={saving}
                setSaving={setSaving}
                onReload={handleReload}
                t={t}
                initialData={settings.companyDetails}
              />
            )}
          </TabsContent>

          <TabsContent value="structure">
            {settings && (
              <CompanyStructureTab
                tenantId={tenantId}
                saving={saving}
                setSaving={setSaving}
                onReload={handleReload}
                t={t}
                initialData={settings.companyStructure}
              />
            )}
          </TabsContent>

          <TabsContent value="payment">
            {settings && (
              <PaymentStructureTab
                tenantId={tenantId}
                saving={saving}
                setSaving={setSaving}
                onReload={handleReload}
                t={t}
                initialData={settings.paymentStructure}
              />
            )}
          </TabsContent>

          <TabsContent value="integrations">
            {tenantId && <QuickBooksSettings tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
