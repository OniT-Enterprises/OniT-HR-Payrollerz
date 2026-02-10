import React, { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useI18n } from "@/i18n/I18nProvider";
import {
  FileText,
  DollarSign,
  Users,
  Download,
  Filter,
  Database,
  User,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { toast } from "sonner";

export default function PayrollReports() {
  const { data: employees = [], isLoading: loading } = useAllEmployees(500);
  const { t, locale } = useI18n();

  // State for dialogs and filters
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showSalaryDetail, setShowSalaryDetail] = useState(false);
  const [showDepartmentDetail, setShowDepartmentDetail] = useState(false);
  const [showBenefitsDetail, setShowBenefitsDetail] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterBenefits, setFilterBenefits] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const totalMonthlySalary = useMemo(() => employees.reduce(
    (sum, emp) =>
      sum +
      (emp.compensation?.monthlySalary ||
        Math.round((emp.compensation.annualSalary ?? 0) / 12) ||
        0),
    0,
  ), [employees]);
  const averageMonthlySalary = useMemo(() =>
    employees.length > 0
      ? Math.round(totalMonthlySalary / employees.length)
      : 0, [employees.length, totalMonthlySalary]);
  const formatCurrency = (amount: number) => {
    const formatLocale = locale === "tet" ? "pt-PT" : "en-US";
    return new Intl.NumberFormat(formatLocale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get unique departments and benefits for filters
  const departments = useMemo(() =>
    [...new Set(employees.map(emp => emp.jobDetails.department))].sort(),
    [employees]
  );

  const benefitsPackages = useMemo(() =>
    [...new Set(employees.map(emp => emp.compensation.benefitsPackage))],
    [employees]
  );

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (filterDepartment !== "all" && emp.jobDetails.department !== filterDepartment) return false;
      if (filterBenefits !== "all" && emp.compensation.benefitsPackage !== filterBenefits) return false;
      if (filterStatus !== "all" && emp.status !== filterStatus) return false;
      return true;
    });
  }, [employees, filterDepartment, filterBenefits, filterStatus]);

  // Department breakdown data
  const departmentBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; totalSalary: number; employees: typeof employees }> = {};
    for (const emp of filteredEmployees) {
      const dept = emp.jobDetails.department;
      if (!breakdown[dept]) {
        breakdown[dept] = { count: 0, totalSalary: 0, employees: [] };
      }
      breakdown[dept].count++;
      breakdown[dept].totalSalary += emp.compensation?.monthlySalary || 0;
      breakdown[dept].employees.push(emp);
    }
    return Object.entries(breakdown).sort((a, b) => b[1].totalSalary - a[1].totalSalary);
  }, [filteredEmployees]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Employee ID",
      "First Name",
      "Last Name",
      "Email",
      "Department",
      "Position",
      "Monthly Salary",
      "Annual Salary",
      "Benefits Package",
      "Status",
      "IRPS Tax (10% > $500)",
      "INSS Employee (4%)",
      "INSS Employer (6%)",
      "Net Pay"
    ];

    const rows = filteredEmployees.map(emp => {
      const gross = emp.compensation?.monthlySalary || 0;
      const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
      const inssEmp = gross * 0.04;
      const inssEr = gross * 0.06;
      const netPay = gross - irps - inssEmp;

      return [
        emp.jobDetails.employeeId,
        emp.personalInfo.firstName,
        emp.personalInfo.lastName,
        emp.personalInfo.email,
        emp.jobDetails.department,
        emp.jobDetails.position,
        gross.toFixed(2),
        (gross * 12).toFixed(2),
        emp.compensation.benefitsPackage,
        emp.status,
        irps.toFixed(2),
        inssEmp.toFixed(2),
        inssEr.toFixed(2),
        netPay.toFixed(2)
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Payroll report exported successfully");
  };

  // Clear filters
  const clearFilters = () => {
    setFilterDepartment("all");
    setFilterBenefits("all");
    setFilterStatus("all");
  };

  const hasActiveFilters = filterDepartment !== "all" || filterBenefits !== "all" || filterStatus !== "all";

  const getStatusLabel = (status: string) => {
    if (status === "active") {
      return t("reports.payroll.status.active");
    }
    if (status === "inactive") {
      return t("reports.payroll.status.inactive");
    }
    return status;
  };

  const getBenefitsLabel = (benefits: string) => {
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
                <Button variant="outline" onClick={() => setShowFilterDialog(true)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {t("reports.payroll.actions.filter")}
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 text-xs">Active</Badge>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <Button onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                {t("reports.payroll.actions.export")}
              </Button>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>Showing {filteredEmployees.length} of {employees.length} employees:</span>
                {filterDepartment !== "all" && (
                  <Badge variant="outline">{filterDepartment}</Badge>
                )}
                {filterBenefits !== "all" && (
                  <Badge variant="outline">{filterBenefits} benefits</Badge>
                )}
                {filterStatus !== "all" && (
                  <Badge variant="outline">{filterStatus}</Badge>
                )}
              </div>
            )}

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
                                  (emp.compensation.annualSalary ?? 0) / 12,
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
                                      (emp.compensation.annualSalary ?? 0) /
                                        12,
                                    ) ||
                                    0) > 0,
                              )
                              .map(
                                (emp) =>
                                  emp.compensation.monthlySalary ||
                                  Math.round(
                                    (emp.compensation.annualSalary ?? 0) / 12,
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
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowSalaryDetail(true)}>
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
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowDepartmentDetail(true)}>
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
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowBenefitsDetail(true)}>
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
                      {filteredEmployees
                        .sort(
                          (a, b) =>
                            (b.compensation.monthlySalary ||
                              Math.round(
                                (b.compensation.annualSalary ?? 0) / 12,
                              ) ||
                              0) -
                            (a.compensation.monthlySalary ||
                              Math.round(
                                (a.compensation.annualSalary ?? 0) / 12,
                              ) ||
                              0),
                        )
                        .slice(0, showAllEmployees ? undefined : 10)
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
                                    (employee.compensation.annualSalary ?? 0) / 12,
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
                  {filteredEmployees.length > 10 && (
                    <div className="text-center py-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAllEmployees(!showAllEmployees)}>
                        {showAllEmployees ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            {t("reports.payroll.table.viewAll", {
                              count: filteredEmployees.length,
                            })}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Payroll Report</DialogTitle>
            <DialogDescription>
              Filter employees by department, benefits, or status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Benefits Package</Label>
              <Select value={filterBenefits} onValueChange={setFilterBenefits}>
                <SelectTrigger>
                  <SelectValue placeholder="All benefits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Benefits</SelectItem>
                  {benefitsPackages.map(pkg => (
                    <SelectItem key={pkg} value={pkg}>{getBenefitsLabel(pkg)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={clearFilters}>Clear All</Button>
            <Button onClick={() => setShowFilterDialog(false)}>Apply Filters</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Detail Dialog */}
      <Dialog open={showSalaryDetail} onOpenChange={setShowSalaryDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detailed Salary Report</DialogTitle>
            <DialogDescription>
              Complete salary breakdown with tax calculations (Timor-Leste)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Highest</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(Math.max(...filteredEmployees.map(e => e.compensation?.monthlySalary || 0)))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lowest</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(Math.min(...filteredEmployees.filter(e => (e.compensation?.monthlySalary || 0) > 0).map(e => e.compensation?.monthlySalary || 0)))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-xl font-bold">{formatCurrency(averageMonthlySalary)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Monthly</p>
                <p className="text-xl font-bold text-violet-600">{formatCurrency(totalMonthlySalary)}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Employee</th>
                  <th className="text-right p-2">Gross</th>
                  <th className="text-right p-2">IRPS (10%)</th>
                  <th className="text-right p-2">INSS (4%)</th>
                  <th className="text-right p-2">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees
                  .sort((a, b) => (b.compensation?.monthlySalary || 0) - (a.compensation?.monthlySalary || 0))
                  .map(emp => {
                    const gross = emp.compensation?.monthlySalary || 0;
                    const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
                    const inss = gross * 0.04;
                    const net = gross - irps - inss;
                    return (
                      <tr key={emp.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="font-medium">{emp.personalInfo.firstName} {emp.personalInfo.lastName}</div>
                          <div className="text-xs text-muted-foreground">{emp.jobDetails.position}</div>
                        </td>
                        <td className="text-right p-2">{formatCurrency(gross)}</td>
                        <td className="text-right p-2 text-red-600">{formatCurrency(irps)}</td>
                        <td className="text-right p-2 text-orange-600">{formatCurrency(inss)}</td>
                        <td className="text-right p-2 font-medium text-green-600">{formatCurrency(net)}</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-bold">
                  <td className="p-2">TOTALS</td>
                  <td className="text-right p-2">{formatCurrency(filteredEmployees.reduce((sum, e) => sum + (e.compensation?.monthlySalary || 0), 0))}</td>
                  <td className="text-right p-2 text-red-600">{formatCurrency(filteredEmployees.reduce((sum, e) => { const g = e.compensation?.monthlySalary || 0; return sum + (g > 500 ? (g - 500) * 0.1 : 0); }, 0))}</td>
                  <td className="text-right p-2 text-orange-600">{formatCurrency(filteredEmployees.reduce((sum, e) => sum + (e.compensation?.monthlySalary || 0) * 0.04, 0))}</td>
                  <td className="text-right p-2 text-green-600">{formatCurrency(filteredEmployees.reduce((sum, e) => { const g = e.compensation?.monthlySalary || 0; const irps = g > 500 ? (g - 500) * 0.1 : 0; return sum + g - irps - g * 0.04; }, 0))}</td>
                </tr>
              </tfoot>
            </table>
            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              <strong>Timor-Leste Tax Rules:</strong> IRPS = (Gross - $500) × 10% if Gross &gt; $500 | INSS Employee = 4% | INSS Employer = 6% (not shown)
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department Breakdown Dialog */}
      <Dialog open={showDepartmentDetail} onOpenChange={setShowDepartmentDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Department Cost Breakdown</DialogTitle>
            <DialogDescription>
              Payroll costs by department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {departmentBreakdown.map(([dept, data]) => (
              <div key={dept} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{dept}</h3>
                  <Badge variant="outline">{data.count} employees</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Monthly Cost</p>
                    <p className="text-lg font-bold text-violet-600">{formatCurrency(data.totalSalary)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Annual Cost</p>
                    <p className="text-lg font-bold">{formatCurrency(data.totalSalary * 12)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Salary</p>
                    <p className="text-lg font-bold">{formatCurrency(data.totalSalary / data.count)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Employees:</p>
                  <div className="flex flex-wrap gap-1">
                    {data.employees.map(emp => (
                      <Badge key={emp.id} variant="secondary" className="text-xs">
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total All Departments</span>
                <span className="text-xl font-bold text-violet-600">
                  {formatCurrency(departmentBreakdown.reduce((sum, [, data]) => sum + data.totalSalary, 0))}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Benefits Detail Dialog */}
      <Dialog open={showBenefitsDetail} onOpenChange={setShowBenefitsDetail}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Benefits Analysis</DialogTitle>
            <DialogDescription>
              Employee distribution by benefits package
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {benefitsPackages.map(pkg => {
              const empsWithPkg = filteredEmployees.filter(e => e.compensation.benefitsPackage === pkg);
              const totalCost = empsWithPkg.reduce((sum, e) => sum + (e.compensation?.monthlySalary || 0), 0);
              return (
                <div key={pkg} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">{getBenefitsLabel(pkg)}</h3>
                    <Badge>{empsWithPkg.length} employees</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Total Monthly Payroll</p>
                      <p className="text-lg font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Salary</p>
                      <p className="text-lg font-bold">{formatCurrency(empsWithPkg.length > 0 ? totalCost / empsWithPkg.length : 0)}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {empsWithPkg.map(emp => (
                      <div key={emp.id} className="flex justify-between text-sm py-1 border-t">
                        <span>{emp.personalInfo.firstName} {emp.personalInfo.lastName}</span>
                        <span className="text-muted-foreground">{emp.jobDetails.department}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
