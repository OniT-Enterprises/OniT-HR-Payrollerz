import React, { useState } from "react";
import { formatDateTL, getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import { useQueryClient } from "@tanstack/react-query";
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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { departmentService, Department } from "@/services/departmentService";
import { attendanceService, AttendanceRecord } from "@/services/attendanceService";
import { useAllDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Download,
  Plus,
  Settings,
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
  dataSource: string;
}

const COLUMN_OPTIONS: ColumnOption[] = [
  // Employee columns
  { key: "personalInfo.firstName", label: "First Name", dataSource: "employees" },
  { key: "personalInfo.lastName", label: "Last Name", dataSource: "employees" },
  { key: "personalInfo.email", label: "Email", dataSource: "employees" },
  { key: "personalInfo.phone", label: "Phone", dataSource: "employees" },
  { key: "jobDetails.employeeId", label: "Employee ID", dataSource: "employees" },
  { key: "jobDetails.department", label: "Department", dataSource: "employees" },
  { key: "jobDetails.position", label: "Position", dataSource: "employees" },
  { key: "jobDetails.hireDate", label: "Hire Date", dataSource: "employees" },
  { key: "jobDetails.employmentType", label: "Employment Type", dataSource: "employees" },
  { key: "compensation.salary", label: "Salary", dataSource: "employees" },
  { key: "status", label: "Status", dataSource: "employees" },
  // Attendance columns
  { key: "date", label: "Date", dataSource: "attendance" },
  { key: "employeeName", label: "Employee Name", dataSource: "attendance" },
  { key: "department", label: "Department", dataSource: "attendance" },
  { key: "clockIn", label: "Clock In", dataSource: "attendance" },
  { key: "clockOut", label: "Clock Out", dataSource: "attendance" },
  { key: "regularHours", label: "Regular Hours", dataSource: "attendance" },
  { key: "overtimeHours", label: "Overtime Hours", dataSource: "attendance" },
  { key: "lateMinutes", label: "Late Minutes", dataSource: "attendance" },
  { key: "status", label: "Status", dataSource: "attendance" },
  // Department columns
  { key: "name", label: "Department Name", dataSource: "departments" },
  { key: "director", label: "Director", dataSource: "departments" },
  { key: "manager", label: "Manager", dataSource: "departments" },
];

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
  const queryClient = useQueryClient();

  const [savedReports, setSavedReports] = useState<ReportConfig[]>(SAMPLE_REPORTS);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewColumns, setPreviewColumns] = useState<ColumnOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch departments with React Query hook
  const { data: departments = [] } = useAllDepartments(tenantId, 100);

  // Builder state
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [dataSource, setDataSource] = useState<"employees" | "attendance" | "departments">("employees");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateRange, setFilterDateRange] = useState<string>("30");

  const availableColumns = COLUMN_OPTIONS.filter((c) => c.dataSource === dataSource);

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const resetBuilder = () => {
    setReportName("");
    setReportDescription("");
    setDataSource("employees");
    setSelectedColumns([]);
    setFilterDepartment("");
    setFilterStatus("");
    setFilterDateRange("30");
    setPreviewData(null);
    setPreviewColumns([]);
  };

  const runReport = async (config: ReportConfig) => {
    setLoading(true);
    try {
      let data: any[] = [];

      if (config.dataSource === "employees") {
        // Try React Query cache first, then fetch
        let employees = queryClient.getQueryData<any[]>(['tenants', tenantId, 'employees', 'list', { pageSize: 500 }]);
        if (!employees) {
          const result = await employeeService.getEmployees(tenantId, { pageSize: 500 });
          employees = result.data;
          queryClient.setQueryData(['tenants', tenantId, 'employees', 'list', { pageSize: 500 }], employees);
        }
        data = employees.filter((e) => {
          if (config.filters.status && e.status !== config.filters.status) return false;
          if (config.filters.department && e.jobDetails?.department !== config.filters.department)
            return false;
          return true;
        });
      } else if (config.dataSource === "attendance") {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(config.filters.dateRange || "30", 10));
        const startDateStr = toDateStringTL(startDate);
        const endDateStr = toDateStringTL(today);
        // Try React Query cache first
        let attendance = queryClient.getQueryData<AttendanceRecord[]>(['attendance', startDateStr, endDateStr]);
        if (!attendance) {
          attendance = await attendanceService.getAttendanceByDateRange(
            tenantId,
            startDateStr,
            endDateStr,
            config.filters.department || undefined
          );
          queryClient.setQueryData(['attendance', startDateStr, endDateStr], attendance);
        }
        data = config.filters.department
          ? attendance.filter((a) => a.department === config.filters.department)
          : attendance;
      } else if (config.dataSource === "departments") {
        // Try React Query cache first
        let depts = queryClient.getQueryData<Department[]>(['departments', 'list', { maxResults: 100 }]);
        if (!depts) {
          depts = await departmentService.getAllDepartments(tenantId);
          queryClient.setQueryData(['departments', 'list', { maxResults: 100 }], depts);
        }
        data = depts;
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
        title: "Report Generated",
        description: `Found ${data.length} records`,
      });
    } catch (error) {
      console.error("Error running report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveReport = () => {
    if (!reportName || selectedColumns.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a report name and select at least one column",
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
        department: filterDepartment || undefined,
        status: filterStatus || undefined,
        dateRange: filterDateRange,
      },
      createdAt: new Date(),
    };

    setSavedReports((prev) => [newReport, ...prev]);
    setIsBuilderOpen(false);
    resetBuilder();

    toast({
      title: "Report Saved",
      description: `"${reportName}" has been saved`,
    });
  };

  const deleteReport = (id: string) => {
    setSavedReports((prev) => prev.filter((r) => r.id !== id));
    if (previewData) setPreviewData(null);
    toast({
      title: "Report Deleted",
      description: "Report has been removed",
    });
  };

  const exportToCSV = async () => {
    if (!previewData || !previewColumns.length) return;

    const { default: Papa } = await import("papaparse");
    const rows = previewData.map((item) =>
      previewColumns.reduce((row, c) => {
        const value = c.key.split(".").reduce((obj, key) => obj?.[key], item);
        row[c.label] = String(value ?? "");
        return row;
      }, {} as Record<string, string>)
    );
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custom_report_${getTodayTL()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: "Report exported to CSV",
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

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.customReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("reports.custom.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("reports.custom.subtitle")}
                </p>
              </div>
            </div>
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetBuilder}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Report</DialogTitle>
                  <DialogDescription>
                    Build a custom report by selecting data source, columns, and filters
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Report Details */}
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Report Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Active Employees by Department"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        placeholder="Brief description of the report"
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Data Source */}
                  <div className="grid gap-2">
                    <Label>Data Source</Label>
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
                        <SelectItem value="employees">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Employees
                          </div>
                        </SelectItem>
                        <SelectItem value="attendance">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Attendance Records
                          </div>
                        </SelectItem>
                        <SelectItem value="departments">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Departments
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Columns */}
                  <div className="grid gap-2">
                    <Label>Select Columns ({selectedColumns.length} selected)</Label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2">
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
                    <Label>Filters</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {(dataSource === "employees" || dataSource === "attendance") && (
                        <div className="grid gap-2">
                          <Label className="text-sm text-muted-foreground">Department</Label>
                          <Select
                            value={filterDepartment}
                            onValueChange={setFilterDepartment}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All departments" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Departments</SelectItem>
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
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Statuses</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="onboarding">Onboarding</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {dataSource === "attendance" && (
                        <div className="grid gap-2">
                          <Label className="text-sm text-muted-foreground">Date Range</Label>
                          <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">Last 7 days</SelectItem>
                              <SelectItem value="30">Last 30 days</SelectItem>
                              <SelectItem value="90">Last 90 days</SelectItem>
                              <SelectItem value="365">Last year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveReport}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Saved Reports</p>
                  <p className="text-3xl font-bold">{savedReports.length}</p>
                  <p className="text-xs text-violet-600">Custom & templates</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data Sources</p>
                  <p className="text-3xl font-bold">3</p>
                  <p className="text-xs text-blue-600">Employees, Attendance, Depts</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Fields</p>
                  <p className="text-3xl font-bold">{COLUMN_OPTIONS.length}</p>
                  <p className="text-xs text-green-600">For custom reports</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <Settings className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saved Reports */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Saved Reports
            </CardTitle>
            <CardDescription>Your custom reports and templates</CardDescription>
          </CardHeader>
          <CardContent>
            {savedReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No saved reports yet</p>
                <p className="text-sm">Create your first custom report</p>
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
                          <h4 className="font-medium truncate">{report.name}</h4>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {report.columns.length} cols
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {report.description || "No description"}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>
                          Created {formatDateTL(report.createdAt)}
                        </span>
                        {report.lastRun && (
                          <span>
                            Last run {formatDateTL(report.lastRun)}
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
                          Run
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteReport(report.id)}
                        >
                          <Trash2 className="h-3 w-3" />
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-violet-600" />
                    Report Preview
                  </CardTitle>
                  <CardDescription>
                    {previewData.length} records found
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewData(null)}
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
                  <p>No data found matching your criteria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        {previewColumns.map((col) => (
                          <th key={col.key} className="text-left p-3 font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {previewColumns.map((col) => {
                            const value = col.key
                              .split(".")
                              .reduce((obj, key) => obj?.[key], row);
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
                      Showing 20 of {previewData.length} records. Export to see all.
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
