/**
 * Settings — pure hub / directory.
 *
 * Grouped by the question the owner is actually asking, not by our modules.
 * Statutory/expert destinations sit behind one collapsed "Advanced settings"
 * disclosure so the default view holds only what a first-time, non-accountant
 * TL business owner plausibly needs. The editors live on their own pages
 * (company, access, payments, integrations under /settings/*; payroll and
 * time-off contextually at their module routes). Module navs carry NO settings
 * entries — this hub, reached from the sidebar-footer Settings link, is the
 * single way into configuration.
 */
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import { useSettings } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenant } from "@/contexts/TenantContext";
import { PRESSABLE } from "@/lib/pressable";
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
  Sparkles,
} from "lucide-react";
import { SettingsHubSkeleton } from "@/components/settings";

/** Legacy tab deep-links → the split-out pages. */
const TAB_REDIRECTS: Record<string, string> = {
  company: "/settings/company",
  structure: "/settings/company?tab=structure",
  payment: "/settings/payments",
  integrations: "/settings/integrations",
};

type HubCard = {
  label: string;
  description: string;
  path: string;
  icon: typeof Building;
  /** Literal Tailwind classes — Tailwind cannot see interpolated names. */
  iconClass: string;
  hidden?: boolean;
};

function SettingsRow({
  card,
  onNavigate,
}: {
  card: HubCard;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(card.path)}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 text-left hover:border-primary/30 hover:bg-muted/40 ${PRESSABLE}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconClass}`}
      >
        <card.icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{card.label}</p>
        <p className="text-xs text-muted-foreground">{card.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function SettingsGroup({
  heading,
  cards,
  onNavigate,
}: {
  heading: string;
  cards: HubCard[];
  onNavigate: (path: string) => void;
}) {
  const visible = cards.filter((c) => !c.hidden);
  if (visible.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <SettingsRow key={card.path} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const settingsQuery = useSettings();
  const { session, hasModule } = useTenant();
  const { data: settings, isLoading } = settingsQuery;
  const [searchParams] = useSearchParams();

  const requestedTab = searchParams.get("tab");
  if (requestedTab && TAB_REDIRECTS[requestedTab]) {
    return <Navigate to={TAB_REDIRECTS[requestedTab]} replace />;
  }

  const isPeopleAdmin = ["owner", "hr-admin"].includes(session?.role || "");

  const businessCards: HubCard[] = [
    {
      label: t("settings.hub.companyLabel") || "Business details",
      description:
        t("settings.hub.companyDesc") ||
        "Your company name, address, phone, and logo.",
      path: "/settings/company",
      icon: Building,
      iconClass: "bg-muted text-muted-foreground",
    },
    {
      label: t("settings.hub.paymentsLabel") || "How you pay your staff",
      description:
        t("settings.hub.paymentsDesc") ||
        "Cash or bank transfer, your bank accounts, and how often you pay.",
      path: "/settings/payments",
      icon: Landmark,
      iconClass: "bg-muted text-muted-foreground",
    },
    {
      label: t("settings.hub.billingLabel") || "Your Xefe plan",
      description:
        t("settings.hub.billingDesc") ||
        "What Xefe costs you, and how you pay for it.",
      path: "/billing",
      icon: CreditCard,
      iconClass: "bg-muted text-muted-foreground",
    },
  ];

  const teamCards: HubCard[] = [
    {
      label: t("settings.hub.accessLabel") || "Who can use Xefe",
      description:
        t("settings.hub.accessDesc") ||
        "Invite people, change what they can open, or reset a password.",
      path: "/settings/access",
      icon: Users,
      iconClass: "bg-muted text-muted-foreground",
      hidden: !isPeopleAdmin,
    },
    {
      label: t("settings.hub.timeOffLabel") || "Time off and holidays",
      description:
        t("settings.hub.timeOffDesc") ||
        "Days off each year, sick notes, and public holidays.",
      path: "/time-leave/settings",
      icon: CalendarDays,
      iconClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      hidden: !isPeopleAdmin || !hasModule("timeleave"),
    },
  ];

  const advancedCards: HubCard[] = [
    {
      label: t("settings.hub.payrollRulesLabel") || "Tax, INSS and overtime rules",
      description:
        t("settings.hub.payrollRulesDesc") ||
        "The rates Xefe uses to work out pay.",
      path: "/payroll/settings",
      icon: Calculator,
      iconClass: "bg-primary/10 text-primary",
      hidden: !hasModule("payroll"),
    },
    {
      label: t("settings.hub.accountantLabel") || "Your accountant",
      description:
        t("settings.hub.accountantDesc") ||
        "Give your accountant access, or send your books to QuickBooks.",
      path: "/settings/integrations",
      icon: Plug,
      iconClass: "bg-muted text-muted-foreground",
    },
  ];

  const visibleAdvanced = advancedCards.filter((c) => !c.hidden);

  if (isLoading) {
    return <SettingsHubSkeleton />;
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

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("settings.headerTitle")}
          subtitle={t("settings.headerSubtitle")}
          icon={SettingsIcon}
          iconColor="text-primary"
        />

        {!settings.setupComplete && (
          <button
            type="button"
            onClick={() => navigate("/setup")}
            className={`mb-6 flex min-h-14 w-full items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3.5 text-left hover:border-amber-500/60 hover:bg-amber-500/10 ${PRESSABLE}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t("settings.hub.finishSetupTitle") || "Finish setting up Xefe"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.hub.finishSetupDesc") ||
                  "A few questions about your business, then you can run payroll."}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}

        <SettingsGroup
          heading={t("settings.hub.groupBusiness") || "Your business"}
          cards={businessCards}
          onNavigate={navigate}
        />

        <SettingsGroup
          heading={t("settings.hub.groupTeam") || "Your team"}
          cards={teamCards}
          onNavigate={navigate}
        />

        {visibleAdvanced.length > 0 && (
          <MoreDetailsSection
            title={t("settings.hub.advancedTitle") || "Advanced settings"}
            className="mt-2"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              {t("settings.hub.advancedCaution") ||
                "These already follow Timor-Leste law. Change them only if your accountant asks you to."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAdvanced.map((card) => (
                <SettingsRow key={card.path} card={card} onNavigate={navigate} />
              ))}
            </div>
          </MoreDetailsSection>
        )}
      </div>
    </div>
  );
}
