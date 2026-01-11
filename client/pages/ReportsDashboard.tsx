/**
 * Reports Dashboard - Section Hub
 * Quick access to all report types
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  BarChart3,
  Users,
  DollarSign,
  CalendarDays,
  Building,
  FileSpreadsheet,
  ChevronRight,
  Download,
  TrendingUp,
  PieChart,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";

const theme = sectionThemes.reports;

const REPORT_CATEGORIES = [
  {
    id: "employee",
    title: "Employee Reports",
    description: "Headcount, turnover, demographics",
    icon: Users,
    color: "bg-blue-500",
    path: "/reports/employees",
    examples: ["Headcount by Department", "New Hires Report", "Turnover Analysis"],
  },
  {
    id: "payroll",
    title: "Payroll Reports",
    description: "Salary, taxes, deductions",
    icon: DollarSign,
    color: "bg-emerald-500",
    path: "/reports/payroll",
    examples: ["Payroll Summary", "Tax Liability", "YTD Earnings"],
  },
  {
    id: "attendance",
    title: "Attendance Reports",
    description: "Time tracking, absences, overtime",
    icon: CalendarDays,
    color: "bg-amber-500",
    path: "/reports/attendance",
    examples: ["Attendance Summary", "Overtime Report", "Late Arrivals"],
  },
  {
    id: "department",
    title: "Department Reports",
    description: "Cost centers, budgets, headcount",
    icon: Building,
    color: "bg-violet-500",
    path: "/reports/departments",
    examples: ["Department Costs", "Budget vs Actual", "Org Structure"],
  },
  {
    id: "custom",
    title: "Custom Reports",
    description: "Build your own reports",
    icon: FileSpreadsheet,
    color: "bg-pink-500",
    path: "/reports/custom",
    examples: ["Report Builder", "Saved Reports", "Scheduled Reports"],
  },
];

export default function ReportsDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.reports} />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header with Section Accent */}
        <div className={`-mx-6 px-6 py-6 mb-8 ${theme.bgSubtle} border-b ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                  Generate and export reports for all HR data
                </p>
              </div>
            </div>
            <Button variant="outline" className={`${theme.border} hover:${theme.bg}`}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg ${theme.bg} flex items-center justify-center`}>
                  <BarChart3 className={`h-6 w-6 ${theme.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">12</p>
                  <p className="text-sm text-muted-foreground">Available Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg ${theme.bg} flex items-center justify-center`}>
                  <TrendingUp className={`h-6 w-6 ${theme.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-sm text-muted-foreground">Scheduled Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={theme.borderLeft}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg ${theme.bg} flex items-center justify-center`}>
                  <PieChart className={`h-6 w-6 ${theme.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-sm text-muted-foreground">Custom Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REPORT_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <Card
                key={category.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(category.path)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${category.color} flex items-center justify-center`}>
                      <CategoryIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {category.examples.map((example, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted"
                      >
                        <span className="text-muted-foreground">{example}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
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
