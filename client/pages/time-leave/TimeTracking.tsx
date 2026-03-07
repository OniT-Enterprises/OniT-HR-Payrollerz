import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Plus,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEO, seoConfig } from "@/components/SEO";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import { useAttendanceByDate, useMarkAttendance } from "@/hooks/useAttendance";
import { useTenantId } from "@/contexts/TenantContext";
import { formatDateTL, toDateStringTL } from "@/lib/dateUtils";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import MoreDetailsSection from "@/components/MoreDetailsSection";

export default function TimeTracking() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
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

  const statusStyles: Record<string, { color: string; dot: string; border: string }> = {
    present: {
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      dot: "bg-emerald-500",
      border: "border-l-emerald-500",
    },
    late: {
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      dot: "bg-amber-500",
      border: "border-l-amber-500",
    },
    absent: {
      color: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      dot: "bg-red-500",
      border: "border-l-red-500",
    },
    half_day: {
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
      dot: "bg-orange-500",
      border: "border-l-orange-500",
    },
    leave: {
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      dot: "bg-blue-500",
      border: "border-l-blue-500",
    },
    holiday: {
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      dot: "bg-purple-500",
      border: "border-l-purple-500",
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

  const handleExportCSV = () => {
    // Build CSV from real data
    const csvHeaders = [
      t("timeLeave.timeTracking.csv.employeeName"),
      t("timeLeave.timeTracking.csv.date"),
      t("timeLeave.timeTracking.csv.clockIn"),
      t("timeLeave.timeTracking.csv.clockOut"),
      t("timeLeave.timeTracking.table.totalHours"),
      t("timeLeave.attendance.table.status"),
      t("timeLeave.timeTracking.table.source"),
    ];

    const csvRows = timeEntries.map((entry) => [
      entry.employeeName,
      entry.date,
      entry.clockIn,
      entry.clockOut,
      entry.totalHours.toString(),
      getStatusLabel(entry.status),
      getSourceLabel(entry.source),
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("timeLeave.timeTracking.toast.exportTitle"),
      description: t("timeLeave.timeTracking.toast.exportDesc"),
    });
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
      const dept = entry.department || 'Unassigned';
      const current = deptMap.get(dept) || { present: 0, late: 0, absent: 0, totalHours: 0 };
      if (entry.status === 'present') current.present++;
      if (entry.status === 'late') current.late++;
      if (entry.status === 'absent') current.absent++;
      current.totalHours += entry.totalHours;
      deptMap.set(dept, current);
    }
    return Array.from(deptMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [timeEntries]);

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
      <MainNavigation />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("timeLeave.timeTracking.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("timeLeave.timeTracking.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 pb-8">
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
                  {t("timeLeave.timeTracking.stats.totalHours")}: {totalHoursToday.toFixed(0)}h
                </span>
              </div>
            )}
            <Button
              size="sm"
              className="h-9 bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
              onClick={() => openAddDialog()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.timeTracking.entries.logActivity")}
            </Button>
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
            <Button variant="outline" size="sm" className="h-9 lg:ml-auto" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("timeLeave.timeTracking.entries.export")}
            </Button>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="entries">{t("timeLeave.timeTracking.tabs.entries")}</TabsTrigger>
            <TabsTrigger value="daily">{t("timeLeave.timeTracking.tabs.daily")}</TabsTrigger>
            <TabsTrigger value="reports">{t("timeLeave.timeTracking.tabs.reports")}</TabsTrigger>
          </TabsList>

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
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
                  onClick={() => openAddDialog()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("timeLeave.timeTracking.entries.logActivity")}
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Column headers */}
                <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_80px_80px_80px_100px] gap-3 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span>{t("timeLeave.attendance.table.employee")}</span>
                  <span>{t("timeLeave.attendance.table.clockIn")}</span>
                  <span>{t("timeLeave.attendance.table.clockOut")}</span>
                  <span className="text-right">{t("timeLeave.timeTracking.table.totalHours")}</span>
                  <span className="text-right">{t("timeLeave.attendance.table.overtime")}</span>
                  <span className="text-center">{t("timeLeave.timeTracking.table.source")}</span>
                  <span className="text-right">{t("timeLeave.attendance.table.status")}</span>
                </div>

                {paginatedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "group rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors",
                      "border-l-[3px]",
                      statusStyles[entry.status]?.border || "border-l-muted-foreground",
                    )}
                  >
                    {/* Desktop */}
                    <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_80px_80px_80px_100px] gap-3 items-center px-5 py-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">{entry.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{entry.department}</p>
                      </div>
                      <span className="font-mono text-sm text-foreground">{entry.clockIn}</span>
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
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">{entry.employeeName}</p>
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
                {timeEntries.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "rounded-lg border border-border/50 bg-card p-4",
                      "border-l-[3px]",
                      statusStyles[entry.status]?.border || "border-l-muted-foreground",
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
          </TabsContent>

          {/* ── REPORTS TAB ── */}
          <TabsContent value="reports">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Export options */}
              <Card className="border-border/50">
                <CardContent className="p-5 space-y-3">
                  <p className="text-sm font-medium text-foreground mb-3">{t("timeLeave.timeTracking.reports.exportTitle")}</p>
                  <Button onClick={handleExportCSV} variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    {t("timeLeave.timeTracking.reports.exportTimesheet")}
                  </Button>
                  <Button
                    onClick={() => toast({ title: t("timeLeave.timeTracking.toast.reportTitle"), description: t("timeLeave.timeTracking.toast.reportClientBilling") })}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    {t("timeLeave.timeTracking.reports.clientBilling")}
                  </Button>
                  <Button
                    onClick={() => toast({ title: t("timeLeave.timeTracking.toast.reportTitle"), description: t("timeLeave.timeTracking.toast.reportPerformance") })}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t("timeLeave.timeTracking.reports.guardPerformance")}
                  </Button>
                </CardContent>
              </Card>

              {/* Department summary */}
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-foreground mb-3">{t("timeLeave.timeTracking.reports.coverageTitle")}</p>
                  {departmentSummary.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">{t("timeLeave.timeTracking.reports.noDepartmentData")}</p>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
