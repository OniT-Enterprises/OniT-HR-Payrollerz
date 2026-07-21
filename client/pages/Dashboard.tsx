/**
 * Dashboard
 * Answers three questions: what needs attention, what is the key number, and
 * where should the user go next?
 */

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/chatStore";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";
import {
  getConfiguredPayrollSchedule,
  getDaysUntilIso,
  getNextPayDateIso,
  isPayIntervalExceeded,
} from "@/lib/payroll/payroll-schedule";
import {
  getDaysUntilDueIso,
  getNextAnnualAdjustedDeadline,
  getNextMonthlyAdjustedDeadline,
  getUrgencyFromDays,
} from "@/lib/tax/compliance";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import {
  Users,
  UserPlus,
  Calculator,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  CalendarDays,
  Play,
  Wallet,
  BookOpen,
  FileText,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCountUp } from "@/hooks/useCountUp";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { SEO, seoConfig } from "@/components/SEO";
import { useLayoutOptional } from "@/contexts/LayoutContext";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { AccountantPartnerBanner } from "@/components/settings/AccountantPartnerCard";
import { useInvoiceStats } from "@/hooks/useInvoices";

function formatCurrencyShort(amount: number, locale: "en" | "tet" | "pt") {
  const numberLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : "pt-TL";
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* Tactile feedback for tappable surfaces: quick press scale + visible focus
   ring. Hover feedback stays border + fill (no shadows, no translation) per
   the style guide's motion rules. */
const PRESSABLE =
  "transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const animated = Math.round(useCountUp(value));
  return <>{format ? format(animated) : animated}</>;
}

