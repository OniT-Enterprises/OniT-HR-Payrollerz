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

const theme = sectionThemes.people;

// Section cards configuration
const SECTIONS = [
  {
    id: "staff",
    title: "Staff Management",
    description: "Employees, departments, org chart",
    icon: Users,
    color: "bg-blue-500",
    links: [
      { label: "All Employees", path: "/people/employees", icon: Users },
      { label: "Add Employee", path: "/people/add", icon: UserPlus },
      { label: "Departments", path: "/people/departments", icon: Building },
      { label: "Org Chart", path: "/people/org-chart", icon: Building2 },
    ],
  },
  {
    id: "hiring",
    title: "Hiring & Recruitment",
    description: "Jobs, candidates, onboarding",
    icon: Briefcase,
    color: "bg-violet-500",
    links: [
      { label: "Job Postings", path: "/people/jobs", icon: Briefcase },
      { label: "Candidates", path: "/people/candidates", icon: UserCheck },
      { label: "Interviews", path: "/people/interviews", icon: Calendar },
      { label: "Onboarding", path: "/people/onboarding", icon: UserPlus },
    ],
  },
  {
    id: "time",
    title: "Time & Leave",
    description: "Attendance, leave, schedules",
    icon: Clock,
    color: "bg-emerald-500",
    links: [
      { label: "Time Tracking", path: "/people/time-tracking", icon: Clock },
      { label: "Attendance", path: "/people/attendance", icon: CalendarDays },
      { label: "Leave Requests", path: "/people/leave", icon: Heart },
      { label: "Shift Schedules", path: "/people/schedules", icon: Calendar },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    description: "Goals, reviews, training",
    icon: Target,
    color: "bg-amber-500",
    links: [
      { label: "Goals & OKRs", path: "/people/goals", icon: Target },
      { label: "Reviews", path: "/people/reviews", icon: Award },
      { label: "Training", path: "/people/training", icon: GraduationCap },
      { label: "Disciplinary", path: "/people/disciplinary", icon: Shield },
    ],
  },
];

export default function PeopleDashboard() {
  const navigate = useNavigate();
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

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header with Section Accent */}
        <div className={`-mx-6 px-6 py-6 mb-8 ${theme.bgSubtle} border-b ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">People</h1>
                <p className="text-muted-foreground">
                  Manage your team, hiring, time off, and performance
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/people/add")} size="lg" className={`bg-gradient-to-r ${theme.gradient} hover:opacity-90`}>
              <UserPlus className="h-5 w-5 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/employees")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-sm text-muted-foreground">Active Employees</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <Users className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/departments")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.departments}</p>
                  <p className="text-sm text-muted-foreground">Departments</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <Building className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${theme.borderLeft}`} onClick={() => navigate("/people/leave")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-sm text-muted-foreground">Pending Leave</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <Heart className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
              {stats.pendingLeave > 0 && (
                <Badge className={`mt-2 ${theme.bg} ${theme.text}`}>Needs Review</Badge>
              )}
            </CardContent>
          </Card>

          <Card className={`${theme.borderLeft}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.onLeaveToday}</p>
                  <p className="text-sm text-muted-foreground">On Leave Today</p>
                </div>
                <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                  <CalendarDays className={`h-6 w-6 ${theme.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            return (
              <Card key={section.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${section.color} flex items-center justify-center`}>
                      <SectionIcon className="h-5 w-5 text-white" />
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
