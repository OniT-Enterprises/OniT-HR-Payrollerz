import React, { useEffect, useState } from "react";
import { addDaysISO, formatDateTL, getTodayTL } from "@/lib/dateUtils";
import { exportToCSV as exportCSVFile } from "@/lib/csvExport";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { attendanceService } from "@/services/attendanceService";
import { useAllDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  BarChart3,
  FileText,
  Download,
  Plus,
  Play,
  Trash2,
  Eye,
  Clock,
  Users,
  Building,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  dataSource: "employees" | "attendance" | "departments";
  columns: string[];
  filters: {
    department?: string;
    status?: string;
    dateRange?: string;
  };
  createdAt: Date;
  lastRun?: Date;
}

interface ColumnOption {
  key: string;
  label: string;
  labelKey: string;
  dataSource: string;
}

const COLUMN_OPTIONS: ColumnOption[] = [
  // Employee columns
  { key: "personalInfo.firstName", label: "First Name", labelKey: "firstName", dataSource: "employees" },
  { key: "personalInfo.lastName", label: "Last Name", labelKey: "lastName", dataSource: "employees" },
  { key: "personalInfo.email", label: "Email", labelKey: "email", dataSource: "employees" },
  { key: "personalInfo.phone", label: "Phone", labelKey: "phone", dataSource: "employees" },
  { key: "jobDetails.employeeId", label: "Employee ID", labelKey: "employeeId", dataSource: "employees" },
  { key: "jobDetails.department", label: "Department", labelKey: "department", dataSource: "employees" },
  { key: "jobDetails.position", label: "Position", labelKey: "position", dataSource: "employees" },
  { key: "jobDetails.hireDate", label: "Hire Date", labelKey: "hireDate", dataSource: "employees" },
  { key: "jobDetails.employmentType", label: "Employment Type", labelKey: "employmentType", dataSource: "employees" },
  { key: "compensation.monthlySalary", label: "Salary", labelKey: "salary", dataSource: "employees" },
  { key: "status", label: "Status", labelKey: "status", dataSource: "employees" },
  // Attendance columns
  { key: "date", label: "Date", labelKey: "date", dataSource: "attendance" },
  { key: "employeeName", label: "Employee Name", labelKey: "employeeName", dataSource: "attendance" },
  { key: "department", label: "Department", labelKey: "department", dataSource: "attendance" },
  { key: "clockIn", label: "Clock In", labelKey: "clockIn", dataSource: "attendance" },
  { key: "clockOut", label: "Clock Out", labelKey: "clockOut", dataSource: "attendance" },
  { key: "regularHours", label: "Regular Hours", labelKey: "regularHours", dataSource: "attendance" },
  { key: "overtimeHours", label: "Overtime Hours", labelKey: "overtimeHours", dataSource: "attendance" },
  { key: "lateMinutes", label: "Late Minutes", labelKey: "lateMinutes", dataSource: "attendance" },
  { key: "status", label: "Status", labelKey: "status", dataSource: "attendance" },
  // Department columns
  { key: "name", label: "Department Name", labelKey: "departmentName", dataSource: "departments" },
  { key: "director", label: "Director", labelKey: "director", dataSource: "departments" },
  { key: "manager", label: "Manager", labelKey: "manager", dataSource: "departments" },
];

const TEMPLATE_KEYS: Record<string, string> = {
  "active-employees": "activeEmployees",
  "monthly-attendance": "monthlyAttendance",
  "dept-headcount": "departmentHeadcount",
};

const SAMPLE_REPORTS: ReportConfig[] = [
  {
    id: "active-employees",
    name: "Active Employees Directory",
    description: "List of all active employees with contact information",
    dataSource: "employees",
    columns: [
      "personalInfo.firstName",
      "personalInfo.lastName",
      "personalInfo.email",
      "jobDetails.department",
      "jobDetails.position",
    ],
    filters: { status: "active" },
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "monthly-attendance",
    name: "Monthly Attendance Summary",
    description: "Attendance records for the current month",
    dataSource: "attendance",
    columns: ["date", "employeeName", "clockIn", "clockOut", "regularHours", "status"],
    filters: { dateRange: "30" },
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "dept-headcount",
    name: "Department Headcount",
    description: "Employee count by department",
    dataSource: "departments",
    columns: ["name", "director", "manager"],
    filters: {},
    createdAt: new Date("2024-02-01"),
  },
];

