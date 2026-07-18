import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReportEmptyState,
  ReportPage,
  ReportSummary,
  ReportToolbar,
} from "@/components/reports/ReportLayout";
import { SEO } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useAllEmployees } from "@/hooks/useEmployees";
import { payrollService } from "@/services/payrollService";
import { getTodayTL } from "@/lib/dateUtils";
import { Download, FolderKanban, Building2, WifiOff } from "lucide-react";
import { createEmployeeAllocationMetaMap } from "@/lib/reports/ngoReporting";

interface AllocationRow {
  projectCode: string;
  fundingSource: string;
  employeeCount: number;
  grossPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  netPay: number;
  employerCost: number;
}

interface AllocationTotals {
  runCount: number;
  employeeCount: number;
  grossPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  netPay: number;
  employerCost: number;
}

export default function PayrollAllocationReport() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const tenantId = useTenantId();
  const today = getTodayTL();
  const [selectedYear, setSelectedYear] = useState(today.substring(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(today.substring(5, 7));

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          value: String(month).padStart(2, "0"),
          label: t(`common.months.${month}`),
        };
      }),
    [t],
  );

  const formatUSD = (value: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-PT", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const payrollRunsQuery = usePayrollRuns({ limit: 300 });
  const employeesQuery = useAllEmployees();
  const payrollRuns = useMemo(
    () => payrollRunsQuery.data ?? [],
    [payrollRunsQuery.data],
  );
  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );

  const payrollRunsForPeriod = useMemo(() => {
    const prefix = `${selectedYear}-${selectedMonth}`;
    return payrollRuns.filter(
      (run) =>
        Boolean(run.id) &&
        (run.status === "approved" || run.status === "paid") &&
        typeof run.payDate === "string" &&
        run.payDate.startsWith(prefix),
    );
  }, [payrollRuns, selectedYear, selectedMonth]);

  const runIds = useMemo(
    () => payrollRunsForPeriod.map((run) => run.id!).sort(),
    [payrollRunsForPeriod],
  );

  const allocationQuery = useQuery({
    queryKey: [
      "reports",
      tenantId,
      "payroll-allocation",
      selectedYear,
      selectedMonth,
      locale,
      runIds.join(","),
    ],
    enabled: runIds.length > 0 && employees.length > 0,
    queryFn: async (): Promise<{
      rows: AllocationRow[];
      totals: AllocationTotals;
    }> => {
      const employeeMeta = createEmployeeAllocationMetaMap(employees);

      const recordsByRun = await Promise.all(
        payrollRunsForPeriod.map((run) =>
          payrollService.records.getPayrollRecordsByRunId(run.id!, tenantId),
        ),
      );

      const grouped = new Map<
        string,
        {
          projectCode: string;
          fundingSource: string;
          employeeIds: Set<string>;
          grossPay: number;
          incomeTax: number;
          inssEmployee: number;
          inssEmployer: number;
          netPay: number;
          employerCost: number;
        }
      >();

      const allEmployeeIds = new Set<string>();
      let totalGrossPay = 0;
      let totalIncomeTax = 0;
      let totalINSSEmployee = 0;
      let totalINSSEmployer = 0;
      let totalNetPay = 0;
      let totalEmployerCost = 0;

      for (const records of recordsByRun) {
        for (const record of records) {
          const meta = employeeMeta.get(record.employeeId) || {
            projectCode: t("reports.payrollAllocation.unassigned"),
            fundingSource: t("reports.payrollAllocation.unassigned"),
          };
          const key = `${meta.projectCode}::${meta.fundingSource}`;
          const incomeTax =
            record.deductions?.find(
              (deduction) => deduction.type === "income_tax",
            )?.amount || 0;
          const inssEmployee =
            record.deductions?.find(
              (deduction) => deduction.type === "inss_employee",
            )?.amount || 0;
          const inssEmployer =
            record.employerTaxes?.find((tax) => tax.type === "inss_employer")
              ?.amount || 0;

          const row = grouped.get(key) || {
            projectCode: meta.projectCode,
            fundingSource: meta.fundingSource,
            employeeIds: new Set<string>(),
            grossPay: 0,
            incomeTax: 0,
            inssEmployee: 0,
            inssEmployer: 0,
            netPay: 0,
            employerCost: 0,
          };

          row.employeeIds.add(record.employeeId);
          row.grossPay += record.totalGrossPay || 0;
          row.incomeTax += incomeTax;
          row.inssEmployee += inssEmployee;
          row.inssEmployer += inssEmployer;
          row.netPay += record.netPay || 0;
          row.employerCost += record.totalEmployerCost || 0;

          grouped.set(key, row);

          allEmployeeIds.add(record.employeeId);
          totalGrossPay += record.totalGrossPay || 0;
          totalIncomeTax += incomeTax;
          totalINSSEmployee += inssEmployee;
          totalINSSEmployer += inssEmployer;
          totalNetPay += record.netPay || 0;
          totalEmployerCost += record.totalEmployerCost || 0;
        }
      }

      const rows: AllocationRow[] = Array.from(grouped.values())
        .map((row) => ({
          projectCode: row.projectCode,
          fundingSource: row.fundingSource,
          employeeCount: row.employeeIds.size,
          grossPay: row.grossPay,
          incomeTax: row.incomeTax,
          inssEmployee: row.inssEmployee,
          inssEmployer: row.inssEmployer,
          netPay: row.netPay,
          employerCost: row.employerCost,
        }))
        .sort((a, b) => b.grossPay - a.grossPay);

      return {
        rows,
        totals: {
          runCount: payrollRunsForPeriod.length,
          employeeCount: allEmployeeIds.size,
          grossPay: totalGrossPay,
          incomeTax: totalIncomeTax,
          inssEmployee: totalINSSEmployee,
          inssEmployer: totalINSSEmployer,
          netPay: totalNetPay,
          employerCost: totalEmployerCost,
        },
      };
    },
  });

  const rows = allocationQuery.data?.rows ?? [];
  const totals = allocationQuery.data?.totals;
  const loading =
    payrollRunsQuery.isLoading ||
    employeesQuery.isLoading ||
    allocationQuery.isLoading;
  const loadError =
    payrollRunsQuery.isError ||
    employeesQuery.isError ||
    allocationQuery.isError;

  const yearOptions = useMemo(() => {
    const years = new Set<string>([selectedYear]);
    for (const run of payrollRuns) {
      if (run.payDate) years.add(run.payDate.substring(0, 4));
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [payrollRuns, selectedYear]);

  const exportCsv = () => {
    if (!rows.length) return;
    const header = [
      t("reports.payrollAllocation.csv.projectCode"),
      t("reports.payrollAllocation.csv.fundingSource"),
      t("reports.payrollAllocation.csv.employeeCount"),
      t("reports.payrollAllocation.csv.grossPay"),
      t("reports.payrollAllocation.csv.incomeTax"),
      t("reports.payrollAllocation.csv.inssEmployee"),
      t("reports.payrollAllocation.csv.inssEmployer"),
      t("reports.payrollAllocation.csv.netPay"),
      t("reports.payrollAllocation.csv.employerCost"),
    ];
    const body = rows.map((row) => [
      row.projectCode,
      row.fundingSource,
      String(row.employeeCount),
      row.grossPay.toFixed(2),
      row.incomeTax.toFixed(2),
      row.inssEmployee.toFixed(2),
      row.inssEmployer.toFixed(2),
      row.netPay.toFixed(2),
      row.employerCost.toFixed(2),
    ]);
    const csv = [
      header.join(","),
      ...body.map((line) => line.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `payroll-allocation-${selectedYear}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: t("reports.payrollAllocation.toast.title"),
      description: t("reports.payrollAllocation.toast.description"),
    });
  };

  if (loadError) {
    return (
      <>
        <SEO
          title={t("reports.payrollAllocation.title")}
          description={t("reports.payrollAllocation.subtitle")}
        />
        <ReportPage
          title={t("reports.payrollAllocation.title")}
          subtitle={t("reports.payrollAllocation.subtitle")}
          icon={FolderKanban}
        >
          <ReportEmptyState
            icon={WifiOff}
            title={t("common.connectionIssueTitle")}
            description={t("common.connectionIssueDesc")}
            actionLabel={t("common.retry")}
            onAction={() => {
              void Promise.all([
                payrollRunsQuery.refetch(),
                employeesQuery.refetch(),
                allocationQuery.refetch(),
              ]);
            }}
          />
        </ReportPage>
      </>
    );
  }

  return (
    <>
      <SEO
        title={t("reports.payrollAllocation.title")}
        description={t("reports.payrollAllocation.subtitle")}
      />
      <ReportPage
        title={t("reports.payrollAllocation.title")}
        subtitle={t("reports.payrollAllocation.subtitle")}
        icon={FolderKanban}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            {t("reports.payrollAllocation.actions.export")}
          </Button>
        }
      >
        <ReportToolbar
          ariaLabel={t("reports.shared.filters")}
          hint={t("reports.payrollAllocation.filters.hint")}
        >
          <div className="space-y-1.5">
            <Label htmlFor="allocation-report-year">
              {t("reports.payrollAllocation.filters.year")}
            </Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="allocation-report-year">
                <SelectValue
                  placeholder={t(
                    "reports.payrollAllocation.filters.selectYear",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="allocation-report-month">
              {t("reports.payrollAllocation.filters.month")}
            </Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="allocation-report-month">
                <SelectValue
                  placeholder={t(
                    "reports.payrollAllocation.filters.selectMonth",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ReportToolbar>

        <ReportSummary
          title={t("reports.shared.summary")}
          icon={FolderKanban}
          items={[
            {
              label: t("reports.payrollAllocation.stats.payrollRuns"),
              value: loading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                (totals?.runCount ?? 0)
              ),
            },
            {
              label: t("reports.payrollAllocation.stats.employees"),
              value: loading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                (totals?.employeeCount ?? 0)
              ),
            },
            {
              label: t("reports.payrollAllocation.stats.grossPayroll"),
              value: loading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                formatUSD(totals?.grossPay ?? 0)
              ),
            },
            {
              label: t("reports.payrollAllocation.stats.employerCost"),
              value: loading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                formatUSD(totals?.employerCost ?? 0)
              ),
            },
          ]}
        />

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              {t("reports.payrollAllocation.table.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <div className="space-y-3 md:hidden">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-lg border border-border/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("reports.payrollAllocation.table.project")}
                        </TableHead>
                        <TableHead>
                          {t("reports.payrollAllocation.table.fundingSource")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.employees")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.gross")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.incomeTax")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.inssEmployee")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.inssEmployer")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.net")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.employerCost")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }, (_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-8" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
                <Building2 className="h-4 w-4" />
                {t("reports.payrollAllocation.table.empty")}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {rows.map((row) => (
                    <div
                      key={`${row.projectCode}-${row.fundingSource}`}
                      className="space-y-3 rounded-lg border border-border/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {row.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.fundingSource}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("reports.payrollAllocation.table.employeesCount", {
                            count: row.employeeCount,
                          })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.payrollAllocation.table.gross")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.grossPay)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.payrollAllocation.table.net")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.netPay)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.payrollAllocation.table.inssEmployer")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.inssEmployer)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t("reports.payrollAllocation.table.employerCost")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatUSD(row.employerCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("reports.payrollAllocation.table.project")}
                        </TableHead>
                        <TableHead>
                          {t("reports.payrollAllocation.table.fundingSource")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.employees")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.gross")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.incomeTax")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.inssEmployee")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.inssEmployer")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.net")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.payrollAllocation.table.employerCost")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow
                          key={`${row.projectCode}-${row.fundingSource}`}
                        >
                          <TableCell>{row.projectCode}</TableCell>
                          <TableCell>{row.fundingSource}</TableCell>
                          <TableCell className="text-right">
                            {row.employeeCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.grossPay)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.incomeTax)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.inssEmployee)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.inssEmployer)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.netPay)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUSD(row.employerCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </ReportPage>
    </>
  );
}
