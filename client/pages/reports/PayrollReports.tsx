import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportEmptyState,
  ReportPage,
  ReportPageSkeleton,
  ReportSection,
  ReportToolbar,
} from "@/components/reports/ReportLayout";
import { usePayrollRuns, usePayrollRecordsByRun } from "@/hooks/usePayroll";
import { useI18n } from "@/i18n/I18nProvider";
import { FileText, Download, Play, WifiOff } from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { toast } from "sonner";
import { getTodayTL, formatDateTL, parseDateISO } from "@/lib/dateUtils";
import type { PayrollRecord, PayrollRun } from "@/types/payroll";

// ── Canonical extraction (mirrors PayrollHistory/accounting posting) ──
const witOf = (r: PayrollRecord) =>
  r.deductions?.find((d) => d.type === "income_tax")?.amount ?? 0;
const inssEmpOf = (r: PayrollRecord) =>
  r.deductions?.find((d) => d.type === "inss_employee")?.amount ?? 0;
const inssErOf = (r: PayrollRecord) =>
  r.employerTaxes?.find((t) => t.type === "inss_employer")?.amount ?? 0;
const otherDedOf = (r: PayrollRecord) =>
  Math.max(0, (r.totalDeductions ?? 0) - witOf(r) - inssEmpOf(r));

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  processing:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  draft: "bg-muted text-muted-foreground",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PayrollReports() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    data: runs = [],
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = usePayrollRuns({ limit: 24 });

  const sortedRuns = useMemo(
    () =>
      [...runs].sort((a, b) =>
        (b.payDate ?? "").localeCompare(a.payDate ?? ""),
      ),
    [runs],
  );

  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(
    undefined,
  );
  const activeRunId = selectedRunId ?? sortedRuns[0]?.id;
  const activeRun = sortedRuns.find((r) => r.id === activeRunId);

  const { data: records = [], isLoading: recordsLoading } =
    usePayrollRecordsByRun(activeRunId);

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => (b.totalGrossPay ?? 0) - (a.totalGrossPay ?? 0),
      ),
    [records],
  );

  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        acc.gross += r.totalGrossPay ?? 0;
        acc.wit += witOf(r);
        acc.inssEmp += inssEmpOf(r);
        acc.inssEr += inssErOf(r);
        acc.other += otherDedOf(r);
        acc.net += r.netPay ?? 0;
        acc.employerCost += r.totalEmployerCost ?? 0;
        return acc;
      },
      {
        gross: 0,
        wit: 0,
        inssEmp: 0,
        inssEr: 0,
        other: 0,
        net: 0,
        employerCost: 0,
      },
    );
  }, [records]);

  const runLabel = (run: PayrollRun) => {
    const period = run.periodStart
      ? formatDateTL(parseDateISO(run.periodStart), {
          month: "long",
          year: "numeric",
        })
      : "—";
    const payDate = run.payDate
      ? formatDateTL(parseDateISO(run.payDate), {
          day: "numeric",
          month: "short",
        })
      : "—";
    // Only claim "paid" when the run actually is — otherwise it contradicts the status chip
    const datePart =
      run.status === "paid"
        ? t("reports.payrollRun.paidOn", { date: payDate })
        : t("reports.payrollRun.paysOn", { date: payDate });
    return `${period} · ${datePart}`;
  };

  // Same employee appearing in multiple records inflates the run's totals
  const duplicateEmployeeNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((r) => {
      const key = r.employeeNumber || r.employeeName;
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key),
    );
  }, [records]);

  const exportCSV = () => {
    if (!activeRun || records.length === 0) return;
    const headers = [
      t("reports.employee.csv.employeeId"),
      t("reports.payrollRun.table.employee"),
      t("reports.payrollRun.table.department"),
      t("reports.payrollRun.table.gross"),
      "WIT",
      "INSS (employee)",
      "INSS (employer)",
      t("reports.payrollRun.table.other"),
      t("reports.payrollRun.table.net"),
    ];
    const rows = records.map((r) => [
      r.employeeNumber,
      `${r.employeeName}`,
      r.department,
      (r.totalGrossPay ?? 0).toFixed(2),
      witOf(r).toFixed(2),
      inssEmpOf(r).toFixed(2),
      inssErOf(r).toFixed(2),
      otherDedOf(r).toFixed(2),
      (r.netPay ?? 0).toFixed(2),
    ]);
    const csv = [
      `# ${t("reports.payroll.title")} — ${runLabel(activeRun)}`,
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-report-${activeRun.payDate || getTodayTL()}.csv`;
    link.click();
    toast.success(t("reports.payroll.toast.exported"));
  };

  if (runsLoading) {
    return <ReportPageSkeleton sections={2} />;
  }

  const summaryRows: {
    label: string;
    value: string;
    strong?: boolean;
    tone?: string;
  }[] = [
    {
      label: t("reports.payrollRun.summary.gross"),
      value: fmt(totals.gross),
      strong: true,
    },
    {
      label: t("reports.payrollRun.summary.wit"),
      value: `– ${fmt(totals.wit)}`,
    },
    {
      label: t("reports.payrollRun.summary.inssEmployee"),
      value: `– ${fmt(totals.inssEmp)}`,
    },
    {
      label: t("reports.payrollRun.summary.otherDeductions"),
      value: `– ${fmt(totals.other)}`,
      tone: "text-muted-foreground",
    },
    {
      label: t("reports.payrollRun.summary.net"),
      value: fmt(totals.net),
      strong: true,
    },
    {
      label: t("reports.payrollRun.summary.inssEmployer"),
      value: fmt(totals.inssEr),
      tone: "text-muted-foreground",
    },
    {
      label: t("reports.payrollRun.summary.employerCost"),
      value: fmt(totals.employerCost),
      strong: true,
    },
  ];

  return (
    <>
      <SEO {...seoConfig.payrollReports} />
      <ReportPage
        title={t("reports.payroll.title")}
        subtitle={t("reports.payrollRun.subtitle")}
        icon={FileText}
      >
        {runsError ? (
          <ReportEmptyState
            icon={WifiOff}
            title={t("common.connectionIssueTitle")}
            description={t("common.connectionIssueDesc")}
            actionLabel={t("common.retry")}
            onAction={() => {
              void refetchRuns();
            }}
          />
        ) : sortedRuns.length === 0 ? (
          <ReportEmptyState
            icon={Play}
            title={t("reports.payrollRun.noRuns.title")}
            description={t("reports.payrollRun.noRuns.description")}
            actionLabel={t("reports.payrollRun.noRuns.action")}
            onAction={() => navigate("/payroll/run")}
          />
        ) : (
          <div className="space-y-6">
            {/* Run selector + export */}
            <ReportToolbar
              ariaLabel={t("reports.payrollRun.selectRunPlaceholder")}
              actions={
                <Button
                  variant="outline"
                  onClick={exportCSV}
                  disabled={records.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("reports.payroll.actions.export")}
                </Button>
              }
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="payroll-report-run">
                  {t("reports.payrollRun.selectRunPlaceholder")}
                </Label>
                <Select value={activeRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger id="payroll-report-run" className="w-full">
                    <SelectValue
                      placeholder={t("reports.payrollRun.selectRunPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedRuns.map((run) => (
                      <SelectItem key={run.id} value={run.id!}>
                        {runLabel(run)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeRun && (
                  <Badge
                    className={`mt-2 ${STATUS_BADGE[activeRun.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {t(`reports.payrollRun.status.${activeRun.status}`)}
                  </Badge>
                )}
              </div>
            </ReportToolbar>

            {/* Summary report card */}
            <ReportSection
              icon={FileText}
              accent="primary"
              title={t("reports.payrollRun.summary.title")}
              description={
                activeRun
                  ? `${runLabel(activeRun)} · ${activeRun.employeeCount ?? records.length} ${t("reports.payrollRun.summary.employees")}`
                  : t("reports.payrollRun.summary.description")
              }
            >
              {recordsLoading ? (
                <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                  {summaryRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 border-b border-border/40 pb-2"
                    >
                      <Skeleton className="h-4 w-32" />
                      <Skeleton
                        className={row.strong ? "h-5 w-20" : "h-4 w-16"}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                  {summaryRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 border-b border-border/40 pb-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {row.label}
                      </span>
                      <span
                        className={`tabular-nums ${row.strong ? "text-base font-semibold" : "text-sm font-medium"} ${row.tone ?? ""}`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ReportSection>

            {/* Per-employee breakdown */}
            <ReportSection
              icon={FileText}
              accent="primary"
              title={t("reports.payrollRun.table.title")}
              description={t("reports.payrollRun.table.description")}
            >
              {recordsLoading ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-border/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                          {Array.from({ length: 4 }).map((__, cellIndex) => (
                            <div key={cellIndex} className="space-y-1">
                              <Skeleton className="h-3 w-14" />
                              <Skeleton className="h-4 w-16" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left font-medium">
                            {t("reports.payrollRun.table.employee")}
                          </th>
                          <th className="p-3 text-left font-medium">
                            {t("reports.payrollRun.table.department")}
                          </th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.gross")}
                          </th>
                          <th className="p-3 text-right font-medium">WIT</th>
                          <th className="p-3 text-right font-medium">INSS</th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.other")}
                          </th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.net")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-3">
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="mt-1 h-3 w-16" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-20" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-4 w-16" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-4 w-14" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-4 w-14" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-4 w-14" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-4 w-16" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : records.length === 0 ? (
                <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                  {t("reports.payrollRun.table.empty")}
                </div>
              ) : (
                <>
                  {duplicateEmployeeNumbers.size > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      <span>
                        {t("reports.payrollRun.duplicatesWarning", {
                          count: duplicateEmployeeNumbers.size,
                        })}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3 md:hidden">
                    {sortedRecords.map((record) => (
                      <div
                        key={record.id ?? record.employeeId}
                        className="rounded-lg border border-border/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {record.employeeName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[record.employeeNumber, record.department]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {duplicateEmployeeNumbers.has(
                            record.employeeNumber || record.employeeName,
                          ) && (
                            <Badge className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {t("reports.payrollRun.duplicateBadge")}
                            </Badge>
                          )}
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              {t("reports.payrollRun.table.gross")}
                            </dt>
                            <dd className="mt-0.5 font-medium tabular-nums">
                              {fmt(record.totalGrossPay ?? 0)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              WIT
                            </dt>
                            <dd className="mt-0.5 font-medium tabular-nums">
                              {fmt(witOf(record))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              INSS
                            </dt>
                            <dd className="mt-0.5 font-medium tabular-nums">
                              {fmt(inssEmpOf(record))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              {t("reports.payrollRun.table.net")}
                            </dt>
                            <dd className="mt-0.5 font-semibold tabular-nums">
                              {fmt(record.netPay ?? 0)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left font-medium">
                            {t("reports.payrollRun.table.employee")}
                          </th>
                          <th className="p-3 text-left font-medium">
                            {t("reports.payrollRun.table.department")}
                          </th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.gross")}
                          </th>
                          <th className="p-3 text-right font-medium">WIT</th>
                          <th className="p-3 text-right font-medium">INSS</th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.other")}
                          </th>
                          <th className="p-3 text-right font-medium">
                            {t("reports.payrollRun.table.net")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRecords.map((r) => (
                          <tr
                            key={r.id ?? r.employeeId}
                            className="border-b hover:bg-muted/50"
                          >
                            <td className="p-3">
                              <div className="font-medium">
                                {r.employeeName}
                                {duplicateEmployeeNumbers.has(
                                  r.employeeNumber || r.employeeName,
                                ) && (
                                  <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-medium align-middle">
                                    {t("reports.payrollRun.duplicateBadge")}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {r.employeeNumber}
                              </div>
                            </td>
                            <td className="p-3">{r.department}</td>
                            <td className="p-3 text-right tabular-nums">
                              {fmt(r.totalGrossPay ?? 0)}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {fmt(witOf(r))}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {fmt(inssEmpOf(r))}
                            </td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">
                              {fmt(otherDedOf(r))}
                            </td>
                            <td className="p-3 text-right font-medium tabular-nums">
                              {fmt(r.netPay ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/40 font-semibold">
                          <td className="p-3" colSpan={2}>
                            {t("reports.payrollRun.table.totals")}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {fmt(totals.gross)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {fmt(totals.wit)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {fmt(totals.inssEmp)}
                          </td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">
                            {fmt(totals.other)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {fmt(totals.net)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </ReportSection>
          </div>
        )}
      </ReportPage>
    </>
  );
}
