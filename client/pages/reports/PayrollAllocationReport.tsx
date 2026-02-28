import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useAllEmployees } from "@/hooks/useEmployees";
import { payrollService } from "@/services/payrollService";
import { getTodayTL } from "@/lib/dateUtils";
import { Download, FolderKanban, Building2 } from "lucide-react";
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

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PayrollAllocationReport() {
  const tenantId = useTenantId();
  const today = getTodayTL();
  const [selectedYear, setSelectedYear] = useState(today.substring(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(today.substring(5, 7));

  const { data: payrollRuns = [], isLoading: runsLoading } = usePayrollRuns({ limit: 300 });
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees(1000);

  const payrollRunsForPeriod = useMemo(() => {
    const prefix = `${selectedYear}-${selectedMonth}`;
    return payrollRuns.filter(
      (run) =>
        Boolean(run.id) &&
        (run.status === "approved" || run.status === "paid") &&
        typeof run.payDate === "string" &&
        run.payDate.startsWith(prefix)
    );
  }, [payrollRuns, selectedYear, selectedMonth]);

  const runIds = useMemo(
    () => payrollRunsForPeriod.map((run) => run.id!).sort(),
    [payrollRunsForPeriod]
  );

  const allocationQuery = useQuery({
    queryKey: [
      "reports",
      tenantId,
      "payroll-allocation",
      selectedYear,
      selectedMonth,
      runIds.join(","),
    ],
    enabled: runIds.length > 0 && employees.length > 0,
    queryFn: async (): Promise<{ rows: AllocationRow[]; totals: AllocationTotals }> => {
      const employeeMeta = createEmployeeAllocationMetaMap(employees);

      const recordsByRun = await Promise.all(
        payrollRunsForPeriod.map((run) =>
          payrollService.records.getPayrollRecordsByRunId(run.id!, tenantId)
        )
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
            projectCode: "Unassigned",
            fundingSource: "Unassigned",
          };
          const key = `${meta.projectCode}::${meta.fundingSource}`;
          const incomeTax =
            record.deductions?.find((deduction) => deduction.type === "income_tax")?.amount || 0;
          const inssEmployee =
            record.deductions?.find((deduction) => deduction.type === "inss_employee")?.amount || 0;
          const inssEmployer =
            record.employerTaxes?.find((tax) => tax.type === "inss_employer")?.amount || 0;

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
  const loading = runsLoading || employeesLoading || allocationQuery.isLoading;

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
      "Project Code",
      "Funding Source",
      "Employee Count",
      "Gross Pay",
      "Income Tax",
      "INSS Employee",
      "INSS Employer",
      "Net Pay",
      "Employer Cost",
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
    const csv = [header.join(","), ...body.map((line) => line.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-allocation-${selectedYear}-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.payrollReports} />
      <MainNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <AutoBreadcrumb className="mb-6" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payroll Allocation Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Project and funding source payroll breakdown for NGO and donor reporting.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Year</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
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
            <div>
              <p className="text-xs text-muted-foreground mb-1">Month</p>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Payroll Runs</CardTitle>
            </CardHeader>
            <CardContent className="text-xl sm:text-2xl font-semibold">
              {loading ? <Skeleton className="h-8 w-12" /> : totals?.runCount ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Employees</CardTitle>
            </CardHeader>
            <CardContent className="text-xl sm:text-2xl font-semibold">
              {loading ? <Skeleton className="h-8 w-12" /> : totals?.employeeCount ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gross Payroll</CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {loading ? <Skeleton className="h-8 w-28" /> : formatUSD(totals?.grossPay ?? 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Employer Cost</CardTitle>
            </CardHeader>
            <CardContent className="text-lg sm:text-2xl font-semibold break-words">
              {loading ? <Skeleton className="h-8 w-28" /> : formatUSD(totals?.employerCost ?? 0)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              By Project and Funding Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
                <Building2 className="h-4 w-4" />
                No approved or paid payroll runs found for this period.
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {rows.map((row) => (
                    <Card key={`${row.projectCode}-${row.fundingSource}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{row.projectCode}</p>
                            <p className="text-xs text-muted-foreground">{row.fundingSource}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{row.employeeCount} employees</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross</p>
                            <p className="text-sm font-medium">{formatUSD(row.grossPay)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net</p>
                            <p className="text-sm font-medium">{formatUSD(row.netPay)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">INSS Employer</p>
                            <p className="text-sm font-medium">{formatUSD(row.inssEmployer)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Employer Cost</p>
                            <p className="text-sm font-medium">{formatUSD(row.employerCost)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Funding Source</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Income Tax</TableHead>
                        <TableHead className="text-right">INSS Emp</TableHead>
                        <TableHead className="text-right">INSS Employer</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Employer Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={`${row.projectCode}-${row.fundingSource}`}>
                          <TableCell>{row.projectCode}</TableCell>
                          <TableCell>{row.fundingSource}</TableCell>
                          <TableCell className="text-right">{row.employeeCount}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.grossPay)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.incomeTax)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.inssEmployee)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.inssEmployer)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.netPay)}</TableCell>
                          <TableCell className="text-right">{formatUSD(row.employerCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
