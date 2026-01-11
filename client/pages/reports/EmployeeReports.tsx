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
import { Users, Download } from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

export default function EmployeeReports() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.employeeReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("reports.employee.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("reports.employee.subtitle")}
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
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.employee.directory.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.employee.directory.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.employee.directory.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.employee.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.employee.performance.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.employee.performance.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.employee.performance.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.employee.actions.generate")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.employee.training.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.employee.training.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.employee.training.body")}
                </p>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  {t("reports.employee.actions.generate")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
