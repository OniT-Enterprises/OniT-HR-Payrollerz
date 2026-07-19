import React, { useState, useMemo } from "react";
import { formatDateTL } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportPage,
  ReportEmptyState,
  ReportExportCard,
  ReportPageSkeleton,
  ReportSection,
  ReportToolbar,
} from "@/components/reports/ReportLayout";
import { attendanceService } from "@/services/attendanceService";
import { leaveService } from "@/services/leaveService";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Clock,
  Clock3,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Timer,
  TrendingUp,
  Calendar,
  Lock,
  Users,
  UserCheck,
  UserX,
  WifiOff,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import {
  useCurrentEmployeeId,
  useTenant,
  useTenantId,
} from "@/contexts/TenantContext";
import { toDateStringTL } from "@/lib/dateUtils";
import { exportToCSV } from "@/lib/csvExport";

export default function AttendanceReports() {
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { session } = useTenant();
  const currentEmployeeId = useCurrentEmployeeId() ?? undefined;
  const role = session?.role;
  const isFinanceAdmin =
    role === "owner" || role === "hr-admin" || role === "accountant";
  const departmentId =
    role === "manager" ? session?.member.departmentId : undefined;
  const employeeId =
    !isFinanceAdmin && (!departmentId || role !== "manager")
      ? currentEmployeeId
      : undefined;
  const hasReadableScope =
    isFinanceAdmin || Boolean(departmentId || employeeId);

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

  // Fetch attendance data with React Query
  const attendanceQuery = useQuery({
    queryKey: [
      "tenants",
      tenantId,
      "attendance-report",
      dateParams.startDate,
      dateParams.endDate,
      departmentId ?? employeeId ?? "all",
    ],
    queryFn: () =>
      attendanceService.getAttendanceByDateRange(
        tenantId,
        dateParams.startDate,
        dateParams.endDate,
        undefined,
        employeeId,
        departmentId,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: hasReadableScope,
  });
  const attendanceRecords = useMemo(
    () => attendanceQuery.data ?? [],
    [attendanceQuery.data],
  );

  // Fetch leave requests with React Query
  const leaveQuery = useQuery({
    queryKey: [
      "tenants",
      tenantId,
      "leave",
      "report-requests",
      departmentId ?? employeeId ?? "all",
    ],
    queryFn: () =>
      leaveService.getLeaveRequests(tenantId, { departmentId, employeeId }),
    staleTime: 5 * 60 * 1000,
    enabled: hasReadableScope,
  });
  const leaveRequests = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data]);

  // Fetch leave balances with React Query
  const balancesQuery = useQuery({
    queryKey: [
      "tenants",
      tenantId,
      "leave",
      "report-balances",
      departmentId ?? employeeId ?? "all",
    ],
    queryFn: async () => {
      if (employeeId) {
        const balance = await leaveService.getLeaveBalance(
          tenantId,
          employeeId,
        );
        return balance ? [balance] : [];
      }
      return leaveService.getAllBalances(tenantId, undefined, departmentId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: hasReadableScope,
  });
  const leaveBalances = balancesQuery.data ?? [];

  const loading =
    attendanceQuery.isLoading ||
    leaveQuery.isLoading ||
    balancesQuery.isLoading;
  const loadError =
    attendanceQuery.isError || leaveQuery.isError || balancesQuery.isError;

  // Calculate stats
  const totalRecords = attendanceRecords.length;
  const totalOvertimeHours = useMemo(
    () => attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
    [attendanceRecords],
  );

  // Attendance by status
  const statusBreakdown = useMemo(
    () =>
      attendanceRecords.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [attendanceRecords],
  );

  const recentAttendanceRecords = useMemo(
    () =>
      [...attendanceRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15),
    [attendanceRecords],
  );

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
  const leaveByType = useMemo(
    () =>
      leaveRequests
        .filter((r) => r.status === "approved")
        .reduce(
          (acc, r) => {
            acc[r.leaveType] = (acc[r.leaveType] || 0) + r.duration;
            return acc;
          },
          {} as Record<string, number>,
        ),
    [leaveRequests],
  );

  const doExport = (
    data: Record<string, unknown>[],
    filename: string,
    columns: { key: string; label: string }[],
  ) => {
    exportToCSV(data, filename, columns);
    toast({
      title: t("reports.attendance.exportCompleteTitle"),
      description: t("reports.attendance.exportCompleteDesc", {
        file: `${filename}.csv`,
      }),
    });
  };

  const exportAttendance = () => {
    doExport(
      attendanceRecords as unknown as Record<string, unknown>[],
      "attendance_report",
      [
        { key: "date", label: t("timeLeave.attendance.csv.date") },
        {
          key: "employeeName",
          label: t("timeLeave.attendance.csv.employeeName"),
        },
        { key: "department", label: t("timeLeave.attendance.csv.department") },
        { key: "clockIn", label: t("timeLeave.attendance.csv.clockIn") },
        { key: "clockOut", label: t("timeLeave.attendance.csv.clockOut") },
        {
          key: "regularHours",
          label: t("timeLeave.attendance.csv.regularHours"),
        },
        {
          key: "overtimeHours",
          label: t("timeLeave.attendance.csv.overtimeHours"),
        },
        {
          key: "lateMinutes",
          label: t("reports.attendance.columns.lateMinutes"),
        },
        { key: "status", label: t("timeLeave.attendance.csv.status") },
        { key: "source", label: t("timeLeave.timeTracking.table.source") },
      ],
    );
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
      {
        key: "employeeName",
        label: t("timeLeave.attendance.csv.employeeName"),
      },
      {
        key: "annualEntitled",
        label: t("reports.attendance.columns.annualEntitled"),
      },
      { key: "annualUsed", label: t("reports.attendance.columns.annualUsed") },
      {
        key: "annualRemaining",
        label: t("reports.attendance.columns.annualRemaining"),
      },
      {
        key: "sickEntitled",
        label: t("reports.attendance.columns.sickEntitled"),
      },
      { key: "sickUsed", label: t("reports.attendance.columns.sickUsed") },
      {
        key: "sickRemaining",
        label: t("reports.attendance.columns.sickRemaining"),
      },
      { key: "carryOver", label: t("reports.attendance.columns.carryOver") },
    ]);
  };

  const exportOvertime = () => {
    const overtimeRecords = attendanceRecords.filter(
      (r) => r.overtimeHours > 0,
    );
    doExport(
      overtimeRecords as unknown as Record<string, unknown>[],
      "overtime_report",
      [
        { key: "date", label: t("timeLeave.attendance.csv.date") },
        {
          key: "employeeName",
          label: t("timeLeave.attendance.csv.employeeName"),
        },
        { key: "department", label: t("timeLeave.attendance.csv.department") },
        {
          key: "regularHours",
          label: t("timeLeave.attendance.csv.regularHours"),
        },
        {
          key: "overtimeHours",
          label: t("timeLeave.attendance.csv.overtimeHours"),
        },
        {
          key: "totalHours",
          label: t("timeLeave.timeTracking.table.totalHours"),
        },
      ],
    );
  };

  if (loading) {
    return <ReportPageSkeleton sections={2} toolbarFields={1} />;
  }

  if (loadError || !hasReadableScope) {
    return (
      <>
        <SEO {...seoConfig.attendanceReports} />
        <ReportPage
          title={t("reports.attendance.title")}
          subtitle={t("reports.attendance.subtitle")}
          icon={Clock}
        >
          <ReportEmptyState
            icon={loadError ? WifiOff : Lock}
            title={
              loadError
                ? t("common.connectionIssueTitle")
                : t("reports.shared.unavailableTitle")
            }
            description={
              loadError
                ? t("common.connectionIssueDesc")
                : t("reports.shared.unavailableDescription")
            }
            actionLabel={loadError ? t("common.retry") : undefined}
            onAction={
              loadError
                ? () => {
                    void Promise.all([
                      attendanceQuery.refetch(),
                      leaveQuery.refetch(),
                      balancesQuery.refetch(),
                    ]);
                  }
                : undefined
            }
          />
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO {...seoConfig.attendanceReports} />
      <ReportPage
        title={t("reports.attendance.title")}
        subtitle={t("reports.attendance.subtitle")}
        icon={Clock}
      >
        <ReportToolbar ariaLabel={t("reports.attendance.periodLabel")}>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-report-period">
              {t("reports.attendance.periodLabel")}
            </Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger
                id="attendance-report-period"
                className="w-full sm:w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">
                  {t("reports.attendance.ranges.last7")}
                </SelectItem>
                <SelectItem value="30">
                  {t("reports.attendance.ranges.last30")}
                </SelectItem>
                <SelectItem value="90">
                  {t("reports.attendance.ranges.last90")}
                </SelectItem>
                <SelectItem value="365">
                  {t("reports.attendance.ranges.lastYear")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ReportToolbar>
        {/* Report Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ReportExportCard
            icon={Clock}
            accent="cyan"
            title={t("reports.attendance.cards.summary.title")}
            description={t("reports.attendance.cards.summary.description")}
            rows={[
              {
                icon: ClipboardList,
                label: t("reports.attendance.cards.summary.totalRecords"),
                value: totalRecords,
              },
              {
                icon: UserCheck,
                label: t("timeLeave.attendance.status.present"),
                value: statusBreakdown.present || 0,
                tone: statusBreakdown.present ? "positive" : "muted",
              },
              {
                icon: Clock3,
                label: t("timeLeave.attendance.status.late"),
                value: statusBreakdown.late || 0,
                tone: statusBreakdown.late ? "attention" : "muted",
              },
              {
                icon: UserX,
                label: t("timeLeave.attendance.status.absent"),
                value: statusBreakdown.absent || 0,
                tone: statusBreakdown.absent ? "critical" : "muted",
              },
            ]}
            exportLabel={t("reports.attendance.cards.summary.export")}
            onExport={exportAttendance}
          />

          <ReportExportCard
            icon={CalendarDays}
            accent="violet"
            title={t("reports.attendance.cards.leave.title")}
            description={t("reports.attendance.cards.leave.description")}
            rows={[
              {
                icon: Users,
                label: t("reports.attendance.cards.leave.employees"),
                value: leaveBalances.length,
              },
              ...Object.entries(leaveByType)
                .slice(0, 3)
                .map(([type, days]) => ({
                  icon: CalendarCheck,
                  label: <span className="capitalize">{type}</span>,
                  value: t("reports.attendance.cards.leave.daysUsed", {
                    days,
                  }),
                })),
            ]}
            footnote={
              Object.keys(leaveByType).length === 0
                ? t("reports.attendance.cards.leave.none")
                : undefined
            }
            exportLabel={t("reports.attendance.cards.leave.export")}
            onExport={exportLeaveBalances}
            exportDisabled={leaveBalances.length === 0}
          />

          <ReportExportCard
            icon={Timer}
            accent="blue"
            title={t("reports.attendance.cards.overtime.title")}
            description={t("reports.attendance.cards.overtime.description")}
            rows={[
              {
                icon: Clock,
                label: t("reports.attendance.cards.overtime.total"),
                value: t("reports.attendance.cards.overtime.hoursValue", {
                  hours: totalOvertimeHours.toFixed(1),
                }),
              },
              {
                icon: ClipboardList,
                label: t("reports.attendance.cards.overtime.records"),
                value: attendanceRecords.filter((r) => r.overtimeHours > 0)
                  .length,
              },
              {
                icon: TrendingUp,
                label: t("reports.attendance.cards.overtime.average"),
                value: t("reports.attendance.cards.overtime.hoursValue", {
                  hours:
                    attendanceRecords.filter((r) => r.overtimeHours > 0)
                      .length > 0
                      ? (
                          totalOvertimeHours /
                          attendanceRecords.filter((r) => r.overtimeHours > 0)
                            .length
                        ).toFixed(1)
                      : 0,
                }),
              },
            ]}
            exportLabel={t("reports.attendance.cards.overtime.export")}
            onExport={exportOvertime}
            exportDisabled={!attendanceRecords.some((r) => r.overtimeHours > 0)}
          />
        </div>

        {/* Recent Attendance Table */}
        <ReportSection
          icon={Calendar}
          title={t("reports.attendance.recent.title")}
          description={t("reports.attendance.recent.description")}
        >
          {attendanceRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("reports.attendance.recent.emptyTitle")}</p>
              <p className="text-sm">
                {t("reports.attendance.recent.emptyDescription")}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 md:hidden">
                {recentAttendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{record.employeeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.department || "-"}
                        </div>
                      </div>
                      <Badge
                        className={
                          record.status === "present"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : record.status === "late"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                              : record.status === "absent"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-muted text-muted-foreground"
                        }
                      >
                        {getStatusLabel(record.status)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("timeLeave.attendance.csv.date")}
                        </p>
                        <p>{formatDateTL(record.date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("timeLeave.timeTracking.table.totalHours")}
                        </p>
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
                        <p className="text-xs text-muted-foreground">
                          {t("timeLeave.attendance.table.clockIn")}
                        </p>
                        <p>{record.clockIn || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("timeLeave.attendance.table.clockOut")}
                        </p>
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
                      <th className="text-left p-3 font-medium">
                        {t("timeLeave.attendance.csv.date")}
                      </th>
                      <th className="text-left p-3 font-medium">
                        {t("timeLeave.attendance.table.employee")}
                      </th>
                      <th className="text-left p-3 font-medium">
                        {t("timeLeave.attendance.table.department")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("timeLeave.attendance.table.clockIn")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("timeLeave.attendance.table.clockOut")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("timeLeave.timeTracking.table.totalHours")}
                      </th>
                      <th className="text-center p-3 font-medium">
                        {t("timeLeave.attendance.table.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendanceRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b hover:bg-muted/50"
                      >
                        <td className="p-3">{formatDateTL(record.date)}</td>
                        <td className="p-3">
                          <div className="font-medium">
                            {record.employeeName}
                          </div>
                        </td>
                        <td className="p-3">{record.department || "-"}</td>
                        <td className="p-3 text-center">
                          {record.clockIn || "-"}
                        </td>
                        <td className="p-3 text-center">
                          {record.clockOut || "-"}
                        </td>
                        <td className="p-3 text-center">
                          <span>{record.totalHours?.toFixed(1) || 0}</span>
                          {record.overtimeHours > 0 && (
                            <span className="text-xs text-blue-600 ml-1">
                              (+{record.overtimeHours.toFixed(1)}{" "}
                              {t("timeLeave.attendance.table.overtime")})
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
                                    : "bg-muted text-muted-foreground"
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
        </ReportSection>
      </ReportPage>
    </>
  );
}
