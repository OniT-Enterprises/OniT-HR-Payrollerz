import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/I18nProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO, seoConfig } from "@/components/SEO";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import {
  useAttendanceByDate,
  useMarkAttendance,
  useAdjustAttendance,
  useDeleteAttendance,
} from "@/hooks/useAttendance";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTL, toDateStringTL, addDaysISO } from "@/lib/dateUtils";
import { exportToCSV } from "@/lib/csvExport";
import {
  computeEntryHours,
  MAX_REASONABLE_ENTRY_HOURS,
} from "@/services/attendanceService";
import MoreDetailsSection from "@/components/MoreDetailsSection";

export default function TimeTracking() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("entries");
  const [selectedDate, setSelectedDate] = useState(() => toDateStringTL(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Real data hooks
  const { data: realEmployees = [], isLoading: empLoading } = useEmployeeDirectory({ status: 'active' });
  const { data: departments = [] } = useDepartments(tenantId);
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceByDate(selectedDate);
  const markAttendanceMutation = useMarkAttendance();
  const adjustAttendanceMutation = useAdjustAttendance();
  const deleteAttendanceMutation = useDeleteAttendance();
  const loading = empLoading || attendanceLoading;

  // Map real employees for dropdowns
  const employees = useMemo(() => realEmployees
    .map(e => ({
      id: e.id!,
      name: `${e.personalInfo.firstName} ${e.personalInfo.lastName}`,
      department: e.jobDetails.department,
      position: e.jobDetails.position,
    })), [realEmployees]);

  // Map attendance records to UI-friendly format
  const timeEntries = useMemo(() => attendanceRecords.map((r) => ({
    id: r.id || '',
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    department: r.department,
    date: r.date,
    clockIn: r.clockIn || '--:--',
    clockOut: r.clockOut || '--:--',
    totalHours: r.totalHours,
    regularHours: r.regularHours,
    overtimeHours: r.overtimeHours,
    status: r.status,
    source: r.source,
    lateMinutes: r.lateMinutes,
    isAdjusted: r.isAdjusted,
    notes: r.notes || '',
  })), [attendanceRecords]);

  // Computed stats from real data
  const totalPresent = useMemo(() =>
    timeEntries.filter(e => e.status === 'present' || e.status === 'late').length,
    [timeEntries]);
  const totalLate = useMemo(() =>
    timeEntries.filter(e => e.status === 'late').length,
    [timeEntries]);
  const totalHoursToday = useMemo(() =>
    timeEntries.reduce((sum, e) => sum + e.totalHours, 0),
    [timeEntries]);

  const [formData, setFormData] = useState({
    employee: "",
    date: selectedDate,
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  const statusStyles: Record<string, { color: string; dot: string }> = {
    present: {
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    late: {
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      dot: "bg-amber-500",
    },
    absent: {
      color: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      dot: "bg-red-500",
    },
    half_day: {
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      dot: "bg-orange-500",
    },
    leave: {
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      dot: "bg-blue-500",
    },
    holiday: {
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      dot: "bg-purple-500",
    },
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: t("timeLeave.attendance.status.present"),
      late: t("timeLeave.attendance.status.late"),
      absent: t("timeLeave.attendance.status.absent"),
      half_day: t("timeLeave.attendance.status.halfDay"),
      leave: t("timeLeave.attendance.status.leave"),
      holiday: t("timeLeave.attendance.status.holiday"),
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const s = statusStyles[status] || { color: "bg-muted text-muted-foreground border border-border", dot: "bg-muted-foreground" };
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", s.color)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
        {getStatusLabel(status)}
      </span>
    );
  };

  const sourceStyles: Record<string, string> = {
    manual: "bg-muted/70 text-muted-foreground border border-border",
    fingerprint: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    mobile_app: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    qr_code: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
    facial: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: t("timeLeave.timeTracking.sources.manual"),
      fingerprint: t("timeLeave.timeTracking.sources.fingerprint"),
      mobile_app: t("timeLeave.timeTracking.sources.mobileApp"),
      qr_code: t("timeLeave.timeTracking.sources.qrCode"),
      facial: t("timeLeave.timeTracking.sources.facial"),
    };
    return labels[source] || source.replace("_", " ");
  };

  const getSourceBadge = (source: string) => (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", sourceStyles[source] || sourceStyles.manual)}>
      {getSourceLabel(source)}
    </span>
  );

  // Pure ISO-string math — identical in every viewer timezone
  const goToPreviousDay = () => setSelectedDate(addDaysISO(selectedDate, -1));
  const goToNextDay = () => setSelectedDate(addDaysISO(selectedDate, 1));

  const todayStr = toDateStringTL(new Date());
  const isToday = selectedDate === todayStr;
  const selectedDateLabel = formatDateTL(selectedDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleInputChange = (
    field: string,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetEntryForm = (date = selectedDate) => {
    setFormData({
      employee: "",
      date,
      clockIn: "",
      clockOut: "",
      notes: "",
    });
  };

  const openAddDialog = (date = selectedDate) => {
    resetEntryForm(date);
    setShowAddDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee || !formData.date) {
      toast({
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    // Catch reversed clock-out typos before they become a 20-hour payroll day
    const preview = computeEntryHours(formData.clockIn, formData.clockOut);
    if (formData.clockIn && formData.clockOut && preview.totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      toast({
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.dialog.tooLong", {
          hours: preview.totalHours.toFixed(1),
        }),
        variant: "destructive",
      });
      return;
    }

    const emp = realEmployees.find(e => e.id === formData.employee);
    try {
      await markAttendanceMutation.mutateAsync({
        employeeId: formData.employee,
        employeeName: emp ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}` : '',
        department: emp?.jobDetails.department || '',
        date: formData.date,
        clockIn: formData.clockIn || "",
        clockOut: formData.clockOut || undefined,
        source: 'manual',
        notes: formData.notes || "",
      });
      toast({
        title: t("timeLeave.timeTracking.toast.successTitle"),
        description: t("timeLeave.timeTracking.toast.successDesc"),
      });

      resetEntryForm(selectedDate);
      setShowAddDialog(false);
    } catch {
      toast({
        title: t("timeLeave.timeTracking.toast.errorTitle"),
        description: t("timeLeave.timeTracking.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  // ── Edit / delete an existing entry (audit-logged adjustment) ──
  const [editEntry, setEditEntry] = useState<{
    id: string;
    employeeName: string;
    date: string;
    clockIn: string;
    clockOut: string;
    reason: string;
  } | null>(null);

  const openEditDialog = (entry: (typeof timeEntries)[number]) => {
    setEditEntry({
      id: entry.id,
      employeeName: entry.employeeName,
      date: entry.date,
      clockIn: entry.clockIn === '--:--' ? '' : entry.clockIn,
      clockOut: entry.clockOut === '--:--' ? '' : entry.clockOut,
      reason: '',
    });
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry) return;

    if (!editEntry.reason.trim()) {
      toast({
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.edit.reasonRequired"),
        variant: "destructive",
      });
      return;
    }

    const preview = computeEntryHours(editEntry.clockIn, editEntry.clockOut);
    if (editEntry.clockIn && editEntry.clockOut && preview.totalHours > MAX_REASONABLE_ENTRY_HOURS) {
      toast({
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.dialog.tooLong", {
          hours: preview.totalHours.toFixed(1),
        }),
        variant: "destructive",
      });
      return;
    }

    try {
      await adjustAttendanceMutation.mutateAsync({
        recordId: editEntry.id,
        adjustments: {
          clockIn: editEntry.clockIn || undefined,
          clockOut: editEntry.clockOut || undefined,
          reason: editEntry.reason.trim(),
          adjustedBy: user?.email || 'unknown',
        },
      });
      toast({
        title: t("timeLeave.timeTracking.toast.successTitle"),
        description: t("timeLeave.timeTracking.edit.adjustSuccess"),
      });
      setEditEntry(null);
    } catch {
      toast({
        title: t("timeLeave.timeTracking.toast.errorTitle"),
        description: t("timeLeave.timeTracking.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async () => {
    if (!editEntry) return;
    try {
      await deleteAttendanceMutation.mutateAsync(editEntry.id);
      toast({
        title: t("timeLeave.timeTracking.toast.successTitle"),
        description: t("timeLeave.timeTracking.edit.deleteSuccess"),
      });
      setEditEntry(null);
    } catch {
      toast({
        title: t("timeLeave.timeTracking.toast.errorTitle"),
        description: t("timeLeave.timeTracking.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  // Apply client-side filters
  const filteredEntries = useMemo(() => {
    let entries = timeEntries;
    if (selectedEmployee !== "all") {
      entries = entries.filter(e => e.employeeId === selectedEmployee);
    }
    if (selectedDepartment !== "all") {
      entries = entries.filter(e => e.department === selectedDepartment);
    }
    return entries;
  }, [timeEntries, selectedEmployee, selectedDepartment]);

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast({
        title: t("timeLeave.timeTracking.toast.exportEmptyTitle"),
        description: t("timeLeave.timeTracking.entries.emptyDescription", { date: selectedDateLabel }),
      });
      return;
    }

    // Export exactly what the table shows (respects active filters)
    const rows = filteredEntries.map((entry) => ({
      ...entry,
      statusLabel: getStatusLabel(entry.status),
      sourceLabel: getSourceLabel(entry.source),
    }));

    exportToCSV(rows, `attendance_${selectedDate}`, [
      { key: "employeeName", label: t("timeLeave.timeTracking.csv.employeeName") },
      { key: "department", label: t("timeLeave.attendance.table.department") },
      { key: "date", label: t("timeLeave.timeTracking.csv.date") },
      { key: "clockIn", label: t("timeLeave.timeTracking.csv.clockIn") },
      { key: "clockOut", label: t("timeLeave.timeTracking.csv.clockOut") },
      { key: "totalHours", label: t("timeLeave.timeTracking.table.totalHours") },
      { key: "overtimeHours", label: t("timeLeave.attendance.table.overtime") },
      { key: "lateMinutes", label: t("timeLeave.attendance.table.late") },
      { key: "statusLabel", label: t("timeLeave.attendance.table.status") },
      { key: "sourceLabel", label: t("timeLeave.timeTracking.table.source") },
      { key: "notes", label: t("timeLeave.timeTracking.dialog.notes") },
    ]);

    toast({
      title: t("timeLeave.timeTracking.toast.exportTitle"),
      description: t("timeLeave.timeTracking.toast.exportDesc"),
    });
  };

  // Pagination (clamp page when filtered results shrink)
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const effectivePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const startIndex = (effectivePage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Department summary for reports tab
  const departmentSummary = useMemo(() => {
    const deptMap = new Map<string, { present: number; late: number; absent: number; totalHours: number }>();
    for (const entry of timeEntries) {
      const dept = entry.department || t("timeLeave.timeTracking.reports.unassigned");
      const current = deptMap.get(dept) || { present: 0, late: 0, absent: 0, totalHours: 0 };
      if (entry.status === 'present') current.present++;
      if (entry.status === 'late') current.late++;
      if (entry.status === 'absent') current.absent++;
      current.totalHours += entry.totalHours;
      deptMap.set(dept, current);
    }
    return Array.from(deptMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [timeEntries, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6">
          <div className="mx-auto max-w-screen-2xl">
            <div className="mb-6">
              <Skeleton className="h-9 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg mb-4" />
            <Skeleton className="h-10 w-64 rounded-lg mb-6" />
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
      <SEO {...seoConfig.timeTracking} />

      <div className="mx-auto max-w-screen-2xl px-6 pt-6 pb-8">
        <PageHeader
          title={t("timeLeave.timeTracking.title")}
          subtitle={t("timeLeave.timeTracking.subtitle")}
          icon={Clock}
          iconColor="text-cyan-500"
          actions={
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={() => openAddDialog()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("timeLeave.timeTracking.entries.logActivity")}
            </Button>
          }
        />
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
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSelectedDate(todayStr)}>
                {t("timeLeave.attendance.actions.today")}
              </Button>
            )}
          </div>
          {/* Inline stats + actions */}
          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            {timeEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mr-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {totalPresent} {t("timeLeave.attendance.status.present")}
                </span>
                {totalLate > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {totalLate} {t("timeLeave.attendance.status.late")}
                  </span>
                )}
                <span className="font-medium text-foreground">
                  {t("timeLeave.timeTracking.stats.totalHours")}: {totalHoursToday.toFixed(1)}h
                </span>
              </div>
            )}
            {/* Primary action button is in PageHeader */}
          </div>
        </div>

        <MoreDetailsSection className="mb-6" title={t("timeLeave.timeTracking.filters.title")}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="h-9 w-full lg:w-[200px] text-sm">
                <SelectValue placeholder={t("timeLeave.timeTracking.filters.allGuards")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeLeave.timeTracking.filters.allGuards")}</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="h-9 w-full lg:w-[200px] text-sm">
                <SelectValue placeholder={t("timeLeave.timeTracking.filters.allDepartments")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeLeave.timeTracking.filters.allDepartments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </MoreDetailsSection>

        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              resetEntryForm(selectedDate);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("timeLeave.timeTracking.dialog.title")}</DialogTitle>
              <DialogDescription>{t("timeLeave.timeTracking.dialog.description")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="employee">{t("timeLeave.timeTracking.dialog.guard")}</Label>
                  <Select value={formData.employee} onValueChange={(value) => handleInputChange("employee", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("timeLeave.timeTracking.dialog.guardPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name} — {emp.department}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="entry-date">{t("timeLeave.timeTracking.dialog.date")}</Label>
                  <Input id="entry-date" type="date" value={formData.date} onChange={(e) => handleInputChange("date", e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="clock-in">{t("timeLeave.timeTracking.dialog.clockIn")}</Label>
                  <TimePicker
                    id="clock-in"
                    value={formData.clockIn}
                    onChange={(v) => handleInputChange("clockIn", v)}
                    placeholder={t("timeLeave.attendance.table.clockIn")}
                  />
                </div>
                <div>
                  <Label htmlFor="clock-out">{t("timeLeave.timeTracking.dialog.clockOut")}</Label>
                  <TimePicker
                    id="clock-out"
                    value={formData.clockOut}
                    onChange={(v) => handleInputChange("clockOut", v)}
                    placeholder={t("timeLeave.attendance.table.clockOut")}
                  />
                </div>
              </div>
              {formData.clockIn && formData.clockOut && (() => {
                const preview = computeEntryHours(formData.clockIn, formData.clockOut);
                const tooLong = preview.totalHours > MAX_REASONABLE_ENTRY_HOURS;
                return (
                  <div className={cn(
                    "text-sm p-2 rounded",
                    tooLong
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tooLong
                      ? t("timeLeave.timeTracking.dialog.tooLong", { hours: preview.totalHours.toFixed(1) })
                      : preview.breakMinutes > 0
                        ? t("timeLeave.timeTracking.dialog.preview", {
                            hours: preview.totalHours.toFixed(1),
                            break: preview.breakMinutes,
                          })
                        : t("timeLeave.timeTracking.dialog.previewNoBreak", {
                            hours: preview.totalHours.toFixed(1),
                          })}
                    {preview.isOvernight && !tooLong && (
                      <span className="ml-1">
                        · {t("timeLeave.timeTracking.dialog.previewOvernight")}
                      </span>
                    )}
                  </div>
                );
              })()}
              <MoreDetailsSection>
                <div>
                  <Label htmlFor="notes">{t("timeLeave.timeTracking.dialog.notes")}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder={t("timeLeave.timeTracking.dialog.notesPlaceholder")}
                    rows={2}
                  />
                </div>
              </MoreDetailsSection>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1">
                  {t("timeLeave.timeTracking.dialog.cancel")}
                </Button>
                <Button type="submit" className="flex-1" disabled={markAttendanceMutation.isPending}>
                  {markAttendanceMutation.isPending ? t("common.saving") : t("timeLeave.timeTracking.dialog.submit")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Entry Dialog — audit-logged adjustment */}
        <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("timeLeave.timeTracking.edit.title")}</DialogTitle>
              <DialogDescription>
                {editEntry && t("timeLeave.timeTracking.edit.description", {
                  name: editEntry.employeeName,
                  date: editEntry.date,
                })}
              </DialogDescription>
            </DialogHeader>
            {editEntry && (
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="edit-clock-in">{t("timeLeave.timeTracking.dialog.clockIn")}</Label>
                    <TimePicker
                      id="edit-clock-in"
                      value={editEntry.clockIn}
                      onChange={(v) => setEditEntry((prev) => prev && { ...prev, clockIn: v })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-clock-out">{t("timeLeave.timeTracking.dialog.clockOut")}</Label>
                    <TimePicker
                      id="edit-clock-out"
                      value={editEntry.clockOut}
                      onChange={(v) => setEditEntry((prev) => prev && { ...prev, clockOut: v })}
                    />
                  </div>
                </div>
                {editEntry.clockIn && editEntry.clockOut && (() => {
                  const preview = computeEntryHours(editEntry.clockIn, editEntry.clockOut);
                  const tooLong = preview.totalHours > MAX_REASONABLE_ENTRY_HOURS;
                  return (
                    <div className={cn(
                      "text-sm p-2 rounded",
                      tooLong
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {tooLong
                        ? t("timeLeave.timeTracking.dialog.tooLong", { hours: preview.totalHours.toFixed(1) })
                        : preview.breakMinutes > 0
                          ? t("timeLeave.timeTracking.dialog.preview", {
                              hours: preview.totalHours.toFixed(1),
                              break: preview.breakMinutes,
                            })
                          : t("timeLeave.timeTracking.dialog.previewNoBreak", {
                              hours: preview.totalHours.toFixed(1),
                            })}
                    </div>
                  );
                })()}
                <div>
                  <Label htmlFor="edit-reason">{t("timeLeave.timeTracking.edit.reason")}</Label>
                  <Textarea
                    id="edit-reason"
                    value={editEntry.reason}
                    onChange={(e) => setEditEntry((prev) => prev && { ...prev, reason: e.target.value })}
                    placeholder={t("timeLeave.timeTracking.edit.reasonPlaceholder")}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="icon" className="shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("timeLeave.timeTracking.edit.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("timeLeave.timeTracking.edit.deleteDesc", {
                            name: editEntry.employeeName,
                            date: editEntry.date,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("timeLeave.timeTracking.dialog.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteEntry}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {t("timeLeave.timeTracking.edit.deleteConfirm")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button type="button" variant="outline" onClick={() => setEditEntry(null)} className="flex-1">
                    {t("timeLeave.timeTracking.dialog.cancel")}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={adjustAttendanceMutation.isPending}>
                    {adjustAttendanceMutation.isPending ? t("common.saving") : t("timeLeave.timeTracking.edit.save")}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="entries">{t("timeLeave.timeTracking.tabs.entries")}</TabsTrigger>
              <TabsTrigger value="daily">{t("timeLeave.timeTracking.tabs.daily")}</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.timeTracking.entries.export")}
            </Button>
          </div>

          {/* ── ENTRIES TAB ── */}
          <TabsContent value="entries">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-4 bg-cyan-500/10 rounded-full w-fit mx-auto mb-4">
                  <Clock className="h-12 w-12 text-cyan-500" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  {t("timeLeave.timeTracking.entries.emptyTitle")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  {t("timeLeave.timeTracking.entries.emptyDescription", { date: selectedDateLabel })}
                </p>
                <Button
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  onClick={() => openAddDialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("timeLeave.timeTracking.entries.logActivity")}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Column headers */}
                <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_80px_80px_80px_100px_28px] gap-3 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span>{t("timeLeave.attendance.table.employee")}</span>
                  <span>{t("timeLeave.attendance.table.clockIn")}</span>
                  <span>{t("timeLeave.attendance.table.clockOut")}</span>
                  <span className="text-right">{t("timeLeave.timeTracking.table.totalHours")}</span>
                  <span className="text-right">{t("timeLeave.attendance.table.overtime")}</span>
                  <span className="text-center">{t("timeLeave.timeTracking.table.source")}</span>
                  <span className="text-right">{t("timeLeave.attendance.table.status")}</span>
                  <span />
                </div>

                {paginatedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditDialog(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditDialog(entry); } }}
                    className={cn(
                      "group rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                    )}
                  >
                    {/* Desktop */}
                    <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_80px_80px_80px_100px_28px] gap-3 items-center px-5 py-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {entry.employeeName}
                          {entry.isAdjusted && (
                            <span className="ml-2 text-[10px] font-normal italic text-muted-foreground">
                              {t("timeLeave.timeTracking.edit.adjusted")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.department}</p>
                      </div>
                      <div>
                        <span className="font-mono text-sm text-foreground">{entry.clockIn}</span>
                        {entry.lateMinutes > 0 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400">
                            +{entry.lateMinutes}m {t("timeLeave.attendance.table.late")}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-sm text-foreground">{entry.clockOut}</span>
                      <span className="font-mono text-sm text-right text-foreground">{entry.totalHours.toFixed(1)}h</span>
                      <span className="font-mono text-sm text-right">
                        {entry.overtimeHours > 0 ? (
                          <span className="text-orange-600 dark:text-orange-400">+{entry.overtimeHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </span>
                      <div className="flex justify-center">{getSourceBadge(entry.source)}</div>
                      <div className="flex justify-end">{getStatusBadge(entry.status)}</div>
                      <PencilLine className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors" />
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {entry.employeeName}
                            {entry.isAdjusted && (
                              <span className="ml-2 text-[10px] font-normal italic text-muted-foreground">
                                {t("timeLeave.timeTracking.edit.adjusted")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.department}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSourceBadge(entry.source)}
                          {getStatusBadge(entry.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono">{entry.clockIn} → {entry.clockOut}</span>
                        <span className="font-mono font-medium text-foreground">{entry.totalHours.toFixed(1)}h</span>
                        {entry.overtimeHours > 0 && (
                          <span className="font-mono text-orange-600 dark:text-orange-400">
                            +{entry.overtimeHours.toFixed(1)}h {t("timeLeave.attendance.table.overtime")}
                          </span>
                        )}
                        {entry.lateMinutes > 0 && (
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            {entry.lateMinutes}m {t("timeLeave.attendance.table.late")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
                      disabled={effectivePage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("common.previous")}
                    </Button>
                    {[...Array(totalPages)].map((_, i) => (
                      <Button
                        key={i + 1}
                        variant={effectivePage === i + 1 ? "default" : "ghost"}
                        size="sm"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(i + 1)}
                      >
                        {i + 1}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
                      disabled={effectivePage === totalPages}
                    >
                      {t("common.next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── DAILY TAB ── */}
          <TabsContent value="daily">
            {timeEntries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="p-4 bg-cyan-500/10 rounded-full w-fit mx-auto mb-4">
                  <Clock className="h-12 w-12 text-cyan-500" />
                </div>
                <p className="text-sm">
                  {t("timeLeave.timeTracking.entries.emptyDescription", { date: selectedDateLabel })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "rounded-lg border border-border/50 bg-card p-4",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground">{entry.employeeName}</p>
                          {getSourceBadge(entry.source)}
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.department}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">{entry.clockIn} → {entry.clockOut}</span>
                          <span className="font-mono font-medium text-foreground">{entry.totalHours.toFixed(1)}h</span>
                          {entry.lateMinutes > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {entry.lateMinutes}m {t("timeLeave.attendance.table.late")}
                            </span>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Department Coverage — inline below daily entries */}
            {departmentSummary.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-foreground mb-3">{t("timeLeave.timeTracking.reports.coverageTitle")}</p>
                <div className="space-y-2">
                  {departmentSummary.map((dept) => {
                    const totalInDept = dept.present + dept.late + dept.absent;
                    return (
                      <div key={dept.name} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card">
                        <div>
                          <p className="font-medium text-sm text-foreground">{dept.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.reports.coverageGuards", { count: totalInDept })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-foreground">{dept.totalHours.toFixed(1)}h</span>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20")}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {dept.present}
                          </span>
                          {dept.late > 0 && (
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20")}>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {dept.late}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