export default function CustomReports() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { hasModule } = useTenant();
  const hasStaff = hasModule("staff");
  const hasTimeleave = hasModule("timeleave");
  const hasAvailableSource = hasStaff || hasTimeleave;

  const [savedReports, setSavedReports] = useState<ReportConfig[]>(() =>
    SAMPLE_REPORTS.filter((report) =>
      report.dataSource === "attendance" ? hasTimeleave : hasStaff,
    ),
  );
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
  const [previewColumns, setPreviewColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch departments with React Query hook
  const departmentQuery = useAllDepartments(tenantId, 100, hasStaff);
  const departments = departmentQuery.data ?? [];

  // Builder state
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [dataSource, setDataSource] = useState<"employees" | "attendance" | "departments">(
    hasStaff ? "employees" : "attendance",
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateRange, setFilterDateRange] = useState<string>("30");

  const translateColumn = (column: ColumnOption): ColumnOption => ({
    ...column,
    label: t(`reports.custom.columns.${column.labelKey}`) || column.label,
  });
  const availableColumns = COLUMN_OPTIONS
    .filter((c) => c.dataSource === dataSource)
    .map(translateColumn);
  const localizedPreviewColumns = previewColumns.map(translateColumn);

  const canUseSource = (source: ReportConfig["dataSource"]) =>
    source === "attendance" ? hasTimeleave : hasStaff;

  useEffect(() => {
    setSavedReports(
      SAMPLE_REPORTS.filter((report) =>
        report.dataSource === "attendance" ? hasTimeleave : hasStaff,
      ),
    );
  }, [hasStaff, hasTimeleave]);

  useEffect(() => {
    if (
      (dataSource === "attendance" && !hasTimeleave) ||
      (dataSource !== "attendance" && !hasStaff)
    ) {
      setDataSource(hasStaff ? "employees" : "attendance");
      setSelectedColumns([]);
      setPreviewData(null);
      setPreviewColumns([]);
    }
  }, [dataSource, hasStaff, hasTimeleave]);

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const resetBuilder = (clearPreview = true) => {
    setReportName("");
    setReportDescription("");
    setDataSource(hasStaff ? "employees" : "attendance");
    setSelectedColumns([]);
    setFilterDepartment("");
    setFilterStatus("");
    setFilterDateRange("30");
    if (clearPreview) {
      setPreviewData(null);
      setPreviewColumns([]);
    }
  };

  const runReport = async (config: ReportConfig) => {
    if (!canUseSource(config.dataSource)) return;
    setLoading(true);
    try {
      let data: Record<string, unknown>[] = [];

      if (config.dataSource === "employees") {
        const employees: Employee[] = await employeeService.getAllEmployees(tenantId);
        data = employees.filter((e) => {
          if (config.filters.status && e.status !== config.filters.status) return false;
          if (config.filters.department && e.jobDetails?.department !== config.filters.department)
            return false;
          return true;
        }) as unknown as Record<string, unknown>[];
      } else if (config.dataSource === "attendance") {
        const endDateStr = getTodayTL();
        const startDateStr = addDaysISO(
          endDateStr,
          -parseInt(config.filters.dateRange || "30", 10),
        );
        const attendance = await attendanceService.getAttendanceByDateRange(
          tenantId,
          startDateStr,
          endDateStr,
          config.filters.department || undefined,
        );
        data = (config.filters.department
          ? attendance.filter((a) => a.department === config.filters.department)
          : attendance) as unknown as Record<string, unknown>[];
      } else if (config.dataSource === "departments") {
        let departmentData = departmentQuery.data;
        if (departmentData === undefined) {
          const result = await departmentQuery.refetch();
          if (result.error) throw result.error;
          departmentData = result.data ?? [];
        }
        data = departmentData as unknown as Record<string, unknown>[];
      }

      const columns = config.columns
        .map((key) => COLUMN_OPTIONS.find((c) => c.key === key))
        .filter(Boolean) as ColumnOption[];

      setPreviewData(data);
      setPreviewColumns(columns);

      // Update lastRun
      setSavedReports((prev) =>
        prev.map((r) =>
          r.id === config.id ? { ...r, lastRun: new Date() } : r
        )
      );

      toast({
        title: t("reports.custom.toast.generated"),
        description: t("reports.custom.toast.generatedDescription", { count: data.length }),
      });
      return true;
    } catch (error) {
      console.error("Error running report:", error);
      toast({
        title: t("reports.custom.toast.error"),
        description: t("reports.custom.toast.generateFailed"),
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const runCustomReport = async () => {
    if (!canUseSource(dataSource)) return;
    if (!reportName || selectedColumns.length === 0) {
      toast({
        title: t("reports.custom.toast.validationError"),
        description: t("reports.custom.toast.validationDescription"),
        variant: "destructive",
      });
      return;
    }

    const newReport: ReportConfig = {
      id: `custom-${Date.now()}`,
      name: reportName,
      description: reportDescription,
      dataSource,
      columns: selectedColumns,
      filters: {
        department: filterDepartment || "",
        status: filterStatus || "",
        dateRange: filterDateRange,
      },
      createdAt: new Date(),
    };

    const generated = await runReport(newReport);
    if (generated) {
      setIsBuilderOpen(false);
      // Reset the form for next time without erasing the report the user just ran.
      resetBuilder(false);
    }
  };

  const exportToCSV = () => {
    if (!previewData || !previewColumns.length) return;

    exportCSVFile(previewData, "custom_report", localizedPreviewColumns);
    toast({
      title: t("reports.custom.toast.exported"),
      description: t("reports.custom.toast.exportedDescription"),
    });
  };

  const getDataSourceIcon = (source: string) => {
    switch (source) {
      case "employees":
        return <Users className="h-4 w-4" />;
      case "attendance":
        return <Clock className="h-4 w-4" />;
      case "departments":
        return <Building className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTemplateName = (report: ReportConfig) => {
    const key = TEMPLATE_KEYS[report.id];
    return key ? t(`reports.custom.templates.${key}.name`) : report.name;
  };

  const getTemplateDescription = (report: ReportConfig) => {
    const key = TEMPLATE_KEYS[report.id];
    return key
      ? t(`reports.custom.templates.${key}.description`)
      : report.description || t("reports.custom.noDescription");
  };

  if (!hasAvailableSource) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.customReports} />
        <MainNavigation />
        <div className="mx-auto max-w-screen-lg px-4 py-8 sm:px-6">
          <PageHeader
            title={t("reports.custom.title")}
            subtitle={t("reports.custom.subtitle")}
            icon={BarChart3}
            iconColor="text-violet-500"
          />
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold">{t("reports.custom.noDataTitle")}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {t("reports.custom.noDataDescription")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.customReports} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <PageHeader
          title={t("reports.custom.title")}
          subtitle={t("reports.custom.subtitle")}
          icon={BarChart3}
          iconColor="text-violet-500"
          actions={
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetBuilder()}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("reports.custom.buildReport")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("reports.custom.builder.title")}</DialogTitle>
                  <DialogDescription>
                    {t("reports.custom.builder.description")}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Report Details */}
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">{t("reports.custom.builder.name")}</Label>
                      <Input
                        id="name"
                        placeholder={t("reports.custom.builder.namePlaceholder")}
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">{t("reports.custom.builder.optionalDescription")}</Label>
                      <Input
                        id="description"
                        placeholder={t("reports.custom.builder.descriptionPlaceholder")}
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Data Source */}
                  <div className="grid gap-2">
                    <Label>{t("reports.custom.builder.dataSource")}</Label>
                    <Select
                      value={dataSource}
                      onValueChange={(v) => {
                        setDataSource(v as "employees" | "attendance" | "departments");
                        setSelectedColumns([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hasStaff && <SelectItem value="employees">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {t("reports.custom.builder.employees")}
                          </div>
                        </SelectItem>}
                        {hasTimeleave && <SelectItem value="attendance">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {t("reports.custom.builder.attendance")}
                          </div>
                        </SelectItem>}
                        {hasStaff && <SelectItem value="departments">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {t("reports.custom.builder.departments")}
                          </div>
                        </SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Columns */}
                  <div className="grid gap-2">
                    <Label>
                      {t("reports.custom.builder.selectColumns", { count: selectedColumns.length })}
                    </Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {availableColumns.map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={col.key}
                              checked={selectedColumns.includes(col.key)}
                              onCheckedChange={() => toggleColumn(col.key)}
                            />
                            <label
                              htmlFor={col.key}
                              className="text-sm cursor-pointer"
                            >
                              {col.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="grid gap-4">
                    <Label>{t("reports.custom.builder.filters")}</Label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {(dataSource === "employees" || dataSource === "attendance") && (
                        <div className="grid gap-2">
                          <Label className="text-sm text-muted-foreground">{t("reports.custom.builder.department")}</Label>
                          <Select
                            value={filterDepartment || "all"}
                            onValueChange={(value) =>
                              setFilterDepartment(value === "all" ? "" : value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("reports.custom.builder.allDepartments")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("reports.custom.builder.allDepartments")}</SelectItem>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.name}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {dataSource === "employees" && (
                        <div className="grid gap-2">
                          <Label className="text-sm text-muted-foreground">{t("reports.custom.builder.status")}</Label>
                          <Select
                            value={filterStatus || "all"}
                            onValueChange={(value) =>
                              setFilterStatus(value === "all" ? "" : value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("reports.custom.builder.allStatuses")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("reports.custom.builder.allStatuses")}</SelectItem>
                              <SelectItem value="active">{t("reports.custom.builder.active")}</SelectItem>
                              <SelectItem value="inactive">{t("reports.custom.builder.inactive")}</SelectItem>
                              <SelectItem value="onboarding">{t("reports.custom.builder.onboarding")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {dataSource === "attendance" && (
                        <div className="grid gap-2">
                          <Label className="text-sm text-muted-foreground">{t("reports.custom.builder.dateRange")}</Label>
                          <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">{t("reports.shared.ranges.7")}</SelectItem>
                              <SelectItem value="30">{t("reports.shared.ranges.30")}</SelectItem>
                              <SelectItem value="90">{t("reports.shared.ranges.90")}</SelectItem>
                              <SelectItem value="365">{t("reports.shared.ranges.365")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={() => { void runCustomReport(); }} disabled={loading}>
                    <Play className="h-4 w-4 mr-2" />
                    {loading ? t("reports.custom.builder.running") : t("reports.custom.builder.runReport")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
        {/* Report templates */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              {t("reports.custom.templatesTitle")}
            </CardTitle>
            <CardDescription>{t("reports.custom.templatesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {savedReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("reports.custom.noTemplates")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedReports.map((report) => (
                  <Card
                    key={report.id}
                    className="border hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDataSourceIcon(report.dataSource)}
                          <h4 className="font-medium truncate">{getTemplateName(report)}</h4>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {t("reports.custom.columnCount", { count: report.columns.length })}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {getTemplateDescription(report)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>
                          {t("reports.custom.template")}
                        </span>
                        {report.lastRun && (
                          <span>
                            {t("reports.custom.lastRun", { date: formatDateTL(report.lastRun) })}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => runReport(report)}
                          disabled={loading}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {t("reports.custom.run")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Preview */}
        {previewData && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-violet-600" />
                    {t("reports.custom.previewTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("reports.custom.recordsFound", { count: previewData.length })}
                  </CardDescription>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button className="flex-1 sm:flex-none" variant="outline" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("reports.custom.exportCsv")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewData(null)}
                    aria-label={t("reports.custom.clearPreview")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {previewData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("reports.custom.noMatches")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        {localizedPreviewColumns.map((col) => (
                          <th key={col.key} className="text-left p-3 font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {localizedPreviewColumns.map((col) => {
                            const value = col.key
                              .split(".")
                              .reduce<unknown>((obj, key) => (obj as Record<string, unknown>)?.[key], row);
                            return (
                              <td key={col.key} className="p-3">
                                {value !== undefined && value !== null
                                  ? String(value)
                                  : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 20 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      {t("reports.custom.showingLimited", { count: previewData.length })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
