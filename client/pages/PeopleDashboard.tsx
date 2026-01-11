/**
 * People Dashboard - Section Hub
 * Quick access to all people-related features
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { leaveService } from "@/services/leaveService";
import {
  Users,
  UserPlus,
  Building,
  Building2,
  Briefcase,
  UserCheck,
  Calendar,
  Clock,
  CalendarDays,
  Heart,
  Target,
  Award,
  GraduationCap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

const theme = sectionThemes.people;

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    pendingLeave: 0,
    onLeaveToday: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [employees, departments, leaveStats] = await Promise.all([
        employeeService.getAllEmployees(),
        departmentService.getAllDepartments(),
        leaveService.getLeaveStats(),
      ]);

      setStats({
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => e.status === "active").length,
        departments: departments.length,
        pendingLeave: leaveStats.pendingRequests,
        onLeaveToday: leaveStats.employeesOnLeaveToday,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: "staff",
      title: t("people.dashboard.sections.staff.title"),
      description: t("people.dashboard.sections.staff.description"),
      icon: Users,
      color: "bg-blue-500",
      links: [
        {
          label: t("people.dashboard.sections.staff.links.allEmployees"),
          path: "/people/employees",
          icon: Users,
        },
        {
          label: t("people.dashboard.sections.staff.links.addEmployee"),
          path: "/people/add",
          icon: UserPlus,
        },
        {
          label: t("people.dashboard.sections.staff.links.departments"),
          path: "/people/departments",
          icon: Building,
        },
        {
          label: t("people.dashboard.sections.staff.links.orgChart"),
          path: "/people/org-chart",
          icon: Building2,
        },
      ],
    },
    {
      id: "hiring",
      title: t("people.dashboard.sections.hiring.title"),
      description: t("people.dashboard.sections.hiring.description"),
      icon: Briefcase,
      color: "bg-violet-500",
      links: [
        {
          label: t("people.dashboard.sections.hiring.links.jobPostings"),
          path: "/people/jobs",
          icon: Briefcase,
        },
        {
          label: t("people.dashboard.sections.hiring.links.candidates"),
          path: "/people/candidates",
          icon: UserCheck,
        },
        {
          label: t("people.dashboard.sections.hiring.links.interviews"),
          path: "/people/interviews",
          icon: Calendar,
        },
        {
          label: t("people.dashboard.sections.hiring.links.onboarding"),
          path: "/people/onboarding",
          icon: UserPlus,
        },
      ],
    },
    {
      id: "time",
      title: t("people.dashboard.sections.time.title"),
      description: t("people.dashboard.sections.time.description"),
      icon: Clock,
      color: "bg-emerald-500",
      links: [
        {
          label: t("people.dashboard.sections.time.links.timeTracking"),
          path: "/people/time-tracking",
          icon: Clock,
        },
        {
          label: t("people.dashboard.sections.time.links.attendance"),
          path: "/people/attendance",
          icon: CalendarDays,
        },
        {
          label: t("people.dashboard.sections.time.links.leaveRequests"),
          path: "/people/leave",
          icon: Heart,
        },
        {
          label: t("people.dashboard.sections.time.links.shiftSchedules"),
          path: "/people/schedules",
          icon: Calendar,
        },
      ],
    },
    {
      id: "performance",
      title: t("people.dashboard.sections.performance.title"),
      description: t("people.dashboard.sections.performance.description"),
      icon: Target,
      color: "bg-amber-500",
      links: [
        {
          label: t("people.dashboard.sections.performance.links.goalsOkrs"),
          path: "/people/goals",
          icon: Target,
        },
        {
          label: t("people.dashboard.sections.performance.links.reviews"),
          path: "/people/reviews",
          icon: Award,
        },
        {
          label: t("people.dashboard.sections.performance.links.training"),
          path: "/people/training",
          icon: GraduationCap,
        },
        {
          label: t("people.dashboard.sections.performance.links.disciplinary"),
          path: "/people/disciplinary",
          icon: Shield,
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.people} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Users className="h-8 w-8 text-white" />
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
            <Button onClick={() => navigate("/people/add")} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
              <UserPlus className="h-5 w-5 mr-2" />
              {t("people.dashboard.actions.addEmployee")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* Quick Stats - Semantic Colors */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/employees")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.activeEmployees")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/departments")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.departments}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.departments")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Building className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/leave")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.pendingLeave")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              {stats.pendingLeave > 0 && (
                <Badge className="mt-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t("people.dashboard.stats.needsReview")}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className={`${theme.borderLeft}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.onLeaveToday}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.onLeaveToday")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section Cards - Neutral Icons */}
        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <Card key={section.id} className="overflow-hidden border-l-4 border-l-blue-500/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <SectionIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {section.links.map((link) => {
                      const LinkIcon = link.icon;
                      return (
                        <Button
                          key={link.path}
                          variant="ghost"
                          className="justify-start h-11 px-3"
                          onClick={() => navigate(link.path)}
                        >
                          <LinkIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="flex-1 text-left">{link.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
