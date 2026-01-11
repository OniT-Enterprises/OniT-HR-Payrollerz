/**
 * Accounting Dashboard - Section Hub
 * Quick access to all accounting features
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Landmark,
  BookOpen,
  FileSpreadsheet,
  Scale,
  BarChart3,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Calculator,
  ArrowUpDown,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

const theme = sectionThemes.accounting;

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const accountingLinks = [
    {
      id: "chart-of-accounts",
      title: t("accounting.dashboard.links.chart.title"),
      description: t("accounting.dashboard.links.chart.description"),
      icon: BookOpen,
      path: "/accounting/chart-of-accounts",
      primary: true,
    },
    {
      id: "journal-entries",
      title: t("accounting.dashboard.links.journal.title"),
      description: t("accounting.dashboard.links.journal.description"),
      icon: FileSpreadsheet,
      path: "/accounting/journal-entries",
    },
    {
      id: "general-ledger",
      title: t("accounting.dashboard.links.ledger.title"),
      description: t("accounting.dashboard.links.ledger.description"),
      icon: Landmark,
      path: "/accounting/general-ledger",
    },
    {
      id: "trial-balance",
      title: t("accounting.dashboard.links.trial.title"),
      description: t("accounting.dashboard.links.trial.description"),
      icon: Scale,
      path: "/accounting/trial-balance",
    },
    {
      id: "reports",
      title: t("accounting.dashboard.links.reports.title"),
      description: t("accounting.dashboard.links.reports.description"),
      icon: BarChart3,
      path: "/accounting/reports",
    },
  ];

  const quickStats = [
    {
      label: t("accounting.dashboard.stats.assets"),
      value: "$245,000",
      icon: DollarSign,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: t("accounting.dashboard.stats.liabilities"),
      value: "$82,500",
      icon: ArrowUpDown,
      iconColor: "text-red-600",
      iconBg: "bg-red-100 dark:bg-red-900/30",
    },
    {
      label: t("accounting.dashboard.stats.netIncome"),
      value: "$18,450",
      icon: TrendingUp,
      iconColor: "text-green-600",
      iconBg: "bg-green-100 dark:bg-green-900/30",
    },
    {
      label: t("accounting.dashboard.stats.pendingEntries"),
      value: "3",
      icon: FileSpreadsheet,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <Landmark className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("accounting.dashboard.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.dashboard.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/accounting/journal-entries")} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t("accounting.dashboard.actions.newEntry")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {quickStats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Card key={stat.label} className={theme.borderLeft}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                      <StatIcon className={`h-6 w-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Accounting Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountingLinks.map((link) => {
            const LinkIcon = link.icon;
            return (
              <Card
                key={link.id}
                className={`cursor-pointer hover:shadow-md transition-all border-l-4 border-l-orange-500/50 hover:border-l-orange-500 ${
                  link.primary ? "ring-2 ring-orange-500/20" : ""
                }`}
                onClick={() => navigate(link.path)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <LinkIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Double-Entry Accounting Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t("accounting.dashboard.doubleEntry.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">
                  {t("accounting.dashboard.doubleEntry.assetsTitle")}
                </p>
                <p className="text-muted-foreground">
                  {t("accounting.dashboard.doubleEntry.assetsDesc")}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">
                  {t("accounting.dashboard.doubleEntry.debitsTitle")}
                </p>
                <p className="text-muted-foreground">
                  {t("accounting.dashboard.doubleEntry.debitsDesc")}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">
                  {t("accounting.dashboard.doubleEntry.trialTitle")}
                </p>
                <p className="text-muted-foreground">
                  {t("accounting.dashboard.doubleEntry.trialDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
