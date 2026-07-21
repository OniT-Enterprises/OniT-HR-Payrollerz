import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HubCard } from "@/components/dashboard/HubCard";
import PageHeader from "@/components/layout/PageHeader";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import {
  filterModuleNavConfigByPermissions,
  reportsNavConfig,
} from "@/lib/moduleNav";
import { useTenant } from "@/contexts/TenantContext";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";
import { useI18n } from "@/i18n/I18nProvider";
import { BarChart3, Wrench } from "lucide-react";

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session, hasModule, canManage, showAdvancedTax } = useTenant();
  const hasReports = hasModule("reports");
  const hasPayroll = hasModule("payroll");
  const hasStaff = hasModule("staff");
  const hasTimeleave = hasModule("timeleave");
  const ngoReportingEnabled = canUseNgoReporting(session, hasReports);
  const donorExportEnabled = canUseDonorExport(
    session,
    hasReports,
    canManage(),
  );
  const filteredConfig = filterModuleNavConfigByPermissions(
    reportsNavConfig,
    hasModule,
    canManage(),
    canManage() || session?.role === "manager",
    showAdvancedTax,
  );
  const reportFamilies = filteredConfig.sections.flatMap((section) => {
    if (section.id === "payroll-reports" && !hasPayroll) return [];
    if (
      (section.id === "employee-reports" ||
        section.id === "department-reports") &&
      !hasStaff
    )
      return [];
    if (section.id === "attendance-reports" && !hasTimeleave) return [];
    if (section.id !== "ngo") return [section];
    if (!ngoReportingEnabled) return [];
    return [
      {
        ...section,
        subPages: section.subPages.filter((page) =>
          page.path === "/reports/donor-export" ? donorExportEnabled : true,
        ),
      },
    ];
  });

  const familyCards = reportFamilies.map((section) => {
    const outputs =
      section.subPages.length > 0 ? section.subPages : [{ path: section.path }];
    const count = outputs.length;
    return {
      id: section.id,
      title: t(`nav.${section.labelKey}`) || section.label,
      path: outputs[0]?.path ?? section.path,
      description:
        t(`moduleDashboards.reports.families.${section.id}`) ||
        t(
          count === 1
            ? "moduleDashboards.reports.families.fallbackSingle"
            : "moduleDashboards.reports.families.fallbackPlural",
          { count },
        ),
      icon: section.icon,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.reports.title")}
        description={t("moduleDashboards.reports.seoDescription")}
      />
      <ModuleSectionNav config={reportsNavConfig} />

      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          size="lg"
          title={t("moduleDashboards.reports.title")}
          icon={BarChart3}
          iconColor="text-violet-500"
          subtitle={t(
            familyCards.length === 1
              ? "moduleDashboards.reports.summarySingle"
              : "moduleDashboards.reports.summaryPlural",
            { count: familyCards.length },
          )}
          actions={
            <Button
              className="w-full sm:w-auto"
              onClick={() => navigate("/reports/custom")}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {t("reports.custom.buildReport")}
            </Button>
          }
        />

        {/* Report library */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("moduleDashboards.reports.browseReports")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {familyCards.map((card) => (
              <HubCard
                key={card.id}
                icon={card.icon}
                title={card.title}
                purpose={card.description}
                action={t("moduleDashboards.reports.browseAction")}
                accent="violet"
                onClick={() => navigate(card.path)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
