import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { adminService } from "@/services/adminService";
import { settingsService } from "@/services/settingsService";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Settings,
  Download,
  Shield,
  Activity,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Database,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { exportToCSV } from "@/lib/csvExport";

export default function SetupReports() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user: _user } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useI18n();

  const formatDateTime = (value: unknown) => {
    const date =
      typeof value === "object" && value !== null && "toDate" in value
        ? (value as { toDate: () => Date }).toDate()
        : new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const getSetupStepLabel = (step: string) => {
    const stepLabels: Record<string, string> = {
      companyDetails: t("reports.setup.steps.companyDetails"),
      companyStructure: t("reports.setup.steps.companyStructure"),
      paymentStructure: t("reports.setup.steps.paymentStructure"),
      timeOffPolicies: t("reports.setup.steps.timeOffPolicies"),
      payrollConfig: t("reports.setup.steps.payrollConfig"),
    };

    return stepLabels[step] || step.replace(/([A-Z])/g, " $1").trim();
  };

  // Fetch audit log with React Query
  const { data: auditLog = [], isLoading: auditLoading } = useQuery({
    queryKey: ['auditLog'],
    queryFn: () => adminService.getAuditLog(50).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch users with React Query
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminService.getAllUsers(100).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch settings with React Query
  const { data: settings = null, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', tenantId],
    queryFn: () => settingsService.getSettings(tenantId!).catch(() => null),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch setup progress with React Query
  const { data: setupProgress = null, isLoading: progressLoading } = useQuery({
    queryKey: ['setupProgress', tenantId],
    queryFn: () => settingsService.getSetupProgress(tenantId!).catch(() => null),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const loading = auditLoading || usersLoading || (tenantId ? (settingsLoading || progressLoading) : false);

  // Calculate stats
  const totalUsers = users.length;
  const superAdmins = useMemo(() => users.filter((u) => u.isSuperAdmin).length, [users]);
  const recentActions = useMemo(() => auditLog.filter((a) => {
    const actionDate = a.timestamp?.toDate?.() || new Date(String(a.timestamp));
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    return actionDate > dayAgo;
  }).length, [auditLog]);

  // Setup status
  const setupSteps = useMemo(() => setupProgress?.progress || {}, [setupProgress]);
  const completedSteps = useMemo(() => Object.values(setupSteps).filter(Boolean).length, [setupSteps]);
  const totalSteps = useMemo(() => Object.keys(setupSteps).length || 5, [setupSteps]);

  const doExport = (data: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.shared.exportTitle"),
      description: t("reports.shared.exportDescription", { filename: `${filename}.csv` }),
    });
  };

  const exportAuditLog = () => {
    doExport(auditLog as unknown as Record<string, unknown>[], "audit_log", [
      { key: "timestamp", label: t("reports.setup.csv.timestamp") },
      { key: "action", label: t("reports.setup.csv.action") },
      { key: "actorEmail", label: t("reports.setup.csv.actorEmail") },
      { key: "targetType", label: t("reports.setup.csv.targetType") },
      { key: "targetName", label: t("reports.setup.csv.targetName") },
    ]);
  };

  const exportUserPermissions = () => {
    const userData = users.map((u) => ({
      email: u.email,
      displayName: u.displayName || "-",
      isSuperAdmin: u.isSuperAdmin ? t("reports.setup.values.yes") : t("reports.setup.values.no"),
      tenantCount: u.tenantIds?.length || 0,
      createdAt: u.createdAt,
    }));
    doExport(userData, "user_permissions", [
      { key: "email", label: t("reports.setup.csv.email") },
      { key: "displayName", label: t("reports.setup.csv.displayName") },
      { key: "isSuperAdmin", label: t("reports.setup.csv.superAdmin") },
      { key: "tenantCount", label: t("reports.setup.csv.tenantCount") },
      { key: "createdAt", label: t("reports.setup.csv.createdAt") },
    ]);
  };

  const exportSystemConfig = () => {
    if (!settings) return;
    const configData = [
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.legalName"),
        value: settings.companyDetails?.legalName || "-",
      },
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.country"),
        value: settings.companyDetails?.country || "-",
      },
      {
        section: t("reports.setup.configSections.companyDetails"),
        setting: t("reports.setup.configSettings.tinNumber"),
        value: settings.companyDetails?.tinNumber || "-",
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.witRate"),
        value: `${(settings.payrollConfig?.tax?.residentRate || 0.1) * 100}%`,
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.inssEmployee"),
        value: `${(settings.payrollConfig?.socialSecurity?.employeeRate || 0.04) * 100}%`,
      },
      {
        section: t("reports.setup.configSections.payroll"),
        setting: t("reports.setup.configSettings.inssEmployer"),
        value: `${(settings.payrollConfig?.socialSecurity?.employerRate || 0.06) * 100}%`,
      },
      {
        section: t("reports.setup.configSections.timeOff"),
        setting: t("reports.setup.configSettings.annualLeaveDays"),
        value: settings.timeOffPolicies?.annualLeave?.daysPerYear || 12,
      },
      {
        section: t("reports.setup.configSections.timeOff"),
        setting: t("reports.setup.configSettings.sickLeaveDays"),
        value: settings.timeOffPolicies?.sickLeave?.daysPerYear || 30,
      },
    ];
    doExport(configData, "system_configuration", [
      { key: "section", label: t("reports.setup.csv.section") },
      { key: "setting", label: t("reports.setup.csv.setting") },
      { key: "value", label: t("reports.setup.csv.value") },
    ]);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      tenant_created: t("admin.auditLog.actionTenantCreated"),
      tenant_suspended: t("admin.auditLog.actionTenantSuspended"),
      tenant_reactivated: t("admin.auditLog.actionTenantReactivated"),
      superadmin_granted: t("admin.auditLog.actionSuperadminGranted"),
      superadmin_revoked: t("admin.auditLog.actionSuperadminRevoked"),
      user_superadmin_granted: t("admin.auditLog.actionSuperadminGranted"),
      user_superadmin_revoked: t("admin.auditLog.actionSuperadminRevoked"),
      impersonation_started: t("admin.auditLog.actionImpersonationStarted"),
      impersonation_ended: t("admin.auditLog.actionImpersonationEnded"),
    };
    return labels[action] || action.replace(/_/g, " ");
  };

  const getActionColor = (action: string) => {
    if (action.includes("created") || action.includes("granted"))
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (action.includes("suspended") || action.includes("revoked"))
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (action.includes("impersonation"))
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 mx-auto max-w-screen-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${t("reports.setup.title")} | Meza`} description={t("reports.setup.subtitle")} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.setup.title")}
          subtitle={t("reports.setup.subtitle")}
          icon={Settings}
          iconColor="text-violet-500"
        />
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.setup.stats.setupProgress")}
                  </p>
                  <p className="text-3xl font-bold">
                    {setupProgress?.percentComplete || 0}%
                  </p>
                  <p className="text-xs text-violet-600">
                    {t("reports.setup.stats.stepsComplete", {
                      completed: String(completedSteps),
                      total: String(totalSteps),
                    })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
                  <Settings className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.setup.stats.totalUsers")}
                  </p>
                  <p className="text-3xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-blue-600">
                    {t("reports.setup.stats.superAdmins", { count: String(superAdmins) })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.setup.stats.auditEntries")}
                  </p>
                  <p className="text-3xl font-bold">{auditLog.length}</p>
                  <p className="text-xs text-green-600">
                    {t("reports.setup.stats.last24Hours", { count: String(recentActions) })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <Activity className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.setup.stats.systemStatus")}
                  </p>
                  <p className="text-3xl font-bold">
                    {setupProgress?.isComplete
                      ? t("reports.setup.values.ready")
                      : t("reports.setup.values.setup")}
                  </p>
                  <p className="text-xs text-orange-600">
                    {settings
                      ? t("reports.setup.values.configured")
                      : t("reports.setup.values.pending")}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                  <Database className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Progress Card */}
        {setupProgress && (
          <Card className="border-border/50 shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-violet-600" />
                {t("reports.setup.progress.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.setup.progress.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{t("reports.setup.progress.overall")}</span>
                  <span className="font-medium">
                    {setupProgress.percentComplete}%
                  </span>
                </div>
                <Progress value={setupProgress.percentComplete} className="h-2" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(setupProgress.progress).map(([step, done]) => (
                  <div
                    key={step}
                    className={`p-3 rounded-lg text-center ${
                      done
                        ? "bg-green-50 dark:bg-green-900/30"
                        : "bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                    )}
                    <p className="text-xs capitalize">
                      {getSetupStepLabel(step)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-violet-600" />
                {t("reports.setup.cards.configuration.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.setup.cards.configuration.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.configuration.company")}</span>
                  <span className="font-medium truncate max-w-[140px]">
                    {settings?.companyDetails?.legalName || t("reports.setup.values.notSet")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.configuration.country")}</span>
                  <Badge variant="outline">
                    {settings?.companyDetails?.country || "Timor-Leste"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.configuration.status")}</span>
                  <Badge
                    className={
                      setupProgress?.isComplete
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      }
                  >
                    {setupProgress?.isComplete
                      ? t("reports.setup.values.complete")
                      : t("reports.setup.values.inProgress")}
                  </Badge>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={exportSystemConfig}
                disabled={!settings}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.setup.cards.configuration.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                {t("reports.setup.cards.permissions.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.setup.cards.permissions.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.permissions.totalUsers")}</span>
                  <span className="font-medium">{totalUsers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.permissions.superAdmins")}</span>
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  >
                    {superAdmins}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.permissions.regularUsers")}</span>
                  <Badge variant="outline">{totalUsers - superAdmins}</Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportUserPermissions}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.setup.cards.permissions.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                {t("reports.setup.cards.audit.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.setup.cards.audit.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.audit.totalEntries")}</span>
                  <span className="font-medium">{auditLog.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.audit.last24Hours")}</span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  >
                    {recentActions}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.setup.cards.audit.latest")}</span>
                  <span className="text-xs">
                    {auditLog[0]
                      ? formatDateTime(auditLog[0].timestamp)
                      : "-"}
                  </span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={exportAuditLog}
                disabled={auditLog.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.setup.cards.audit.export")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* User Permissions Table */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              {t("reports.setup.usersTable.title")}
            </CardTitle>
            <CardDescription>{t("reports.setup.usersTable.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">{t("reports.setup.usersTable.empty")}</p>
                <Button variant="outline" onClick={() => navigate("/admin/users")}>
                  <Users className="h-4 w-4 mr-2" />
                  {t("reports.setup.usersTable.manageUsers")}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {users.slice(0, 10).map((u) => (
                    <div key={u.uid} className="rounded-lg border border-border/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{u.displayName || t("reports.setup.values.noName")}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge
                          className={
                            u.isSuperAdmin
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }
                        >
                          {u.isSuperAdmin ? t("reports.setup.values.superAdmin") : t("reports.setup.values.user")}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.setup.usersTable.columns.tenants")}</p>
                          <p>{u.tenantIds?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.setup.usersTable.columns.created")}</p>
                          <p>
                            {u.createdAt
                              ? formatDateTL((typeof u.createdAt?.toDate === "function" ? u.createdAt.toDate() : u.createdAt) as Date)
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t("reports.setup.usersTable.columns.user")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.setup.usersTable.columns.email")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.setup.usersTable.columns.role")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.setup.usersTable.columns.tenants")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.setup.usersTable.columns.created")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 10).map((u) => (
                        <tr key={u.uid} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="font-medium">
                              {u.displayName || t("reports.setup.values.noName")}
                            </div>
                          </td>
                          <td className="p-3 text-sm">{u.email}</td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                u.isSuperAdmin
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }
                            >
                              {u.isSuperAdmin ? t("reports.setup.values.superAdmin") : t("reports.setup.values.user")}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            {u.tenantIds?.length || 0}
                          </td>
                          <td className="p-3 text-center text-sm text-muted-foreground">
                            {u.createdAt
                              ? formatDateTL((typeof u.createdAt?.toDate === 'function' ? u.createdAt.toDate() : u.createdAt) as Date)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {users.length > 10 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t("reports.setup.usersTable.showingLimited", {
                      shown: "10",
                      total: String(users.length),
                    })}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-600" />
              {t("reports.setup.auditTable.title")}
            </CardTitle>
            <CardDescription>{t("reports.setup.auditTable.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("reports.setup.auditTable.empty")}</p>
                <p className="text-sm">{t("reports.setup.auditTable.emptyDescription")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {auditLog.slice(0, 15).map((entry, idx) => (
                    <div key={idx} className="rounded-lg border border-border/50 p-4">
                      <div className="space-y-3">
                        <Badge className={getActionColor(entry.action)}>
                          {getActionLabel(entry.action)}
                        </Badge>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{formatDateTime(entry.timestamp)}</span>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("reports.setup.auditTable.columns.actor")}</p>
                            <p>{entry.actorEmail || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("reports.setup.auditTable.columns.target")}</p>
                            <p>{entry.targetName || entry.targetId || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t("reports.setup.auditTable.columns.time")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.setup.auditTable.columns.action")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.setup.auditTable.columns.actor")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.setup.auditTable.columns.target")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.slice(0, 15).map((entry, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {formatDateTime(entry.timestamp)}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge className={getActionColor(entry.action)}>
                              {getActionLabel(entry.action)}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">{entry.actorEmail}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {entry.targetType === "tenant" ? (
                                <Building className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Users className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {entry.targetName || entry.targetId}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {auditLog.length > 15 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t("reports.setup.auditTable.showingLimited", {
                      shown: "15",
                      total: String(auditLog.length),
                    })}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
