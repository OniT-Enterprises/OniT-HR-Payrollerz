import React from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CardIcon, hasCardIcon, cardIconNameFromArt } from "@/components/ui/CardIcon";
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
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
  const { t, locale } = useI18n();
  const { hasModule, canManage, session } = useTenant();
  const canManageTenant = canManage();
  const canReadEmployeeDirectory =
    hasModule("staff") ||
    hasModule("hiring") ||
    canManageTenant ||
    session?.role === "manager";
  const today = getTodayTL();
  const weekStart = getWeekStartTL(today);
  const weekEnd = addDaysISO(weekStart, 6);

  const employeeSummaryQuery = useActiveEmployeeSummary(canReadEmployeeDirectory);
  const leaveStatsQuery = useLeaveStats();
  const attendanceQuery = useAttendanceByDate(today);
  const shiftsQuery = useShiftsByRange(weekStart, weekEnd, canManageTenant);
  const dashboardQueries = [
    ...(canReadEmployeeDirectory ? [employeeSummaryQuery] : []),
    leaveStatsQuery,
    attendanceQuery,
    ...(canManageTenant ? [shiftsQuery] : []),
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
  const onLeaveToday = leaveStats?.employeesOnLeaveToday ?? 0;
  const pendingLeave = leaveStats?.pendingRequests ?? 0;

  const records = todayAttendance ?? [];
  const lateToday = records.filter((r) => r.status === "late").length;
  const absentToday = records.filter((r) => r.status === "absent").length;
  const availableToday = Math.max(activeEmployees - onLeaveToday - absentToday, 0);
  const coverageRate = activeEmployees > 0 ? Math.round((availableToday / activeEmployees) * 100) : 100;
  const totalHoursToday = records.reduce(
    (total, record) => total + (Number.isFinite(record.totalHours) ? record.totalHours : 0),
    0,
  );
  const hoursLocale = locale === "pt" ? "pt-PT" : locale === "tet" ? "pt-TL" : "en-GB";
  const formattedHours = new Intl.NumberFormat(hoursLocale, {
    maximumFractionDigits: 1,
  }).format(totalHoursToday);
  const weekShifts = shifts.filter((shift) => shift.status !== "cancelled");
  const draftShifts = weekShifts.filter((shift) => shift.status === "draft").length;

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
      art: "/images/illustrations/xefe-card-tl-attendance.webp",
      value: canReadEmployeeDirectory ? `${availableToday} / ${activeEmployees}` : String(records.length),
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
      value: String(onLeaveToday),
      meta: t("moduleDashboards.scheduling.cards.onLeaveTodayLabel"),
      path: "/time-leave/leave",
      icon: CalendarDays,
    },
    ...(canManageTenant ? [{
      title: t("moduleDashboards.scheduling.cards.timeTracking"),
      art: "/images/illustrations/xefe-card-tl-timetracking.webp",
      value: `${formattedHours}h`,
      meta: t("moduleDashboards.scheduling.cards.hoursRecordedToday"),
      path: "/time-leave/time-tracking",
      icon: Clock,
    }] : []),
    ...(canManageTenant ? [{
      title: t("moduleDashboards.scheduling.cards.shifts"),
      art: "/images/illustrations/xefe-card-tl-shifts.webp",
      value: String(weekShifts.length),
      meta: t("moduleDashboards.scheduling.cards.shiftsThisWeek"),
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

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header */}
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
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {hubCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-cyan-400/40 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                {hasCardIcon(cardIconNameFromArt(card.art)) ? (
                  <CardIcon
                    name={cardIconNameFromArt(card.art)!}
                    className="h-12 w-12 text-foreground [--card-icon-accent:#0891b2] dark:[--card-icon-accent:#22d3ee] sm:h-16 sm:w-16"
                  />
                ) : (
                  <img
                    src={card.art}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-12 w-12 object-contain sm:h-16 sm:w-16"
                  />
                )}
                <span className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                  {card.value}
                </span>
              </div>
              <div className="mt-auto">
                <p className="text-sm font-semibold sm:text-base">{card.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{card.meta}</p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
