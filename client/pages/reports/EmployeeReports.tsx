import React, { useState, useMemo } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { exportToCSV } from "@/lib/csvExport";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Users,
  Download,
  UserPlus,
  UserMinus,
  Building,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { SEO } from "@/components/SEO";

export default function EmployeeReports() {
  const { data: employees = [], isLoading: loading } = useAllEmployees(500);
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();

  const getDateRangeLabel = (value: string) => t(`reports.shared.ranges.${value}`);
  const getEmploymentTypeLabel = (value: string) =>
    value === "Unknown" ? t("common.unknown") : value.replace(/_/g, " ");
  const getStatusLabel = (value: string) =>
    value === "active" ? t("reports.employee.status.active") : t("reports.employee.status.inactive");

  // Calculate stats
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);
  const inactiveEmployees = useMemo(() => employees.filter((e) => e.status !== "active"), [employees]);

  // Get employees by department
  const departmentCounts = useMemo(() => employees.reduce((acc, emp) => {
    const dept = emp.jobDetails?.department || "Unassigned";
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [employees]);

  // Get new hires (based on date range)
  const newHires = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange, 10));
    return employees.filter((emp) => {
      const hireDate = emp.jobDetails?.hireDate
        ? new Date(emp.jobDetails.hireDate)
        : null;
      return hireDate && hireDate >= cutoffDate;
    });
  }, [employees, dateRange]);

  // Employment type breakdown
  const employmentTypes = useMemo(() => employees.reduce((acc, emp) => {
    const type = emp.jobDetails?.employmentType || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [employees]);

  const handleExportCSV = (data: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.shared.exportTitle"),
      description: t("reports.shared.exportDescription", { filename: `${filename}.csv` }),
    });
  };

  const exportDirectory = () => {
    handleExportCSV(employees as unknown as Record<string, unknown>[], "employee_directory", [
      { key: "jobDetails.employeeId", label: t("reports.employee.csv.employeeId") },
      { key: "personalInfo.firstName", label: t("reports.employee.csv.firstName") },
      { key: "personalInfo.lastName", label: t("reports.employee.csv.lastName") },
      { key: "personalInfo.email", label: t("reports.employee.csv.email") },
      { key: "personalInfo.phone", label: t("reports.employee.csv.phone") },
      { key: "jobDetails.department", label: t("reports.employee.csv.department") },
      { key: "jobDetails.position", label: t("reports.employee.csv.position") },
      { key: "jobDetails.hireDate", label: t("reports.employee.csv.hireDate") },
      { key: "jobDetails.employmentType", label: t("reports.employee.csv.employmentType") },
      { key: "status", label: t("reports.employee.csv.status") },
    ]);
  };

  const exportNewHires = () => {
    handleExportCSV(newHires as unknown as Record<string, unknown>[], "new_hires_report", [
      { key: "jobDetails.employeeId", label: t("reports.employee.csv.employeeId") },
      { key: "personalInfo.firstName", label: t("reports.employee.csv.firstName") },
      { key: "personalInfo.lastName", label: t("reports.employee.csv.lastName") },
      { key: "jobDetails.department", label: t("reports.employee.csv.department") },
      { key: "jobDetails.position", label: t("reports.employee.csv.position") },
      { key: "jobDetails.hireDate", label: t("reports.employee.csv.hireDate") },
      { key: "jobDetails.employmentType", label: t("reports.employee.csv.employmentType") },
    ]);
  };

  const exportHeadcount = () => {
    const headcountData = Object.entries(departmentCounts).map(([dept, count]) => ({
      department: dept,
      headcount: count as number,
      percentage: (((count as number) / employees.length) * 100).toFixed(1),
    }));
    handleExportCSV(headcountData, "headcount_by_department", [
      { key: "department", label: t("reports.employee.csv.department") },
      { key: "headcount", label: t("reports.employee.csv.headcount") },
      { key: "percentage", label: t("reports.employee.csv.percentage") },
    ]);
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
      <SEO title={`${t("reports.employee.title")} | Meza`} description={t("reports.employee.subtitle")} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.employee.title")}
          subtitle={t("reports.employee.subtitle")}
          icon={Users}
          iconColor="text-violet-500"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("reports.shared.periodLabel")}</span>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{getDateRangeLabel("7")}</SelectItem>
                  <SelectItem value="30">{getDateRangeLabel("30")}</SelectItem>
                  <SelectItem value="90">{getDateRangeLabel("90")}</SelectItem>
                  <SelectItem value="365">{getDateRangeLabel("365")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.employee.stats.totalEmployees")}</p>
                  <p className="text-3xl font-bold">{employees.length}</p>
                  <p className="text-xs text-blue-600">
                    {t("reports.employee.stats.activeEmployees", { count: String(activeEmployees.length) })}
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
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.employee.stats.newHires")}</p>
                  <p className="text-3xl font-bold">{newHires.length}</p>
                  <p className="text-xs text-green-600">
                    {t("reports.employee.stats.hiresPeriod", { period: getDateRangeLabel(dateRange) })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.employee.stats.departments")}</p>
                  <p className="text-3xl font-bold">{Object.keys(departmentCounts).length}</p>
                  <p className="text-xs text-purple-600">{t("reports.employee.stats.withEmployees")}</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                  <Building className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.employee.stats.inactive")}</p>
                  <p className="text-3xl font-bold">{inactiveEmployees.length}</p>
                  <p className="text-xs text-orange-600">
                    {t("reports.employee.stats.turnover", {
                      percent: employees.length > 0
                        ? ((inactiveEmployees.length / employees.length) * 100).toFixed(1)
                        : "0",
                    })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                  <UserMinus className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {t("reports.employee.cards.directory.title")}
              </CardTitle>
              <CardDescription>{t("reports.employee.cards.directory.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.employee.cards.directory.totalRecords")}</span>
                  <span className="font-medium">{employees.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.employee.cards.directory.active")}</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {activeEmployees.length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.employee.cards.directory.inactive")}</span>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {inactiveEmployees.length}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportDirectory}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.directory.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                {t("reports.employee.cards.newHires.title")}
              </CardTitle>
              <CardDescription>{t("reports.employee.cards.newHires.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.employee.cards.newHires.count")}</span>
                  <span className="font-medium">{newHires.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.shared.periodLabel")}</span>
                  <span className="font-medium">{getDateRangeLabel(dateRange)}</span>
                </div>
                {newHires.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("reports.employee.cards.newHires.latest", {
                      name: `${newHires[0]?.personalInfo?.firstName || ""} ${newHires[0]?.personalInfo?.lastName || ""}`.trim(),
                    })}
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={exportNewHires}
                disabled={newHires.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.newHires.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-purple-600" />
                {t("reports.employee.cards.headcount.title")}
              </CardTitle>
              <CardDescription>{t("reports.employee.cards.headcount.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                {Object.entries(departmentCounts)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 4)
                  .map(([dept, count]) => (
                    <div key={dept} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate">{dept}</span>
                      <Badge variant="outline">{count as number}</Badge>
                    </div>
                  ))}
                {Object.keys(departmentCounts).length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    {t("reports.employee.cards.headcount.moreDepartments", {
                      count: String(Object.keys(departmentCounts).length - 4),
                    })}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={exportHeadcount}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.headcount.export")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Employment Type Breakdown */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              {t("reports.employee.types.title")}
            </CardTitle>
            <CardDescription>{t("reports.employee.types.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(employmentTypes).map(([type, count]) => (
                <div key={type} className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{count as number}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {getEmploymentTypeLabel(type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(((count as number) / employees.length) * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Employees Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-600" />
              {t("reports.employee.recent.title")}
            </CardTitle>
            <CardDescription>{t("reports.employee.recent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>{t("reports.employee.recent.empty")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {employees
                    .sort((a, b) => {
                      const dateA = a.jobDetails?.hireDate ? new Date(a.jobDetails.hireDate) : new Date(0);
                      const dateB = b.jobDetails?.hireDate ? new Date(b.jobDetails.hireDate) : new Date(0);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .slice(0, 10)
                    .map((emp) => (
                      <div key={emp.id} className="rounded-lg border border-border/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {emp.personalInfo?.firstName} {emp.personalInfo?.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {emp.jobDetails?.employeeId}
                            </div>
                          </div>
                          <Badge
                            className={
                              emp.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:bg-gray-800 dark:text-gray-200"
                            }
                          >
                            {getStatusLabel(emp.status)}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">{t("reports.employee.recent.table.department")}</p>
                            <p>{emp.jobDetails?.department || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("reports.employee.recent.table.position")}</p>
                            <p>{emp.jobDetails?.position || "-"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">{t("reports.employee.recent.table.hireDate")}</p>
                            <p>{emp.jobDetails?.hireDate ? formatDateTL(emp.jobDetails.hireDate) : "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t("reports.employee.recent.table.employee")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.employee.recent.table.department")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.employee.recent.table.position")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.employee.recent.table.hireDate")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.employee.recent.table.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees
                        .sort((a, b) => {
                          const dateA = a.jobDetails?.hireDate ? new Date(a.jobDetails.hireDate) : new Date(0);
                          const dateB = b.jobDetails?.hireDate ? new Date(b.jobDetails.hireDate) : new Date(0);
                          return dateB.getTime() - dateA.getTime();
                        })
                        .slice(0, 10)
                        .map((emp) => (
                          <tr key={emp.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div>
                                <div className="font-medium">
                                  {emp.personalInfo?.firstName} {emp.personalInfo?.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {emp.jobDetails?.employeeId}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">{emp.jobDetails?.department || "-"}</td>
                            <td className="p-3">{emp.jobDetails?.position || "-"}</td>
                            <td className="p-3">
                              {emp.jobDetails?.hireDate
                                ? formatDateTL(emp.jobDetails.hireDate)
                                : "-"}
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                className={
                                  emp.status === "active"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:bg-gray-800 dark:text-gray-200"
                                }
                              >
                                {getStatusLabel(emp.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
