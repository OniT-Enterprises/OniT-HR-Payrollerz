import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ReportEmptyState,
  ReportPage,
  ReportPageSkeleton,
} from "@/components/reports/ReportLayout";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { CheckCircle2, Circle, Download, Settings } from "lucide-react";
import { SEO } from "@/components/SEO";
import { exportToCSV } from "@/lib/csvExport";
import { useTenant } from "@/contexts/TenantContext";

export default function SetupReports() {
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { canManage } = useTenant();
  const canManageTenant = canManage();
  const settingsQuery = useSettings();

  const settings = settingsQuery.data;
  const setupProgress = useMemo(() => {
    if (!settings) return null;
    const steps = Object.values(settings.setupProgress);
    return {
      isComplete: settings.setupComplete,
      progress: settings.setupProgress,
      percentComplete: Math.round(
        (steps.filter(Boolean).length / steps.length) * 100,
      ),
    };
  }, [settings]);
  const setupSteps = useMemo(
    () => Object.entries(setupProgress?.progress ?? {}),
    [setupProgress],
  );

  const getSetupStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      companyDetails: t("reports.setup.steps.companyDetails"),
      companyStructure: t("reports.setup.steps.companyStructure"),
      paymentStructure: t("reports.setup.steps.paymentStructure"),
      timeOffPolicies: t("reports.setup.steps.timeOffPolicies"),
      payrollConfig: t("reports.setup.steps.payrollConfig"),
    };
    return labels[step] ?? step.replace(/([A-Z])/g, " $1").trim();
  };

  const exportSystemConfig = () => {
    if (!settings) return;

    const configData = [
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.legalName"),
        value: settings.companyDetails.legalName || "-",
      },
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.country"),
        value: settings.companyDetails.country || "-",
      },
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.tinNumber"),
        value: settings.companyDetails.tinNumber || "-",
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.witRate"),
        value: `${settings.payrollConfig.tax.residentRate ?? 10}%`,
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.inssEmployee"),
        value: `${settings.payrollConfig.socialSecurity.employeeRate ?? 4}%`,
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.inssEmployer"),
        value: `${settings.payrollConfig.socialSecurity.employerRate ?? 6}%`,
      },
      {
        section: t("reports.setup.configSections.timeOff"),
        setting: t("reports.setup.configSettings.annualLeaveDays"),
        value: settings.timeOffPolicies.annualLeave.daysPerYear ?? 12,
      },
      {
        section: t("reports.setup.configSections.timeOff"),
        setting: t("reports.setup.configSettings.sickLeaveDays"),
        value: settings.timeOffPolicies.sickLeave.daysPerYear ?? 30,
      },
    ];

    const filename = "system_configuration";
    exportToCSV(configData, filename, [
      { key: "section", label: t("reports.setup.csv.section") },
      { key: "setting", label: t("reports.setup.csv.setting") },
      { key: "value", label: t("reports.setup.csv.value") },
    ]);
    toast({
      title: t("reports.shared.exportTitle"),
      description: t("reports.shared.exportDescription", {
        filename: `${filename}.csv`,
      }),
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <ReportPageSkeleton sections={2} maxWidth="lg" showToolbar={false} />
    );
  }

  if (settingsQuery.isError && settingsQuery.data === undefined) {
    return (
      <ReportPage
        title={t("reports.setup.title")}
        subtitle={t("reports.setup.subtitle")}
        icon={Settings}
        maxWidth="lg"
      >
        <DashboardLoadError
          isRetrying={settingsQuery.isFetching}
          onRetry={() => settingsQuery.refetch()}
        />
      </ReportPage>
    );
  }

  if (!settings || !setupProgress) {
    return (
      <>
        <SEO
          title={`${t("reports.setup.title")} | Xefe`}
          description={t("reports.setup.subtitle")}
        />
        <ReportPage
          title={t("reports.setup.title")}
          subtitle={t("reports.setup.subtitle")}
          icon={Settings}
          maxWidth="lg"
        >
          <Card className="border-border/70 shadow-sm">
            <CardContent>
              <ReportEmptyState
                icon={Settings}
                title={t("reports.setup.missing.title")}
                description={t(
                  canManageTenant
                    ? "reports.setup.missing.managerDescription"
                    : "reports.setup.missing.viewerDescription",
                )}
                actionLabel={
                  canManageTenant
                    ? t("reports.setup.missing.action")
                    : undefined
                }
                onAction={
                  canManageTenant ? () => navigate("/setup") : undefined
                }
              />
            </CardContent>
          </Card>
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO
        title={`${t("reports.setup.title")} | Xefe`}
        description={t("reports.setup.subtitle")}
      />
      <ReportPage
        title={t("reports.setup.title")}
        subtitle={t("reports.setup.subtitle")}
        icon={Settings}
        maxWidth="lg"
      >
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-violet-600" />
              {t("reports.setup.progress.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.setup.progress.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5">
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span>{t("reports.setup.progress.overall")}</span>
                <span className="font-medium">
                  {setupProgress.percentComplete}%
                </span>
              </div>
              <Progress value={setupProgress.percentComplete} className="h-2" />
            </div>

            <div className="space-y-2">
              {setupSteps.map(([step, done]) => (
                <div
                  key={step}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium">
                      {getSetupStepLabel(step)}
                    </span>
                  </div>
                  <Badge variant={done ? "default" : "outline"}>
                    {done
                      ? t("reports.setup.values.complete")
                      : t("reports.setup.values.inProgress")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-violet-600" />
              {t("reports.setup.cards.configuration.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.setup.cards.configuration.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="mb-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t("reports.setup.cards.configuration.company")}
                </dt>
                <dd className="max-w-[60%] truncate font-medium">
                  {settings.companyDetails.legalName ||
                    t("reports.setup.values.notSet")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t("reports.setup.cards.configuration.country")}
                </dt>
                <dd>{settings.companyDetails.country || "Timor-Leste"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t("reports.setup.cards.configuration.status")}
                </dt>
                <dd>
                  <Badge variant="outline">
                    {setupProgress.isComplete
                      ? t("reports.setup.values.complete")
                      : t("reports.setup.values.inProgress")}
                  </Badge>
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={exportSystemConfig}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("reports.setup.cards.configuration.export")}
            </Button>
          </CardContent>
        </Card>
      </ReportPage>
    </>
  );
}
