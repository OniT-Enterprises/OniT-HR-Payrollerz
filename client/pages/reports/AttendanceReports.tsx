import React, { useState, useMemo } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { attendanceService } from "@/services/attendanceService";
import { leaveService } from "@/services/leaveService";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Clock,
  Download,
  CalendarDays,
  Timer,
  AlertTriangle,
  UserCheck,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";

export default function AttendanceReports() {
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  // Calculate date range for queries
  const dateParams = useMemo(() => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange, 10));
    return {
      startDate: toDateStringTL(startDate),
      endDate: toDateStringTL(today),
    };
  }, [dateRange]);

  // Fetch employees with React Query hook
  const { data: employees = [], isLoading: empsLoading } = useAllEmployees(500);

  // Fetch attendance data with React Query
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', dateParams.startDate, dateParams.endDate],
    queryFn: () => attendanceService.getAttendanceByDateRange(tenantId, dateParams.startDate, dateParams.endDate),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch leave requests with React Query
  const { data: leaveRequests = [], isLoading: leaveLoading } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: () => leaveService.getLeaveRequests(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch leave balances with React Query
  const { data: leaveBalances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['leaveBalances'],
    queryFn: () => leaveService.getAllBalances(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const loading = empsLoading || attendanceLoading || leaveLoading || balancesLoading;

  // Calculate stats
  const totalRecords = attendanceRecords.length;
  const presentRecords = useMemo(() => attendanceRecords.filter(
    (r) => r.status === "present" || r.status === "late"
  ), [attendanceRecords]);
  const lateRecords = useMemo(() => attendanceRecords.filter((r) => r.status === "late"), [attendanceRecords]);
  const totalOvertimeHours = useMemo(() => attendanceRecords.reduce(
    (sum, r) => sum + (r.overtimeHours || 0),
    0
  ), [attendanceRecords]);
  const totalLateMinutes = useMemo(() => attendanceRecords.reduce(
    (sum, r) => sum + (r.lateMinutes || 0),
    0
  ), [attendanceRecords]);

  // Get today's status
  const todayOnLeave = useMemo(() => {
    const today = getTodayTL();
    return leaveRequests.filter(
      (r) =>
        r.status === "approved" &&
        r.startDate <= today &&
        r.endDate >= today
    );
  }, [leaveRequests]);

  // Attendance by status
  const statusBreakdown = useMemo(() => attendanceRecords.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [attendanceRecords]);

  // Leave by type
  const leaveByType = useMemo(() => leaveRequests
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => {
      acc[r.leaveType] = (acc[r.leaveType] || 0) + r.duration;
      return acc;
    }, {} as Record<string, number>), [leaveRequests]);

  // Export to CSV
  const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((item) =>
      columns
        .map((c) => {
          const value = c.key.split(".").reduce((obj, key) => obj?.[key], item);
          const strValue = String(value ?? "").replace(/,/g, ";");
          return `"${strValue}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${getTodayTL()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: `${filename}.csv downloaded successfully`,
    });
  };

  const exportAttendance = () => {
    exportToCSV(attendanceRecords, "attendance_report", [
      { key: "date", label: "Date" },
      { key: "employeeName", label: "Employee Name" },
      { key: "department", label: "Department" },
      { key: "clockIn", label: "Clock In" },
      { key: "clockOut", label: "Clock Out" },
      { key: "regularHours", label: "Regular Hours" },
      { key: "overtimeHours", label: "Overtime Hours" },
      { key: "lateMinutes", label: "Late Minutes" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
    ]);
  };

  const exportLeaveBalances = () => {
    const balanceData = leaveBalances.map((b) => ({
      employeeName: b.employeeName,
      annualEntitled: b.annual?.entitled || 0,
      annualUsed: b.annual?.used || 0,
      annualRemaining: b.annual?.remaining || 0,
      sickEntitled: b.sick?.entitled || 0,
      sickUsed: b.sick?.used || 0,
      sickRemaining: b.sick?.remaining || 0,
      carryOver: b.carryOver || 0,
    }));
    exportToCSV(balanceData, "leave_balances", [
      { key: "employeeName", label: "Employee Name" },
      { key: "annualEntitled", label: "Annual Entitled" },
      { key: "annualUsed", label: "Annual Used" },
      { key: "annualRemaining", label: "Annual Remaining" },
      { key: "sickEntitled", label: "Sick Entitled" },
      { key: "sickUsed", label: "Sick Used" },
      { key: "sickRemaining", label: "Sick Remaining" },
      { key: "carryOver", label: "Carry Over" },
    ]);
  };

  const exportOvertime = () => {
    const overtimeRecords = attendanceRecords.filter((r) => r.overtimeHours > 0);
    exportToCSV(overtimeRecords, "overtime_report", [
      { key: "date", label: "Date" },
      { key: "employeeName", label: "Employee Name" },
      { key: "department", label: "Department" },
      { key: "regularHours", label: "Regular Hours" },
      { key: "overtimeHours", label: "Overtime Hours" },
      { key: "totalHours", label: "Total Hours" },
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <AutoBreadcrumb className="mb-6" />
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

  const attendanceRate = totalRecords > 0
    ? ((presentRecords.length / totalRecords) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.attendanceReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("reports.attendance.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("reports.attendance.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                  <p className="text-3xl font-bold">{attendanceRate}%</p>
                  <p className="text-xs text-green-600">
                    {presentRecords.length} of {totalRecords} records
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Late Arrivals</p>
                  <p className="text-3xl font-bold">{lateRecords.length}</p>
                  <p className="text-xs text-orange-600">
                    {Math.round(totalLateMinutes / 60)} hours total
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overtime Hours</p>
                  <p className="text-3xl font-bold">{totalOvertimeHours.toFixed(1)}</p>
                  <p className="text-xs text-blue-600">
                    {attendanceRecords.filter((r) => r.overtimeHours > 0).length} employees
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <Timer className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">On Leave Today</p>
                  <p className="text-3xl font-bold">{todayOnLeave.length}</p>
                  <p className="text-xs text-purple-600">
                    {employees.length > 0
                      ? ((todayOnLeave.length / employees.length) * 100).toFixed(0)
                      : 0}% of staff
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                  <CalendarDays className="h-6 w-6 text-white" />
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
                <Clock className="h-5 w-5 text-violet-600" />
                Attendance Summary
              </CardTitle>
              <CardDescription>Daily attendance records for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Records</span>
                  <span className="font-medium">{totalRecords}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Present</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {statusBreakdown.present || 0}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Late</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    {statusBreakdown.late || 0}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Absent</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    {statusBreakdown.absent || 0}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportAttendance}>
                <Download className="h-4 w-4 mr-2" />
                Export Attendance
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Leave Balances
              </CardTitle>
              <CardDescription>Current leave entitlements and usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employees</span>
                  <span className="font-medium">{leaveBalances.length}</span>
                </div>
                {Object.entries(leaveByType)
                  .slice(0, 3)
                  .map(([type, days]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{type}</span>
                      <Badge variant="outline">{days} days used</Badge>
                    </div>
                  ))}
                {Object.keys(leaveByType).length === 0 && (
                  <p className="text-sm text-muted-foreground">No leave taken this period</p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={exportLeaveBalances}
                disabled={leaveBalances.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Leave Balances
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600" />
                Overtime Report
              </CardTitle>
              <CardDescription>Track overtime hours by employee</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Overtime</span>
                  <span className="font-medium">{totalOvertimeHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Records with OT</span>
                  <Badge variant="outline">
                    {attendanceRecords.filter((r) => r.overtimeHours > 0).length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg OT/Record</span>
                  <span className="font-medium">
                    {attendanceRecords.filter((r) => r.overtimeHours > 0).length > 0
                      ? (
                          totalOvertimeHours /
                          attendanceRecords.filter((r) => r.overtimeHours > 0).length
                        ).toFixed(1)
                      : 0}{" "}
                    hrs
                  </span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={exportOvertime}
                disabled={!attendanceRecords.some((r) => r.overtimeHours > 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Overtime
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Status Breakdown */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              Attendance Status Breakdown
            </CardTitle>
            <CardDescription>Distribution by attendance status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: "present", label: "Present", color: "bg-green-100 dark:bg-green-900" },
                { key: "late", label: "Late", color: "bg-orange-100 dark:bg-orange-900" },
                { key: "absent", label: "Absent", color: "bg-red-100 dark:bg-red-900" },
                { key: "half_day", label: "Half Day", color: "bg-yellow-100 dark:bg-yellow-900" },
                { key: "leave", label: "On Leave", color: "bg-purple-100 dark:bg-purple-900" },
              ].map(({ key, label, color }) => (
                <div key={key} className={`text-center p-4 ${color} rounded-lg`}>
                  <p className="text-2xl font-bold">{statusBreakdown[key] || 0}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalRecords > 0
                      ? (((statusBreakdown[key] || 0) / totalRecords) * 100).toFixed(0)
                      : 0}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Attendance Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-600" />
              Recent Attendance Records
            </CardTitle>
            <CardDescription>Most recent clock in/out records</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found for this period</p>
                <p className="text-sm">Records will appear here once employees clock in/out</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Employee</th>
                      <th className="text-left p-3 font-medium">Department</th>
                      <th className="text-center p-3 font-medium">Clock In</th>
                      <th className="text-center p-3 font-medium">Clock Out</th>
                      <th className="text-center p-3 font-medium">Hours</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 15)
                      .map((record) => (
                        <tr key={record.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            {formatDateTL(record.date)}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{record.employeeName}</div>
                          </td>
                          <td className="p-3">{record.department || "-"}</td>
                          <td className="p-3 text-center">{record.clockIn || "-"}</td>
                          <td className="p-3 text-center">{record.clockOut || "-"}</td>
                          <td className="p-3 text-center">
                            <span>{record.totalHours?.toFixed(1) || 0}</span>
                            {record.overtimeHours > 0 && (
                              <span className="text-xs text-blue-600 ml-1">
                                (+{record.overtimeHours.toFixed(1)} OT)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                record.status === "present"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : record.status === "late"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                  : record.status === "absent"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }
                            >
                              {record.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
