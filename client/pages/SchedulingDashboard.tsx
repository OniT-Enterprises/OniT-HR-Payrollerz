/**
 * Scheduling Dashboard - Time & Leave Command Center
 * Answers: "Who's here today, and what needs attention?"
 * Structure: Hero → KPIs → Quick Nav
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import {
  Clock,
  Calendar,
  CalendarDays,
  UserCheck,
  ChevronRight,
  Heart,
  Users,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";
import { useI18n } from "@/i18n/I18nProvider";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import MoreDetailsSection from "@/components/MoreDetailsSection";

const _theme = sectionThemes.scheduling;

function SchedulingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="mx-auto max-w-screen-2xl px-6 py-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 mx-auto max-w-screen-2xl">
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-7 w-10 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchedulingDashboard() {
  const navigate = useNavigate();
  const { t: _t } = useI18n();
  const { data: employeeSummary, isLoading: employeesLoading } = useActiveEmployeeSummary();
  const { data: leaveStats, isLoading: leaveStatsLoading } = useLeaveStats();
  const loading = employeesLoading || leaveStatsLoading;

  const stats = useMemo(
    () => ({
      activeEmployees: employeeSummary?.active ?? 0,
      pendingLeave: leaveStats?.pendingRequests ?? 0,
      onLeaveToday: leaveStats?.employeesOnLeaveToday ?? 0,
    }),
    [employeeSummary?.active, leaveStats]
  );

  const attendanceRate = stats.activeEmployees > 0
    ? Math.round(((stats.activeEmployees - stats.onLeaveToday) / stats.activeEmployees) * 100)
    : 100;

  if (loading) {
    return <SchedulingDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Scheduling & Attendance"
        description="Manage time tracking, attendance, leave requests, and shift schedules."
        url="/time-leave"
      />
      <MainNavigation />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="mx-auto max-w-screen-2xl px-6 py-5">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Time & Leave
                </h1>
                <p className="text-muted-foreground mt-1">
                  Scheduling, attendance, and leave management
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 mx-auto max-w-screen-2xl">
        <GuidancePanel section="scheduling" />

        <MoreDetailsSection className="mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate("/time-leave/attendance")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{attendanceRate}%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Attendance Today
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate("/time-leave/leave")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Pending Leave
                  </p>
                  {stats.pendingLeave > 0 && (
                    <Badge className="mt-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                      Needs review
                    </Badge>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  stats.pendingLeave > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                }`}>
                  <Heart className={`h-5 w-5 ${stats.pendingLeave > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate("/time-leave/attendance")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.onLeaveToday}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    On Leave Today
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all"
            onClick={() => navigate("/time-leave/shifts")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Active Staff
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </MoreDetailsSection>

        {/* Section tools */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: "Time Tracking",
              desc: "Clock in/out records, hours worked, overtime. Import from fingerprint devices or enter manually.",
              path: "/time-leave/time-tracking",
              icon: Clock,
              color: "from-cyan-500 to-teal-500",
              bgHover: "hover:border-cyan-500/40",
            },
            {
              label: "Attendance",
              desc: "Daily attendance by employee. See who's present, late, or absent. Mark attendance and export reports.",
              path: "/time-leave/attendance",
              icon: Calendar,
              color: "from-emerald-500 to-green-500",
              bgHover: "hover:border-emerald-500/40",
            },
            {
              label: "Leave Requests",
              desc: "Review and approve leave. Track annual, sick, maternity, and other leave balances per employee.",
              path: "/time-leave/leave",
              icon: CalendarDays,
              color: "from-amber-500 to-orange-500",
              bgHover: "hover:border-amber-500/40",
            },
            {
              label: "Shift Schedules",
              desc: "Plan weekly rosters. Assign shifts by department, publish drafts, and use templates to save time.",
              path: "/time-leave/shifts",
              icon: UserCheck,
              color: "from-violet-500 to-purple-500",
              bgHover: "hover:border-violet-500/40",
            },
          ].map((link) => (
            <Card
              key={link.path}
              className={`cursor-pointer transition-all ${link.bgHover} hover:shadow-md group`}
              onClick={() => navigate(link.path)}
            >
              <CardContent className="flex items-start gap-4 pt-5 pb-5">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${link.color} shrink-0`}>
                  <link.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{link.label}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {link.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
