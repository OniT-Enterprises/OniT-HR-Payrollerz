import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAllDepartments } from "@/hooks/useDepartments";
import { useAllEmployees } from "@/hooks/useEmployees";
import type { Department } from "@/services/departmentService";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Building,
  Download,
  Users,
  TrendingUp,
  UserPlus,
  BarChart3,
  PieChart,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { exportToCSV } from "@/lib/csvExport";

interface DepartmentStats {
  department: Department;
  headcount: number;
  activeEmployees: number;
  newHires: number;
  averageTenure: number;
  employmentTypes: Record<string, number>;
}

export default function DepartmentReports() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { data: departments = [], isLoading: deptsLoading } = useAllDepartments(tenantId, 100);
  const { data: employees = [], isLoading: empsLoading } = useAllEmployees(500);
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();

  const getDateRangeLabel = (value: string) => t(`reports.shared.ranges.${value}`);
  const loading = deptsLoading || empsLoading;

  // Calculate stats per department
  const departmentStats = useMemo((): DepartmentStats[] => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange, 10));

    const stats: DepartmentStats[] = departments.map((dept) => {
      const deptEmployees = employees.filter(
        (e) => e.jobDetails?.department === dept.name
      );
      const activeEmps = deptEmployees.filter((e) => e.status === "active");
      const newHires = deptEmployees.filter((e) => {
        const hireDate = e.jobDetails?.hireDate
          ? new Date(e.jobDetails.hireDate)
          : null;
        return hireDate && hireDate >= cutoffDate;
      });

      // Calculate average tenure in months
      const tenures = activeEmps
        .filter((e) => e.jobDetails?.hireDate)
        .map((e) => {
          const hireDate = new Date(e.jobDetails.hireDate);
          const now = new Date();
          return (
            (now.getFullYear() - hireDate.getFullYear()) * 12 +
            (now.getMonth() - hireDate.getMonth())
          );
        });
      const avgTenure =
        tenures.length > 0
          ? tenures.reduce((a, b) => a + b, 0) / tenures.length
          : 0;

      // Employment type breakdown
      const employmentTypes = deptEmployees.reduce((acc, e) => {
        const type = e.jobDetails?.employmentType || "Unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        department: dept,
        headcount: deptEmployees.length,
        activeEmployees: activeEmps.length,
        newHires: newHires.length,
        averageTenure: avgTenure,
        employmentTypes,
      };
    });

    // Sort by headcount
    stats.sort((a, b) => b.headcount - a.headcount);
    return stats;
  }, [departments, employees, dateRange]);

  // Calculate overall stats
  const totalDepartments = departments.length;
  const totalEmployees = employees.length;
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active").length, [employees]);
  const largestDept = departmentStats[0];
  const avgHeadcount = useMemo(() =>
    totalDepartments > 0
      ? (totalEmployees / totalDepartments).toFixed(1)
      : "0", [totalDepartments, totalEmployees]);

  // Unassigned employees
  const unassignedEmployees = useMemo(() => {
    const assignedDepts = departments.map((d) => d.name);
    return employees.filter(
      (e) =>
        !e.jobDetails?.department ||
        !assignedDepts.includes(e.jobDetails?.department)
    );
  }, [departments, employees]);

  const doExport = (data: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.shared.exportTitle"),
      description: t("reports.shared.exportDescription", { filename: `${filename}.csv` }),
    });
  };

  const exportDepartmentOverview = () => {
    const data = departmentStats.map((s) => ({
      name: s.department.name,
      director: s.department.director || "-",
      manager: s.department.manager || "-",
      headcount: s.headcount,
      activeEmployees: s.activeEmployees,
      avgTenureMonths: s.averageTenure.toFixed(1),
    }));
    doExport(data, "department_overview", [
      { key: "name", label: t("reports.department.csv.department") },
      { key: "director", label: t("reports.department.csv.director") },
      { key: "manager", label: t("reports.department.csv.manager") },
      { key: "headcount", label: t("reports.department.csv.headcount") },
      { key: "activeEmployees", label: t("reports.department.csv.active") },
      { key: "avgTenureMonths", label: t("reports.department.csv.avgTenureMonths") },
    ]);
  };

  const exportStaffingReport = () => {
    const data = departmentStats.flatMap((s) =>
      Object.entries(s.employmentTypes).map(([type, count]) => ({
        department: s.department.name,
        employmentType: type,
        count,
        percentage: ((count / s.headcount) * 100).toFixed(1),
      }))
    );
    doExport(data, "staffing_by_department", [
      { key: "department", label: t("reports.department.csv.department") },
      { key: "employmentType", label: t("reports.department.csv.employmentType") },
      { key: "count", label: t("reports.department.csv.count") },
      { key: "percentage", label: t("reports.department.csv.percentage") },
    ]);
  };

  const exportGrowthReport = () => {
    const data = departmentStats.map((s) => ({
      department: s.department.name,
      currentHeadcount: s.headcount,
      newHires: s.newHires,
      growthRate:
        s.headcount > s.newHires
          ? ((s.newHires / (s.headcount - s.newHires)) * 100).toFixed(1)
          : t("reports.department.notAvailable"),
    }));
    doExport(data, "department_growth", [
      { key: "department", label: t("reports.department.csv.department") },
      { key: "currentHeadcount", label: t("reports.department.csv.currentHeadcount") },
      { key: "newHires", label: t("reports.department.csv.newHires") },
      { key: "growthRate", label: t("reports.department.csv.growthRate") },
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
      <SEO title={`${t("reports.department.title")} | Meza`} description={t("reports.department.subtitle")} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.department.title")}
          subtitle={t("reports.department.subtitle")}
          icon={Building}
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
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.department.stats.totalDepartments")}
                  </p>
                  <p className="text-3xl font-bold">{totalDepartments}</p>
                  <p className="text-xs text-violet-600">
                    {t("reports.department.stats.activeEmployees", { count: String(activeEmployees) })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
                  <Building className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.department.stats.largestDepartment")}
                  </p>
                  <p className="text-3xl font-bold truncate max-w-[140px]">
                    {largestDept?.department.name || "-"}
                  </p>
                  <p className="text-xs text-blue-600">
                    {t("reports.department.stats.employeeCount", { count: String(largestDept?.headcount || 0) })}
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
                    {t("reports.department.stats.avgHeadcount")}
                  </p>
                  <p className="text-3xl font-bold">{avgHeadcount}</p>
                  <p className="text-xs text-green-600">{t("reports.department.stats.perDepartment")}</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("reports.department.stats.unassigned")}
                  </p>
                  <p className="text-3xl font-bold">
                    {unassignedEmployees.length}
                  </p>
                  <p className="text-xs text-orange-600">
                    {t("reports.department.stats.ofStaff", {
                      percent: totalEmployees > 0
                        ? ((unassignedEmployees.length / totalEmployees) * 100).toFixed(0)
                        : "0",
                    })}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                  <UserPlus className="h-6 w-6 text-white" />
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
                <Building className="h-5 w-5 text-violet-600" />
                {t("reports.department.cards.overview.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.department.cards.overview.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.department.cards.overview.departments")}</span>
                  <span className="font-medium">{totalDepartments}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.department.cards.overview.totalStaff")}</span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  >
                    {totalEmployees}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.department.cards.overview.withDirector")}
                  </span>
                  <Badge variant="outline">
                    {departments.filter((d) => d.director).length}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportDepartmentOverview}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.department.cards.overview.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {t("reports.department.cards.staffing.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.department.cards.staffing.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {departmentStats.slice(0, 3).map((s) => (
                  <div key={s.department.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[140px]">
                      {s.department.name}
                    </span>
                    <Badge variant="outline">
                      {t("reports.department.cards.staffing.staffCount", { count: String(s.headcount) })}
                    </Badge>
                  </div>
                ))}
                {departmentStats.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    {t("reports.department.cards.staffing.moreDepartments", {
                      count: String(departmentStats.length - 3),
                    })}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={exportStaffingReport}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.department.cards.staffing.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                {t("reports.department.cards.growth.title")}
              </CardTitle>
              <CardDescription>
                {t("reports.department.cards.growth.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.department.cards.growth.totalNewHires")}
                  </span>
                  <span className="font-medium">
                    {departmentStats.reduce((sum, s) => sum + s.newHires, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.shared.periodLabel")}</span>
                  <Badge variant="outline">{getDateRangeLabel(dateRange)}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("reports.department.cards.growth.departmentsWithHires")}
                  </span>
                  <span className="font-medium">
                    {departmentStats.filter((s) => s.newHires > 0).length}
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={exportGrowthReport}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.department.cards.growth.export")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Department Size Distribution */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-violet-600" />
              {t("reports.department.distribution.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.department.distribution.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {departmentStats.slice(0, 6).map((s, idx) => {
                const colors = [
                  "bg-violet-100 dark:bg-violet-900",
                  "bg-blue-100 dark:bg-blue-900",
                  "bg-green-100 dark:bg-green-900",
                  "bg-orange-100 dark:bg-orange-900",
                  "bg-pink-100 dark:bg-pink-900",
                  "bg-cyan-100 dark:bg-cyan-900",
                ];
                return (
                  <div
                    key={s.department.id}
                    className={`text-center p-4 ${colors[idx % 6]} rounded-lg`}
                  >
                    <p className="text-2xl font-bold">{s.headcount}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {s.department.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalEmployees > 0
                        ? ((s.headcount / totalEmployees) * 100).toFixed(0)
                        : 0}
                      %
                    </p>
                  </div>
                );
              })}
              {departmentStats.length > 6 && (
                <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold">
                    {departmentStats
                      .slice(6)
                      .reduce((sum, s) => sum + s.headcount, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("reports.department.distribution.others")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("reports.department.distribution.moreDepartments", {
                      count: String(departmentStats.length - 6),
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-violet-600" />
              {t("reports.department.table.title")}
            </CardTitle>
            <CardDescription>
              {t("reports.department.table.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("reports.department.table.empty")}</p>
                <p className="text-sm mb-4">{t("reports.department.table.emptyDescription")}</p>
                <Button variant="outline" onClick={() => navigate("/settings/departments")}>
                  <Building className="h-4 w-4 mr-2" />
                  {t("reports.department.table.goToDepartments")}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {departmentStats.map((s) => (
                    <div key={s.department.id} className="rounded-lg border border-border/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: s.department.color || "#8b5cf6" }}
                          />
                          <span className="font-medium">{s.department.name}</span>
                        </div>
                        <Badge
                          className={
                            s.headcount > 10
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : s.headcount > 5
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          }
                        >
                          {s.headcount}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.department.table.columns.director")}</p>
                          <p>{s.department.director || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.department.table.columns.manager")}</p>
                          <p>{s.department.manager || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.department.table.columns.active")}</p>
                          <p>{s.activeEmployees}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("reports.department.table.columns.newHires")}</p>
                          <p>{s.newHires > 0 ? `+${s.newHires}` : "0"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">{t("reports.department.table.columns.avgTenure")}</p>
                          <p>{s.averageTenure > 0 ? `${s.averageTenure.toFixed(0)} ${t("reports.shared.monthsShort")}` : "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t("reports.department.table.columns.department")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.department.table.columns.director")}</th>
                        <th className="text-left p-3 font-medium">{t("reports.department.table.columns.manager")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.department.table.columns.headcount")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.department.table.columns.active")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.department.table.columns.newHires")}</th>
                        <th className="text-center p-3 font-medium">{t("reports.department.table.columns.avgTenure")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.map((s) => (
                        <tr
                          key={s.department.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: s.department.color || "#8b5cf6",
                                }}
                              />
                              <span className="font-medium">
                                {s.department.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            {s.department.director || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {s.department.manager || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                s.headcount > 10
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : s.headcount > 5
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }
                            >
                              {s.headcount}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">{s.activeEmployees}</td>
                          <td className="p-3 text-center">
                            {s.newHires > 0 ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                +{s.newHires}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {s.averageTenure > 0 ? (
                              <span>{s.averageTenure.toFixed(0)} {t("reports.shared.monthsShort")}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
