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
import { useI18n } from "@/i18n/I18nProvider";

const theme = sectionThemes.reports;

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const reportCategories = [
    {
      id: "employee",
      title: t("reports.dashboard.categories.employee.title"),
      description: t("reports.dashboard.categories.employee.description"),
      icon: Users,
      color: "bg-blue-500",
      path: "/reports/employees",
      examples: [
        t("reports.dashboard.categories.employee.examples.headcount"),
        t("reports.dashboard.categories.employee.examples.newHires"),
        t("reports.dashboard.categories.employee.examples.turnover"),
      ],
    },
    {
      id: "payroll",
      title: t("reports.dashboard.categories.payroll.title"),
      description: t("reports.dashboard.categories.payroll.description"),
      icon: DollarSign,
      color: "bg-emerald-500",
      path: "/reports/payroll",
      examples: [
        t("reports.dashboard.categories.payroll.examples.summary"),
        t("reports.dashboard.categories.payroll.examples.tax"),
        t("reports.dashboard.categories.payroll.examples.ytd"),
      ],
    },
    {
      id: "attendance",
      title: t("reports.dashboard.categories.attendance.title"),
      description: t("reports.dashboard.categories.attendance.description"),
      icon: CalendarDays,
      color: "bg-amber-500",
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
      color: "bg-violet-500",
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
      color: "bg-pink-500",
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
                <h1 className="text-3xl font-bold tracking-tight">
                  {t("reports.dashboard.title")}
                </h1>
                <p className="text-muted-foreground">
                  {t("reports.dashboard.subtitle")}
                </p>
              </div>
            </div>
            <Button variant="outline" className={`${theme.border} hover:${theme.bg}`}>
              <Download className="h-4 w-4 mr-2" />
              {t("reports.dashboard.actions.exportAll")}
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
                  <p className="text-sm text-muted-foreground">
                    {t("reports.dashboard.stats.available")}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    {t("reports.dashboard.stats.scheduled")}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    {t("reports.dashboard.stats.custom")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportCategories.map((category) => {
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
