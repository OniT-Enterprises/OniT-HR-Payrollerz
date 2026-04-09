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
import PageHeader from "@/components/layout/PageHeader";
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
import { getTodayTL } from "@/lib/dateUtils";

export default function PayrollReports() {
  const { data: employees = [], isLoading: loading } = useAllEmployees(500);
  const { t, locale } = useI18n();

  const getMonthlySalary = React.useCallback(
    (employee: (typeof employees)[number]) =>
      employee.compensation?.monthlySalary ||
      Math.round((employee.compensation.annualSalary ?? 0) / 12) ||
      0,
    [],
  );

  // State for dialogs and filters
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showSalaryDetail, setShowSalaryDetail] = useState(false);
  const [showDepartmentDetail, setShowDepartmentDetail] = useState(false);
  const [showBenefitsDetail, setShowBenefitsDetail] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterBenefits, setFilterBenefits] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const totalMonthlySalary = useMemo(
    () => employees.reduce((sum, emp) => sum + getMonthlySalary(emp), 0),
    [employees, getMonthlySalary],
  );
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

  const filteredMonthlySalaries = useMemo(
    () => filteredEmployees.map((employee) => getMonthlySalary(employee)),
    [filteredEmployees, getMonthlySalary],
  );
  const highestFilteredSalary = filteredMonthlySalaries.length
    ? Math.max(...filteredMonthlySalaries)
    : 0;
  const lowestFilteredSalary = filteredMonthlySalaries.filter((salary) => salary > 0).length
    ? Math.min(...filteredMonthlySalaries.filter((salary) => salary > 0))
    : 0;
  const totalFilteredSalary = filteredMonthlySalaries.reduce(
    (sum, salary) => sum + salary,
    0,
  );
  const averageFilteredSalary = filteredMonthlySalaries.length
    ? Math.round(totalFilteredSalary / filteredMonthlySalaries.length)
    : 0;

  // Department breakdown data
  const departmentBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; totalSalary: number; employees: typeof employees }> = {};
    for (const emp of filteredEmployees) {
      const dept = emp.jobDetails.department;
      if (!breakdown[dept]) {
        breakdown[dept] = { count: 0, totalSalary: 0, employees: [] };
      }
      breakdown[dept].count++;
      breakdown[dept].totalSalary += getMonthlySalary(emp);
      breakdown[dept].employees.push(emp);
    }
    return Object.entries(breakdown).sort((a, b) => b[1].totalSalary - a[1].totalSalary);
  }, [filteredEmployees, getMonthlySalary]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      t("reports.payroll.csv.employeeId"),
      t("reports.payroll.csv.firstName"),
      t("reports.payroll.csv.lastName"),
      t("reports.payroll.csv.email"),
      t("reports.payroll.csv.department"),
      t("reports.payroll.csv.position"),
      t("reports.payroll.csv.monthlySalary"),
      t("reports.payroll.csv.annualSalary"),
      t("reports.payroll.csv.benefitsPackage"),
      t("reports.payroll.csv.status"),
      t("reports.payroll.csv.irpsTax"),
      t("reports.payroll.csv.inssEmployee"),
      t("reports.payroll.csv.inssEmployer"),
      t("reports.payroll.csv.netPay"),
    ];

    const rows = filteredEmployees.map(emp => {
      const gross = getMonthlySalary(emp);
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

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-report-${getTodayTL()}.csv`;
    link.click();
    toast.success(t("reports.payroll.toast.exported"));
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
        <div className="px-6 py-6 mx-auto max-w-screen-2xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-10" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full" />
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
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.payroll.title")}
          subtitle={t("reports.payroll.subtitle")}
          icon={FileText}
          iconColor="text-primary"
        />
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
            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowFilterDialog(true)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {t("reports.payroll.actions.filter")}
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {t("reports.payroll.filters.active")}
                    </Badge>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    {t("reports.payroll.filters.clear")}
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
                <span>
                  {t("reports.payroll.filters.summary", {
                    filtered: filteredEmployees.length,
                    total: employees.length,
                  })}
                </span>
                {filterDepartment !== "all" && (
                  <Badge variant="outline">{filterDepartment}</Badge>
                )}
                {filterBenefits !== "all" && (
                  <Badge variant="outline">
                    {t("reports.payroll.filters.benefitsBadge", {
                      benefits: getBenefitsLabel(filterBenefits),
                    })}
                  </Badge>
                )}
                {filterStatus !== "all" && (
                  <Badge variant="outline">{getStatusLabel(filterStatus)}</Badge>
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
                        {formatCurrency(Math.max(...employees.map(getMonthlySalary)))}
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
                              .map(getMonthlySalary)
                              .filter((salary) => salary > 0),
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
                {filteredEmployees.length === 0 ? (
                  <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                    {t("reports.payroll.table.emptyFiltered")}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {filteredEmployees
                        .sort((a, b) => getMonthlySalary(b) - getMonthlySalary(a))
                        .slice(0, showAllEmployees ? undefined : 10)
                        .map((employee) => (
                          <Card key={employee.id}>
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">
                                    {employee.personalInfo.firstName}{" "}
                                    {employee.personalInfo.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {employee.jobDetails.employeeId}
                                  </p>
                                </div>
                                <Badge
                                  className={
                                    employee.status === "active"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                  }
                                >
                                  {getStatusLabel(employee.status)}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {t("reports.payroll.table.department")}
                                  </p>
                                  <p>{employee.jobDetails.department}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {t("reports.payroll.table.position")}
                                  </p>
                                  <p>{employee.jobDetails.position}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {t("reports.payroll.table.monthlySalary")}
                                  </p>
                                  <p className="font-semibold">
                                    {formatCurrency(getMonthlySalary(employee))}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {t("reports.payroll.table.benefits")}
                                  </p>
                                  <Badge variant="outline">
                                    {getBenefitsLabel(
                                      employee.compensation.benefitsPackage,
                                    )}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
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
                            .sort((a, b) => getMonthlySalary(b) - getMonthlySalary(a))
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
                                  {formatCurrency(getMonthlySalary(employee))}
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
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                    }
                                  >
                                    {getStatusLabel(employee.status)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                  {filteredEmployees.length > 10 && (
                    <div className="text-center py-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAllEmployees(!showAllEmployees)}>
                        {showAllEmployees ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            {t("reports.payroll.table.showLess")}
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
              </CardContent>
            </Card>
          </div>
        )}
        </div>

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reports.payroll.filters.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("reports.payroll.filters.dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("reports.payroll.filters.dialog.department")}</Label>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("reports.payroll.filters.dialog.allDepartments")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("reports.payroll.filters.dialog.allDepartments")}
                  </SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("reports.payroll.filters.dialog.benefits")}</Label>
              <Select value={filterBenefits} onValueChange={setFilterBenefits}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("reports.payroll.filters.dialog.allBenefits")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("reports.payroll.filters.dialog.allBenefits")}
                  </SelectItem>
                  {benefitsPackages.map(pkg => (
                    <SelectItem key={pkg} value={pkg}>{getBenefitsLabel(pkg)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("reports.payroll.filters.dialog.status")}</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("reports.payroll.filters.dialog.allStatuses")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("reports.payroll.filters.dialog.allStatuses")}
                  </SelectItem>
                  <SelectItem value="active">
                    {t("reports.payroll.status.active")}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {t("reports.payroll.status.inactive")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={clearFilters}>
              {t("reports.payroll.filters.dialog.clearAll")}
            </Button>
            <Button onClick={() => setShowFilterDialog(false)}>
              {t("reports.payroll.filters.dialog.apply")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Detail Dialog */}
      <Dialog open={showSalaryDetail} onOpenChange={setShowSalaryDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reports.payroll.salaryDetail.title")}</DialogTitle>
            <DialogDescription>
              {t("reports.payroll.salaryDetail.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.payroll.salaryDetail.highest")}
                </p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(highestFilteredSalary)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.payroll.salaryDetail.lowest")}
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(lowestFilteredSalary)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.payroll.salaryDetail.average")}
                </p>
                <p className="text-xl font-bold">
                  {formatCurrency(averageFilteredSalary)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.payroll.salaryDetail.totalMonthly")}
                </p>
                <p className="text-xl font-bold text-violet-600">
                  {formatCurrency(totalFilteredSalary)}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      {t("reports.payroll.salaryDetail.columns.employee")}
                    </th>
                    <th className="text-right p-2">
                      {t("reports.payroll.salaryDetail.columns.gross")}
                    </th>
                    <th className="text-right p-2">
                      {t("reports.payroll.salaryDetail.columns.irps")}
                    </th>
                    <th className="text-right p-2">
                      {t("reports.payroll.salaryDetail.columns.inss")}
                    </th>
                    <th className="text-right p-2">
                      {t("reports.payroll.salaryDetail.columns.netPay")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees
                    .sort((a, b) => getMonthlySalary(b) - getMonthlySalary(a))
                    .map(emp => {
                      const gross = getMonthlySalary(emp);
                      const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
                      const inss = gross * 0.04;
                      const net = gross - irps - inss;
                      return (
                        <tr key={emp.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="font-medium">
                              {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emp.jobDetails.position}
                            </div>
                          </td>
                          <td className="text-right p-2">{formatCurrency(gross)}</td>
                          <td className="text-right p-2 text-red-600">
                            {formatCurrency(irps)}
                          </td>
                          <td className="text-right p-2 text-orange-600">
                            {formatCurrency(inss)}
                          </td>
                          <td className="text-right p-2 font-medium text-green-600">
                            {formatCurrency(net)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted font-bold">
                    <td className="p-2">
                      {t("reports.payroll.salaryDetail.totals")}
                    </td>
                    <td className="text-right p-2">
                      {formatCurrency(totalFilteredSalary)}
                    </td>
                    <td className="text-right p-2 text-red-600">
                      {formatCurrency(
                        filteredEmployees.reduce((sum, employee) => {
                          const gross = getMonthlySalary(employee);
                          return sum + (gross > 500 ? (gross - 500) * 0.1 : 0);
                        }, 0),
                      )}
                    </td>
                    <td className="text-right p-2 text-orange-600">
                      {formatCurrency(
                        filteredEmployees.reduce(
                          (sum, employee) => sum + getMonthlySalary(employee) * 0.04,
                          0,
                        ),
                      )}
                    </td>
                    <td className="text-right p-2 text-green-600">
                      {formatCurrency(
                        filteredEmployees.reduce((sum, employee) => {
                          const gross = getMonthlySalary(employee);
                          const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
                          return sum + gross - irps - gross * 0.04;
                        }, 0),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              <strong>{t("reports.payroll.salaryDetail.taxNoteTitle")}</strong>{" "}
              {t("reports.payroll.salaryDetail.taxNoteDescription")}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Department Breakdown Dialog */}
      <Dialog open={showDepartmentDetail} onOpenChange={setShowDepartmentDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reports.payroll.departmentDetail.title")}</DialogTitle>
            <DialogDescription>
              {t("reports.payroll.departmentDetail.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {departmentBreakdown.map(([dept, data]) => (
              <div key={dept} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{dept}</h3>
                  <Badge variant="outline">
                    {t("reports.payroll.departmentDetail.employees", {
                      count: data.count,
                    })}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      {t("reports.payroll.departmentDetail.monthlyCost")}
                    </p>
                    <p className="text-lg font-bold text-violet-600">{formatCurrency(data.totalSalary)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t("reports.payroll.departmentDetail.annualCost")}
                    </p>
                    <p className="text-lg font-bold">{formatCurrency(data.totalSalary * 12)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {t("reports.payroll.departmentDetail.avgSalary")}
                    </p>
                    <p className="text-lg font-bold">{formatCurrency(data.totalSalary / data.count)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("reports.payroll.departmentDetail.employeesLabel")}
                  </p>
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
                <span className="font-semibold">
                  {t("reports.payroll.departmentDetail.totalAll")}
                </span>
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
            <DialogTitle>{t("reports.payroll.benefitsDetail.title")}</DialogTitle>
            <DialogDescription>
              {t("reports.payroll.benefitsDetail.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {benefitsPackages.map(pkg => {
              const empsWithPkg = filteredEmployees.filter(e => e.compensation.benefitsPackage === pkg);
              const totalCost = empsWithPkg.reduce((sum, employee) => sum + getMonthlySalary(employee), 0);
              return (
                <div key={pkg} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">{getBenefitsLabel(pkg)}</h3>
                    <Badge>
                      {t("reports.payroll.benefitsDetail.employees", {
                        count: empsWithPkg.length,
                      })}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">
                        {t("reports.payroll.benefitsDetail.totalMonthlyPayroll")}
                      </p>
                      <p className="text-lg font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t("reports.payroll.benefitsDetail.avgSalary")}
                      </p>
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
