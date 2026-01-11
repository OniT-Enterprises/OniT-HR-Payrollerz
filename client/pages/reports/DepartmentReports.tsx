import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Building,
  Download,
  Users,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

export default function DepartmentReports() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.departmentReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Building className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("reports.department.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("reports.department.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Available Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.overview.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.overview.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.overview.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.performance.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.performance.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.performance.body")}
                </p>
                <Button className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.budget.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.budget.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.budget.body")}
                </p>
                <Button className="w-full">
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.staffing.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.staffing.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.staffing.body")}
                </p>
                <Button className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.growth.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.growth.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.growth.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.department.cross.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.department.cross.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.department.cross.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.department.actions.generate")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
