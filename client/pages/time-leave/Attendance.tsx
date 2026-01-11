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

export default function Attendance() {
  const { toast } = useToast();
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
          title: "Error",
          description: "Failed to load attendance data.",
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
      present: { class: "bg-green-100 text-green-800", label: "Present" },
      late: { class: "bg-yellow-100 text-yellow-800", label: "Late" },
      absent: { class: "bg-red-100 text-red-800", label: "Absent" },
      half_day: { class: "bg-orange-100 text-orange-800", label: "Half Day" },
      leave: { class: "bg-blue-100 text-blue-800", label: "On Leave" },
      holiday: { class: "bg-purple-100 text-purple-800", label: "Holiday" },
    };

    const config = configs[status] || { class: "bg-gray-100 text-gray-800", label: status };
    return <Badge className={config.class}>{config.label}</Badge>;
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
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(e => e.id === formData.employeeId);
    if (!employee) {
      toast({
        title: "Error",
        description: "Employee not found.",
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
        title: "Success",
        description: "Attendance marked successfully.",
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
        title: "Error",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Employee Name",
      "Department",
      "Date",
      "Clock In",
      "Clock Out",
      "Regular Hours",
      "Overtime Hours",
      "Late (min)",
      "Status",
    ];

    const rows = filteredRecords.map((record) => [
      record.employeeName,
      record.department,
      record.date,
      record.clockIn || "N/A",
      record.clockOut || "N/A",
      record.regularHours.toFixed(2),
      record.overtimeHours.toFixed(2),
      record.lateMinutes,
      record.status,
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
      title: "Export Complete",
      description: "CSV file has been downloaded.",
    });
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      toast({
        title: "Error",
        description: "Please select a file to import.",
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
          title: "Import Error",
          description: "No valid records found in the file.",
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
        title: "Import Complete",
        description: `${result.stats.success} records imported, ${result.stats.duplicates} duplicates skipped, ${result.stats.errors} errors.`,
      });

      // Reload records
      const updatedRecords = await attendanceService.getAttendanceByDate(selectedDate);
      setAttendanceRecords(updatedRecords);

      setImportFile(null);
      setShowImportDialog(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Error",
        description: "Failed to import attendance data.",
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
      <MainNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
              <p className="text-muted-foreground">
                Track and manage employee attendance
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Attendance Data</DialogTitle>
                    <DialogDescription>
                      Import attendance records from fingerprint device or CSV file
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select File</Label>
                      <Input
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        CSV format: employee_id, date, clock_in, clock_out
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleImportCSV} disabled={importing || !importFile}>
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4 mr-2" />
                          Import
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark Attendance</DialogTitle>
                    <DialogDescription>
                      Record employee check-in and check-out times
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label>Employee *</Label>
                      <Select
                        value={formData.employeeId}
                        onValueChange={(value) => handleInputChange("employeeId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
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
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Clock In *</Label>
                        <Input
                          type="time"
                          value={formData.clockIn}
                          onChange={(e) => handleInputChange("clockIn", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label>Clock Out</Label>
                        <Input
                          type="time"
                          value={formData.clockOut}
                          onChange={(e) => handleInputChange("clockOut", e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder="Optional notes..."
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMarkDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Mark Attendance"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Present</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-muted-foreground">Late</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Rate</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.attendanceRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={handleExportCSV} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Records
              </CardTitle>
              <CardDescription>
                {filteredRecords.length} records for {selectedDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found for this date</p>
                  <p className="text-sm">Mark attendance or import from device</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead className="text-right">Regular</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead>Status</TableHead>
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
    </div>
  );
}
