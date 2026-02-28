/**
 * Settings Page — Orchestrator
 * Loads TenantSettings, renders tab components
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { holidayService } from "@/services/holidayService";
import { useSettings, settingsKeys } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Settings as SettingsIcon,
  Building,
  Building2,
  CreditCard,
  Calendar,
  Calculator,
  Plug,
} from "lucide-react";
import {
  QuickBooksSettings,
  SettingsSkeleton,
  SetupProgress,
  CompanyDetailsTab,
  CompanyStructureTab,
  PaymentStructureTab,
  TimeOffPoliciesTab,
  PayrollConfigTab,
} from "@/components/settings";

export default function Settings() {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { t } = useI18n();

  const queryClient = useQueryClient();
  const { data: settings = null, isLoading: settingsLoading } = useSettings();

  // Holiday overrides query
  const year = new Date().getFullYear();
  const { data: holidayOverrides = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['tenants', tenantId, 'holidayOverrides', year] as const,
    queryFn: () => holidayService.listTenantHolidayOverrides(tenantId, year),
    staleTime: 10 * 60 * 1000,
    enabled: !!tenantId,
  });

  const loading = settingsLoading || holidaysLoading;

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("company");

  // onReload for child tabs — invalidate queries so React Query refetches
  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
    queryClient.invalidateQueries({ queryKey: ['tenants', tenantId, 'holidayOverrides', year] });
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.settings} />
      <MainNavigation />

      <div className="p-6 max-w-6xl mx-auto">
        <AutoBreadcrumb className="mb-6" />
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("settings.headerTitle")}</h1>
            <p className="text-muted-foreground">{t("settings.headerSubtitle")}</p>
          </div>
        </div>

        {/* Setup Progress */}
        {settings && !settings.setupComplete && (
          <SetupProgress progress={settings.setupProgress} />
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
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
            <TabsTrigger value="timeoff" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.timeOff")}</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings.tabs.payroll")}</span>
            </TabsTrigger>
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

          <TabsContent value="timeoff">
            {settings && (
              <TimeOffPoliciesTab
                tenantId={tenantId}
                saving={saving}
                setSaving={setSaving}
                onReload={handleReload}
                t={t}
                initialTimeOff={settings.timeOffPolicies}
                initialHolidayOverrides={holidayOverrides}
                userId={user?.uid}
              />
            )}
          </TabsContent>

          <TabsContent value="payroll">
            {settings && (
              <PayrollConfigTab
                tenantId={tenantId}
                saving={saving}
                setSaving={setSaving}
                onReload={handleReload}
                t={t}
                initialData={settings.payrollConfig}
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
