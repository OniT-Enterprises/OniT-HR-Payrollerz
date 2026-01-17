/**
 * Accounting Dashboard - Payroll-Linked Accounting
 * Answers: "Did payroll post correctly, and do my books reconcile?"
 * NOT a full QuickBooks replacement - supports payroll, audits, reports
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Landmark,
  BookOpen,
  FileSpreadsheet,
  Scale,
  BarChart3,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Eye,
  Clock,
  FilePlus,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";

const theme = sectionThemes.accounting;

function AccountingDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-28 mb-1" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payroll → Accounting Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-24" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-14 rounded" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tools Collapsible */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-5 w-5" />
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Simulate loading delay for data fetch
  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Simulated data - in production, fetch from accounting service
  const accountingStatus = {
    payrollPosted: true,
    trialBalanced: true,
    pendingEntries: 3,
    lastReconciliation: "Jan 25, 2026",
    lastPayrollAmount: 124350,
    lastPayrollDate: "Jan 25, 2026",
  };

  // Last payroll journal entry details
  const lastPayrollEntry = {
    payrollRun: "January 2026",
    date: "Jan 25, 2026",
    totalAmount: 124350,
    entries: [
      { account: "Salary Expense", type: "debit", amount: 110000 },
      { account: "INSS Employer", type: "debit", amount: 8000 },
      { account: "Cash / Bank", type: "credit", amount: 95000 },
      { account: "WIT Payable", type: "credit", amount: 12000 },
      { account: "INSS Payable", type: "credit", amount: 11000 },
    ],
  };

  // Attention items (only show if there are issues)
  const attentionItems = accountingStatus.pendingEntries > 0
    ? [
        {
          issue: `${accountingStatus.pendingEntries} manual entries pending review`,
          action: "Review",
          path: "/accounting/journal-entries?status=pending",
        },
      ]
    : [];

  // Accounting tools (collapsed by default)
  const accountingTools = [
    {
      id: "chart-of-accounts",
      title: "Chart of Accounts",
      description: "Manage account structure",
      icon: BookOpen,
      path: "/accounting/chart-of-accounts",
    },
    {
      id: "journal-entries",
      title: "Journal Entries",
      description: "View and create entries",
      icon: FileSpreadsheet,
      path: "/accounting/journal-entries",
    },
    {
      id: "general-ledger",
      title: "General Ledger",
      description: "Account transaction history",
      icon: Landmark,
      path: "/accounting/general-ledger",
    },
    {
      id: "trial-balance",
      title: "Trial Balance",
      description: "Verify debits equal credits",
      icon: Scale,
      path: "/accounting/trial-balance",
    },
    {
      id: "reports",
      title: "Financial Reports",
      description: "Income statement, balance sheet",
      icon: BarChart3,
      path: "/accounting/reports",
    },
  ];

  if (loading) {
    return <AccountingDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <MainNavigation />

      {/* Hero Section - Simplified */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <AutoBreadcrumb className="mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <Landmark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
                <p className="text-sm text-muted-foreground">
                  Review payroll accounting and financial reports
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/accounting/journal-entries")}
              >
                <FilePlus className="h-4 w-4 mr-1.5" />
                New Entry
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                onClick={() => navigate("/accounting/journal-entries?filter=payroll")}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Review Payroll Entries
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNTING STATUS - Primary question: "Are my books OK?"
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Payroll Posted */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {accountingStatus.payrollPosted ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Payroll Entries</p>
                  <p className="text-xs text-muted-foreground">
                    {accountingStatus.payrollPosted ? "Posted" : "Not posted"}
                  </p>
                </div>
                <span className="text-lg font-bold">
                  {formatCurrencyTL(accountingStatus.lastPayrollAmount)}
                </span>
              </div>

              {/* Trial Balance */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {accountingStatus.trialBalanced ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Trial Balance</p>
                  <p className="text-xs text-muted-foreground">
                    {accountingStatus.trialBalanced ? "Balanced" : "Unbalanced"}
                  </p>
                </div>
                <Badge
                  variant={accountingStatus.trialBalanced ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {accountingStatus.trialBalanced ? "OK" : "Check"}
                </Badge>
              </div>

              {/* Pending Items */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {accountingStatus.pendingEntries === 0 ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Pending Items</p>
                  <p className="text-xs text-muted-foreground">Manual entries</p>
                </div>
                <span className={`text-lg font-bold ${
                  accountingStatus.pendingEntries > 0 ? "text-amber-600 dark:text-amber-400" : ""
                }`}>
                  {accountingStatus.pendingEntries}
                </span>
              </div>
            </div>

            {/* CTA if there are issues */}
            {(!accountingStatus.payrollPosted || !accountingStatus.trialBalanced || accountingStatus.pendingEntries > 0) && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/accounting/journal-entries")}
                >
                  Review entries
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            PAYROLL → ACCOUNTING - Shows how payroll flows to books
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="mb-6 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-orange-500" />
                  Payroll → Accounting
                </CardTitle>
                <CardDescription>Last payroll journal entry</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {lastPayrollEntry.date}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Payroll run info */}
              <div className="flex items-center justify-between text-sm pb-3 border-b border-border/50">
                <span className="font-medium">{lastPayrollEntry.payrollRun}</span>
                <span className="font-bold">{formatCurrencyTL(lastPayrollEntry.totalAmount)}</span>
              </div>

              {/* Journal entries breakdown */}
              <div className="space-y-2">
                {lastPayrollEntry.entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-1.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-14 text-xs font-medium px-2 py-0.5 rounded ${
                        entry.type === "debit"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      }`}>
                        {entry.type === "debit" ? "Debit" : "Credit"}
                      </span>
                      <span className="text-muted-foreground">{entry.account}</span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {formatCurrencyTL(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* View full entry link */}
              <div className="pt-3 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground -ml-2"
                  onClick={() => navigate("/accounting/journal-entries?filter=payroll")}
                >
                  View all payroll entries
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            ATTENTION REQUIRED - Only shows when there are issues
        ═══════════════════════════════════════════════════════════════ */}
        {attentionItems.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {attentionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 hover:border-amber-500/30 transition-colors cursor-pointer"
                    onClick={() => navigate(item.path)}
                  >
                    <span className="text-sm">{item.issue}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 dark:text-amber-400"
                    >
                      {item.action}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNTING TOOLS - Collapsed by default
        ═══════════════════════════════════════════════════════════════ */}
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Accounting Tools</CardTitle>
                    <CardDescription>
                      Chart of accounts, journal entries, ledger, reports
                    </CardDescription>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      toolsOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {accountingTools.map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-orange-500/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(tool.path)}
                      >
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <ToolIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{tool.title}</p>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Last reconciliation note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Last reconciliation: {accountingStatus.lastReconciliation}
        </p>
      </div>
    </div>
  );
}
