import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import GuidancePanel from "@/components/GuidancePanel";
import { SEO, seoConfig } from "@/components/SEO";
import { peopleNavConfig } from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useGoalStats } from "@/hooks/usePerformance";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { interviewService } from "@/services/interviewService";
import { reviewService } from "@/services/reviewService";
import { trainingService } from "@/services/trainingService";
import { disciplinaryService } from "@/services/disciplinaryService";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  GraduationCap,
  HeartHandshake,
  ShieldAlert,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

function PeopleDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Skeleton className="h-80 w-full rounded-3xl" />
            <Skeleton className="h-72 w-full rounded-3xl" />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </div>
        <Skeleton className="h-60 w-full rounded-3xl" />
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

  const { data: employeeSummary, isLoading: employeeLoading } = useActiveEmployeeSummary(hasStaff);
  const { data: leaveStats, isLoading: leaveLoading } = useLeaveStats(hasTimeleave);
  const { data: goalStats, isLoading: goalLoading } = useGoalStats(undefined);
  const { data: interviewStats, isLoading: interviewLoading } = useQuery({
    queryKey: ["tenants", tenantId, "peopleDashboard", "interviews"],
    queryFn: () => interviewService.getStats(tenantId),
    enabled: hasHiring,
    staleTime: 5 * 60 * 1000,
  });
  const { data: reviewStats, isLoading: reviewLoading } = useQuery({
    queryKey: ["tenants", tenantId, "peopleDashboard", "reviews"],
    queryFn: () => reviewService.getStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });
  const { data: trainingStats, isLoading: trainingLoading } = useQuery({
    queryKey: ["tenants", tenantId, "peopleDashboard", "training"],
    queryFn: () => trainingService.getTrainingStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });
  const { data: disciplinaryStats, isLoading: disciplinaryLoading } = useQuery({
    queryKey: ["tenants", tenantId, "peopleDashboard", "disciplinary"],
    queryFn: () => disciplinaryService.getStats(tenantId),
    enabled: hasPerformance,
    staleTime: 5 * 60 * 1000,
  });

  if (
    employeeLoading ||
    leaveLoading ||
    goalLoading ||
    interviewLoading ||
    reviewLoading ||
    trainingLoading ||
    disciplinaryLoading
  ) {
    return <PeopleDashboardSkeleton />;
  }

  const activeEmployees = employeeSummary?.active ?? 0;
  const issues = employeeSummary?.totalIssues ?? 0;
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const interviewsScheduled = hasHiring ? interviewStats?.scheduled ?? 0 : 0;
  const completedReviews = hasPerformance ? reviewStats?.completed ?? 0 : 0;
  const trainingExpiring = hasPerformance ? trainingStats?.expiringSoon ?? 0 : 0;
  const disciplinaryOpen = hasPerformance ? (disciplinaryStats?.open ?? 0) + (disciplinaryStats?.inReview ?? 0) : 0;
  const goalsActive = hasPerformance ? goalStats?.active ?? 0 : 0;

  const workforceMap = [
    { name: "Active", value: activeEmployees, tone: "#2563eb" },
    { name: "Leave", value: pendingLeave, tone: "#06b6d4" },
    { name: "Interviews", value: interviewsScheduled, tone: "#8b5cf6" },
    { name: "Goals", value: goalsActive, tone: "#10b981" },
    { name: "Issues", value: issues, tone: "#f59e0b" },
    { name: "Cases", value: disciplinaryOpen, tone: "#ef4444" },
  ];

  const talentSignals = [
    {
      title: "Hiring pipeline",
      value: interviewsScheduled,
      note: hasHiring ? "Interviews already sitting on the calendar." : "Hiring module is not active for this tenant.",
    },
    {
      title: "Review completion",
      value: completedReviews,
      note: hasPerformance ? `${reviewStats?.averageRating ?? 0} average rating across completed reviews.` : "Performance module is not active.",
    },
    {
      title: "Training watch",
      value: trainingExpiring,
      note: hasPerformance ? "Certificates expiring within the next 30 days." : "Training tracking is not active.",
    },
  ];

  const briefLead =
    issues > 0 || disciplinaryOpen > 0
      ? `The people module is showing both growth and friction, with workforce activity moving forward while some compliance or employee-case pressure still needs attention.`
      : `The people module is in a healthy operating state, with the main focus moving from cleanup toward growth, development, and hiring momentum.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.people} />
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />

      <DashboardShell
        section="people"
        title="People and talent cockpit"
        subtitle="A joined-up read on staff strength, hiring momentum, performance progress, and the employee signals that deserve leadership attention this week."
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/people/employees")}>
              Employee directory
            </Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate("/people/add")}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add employee
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{activeEmployees} active staff</Badge>
            <Badge variant="secondary">{issues} compliance issue{issues === 1 ? "" : "s"}</Badge>
          </>
        }
        guidance={<GuidancePanel section="people" />}
        main={
          <>
            <DashboardPanel eyebrow="Signature view" title="Workforce spectrum">
              <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="h-80 rounded-[1.5rem] border border-border/60 bg-muted/25 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workforceMap} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.35)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 16, borderColor: "hsl(var(--border))" }} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                        {workforceMap.map((entry) => (
                          <Cell key={entry.name} fill={entry.tone} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {talentSignals.map((signal) => (
                    <div key={signal.title} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{signal.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{signal.note}</p>
                        </div>
                        <p className="text-2xl font-bold tabular-nums">{signal.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel eyebrow="People temperature" title="Focus areas moving through the workforce">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Hiring",
                    value: interviewsScheduled,
                    description: "Scheduled interviews pushing the pipeline forward.",
                    path: "/people/interviews",
                    icon: Briefcase,
                  },
                  {
                    title: "Performance",
                    value: completedReviews,
                    description: "Completed reviews already closed out this cycle.",
                    path: "/people/reviews",
                    icon: Target,
                  },
                  {
                    title: "Training",
                    value: trainingExpiring,
                    description: "Certificates that will expire soon and may need renewal.",
                    path: "/people/training",
                    icon: GraduationCap,
                  },
                  {
                    title: "Employee cases",
                    value: disciplinaryOpen,
                    description: "Open or in-review disciplinary matters still visible in HR.",
                    path: "/people/disciplinary",
                    icon: ShieldAlert,
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => navigate(item.path)}
                    className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-background"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-2xl font-bold tabular-nums">{item.value}</span>
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </button>
                ))}
              </div>
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <DashboardMetricCard
              label="Active employees"
              value={activeEmployees}
              hint="Current live workforce in the system"
              icon={Users}
              toneClass="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
              onClick={() => navigate("/people/employees")}
            />
            <DashboardMetricCard
              label="Compliance issues"
              value={issues}
              hint="Employee records still missing required information"
              icon={AlertTriangle}
              toneClass="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              onClick={() => navigate("/people/employees?filter=blocking-issues")}
            />
            <DashboardMetricCard
              label="Pending leave"
              value={pendingLeave}
              hint="Requests that still need a decision"
              icon={HeartHandshake}
              toneClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300"
              onClick={() => navigate("/time-leave/leave")}
            />

            <DashboardPanel eyebrow="Action rail" title="Best next moves">
              <div className="space-y-3">
                {[
                  {
                    title: "Review employee issues",
                    description: "Clear the records most likely to create HR or payroll friction.",
                    path: "/people/employees?filter=blocking-issues",
                    icon: AlertTriangle,
                  },
                  {
                    title: "Check the interview queue",
                    description: "Keep the hiring pipeline moving while candidates are warm.",
                    path: "/people/interviews",
                    icon: Briefcase,
                  },
                  {
                    title: "Open performance reviews",
                    description: "Push review completion and close the loop on feedback.",
                    path: "/people/reviews",
                    icon: Target,
                  },
                ].map((action) => (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-background"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </DashboardPanel>
          </>
        }
        brief={
          <ModuleBrief
            section="people"
            lead={briefLead}
            columns={[
              {
                title: "What’s happening now",
                items: [
                  `${activeEmployees} employees are active in the platform right now.`,
                  `${interviewsScheduled} interviews, ${completedReviews} completed reviews, and ${goalsActive} active goals are shaping the current people workload.`,
                ],
              },
              {
                title: "Watch this week",
                items: [
                  issues > 0
                    ? `Compliance gaps in employee records can still ripple into payroll and reporting.`
                    : `Employee records are mostly clean, reducing downstream HR risk.`,
                  trainingExpiring > 0
                    ? `${trainingExpiring} certification${trainingExpiring === 1 ? "" : "s"} are nearing expiry and may affect readiness or compliance.`
                    : `No major certification expiry wave is building right now.`,
                ],
              },
              {
                title: "Actions required",
                items: [
                  pendingLeave > 0
                    ? `Resolve pending leave requests so managers and payroll are working from the same picture.`
                    : `Leave workflow is not currently creating pressure.`,
                  disciplinaryOpen > 0
                    ? `Keep open employee cases moving so they do not quietly stall in review.`
                    : `No disciplinary backlog is dominating the HR queue.`,
                ],
              },
              {
                title: "Week ahead",
                items: [
                  `Use the next few days to close any hiring follow-through and convert interviews into clear decisions.`,
                  `Keep performance momentum moving by pushing reviews, training renewals, and goal follow-up together rather than separately.`,
                ],
              },
              {
                title: "Interesting signals",
                items: [
                  reviewStats ? `Average review score across completed reviews is ${reviewStats.averageRating}.` : `Performance scoring data is still light.`,
                  hasHiring
                    ? `The hiring lane is currently carrying ${interviewsScheduled} scheduled interview${interviewsScheduled === 1 ? "" : "s"}.`
                    : `Hiring is not active for this tenant, so the people load is more about retention and development.`,
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
