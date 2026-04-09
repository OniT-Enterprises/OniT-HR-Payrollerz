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
import PageHeader from "@/components/layout/PageHeader";
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
import { exportToCSV } from "@/lib/csvExport";

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

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: t("timeLeave.attendance.status.present"),
      late: t("timeLeave.attendance.status.late"),
      absent: t("timeLeave.attendance.status.absent"),
      half_day: t("timeLeave.attendance.status.halfDay"),
      leave: t("timeLeave.attendance.status.leave"),
    };
    return labels[status] || status;
  };

  // Leave by type
  const leaveByType = useMemo(() => leaveRequests
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => {
      acc[r.leaveType] = (acc[r.leaveType] || 0) + r.duration;
      return acc;
    }, {} as Record<string, number>), [leaveRequests]);

  const doExport = (data: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.attendance.exportCompleteTitle"),
      description: t("reports.attendance.exportCompleteDesc", { file: `${filename}.csv` }),
    });
  };

  const exportAttendance = () => {
    doExport(attendanceRecords as unknown as Record<string, unknown>[], "attendance_report", [
      { key: "date", label: t("timeLeave.attendance.csv.date") },
      { key: "employeeName", label: t("timeLeave.attendance.csv.employeeName") },
      { key: "department", label: t("timeLeave.attendance.csv.department") },
      { key: "clockIn", label: t("timeLeave.attendance.csv.clockIn") },
      { key: "clockOut", label: t("timeLeave.attendance.csv.clockOut") },
      { key: "regularHours", label: t("timeLeave.attendance.csv.regularHours") },
      { key: "overtimeHours", label: t("timeLeave.attendance.csv.overtimeHours") },
      { key: "lateMinutes", label: t("reports.attendance.columns.lateMinutes") },
      { key: "status", label: t("timeLeave.attendance.csv.status") },
      { key: "source", label: t("timeLeave.timeTracking.table.source") },
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
    doExport(balanceData, "leave_balances", [
      { key: "employeeName", label: t("timeLeave.attendance.csv.employeeName") },
      { key: "annualEntitled", label: t("reports.attendance.columns.annualEntitled") },
      { key: "annualUsed", label: t("reports.attendance.columns.annualUsed") },
      { key: "annualRemaining", label: t("reports.attendance.columns.annualRemaining") },
      { key: "sickEntitled", label: t("reports.attendance.columns.sickEntitled") },
      { key: "sickUsed", label: t("reports.attendance.columns.sickUsed") },
      { key: "sickRemaining", label: t("reports.attendance.columns.sickRemaining") },
      { key: "carryOver", label: t("reports.attendance.columns.carryOver") },
    ]);
  };

  const exportOvertime = () => {
    const overtimeRecords = attendanceRecords.filter((r) => r.overtimeHours > 0);
    doExport(overtimeRecords as unknown as Record<string, unknown>[], "overtime_report", [
      { key: "date", label: t("timeLeave.attendance.csv.date") },
      { key: "employeeName", label: t("timeLeave.attendance.csv.employeeName") },
      { key: "department", label: t("timeLeave.attendance.csv.department") },
      { key: "regularHours", label: t("timeLeave.attendance.csv.regularHours") },
      { key: "overtimeHours", label: t("timeLeave.attendance.csv.overtimeHours") },
      { key: "totalHours", label: t("timeLeave.timeTracking.table.totalHours") },
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 mx-auto max-w-screen-2xl">
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
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.attendance.title")}
          subtitle={t("reports.attendance.subtitle")}
          icon={Clock}
          iconColor="text-violet-500"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("reports.attendance.periodLabel")}
              </span>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("reports.attendance.ranges.last7")}</SelectItem>
                  <SelectItem value="30">{t("reports.attendance.ranges.last30")}</SelectItem>
                  <SelectItem value="90">{t("reports.attendance.ranges.last90")}</SelectItem>
                  <SelectItem value="365">{t("reports.attendance.ranges.lastYear")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.attendance.stats.attendanceRate")}</p>
                  <p className="text-3xl font-bold">{attendanceRate}%</p>
                  <p className="text-xs text-green-600">
                    {t("reports.attendance.stats.attendanceRateSummary", {
                      present: presentRecords.length,
                      total: totalRecords,
                    })}
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
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.attendance.stats.lateArrivals")}</p>
                  <p className="text-3xl font-bold">{lateRecords.length}</p>
                  <p className="text-xs text-orange-600">
                    {t("reports.attendance.stats.lateHoursSummary", {
                      hours: Math.round(totalLateMinutes / 60),
                    })}
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
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.attendance.stats.overtimeHours")}</p>
                  <p className="text-3xl font-bold">{totalOvertimeHours.toFixed(1)}</p>
                  <p className="text-xs text-blue-600">
                    {t("reports.attendance.stats.overtimeEmployees", {
                      count: attendanceRecords.filter((r) => r.overtimeHours > 0).length,
                    })}
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
                  <p className="text-sm font-medium text-muted-foreground">{t("reports.attendance.stats.onLeaveToday")}</p>
                  <p className="text-3xl font-bold">{todayOnLeave.length}</p>
                  <p className="text-xs text-purple-600">
                    {t("reports.attendance.stats.onLeaveSummary", {
                      percent: employees.length > 0
                        ? ((todayOnLeave.length / employees.length) * 100).toFixed(0)
                        : 0,
                    })}
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
                {t("reports.attendance.cards.summary.title")}
              </CardTitle>
              <CardDescription>{t("reports.attendance.cards.summary.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.attendance.cards.summary.totalRecords")}</span>
                  <span className="font-medium">{totalRecords}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("timeLeave.attendance.status.present")}</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {statusBreakdown.present || 0}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("timeLeave.attendance.status.late")}</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    {statusBreakdown.late || 0}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("timeLeave.attendance.status.absent")}</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                    {statusBreakdown.absent || 0}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportAttendance}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.attendance.cards.summary.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                {t("reports.attendance.cards.leave.title")}
              </CardTitle>
              <CardDescription>{t("reports.attendance.cards.leave.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.attendance.cards.leave.employees")}</span>
                  <span className="font-medium">{leaveBalances.length}</span>
                </div>
                {Object.entries(leaveByType)
                  .slice(0, 3)
                  .map(([type, days]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{type}</span>
                      <Badge variant="outline">
                        {t("reports.attendance.cards.leave.daysUsed", { days })}
                      </Badge>
                    </div>
                  ))}
                {Object.keys(leaveByType).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("reports.attendance.cards.leave.none")}</p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={exportLeaveBalances}
                disabled={leaveBalances.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.attendance.cards.leave.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600" />
                {t("reports.attendance.cards.overtime.title")}
              </CardTitle>
              <CardDescription>{t("reports.attendance.cards.overtime.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.attendance.cards.overtime.total")}</span>
                  <span className="font-medium">
                    {t("reports.attendance.cards.overtime.hoursValue", {
                      hours: totalOvertimeHours.toFixed(1),
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.attendance.cards.overtime.records")}</span>
                  <Badge variant="outline">
                    {attendanceRecords.filter((r) => r.overtimeHours > 0).length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("reports.attendance.cards.overtime.average")}</span>
                  <span className="font-medium">
                    {t("reports.attendance.cards.overtime.hoursValue", {
                      hours: attendanceRecords.filter((r) => r.overtimeHours > 0).length > 0
                        ? (
                            totalOvertimeHours /
                            attendanceRecords.filter((r) => r.overtimeHours > 0).length
                          ).toFixed(1)
                        : 0,
                    })}
                  </span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={exportOvertime}
                disabled={!attendanceRecords.some((r) => r.overtimeHours > 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("reports.attendance.cards.overtime.export")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Status Breakdown */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              {t("reports.attendance.breakdown.title")}
            </CardTitle>
            <CardDescription>{t("reports.attendance.breakdown.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: "present", color: "bg-green-100 dark:bg-green-900" },
                { key: "late", color: "bg-orange-100 dark:bg-orange-900" },
                { key: "absent", color: "bg-red-100 dark:bg-red-900" },
                { key: "half_day", color: "bg-yellow-100 dark:bg-yellow-900" },
                { key: "leave", color: "bg-purple-100 dark:bg-purple-900" },
              ].map(({ key, color }) => (
                <div key={key} className={`text-center p-4 ${color} rounded-lg`}>
                  <p className="text-2xl font-bold">{statusBreakdown[key] || 0}</p>
                  <p className="text-sm text-muted-foreground">{getStatusLabel(key)}</p>
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
              {t("reports.attendance.recent.title")}
            </CardTitle>
            <CardDescription>{t("reports.attendance.recent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("reports.attendance.recent.emptyTitle")}</p>
                <p className="text-sm">{t("reports.attendance.recent.emptyDescription")}</p>
              </div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-3 md:hidden">
                  {attendanceRecords
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 15)
                    .map((record) => (
                      <div key={record.id} className="rounded-lg border border-border/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{record.employeeName}</div>
                            <div className="text-sm text-muted-foreground">{record.department || "-"}</div>
                          </div>
                          <Badge
                            className={
                              record.status === "present"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : record.status === "late"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                : record.status === "absent"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }
                          >
                            {getStatusLabel(record.status)}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">{t("timeLeave.attendance.csv.date")}</p>
                            <p>{formatDateTL(record.date)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("timeLeave.timeTracking.table.totalHours")}</p>
                            <p>
                              {record.totalHours?.toFixed(1) || 0}
                              {record.overtimeHours > 0 && (
                                <span className="text-xs text-blue-600 ml-1">
                                  (+{record.overtimeHours.toFixed(1)})
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("timeLeave.attendance.table.clockIn")}</p>
                            <p>{record.clockIn || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("timeLeave.attendance.table.clockOut")}</p>
                            <p>{record.clockOut || "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">{t("timeLeave.attendance.csv.date")}</th>
                        <th className="text-left p-3 font-medium">{t("timeLeave.attendance.table.employee")}</th>
                        <th className="text-left p-3 font-medium">{t("timeLeave.attendance.table.department")}</th>
                        <th className="text-center p-3 font-medium">{t("timeLeave.attendance.table.clockIn")}</th>
                        <th className="text-center p-3 font-medium">{t("timeLeave.attendance.table.clockOut")}</th>
                        <th className="text-center p-3 font-medium">{t("timeLeave.timeTracking.table.totalHours")}</th>
                        <th className="text-center p-3 font-medium">{t("timeLeave.attendance.table.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRecords
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 15)
                        .map((record) => (
                          <tr key={record.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">{formatDateTL(record.date)}</td>
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
                                  (+{record.overtimeHours.toFixed(1)} {t("timeLeave.attendance.table.overtime")})
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                className={
                                  record.status === "present"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : record.status === "late"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                    : record.status === "absent"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                }
                              >
                                {getStatusLabel(record.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
