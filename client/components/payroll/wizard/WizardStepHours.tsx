/**
 * Wizard Step 3 — "Adjust hours & pay"
 * The employee payroll table with inline editing.
 * Reuses PayrollEmployeeRow. Adds attendance sync + warnings.
 * Design: Table is unavoidable complexity, but we add a sticky total footer
 * and prominent sync button so users don't have to type everything manually.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { PayrollEmployeeRow } from "@/components/payroll";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { EmployeePayrollData } from "@/lib/payroll/run-payroll-helpers";
import { useI18n } from "@/i18n/I18nProvider";

interface PayrollWarning {
  employeeName: string;
  message: string;
  type: "wage" | "hours";
}

interface WizardStepHoursProps {
  filteredData: EmployeePayrollData[];
  totalCount: number;
  editedCount: number;
  expandedRows: Set<string>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onToggleExpand: (id: string) => void;
  onInputChange: (employeeId: string, field: string, value: number) => void;
  onReset: (employeeId: string) => void;
  onSyncAttendance: () => void;
  syncingAttendance: boolean;
  payrollWarnings: PayrollWarning[];
  totals: {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
  };
}

export function WizardStepHours({
  filteredData,
  totalCount,
  editedCount,
  expandedRows,
  searchTerm,
  setSearchTerm,
  onToggleExpand,
  onInputChange,
  onReset,
  onSyncAttendance,
  syncingAttendance,
  payrollWarnings,
  totals,
}: WizardStepHoursProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t("runPayroll.stepHoursTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("runPayroll.stepHoursDesc")}</p>
      </div>

      {/* Sync Attendance — prominent, first thing they see */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/50 bg-muted/20">
        <div>
          <p className="text-sm font-semibold">{t("runPayroll.syncAttendance")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("runPayroll.syncAttendanceDesc")}</p>
        </div>
        <Button
          variant="outline"
          onClick={onSyncAttendance}
          disabled={syncingAttendance}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncingAttendance ? "animate-spin" : ""}`} />
          {syncingAttendance ? t("runPayroll.syncingAttendance") : t("runPayroll.syncAttendance")}
        </Button>
      </div>

      {/* Toolbar — search + counts */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("runPayroll.searchEmployees")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 border-border/50"
          />
        </div>
        <Badge variant="outline" className="text-xs font-normal tabular-nums shrink-0">
          {filteredData.length}{filteredData.length !== totalCount ? ` / ${totalCount}` : ""}
        </Badge>
        {editedCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs shrink-0">
            {t("runPayroll.modified", { count: String(editedCount) })}
          </Badge>
        )}
      </div>

      {/* Warnings */}
      {payrollWarnings.length > 0 && (
        <div className="space-y-1.5 p-3 rounded-xl border border-red-500/30 bg-red-50/30 dark:bg-red-950/10">
          {payrollWarnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium">{w.employeeName}:</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Employee Table */}
      <div className="overflow-x-auto border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">{t("runPayroll.employee")}</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">{t("runPayroll.department")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.hours")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.ot")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.night")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.bonus")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.gross")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.deductions")}</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">{t("runPayroll.netPay")}</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((data) => (
              <PayrollEmployeeRow
                key={data.employee.id}
                data={data}
                isExpanded={expandedRows.has(data.employee.id || "")}
                onToggleExpand={onToggleExpand}
                onInputChange={onInputChange}
                onReset={onReset}
              />
            ))}
          </TableBody>
        </Table>
        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium">{t("runPayroll.noEmployeesFound")}</p>
            <p className="text-sm text-muted-foreground">{t("runPayroll.tryAdjustSearch")}</p>
          </div>
        )}
      </div>

      {/* Running Total Footer */}
      <div className="flex flex-wrap items-center justify-end gap-6 px-3 py-3 rounded-xl border border-border/50 bg-muted/20 text-sm">
        <div>
          <span className="text-muted-foreground">{t("runPayroll.totalGrossPay")}: </span>
          <span className="font-bold tabular-nums">{formatCurrencyTL(totals.grossPay)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("runPayroll.deductions")}: </span>
          <span className="font-bold tabular-nums text-red-600">-{formatCurrencyTL(totals.totalDeductions)}</span>
        </div>
        <div className="pl-2 border-l border-border/50">
          <span className="text-muted-foreground">{t("runPayroll.netPay")}: </span>
          <span className="font-extrabold tabular-nums text-emerald-600 text-base">{formatCurrencyTL(totals.netPay)}</span>
        </div>
      </div>
    </div>
  );
}
