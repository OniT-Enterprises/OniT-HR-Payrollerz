import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CardIcon, hasCardIcon } from "@/components/ui/CardIcon";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { peopleNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary, useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useGoalStats } from "@/hooks/usePerformance";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { interviewService } from "@/services/interviewService";
import { trainingService } from "@/services/trainingService";
import { disciplinaryService } from "@/services/disciplinaryService";
import { useI18n } from "@/i18n/I18nProvider";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Search,
  ShieldAlert,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

function PeopleHomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={peopleNavConfig} />
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { hasModule, canManage } = useTenant();
  const canManageTenant = canManage();
  const hasStaff = hasModule("staff");
  const hasHiring = hasModule("hiring");
  const hasPerformance = hasModule("performance");
  const hasTimeleave = hasModule("timeleave");

  const [searchTerm, setSearchTerm] = useState("");

  const employeeSummaryQuery = useActiveEmployeeSummary(hasStaff);
  const recentEmployeesQuery = useAllEmployees(8, hasStaff);
  const leaveStatsQuery = useLeaveStats(hasTimeleave);
  const goalStatsQuery = useGoalStats(undefined, hasPerformance);
  const interviewStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "interviews"],
    queryFn: () => interviewService.getStats(tenantId),
    enabled: hasHiring,
    staleTime: 5 * 60 * 1000,
  });
  const trainingStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "training"],
    queryFn: () => trainingService.getTrainingStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });
  const disciplinaryStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "disciplinary"],
    queryFn: () => disciplinaryService.getStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });

  const dashboardQueries = [
    ...(hasStaff ? [employeeSummaryQuery, recentEmployeesQuery] : []),
    ...(hasTimeleave ? [leaveStatsQuery] : []),
    ...(hasHiring ? [interviewStatsQuery] : []),
    ...(hasPerformance ? [goalStatsQuery, trainingStatsQuery, disciplinaryStatsQuery] : []),
  ];
  const dashboardLoading = dashboardQueries.some((query) => query.isLoading);
  const dashboardError = dashboardQueries.some((query) => query.data === undefined);

  if (dashboardLoading) {
    return <PeopleHomeSkeleton />;
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("moduleDashboards.people.title")}
          description={t("moduleDashboards.people.seoDescription")}
        />
        <ModuleSectionNav config={peopleNavConfig} />
        <DashboardLoadError
          isRetrying={dashboardQueries.some((query) => query.isFetching)}
          onRetry={() => Promise.all(dashboardQueries.map((query) => query.refetch()))}
        />
      </div>
    );
  }

  const employeeSummary = employeeSummaryQuery.data;
  const recentEmployees = recentEmployeesQuery.data;
  const leaveStats = leaveStatsQuery.data;
  const goalStats = goalStatsQuery.data;
  const interviewStats = interviewStatsQuery.data;
  const trainingStats = trainingStatsQuery.data;
  const disciplinaryStats = disciplinaryStatsQuery.data;

  const activeEmployees = employeeSummary?.active ?? 0;
  const employeesWithIssues = employeeSummary?.employeesWithIssues ?? 0;
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const onLeaveToday = hasTimeleave ? leaveStats?.employeesOnLeaveToday ?? 0 : 0;
  const interviewsScheduled = hasHiring ? interviewStats?.scheduled ?? 0 : 0;
  const trainingExpiring = hasPerformance ? trainingStats?.expiringSoon ?? 0 : 0;
  const disciplinaryOpen = hasPerformance
    ? (disciplinaryStats?.open ?? 0) + (disciplinaryStats?.inReview ?? 0)
    : 0;
  const goalsActive = hasPerformance ? goalStats?.active ?? 0 : 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    navigate(term ? `/people/employees?search=${encodeURIComponent(term)}` : "/people/employees");
  };

  // Triage: only surface what actually needs a decision (count > 0 and module on)
  const attention = [
    {
      show: hasTimeleave && pendingLeave > 0,
      count: pendingLeave,
      label: t(
        pendingLeave === 1
          ? "moduleDashboards.people.attention.leaveRequest"
          : "moduleDashboards.people.attention.leaveRequests",
      ),
      path: "/time-leave/leave",
      icon: CalendarClock,
      tone: "text-cyan-600 bg-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-300",
    },
    {
      show: hasStaff && employeesWithIssues > 0,
      count: employeesWithIssues,
      label: t(
        employeesWithIssues === 1
          ? "moduleDashboards.people.attention.employeeMissingInfo"
          : "moduleDashboards.people.attention.employeesMissingInfo",
      ),
      path: "/people/employees?filter=issues",
      icon: AlertTriangle,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: hasPerformance && trainingExpiring > 0,
      count: trainingExpiring,
      label: t(
        trainingExpiring === 1
          ? "moduleDashboards.people.attention.certificateExpiring"
          : "moduleDashboards.people.attention.certificatesExpiring",
      ),
      path: "/people/training",
      icon: GraduationCap,
      tone: "text-violet-600 bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      show: hasPerformance && disciplinaryOpen > 0,
      count: disciplinaryOpen,
      label: t(
        disciplinaryOpen === 1
          ? "moduleDashboards.people.attention.openCase"
          : "moduleDashboards.people.attention.openCases",
      ),
      path: "/people/disciplinary",
      icon: ShieldAlert,
      tone: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300",
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      show: hasStaff,
      title: t("moduleDashboards.people.cards.staff"),
      meta: t("moduleDashboards.people.cards.active", { count: activeEmployees }),
      path: "/people/employees",
      icon: Users,
      art: "/images/illustrations/xefe-card-people.webp",
      svg: "people",
    },
    {
      show: hasHiring,
      title: t("moduleDashboards.people.cards.hiring"),
      meta: t(
        interviewsScheduled === 1
          ? "moduleDashboards.people.cards.interviewScheduled"
          : "moduleDashboards.people.cards.interviewsScheduled",
        { count: interviewsScheduled },
      ),
      path: "/people/jobs",
      icon: Briefcase,
      art: "/images/illustrations/xefe-card-hiring.webp",
      svg: "hiring",
    },
    {
      // Pending requests already surface in the attention strip above —
      // show a complementary fact here instead of repeating it.
      show: hasTimeleave,
      title: t("moduleDashboards.people.cards.timeLeave"),
      meta: t("moduleDashboards.people.cards.onLeaveToday", { count: onLeaveToday }),
      path: "/time-leave",
      icon: CalendarClock,
      art: "/images/illustrations/xefe-card-timeleave.webp",
      svg: "timeleave",
    },
    {
      show: hasPerformance,
      title: t("moduleDashboards.people.cards.performance"),
      meta: t(
        goalsActive === 1
          ? "moduleDashboards.people.cards.activeGoal"
          : "moduleDashboards.people.cards.activeGoals",
        { count: goalsActive },
      ),
      path: "/people/reviews",
      icon: Target,
      art: "/images/illustrations/xefe-card-performance.webp",
      svg: "performance",
    },
  ].filter((card) => card.show);

  const recent = (recentEmployees ?? []).slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("moduleDashboards.people.title")}
        description={t("moduleDashboards.people.seoDescription")}
      />
      <ModuleSectionNav config={peopleNavConfig} />

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
        {/* Header + search */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("moduleDashboards.people.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasStaff
                  ? t("moduleDashboards.people.subtitle", { count: activeEmployees })
                  : t("moduleDashboards.people.subtitleNoStaff")}
              </p>
            </div>
            {hasStaff && canManageTenant && (
              <Button onClick={() => navigate("/people/add")}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("moduleDashboards.people.addEmployee")}
              </Button>
            )}
          </div>

          {hasStaff && (
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("moduleDashboards.people.searchPlaceholder")}
                className="h-12 rounded-xl pl-12 text-base"
                aria-label={t("moduleDashboards.people.searchAria")}
              />
            </form>
          )}
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
                  key={item.path}
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
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              {t("moduleDashboards.people.allGood")}
            </div>
          )}
        </section>

        {/* Module hub */}
        {hubCards.length > 0 && (
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {hubCards.map((card) => (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                className="group flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-blue-400/40 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
              >
                {hasCardIcon(card.svg) ? (
                  <CardIcon
                    name={card.svg}
                    className="h-12 w-12 text-foreground [--card-icon-accent:#2563eb] dark:[--card-icon-accent:#60a5fa] sm:h-16 sm:w-16"
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
                <div>
                  <p className="text-sm font-semibold sm:text-base">{card.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{card.meta}</p>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Recently added */}
        {hasStaff && recent.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("moduleDashboards.people.recentlyAdded")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {recent.map((emp) => {
                const name = `${emp.personalInfo?.firstName ?? ""} ${emp.personalInfo?.lastName ?? ""}`.trim();
                const initials =
                  `${emp.personalInfo?.firstName?.[0] ?? ""}${emp.personalInfo?.lastName?.[0] ?? ""}`.toUpperCase() ||
                  "?";
                return (
                  <button
                    key={emp.id}
                    onClick={() => navigate(`/people/employees?id=${emp.id}`)}
                    className="flex items-center gap-3 rounded-full border border-border/60 bg-card py-1.5 pl-1.5 pr-4 transition-colors hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      {emp.photoUrl ? <AvatarImage src={emp.photoUrl} alt={name} /> : null}
                      <AvatarFallback className="bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {name || t("moduleDashboards.people.unnamed")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
