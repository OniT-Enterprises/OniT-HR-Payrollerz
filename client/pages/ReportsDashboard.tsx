/**
 * Reports Dashboard - Section Hub
 * Quick access to all report types with visual hierarchy
 * Payroll reports = most used, Employee = second, others = less frequent
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  Download,
  Clock,
  FileText,
  Play,
  Settings2,
  History,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

const theme = sectionThemes.reports;

// Recent reports - would come from Firestore in production
const recentReports = [
  { id: 1, name: "Payroll Summary", period: "Jan 2026", date: "2026-01-15", type: "payroll" },
  { id: 2, name: "Tax Liability (WIT/INSS)", period: "Dec 2025", date: "2026-01-10", type: "payroll" },
  { id: 3, name: "Attendance Summary", period: "Week 2", date: "2026-01-12", type: "attendance" },
  { id: 4, name: "Employee Directory", period: "Current", date: "2026-01-08", type: "employee" },
];

// Scheduled reports - automation config
const scheduledReports = [
  { id: 1, name: "Monthly Payroll Summary", frequency: "1st of month", nextRun: "Feb 1", enabled: true },
  { id: 2, name: "Weekly Attendance", frequency: "Every Monday", nextRun: "Jan 20", enabled: true },
  { id: 3, name: "Quarterly Tax Report", frequency: "Quarterly", nextRun: "Apr 1", enabled: false },
];

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [showOtherCategories, setShowOtherCategories] = useState(false);

  // Primary categories (most used) - Payroll first, then Employee
  const primaryCategories = [
    {
      id: "payroll",
      title: t("reports.dashboard.categories.payroll.title"),
      description: t("reports.dashboard.categories.payroll.description"),
      icon: DollarSign,
      path: "/reports/payroll",
      primary: true,
      examples: [
        t("reports.dashboard.categories.payroll.examples.summary"),
        t("reports.dashboard.categories.payroll.examples.tax"),
        t("reports.dashboard.categories.payroll.examples.ytd"),
      ],
    },
    {
      id: "employee",
      title: t("reports.dashboard.categories.employee.title"),
      description: t("reports.dashboard.categories.employee.description"),
      icon: Users,
      path: "/reports/employees",
      primary: true,
      examples: [
        t("reports.dashboard.categories.employee.examples.headcount"),
        t("reports.dashboard.categories.employee.examples.newHires"),
        t("reports.dashboard.categories.employee.examples.turnover"),
      ],
    },
  ];

  // Secondary categories (less frequently used)
  const secondaryCategories = [
    {
      id: "attendance",
      title: t("reports.dashboard.categories.attendance.title"),
      description: t("reports.dashboard.categories.attendance.description"),
      icon: CalendarDays,
      path: "/reports/attendance",
      examples: [
        t("reports.dashboard.categories.attendance.examples.summary"),
        t("reports.dashboard.categories.attendance.examples.overtime"),
        t("reports.dashboard.categories.attendance.examples.late"),
      ],
    },
    {
      id: "department",
      title: t("reports.dashboard.categories.department.title"),
      description: t("reports.dashboard.categories.department.description"),
      icon: Building,
      path: "/reports/departments",
      examples: [
        t("reports.dashboard.categories.department.examples.costs"),
        t("reports.dashboard.categories.department.examples.budget"),
        t("reports.dashboard.categories.department.examples.org"),
      ],
    },
    {
      id: "custom",
      title: t("reports.dashboard.categories.custom.title"),
      description: t("reports.dashboard.categories.custom.description"),
      icon: FileSpreadsheet,
      path: "/reports/custom",
      examples: [
        t("reports.dashboard.categories.custom.examples.builder"),
        t("reports.dashboard.categories.custom.examples.saved"),
        t("reports.dashboard.categories.custom.examples.scheduled"),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.reports} />
      <MainNavigation />

      {/* Hero Section - Simplified */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("reports.dashboard.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("reports.dashboard.subtitle")}
                </p>
              </div>
            </div>
            {/* Export demoted to secondary dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem className="text-muted-foreground">
                  <Download className="h-4 w-4 mr-2" />
                  All Reports (ZIP)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-8">

        {/* Recent Reports - Smart quick access */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recent Reports</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {recentReports.map((report) => (
              <Card
                key={report.id}
                className="cursor-pointer hover:shadow-sm hover:border-violet-300 dark:hover:border-violet-700 transition-all"
                onClick={() => navigate(`/reports/${report.type}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{report.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{report.period}</p>
                    </div>
                    <Play className="h-4 w-4 text-violet-500" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Divider - Run Reports vs Automation */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generate Reports</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Primary Categories - Payroll (largest) and Employee (second) */}
        <section>
          <div className="grid gap-6 md:grid-cols-2">
            {primaryCategories.map((category, index) => {
              const CategoryIcon = category.icon;
              const isPayroll = category.id === "payroll";
              return (
                <Card
                  key={category.id}
                  className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
                    isPayroll
                      ? "border-l-emerald-500 hover:border-l-emerald-600 md:row-span-1"
                      : "border-l-blue-500 hover:border-l-blue-600"
                  }`}
                  onClick={() => navigate(category.path)}
                >
                  <CardHeader className={isPayroll ? "pb-4" : "pb-3"}>
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg flex items-center justify-center ${
                        isPayroll
                          ? "h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30"
                          : "h-10 w-10 bg-blue-100 dark:bg-blue-900/30"
                      }`}>
                        <CategoryIcon className={`${
                          isPayroll
                            ? "h-6 w-6 text-emerald-600 dark:text-emerald-400"
                            : "h-5 w-5 text-blue-600 dark:text-blue-400"
                        }`} />
                      </div>
                      <div>
                        <CardTitle className={isPayroll ? "text-xl" : "text-lg"}>
                          {category.title}
                          {isPayroll && (
                            <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                              Most Used
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {category.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-muted"
                        >
                          <span>{example}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Secondary Categories - Collapsible */}
        <Collapsible open={showOtherCategories} onOpenChange={setShowOtherCategories}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronRight className={`h-4 w-4 transition-transform ${showOtherCategories ? "rotate-90" : ""}`} />
            <span>More Report Categories</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{secondaryCategories.length}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {secondaryCategories.map((category) => {
                const CategoryIcon = category.icon;
                return (
                  <Card
                    key={category.id}
                    className="cursor-pointer hover:shadow-sm transition-shadow border-l-2 border-l-muted-foreground/20 hover:border-l-violet-400"
                    onClick={() => navigate(category.path)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{category.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground mb-2">{category.description}</p>
                      <div className="space-y-1">
                        {category.examples.slice(0, 2).map((example, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted"
                          >
                            <span className="text-muted-foreground">{example}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Divider - Automation Section */}
        <div className="flex items-center gap-4 pt-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Automated Reports</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Scheduled Reports - Automation */}
        <section>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Scheduled Reports</CardTitle>
                    <CardDescription>Reports that run automatically on a schedule</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/reports/custom")}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scheduledReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scheduled reports yet. Set up automated reports in Custom Reports.
                </p>
              ) : (
                <div className="divide-y">
                  {scheduledReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${report.enabled ? "bg-green-500" : "bg-gray-300"}`} />
                        <div>
                          <p className="text-sm font-medium">{report.name}</p>
                          <p className="text-xs text-muted-foreground">{report.frequency}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next run</p>
                        <p className="text-sm">{report.nextRun}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
