import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Users,
  UserPlus,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Building,
  Briefcase,
  Plus,
  ChevronRight,
} from "lucide-react";

function HiringDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Header Skeleton */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-5 w-72" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  <Skeleton className="h-9 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-6 w-36 mb-2" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions Skeleton */}
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HiringDashboard() {
  const navigate = useNavigate();

  const stats = [
    {
      title: "Open Positions",
      value: "12",
      subtitle: "+3 this month",
      icon: Building,
    },
    {
      title: "Total Applications",
      value: "247",
      subtitle: "+18 this week",
      icon: FileText,
    },
    {
      title: "Interviews Scheduled",
      value: "8",
      subtitle: "Next 7 days",
      icon: Calendar,
    },
    {
      title: "Pending Offers",
      value: "5",
      subtitle: "Awaiting response",
      icon: Clock,
    },
  ];

  const recentActivity = [
    {
      icon: CheckCircle,
      title: "Sarah Johnson hired",
      subtitle: "Senior Software Engineer position filled",
      status: "Completed",
      statusColor: "bg-primary/10 text-primary",
    },
    {
      icon: Calendar,
      title: "3 interviews scheduled",
      subtitle: "Product Manager candidates",
      status: "Scheduled",
      statusColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      icon: Users,
      title: "New job posted",
      subtitle: "Marketing Specialist - Remote",
      status: "Active",
      statusColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      icon: FileText,
      title: "Application surge",
      subtitle: "UX Designer position - 45 new applications",
      status: "Trending",
      statusColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
  ];

  const pipelineStages = [
    { stage: "Applications Received", count: 47, color: "bg-muted-foreground" },
    { stage: "Phone Screening", count: 12, color: "bg-blue-500" },
    { stage: "Technical Interview", count: 8, color: "bg-orange-500" },
    { stage: "Final Interview", count: 5, color: "bg-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Clean Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Hiring Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  Overview of recruitment and hiring activities
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  View Applications
                </Button>
                <Button
                  onClick={() => navigate("/people/jobs")}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Post New Job
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </span>
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
                    <CardDescription>Latest updates in hiring</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <activity.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.subtitle}
                        </p>
                      </div>
                      <Badge variant="secondary" className={activity.statusColor}>
                        {activity.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Hiring Pipeline</CardTitle>
                    <CardDescription>Candidates by stage</CardDescription>
                  </div>
                  <Badge variant="secondary">72 total</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pipelineStages.map((stage, index) => {
                    const percentage = Math.round((stage.count / 72) * 100);
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{stage.stage}</span>
                          <span className="text-muted-foreground">{stage.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stage.color} rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Create Job", icon: Briefcase, path: "/people/jobs" },
                { label: "Candidates", icon: Users, path: "/people/candidates" },
                { label: "Interviews", icon: Calendar, path: "/people/interviews" },
                { label: "Onboarding", icon: UserPlus, path: "/people/onboarding" },
                { label: "Offboarding", icon: Users, path: "/people/offboarding" },
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
