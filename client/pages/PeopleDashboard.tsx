import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HubCard } from "@/components/dashboard/HubCard";
import PageHeader from "@/components/layout/PageHeader";
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
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        {/* Header + search */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </div>
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        {/* Needs attention */}
        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex w-full items-center gap-4 px-4 py-3.5 ${
                  idx !== 2 ? "border-b border-border/60" : ""
                }`}
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                <Skeleton className={`h-4 flex-1 ${idx === 0 ? "max-w-56" : idx === 1 ? "max-w-40" : "max-w-48"}`} />
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* Module hub */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:min-h-0 sm:gap-3 sm:rounded-2xl sm:p-5"
            >
              <Skeleton className="h-12 w-12 rounded-lg sm:h-16 sm:w-16" />
              <div>
                <Skeleton className="h-4 w-20 sm:w-24" />
                <Skeleton className="mt-1.5 h-3 w-16 sm:w-20" />
              </div>
            </div>
          ))}
        </section>

        {/* Recently added */}
        <section>
          <Skeleton className="mb-3 h-3 w-32" />
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-full border border-border/60 bg-card py-1.5 pl-1.5 pr-4"
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { session, hasModule, canManage } = useTenant();
  const canManageTenant = canManage();
  const isHrAdmin = session?.role === "owner" || session?.role === "hr-admin";
  const hasStaff = hasModule("staff");
  const hasHiring = hasModule("hiring");
  const hasPerformance = hasModule("performance");
  const hasTimeleave = hasModule("timeleave");

  const [searchTerm, setSearchTerm] = useState("");

  const employeeSummaryQuery = useActiveEmployeeSummary(hasStaff);
  const recentEmployeesQuery = useAllEmployees(8, hasStaff);
  const leaveStatsQuery = useLeaveStats(hasTimeleave);
  const goalStatsQuery = useGoalStats(undefined, hasPerformance && isHrAdmin);
  // These three "what needs attention" badge counts live under a bespoke
  // `peopleHome` namespace that NO mutation invalidates — so with a long
  // staleTime they showed counts up to 5 minutes out of date after the user
  // resolved a disciplinary case, completed a training, or scheduled an
  // interview. Refetch on every dashboard visit so the badges are current.
  const interviewStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "interviews"],
    queryFn: () => interviewService.getStats(tenantId),
    enabled: hasHiring,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const trainingStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "training"],
    queryFn: () => trainingService.getTrainingStats(tenantId),
    enabled: hasPerformance && isHrAdmin,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const disciplinaryStatsQuery = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "disciplinary"],
    queryFn: () => disciplinaryService.getStats(tenantId),
    enabled: hasPerformance && isHrAdmin,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const dashboardQueries = [
    ...(hasStaff ? [employeeSummaryQuery, recentEmployeesQuery] : []),
    ...(hasTimeleave ? [leaveStatsQuery] : []),
    ...(hasHiring ? [interviewStatsQuery] : []),
    ...(hasPerformance && isHrAdmin
      ? [goalStatsQuery, trainingStatsQuery, disciplinaryStatsQuery]
      : []),
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
  const trainingStats = trainingStatsQuery.data;
  const disciplinaryStats = disciplinaryStatsQuery.data;

  const activeEmployees = employeeSummary?.active ?? 0;
  const employeesWithIssues = employeeSummary?.employeesWithIssues ?? 0;
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const trainingExpiring = hasPerformance && isHrAdmin ? trainingStats?.expiringSoon ?? 0 : 0;
  const disciplinaryOpen = hasPerformance && isHrAdmin
    ? (disciplinaryStats?.open ?? 0) + (disciplinaryStats?.inReview ?? 0)
    : 0;

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
      show: hasPerformance && isHrAdmin && trainingExpiring > 0,
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
      show: hasPerformance && isHrAdmin && disciplinaryOpen > 0,
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
      purpose: t("moduleDashboards.people.cards.staffPurpose"),
      action: t("moduleDashboards.people.cards.staffAction"),
      path: "/people/employees",
      icon: Users,
    },
    {
      show: hasHiring,
      title: t("moduleDashboards.people.cards.hiring"),
      purpose: t("moduleDashboards.people.cards.hiringPurpose"),
      action: t("moduleDashboards.people.cards.hiringAction"),
      path: "/people/jobs",
      icon: Briefcase,
    },
    {
      // Pending requests already surface in the attention strip above —
      // show a complementary fact here instead of repeating it.
      show: hasTimeleave,
      title: t("moduleDashboards.people.cards.timeLeave"),
      purpose: t("moduleDashboards.people.cards.timeLeavePurpose"),
      action: t("moduleDashboards.people.cards.timeLeaveAction"),
      path: "/time-leave",
      icon: CalendarClock,
    },
    {
      show: hasPerformance && isHrAdmin,
      title: t("moduleDashboards.people.cards.performance"),
      purpose: t("moduleDashboards.people.cards.performancePurpose"),
      action: t("moduleDashboards.people.cards.performanceAction"),
      path: "/people/goals",
      icon: Target,
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

      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
        {/* Header + search */}
        <div className="space-y-5">
          <PageHeader
            size="lg"
            title={t("moduleDashboards.people.title")}
            icon={Users}
            iconColor="text-blue-500"
            subtitle={
              hasStaff
                ? t("moduleDashboards.people.subtitle", { count: activeEmployees })
                : t("moduleDashboards.people.subtitleNoStaff")
            }
            actions={
              hasStaff && canManageTenant ? (
                <Button
                  onClick={() => navigate("/people/add")}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("moduleDashboards.people.addEmployee")}
                </Button>
              ) : undefined
            }
          />

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
              <HubCard
                key={card.path}
                icon={card.icon}
                title={card.title}
                purpose={card.purpose}
                action={card.action}
                accent="blue"
                onClick={() => navigate(card.path)}
              />
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
