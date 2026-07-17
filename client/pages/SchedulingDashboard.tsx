import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useAttendanceByDate } from "@/hooks/useAttendance";
import { getTodayTL } from "@/lib/dateUtils";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant } from "@/contexts/TenantContext";
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
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchedulingDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { hasModule, canManage, session } = useTenant();
  const canManageTenant = canManage();
  const canReadEmployeeDirectory =
    hasModule("staff") ||
    hasModule("hiring") ||
    canManageTenant ||
    session?.role === "manager";
  const today = getTodayTL();

  const employeeSummaryQuery = useActiveEmployeeSummary(canReadEmployeeDirectory);
  const leaveStatsQuery = useLeaveStats();
  const attendanceQuery = useAttendanceByDate(today);
  const dashboardQueries = [
    ...(canReadEmployeeDirectory ? [employeeSummaryQuery] : []),
    leaveStatsQuery,
    attendanceQuery,
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

  const activeEmployees = employeeSummary?.active ?? 0;
  const onLeaveToday = leaveStats?.employeesOnLeaveToday ?? 0;
  const pendingLeave = leaveStats?.pendingRequests ?? 0;
  const availableToday = Math.max(activeEmployees - onLeaveToday, 0);
  const coverageRate = activeEmployees > 0 ? Math.round((availableToday / activeEmployees) * 100) : 100;

  const records = todayAttendance ?? [];
  const lateToday = records.filter((r) => r.status === "late").length;
  const absentToday = records.filter((r) => r.status === "absent").length;

  // Triage: only what needs a decision today (count > 0)
  const attention = [
    {
      show: pendingLeave > 0,
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
      icon: Clock,
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
  ].filter((item) => item.show);

  const hubCards = [
    {
      title: t("moduleDashboards.scheduling.cards.attendance"),
      art: "/images/illustrations/xefe-card-tl-attendance.webp",
      meta: canReadEmployeeDirectory
        ? t("moduleDashboards.scheduling.cards.availableToday", { rate: coverageRate })
        : t("moduleDashboards.scheduling.cards.timeTrackingMeta"),
      path: "/time-leave/attendance",
      icon: CalendarCheck,
    },
    {
      // Pending requests already surface in the attention strip above.
      title: t("moduleDashboards.scheduling.cards.leave"),
      art: "/images/illustrations/xefe-card-tl-leave.webp",
      meta: t("moduleDashboards.scheduling.cards.onLeaveToday", { count: onLeaveToday }),
      path: "/time-leave/leave",
      icon: CalendarDays,
    },
    ...(canManageTenant ? [{
      title: t("moduleDashboards.scheduling.cards.timeTracking"),
      art: "/images/illustrations/xefe-card-tl-timetracking.webp",
      meta: t("moduleDashboards.scheduling.cards.timeTrackingMeta"),
      path: "/time-leave/time-tracking",
      icon: Clock,
    }] : []),
    ...(canManageTenant ? [{
      title: t("moduleDashboards.scheduling.cards.shifts"),
      art: "/images/illustrations/xefe-card-tl-shifts.webp",
      meta: t("moduleDashboards.scheduling.cards.shiftsMeta"),
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

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("moduleDashboards.scheduling.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {canReadEmployeeDirectory && activeEmployees > 0
                ? t("moduleDashboards.scheduling.subtitle", {
                    available: availableToday,
                    total: activeEmployees,
                    rate: coverageRate,
                  })
                : t("moduleDashboards.scheduling.subtitleEmpty")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/time-leave/attendance")}>
              {t("moduleDashboards.scheduling.attendanceAction")}
            </Button>
            {canManageTenant && (
              <Button onClick={() => navigate("/time-leave/shifts")}>
                <Calendar className="mr-2 h-4 w-4" />
                {t("moduleDashboards.scheduling.shiftsAction")}
              </Button>
            )}
          </div>
        </div>

        {/* Needs attention */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-cyan-600" />
              {canReadEmployeeDirectory
                ? t("moduleDashboards.scheduling.allGood")
                : t("moduleDashboards.scheduling.allGood")}
            </div>
          )}
        </section>

        {/* Module hub */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-400/40"
            >
              <img
                src={card.art}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <div>
                <p className="text-base font-semibold">{card.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{card.meta}</p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
