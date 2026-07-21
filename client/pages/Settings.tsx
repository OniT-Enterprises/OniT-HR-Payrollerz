/**
 * Settings — pure hub / directory.
 *
 * One card per settings area; the editors live on their own pages
 * (company, payments, integrations under /settings/*; payroll and time-off
 * contextually at their module routes). Module navs carry NO settings
 * entries — this hub, reached from the sidebar-footer Settings link, is the
 * single way into configuration.
 */
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useSettings } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenant } from "@/contexts/TenantContext";
import {
  Settings as SettingsIcon,
  Building,
  Calculator,
  CalendarDays,
  CreditCard,
  Landmark,
  Plug,
  ChevronRight,
  Users,
} from "lucide-react";
import { SettingsSkeleton, SetupProgress } from "@/components/settings";

/** Legacy tab deep-links → the split-out pages. */
const TAB_REDIRECTS: Record<string, string> = {
  company: "/settings/company",
  structure: "/settings/company?tab=structure",
  payment: "/settings/payments",
  integrations: "/settings/integrations",
};

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const settingsQuery = useSettings();
  const { session } = useTenant();
  const { data: settings, isLoading } = settingsQuery;
  const [searchParams] = useSearchParams();

  const requestedTab = searchParams.get("tab");
  if (requestedTab && TAB_REDIRECTS[requestedTab]) {
    return <Navigate to={TAB_REDIRECTS[requestedTab]} replace />;
  }

  const settingsLinks = [
    {
      label: t("settings.access.title"),
      path: "/settings/access",
      icon: Users,
      description: t("settings.access.description"),
      hidden: !["owner", "hr-admin"].includes(session?.role || ""),
    },
    {
      label: t("nav.companySettingsLink"),
      path: "/settings/company",
      icon: Building,
      description: t("nav.companySettingsLinkDesc"),
    },
    {
      label: t("nav.paymentsSettingsLink"),
      path: "/settings/payments",
      icon: Landmark,
      description: t("nav.paymentsSettingsLinkDesc"),
    },
    {
      label: t("nav.payrollSettingsLink"),
      path: "/payroll/settings",
      icon: Calculator,
      description: t("nav.payrollSettingsLinkDesc"),
    },
    {
      label: t("nav.timeLeaveSettingsLink"),
      path: "/time-leave/settings",
      icon: CalendarDays,
      description: t("nav.timeLeaveSettingsLinkDesc"),
    },
    {
      label: t("nav.integrationsSettingsLink"),
      path: "/settings/integrations",
      icon: Plug,
      description: t("nav.integrationsSettingsLinkDesc"),
    },
    {
      label: t("nav.billingPlan"),
      path: "/billing",
      icon: CreditCard,
      description: t("nav.billingPlanDesc"),
    },
  ];

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
      <SEO {...seoConfig.settings} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:p-6">
        <PageHeader
          title={t("settings.headerTitle")}
          subtitle={t("settings.headerSubtitle")}
          icon={SettingsIcon}
          iconColor="text-primary"
        />

        {/* Setup Progress */}
        {!settings.setupComplete && (
          <SetupProgress progress={settings.setupProgress} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {settingsLinks.filter((link) => !link.hidden).map((link) => (
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
    </div>
  );
}
