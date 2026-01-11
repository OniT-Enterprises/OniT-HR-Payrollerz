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
import { BarChart3, FileText, TrendingUp } from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

export default function CustomReports() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.customReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("reports.custom.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("reports.custom.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Custom Report Builder */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.custom.builder.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.custom.builder.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.custom.builder.body")}
                </p>
                <Button className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t("reports.custom.actions.build")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.custom.saved.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.custom.saved.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.custom.saved.body")}
                </p>
                <Button className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("reports.custom.actions.viewSaved")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  {t("reports.custom.analytics.title")}
                </CardTitle>
                <CardDescription>
                  {t("reports.custom.analytics.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("reports.custom.analytics.body")}
                </p>
                <Button className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {t("reports.custom.actions.createDashboard")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
