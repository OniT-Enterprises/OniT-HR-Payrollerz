import React from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { HubCard } from "@/components/dashboard/HubCard";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useAttendanceByDate } from "@/hooks/useAttendance";
import { useShiftsByRange } from "@/hooks/useShifts";
import { addDaysISO, getTodayTL, getWeekStartTL } from "@/lib/dateUtils";
import { useI18n } from "@/i18n/I18nProvider";
import { useCurrentEmployeeId, useTenant } from "@/contexts/TenantContext";
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
} from "lucide-react";

function SchedulingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={timeLeaveNavConfig} />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        {/* Header */}
        <div>
          <Skeleton className="h-7 w-48 sm:h-8 sm:w-64" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>

        {/* Needs attention */}
        <section>
          <Skeleton className="mb-2 h-3 w-28" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex w-full items-center gap-4 px-4 py-3.5 ${
                  idx !== 2 ? "border-b border-border/60" : ""
                }`}
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <Skeleton className="h-4 flex-1 max-w-[10rem]" />
                <Skeleton className="h-4 w-4 shrink-0" />
              </div>
            ))}
          </div>
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-12 w-12 rounded-lg sm:h-16 sm:w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
              <div className="mt-auto space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default function SchedulingDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session } = useTenant();
  const currentEmployeeId = useCurrentEmployeeId() ?? undefined;
  const role = session?.role;
  const canManageTimeLeave = role === "owner" || role === "hr-admin" || role === "manager";
  const managerDepartmentId = role === "manager" ? session?.member.departmentId : undefined;
  const canReadAllAttendance = role === "owner" || role === "hr-admin" || role === "accountant";
  const canReadEmployeeDirectory =
    role === "owner" || role === "hr-admin" || role === "accountant";
  const today = getTodayTL();
  const weekStart = getWeekStartTL(today);
  const weekEnd = addDaysISO(weekStart, 6);
  const leaveScope = role === "manager"
    ? session?.member.departmentId
      ? { departmentId: session.member.departmentId }
      : currentEmployeeId
        ? { employeeId: currentEmployeeId }
        : undefined
    : !canReadAllAttendance && currentEmployeeId
      ? { employeeId: currentEmployeeId }
      : undefined;
  const canReadLeave = canReadAllAttendance || Boolean(leaveScope);
  const attendanceEmployeeId = canReadAllAttendance || managerDepartmentId
    ? undefined
    : currentEmployeeId;
  const canReadAttendance = canReadAllAttendance || Boolean(managerDepartmentId || attendanceEmployeeId);
  const canReadShifts = canManageTimeLeave && (role !== "manager" || Boolean(managerDepartmentId));

  const employeeSummaryQuery = useActiveEmployeeSummary(canReadEmployeeDirectory);
  const leaveStatsQuery = useLeaveStats(canReadLeave, leaveScope);
  const attendanceQuery = useAttendanceByDate(
    today,
    attendanceEmployeeId,
    canReadAttendance,
    managerDepartmentId,
  );
  const shiftsQuery = useShiftsByRange(
    weekStart,
    weekEnd,
    canReadShifts,
    managerDepartmentId,
  );
  const dashboardQueries = [
    ...(canReadEmployeeDirectory ? [employeeSummaryQuery] : []),
    ...(canReadLeave ? [leaveStatsQuery] : []),
    ...(canReadAttendance ? [attendanceQuery] : []),
    ...(canReadShifts ? [shiftsQuery] : []),
  ];

  if (dashboardQueries.some((query) => query.isLoading)) {
    return <SchedulingDashboardSkeleton />;
  }

  if (dashboardQueries.some((query) => query.data === undefined)) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.scheduling.title")}
          description={t("moduleDashboards.scheduling.seoDescription")}
        />
        <ModuleSectionNav config={timeLeaveNavConfig} />
        <DashboardLoadError
          isRetrying={dashboardQueries.some((query) => query.isFetching)}
          onRetry={() => Promise.all(dashboardQueries.map((query) => query.refetch()))}
        />
      </div>
    );
  }

  const employeeSummary = employeeSummaryQuery.data;
  const leaveStats = leaveStatsQuery.data;
  const todayAttendance = attendanceQuery.data;
  const shifts = shiftsQuery.data ?? [];

  const activeEmployees = employeeSummary?.active ?? 0;
  const pendingLeave = leaveStats?.pendingRequests ?? 0;

  const records = todayAttendance ?? [];
  const lateToday = records.filter((r) => r.status === "late").length;
  const absentToday = records.filter((r) => r.status === "absent").length;
  const recordedToday = new Set(records.map((record) => record.employeeId)).size;
  const notRecordedToday = canReadEmployeeDirectory
    ? Math.max(activeEmployees - recordedToday, 0)
    : 0;
  const weekShifts = shifts.filter((shift) => shift.status !== "cancelled");
  const draftShifts = weekShifts.filter((shift) => shift.status === "draft").length;

  // Triage: only what needs a decision today (count > 0)
  const attention = [
    {
      show: canManageTimeLeave && pendingLeave > 0,
      count: pendingLeave,
      label: t(
        pendingLeave === 1
          ? "moduleDashboards.scheduling.attention.leaveRequest"
          : "moduleDashboards.scheduling.attention.leaveRequests",
      ),
      path: "/time-leave/leave",
      icon: CalendarDays,
      tone: "text-violet-600 bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      show: lateToday > 0,
      count: lateToday,
      label: t(
        lateToday === 1
          ? "moduleDashboards.scheduling.attention.lateArrival"
          : "moduleDashboards.scheduling.attention.lateArrivals",
      ),
      path: "/time-leave/attendance",
      icon: CalendarCheck,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: canManageTimeLeave && notRecordedToday > 0,
      count: notRecordedToday,
      label: t(
        notRecordedToday === 1
          ? "moduleDashboards.scheduling.attention.attendanceMissing"
          : "moduleDashboards.scheduling.attention.attendanceMissingPlural",
      ),
      path: "/time-leave/attendance",
      icon: CalendarCheck,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: absentToday > 0,
      count: absentToday,
      label: t("moduleDashboards.scheduling.attention.absentToday"),
      path: "/time-leave/attendance",
      icon: CalendarX2,
      tone: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300",
    },
    {
      show: draftShifts > 0,
      count: draftShifts,
      label: t(
        draftShifts === 1
          ? "moduleDashboards.scheduling.attention.draftShift"
          : "moduleDashboards.scheduling.attention.draftShifts",
      ),
      path: "/time-leave/shifts",
      icon: Calendar,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: t("moduleDashboards.scheduling.cards.attendance"),
      purpose: t("moduleDashboards.scheduling.cards.attendancePurpose"),
      action: t("moduleDashboards.scheduling.cards.attendanceAction"),
      path: "/time-leave/attendance",
      icon: CalendarCheck,
    },
    {
      title: t("moduleDashboards.scheduling.cards.leave"),
      purpose: t("moduleDashboards.scheduling.cards.leavePurpose"),
      action: t("moduleDashboards.scheduling.cards.leaveAction"),
      path: "/time-leave/leave",
      icon: CalendarDays,
    },
    ...(canReadShifts ? [{
      title: t("moduleDashboards.scheduling.cards.shifts"),
      purpose: t("moduleDashboards.scheduling.cards.shiftsPurpose"),
      action: t("moduleDashboards.scheduling.cards.shiftsAction"),
      path: "/time-leave/shifts",
      icon: Calendar,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.scheduling.title")}
        description={t("moduleDashboards.scheduling.seoDescription")}
      />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        <PageHeader
          size="lg"
          title={t("moduleDashboards.scheduling.title")}
          icon={Clock}
          iconColor="text-cyan-500"
          subtitle={
            canReadEmployeeDirectory && activeEmployees > 0
              ? t("moduleDashboards.scheduling.subtitleRecorded", {
                  recorded: recordedToday,
                  total: activeEmployees,
                })
              : t("moduleDashboards.scheduling.subtitleEmpty")
          }
        />

        {/* Needs attention */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("moduleDashboards.common.needsAttention")}
          </h2>
          {attention.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              {attention.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                    idx !== attention.length - 1 ? "border-b border-border/60" : ""
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="font-semibold tabular-nums">{item.count}</span>{" "}
                    <span className="text-foreground/90">{item.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-cyan-600" />
              {t("moduleDashboards.scheduling.allGood")}
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {hubCards.map((card) => (
            <HubCard
              key={card.path}
              icon={card.icon}
              title={card.title}
              purpose={card.purpose}
              action={card.action}
              accent="cyan"
              onClick={() => navigate(card.path)}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
