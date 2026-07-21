import React, { useEffect, useState } from "react";
import { addDaysISO, formatDateTL, getTodayTL } from "@/lib/dateUtils";
import { exportToCSV as exportCSVFile } from "@/lib/csvExport";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ReportEmptyState,
  ReportPage,
  ReportSection,
} from "@/components/reports/ReportLayout";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceService } from "@/services/attendanceService";
import { useAllDepartments } from "@/hooks/useDepartments";
import {
  useCreateCustomReport,
  useCustomReports,
  useDeleteCustomReport,
  useTouchCustomReportLastRun,
} from "@/hooks/useCustomReports";
import {
  addDepartmentHeadcounts,
  filterEmployeeRows,
  getColumnValue,
} from "@/lib/reports/customReportRows";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  BarChart3,
  FileText,
  Download,
  Plus,
  Play,
  Save,
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
  {
    key: "personalInfo.firstName",
    label: "First Name",
    labelKey: "firstName",
    dataSource: "employees",
  },
  {
    key: "personalInfo.lastName",
    label: "Last Name",
    labelKey: "lastName",
    dataSource: "employees",
  },
  {
    key: "personalInfo.email",
    label: "Email",
    labelKey: "email",
    dataSource: "employees",
  },
  {
    key: "personalInfo.phone",
    label: "Phone",
    labelKey: "phone",
    dataSource: "employees",
  },
  {
    key: "jobDetails.employeeId",
    label: "Employee ID",
    labelKey: "employeeId",
    dataSource: "employees",
  },
  {
    key: "jobDetails.department",
    label: "Department",
    labelKey: "department",
    dataSource: "employees",
  },
  {
    key: "jobDetails.position",
    label: "Position",
    labelKey: "position",
    dataSource: "employees",
  },
  {
    key: "jobDetails.hireDate",
    label: "Hire Date",
    labelKey: "hireDate",
    dataSource: "employees",
  },
  {
    key: "jobDetails.employmentType",
    label: "Employment Type",
    labelKey: "employmentType",
    dataSource: "employees",
  },
  {
    key: "compensation.monthlySalary",
    label: "Salary",
    labelKey: "salary",
    dataSource: "employees",
  },
  {
    key: "status",
    label: "Status",
    labelKey: "status",
    dataSource: "employees",
  },
  // Attendance columns
  { key: "date", label: "Date", labelKey: "date", dataSource: "attendance" },
  {
    key: "employeeName",
    label: "Employee Name",
    labelKey: "employeeName",
    dataSource: "attendance",
  },
  {
    key: "department",
    label: "Department",
    labelKey: "department",
    dataSource: "attendance",
  },
  {
    key: "clockIn",
    label: "Clock In",
    labelKey: "clockIn",
    dataSource: "attendance",
  },
  {
    key: "clockOut",
    label: "Clock Out",
    labelKey: "clockOut",
    dataSource: "attendance",
  },
  {
    key: "regularHours",
    label: "Regular Hours",
    labelKey: "regularHours",
    dataSource: "attendance",
  },
  {
    key: "overtimeHours",
    label: "Overtime Hours",
    labelKey: "overtimeHours",
    dataSource: "attendance",
  },
  {
    key: "lateMinutes",
    label: "Late Minutes",
    labelKey: "lateMinutes",
    dataSource: "attendance",
  },
  {
    key: "status",
    label: "Status",
    labelKey: "status",
    dataSource: "attendance",
  },
  // Department columns
  {
    key: "name",
    label: "Department Name",
    labelKey: "departmentName",
    dataSource: "departments",
  },
  {
    key: "director",
    label: "Director",
    labelKey: "director",
    dataSource: "departments",
  },
  {
    key: "manager",
    label: "Manager",
    labelKey: "manager",
    dataSource: "departments",
  },
  {
    key: "headcount",
    label: "Headcount",
    labelKey: "headcount",
    dataSource: "departments",
  },
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
    columns: [
      "date",
      "employeeName",
      "clockIn",
      "clockOut",
      "regularHours",
      "status",
    ],
    filters: { dateRange: "30" },
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "dept-headcount",
    name: "Department Headcount",
    description: "Employee count by department",
    dataSource: "departments",
    columns: ["name", "director", "manager", "headcount"],
    filters: {},
    createdAt: new Date("2024-02-01"),
  },
];

