/**
 * Accountant & Integrations Settings — QuickBooks export, advanced tax mode,
 * and the accountant partner program, split out of the /settings hub.
 * All three are accountant-facing, which is why they live together.
 */
import { Link } from "react-router-dom";
import MainNavigation from "@/components/layout/MainNavigation";
import MoreDetailsSection from "@/components/MoreDetailsSection";
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

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
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

        {/* Far more TL businesses have an accountant than have QuickBooks, so
            the partner card leads and the export mapping table waits behind a
            disclosure. Nothing is removed — one tap reaches it. */}
        <AccountantPartnerCard />
        <AdvancedTaxModeCard />

        {tenantId && (
          <MoreDetailsSection
            title={t("settings.integrations.quickbooksTitle") || "Export to QuickBooks or other accounting software"}
            className="mt-6"
          >
            <QuickBooksSettings tenantId={tenantId} />
          </MoreDetailsSection>
        )}
      </div>
    </div>
  );
}
