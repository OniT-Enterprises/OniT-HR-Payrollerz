import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import { usePayrollRuns, usePayrollRecordsByRun } from "@/hooks/usePayroll";
import { useI18n } from "@/i18n/I18nProvider";
import { FileText, Download, Play, Loader2 } from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { toast } from "sonner";
import { getTodayTL, formatDateTL, parseDateISO } from "@/lib/dateUtils";
import type { PayrollRecord, PayrollRun } from "@/types/payroll";

// ── Canonical extraction (mirrors PayrollHistory/accounting posting) ──
const witOf = (r: PayrollRecord) => r.deductions?.find((d) => d.type === "income_tax")?.amount ?? 0;
const inssEmpOf = (r: PayrollRecord) => r.deductions?.find((d) => d.type === "inss_employee")?.amount ?? 0;
const inssErOf = (r: PayrollRecord) => r.employerTaxes?.find((t) => t.type === "inss_employer")?.amount ?? 0;
const otherDedOf = (r: PayrollRecord) => Math.max(0, (r.totalDeductions ?? 0) - witOf(r) - inssEmpOf(r));

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
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  draft: "bg-muted text-muted-foreground",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PayrollReports() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: runs = [], isLoading: runsLoading, error: runsError, refetch: refetchRuns } = usePayrollRuns({ limit: 24 });

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => (b.payDate ?? "").localeCompare(a.payDate ?? "")),
    [runs],
  );

  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const activeRunId = selectedRunId ?? sortedRuns[0]?.id;
  const activeRun = sortedRuns.find((r) => r.id === activeRunId);

  const { data: records = [], isLoading: recordsLoading } = usePayrollRecordsByRun(activeRunId);

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
      { gross: 0, wit: 0, inssEmp: 0, inssEr: 0, other: 0, net: 0, employerCost: 0 },
    );
  }, [records]);

  const runLabel = (run: PayrollRun) => {
    const period = run.periodStart
      ? formatDateTL(parseDateISO(run.periodStart), { month: "long", year: "numeric" })
      : "—";
    const paid = run.payDate
      ? formatDateTL(parseDateISO(run.payDate), { day: "numeric", month: "short" })
      : "—";
    return `${period} · paid ${paid}`;
  };

  const exportCSV = () => {
    if (!activeRun || records.length === 0) return;
    const headers = [
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
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-6 py-6">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-8 h-4 w-72" />
          <Skeleton className="mb-6 h-12 w-full max-w-md" />
          <Skeleton className="mb-6 h-56 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const summaryRows: { label: string; value: string; strong?: boolean; tone?: string }[] = [
    { label: t("reports.payrollRun.summary.gross"), value: fmt(totals.gross), strong: true },
    { label: t("reports.payrollRun.summary.wit"), value: `– ${fmt(totals.wit)}`, tone: "text-red-600" },
    { label: t("reports.payrollRun.summary.inssEmployee"), value: `– ${fmt(totals.inssEmp)}`, tone: "text-orange-600" },
    { label: t("reports.payrollRun.summary.otherDeductions"), value: `– ${fmt(totals.other)}`, tone: "text-muted-foreground" },
    { label: t("reports.payrollRun.summary.net"), value: fmt(totals.net), strong: true, tone: "text-green-600" },
    { label: t("reports.payrollRun.summary.inssEmployer"), value: fmt(totals.inssEr), tone: "text-muted-foreground" },
    { label: t("reports.payrollRun.summary.employerCost"), value: fmt(totals.employerCost), strong: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payrollReports} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("reports.payroll.title")}
          subtitle={t("reports.payrollRun.subtitle")}
          icon={FileText}
          iconColor="text-primary"
        />

        {runsError ? (
          <div className="py-16 text-center">
            <h3 className="mb-2 text-lg font-semibold">{t("common.connectionIssueTitle")}</h3>
            <p className="mb-6 text-muted-foreground">{t("common.connectionIssueDesc")}</p>
            <Button variant="outline" onClick={() => refetchRuns()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : sortedRuns.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h3 className="mb-2 text-lg font-semibold">{t("reports.payrollRun.noRuns.title")}</h3>
            <p className="mb-6 text-muted-foreground">{t("reports.payrollRun.noRuns.description")}</p>
            <Button onClick={() => navigate("/payroll/run")}>
              <Play className="mr-2 h-4 w-4" />
              {t("reports.payrollRun.noRuns.action")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Run selector + export */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Select value={activeRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder={t("reports.payrollRun.selectRunPlaceholder")} />
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
                  <Badge className={STATUS_BADGE[activeRun.status] ?? "bg-muted text-muted-foreground"}>
                    {activeRun.status}
                  </Badge>
                )}
              </div>
              <Button onClick={exportCSV} disabled={records.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t("reports.payroll.actions.export")}
              </Button>
            </div>

            {/* Summary report card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  {t("reports.payrollRun.summary.title")}
                </CardTitle>
                <CardDescription>
                  {activeRun
                    ? `${runLabel(activeRun)} · ${activeRun.employeeCount ?? records.length} ${t("reports.payrollRun.summary.employees")}`
                    : t("reports.payrollRun.summary.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> …
                  </div>
                ) : (
                  <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                    {summaryRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className={`tabular-nums ${row.strong ? "text-base font-semibold" : "text-sm font-medium"} ${row.tone ?? ""}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-employee breakdown */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t("reports.payrollRun.table.title")}
                </CardTitle>
                <CardDescription>{t("reports.payrollRun.table.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> …
                  </div>
                ) : records.length === 0 ? (
                  <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                    {t("reports.payrollRun.table.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left font-medium">{t("reports.payrollRun.table.employee")}</th>
                          <th className="p-3 text-left font-medium">{t("reports.payrollRun.table.department")}</th>
                          <th className="p-3 text-right font-medium">{t("reports.payrollRun.table.gross")}</th>
                          <th className="p-3 text-right font-medium">WIT</th>
                          <th className="p-3 text-right font-medium">INSS</th>
                          <th className="p-3 text-right font-medium">{t("reports.payrollRun.table.other")}</th>
                          <th className="p-3 text-right font-medium">{t("reports.payrollRun.table.net")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...records]
                          .sort((a, b) => (b.totalGrossPay ?? 0) - (a.totalGrossPay ?? 0))
                          .map((r) => (
                            <tr key={r.id ?? r.employeeId} className="border-b hover:bg-muted/50">
                              <td className="p-3">
                                <div className="font-medium">{r.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{r.employeeNumber}</div>
                              </td>
                              <td className="p-3">{r.department}</td>
                              <td className="p-3 text-right tabular-nums">{fmt(r.totalGrossPay ?? 0)}</td>
                              <td className="p-3 text-right tabular-nums text-red-600">{fmt(witOf(r))}</td>
                              <td className="p-3 text-right tabular-nums text-orange-600">{fmt(inssEmpOf(r))}</td>
                              <td className="p-3 text-right tabular-nums text-muted-foreground">{fmt(otherDedOf(r))}</td>
                              <td className="p-3 text-right font-medium tabular-nums text-green-600">{fmt(r.netPay ?? 0)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/40 font-semibold">
                          <td className="p-3" colSpan={2}>{t("reports.payrollRun.table.totals")}</td>
                          <td className="p-3 text-right tabular-nums">{fmt(totals.gross)}</td>
                          <td className="p-3 text-right tabular-nums text-red-600">{fmt(totals.wit)}</td>
                          <td className="p-3 text-right tabular-nums text-orange-600">{fmt(totals.inssEmp)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{fmt(totals.other)}</td>
                          <td className="p-3 text-right tabular-nums text-green-600">{fmt(totals.net)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
