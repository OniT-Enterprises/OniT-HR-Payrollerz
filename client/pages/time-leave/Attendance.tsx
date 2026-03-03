/**
 * Attendance Page - Timor-Leste Version
 * Track and manage employee attendance with fingerprint import support
 */

import React, { useState, useMemo, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import {
  Plus,
  Download,
  Clock,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  ScanFace,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";

const FaceClockIn = lazy(() => import("@/components/attendance/FaceClockIn"));
import { useAllEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import {
  useAttendanceByDate,
  useMarkAttendance,
  attendanceKeys,
} from "@/hooks/useAttendance";
import { type Employee } from "@/services/employeeService";
import {
  attendanceService,
  type AttendanceStatus,
} from "@/services/attendanceService";
import { SEO, seoConfig } from "@/components/SEO";
import { getTodayTL, formatDateTL } from "@/lib/dateUtils";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { timeLeaveNavConfig } from "@/lib/moduleNav";

export default function Attendance() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  // Today's date as default
  const today = getTodayTL();
  const [selectedDate, setSelectedDate] = useState(today);
  const [_viewMode, _setViewMode] = useState<"calendar" | "table">("table");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFaceClockIn, setShowFaceClockIn] = useState(false);

  // Is today selected?
  const isToday = selectedDate === today;

  // Data fetching via React Query
  const employeesQuery = useAllEmployees();
  const deptQuery = useDepartments(tenantId);
  const attendanceQuery = useAttendanceByDate(selectedDate);
  const markAttendanceMutation = useMarkAttendance();

  const loading = employeesQuery.isLoading || deptQuery.isLoading || attendanceQuery.isLoading;
  const employees = useMemo(
    () => (employeesQuery.data ?? []).filter((e: Employee) => e.status === 'active'),
    [employeesQuery.data]
  );
  const departments = deptQuery.data ?? [];
  const attendanceRecords = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);

  // Form data
  const [formData, setFormData] = useState({
    employeeId: "",
    date: getTodayTL(),
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  // Import data
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Format date for display
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = formatDateTL(date, { weekday: 'long' });
    const monthDay = formatDateTL(date, { month: 'short', day: 'numeric' });
    return `${dayName}, ${monthDay}`;
  };

  const goToPreviousDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const present = attendanceRecords.filter(
      r => r.status === 'present' || r.status === 'late'
    ).length;
    const late = attendanceRecords.filter(r => r.status === 'late').length;
    const absent = totalEmployees - present;
    const onLeave = attendanceRecords.filter(r => r.status === 'leave').length;
    const attendanceRate = totalEmployees > 0 ? (present / totalEmployees) * 100 : 0;
    const totalOvertimeHours = attendanceRecords.reduce((sum, r) => sum + r.overtimeHours, 0);

    return {
      totalEmployees,
      present,
      late,
      absent,
      onLeave,
      attendanceRate,
      totalOvertimeHours,
    };
  }, [employees, attendanceRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      if (selectedDepartment !== "all" && record.department !== selectedDepartment) {
        return false;
      }
      if (selectedStatus !== "all" && record.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedDepartment, selectedStatus]);

  const statusConfig: Record<AttendanceStatus, { color: string; dot: string; label: string }> = {
    present: {
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dot: "bg-emerald-500",
      label: t("timeLeave.attendance.status.present"),
    },
    late: {
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      dot: "bg-amber-500",
      label: t("timeLeave.attendance.status.late"),
    },
    absent: {
      color: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      dot: "bg-red-500",
      label: t("timeLeave.attendance.status.absent"),
    },
    half_day: {
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      dot: "bg-orange-500",
      label: t("timeLeave.attendance.status.halfDay"),
    },
    leave: {
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      dot: "bg-blue-500",
      label: t("timeLeave.attendance.status.leave"),
    },
    holiday: {
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      dot: "bg-purple-500",
      label: t("timeLeave.attendance.status.holiday"),
    },
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const cfg = statusConfig[status] || { color: "bg-muted text-muted-foreground border border-border", dot: "bg-muted-foreground", label: status };
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
        {cfg.label}
      </span>
    );
  };

  const getStatusDotColor = (status: AttendanceStatus) => {
    return statusConfig[status]?.dot || "bg-muted-foreground";
  };

  const getStatusBorderColor = (status: AttendanceStatus) => {
    const map: Record<string, string> = {
      present: "border-l-emerald-500",
      late: "border-l-amber-500",
      absent: "border-l-red-500",
      half_day: "border-l-orange-500",
      leave: "border-l-blue-500",
      holiday: "border-l-purple-500",
    };
    return map[status] || "border-l-muted-foreground";
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return t("timeLeave.attendance.status.present");
      case "late":
        return t("timeLeave.attendance.status.late");
      case "absent":
        return t("timeLeave.attendance.status.absent");
      case "half_day":
        return t("timeLeave.attendance.status.halfDay");
      case "leave":
        return t("timeLeave.attendance.status.leave");
      case "holiday":
        return t("timeLeave.attendance.status.holiday");
      default:
        return status;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.date || !formData.clockIn) {
      toast({
        title: t("timeLeave.attendance.toast.validationTitle"),
        description: t("timeLeave.attendance.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(e => e.id === formData.employeeId);
    if (!employee) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.employeeNotFound"),
        variant: "destructive",
      });
      return;
    }

    markAttendanceMutation.mutate(
      {
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.jobDetails.department,
        date: formData.date,
        clockIn: formData.clockIn,
        clockOut: formData.clockOut || undefined,
        source: "manual",
        notes: formData.notes || "",
      },
      {
        onSuccess: () => {
          toast({
            title: t("timeLeave.attendance.toast.successTitle"),
            description: t("timeLeave.attendance.toast.successDesc"),
          });
          setFormData({
            employeeId: "",
            date: getTodayTL(),
            clockIn: "",
            clockOut: "",
            notes: "",
          });
          setShowMarkDialog(false);
        },
        onError: () => {
          toast({
            title: t("timeLeave.attendance.toast.errorTitle"),
            description: t("timeLeave.attendance.toast.saveFailed"),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleExportCSV = () => {
    const headers = [
      t("timeLeave.attendance.csv.employeeName"),
      t("timeLeave.attendance.csv.department"),
      t("timeLeave.attendance.csv.date"),
      t("timeLeave.attendance.csv.clockIn"),
      t("timeLeave.attendance.csv.clockOut"),
      t("timeLeave.attendance.csv.regularHours"),
      t("timeLeave.attendance.csv.overtimeHours"),
      t("timeLeave.attendance.csv.lateMinutes"),
      t("timeLeave.attendance.csv.status"),
    ];

    const rows = filteredRecords.map((record) => [
      record.employeeName,
      record.department,
      record.date,
      record.clockIn || t("timeLeave.attendance.csv.notAvailable"),
      record.clockOut || t("timeLeave.attendance.csv.notAvailable"),
      record.regularHours.toFixed(2),
      record.overtimeHours.toFixed(2),
      record.lateMinutes,
      getStatusLabel(record.status),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("timeLeave.attendance.toast.exportTitle"),
      description: t("timeLeave.attendance.toast.exportDesc"),
    });
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.importSelect"),
        variant: "destructive",
      });
      return;
    }

    try {
      setImporting(true);

      // Parse CSV file
      const text = await importFile.text();
      const lines = text.split("\n").filter(line => line.trim());
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

      const records: {
        employeeId: string;
        employeeName: string;
        department: string;
        date: string;
        clockIn?: string;
        clockOut?: string;
      }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());

        // Try to find employee by ID or name
        const employeeIdIdx = headers.indexOf("employee_id") || headers.indexOf("employeeid");
        const nameIdx = headers.indexOf("name") || headers.indexOf("employee_name");
        const dateIdx = headers.indexOf("date");
        const clockInIdx = headers.indexOf("clock_in") || headers.indexOf("clockin") || headers.indexOf("check_in");
        const clockOutIdx = headers.indexOf("clock_out") || headers.indexOf("clockout") || headers.indexOf("check_out");

        if (dateIdx === -1 || clockInIdx === -1) continue;

        // Find employee
        let employee: Employee | undefined;
        if (employeeIdIdx !== -1) {
          employee = employees.find(e => e.id === values[employeeIdIdx] || e.jobDetails.employeeId === values[employeeIdIdx]);
        }
        if (!employee && nameIdx !== -1) {
          const name = values[nameIdx].toLowerCase();
          employee = employees.find(e =>
            `${e.personalInfo.firstName} ${e.personalInfo.lastName}`.toLowerCase() === name
          );
        }

        if (employee) {
          records.push({
            employeeId: employee.id!,
            employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            department: employee.jobDetails.department,
            date: values[dateIdx],
            clockIn: values[clockInIdx] || "",
            clockOut: clockOutIdx !== -1 ? (values[clockOutIdx] || "") : "",
          });
        }
      }

      if (records.length === 0) {
        toast({
          title: t("timeLeave.attendance.toast.importErrorTitle"),
          description: t("timeLeave.attendance.toast.importEmpty"),
          variant: "destructive",
        });
        return;
      }

      const result = await attendanceService.importFromDevice(tenantId, records, {
        fileName: importFile.name,
        deviceType: "other",
        importedBy: "current_user", // Would get from auth context
      });

      toast({
        title: t("timeLeave.attendance.toast.importCompleteTitle"),
        description: t("timeLeave.attendance.toast.importCompleteDesc", {
          success: result.stats.success,
          duplicates: result.stats.duplicates,
          errors: result.stats.errors,
        }),
      });

      // Invalidate attendance queries to refetch
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all(tenantId) });

      setImportFile(null);
      setShowImportDialog(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: t("timeLeave.attendance.toast.importErrorTitle"),
        description: t("timeLeave.attendance.toast.importFailed"),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <AutoBreadcrumb className="mb-6" />
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <Skeleton className="h-9 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg mb-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.attendance} />
      <MainNavigation />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {isToday ? t("timeLeave.attendance.titleToday") : t("timeLeave.attendance.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isToday ? (
                    <>
                      {formatDateLabel(selectedDate)}
                      <span className="text-muted-foreground/70"> · {t("timeLeave.attendance.payrollHint")}</span>
                    </>
                  ) : (
                    formatDateLabel(selectedDate)
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFaceClockIn(true)}
              >
                <ScanFace className="h-4 w-4 mr-2" />
                Face Clock-In
              </Button>
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    {t("timeLeave.attendance.actions.import")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t("timeLeave.attendance.import.title")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("timeLeave.attendance.import.description")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{t("timeLeave.attendance.import.selectFile")}</Label>
                      <Input
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("timeLeave.attendance.import.format")}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                      {t("timeLeave.attendance.actions.cancel")}
                    </Button>
                    <Button onClick={handleImportCSV} disabled={importing || !importFile}>
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("timeLeave.attendance.import.importing")}
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4 mr-2" />
                          {t("timeLeave.attendance.actions.import")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600">
                    <Plus className="h-4 w-4 mr-2" />
                    {isToday ? t("timeLeave.attendance.actions.markToday") : t("timeLeave.attendance.actions.mark")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t("timeLeave.attendance.mark.title")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("timeLeave.attendance.mark.description")}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label>{t("timeLeave.attendance.mark.employee")}</Label>
                      <Select
                        value={formData.employeeId}
                        onValueChange={(value) => handleInputChange("employeeId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.attendance.mark.employeePlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id!}>
                              {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("timeLeave.attendance.mark.date")}</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t("timeLeave.attendance.mark.clockIn")}</Label>
                        <TimePicker
                          value={formData.clockIn}
                          onChange={(v) => handleInputChange("clockIn", v)}
                          placeholder="Clock in"
                          required
                        />
                      </div>
                      <div>
                        <Label>{t("timeLeave.attendance.mark.clockOut")}</Label>
                        <TimePicker
                          value={formData.clockOut}
                          onChange={(v) => handleInputChange("clockOut", v)}
                          placeholder="Clock out"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{t("timeLeave.attendance.mark.notes")}</Label>
                      <Input
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder={t("timeLeave.attendance.mark.notesPlaceholder")}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMarkDialog(false)}
                      >
                        {t("timeLeave.attendance.actions.cancel")}
                      </Button>
                      <Button type="submit" disabled={markAttendanceMutation.isPending}>
                        {markAttendanceMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t("timeLeave.attendance.mark.saving")}
                          </>
                        ) : (
                          t("timeLeave.attendance.actions.mark")
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 pb-8">
        {/* Inline Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-[160px] text-sm"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSelectedDate(today)}>
                {t("timeLeave.attendance.actions.today") || "Today"}
              </Button>
            )}
          </div>

          <div className="hidden lg:block h-6 w-px bg-border" />

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder={t("timeLeave.attendance.filters.allDepartments")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeLeave.attendance.filters.allDepartments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder={t("timeLeave.attendance.filters.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeLeave.attendance.filters.allStatuses")}</SelectItem>
                <SelectItem value="present">{t("timeLeave.attendance.status.present")}</SelectItem>
                <SelectItem value="late">{t("timeLeave.attendance.status.late")}</SelectItem>
                <SelectItem value="absent">{t("timeLeave.attendance.status.absent")}</SelectItem>
                <SelectItem value="half_day">{t("timeLeave.attendance.status.halfDay")}</SelectItem>
                <SelectItem value="leave">{t("timeLeave.attendance.status.leave")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.attendance.actions.export")}
            </Button>
          </div>

          {/* Inline Stats */}
          {attendanceRecords.length > 0 && (
            <>
              <div className="hidden lg:block h-6 w-px bg-border" />
              <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {stats.present} {t("timeLeave.attendance.status.present")}
                </span>
                {stats.late > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {stats.late} {t("timeLeave.attendance.status.late")}
                  </span>
                )}
                {stats.absent > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    {stats.absent} {t("timeLeave.attendance.status.absent")}
                  </span>
                )}
                <span className="font-medium text-foreground">
                  {stats.attendanceRate.toFixed(0)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Attendance Records */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-cyan-500/10 rounded-full w-fit mx-auto mb-4">
              <Clock className="h-12 w-12 text-cyan-500" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">
              {isToday ? t("timeLeave.attendance.empty.titleToday") : t("timeLeave.attendance.empty.title")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {t("timeLeave.attendance.empty.instructions")}
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t("timeLeave.attendance.empty.importButton")}
              </Button>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
                onClick={() => setShowMarkDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isToday ? t("timeLeave.attendance.actions.markToday") : t("timeLeave.attendance.actions.mark")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("timeLeave.attendance.table.employee")}</span>
              <span>{t("timeLeave.attendance.table.clockIn")}</span>
              <span>{t("timeLeave.attendance.table.clockOut")}</span>
              <span className="text-right">{t("timeLeave.attendance.table.regular")}</span>
              <span className="text-right">{t("timeLeave.attendance.table.overtime")}</span>
              <span className="text-right">{t("timeLeave.attendance.table.late")}</span>
              <span className="text-right">{t("timeLeave.attendance.table.status")}</span>
            </div>

            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className={cn(
                  "group rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors",
                  "border-l-[3px]",
                  getStatusBorderColor(record.status),
                )}
              >
                {/* Desktop layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_80px_80px_80px_100px] gap-3 items-center px-5 py-3">
                  <div>
                    <p className="font-medium text-sm text-foreground">{record.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{record.department}</p>
                  </div>
                  <span className="font-mono text-sm text-foreground">{record.clockIn || "—"}</span>
                  <span className="font-mono text-sm text-foreground">{record.clockOut || "—"}</span>
                  <span className="font-mono text-sm text-right text-foreground">{record.regularHours.toFixed(1)}h</span>
                  <span className="font-mono text-sm text-right">
                    {record.overtimeHours > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">+{record.overtimeHours.toFixed(1)}h</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="font-mono text-sm text-right">
                    {record.lateMinutes > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{record.lateMinutes}m</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <div className="flex justify-end">{getStatusBadge(record.status)}</div>
                </div>

                {/* Mobile layout */}
                <div className="md:hidden px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">{record.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{record.department}</p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono">{record.clockIn || "—"} → {record.clockOut || "—"}</span>
                    <span className="font-mono font-medium text-foreground">{record.regularHours.toFixed(1)}h</span>
                    {record.overtimeHours > 0 && (
                      <span className="font-mono text-orange-600 dark:text-orange-400">+{record.overtimeHours.toFixed(1)}h OT</span>
                    )}
                    {record.lateMinutes > 0 && (
                      <span className="font-mono text-red-600 dark:text-red-400">{record.lateMinutes}m late</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Face Clock-In Dialog (lazy loaded) */}
      {showFaceClockIn && (
        <Suspense fallback={null}>
          <FaceClockIn
            open={showFaceClockIn}
            onOpenChange={setShowFaceClockIn}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: attendanceKeys.byDate(tenantId, selectedDate) });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
