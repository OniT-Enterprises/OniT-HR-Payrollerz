/**
 * People Hub - Overview page linking to Staff, Hiring, and Performance sections.
 * Answers: "Who works here, and what needs attention?"
 * Structure: Hero → KPIs → Section Cards
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { peopleNavConfig } from "@/lib/moduleNav";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { getComplianceIssues } from "@/lib/employeeUtils";
import {
  Users,
  UserPlus,
  Briefcase,
  Target,
  ChevronRight,
  Heart,
  CalendarDays,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";
import { useI18n } from "@/i18n/I18nProvider";

function PeopleDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-l-4 border-l-muted">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();
  const { data: leaveStats, isLoading: leaveStatsLoading } = useLeaveStats();
  const loading = employeesLoading || leaveStatsLoading;

  const stats = useMemo(
    () => ({
      activeEmployees: employees.filter((e) => e.status === "active").length,
      pendingLeave: leaveStats?.pendingRequests ?? 0,
      onLeaveToday: leaveStats?.employeesOnLeaveToday ?? 0,
    }),
    [employees, leaveStats]
  );

  const attentionCount = useMemo(
    () => getComplianceIssues(employees).length,
    [employees],
  );

  if (loading) {
    return <PeopleDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.people} />
      <MainNavigation />
      <ModuleSectionNav config={peopleNavConfig} />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <img src="/images/illustrations/icons/icon-people.webp" alt="" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("people.dashboard.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("people.dashboard.subtitle")}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/people/add")}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              {t("people.dashboard.actions.addEmployee")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <GuidancePanel section="people" />

        {/* KPI row */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500"
            onClick={() => navigate("/people/employees")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("people.dashboard.stats.activeEmployees")}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
              stats.pendingLeave > 0 ? "border-l-amber-500" : "border-l-blue-500/50"
            }`}
            onClick={() => navigate("/time-leave/leave")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("people.dashboard.stats.pendingLeave")}
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
            className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
              attentionCount > 0 ? "border-l-amber-500" : "border-l-blue-500/50"
            }`}
            onClick={() => navigate("/people/employees")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{attentionCount}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Compliance Issues
                  </p>
                  {attentionCount > 0 ? (
                    <Badge className="mt-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                      Needs attention
                    </Badge>
                  ) : (
                    <span className="flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle className="h-3 w-3" /> All clear
                    </span>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  attentionCount > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"
                }`}>
                  {attentionCount > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer transition-all hover:border-blue-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/staff")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Staff</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Employee directory, departments, org chart, announcements, and grievances.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-emerald-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/hiring")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shrink-0">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Hiring</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Job postings, candidates, interviews, onboarding, and offboarding.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-violet-500/40 hover:shadow-md group"
            onClick={() => navigate("/people/performance")}
          >
            <CardContent className="flex items-start gap-4 pt-5 pb-5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shrink-0">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Performance</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Goals & KPIs, performance reviews, training & certifications, and disciplinary actions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
