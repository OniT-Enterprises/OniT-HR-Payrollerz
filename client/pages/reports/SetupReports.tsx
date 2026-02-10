import React, { useMemo } from "react";
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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { adminService } from "@/services/adminService";
import { settingsService } from "@/services/settingsService";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Settings,
  Download,
  Shield,
  Activity,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  AlertTriangle,
  Database,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import type { TenantSettings } from "@/types/settings";
import type { UserProfile, AdminAuditEntry } from "@/types/user";

export default function SetupReports() {
  const { session } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const tenantId = session?.tid;

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
  const setupSteps = setupProgress?.progress || {};
  const completedSteps = useMemo(() => Object.values(setupSteps).filter(Boolean).length, [setupSteps]);
  const totalSteps = useMemo(() => Object.keys(setupSteps).length || 5, [setupSteps]);

  // Export functions
  const exportToCSV = (
    data: any[],
    filename: string,
    columns: { key: string; label: string }[]
  ) => {
    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((item) =>
      columns
        .map((c) => {
          let value = c.key.split(".").reduce((obj, key) => obj?.[key], item);
          if (value?.toDate) value = value.toDate().toISOString();
          const strValue = String(value ?? "").replace(/,/g, ";");
          return `"${strValue}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: `${filename}.csv downloaded successfully`,
    });
  };

  const exportAuditLog = () => {
    exportToCSV(auditLog, "audit_log", [
      { key: "timestamp", label: "Timestamp" },
      { key: "action", label: "Action" },
      { key: "actorEmail", label: "Actor Email" },
      { key: "targetType", label: "Target Type" },
      { key: "targetName", label: "Target Name" },
    ]);
  };

  const exportUserPermissions = () => {
    const userData = users.map((u) => ({
      email: u.email,
      displayName: u.displayName || "-",
      isSuperAdmin: u.isSuperAdmin ? "Yes" : "No",
      tenantCount: u.tenantIds?.length || 0,
      createdAt: u.createdAt,
    }));
    exportToCSV(userData, "user_permissions", [
      { key: "email", label: "Email" },
      { key: "displayName", label: "Display Name" },
      { key: "isSuperAdmin", label: "Super Admin" },
      { key: "tenantCount", label: "Tenant Count" },
      { key: "createdAt", label: "Created At" },
    ]);
  };

  const exportSystemConfig = () => {
    if (!settings) return;
    const configData = [
      {
        section: "Company Details",
        setting: "Legal Name",
        value: settings.companyDetails?.legalName || "-",
      },
      {
        section: "Company Details",
        setting: "Country",
        value: settings.companyDetails?.country || "-",
      },
      {
        section: "Company Details",
        setting: "TIN Number",
        value: settings.companyDetails?.tinNumber || "-",
      },
      {
        section: "Payroll",
        setting: "WIT Rate",
        value: `${(settings.payrollConfig?.tax?.residentRate || 0.1) * 100}%`,
      },
      {
        section: "Payroll",
        setting: "INSS Employee",
        value: `${(settings.payrollConfig?.socialSecurity?.employeeRate || 0.04) * 100}%`,
      },
      {
        section: "Payroll",
        setting: "INSS Employer",
        value: `${(settings.payrollConfig?.socialSecurity?.employerRate || 0.06) * 100}%`,
      },
      {
        section: "Time Off",
        setting: "Annual Leave Days",
        value: settings.timeOffPolicies?.annualLeave?.daysPerYear || 12,
      },
      {
        section: "Time Off",
        setting: "Sick Leave Days",
        value: settings.timeOffPolicies?.sickLeave?.daysPerYear || 30,
      },
    ];
    exportToCSV(configData, "system_configuration", [
      { key: "section", label: "Section" },
      { key: "setting", label: "Setting" },
      { key: "value", label: "Value" },
    ]);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      tenant_created: "Tenant Created",
      tenant_suspended: "Tenant Suspended",
      tenant_reactivated: "Tenant Reactivated",
      user_superadmin_granted: "Superadmin Granted",
      user_superadmin_revoked: "Superadmin Revoked",
      impersonation_started: "Impersonation Started",
      impersonation_ended: "Impersonation Ended",
    };
    return labels[action] || action.replace(/_/g, " ");
  };

  const getActionColor = (action: string) => {
    if (action.includes("created") || action.includes("granted"))
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (action.includes("suspended") || action.includes("revoked"))
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (action.includes("impersonation"))
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <AutoBreadcrumb className="mb-6" />
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
      <SEO title="Setup Reports" description="System configuration and audit reports" />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("reports.setup.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("reports.setup.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Setup Progress
                  </p>
                  <p className="text-3xl font-bold">
                    {setupProgress?.percentComplete || 0}%
                  </p>
                  <p className="text-xs text-violet-600">
                    {completedSteps} of {totalSteps} steps
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
                    Total Users
                  </p>
                  <p className="text-3xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-blue-600">
                    {superAdmins} super admins
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
                    Audit Entries
                  </p>
                  <p className="text-3xl font-bold">{auditLog.length}</p>
                  <p className="text-xs text-green-600">
                    {recentActions} in last 24h
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
                    System Status
                  </p>
                  <p className="text-3xl font-bold">
                    {setupProgress?.isComplete ? "Ready" : "Setup"}
                  </p>
                  <p className="text-xs text-orange-600">
                    {settings ? "Configured" : "Pending"}
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
                Setup Progress
              </CardTitle>
              <CardDescription>
                System configuration completion status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
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
                      {step.replace(/([A-Z])/g, " $1").trim()}
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
                System Configuration
              </CardTitle>
              <CardDescription>
                Current system settings and configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium truncate max-w-[140px]">
                    {settings?.companyDetails?.legalName || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Country</span>
                  <Badge variant="outline">
                    {settings?.companyDetails?.country || "Timor-Leste"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    className={
                      setupProgress?.isComplete
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {setupProgress?.isComplete ? "Complete" : "In Progress"}
                  </Badge>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={exportSystemConfig}
                disabled={!settings}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Configuration
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                User Permissions
              </CardTitle>
              <CardDescription>
                User roles and access levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Users</span>
                  <span className="font-medium">{totalUsers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Super Admins</span>
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  >
                    {superAdmins}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Regular Users</span>
                  <Badge variant="outline">{totalUsers - superAdmins}</Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportUserPermissions}>
                <Download className="h-4 w-4 mr-2" />
                Export Permissions
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Audit Log
              </CardTitle>
              <CardDescription>
                Recent system activity and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Entries</span>
                  <span className="font-medium">{auditLog.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last 24 Hours</span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  >
                    {recentActions}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Latest</span>
                  <span className="text-xs">
                    {auditLog[0]
                      ? new Date(
                          auditLog[0].timestamp?.toDate?.() ||
                            String(auditLog[0].timestamp)
                        ).toLocaleDateString()
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
                Export Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* User Permissions Table */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              User Directory
            </CardTitle>
            <CardDescription>All registered users and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-center p-3 font-medium">Role</th>
                      <th className="text-center p-3 font-medium">Tenants</th>
                      <th className="text-center p-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 10).map((u) => (
                      <tr key={u.uid} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="font-medium">
                            {u.displayName || "No name"}
                          </div>
                        </td>
                        <td className="p-3 text-sm">{u.email}</td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              u.isSuperAdmin
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }
                          >
                            {u.isSuperAdmin ? "Super Admin" : "User"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {u.tenantIds?.length || 0}
                        </td>
                        <td className="p-3 text-center text-sm text-muted-foreground">
                          {u.createdAt
                            ? new Date(
                                (typeof u.createdAt?.toDate === 'function' ? u.createdAt.toDate() : u.createdAt) as Date
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length > 10 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Showing 10 of {users.length} users. Export to see all.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Admin audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit entries found</p>
                <p className="text-sm">Activity will appear here as actions are performed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Time</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Actor</th>
                      <th className="text-left p-3 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.slice(0, 15).map((entry, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Date(
                              entry.timestamp?.toDate?.() ||
                                String(entry.timestamp)
                            ).toLocaleString()}
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
                {auditLog.length > 15 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Showing 15 of {auditLog.length} entries. Export to see all.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
