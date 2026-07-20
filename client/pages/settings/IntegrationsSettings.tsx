/**
 * Accountant & Integrations Settings — QuickBooks export, advanced tax mode,
 * and the accountant partner program, split out of the /settings hub.
 * All three are accountant-facing, which is why they live together.
 */
import { Link } from "react-router-dom";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO } from "@/components/SEO";
import { ArrowLeft, Plug } from "lucide-react";
import {
  QuickBooksSettings,
  AdvancedTaxModeCard,
  AccountantPartnerCard,
} from "@/components/settings";

export default function IntegrationsSettings() {
  const tenantId = useTenantId();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Accountant & Integrations | Xefe" description="QuickBooks export, advanced tax mode, and accountant access" noIndex />
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
          title={t("nav.integrationsSettingsLink")}
          subtitle={t("nav.integrationsSettingsLinkDesc")}
          icon={Plug}
          iconColor="text-primary"
        />

        {tenantId && <QuickBooksSettings tenantId={tenantId} />}
        <AdvancedTaxModeCard />
        <AccountantPartnerCard />
      </div>
    </div>
  );
}
