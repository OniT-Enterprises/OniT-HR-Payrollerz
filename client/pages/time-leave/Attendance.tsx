/**
 * Attendance Page - Timor-Leste Version
 * Track and manage employee attendance with fingerprint import support
 */

import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/components/ui/time-picker";

import { useEmployeeDirectory } from "@/hooks/useEmployees";
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
import MoreDetailsSection from "@/components/MoreDetailsSection";

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

  // Is today selected?
  const isToday = selectedDate === today;

  // Data fetching via React Query
  const employeesQuery = useEmployeeDirectory({ status: 'active' });
  const deptQuery = useDepartments(tenantId);
  const attendanceQuery = useAttendanceByDate(selectedDate);
  const markAttendanceMutation = useMarkAttendance();

  const loading = employeesQuery.isLoading || deptQuery.isLoading || attendanceQuery.isLoading;
  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data]
  );
  const departments = deptQuery.data ?? [];
  const attendanceRecords = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);

  // Form data
  const [formData, setFormData] = useState({
    employeeId: "",
    date: selectedDate,
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

  const resetMarkForm = (date = selectedDate) => {
    setFormData({
      employeeId: "",
      date,
      clockIn: "",
      clockOut: "",
      notes: "",
    });
  };

  const openMarkDialog = (date = selectedDate) => {
    resetMarkForm(date);
    setShowMarkDialog(true);
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
          resetMarkForm(selectedDate);
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
      const getHeaderIndex = (...aliases: string[]) =>
        headers.findIndex((header) => aliases.includes(header));

      const records: {
        employeeId: string;
        employeeName: string;
        department: string;
        date: string;
        clockIn?: string;
        clockOut?: string;
      }[] = [];

      // Build lookup maps once so CSV import is O(rows + employees), not O(rows * employees)
      const employeesById = new Map<string, Employee>();
      const employeesByJobId = new Map<string, Employee>();
      const employeesByName = new Map<string, Employee>();
      for (const emp of employees) {
        if (emp.id) employeesById.set(emp.id, emp);
        if (emp.jobDetails?.employeeId) employeesByJobId.set(emp.jobDetails.employeeId, emp);
        const fullName = `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase();
        employeesByName.set(fullName, emp);
      }

      const employeeIdIdx = getHeaderIndex("employee_id", "employeeid");
      const nameIdx = getHeaderIndex("name", "employee_name");
      const dateIdx = getHeaderIndex("date");
      const clockInIdx = getHeaderIndex("clock_in", "clockin", "check_in");
      const clockOutIdx = getHeaderIndex("clock_out", "clockout", "check_out");

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());

        if (dateIdx === -1 || clockInIdx === -1) continue;

        // Find employee
        let employee: Employee | undefined;
        if (employeeIdIdx !== -1) {
          const key = values[employeeIdIdx];
          employee = employeesById.get(key) || employeesByJobId.get(key);
        }
        if (!employee && nameIdx !== -1) {
          employee = employeesByName.get(values[nameIdx].toLowerCase());
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
          <div className="mx-auto max-w-screen-2xl">
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

      <div className="mx-auto max-w-screen-2xl px-6 pt-6 pb-8">
        <PageHeader
          title={isToday ? t("timeLeave.attendance.titleToday") : t("timeLeave.attendance.title")}
          subtitle={isToday ? (
            <>
              {formatDateLabel(selectedDate)}
              <span className="text-muted-foreground/70"> · {t("timeLeave.attendance.payrollHint")}</span>
            </>
          ) : (
            formatDateLabel(selectedDate)
          )}
          icon={Clock}
          iconColor="text-cyan-500"
          actions={
            <>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t("timeLeave.attendance.actions.import")}
              </Button>
              <Button onClick={() => openMarkDialog()} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                {isToday ? t("timeLeave.attendance.actions.markToday") : t("timeLeave.attendance.actions.mark")}
              </Button>
            </>
          }
        />

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
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

        {/* Mark Attendance Dialog */}
        <Dialog
          open={showMarkDialog}
          onOpenChange={(open) => {
            setShowMarkDialog(open);
            if (!open) {
              resetMarkForm(selectedDate);
            }
          }}
        >
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
              <MoreDetailsSection>
                <div>
                  <Label>{t("timeLeave.attendance.mark.notes")}</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder={t("timeLeave.attendance.mark.notesPlaceholder")}
                  />
                </div>
              </MoreDetailsSection>
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
        {/* Inline Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          {/* Date navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              {t("common.previous")}
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-[180px] text-sm"
            />
            <Button variant="outline" size="sm" className="h-9" onClick={goToNextDay}>
              {t("common.next")}
              <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSelectedDate(today)}>
                {t("timeLeave.attendance.actions.today") || "Today"}
              </Button>
            )}
          </div>

          {/* Inline Stats */}
          {attendanceRecords.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto text-xs text-muted-foreground">
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
          )}
        </div>

        <MoreDetailsSection className="mb-6" title={t("timeLeave.attendance.filters.title")}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="h-9 w-full lg:w-[180px] text-sm">
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
              <SelectTrigger className="h-9 w-full lg:w-[160px] text-sm">
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
            <Button variant="outline" size="sm" className="h-9 lg:ml-auto" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.attendance.actions.export")}
            </Button>
          </div>
        </MoreDetailsSection>

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
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => openMarkDialog()}
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

    </div>
  );
}
