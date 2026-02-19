import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Users,
  UserCheck,
  UserX,
  Building,
  Plus,
  ChevronRight,
  UserPlus,
  Building2,
} from "lucide-react";

function StaffDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Header Skeleton */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Skeleton className="h-8 w-44 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-36" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  <Skeleton className="h-9 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-36 mb-2" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Skeleton */}
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const employeesData = await employeeService.getAllEmployees(tenantId);
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast({
        title: t("dashboards.staff.toast.errorTitle"),
        description: t("dashboards.staff.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((emp) => emp.status === "active").length;
  const inactiveEmployees = employees.filter((emp) => emp.status === "inactive").length;

  const departmentStats = employees.reduce(
    (acc, emp) => {
      const dept = emp.jobDetails?.department || t("dashboards.staff.labels.unknown");
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalDepartments = Object.keys(departmentStats).length;
  const activeRate = totalEmployees > 0
    ? ((activeEmployees / totalEmployees) * 100).toFixed(1)
    : "0";

  const topDepartments = Object.entries(departmentStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const stats = [
    {
      title: t("dashboards.staff.stats.totalEmployees"),
      value: totalEmployees,
      subtitle: t("dashboards.staff.stats.inDatabase"),
      icon: Users,
    },
    {
      title: t("dashboards.staff.stats.activeEmployees"),
      value: activeEmployees,
      subtitle: t("dashboards.staff.stats.activeRate", { rate: activeRate }),
      icon: UserCheck,
    },
    {
      title: t("dashboards.staff.stats.departments"),
      value: totalDepartments,
      subtitle: t("dashboards.staff.stats.activeDepartments"),
      icon: Building,
    },
    {
      title: t("dashboards.staff.stats.inactive"),
      value: inactiveEmployees,
      subtitle: t("dashboards.staff.stats.inactiveRate", {
        rate:
          totalEmployees > 0
            ? ((inactiveEmployees / totalEmployees) * 100).toFixed(1)
            : "0",
      }),
      icon: UserX,
    },
  ];

  if (loading) {
    return <StaffDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Clean Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t("dashboards.staff.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("dashboards.staff.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => navigate("/people/employees")}>
                  <Users className="h-4 w-4" />
                  {t("dashboards.staff.actions.viewAll")}
                </Button>
                <Button onClick={() => navigate("/people/add")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("dashboards.staff.actions.addEmployee")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </span>
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Departments</CardTitle>
                    <CardDescription>
                      {t("dashboards.staff.departments.distribution", {
                        total: totalEmployees,
                      })}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1"
                    onClick={() => navigate("/people/departments")}
                  >
                    {t("dashboards.staff.actions.viewAll")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {totalEmployees === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {t("dashboards.staff.departments.emptyEmployees")}
                    </p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate("/admin/seed")}
                    >
                      {t("dashboards.staff.departments.seedDatabase")}
                    </Button>
                  </div>
                ) : topDepartments.length === 0 ? (
                  <div className="text-center py-8">
                    <Building className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {t("dashboards.staff.departments.emptyDepartments")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topDepartments.map(([department, count], _index) => {
                      const percentage = totalEmployees > 0
                        ? Math.round((count / totalEmployees) * 100)
                        : 0;

                      return (
                        <div key={department} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate max-w-[200px]">{department}</span>
                            <span className="text-muted-foreground">
                              {t("dashboards.staff.departments.count", {
                                count,
                                percent: percentage,
                              })}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {t("dashboards.staff.status.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("dashboards.staff.status.description")}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {t("dashboards.staff.status.live")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t("dashboards.staff.status.activeTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboards.staff.status.activeDescription")}
                      </p>
                    </div>
                    <span className="text-2xl font-bold">{activeEmployees}</span>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <UserX className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t("dashboards.staff.status.inactiveTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboards.staff.status.inactiveDescription")}
                      </p>
                    </div>
                    <span className="text-2xl font-bold">{inactiveEmployees}</span>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Building className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t("dashboards.staff.status.departmentsTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboards.staff.status.departmentsDescription")}
                      </p>
                    </div>
                    <span className="text-2xl font-bold">{totalDepartments}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              {t("dashboards.staff.quickActions.title")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: t("dashboards.staff.quickActions.allEmployees"),
                  icon: Users,
                  path: "/people/employees",
                },
                {
                  label: t("dashboards.staff.quickActions.addEmployee"),
                  icon: UserPlus,
                  path: "/people/add",
                },
                {
                  label: t("dashboards.staff.quickActions.departments"),
                  icon: Building,
                  path: "/people/departments",
                },
                {
                  label: t("dashboards.staff.quickActions.orgChart"),
                  icon: Building2,
                  path: "/people/org-chart",
                },
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
