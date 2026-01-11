import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Users,
  DollarSign,
  Building,
  TrendingUp,
  Plus,
  ChevronRight,
  Clock,
  FileText,
} from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesData, departmentsData] = await Promise.all([
        employeeService.getAllEmployees(),
        departmentService.getAllDepartments(),
      ]);
      setEmployees(employeesData);
      setDepartmentCount(departmentsData.length);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalPayroll = activeEmployees.reduce(
    (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
    0
  );

  const recentHires = [...employees]
    .filter((e) => e.jobDetails?.hireDate)
    .sort((a, b) => {
      const dateA = new Date(a.jobDetails.hireDate);
      const dateB = new Date(b.jobDetails.hireDate);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  const departmentStats = employees.reduce(
    (acc, emp) => {
      const dept = emp.jobDetails?.department || t("dashboard.unknownDepartment");
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <Button onClick={() => navigate("/people/add")} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            {t("dashboard.addEmployee")}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Employees */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{t("dashboard.totalEmployees")}</span>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground">{activeEmployees.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("dashboard.inactiveCount", { count: employees.length - activeEmployees.length })}
              </p>
            </CardContent>
          </Card>

          {/* Monthly Payroll */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{t("dashboard.monthlyPayroll")}</span>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground">${totalPayroll.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.totalCompensation")}</p>
            </CardContent>
          </Card>

          {/* Departments */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{t("dashboard.departments")}</span>
                <Building className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground">{departmentCount}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("dashboard.withStaff", { count: Object.keys(departmentStats).length })}
              </p>
            </CardContent>
          </Card>

          {/* Average Salary */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{t("dashboard.avgSalary")}</span>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground">
                ${activeEmployees.length > 0
                  ? Math.round(totalPayroll / activeEmployees.length).toLocaleString()
                  : "0"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t("dashboard.perEmployee")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">{t("dashboard.departmentBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(departmentStats).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(departmentStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([dept, count]) => {
                      const percentage = Math.round((count / employees.length) * 100);
                      return (
                        <div key={dept}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{dept}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold">{count}</span>
                              <span className="text-sm text-muted-foreground ml-2">({percentage}%)</span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("dashboard.noDepartmentData")}</p>
                  <Button
                    variant="link"
                    className="text-primary mt-1"
                    onClick={() => navigate("/admin/seed")}
                  >
                    {t("dashboard.seedData")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">{t("dashboard.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                onClick={() => navigate("/people/add")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("dashboard.addEmployee")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.createRecord")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => navigate("/payroll/run")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("dashboard.runPayroll")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.processPayments")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => navigate("/people/time-tracking")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("dashboard.timeTracking")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.viewAttendance")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => navigate("/reports/employees")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t("dashboard.reports")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.generateReports")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Hires */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">{t("dashboard.recentHires")}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary"
                onClick={() => navigate("/people/employees")}
              >
                {t("dashboard.viewAll")}
              </Button>
            </CardHeader>
            <CardContent>
              {recentHires.length > 0 ? (
                <div className="space-y-3">
                  {recentHires.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {employee.personalInfo.firstName[0]}
                          {employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {employee.jobDetails.position}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(employee.jobDetails.hireDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("dashboard.noEmployees")}</p>
                  <Button
                    variant="link"
                    className="text-primary mt-1"
                    onClick={() => navigate("/admin/seed")}
                  >
                    {t("dashboard.seedData")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Salary Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">{t("dashboard.salaryRanges")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: t("dashboard.salaryRange0"), min: 0, max: 10000, color: "bg-emerald-500" },
                  { label: t("dashboard.salaryRange1"), min: 10000, max: 15000, color: "bg-cyan-500" },
                  { label: t("dashboard.salaryRange2"), min: 15000, max: 25000, color: "bg-primary" },
                  { label: t("dashboard.salaryRange3"), min: 25000, max: Infinity, color: "bg-amber-500" },
                ].map((range) => {
                  const count = activeEmployees.filter((emp) => {
                    const salary = emp.compensation?.monthlySalary || 0;
                    return salary >= range.min && salary < range.max;
                  }).length;
                  const percentage = activeEmployees.length > 0
                    ? Math.round((count / activeEmployees.length) * 100)
                    : 0;

                  return (
                    <div key={range.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{range.label}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold">{count}</span>
                          <span className="text-sm text-muted-foreground ml-2">({percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${range.color} rounded-full`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