function XefeBotInline({
  t,
  firstName,
  summary,
}: {
  t: (key: string) => string;
  firstName: string;
  summary: string;
}) {
  const { setOpen, setPendingQuery } = useChatStore();
  const [input, setInput] = useState("");
  const hour = new Date().getHours();
  const greeting = t(
    hour < 12
      ? "common.greetingMorning"
      : hour < 18
        ? "common.greetingAfternoon"
        : "common.greetingEvening",
  );

  const handleSend = useCallback((query: string) => {
    if (!query.trim()) return;
    setPendingQuery(query.trim());
    setOpen(true);
    setInput("");
  }, [setPendingQuery, setOpen]);

  const prompts = [
    t("dashboard.botPromptPayroll"),
    t("dashboard.botPromptStaff"),
    t("dashboard.botPromptLeave"),
  ];

  return (
    <div className="min-w-0 flex-1 space-y-2.5">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h2>
        <p className="mt-0.5 text-sm text-foreground/75">{summary}</p>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("dashboard.botPlaceholder")}
          className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary md:h-9 md:text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label={t("dashboard.botPlaceholder")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-95 disabled:opacity-40 md:h-9 md:w-9"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSend(prompt)}
            className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-foreground/75 transition-all duration-150 hover:border-primary/40 hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton({ cardCount }: { cardCount: number }) {
  const cards = Array.from({ length: Math.max(cardCount, 3) });
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        {/* ── Assistant strip ── */}
        <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="space-y-1">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-11 flex-1 rounded-full md:h-9" />
                <Skeleton className="h-11 w-11 shrink-0 rounded-full md:h-9 md:w-9" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Overview cards ── */}
        <div
          className={`mb-6 grid grid-cols-2 gap-3 ${
            cards.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          {cards.map((_, index) => (
            <div
              key={index}
              className={`flex flex-col rounded-xl border border-border/70 bg-card p-4 ${
                index >= 2 ? "hidden sm:flex" : ""
              }`}
            >
              <Skeleton className="mb-3 h-8 w-8 rounded-lg" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-1.5 h-3 w-24" />
              <Skeleton className="mt-1 h-3 w-28" />
              <Skeleton className="mt-auto h-3 w-16 pt-2" />
            </div>
          ))}
        </div>

        {/* ── Things to do: mirrors the two urgency groups of the loaded list ── */}
        <div className="mt-8">
          <Skeleton className="mb-3 h-5 w-28" />
          <Skeleton className="mb-2 h-3.5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 sm:gap-4"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-4 w-4 shrink-0" />
              </div>
            ))}
          </div>
          <Skeleton className="mb-2 mt-5 h-3.5 w-24" />
          <div className="space-y-2">
            <div className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 sm:gap-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-4 w-4 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const layout = useLayoutOptional();
  const setPageHeader = layout?.setPageHeader;
  const clearPageHeader = layout?.clearPageHeader;
  const { user } = useAuth();
  const { hasModule, canManage, session } = useTenant();
  const canManageTenant = canManage();
  const { t, locale } = useI18n();
  const hasStaff = hasModule("staff");
  const hasHiring = hasModule("hiring");
  const hasPerformance = hasModule("performance");
  const hasTimeleave = hasModule("timeleave");
  const hasPayroll = hasModule("payroll");
  const hasMoney = hasModule("money");
  const hasAccounting = hasModule("accounting");
  const hasReports = hasModule("reports");
  const canReadEmployeeDirectory =
    hasStaff || hasHiring || canManageTenant || session?.role === "manager";
  const shouldLoadEmployeeSummary =
    (hasStaff || hasPayroll || hasTimeleave) && canReadEmployeeDirectory;

  const employeeSummaryQuery = useActiveEmployeeSummary(shouldLoadEmployeeSummary);
  const leaveStatsQuery = useLeaveStats(hasTimeleave);
  const dueDatesQuery = useTaxFilingsDueSoon(2, hasPayroll);
  const payrollRunsQuery = usePayrollRuns({ limit: 10 }, hasPayroll);
  const settingsQuery = useSettings(hasPayroll);
  const invoiceStatsQuery = useInvoiceStats(hasMoney);

  const employeeSummary = employeeSummaryQuery.data;
  const leaveStats = leaveStatsQuery.data;
  const filingDueDates = dueDatesQuery.data ?? [];
  const payrollRuns = payrollRunsQuery.data ?? [];
  const moneyStats = hasMoney ? invoiceStatsQuery.data : undefined;
  const loading =
    (shouldLoadEmployeeSummary && employeeSummaryQuery.isLoading) ||
    (hasTimeleave && leaveStatsQuery.isLoading) ||
    (hasPayroll && dueDatesQuery.isLoading) ||
    (hasPayroll && payrollRunsQuery.isLoading) ||
    (hasPayroll && settingsQuery.isLoading) ||
    (hasMoney && invoiceStatsQuery.isLoading);
  const loadError =
    (shouldLoadEmployeeSummary && employeeSummaryQuery.isError && employeeSummary === undefined) ||
    (hasTimeleave && leaveStatsQuery.isError && leaveStats === undefined) ||
    (hasPayroll && dueDatesQuery.isError && dueDatesQuery.data === undefined) ||
    (hasPayroll && payrollRunsQuery.isError && payrollRunsQuery.data === undefined) ||
    (hasPayroll && settingsQuery.isError && settingsQuery.data === undefined) ||
    (hasMoney && invoiceStatsQuery.isError && invoiceStatsQuery.data === undefined);
  const retrying =
    employeeSummaryQuery.isFetching ||
    leaveStatsQuery.isFetching ||
    dueDatesQuery.isFetching ||
    payrollRunsQuery.isFetching ||
    (hasPayroll && settingsQuery.isFetching) ||
    (hasMoney && invoiceStatsQuery.isFetching);
  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowShortcuts(true),
  });

  // Compliance deadlines (Timor-Leste specific)
  const getComplianceStatus = () => {
    const todayIso = getTodayTL();
    const getUpcomingObligation = (predicate: (item: (typeof filingDueDates)[number]) => boolean) => {
      const matches = filingDueDates.filter(predicate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return matches.find((item) => item.status !== "filed") ?? null;
    };

    const witObligation = getUpcomingObligation((item) => item.type === "monthly_wit");
    const inssObligation = getUpcomingObligation(
      (item) => item.type === "inss_monthly" && item.task === "payment"
    );

    const fallbackWitDue = getNextMonthlyAdjustedDeadline(todayIso, 15);
    const fallbackInssDue = getNextMonthlyAdjustedDeadline(todayIso, 20);

    const daysToWit = witObligation?.daysUntilDue ?? getDaysUntilDueIso(todayIso, fallbackWitDue);
    const daysToINSS = inssObligation?.daysUntilDue ?? getDaysUntilDueIso(todayIso, fallbackInssDue);
    const daysToSubsidio = getDaysUntilDueIso(todayIso, getNextAnnualAdjustedDeadline(todayIso, 12, 20));

    return {
      wit: {
        days: daysToWit,
        status: getUrgencyFromDays(daysToWit, witObligation?.isOverdue ?? false),
      },
      inss: {
        days: daysToINSS,
        status: getUrgencyFromDays(daysToINSS, inssObligation?.isOverdue ?? false),
      },
      subsidio: { days: daysToSubsidio, status: daysToSubsidio > 60 ? 'ok' : daysToSubsidio > 30 ? 'warning' : 'urgent' },
    };
  };

  const employeesWithIssues = hasStaff ? (employeeSummary?.employeesWithIssues ?? 0) : 0;
  const activeEmployeeCount = employeeSummary?.active ?? 0;

  const todayIso = getTodayTL();
  const payrollSchedule = getConfiguredPayrollSchedule(settingsQuery.data?.paymentStructure);
  const nextPayDateKey = getNextPayDateIso(payrollSchedule, todayIso);
  const daysUntilPayday = getDaysUntilIso(nextPayDateKey, todayIso);
  // A brand-new org with no staff and no payroll history has no WIT/INSS
  // obligations yet — don't greet it with "overdue" compliance warnings.
  const hasComplianceContext = activeEmployeeCount > 0 || payrollRuns.length > 0;
  const compliance = hasPayroll && hasComplianceContext ? getComplianceStatus() : null;
  const firstName = user?.displayName?.split(" ")[0] || "";

  // Payroll status
  const payrollPrepared = payrollRuns.some(
    (run) =>
      run.payDate === nextPayDateKey &&
      run.status !== "cancelled" &&
      run.status !== "rejected"
  );

  // Art. 40(3): the interval between wage payments must not exceed one month.
  // Reuses the runs the dashboard already fetches — the latest finalized
  // (approved/paid) run's payDate more than a month ago means staff are
  // legally overdue to be paid, however far off the next configured payday is.
  const lastFinalizedPayDate = payrollRuns.reduce<string | null>(
    (latest, run) =>
      (run.status === "approved" || run.status === "paid") &&
      run.payDate &&
      (!latest || run.payDate > latest)
        ? run.payDate
        : latest,
    null,
  );
  const payrollOverdue = Boolean(
    hasPayroll &&
      activeEmployeeCount > 0 &&
      lastFinalizedPayDate &&
      isPayIntervalExceeded(lastFinalizedPayDate, todayIso),
  );

  const urgentCompliance = compliance
    ? [
        { label: "WIT", ...compliance.wit },
        { label: "INSS", ...compliance.inss },
        { label: t("dashboard.thirteenthFull"), ...compliance.subsidio },
      ]
        .filter((item) => item.status === "urgent")
        .sort((a, b) => a.days - b.days)[0] ?? null
    : null;
  const shouldRunPayroll =
    canManageTenant && hasPayroll && !payrollPrepared && activeEmployeeCount > 0;
  const shouldReviewLeave = hasTimeleave && pendingLeave > 0;
  const shouldFixEmployees = canManageTenant && hasStaff && employeesWithIssues > 0;
  const shouldAddEmployee = canManageTenant && hasStaff && activeEmployeeCount === 0;
  const hasThingsToDo =
    shouldRunPayroll ||
    shouldReviewLeave ||
    shouldFixEmployees ||
    shouldAddEmployee ||
    Boolean(canManageTenant && urgentCompliance);
  const hasNeedsAttention =
    Boolean(canManageTenant && urgentCompliance) || shouldFixEmployees;
  const hasComingUp = shouldRunPayroll || shouldReviewLeave || shouldAddEmployee;

  const formatMoney = (amount: number) => formatCurrencyShort(amount, locale);

  // One-line proactive summary for the assistant strip: the two most
  // important signals, in the same priority order as the to-do list.
  const summaryParts: string[] = [];
  if (canManageTenant && urgentCompliance && urgentCompliance.days < 0) {
    summaryParts.push(
      t("dashboard.botSummaryCompliance", {
        label: urgentCompliance.label,
        days: Math.abs(urgentCompliance.days),
      }),
    );
  }
  if (shouldRunPayroll) {
    summaryParts.push(t("dashboard.botSummaryPayroll", { days: daysUntilPayday }));
  }
  if (canManageTenant && employeesWithIssues > 0) {
    summaryParts.push(t("dashboard.botSummaryEmployees", { count: employeesWithIssues }));
  }
  if (shouldReviewLeave) {
    summaryParts.push(t("dashboard.botSummaryLeave", { count: pendingLeave }));
  }
  const botSummary =
    summaryParts.slice(0, 2).join(" ") ||
    (canManageTenant ? t("dashboard.botSummaryAllGood") : t("dashboard.botIntro"));

  const retryDashboard = useCallback(async () => {
    const requests: Array<Promise<unknown>> = [];
    if (hasPayroll) requests.push(settingsQuery.refetch());
    if (shouldLoadEmployeeSummary) requests.push(employeeSummaryQuery.refetch());
    if (hasTimeleave) requests.push(leaveStatsQuery.refetch());
    if (hasPayroll) {
      requests.push(dueDatesQuery.refetch(), payrollRunsQuery.refetch());
    }
    if (hasMoney) requests.push(invoiceStatsQuery.refetch());
    await Promise.all(requests);
  }, [
    settingsQuery,
    shouldLoadEmployeeSummary,
    employeeSummaryQuery,
    hasTimeleave,
    leaveStatsQuery,
    hasPayroll,
    dueDatesQuery,
    payrollRunsQuery,
    hasMoney,
    invoiceStatsQuery,
  ]);

  useEffect(() => {
    if (!setPageHeader) return;

    setPageHeader({
      title: t("common.dashboard"),
      subtitle: t("dashboard.headerSubtitle"),
      icon: Calculator,
      iconColor: "text-primary",
    });

    return () => {
      clearPageHeader?.();
    };
  }, [setPageHeader, clearPageHeader, t]);

  if (loading) {
    return (
      <DashboardSkeleton
        cardCount={
          [hasPayroll, hasStaff, hasTimeleave, hasMoney].filter(Boolean).length
        }
      />
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.dashboard} />
        <MainNavigation />
        <DashboardLoadError onRetry={retryDashboard} isRetrying={retrying} />
      </div>
    );
  }

  const totalMonthlySalary = employeeSummary?.totalMonthlySalary ?? 0;

  const overviewCards: Array<{
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    big: React.ReactNode;
    label: string;
    context?: string;
    contextTone?: "warn";
    action: string;
    onClick: () => void;
  }> = [];

  if (hasPayroll) {
    overviewCards.push({
      key: "payroll",
      icon: Calculator,
      // The payday countdown tile — shared signature with the Ekipa app's
      // greeting card (soft tinted square, number over a small DAYS label).
      big: (
        <span
          className={`inline-flex flex-col items-center rounded-xl px-3 py-1.5 ${
            payrollOverdue ? "bg-amber-500/10" : "bg-primary/10"
          }`}
        >
          <span className="text-2xl font-bold leading-7 tabular-nums">
            <AnimatedNumber value={daysUntilPayday} />
          </span>
          <span
            className={`text-[10px] font-semibold uppercase leading-3 tracking-wider ${
              payrollOverdue
                ? "text-amber-600 dark:text-amber-400"
                : "text-primary"
            }`}
          >
            {t("dashboard.days")}
          </span>
        </span>
      ),
      label: t("dashboard.untilPayday"),
      context: payrollOverdue
        ? t("dashboard.cardPayrollOverdue") ||
          "Payroll overdue — Art. 40 requires payment at least monthly"
        : payrollPrepared
          ? t("dashboard.cardPayrollPrepared")
          : activeEmployeeCount > 0
            ? t("dashboard.cardPayrollContext", {
                count: activeEmployeeCount,
                amount: formatMoney(totalMonthlySalary),
              })
            : undefined,
      contextTone: payrollOverdue ? "warn" : undefined,
      action: payrollPrepared
        ? t("dashboard.viewPayroll")
        : t("dashboard.preparePayroll"),
      onClick: () => navigate(canManageTenant ? "/payroll/run" : "/payroll"),
    });
  }
  if (hasStaff) {
    overviewCards.push({
      key: "staff",
      icon: Users,
      big: <AnimatedNumber value={activeEmployeeCount} />,
      label: t("dashboard.activeEmployees"),
      context:
        employeesWithIssues > 0
          ? t("dashboard.cardEmployeesIssues", { count: employeesWithIssues })
          : t("dashboard.cardEmployeesOk"),
      contextTone: employeesWithIssues > 0 ? "warn" : undefined,
      action: t("dashboard.viewEmployees"),
      onClick: () => navigate("/people/employees"),
    });
  }
  if (hasTimeleave) {
    overviewCards.push({
      key: "leave",
      icon: CalendarDays,
      big: <AnimatedNumber value={pendingLeave} />,
      label: t("dashboard.pendingRequests"),
      context:
        pendingLeave > 0
          ? t("dashboard.cardLeaveWaiting")
          : t("dashboard.cardLeaveOk"),
      action: t("dashboard.viewRequests"),
      onClick: () => navigate("/time-leave/leave"),
    });
  }
  if (hasMoney && moneyStats) {
    overviewCards.push({
      key: "money",
      icon: Wallet,
      big: (
        <AnimatedNumber
          value={moneyStats.revenueThisMonth}
          format={formatMoney}
        />
      ),
      label: t("dashboard.cardMoneyLabel"),
      context:
        moneyStats.totalOutstanding > 0
          ? t("dashboard.cardMoneyOutstanding", {
              amount: formatMoney(moneyStats.totalOutstanding),
            })
          : t("dashboard.cardMoneyOk"),
      action: t("dashboard.viewMoney"),
      onClick: () => navigate("/money"),
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.dashboard} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl animate-fade-in px-4 py-5 sm:px-6 sm:py-6">
        {/* ── Compact assistant strip: greeting, proactive summary, ask box.
            Xefe's warm corner of the page — a whisper of brand green and the
            ghosted crescent-X mark, echoing the Ekipa greeting card. ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
          <img
            src="/images/illustrations/xefe-mark-light.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 -top-8 hidden h-40 w-auto opacity-[0.07] dark:block"
          />
          <img
            src="/images/illustrations/xefe-mark-dark.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 -top-8 h-40 w-auto opacity-[0.06] dark:hidden"
          />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <img
              src="/images/illustrations/xefebot.webp"
              alt="XefeBot"
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            />
            <XefeBotInline t={t} firstName={firstName} summary={botSummary} />
          </div>
        </div>

        {/* ── Overview cards ── */}
        {overviewCards.length > 0 && (
          <div
            className={`mb-6 grid grid-cols-2 gap-3 ${
              overviewCards.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            {overviewCards.map((card, index) => (
              <button
                key={card.key}
                onClick={card.onClick}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/40 sm:p-5 ${PRESSABLE} ${
                  index >= 2 ? "hidden sm:flex" : ""
                }`}
              >
                {/* Oversized, faint watermark of the card's own icon, tucked in
                    the top-right corner and clipped by the card. */}
                <card.icon
                  aria-hidden
                  className="pointer-events-none absolute -right-4 -top-3 h-24 w-24 text-foreground/[0.05]"
                />
                {/* Green circular icon badge */}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-3xl font-bold leading-none tabular-nums">{card.big}</p>
                <p className="mt-2 text-sm font-medium">{card.label}</p>
                {card.context && (
                  <p
                    className={`mt-0.5 text-xs ${
                      card.contextTone === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {card.context}
                  </p>
                )}
                <div className="mt-auto border-t border-border/60 pt-2.5">
                  <p className="flex items-center gap-1 text-xs font-medium text-primary">
                    {card.action}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {!hasPayroll &&
          !hasStaff &&
          !hasTimeleave &&
          (hasHiring || hasPerformance || hasMoney || hasAccounting || hasReports) && (
          <div className="mb-6">
            <p className="mb-3 text-sm font-semibold">{t("dashboard.quickActions")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(hasHiring || hasPerformance) && (
                <button onClick={() => navigate("/people")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.people")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasMoney && (
                <button onClick={() => navigate("/money")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.money")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasAccounting && (
                <button onClick={() => navigate("/accounting")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.accounting")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {hasReports && (
                <button onClick={() => navigate("/reports")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{t("nav.reports")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Things to do: the hero of the page, grouped by urgency ── */}
        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold">{t("dashboard.thingsToDo")}</p>

          {hasNeedsAttention && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dashboard.needsAttention")}
              </p>
              <div className="space-y-2">
                {canManageTenant && urgentCompliance && (
                  <button onClick={() => navigate("/payroll/tax")} className={`flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left hover:border-red-400/40 hover:bg-muted/40 ${PRESSABLE} sm:gap-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{t("dashboard.compliance")}: {urgentCompliance.label}</p>
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium leading-4 text-red-600 dark:text-red-400">
                          {urgentCompliance.days < 0
                            ? t("dashboard.overdueBy", { days: Math.abs(urgentCompliance.days) })
                            : t("dashboard.dueIn", { days: urgentCompliance.days })}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {shouldFixEmployees && (
                  <button onClick={() => navigate("/people/employees?filter=issues")} className={`flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left hover:border-amber-400/40 hover:bg-muted/40 ${PRESSABLE} sm:gap-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{t("dashboard.todoBlockingTitle")}</p>
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-600 dark:text-amber-400">
                          {t("dashboard.issuesBadge", { count: employeesWithIssues })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70">{t("dashboard.todoBlockingDesc", { count: employeesWithIssues })}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
              </div>
            </>
          )}

          {hasComingUp && (
            <>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${hasNeedsAttention ? "mt-5" : ""}`}>
                {t("dashboard.comingUp")}
              </p>
              <div className="space-y-2">
                {shouldRunPayroll && (
                  <button onClick={() => navigate("/payroll/run")} className={`flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/40 ${PRESSABLE} sm:gap-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Play className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{t("dashboard.runPayroll")}</p>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                          {t("dashboard.dueIn", { days: daysUntilPayday })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70">{t("dashboard.todoRunPayrollDesc", { days: daysUntilPayday })}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {shouldReviewLeave && (
                  <button onClick={() => navigate("/time-leave/leave")} className={`flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/40 ${PRESSABLE} sm:gap-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <CalendarDays className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{t("dashboard.todoLeaveTitle")}</p>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                          {t("dashboard.pendingBadge", { count: pendingLeave })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70">{t("dashboard.todoLeaveDesc", { count: pendingLeave })}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {shouldAddEmployee && (
                  <button onClick={() => navigate("/people/add")} className={`flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/40 ${PRESSABLE} sm:gap-4`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t("dashboard.addEmployee")}</p>
                      <p className="text-xs text-foreground/70">{t("dashboard.todoAddEmployeeDesc")}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
              </div>
            </>
          )}

          {!hasThingsToDo && (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
              <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
              <span>{t("dashboard.allGood")}</span>
            </div>
          )}
        </div>

        {/* Optional professional support stays visible, but as a quiet
            one-line banner that never competes with the to-do hierarchy. */}
        <AccountantPartnerBanner />
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
