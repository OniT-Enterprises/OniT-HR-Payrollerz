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

const theme = sectionThemes.accounting;

// Accounting module links
const ACCOUNTING_LINKS = [
  {
    id: "chart-of-accounts",
    title: "Chart of Accounts",
    description: "Manage account structure and categories",
    icon: BookOpen,
    color: "bg-blue-500",
    path: "/accounting/chart-of-accounts",
    primary: true,
  },
  {
    id: "journal-entries",
    title: "Journal Entries",
    description: "Record and review transactions",
    icon: FileSpreadsheet,
    color: "bg-emerald-500",
    path: "/accounting/journal-entries",
  },
  {
    id: "general-ledger",
    title: "General Ledger",
    description: "Complete transaction history by account",
    icon: Landmark,
    color: "bg-violet-500",
    path: "/accounting/general-ledger",
  },
  {
    id: "trial-balance",
    title: "Trial Balance",
    description: "Verify debits equal credits",
    icon: Scale,
    color: "bg-amber-500",
    path: "/accounting/trial-balance",
  },
  {
    id: "reports",
    title: "Financial Reports",
    description: "Income statement, balance sheet",
    icon: BarChart3,
    color: "bg-pink-500",
    path: "/accounting/reports",
  },
];

// Quick stats (would come from accounting service in real app)
const QUICK_STATS = [
  {
    label: "Total Assets",
    value: "$245,000",
    icon: DollarSign,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    label: "Total Liabilities",
    value: "$82,500",
    icon: ArrowUpDown,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  {
    label: "Net Income (MTD)",
    value: "$18,450",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    label: "Pending Entries",
    value: "3",
    icon: FileSpreadsheet,
    color: "text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
];

export default function AccountingDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header with Section Accent */}
        <div className={`-mx-6 px-6 py-6 mb-8 ${theme.bgSubtle} border-b ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}>
                <Landmark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
                <p className="text-muted-foreground">
                  Manage your books, ledgers, and financial reports
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/accounting/journal-entries")} className={`bg-gradient-to-r ${theme.gradient} hover:opacity-90`}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {QUICK_STATS.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Card key={stat.label} className={theme.borderLeft}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-full ${theme.bg} flex items-center justify-center`}>
                      <StatIcon className={`h-6 w-6 ${theme.text}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Accounting Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_LINKS.map((link) => {
            const LinkIcon = link.icon;
            return (
              <Card
                key={link.id}
                className={`cursor-pointer hover:shadow-md transition-all ${
                  link.primary ? "ring-2 ring-primary/20" : ""
                }`}
                onClick={() => navigate(link.path)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg ${link.color} flex items-center justify-center flex-shrink-0`}>
                      <LinkIcon className="h-6 w-6 text-white" />
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
              Double-Entry Accounting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Assets = Liabilities + Equity</p>
                <p className="text-muted-foreground">The fundamental accounting equation</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Debits & Credits</p>
                <p className="text-muted-foreground">Every transaction affects at least 2 accounts</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-1">Trial Balance</p>
                <p className="text-muted-foreground">Total debits must equal total credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
