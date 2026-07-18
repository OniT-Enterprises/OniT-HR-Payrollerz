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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportEmptyState,
  ReportPage,
  ReportPageSkeleton,
  ReportToolbar,
} from "@/components/reports/ReportLayout";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Users,
  Download,
  UserPlus,
  Building,
  Calendar,
  FileSpreadsheet,
  WifiOff,
} from "lucide-react";
import { SEO } from "@/components/SEO";

export default function EmployeeReports() {
  const employeesQuery = useAllEmployees(500);
  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );
  const loading = employeesQuery.isLoading;
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();

  const getDateRangeLabel = (value: string) =>
    t(`reports.shared.ranges.${value}`);
  // Normalize free-text/enum employment types so casing/separator variants
  // ("Full-time", "full-time", "full_time") collapse to one canonical key.
  const normEmploymentType = (raw?: string) => {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return "unknown";
    return trimmed.toLowerCase().replace(/[\s_-]+/g, "_");
  };

  const getEmploymentTypeLabel = (value: string) => {
    if (value === "unknown") return t("common.unknown");
    const labels: Record<string, string> = {
      full_time: "Full-time",
      part_time: "Part-time",
      contract: "Contract",
      contractor: "Contractor",
      shareholder: "Shareholder",
      casual: "Casual",
      intern: "Intern",
      temporary: "Temporary",
      open_ended: "Open-ended",
      fixed_term: "Fixed-term",
      agency: "Agency",
    };
    return (
      labels[value] ??
      value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };
  const getStatusLabel = (value: string) =>
    value === "active"
      ? t("reports.employee.status.active")
      : t("reports.employee.status.inactive");

  // Calculate stats
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );
  const inactiveEmployees = useMemo(
    () => employees.filter((e) => e.status !== "active"),
    [employees],
  );

  // Get employees by department
  const departmentCounts = useMemo(
    () =>
      employees.reduce(
        (acc, emp) => {
          const dept = emp.jobDetails?.department || "Unassigned";
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [employees],
  );

  // Get new hires (based on date range)
  const newHires = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange, 10));
    return employees
      .filter((emp) => {
        const hireDate = emp.jobDetails?.hireDate
          ? new Date(emp.jobDetails.hireDate)
          : null;
        return hireDate && hireDate >= cutoffDate;
      })
      .sort((a, b) =>
        (b.jobDetails?.hireDate ?? "").localeCompare(
          a.jobDetails?.hireDate ?? "",
        ),
      );
  }, [employees, dateRange]);

  const recentEmployees = useMemo(
    () =>
      [...employees]
        .sort((a, b) => {
          const dateA = a.jobDetails?.hireDate
            ? new Date(a.jobDetails.hireDate)
            : new Date(0);
          const dateB = b.jobDetails?.hireDate
            ? new Date(b.jobDetails.hireDate)
            : new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 10),
    [employees],
  );

  // Employment type breakdown
  const employmentTypes = useMemo(
    () =>
      employees.reduce(
        (acc, emp) => {
          const type = normEmploymentType(emp.jobDetails?.employmentType);
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [employees],
  );

  const handleExportCSV = (
    data: Record<string, unknown>[],
    filename: string,
    columns: { key: string; label: string }[],
  ) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.shared.exportTitle"),
      description: t("reports.shared.exportDescription", {
        filename: `${filename}.csv`,
      }),
    });
  };

  const exportDirectory = () => {
    handleExportCSV(
      employees as unknown as Record<string, unknown>[],
      "employee_directory",
      [
        {
          key: "jobDetails.employeeId",
          label: t("reports.employee.csv.employeeId"),
        },
        {
          key: "personalInfo.firstName",
          label: t("reports.employee.csv.firstName"),
        },
        {
          key: "personalInfo.lastName",
          label: t("reports.employee.csv.lastName"),
        },
        { key: "personalInfo.email", label: t("reports.employee.csv.email") },
        { key: "personalInfo.phone", label: t("reports.employee.csv.phone") },
        {
          key: "jobDetails.department",
          label: t("reports.employee.csv.department"),
        },
        {
          key: "jobDetails.position",
          label: t("reports.employee.csv.position"),
        },
        {
          key: "jobDetails.hireDate",
          label: t("reports.employee.csv.hireDate"),
        },
        {
          key: "jobDetails.employmentType",
          label: t("reports.employee.csv.employmentType"),
        },
        { key: "status", label: t("reports.employee.csv.status") },
      ],
    );
  };

  const exportNewHires = () => {
    handleExportCSV(
      newHires as unknown as Record<string, unknown>[],
      "new_hires_report",
      [
        {
          key: "jobDetails.employeeId",
          label: t("reports.employee.csv.employeeId"),
        },
        {
          key: "personalInfo.firstName",
          label: t("reports.employee.csv.firstName"),
        },
        {
          key: "personalInfo.lastName",
          label: t("reports.employee.csv.lastName"),
        },
        {
          key: "jobDetails.department",
          label: t("reports.employee.csv.department"),
        },
        {
          key: "jobDetails.position",
          label: t("reports.employee.csv.position"),
        },
        {
          key: "jobDetails.hireDate",
          label: t("reports.employee.csv.hireDate"),
        },
        {
          key: "jobDetails.employmentType",
          label: t("reports.employee.csv.employmentType"),
        },
      ],
    );
  };

  const exportHeadcount = () => {
    const headcountData = Object.entries(departmentCounts).map(
      ([dept, count]) => ({
        department: dept,
        headcount: count as number,
        percentage:
          employees.length > 0
            ? (((count as number) / employees.length) * 100).toFixed(1)
            : "0.0",
      }),
    );
    handleExportCSV(headcountData, "headcount_by_department", [
      { key: "department", label: t("reports.employee.csv.department") },
      { key: "headcount", label: t("reports.employee.csv.headcount") },
      { key: "percentage", label: t("reports.employee.csv.percentage") },
    ]);
  };

  const exportEmploymentTypes = () => {
    const data = Object.entries(employmentTypes)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([type, count]) => ({
        type: getEmploymentTypeLabel(type),
        count: count as number,
        percentage:
          employees.length > 0
            ? (((count as number) / employees.length) * 100).toFixed(1)
            : "0.0",
      }));
    handleExportCSV(data, "employment_type_breakdown", [
      { key: "type", label: t("reports.employee.csv.employmentType") },
      { key: "count", label: t("reports.employee.csv.headcount") },
      { key: "percentage", label: t("reports.employee.csv.percentage") },
    ]);
  };

  if (loading) {
    return <ReportPageSkeleton sections={3} />;
  }

  if (employeesQuery.isError) {
    return (
      <>
        <SEO
          title={`${t("reports.employee.title")} | Xefe`}
          description={t("reports.employee.subtitle")}
        />
        <ReportPage
          title={t("reports.employee.title")}
          subtitle={t("reports.employee.subtitle")}
          icon={Users}
        >
          <ReportEmptyState
            icon={WifiOff}
            title={t("common.connectionIssueTitle")}
            description={t("common.connectionIssueDesc")}
            actionLabel={t("common.retry")}
            onAction={() => {
              void employeesQuery.refetch();
            }}
          />
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO
        title={`${t("reports.employee.title")} | Xefe`}
        description={t("reports.employee.subtitle")}
      />
      <ReportPage
        title={t("reports.employee.title")}
        subtitle={t("reports.employee.subtitle")}
        icon={Users}
      >
        <ReportToolbar ariaLabel={t("reports.shared.periodLabel")}>
          <div className="space-y-1.5">
            <Label htmlFor="employee-report-period">
              {t("reports.shared.periodLabel")}
            </Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger
                id="employee-report-period"
                className="w-full sm:w-48"
              >
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
        </ReportToolbar>
        {/* Report Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-blue-600" />
                {t("reports.employee.cards.directory.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.employee.cards.directory.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.employee.cards.directory.totalRecords")}
                  </span>
                  <span className="font-medium">{employees.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.employee.cards.directory.active")}
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  >
                    {activeEmployees.length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.employee.cards.directory.inactive")}
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-muted text-muted-foreground"
                  >
                    {inactiveEmployees.length}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={exportDirectory}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.directory.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-5 w-5 text-green-600" />
                {t("reports.employee.cards.newHires.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.employee.cards.newHires.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.employee.cards.newHires.count")}
                  </span>
                  <span className="font-medium">{newHires.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.shared.periodLabel")}
                  </span>
                  <span className="font-medium">
                    {getDateRangeLabel(dateRange)}
                  </span>
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
                variant="outline"
                className="w-full"
                onClick={exportNewHires}
                disabled={newHires.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.newHires.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-5 w-5 text-purple-600" />
                {t("reports.employee.cards.headcount.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.employee.cards.headcount.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                {Object.entries(departmentCounts)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 4)
                  .map(([dept, count]) => (
                    <div key={dept} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate">
                        {dept}
                      </span>
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
              <Button
                variant="outline"
                className="w-full"
                onClick={exportHeadcount}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.employee.cards.headcount.export")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Employment Type Breakdown */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              {t("reports.employee.types.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.employee.types.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-3">
              {Object.entries(employmentTypes)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([type, count]) => {
                  const pct =
                    employees.length > 0
                      ? ((count as number) / employees.length) * 100
                      : 0;
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {getEmploymentTypeLabel(type)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                        <Badge variant="outline" className="tabular-nums">
                          {count as number}
                        </Badge>
                      </span>
                    </div>
                  );
                })}
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={exportEmploymentTypes}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("reports.employee.types.export")}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Employees Table */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-violet-600" />
              {t("reports.employee.recent.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.employee.recent.description")}
            </CardDescription>
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
                  {recentEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="rounded-lg border border-border/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {emp.personalInfo?.firstName}{" "}
                            {emp.personalInfo?.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {emp.jobDetails?.employeeId}
                          </div>
                        </div>
                        <Badge
                          className={
                            emp.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {getStatusLabel(emp.status)}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("reports.employee.recent.table.department")}
                          </p>
                          <p>{emp.jobDetails?.department || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("reports.employee.recent.table.position")}
                          </p>
                          <p>{emp.jobDetails?.position || "-"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">
                            {t("reports.employee.recent.table.hireDate")}
                          </p>
                          <p>
                            {emp.jobDetails?.hireDate
                              ? formatDateTL(emp.jobDetails.hireDate)
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
                        <th className="text-left p-3 font-medium">
                          {t("reports.employee.recent.table.employee")}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {t("reports.employee.recent.table.department")}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {t("reports.employee.recent.table.position")}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {t("reports.employee.recent.table.hireDate")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("reports.employee.recent.table.status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEmployees.map((emp) => (
                        <tr key={emp.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium">
                                {emp.personalInfo?.firstName}{" "}
                                {emp.personalInfo?.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {emp.jobDetails?.employeeId}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {emp.jobDetails?.department || "-"}
                          </td>
                          <td className="p-3">
                            {emp.jobDetails?.position || "-"}
                          </td>
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
                                  : "bg-muted text-muted-foreground"
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
      </ReportPage>
    </>
  );
}
