import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { peopleNavConfig } from "@/lib/moduleNav";
import { useActiveEmployeeSummary, useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useGoalStats } from "@/hooks/usePerformance";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { interviewService } from "@/services/interviewService";
import { trainingService } from "@/services/trainingService";
import { disciplinaryService } from "@/services/disciplinaryService";
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
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
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

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { hasModule } = useTenant();
  const hasStaff = hasModule("staff");
  const hasHiring = hasModule("hiring");
  const hasPerformance = hasModule("performance");
  const hasTimeleave = hasModule("timeleave");

  const [searchTerm, setSearchTerm] = useState("");

  const { data: employeeSummary, isLoading: employeeLoading } = useActiveEmployeeSummary(hasStaff);
  const { data: recentEmployees } = useAllEmployees(8, hasStaff);
  const { data: leaveStats } = useLeaveStats(hasTimeleave);
  const { data: goalStats } = useGoalStats(undefined);
  const { data: interviewStats } = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "interviews"],
    queryFn: () => interviewService.getStats(tenantId),
    enabled: hasHiring,
    staleTime: 5 * 60 * 1000,
  });
  const { data: trainingStats } = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "training"],
    queryFn: () => trainingService.getTrainingStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });
  const { data: disciplinaryStats } = useQuery({
    queryKey: ["tenants", tenantId, "peopleHome", "disciplinary"],
    queryFn: () => disciplinaryService.getStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });

  if (employeeLoading) {
    return <PeopleHomeSkeleton />;
  }

  const activeEmployees = employeeSummary?.active ?? 0;
  const blockingIssues = employeeSummary?.employeesWithBlockingIssues ?? 0;
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
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
      label: `leave request${pendingLeave === 1 ? "" : "s"} waiting for approval`,
      path: "/time-leave/leave",
      icon: CalendarClock,
      tone: "text-cyan-600 bg-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-300",
    },
    {
      show: hasStaff && blockingIssues > 0,
      count: blockingIssues,
      label: `employee record${blockingIssues === 1 ? "" : "s"} missing required info`,
      path: "/people/employees?filter=blocking-issues",
      icon: AlertTriangle,
      tone: "text-amber-600 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      show: hasPerformance && trainingExpiring > 0,
      count: trainingExpiring,
      label: `certificate${trainingExpiring === 1 ? "" : "s"} expiring within 30 days`,
      path: "/people/training",
      icon: GraduationCap,
      tone: "text-violet-600 bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300",
    },
    {
      show: hasHiring && interviewsScheduled > 0,
      count: interviewsScheduled,
      label: `interview${interviewsScheduled === 1 ? "" : "s"} scheduled`,
      path: "/people/interviews",
      icon: Briefcase,
      tone: "text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300",
    },
    {
      show: hasPerformance && disciplinaryOpen > 0,
      count: disciplinaryOpen,
      label: `open employee case${disciplinaryOpen === 1 ? "" : "s"}`,
      path: "/people/disciplinary",
      icon: ShieldAlert,
      tone: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-300",
    },
  ].filter((item) => item.show);

  const hubCards = [
    {
      show: hasStaff,
      title: "Staff",
      meta: `${activeEmployees} active`,
      path: "/people/employees",
      icon: Users,
    },
    {
      show: hasHiring,
      title: "Hiring",
      meta: `${interviewsScheduled} interview${interviewsScheduled === 1 ? "" : "s"} scheduled`,
      path: "/people/jobs",
      icon: Briefcase,
    },
    {
      show: hasTimeleave,
      title: "Time & Leave",
      meta: `${pendingLeave} pending request${pendingLeave === 1 ? "" : "s"}`,
      path: "/time-leave",
      icon: CalendarClock,
    },
    {
      show: hasPerformance,
      title: "Performance",
      meta: `${goalsActive} active goal${goalsActive === 1 ? "" : "s"}`,
      path: "/people/reviews",
      icon: Target,
    },
  ].filter((card) => card.show);

  const recent = (recentEmployees ?? []).slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.people} />
      <ModuleSectionNav config={peopleNavConfig} />

      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">
        {/* Header + search */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">People</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasStaff
                  ? `${activeEmployees} active staff. Find anyone, or jump to what needs you.`
                  : "Find anyone, or jump to what needs you."}
              </p>
            </div>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => navigate("/people/add")}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add employee
            </Button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find anyone — name, role, or ID number…"
              className="h-12 rounded-xl pl-12 text-base"
              aria-label="Search employees"
            />
          </form>
        </div>

        {/* Needs attention */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Needs your attention
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
              You&apos;re all caught up — nothing needs attention right now.
            </div>
          )}
        </section>

        {/* Module hub */}
        {hubCards.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {hubCards.map((card) => (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  <card.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-semibold">{card.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{card.meta}</p>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Recently added */}
        {hasStaff && recent.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recently added
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
                    <span className="text-sm font-medium">{name || "Unnamed"}</span>
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
