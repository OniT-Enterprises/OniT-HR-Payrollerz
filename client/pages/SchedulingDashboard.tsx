import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { SEO } from "@/components/SEO";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { ChartTooltip, chartHoverCursor } from "@/components/dashboard/ChartTooltip";
import { ModuleBrief } from "@/components/dashboard/ModuleBrief";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clock,
  HeartHandshake,
  UserCheck,
} from "lucide-react";

function SchedulingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <ModuleSectionNav config={timeLeaveNavConfig} />
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function SchedulingDashboard() {
  const navigate = useNavigate();
  const { data: employeeSummary, isLoading: employeeLoading } = useActiveEmployeeSummary();
  const { data: leaveStats, isLoading: leaveLoading } = useLeaveStats();

  if (employeeLoading || leaveLoading) {
    return <SchedulingDashboardSkeleton />;
  }

  const activeEmployees = employeeSummary?.active ?? 0;
  const onLeaveToday = leaveStats?.employeesOnLeaveToday ?? 0;
  const pendingLeave = leaveStats?.pendingRequests ?? 0;
  const availableToday = Math.max(activeEmployees - onLeaveToday, 0);
  const attendanceRate = activeEmployees > 0 ? Math.round((availableToday / activeEmployees) * 100) : 100;

  const coverageBars = [
    { name: "Available", value: availableToday, tone: "#06b6d4" },
    { name: "On leave", value: onLeaveToday, tone: "#f59e0b" },
    { name: "Pending leave", value: pendingLeave, tone: "#8b5cf6" },
    { name: "Active team", value: activeEmployees, tone: "#10b981" },
  ];

  const briefLead =
    pendingLeave > 0
      ? `Time and leave is mostly stable, but approval decisions are still sitting in the workflow and could change staffing coverage in the coming days.`
      : `Time and leave is in a healthy operating state, with coverage looking steady and no visible queue building in approvals.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Time & Leave Dashboard" description="Coverage, attendance, leave pressure, and scheduling priorities in one place." />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      <DashboardShell
        section="scheduling"
        title="Time & Leave Dashboard"
        subtitle="A live read on who is available, where leave pressure is building, and which scheduling actions will keep the week running smoothly."
        icon={Clock}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/time-leave/attendance")}>
              Attendance
            </Button>
            <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => navigate("/time-leave/shifts")}>
              <Calendar className="mr-2 h-4 w-4" />
              Shift schedules
            </Button>
          </>
        }
        badges={
          <>
            <Badge variant="secondary">{attendanceRate}% coverage today</Badge>
            <Badge variant="secondary">{pendingLeave} pending request{pendingLeave === 1 ? "" : "s"}</Badge>
          </>
        }
        main={
          <>
            <DashboardPanel eyebrow="Signature view" title="Coverage map">
              <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="h-80 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coverageBars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.35)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        cursor={chartHoverCursor}
                        content={<ChartTooltip valueLabel="staff" />}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                        {coverageBars.map((entry) => (
                          <Cell key={entry.name} fill={entry.tone} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      title: "Coverage today",
                      value: `${attendanceRate}%`,
                      note: `${availableToday} of ${activeEmployees} active staff appear available today.`,
                    },
                    {
                      title: "Leave workload",
                      value: pendingLeave,
                      note: pendingLeave > 0 ? "Approvals are waiting and can still change the schedule." : "The leave approval queue is quiet.",
                    },
                    {
                      title: "Leave in use",
                      value: onLeaveToday,
                      note: "People already out of coverage today because of approved leave.",
                    },
                  ].map((signal) => (
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

            <DashboardPanel eyebrow="Week focus" title="Scheduling priorities">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Attendance",
                    value: attendanceRate,
                    suffix: "%",
                    description: "Quick read on available coverage for the current day.",
                    path: "/time-leave/attendance",
                    icon: CalendarCheck,
                  },
                  {
                    title: "Leave queue",
                    value: pendingLeave,
                    suffix: "",
                    description: "Requests still waiting on a human decision.",
                    path: "/time-leave/leave",
                    icon: CalendarDays,
                  },
                  {
                    title: "Time tracking",
                    value: activeEmployees,
                    suffix: "",
                    description: "Staff whose time records drive hours and shift confidence.",
                    path: "/time-leave/time-tracking",
                    icon: Clock,
                  },
                  {
                    title: "Shift planning",
                    value: availableToday,
                    suffix: "",
                    description: "People available today who can still be placed or moved.",
                    path: "/time-leave/shifts",
                    icon: UserCheck,
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => navigate(item.path)}
                    className="group rounded-2xl border border-border/60 bg-muted/25 p-5 text-left transition-all hover:border-cyan-400/40 hover:bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">{item.title}</p>
                    </div>
                    <p className="mt-4 text-3xl font-bold tabular-nums leading-none">
                      {item.value}
                      <span className="text-xl text-muted-foreground">{item.suffix}</span>
                    </p>
                    <p className="mt-2 text-sm leading-snug text-muted-foreground">
                      {item.description}
                    </p>
                  </button>
                ))}
              </div>
            </DashboardPanel>
          </>
        }
        rail={
          <>
            <DashboardMetricCard
              label="Attendance rate"
              value={`${attendanceRate}%`}
              hint="Available team compared with active headcount"
              icon={CalendarCheck}
              toneClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300"
              onClick={() => navigate("/time-leave/attendance")}
            />
            <DashboardMetricCard
              label="On leave today"
              value={onLeaveToday}
              hint="Approved leave already affecting coverage"
              icon={CalendarDays}
              toneClass="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              onClick={() => navigate("/time-leave/leave")}
            />
            <DashboardMetricCard
              label="Pending leave"
              value={pendingLeave}
              hint="Requests still waiting for action"
              icon={HeartHandshake}
              toneClass="bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
              onClick={() => navigate("/time-leave/leave")}
            />

            <DashboardPanel eyebrow="Action rail" title="Best next moves">
              <div className="space-y-3">
                {[
                  {
                    title: "Review leave approvals",
                    description: "Clear the queue before it starts to distort next week’s cover.",
                    path: "/time-leave/leave",
                    icon: CalendarDays,
                  },
                  {
                    title: "Check attendance",
                    description: "Compare today’s actual presence with what the roster expected.",
                    path: "/time-leave/attendance",
                    icon: CalendarCheck,
                  },
                  {
                    title: "Adjust shifts",
                    description: "Use availability to rebalance the schedule where needed.",
                    path: "/time-leave/shifts",
                    icon: Calendar,
                  },
                ].map((action) => (
                  <button
                    key={action.title}
                    onClick={() => navigate(action.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-background"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
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
            section="scheduling"
            lead={briefLead}
            columns={[
              {
                title: "What’s happening now",
                items: [
                  `${availableToday} people appear available today out of ${activeEmployees} active staff.`,
                  `${onLeaveToday} people are already off on approved leave, and ${pendingLeave} request${pendingLeave === 1 ? "" : "s"} are still undecided.`,
                ],
              },
              {
                title: "Watch this week",
                items: [
                  pendingLeave > 0
                    ? `Pending approvals are the main variable likely to move coverage this week.`
                    : `Leave demand is calm, so the biggest focus is staying on top of actual attendance.`,
                ],
              },
              {
                title: "Actions required",
                items: [
                  pendingLeave > 0
                    ? `Decide leave requests quickly so managers can plan confidently.`
                    : `No urgent leave queue cleanup is required right now.`,
                  `Use attendance and roster views together rather than in isolation so gaps show up early.`,
                ],
              },
              {
                title: "Week ahead",
                items: [
                  `Keep next week’s shift plan flexible where staffing is already thin.`,
                  `Look for any pattern where approved leave and attendance drift are combining to squeeze the same teams repeatedly.`,
                ],
              },
              {
                title: "Interesting signals",
                items: [
                  `Today’s live coverage is tracking at ${attendanceRate}% of active headcount.`,
                  availableToday >= onLeaveToday
                    ? `Availability is still comfortably higher than current leave usage.`
                    : `Leave and absence pressure are starting to bite into available capacity.`,
                ],
              },
            ]}
          />
        }
      />
    </div>
  );
}
