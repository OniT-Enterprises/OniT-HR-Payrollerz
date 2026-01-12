import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { cacheService, CACHE_KEYS } from "@/services/cacheService";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  FileText,
  DollarSign,
  Users,
  Download,
  Filter,
  Database,
  User,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";

export default function PayrollReports() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t, locale } = useI18n();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      // Show cached data immediately if available
      const cached = cacheService.get<any[]>(CACHE_KEYS.EMPLOYEES);
      if (cached) {
        setEmployees(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Fetch fresh data
      const employeesData = await employeeService.getAllEmployees();
      cacheService.set(CACHE_KEYS.EMPLOYEES, employeesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast({
        title: t("reports.payroll.toast.errorTitle"),
        description: t("reports.payroll.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalMonthlySalary = employees.reduce(
    (sum, emp) =>
      sum +
      (emp.compensation.monthlySalary ||
        Math.round((emp.compensation as any).annualSalary / 12) ||
        0),
    0,
  );
  const averageMonthlySalary =
    employees.length > 0
      ? Math.round(totalMonthlySalary / employees.length)
      : 0;
  const formatCurrency = (amount) => {
    const formatLocale = locale === "pt" || locale === "tet" ? "pt-PT" : "en-US";
    return new Intl.NumberFormat(formatLocale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusLabel = (status) => {
    if (status === "active") {
      return t("reports.payroll.status.active");
    }
    if (status === "inactive") {
      return t("reports.payroll.status.inactive");
    }
    return status;
  };

  const getBenefitsLabel = (benefits) => {
    const normalized = typeof benefits === "string" ? benefits.toLowerCase() : benefits;
    switch (normalized) {
      case "basic":
        return t("reports.payroll.benefits.basic");
      case "standard":
        return t("reports.payroll.benefits.standard");
      case "premium":
        return t("reports.payroll.benefits.premium");
      case "executive":
        return t("reports.payroll.benefits.executive");
      default:
        return benefits;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-10 w-full" />
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
      <SEO {...seoConfig.payrollReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("reports.payroll.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("reports.payroll.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {employees.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">
              {t("reports.payroll.empty.title")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("reports.payroll.empty.description")}
            </p>
            <Button onClick={() => (window.location.href = "/staff/add")}>
              <User className="mr-2 h-4 w-4" />
              {t("reports.payroll.empty.action")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("reports.payroll.stats.totalEmployees")}
                      </p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                      <p className="text-xs text-blue-600">
                        {t("reports.payroll.stats.inPayroll")}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("reports.payroll.stats.totalMonthly")}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(totalMonthlySalary)}
                      </p>
                      <p className="text-xs text-green-600">
                        {t("reports.payroll.stats.basedOnSalaries")}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("reports.payroll.stats.averageMonthly")}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(averageMonthlySalary)}
                      </p>
                      <p className="text-xs text-purple-600">
                        {t("reports.payroll.stats.perEmployee")}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                      <User className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("reports.payroll.stats.monthlyPayroll")}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(Math.round(totalMonthlySalary))}
                      </p>
                      <p className="text-xs text-orange-600">
                        {t("reports.payroll.stats.estimated")}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  {t("reports.payroll.actions.filter")}
                </Button>
              </div>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                {t("reports.payroll.actions.export")}
              </Button>
            </div>

            {/* Report Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    {t("reports.payroll.salarySummary.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("reports.payroll.salarySummary.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm">
                        {t("reports.payroll.salarySummary.highest")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          Math.max(
                            ...employees.map(
                              (emp) =>
                                emp.compensation.monthlySalary ||
                                Math.round(
                                  (emp.compensation as any).annualSalary / 12,
                                ) ||
                                0,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">
                        {t("reports.payroll.salarySummary.lowest")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          Math.min(
                            ...employees
                              .filter(
                                (emp) =>
                                  (emp.compensation.monthlySalary ||
                                    Math.round(
                                      (emp.compensation as any).annualSalary /
                                        12,
                                    ) ||
                                    0) > 0,
                              )
                              .map(
                                (emp) =>
                                  emp.compensation.monthlySalary ||
                                  Math.round(
                                    (emp.compensation as any).annualSalary / 12,
                                  ) ||
                                  0,
                              ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">
                        {t("reports.payroll.salarySummary.median")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(averageMonthlySalary)}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      {t("reports.payroll.actions.viewDetailed")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    {t("reports.payroll.departmentCosts.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("reports.payroll.departmentCosts.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <Database className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-gray-600">
                        {
                          new Set(
                            employees.map((emp) => emp.jobDetails.department),
                          ).size
                        }{" "}
                        {t("reports.payroll.departmentCosts.departments")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("reports.payroll.departmentCosts.analyzed")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      {t("reports.payroll.actions.viewDepartment")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    {t("reports.payroll.benefits.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("reports.payroll.benefits.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {[
                        ...new Set(
                          employees.map(
                            (emp) => emp.compensation.benefitsPackage,
                          ),
                        ),
                      ].map((benefit) => (
                        <div
                          key={benefit}
                          className="flex justify-between text-sm"
                        >
                          <span>{getBenefitsLabel(benefit)}:</span>
                          <Badge variant="outline">
                            {
                              employees.filter(
                                (emp) =>
                                  emp.compensation.benefitsPackage === benefit,
                              ).length
                            }
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      {t("reports.payroll.actions.viewBenefits")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Payroll List */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.payroll.table.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.payroll.table.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">
                          {t("reports.payroll.table.employee")}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {t("reports.payroll.table.department")}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {t("reports.payroll.table.position")}
                        </th>
                        <th className="text-right p-3 font-medium">
                          {t("reports.payroll.table.monthlySalary")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("reports.payroll.table.benefits")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("reports.payroll.table.status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees
                        .sort(
                          (a, b) =>
                            (b.compensation.monthlySalary ||
                              Math.round(
                                (b.compensation as any).annualSalary / 12,
                              ) ||
                              0) -
                            (a.compensation.monthlySalary ||
                              Math.round(
                                (a.compensation as any).annualSalary / 12,
                              ) ||
                              0),
                        )
                        .slice(0, 10)
                        .map((employee) => (
                          <tr
                            key={employee.id}
                            className="border-b hover:bg-muted/50"
                          >
                            <td className="p-3">
                              <div>
                                <div className="font-medium">
                                  {employee.personalInfo.firstName}{" "}
                                  {employee.personalInfo.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.jobDetails.employeeId}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              {employee.jobDetails.department}
                            </td>
                            <td className="p-3">
                              {employee.jobDetails.position}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(
                                employee.compensation.monthlySalary ||
                                  Math.round(
                                    (employee.compensation as any)
                                      .annualSalary / 12,
                                  ) ||
                                  0,
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline">
                                {getBenefitsLabel(
                                  employee.compensation.benefitsPackage,
                                )}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                className={
                                  employee.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {getStatusLabel(employee.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {employees.length > 10 && (
                    <div className="text-center py-4">
                      <Button variant="outline" size="sm">
                        {t("reports.payroll.table.viewAll", {
                          count: employees.length,
                        })}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
    </div>
  );
}
