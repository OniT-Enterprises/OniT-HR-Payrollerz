/**
 * Sitemap — a compact, permission-aware directory of the current app.
 *
 * The route list comes from the same configuration as the sidebar. That keeps
 * labels, permissions, and destinations in sync instead of maintaining a
 * second English-only catalogue that can silently go stale.
 */

import { Link } from "react-router-dom";
import {
  ChevronRight,
  CreditCard,
  HelpCircle,
  Map,
  Settings,
} from "lucide-react";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import {
  APP_NAV_ITEMS,
  isAppNavItemVisible,
  type AppNavItem,
} from "@/lib/appNavigation";
import {
  filterModuleNavConfigByPermissions,
  type ModuleNavConfig,
  type ModuleSection,
} from "@/lib/moduleNav";
import { sectionThemes } from "@/lib/sectionTheme";
import { useTenant } from "@/contexts/TenantContext";

type SitemapLink = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

function SitemapLinkRow({ link }: { link: SitemapLink }) {
  const Icon = link.icon;

  return (
    <Link
      to={link.path}
      className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
    </Link>
  );
}

function SitemapSectionGroup({
  section,
  links,
  showHeading,
}: {
  section: ModuleSection;
  links: SitemapLink[];
  showHeading: boolean;
}) {
  return (
    <div className="p-2">
      {showHeading && (
        <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {section.label}
        </p>
      )}
      <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <SitemapLinkRow key={link.path} link={link} />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  item,
  config,
}: {
  item: AppNavItem;
  config?: ModuleNavConfig;
}) {
  const Icon = item.icon;
  const theme = sectionThemes[item.id];

  return (
    <Card className="overflow-hidden border-border/70 shadow-none">
      <CardHeader className="p-0">
        <Link
          to={item.path}
          className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.bg} ${theme.text}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 text-base font-semibold">
            {item.label}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardHeader>

      {config && config.sections.length > 0 && (
        <CardContent className="divide-y divide-border/60 border-t border-border/60 p-0">
          {config.sections.map((section) => {
            const sectionLinks = [
              {
                label: section.label,
                path: section.path,
                icon: section.icon,
              },
              ...section.subPages.map((page) => ({
                label: page.label,
                path: page.path,
                icon: page.icon,
              })),
            ].filter(
              (link, index, all) =>
                all.findIndex((candidate) => candidate.path === link.path) ===
                index,
            );

            return (
              <SitemapSectionGroup
                key={section.id}
                section={section}
                links={sectionLinks}
                showHeading={sectionLinks.length > 1}
              />
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

export default function Sitemap() {
  const { t } = useI18n();
  const { hasModule, canManage, session, showAdvancedTax } = useTenant();
  const canManageTenant = canManage();
  const canManageTeam = canManageTenant || session?.role === "manager";

  const modules = APP_NAV_ITEMS.filter((item) =>
    isAppNavItemVisible(item, hasModule),
  ).map((item) => {
    const config = item.config
      ? filterModuleNavConfigByPermissions(
          item.config,
          hasModule,
          canManageTenant,
          canManageTeam,
          showAdvancedTax,
          session?.role,
        )
      : undefined;

    return {
      item: {
        ...item,
        label: t(item.labelKey) || item.label,
      },
      config: config
        ? {
            ...config,
            sections: config.sections.map((section) => ({
              ...section,
              label: section.labelKey
                ? t(`nav.${section.labelKey}`) || section.label
                : section.label,
              subPages: section.subPages.map((page) => ({
                ...page,
                label: page.labelKey
                  ? t(`nav.${page.labelKey}`) || page.label
                  : page.label,
              })),
            })),
          }
        : undefined,
    };
  });

  const utilityLinks: SitemapLink[] = [
    {
      label: t("common.getHelp"),
      path: "/help",
      icon: HelpCircle,
    },
    ...(canManageTenant
      ? [
          {
            label: t("common.settings"),
            path: "/settings",
            icon: Settings,
          },
          {
            label: t("nav.billingPlan"),
            path: "/billing",
            icon: CreditCard,
          },
        ]
      : []),
  ];

  return (
    <div className="bg-background">
      <SEO
        title={`${t("common.sitemap")} - Xefe`}
        description={t("sitemap.subtitle")}
      />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("common.sitemap")}
          subtitle={t("sitemap.subtitle")}
          icon={Map}
          iconColor="text-primary"
        />

        <div className="space-y-4">
          {modules.map(({ item, config }) => (
            <ModuleCard key={item.id} item={item} config={config} />
          ))}

          <Card className="overflow-hidden border-border/70 shadow-none">
            <CardHeader className="flex min-h-14 flex-row items-center gap-3 border-b border-border/60 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{t("common.more")}</span>
            </CardHeader>
            <CardContent className="grid gap-0.5 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {utilityLinks.map((link) => (
                <SitemapLinkRow key={link.path} link={link} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