export default function CustomReports() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { hasModule } = useTenant();
  const hasStaff = hasModule("staff");
  const hasTimeleave = hasModule("timeleave");
  const hasAvailableSource = hasStaff || hasTimeleave;

  // Built-in templates never persist; their "last run" is session-only.
  const [builtinLastRun, setBuiltinLastRun] = useState<Record<string, Date>>(
    {},
  );
  // User-built reports live in tenants/{tid}/customReports.
  const savedReportsQuery = useCustomReports(hasAvailableSource);
  const createReport = useCreateCustomReport();
  const deleteReport = useDeleteCustomReport();
  const touchLastRun = useTouchCustomReportLastRun();
  const [deleteTarget, setDeleteTarget] = useState<ReportConfig | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [previewData, setPreviewData] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [previewColumns, setPreviewColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch departments with React Query hook
  const departmentQuery = useAllDepartments(tenantId, 100, hasStaff);
  const departments = departmentQuery.data ?? [];

  // Builder state
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [dataSource, setDataSource] = useState<
    "employees" | "attendance" | "departments"
  >(hasStaff ? "employees" : "attendance");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateRange, setFilterDateRange] = useState<string>("30");

  const translateColumn = (column: ColumnOption): ColumnOption => ({
    ...column,
    label: t(`reports.custom.columns.${column.labelKey}`) || column.label,
  });
  const availableColumns = COLUMN_OPTIONS.filter(
    (c) => c.dataSource === dataSource,
  ).map(translateColumn);
  const localizedPreviewColumns = previewColumns.map(translateColumn);

  const canUseSource = (source: ReportConfig["dataSource"]) =>
    source === "attendance" ? hasTimeleave : hasStaff;

  // Built-in templates first, then the tenant's saved reports (hide any
  // whose data source module is currently disabled).
  const reportList: { report: ReportConfig; builtin: boolean }[] = [
    ...SAMPLE_REPORTS.filter((report) => canUseSource(report.dataSource)).map(
      (report) => ({
        report: { ...report, lastRun: builtinLastRun[report.id] },
        builtin: true,
      }),
    ),
    ...(savedReportsQuery.data ?? [])
      .filter((saved) => canUseSource(saved.dataSource))
      .map((saved) => ({
        report: {
          id: saved.id,
          name: saved.name,
          description: saved.description,
          dataSource: saved.dataSource,
          columns: saved.columns,
          filters: saved.filters,
          createdAt: saved.createdAt,
          lastRun: saved.lastRunAt,
        },
        builtin: false,
      })),
  ];

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
        : [...prev, columnKey],
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

  const runReport = async (
    config: ReportConfig,
    origin: "builtin" | "saved" | "adhoc" = "adhoc",
  ) => {
    if (!canUseSource(config.dataSource)) return;
    setLoading(true);
    try {
      let data: Record<string, unknown>[] = [];

      if (config.dataSource === "employees") {
        const employees: Employee[] =
          await employeeService.getAllEmployees(tenantId);
        data = filterEmployeeRows(
          employees,
          config.filters,
        ) as unknown as Record<string, unknown>[];
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
        const employees = await employeeService.getAllEmployees(tenantId);
        data = addDepartmentHeadcounts(
          departmentData,
          employees,
        ) as unknown as Record<string, unknown>[];
      }

      const columns = config.columns
        .map((key) => COLUMN_OPTIONS.find((c) => c.key === key))
        .filter(Boolean) as ColumnOption[];

      setPreviewData(data);
      setPreviewColumns(columns);

      // Update lastRun. For saved reports this is persisted bookkeeping —
      // fire-and-forget so a write failure never breaks the run itself.
      if (origin === "builtin") {
        setBuiltinLastRun((prev) => ({ ...prev, [config.id]: new Date() }));
      } else if (origin === "saved") {
        touchLastRun.mutate(config.id);
      }

      toast({
        title: t("reports.custom.toast.generated"),
        description: t("reports.custom.toast.generatedDescription", {
          count: data.length,
        }),
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

  const buildConfigFromForm = (): ReportConfig | null => {
    if (!canUseSource(dataSource)) return null;
    if (!reportName || selectedColumns.length === 0) {
      toast({
        title: t("reports.custom.toast.validationError"),
        description: t("reports.custom.toast.validationDescription"),
        variant: "destructive",
      });
      return null;
    }
    return {
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
  };

  /** Run the builder config once without saving it. */
  const runCustomReport = async () => {
    const newReport = buildConfigFromForm();
    if (!newReport) return;

    const generated = await runReport(newReport, "adhoc");
    if (generated) {
      setIsBuilderOpen(false);
      // Reset the form for next time without erasing the report the user just ran.
      resetBuilder(false);
    }
  };

  /** Persist the builder config to Firestore, then run it. */
  const saveAndRunCustomReport = async () => {
    const newReport = buildConfigFromForm();
    if (!newReport || !user) return;

    let savedId: string;
    try {
      savedId = await createReport.mutateAsync({
        config: {
          name: newReport.name,
          description: newReport.description,
          dataSource: newReport.dataSource,
          columns: newReport.columns,
          filters: newReport.filters,
        },
        createdBy: user.uid,
      });
    } catch (error) {
      console.error("Error saving report:", error);
      toast({
        title: t("reports.custom.toast.error"),
        description:
          t("reports.custom.toast.saveFailed") ||
          "Could not save the report. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: t("reports.custom.toast.saved") || "Report saved" });
    setIsBuilderOpen(false);
    resetBuilder(false);
    await runReport({ ...newReport, id: savedId }, "saved");
  };

  const confirmDeleteReport = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReport.mutateAsync(deleteTarget.id);
      toast({ title: t("reports.custom.toast.deleted") || "Report deleted" });
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: t("reports.custom.toast.error"),
        description:
          t("reports.custom.toast.deleteFailed") ||
          "Could not delete the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
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
      <>
        <SEO {...seoConfig.customReports} />
        <ReportPage
          title={t("reports.custom.title")}
          subtitle={t("reports.custom.subtitle")}
          icon={BarChart3}
        >
          <Card className="border-border/70 shadow-sm">
            <CardContent>
              <ReportEmptyState
                icon={FileText}
                title={t("reports.custom.noDataTitle")}
                description={t("reports.custom.noDataDescription")}
              />
            </CardContent>
          </Card>
        </ReportPage>
      </>
    );
  }

  if (savedReportsQuery.isError || departmentQuery.isError) {
    return (
      <>
        <SEO {...seoConfig.customReports} />
        <ReportPage
          title={t("reports.custom.title")}
          subtitle={t("reports.custom.subtitle")}
          icon={BarChart3}
        >
          <Card className="border-border/70 shadow-sm">
            <CardContent>
              <ReportEmptyState
                icon={FileText}
                title={t("common.connectionIssueTitle")}
                description={t("common.connectionIssueDesc")}
                actionLabel={t("common.retry")}
                onAction={() => {
                  void Promise.all([
                    savedReportsQuery.refetch(),
                    departmentQuery.refetch(),
                  ]);
                }}
              />
            </CardContent>
          </Card>
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO {...seoConfig.customReports} />
      <ReportPage
        title={t("reports.custom.title")}
        subtitle={t("reports.custom.subtitle")}
        icon={BarChart3}
        actions={
          <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetBuilder()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("reports.custom.buildReport")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
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
                    <Label htmlFor="name">
                      {t("reports.custom.builder.name")}
                    </Label>
                    <Input
                      id="name"
                      placeholder={t("reports.custom.builder.namePlaceholder")}
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">
                      {t("reports.custom.builder.optionalDescription")}
                    </Label>
                    <Input
                      id="description"
                      placeholder={t(
                        "reports.custom.builder.descriptionPlaceholder",
                      )}
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
                      setDataSource(
                        v as "employees" | "attendance" | "departments",
                      );
                      setSelectedColumns([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hasStaff && (
                        <SelectItem value="employees">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {t("reports.custom.builder.employees")}
                          </div>
                        </SelectItem>
                      )}
                      {hasTimeleave && (
                        <SelectItem value="attendance">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {t("reports.custom.builder.attendance")}
                          </div>
                        </SelectItem>
                      )}
                      {hasStaff && (
                        <SelectItem value="departments">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {t("reports.custom.builder.departments")}
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Columns */}
                <div className="grid gap-2">
                  <Label>
                    {t("reports.custom.builder.selectColumns", {
                      count: selectedColumns.length,
                    })}
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
                    {(dataSource === "employees" ||
                      dataSource === "attendance") && (
                      <div className="grid gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {t("reports.custom.builder.department")}
                        </Label>
                        <Select
                          value={filterDepartment || "all"}
                          onValueChange={(value) =>
                            setFilterDepartment(value === "all" ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "reports.custom.builder.allDepartments",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("reports.custom.builder.allDepartments")}
                            </SelectItem>
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
                        <Label className="text-sm text-muted-foreground">
                          {t("reports.custom.builder.status")}
                        </Label>
                        <Select
                          value={filterStatus || "all"}
                          onValueChange={(value) =>
                            setFilterStatus(value === "all" ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "reports.custom.builder.allStatuses",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("reports.custom.builder.allStatuses")}
                            </SelectItem>
                            <SelectItem value="active">
                              {t("reports.custom.builder.active")}
                            </SelectItem>
                            <SelectItem value="inactive">
                              {t("reports.custom.builder.inactive")}
                            </SelectItem>
                            <SelectItem value="onboarding">
                              {t("reports.custom.builder.onboarding")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {dataSource === "attendance" && (
                      <div className="grid gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {t("reports.custom.builder.dateRange")}
                        </Label>
                        <Select
                          value={filterDateRange}
                          onValueChange={setFilterDateRange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">
                              {t("reports.shared.ranges.7")}
                            </SelectItem>
                            <SelectItem value="30">
                              {t("reports.shared.ranges.30")}
                            </SelectItem>
                            <SelectItem value="90">
                              {t("reports.shared.ranges.90")}
                            </SelectItem>
                            <SelectItem value="365">
                              {t("reports.shared.ranges.365")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBuilderOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void runCustomReport();
                  }}
                  disabled={loading || createReport.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {loading
                    ? t("reports.custom.builder.running")
                    : t("reports.custom.builder.runOnce") || "Run once"}
                </Button>
                <Button
                  onClick={() => {
                    void saveAndRunCustomReport();
                  }}
                  disabled={loading || createReport.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createReport.isPending
                    ? t("reports.custom.builder.saving") || "Saving…"
                    : t("reports.custom.builder.saveAndRun") || "Save & run"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {/* Report templates */}
        <ReportSection
          icon={FileText}
          title={t("reports.custom.templatesTitle")}
          description={t("reports.custom.templatesDescription")}
        >
          {reportList.length === 0 ? (
            <ReportEmptyState
              icon={BarChart3}
              title={t("reports.custom.noTemplates")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportList.map(({ report, builtin }) => (
                <Card
                  key={`${builtin ? "builtin" : "saved"}-${report.id}`}
                  className="border-border/70 shadow-none transition-colors hover:border-violet-400/50"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getDataSourceIcon(report.dataSource)}
                        <h4 className="font-medium truncate">
                          {getTemplateName(report)}
                        </h4>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {t("reports.custom.columnCount", {
                          count: report.columns.length,
                        })}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {getTemplateDescription(report)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>
                        {builtin
                          ? t("reports.custom.builtIn") || "Built-in"
                          : t("reports.custom.savedReport") || "Saved"}
                      </span>
                      {report.lastRun && (
                        <span>
                          {t("reports.custom.lastRun", {
                            date: formatDateTL(report.lastRun),
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          runReport(report, builtin ? "builtin" : "saved")
                        }
                        disabled={loading}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {t("reports.custom.run")}
                      </Button>
                      {!builtin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          onClick={() => setDeleteTarget(report)}
                          disabled={loading || deleteReport.isPending}
                          aria-label={
                            t("reports.custom.deleteReport") || "Delete report"
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ReportSection>

        {/* Report Preview */}
        {previewData && (
          <ReportSection
            icon={Eye}
            title={t("reports.custom.previewTitle")}
            description={t("reports.custom.recordsFound", {
              count: previewData.length,
            })}
            actions={
              <>
                <Button
                  className="flex-1 sm:flex-none"
                  variant="outline"
                  onClick={exportToCSV}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.custom.exportCsv")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setPreviewData(null)}
                  aria-label={t("reports.custom.clearPreview")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            }
          >
            {previewData.length === 0 ? (
              <ReportEmptyState
                icon={FileText}
                title={t("reports.custom.noMatches")}
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {previewData.slice(0, 20).map((row, index) => (
                    <dl
                      key={index}
                      className="space-y-2 rounded-lg border border-border/70 p-4"
                    >
                      {localizedPreviewColumns.map((column) => (
                        <div
                          key={column.key}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <dt className="text-muted-foreground">
                            {column.label}
                          </dt>
                          <dd className="max-w-[60%] break-words text-right font-medium">
                            {getColumnValue(row, column.key)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        {localizedPreviewColumns.map((col) => (
                          <th
                            key={col.key}
                            className="text-left p-3 font-medium"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {localizedPreviewColumns.map((col) => (
                            <td key={col.key} className="p-3">
                              {getColumnValue(row, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 20 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t("reports.custom.showingLimited", {
                      count: previewData.length,
                    })}
                  </p>
                )}
              </>
            )}
          </ReportSection>
        )}

        {/* Delete saved report confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("reports.custom.deleteTitle") || "Delete this saved report?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("reports.custom.deleteDescription") ||
                  "This removes the saved report for everyone in your company. It does not delete any employee or attendance data."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void confirmDeleteReport();
                }}
              >
                {t("common.delete") || "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ReportPage>
    </>
  );
}
