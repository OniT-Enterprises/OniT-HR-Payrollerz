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
  Clock,
  Calendar,
  Users,
  UserCheck,
  Plus,
  CheckCircle,
  CalendarDays,
} from "lucide-react";

function TimeLeaveDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Header Skeleton */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-5 w-72" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-32" />
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
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-6 w-28 mb-2" />
                      <Skeleton className="h-4 w-44" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-36 mb-1" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
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

export default function TimeLeaveDashboard() {
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
        title: t("dashboards.timeLeave.toast.errorTitle"),
        description: t("dashboards.timeLeave.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((emp) => emp.status === "active").length;

  const stats = [
    {
      title: t("dashboards.timeLeave.stats.totalEmployees"),
      value: totalEmployees,
      subtitle: t("dashboards.timeLeave.stats.inDatabase"),
      icon: Users,
    },
    {
      title: t("dashboards.timeLeave.stats.activeEmployees"),
      value: activeEmployees,
      subtitle: t("dashboards.timeLeave.stats.availableTracking"),
      icon: UserCheck,
    },
    {
      title: t("dashboards.timeLeave.stats.timeEntries"),
      value: 0,
      subtitle: t("dashboards.timeLeave.stats.noData"),
      icon: Clock,
    },
    {
      title: t("dashboards.timeLeave.stats.leaveRequests"),
      value: 0,
      subtitle: t("dashboards.timeLeave.stats.noRequests"),
      icon: Calendar,
    },
  ];

  const setupSteps = [
    {
      step: 1,
      title: t("dashboards.timeLeave.setup.addEmployees.title"),
      description: t("dashboards.timeLeave.setup.addEmployees.description"),
      complete: totalEmployees > 0,
    },
    {
      step: 2,
      title: t("dashboards.timeLeave.setup.configureTime.title"),
      description: t("dashboards.timeLeave.setup.configureTime.description"),
      complete: false,
    },
    {
      step: 3,
      title: t("dashboards.timeLeave.setup.setupLeave.title"),
      description: t("dashboards.timeLeave.setup.setupLeave.description"),
      complete: false,
    },
  ];

  if (loading) {
    return <TimeLeaveDashboardSkeleton />;
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
                  {t("dashboards.timeLeave.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("dashboards.timeLeave.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => navigate("/people/time-tracking")}>
                  <Clock className="h-4 w-4" />
                  {t("dashboards.timeLeave.actions.trackTime")}
                </Button>
                <Button onClick={() => navigate("/people/leave")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("dashboards.timeLeave.actions.newRequest")}
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
            {/* Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {t("dashboards.timeLeave.status.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("dashboards.timeLeave.status.description")}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {t("dashboards.timeLeave.status.live")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t("dashboards.timeLeave.status.databaseConnected")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboards.timeLeave.status.firebaseConnected")}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {t("dashboards.timeLeave.status.live")}
                    </Badge>
                  </div>

                  {totalEmployees > 0 ? (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {t("dashboards.timeLeave.status.employeesAvailable")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("dashboards.timeLeave.status.activeEmployees", {
                            count: activeEmployees,
                          })}
                        </p>
                      </div>
                      <span className="text-xl font-bold">{activeEmployees}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {t("dashboards.timeLeave.status.noEmployees")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("dashboards.timeLeave.status.noEmployeesDesc")}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {t("dashboards.timeLeave.status.empty")}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Getting Started */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {t("dashboards.timeLeave.gettingStarted.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("dashboards.timeLeave.gettingStarted.description")}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {setupSteps.filter(s => s.complete).length}/{setupSteps.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {setupSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        step.complete ? "bg-primary/5" : "bg-muted/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${step.complete ? "bg-primary/10" : "bg-muted"}`}>
                        {step.complete ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="h-4 w-4 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {step.step}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                      <Badge variant="secondary" className={step.complete ? "bg-primary/10 text-primary" : ""}>
                        {step.complete
                          ? t("dashboards.timeLeave.gettingStarted.done")
                          : t("dashboards.timeLeave.gettingStarted.pending")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              {t("dashboards.timeLeave.quickActions.title")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: t("dashboards.timeLeave.quickActions.timeTracking"),
                  icon: Clock,
                  path: "/people/time-tracking",
                },
                {
                  label: t("dashboards.timeLeave.quickActions.attendance"),
                  icon: Calendar,
                  path: "/people/attendance",
                },
                {
                  label: t("dashboards.timeLeave.quickActions.leaveRequests"),
                  icon: CalendarDays,
                  path: "/people/leave",
                },
                {
                  label: t("dashboards.timeLeave.quickActions.scheduling"),
                  icon: CalendarDays,
                  path: "/people/schedules",
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
