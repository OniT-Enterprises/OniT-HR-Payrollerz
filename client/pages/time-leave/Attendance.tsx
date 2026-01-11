/**
 * Attendance Page - Timor-Leste Version
 * Track and manage employee attendance with fingerprint import support
 */

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Calendar,
  Filter,
  Plus,
  Download,
  Clock,
  User,
  Grid,
  List,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Timer,
  TrendingUp,
  FileUp,
  Loader2,
} from "lucide-react";
import { employeeService, Employee } from "@/services/employeeService";
import { departmentService, Department } from "@/services/departmentService";
import {
  attendanceService,
  AttendanceRecord,
  AttendanceStatus,
} from "@/services/attendanceService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { SEO, seoConfig } from "@/components/SEO";

export default function Attendance() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [viewMode, setViewMode] = useState<"calendar" | "table">("table");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  // Import data
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [emps, depts, records] = await Promise.all([
          employeeService.getAllEmployees(),
          departmentService.getAllDepartments(),
          attendanceService.getAttendanceByDate(selectedDate),
        ]);

        setEmployees(emps.filter(e => e.status === 'active'));
        setDepartments(depts);
        setAttendanceRecords(records);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: t("timeLeave.attendance.toast.errorTitle"),
          description: t("timeLeave.attendance.toast.loadFailed"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDate, toast]);

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

  const getStatusBadge = (status: AttendanceStatus) => {
    const configs: Record<AttendanceStatus, { class: string; label: string }> = {
      present: {
        class: "bg-green-100 text-green-800",
        label: t("timeLeave.attendance.status.present"),
      },
      late: {
        class: "bg-yellow-100 text-yellow-800",
        label: t("timeLeave.attendance.status.late"),
      },
      absent: {
        class: "bg-red-100 text-red-800",
        label: t("timeLeave.attendance.status.absent"),
      },
      half_day: {
        class: "bg-orange-100 text-orange-800",
        label: t("timeLeave.attendance.status.halfDay"),
      },
      leave: {
        class: "bg-blue-100 text-blue-800",
        label: t("timeLeave.attendance.status.leave"),
      },
      holiday: {
        class: "bg-purple-100 text-purple-800",
        label: t("timeLeave.attendance.status.holiday"),
      },
    };

    const config = configs[status] || { class: "bg-gray-100 text-gray-800", label: status };
    return <Badge className={config.class}>{config.label}</Badge>;
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

    try {
      setSaving(true);

      await attendanceService.markAttendance({
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.jobDetails.department,
        date: formData.date,
        clockIn: formData.clockIn,
        clockOut: formData.clockOut || undefined,
        source: "manual",
        notes: formData.notes || undefined,
      });

      toast({
        title: t("timeLeave.attendance.toast.successTitle"),
        description: t("timeLeave.attendance.toast.successDesc"),
      });

      // Reload records
      const records = await attendanceService.getAttendanceByDate(selectedDate);
      setAttendanceRecords(records);

      setFormData({
        employeeId: "",
        date: new Date().toISOString().split("T")[0],
        clockIn: "",
        clockOut: "",
        notes: "",
      });
      setShowMarkDialog(false);
    } catch (error) {
      toast({
        title: t("timeLeave.attendance.toast.errorTitle"),
        description: t("timeLeave.attendance.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
    const blob = new Blob([csv], { type: "text/csv" });
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
            clockIn: values[clockInIdx] || undefined,
            clockOut: clockOutIdx !== -1 ? values[clockOutIdx] : undefined,
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

      const result = await attendanceService.importFromDevice(records, {
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

      // Reload records
      const updatedRecords = await attendanceService.getAttendanceByDate(selectedDate);
      setAttendanceRecords(updatedRecords);

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
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Table skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4 py-3 border-b">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.attendance} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("timeLeave.attendance.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("timeLeave.attendance.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
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
                    {t("timeLeave.attendance.actions.mark")}
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
                        <Input
                          type="time"
                          value={formData.clockIn}
                          onChange={(e) => handleInputChange("clockIn", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>{t("timeLeave.attendance.mark.clockOut")}</Label>
                        <Input
                          type="time"
                          value={formData.clockOut}
                          onChange={(e) => handleInputChange("clockOut", e.target.value)}
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
                      <Button type="submit" disabled={saving}>
                        {saving ? (
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 -mt-8">
          <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("timeLeave.attendance.stats.total")}
                  </p>
                  <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("timeLeave.attendance.stats.present")}
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.present}</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("timeLeave.attendance.stats.late")}
                  </p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.late}</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("timeLeave.attendance.stats.rate")}
                  </p>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {stats.attendanceRate.toFixed(1)}%
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              {t("timeLeave.attendance.filters.title")}
            </CardTitle>
          </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>{t("timeLeave.attendance.filters.date")}</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("timeLeave.attendance.filters.department")}</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("timeLeave.attendance.filters.allDepartments")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("timeLeave.attendance.filters.allDepartments")}
                      </SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("timeLeave.attendance.filters.status")}</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("timeLeave.attendance.filters.allStatuses")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("timeLeave.attendance.filters.allStatuses")}
                      </SelectItem>
                      <SelectItem value="present">
                        {t("timeLeave.attendance.status.present")}
                      </SelectItem>
                      <SelectItem value="late">
                        {t("timeLeave.attendance.status.late")}
                      </SelectItem>
                      <SelectItem value="absent">
                        {t("timeLeave.attendance.status.absent")}
                      </SelectItem>
                      <SelectItem value="half_day">
                        {t("timeLeave.attendance.status.halfDay")}
                      </SelectItem>
                      <SelectItem value="leave">
                        {t("timeLeave.attendance.status.leave")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("timeLeave.attendance.actions.export")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              {t("timeLeave.attendance.table.title")}
            </CardTitle>
              <CardDescription>
                {t("timeLeave.attendance.table.summary", {
                  count: filteredRecords.length,
                  date: selectedDate,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-cyan-500/10 rounded-full w-fit mx-auto mb-4">
                  <Clock className="h-12 w-12 text-cyan-500" />
                </div>
                <p className="font-medium text-foreground">{t("timeLeave.attendance.empty.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("timeLeave.attendance.empty.description")}
                </p>
              </div>
            ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("timeLeave.attendance.table.employee")}</TableHead>
                      <TableHead>{t("timeLeave.attendance.table.department")}</TableHead>
                      <TableHead>{t("timeLeave.attendance.table.clockIn")}</TableHead>
                      <TableHead>{t("timeLeave.attendance.table.clockOut")}</TableHead>
                      <TableHead className="text-right">
                        {t("timeLeave.attendance.table.regular")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("timeLeave.attendance.table.overtime")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("timeLeave.attendance.table.late")}
                      </TableHead>
                      <TableHead>{t("timeLeave.attendance.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.employeeName}
                        </TableCell>
                        <TableCell>{record.department}</TableCell>
                        <TableCell className="font-mono">
                          {record.clockIn || "-"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {record.clockOut || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.regularHours.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.overtimeHours > 0 ? (
                            <span className="text-orange-600">
                              +{record.overtimeHours.toFixed(1)}h
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.lateMinutes > 0 ? (
                            <span className="text-red-600">
                              {record.lateMinutes}m
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
