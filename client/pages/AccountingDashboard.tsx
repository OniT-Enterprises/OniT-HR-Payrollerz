/**
 * Accounting Dashboard - Payroll-Linked Accounting
 * Answers: "Did payroll post correctly, and do my books reconcile?"
 * NOT a full QuickBooks replacement - supports payroll, audits, reports
 */

import React, { useState, useEffect } from "react";
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
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { useTenantId } from "@/contexts/TenantContext";
import { journalEntryService, trialBalanceService } from "@/services/accountingService";
import { getTodayTL } from "@/lib/dateUtils";
import { formatDateTL } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import GuidancePanel from "@/components/GuidancePanel";
import type { JournalEntry } from "@/types/accounting";

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
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  const [accountingStatus, setAccountingStatus] = useState({
    payrollPosted: false,
    trialBalanced: true,
    pendingEntries: 0,
    lastPayrollAmount: 0,
    lastPayrollDate: "",
  });

  const [lastPayrollEntry, setLastPayrollEntry] = useState<{
    payrollRun: string;
    date: string;
    totalAmount: number;
    entries: { account: string; type: string; amount: number }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const today = getTodayTL();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth(); // 0-indexed

        // Fetch posted and draft journal entries in parallel
        const [postedEntries, draftEntries, trialBalance] = await Promise.all([
          journalEntryService.getAllJournalEntries(tenantId, { status: 'posted' }),
          journalEntryService.getAllJournalEntries(tenantId, { status: 'draft' }),
          trialBalanceService.generateTrialBalance(tenantId, today, currentYear),
        ]);

        if (cancelled) return;

        // Find latest payroll journal entry
        const payrollEntries = postedEntries.filter((e: JournalEntry) => e.source === 'payroll');
        const latestPayroll = payrollEntries[0] || null; // already sorted desc by date

        // Check if payroll posted for current month
        const payrollPosted = payrollEntries.some((e: JournalEntry) => {
          const entryDate = new Date(e.date);
          return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
        });

        setAccountingStatus({
          payrollPosted,
          trialBalanced: trialBalance.isBalanced,
          pendingEntries: draftEntries.length,
          lastPayrollAmount: latestPayroll?.totalDebit ?? 0,
          lastPayrollDate: latestPayroll?.date
            ? formatDateTL(new Date(latestPayroll.date), { year: 'numeric', month: 'short', day: 'numeric' })
            : "",
        });

        if (latestPayroll) {
          setLastPayrollEntry({
            payrollRun: latestPayroll.description || latestPayroll.sourceRef || 'Payroll',
            date: formatDateTL(new Date(latestPayroll.date), { year: 'numeric', month: 'short', day: 'numeric' }),
            totalAmount: latestPayroll.totalDebit,
            entries: latestPayroll.lines.map((line) => ({
              account: line.accountName,
              type: line.debit > 0 ? 'debit' : 'credit',
              amount: line.debit > 0 ? line.debit : line.credit,
            })),
          });
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: t("accounting.dashboard.errorTitle") || "Error",
            description: t("accounting.dashboard.errorLoading") || "Failed to load accounting data",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Attention items (only show if there are issues)
  const attentionItems = accountingStatus.pendingEntries > 0
    ? [
        {
          issue: t("accounting.dashboard.manualEntriesAwaiting", { count: String(accountingStatus.pendingEntries) }),
          hint: t("accounting.dashboard.manualEntriesHint"),
          action: t("accounting.dashboard.review"),
          path: "/accounting/journal-entries?status=pending",
        },
      ]
    : [];

  // Accounting tools (collapsed by default)
  const accountingTools = [
    {
      id: "chart-of-accounts",
      title: t("accounting.dashboard.chartOfAccounts"),
      description: t("accounting.dashboard.chartOfAccountsDesc"),
      icon: BookOpen,
      path: "/accounting/chart-of-accounts",
    },
    {
      id: "journal-entries",
      title: t("accounting.dashboard.journalEntries"),
      description: t("accounting.dashboard.journalEntriesDesc"),
      icon: FileSpreadsheet,
      path: "/accounting/journal-entries",
    },
    {
      id: "general-ledger",
      title: t("accounting.dashboard.generalLedger"),
      description: t("accounting.dashboard.generalLedgerDesc"),
      icon: Landmark,
      path: "/accounting/general-ledger",
    },
    {
      id: "trial-balance",
      title: t("accounting.dashboard.trialBalance"),
      description: t("accounting.dashboard.trialBalanceDesc"),
      icon: Scale,
      path: "/accounting/trial-balance",
    },
    {
      id: "reports",
      title: t("accounting.dashboard.financialReports"),
      description: t("accounting.dashboard.financialReportsDesc"),
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
                <img src="/images/illustrations/icons/icon-accounting.webp" alt="" className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t("accounting.dashboard.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("accounting.dashboard.ledgerSubtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/accounting/journal-entries?action=new")}
              >
                <FilePlus className="h-4 w-4 mr-1.5" />
                {t("accounting.dashboard.newManualEntry")}
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                onClick={() => navigate("/accounting/journal-entries?filter=payroll")}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                {t("accounting.dashboard.reviewPayrollEntries")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <GuidancePanel section="accounting" />

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNTANT GATE - Help non-accountants understand this section
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-orange-800 dark:text-orange-200">
                {t("accounting.dashboard.accountantGateTitle")}
              </p>
              <p className="text-sm text-orange-700/80 dark:text-orange-400/80 mt-0.5">
                {t("accounting.dashboard.accountantGateDesc")}{" "}
                <button onClick={() => navigate("/money")} className="underline hover:text-orange-800 dark:hover:text-orange-300">{t("accounting.dashboard.moneyLink")}</button> or <button onClick={() => navigate("/payroll")} className="underline hover:text-orange-800 dark:hover:text-orange-300">{t("accounting.dashboard.payrollLink")}</button> {t("accounting.dashboard.accountantGateInstead")}
              </p>
              <p className="text-xs text-orange-600/70 dark:text-orange-500/70 mt-2">
                {t("accounting.dashboard.accountantGateNote")}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNTING STATUS - Primary question: "Are my books OK?"
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("accounting.dashboard.thisMonth")}</CardTitle>
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
                  <p className="text-sm font-medium">{t("accounting.dashboard.payrollEntries")}</p>
                  <p className="text-xs text-muted-foreground">
                    {accountingStatus.payrollPosted ? t("accounting.dashboard.posted") : t("accounting.dashboard.notPosted")}
                  </p>
                </div>
                <span className="text-lg font-bold">
                  {formatCurrencyTL(accountingStatus.lastPayrollAmount)}
                </span>
              </div>

              {/* Trial Balance - Primary health indicator */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                accountingStatus.trialBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
                  : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50"
              }`}>
                {accountingStatus.trialBalanced ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("accounting.dashboard.trialBalanceLabel")}</p>
                  <p className={`text-xs ${
                    accountingStatus.trialBalanced
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {accountingStatus.trialBalanced ? t("accounting.dashboard.balanced") : t("accounting.dashboard.outOfBalance")}
                  </p>
                </div>
                <Badge
                  className={`text-xs font-semibold ${
                    accountingStatus.trialBalanced
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                      : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
                  }`}
                >
                  {accountingStatus.trialBalanced ? t("accounting.dashboard.balanced") : t("accounting.dashboard.check")}
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
                  <p className="text-sm font-medium">{t("accounting.dashboard.pendingItems")}</p>
                  <p className="text-xs text-muted-foreground">{t("accounting.dashboard.manualEntries")}</p>
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
                  {t("accounting.dashboard.reviewEntries")}
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
                  {t("accounting.dashboard.payrollToAccounting")}
                </CardTitle>
                <CardDescription>{t("accounting.dashboard.lastPayrollEntry")}</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {lastPayrollEntry?.date || "—"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Clarification text */}
            <p className="text-xs text-muted-foreground mb-4 pb-3 border-b border-border/50">
              {t("accounting.dashboard.payrollAutoPost")}
            </p>

            {lastPayrollEntry ? (
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
                          {entry.type === "debit" ? t("accounting.dashboard.debit") : t("accounting.dashboard.credit")}
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
                    {t("accounting.dashboard.viewAllPayrollEntries")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t("accounting.dashboard.noPayrollEntries") || "No payroll entries yet"}</p>
              </div>
            )}
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
                {t("accounting.dashboard.attentionRequired")}
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
                    <div>
                      <span className="text-sm font-medium">{item.issue}</span>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                      )}
                    </div>
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
                    <CardTitle className="text-base">{t("accounting.dashboard.accountingTools")}</CardTitle>
                    <CardDescription>
                      {t("accounting.dashboard.accountingToolsDesc")}
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

        {/* Last payroll date note */}
        {accountingStatus.lastPayrollDate && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            {t("accounting.dashboard.lastReconciliation", { date: accountingStatus.lastPayrollDate })}
          </p>
        )}
      </div>
    </div>
  );
}
