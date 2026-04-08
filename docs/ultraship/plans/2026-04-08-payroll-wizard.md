# Payroll Run Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultraship:subagent-driven-development (recommended) or ultraship:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page RunPayroll with a 4-step wizard that breaks payroll into digestible steps for non-technical Timor-Leste users.

**Architecture:** Create a `RunPayrollWizard.tsx` page that uses the existing `StepWizard` UI component and `usePayrollCalculator` hook. Each wizard step is a focused component that renders one decision at a time. The existing `RunPayroll.tsx` is preserved as a fallback (renamed import path in routes). All calculation logic, types, and services remain untouched.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui (StepWizard, Card, Table, Badge, Button), usePayrollCalculator hook, Lucide icons.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing `usePayrollCalculator` hook couples period config to employee init via `useEffect` | Medium | Medium | Hook already handles this - wizard just feeds it values in a different order. Verify employee data re-initializes when navigating back to step 1 and changing frequency. |
| StepWizard `min-h-[420px]` on CardContent may be too small for the employee table in step 3 | Low | Low | Override with className on that step's content, or remove min-h from wrapper. |

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `client/components/payroll/wizard/WizardStepPeriod.tsx` | Step 1: Frequency picker (radio cards), date range, pay date, subsidio toggle |
| Create | `client/components/payroll/wizard/WizardStepEmployees.tsx` | Step 2: Employee checklist with compliance badges, include/exclude controls |
| Create | `client/components/payroll/wizard/WizardStepHours.tsx` | Step 3: Employee table (hours, OT, bonus), search, attendance sync, warnings |
| Create | `client/components/payroll/wizard/WizardStepReview.tsx` | Step 4: Summary cards, per-employee net pay list, submit/draft buttons |
| Create | `client/components/payroll/wizard/index.ts` | Barrel exports for wizard steps |
| Create | `client/pages/payroll/RunPayrollWizard.tsx` | Wizard container: StepWizard + usePayrollCalculator + step routing |
| Modify | `client/routes.tsx` | Point `/payroll/run` to `RunPayrollWizard` instead of `RunPayroll` |
| Modify | `client/components/payroll/index.ts` | Re-export wizard barrel |
| Modify | `client/components/ui/StepWizard.tsx:168` | Allow overriding `min-h` on CardContent via prop |

**Dependencies:**
- Tasks 1-4 (step components) are independent of each other and can be built in parallel.
- Task 5 (wizard container) depends on Tasks 1-4 being complete.
- Task 6 (route swap) depends on Task 5.

---

## Task 1: Create WizardStepPeriod (Step 1 - "When are you paying?")

**Files:**
- Create: `client/components/payroll/wizard/WizardStepPeriod.tsx`

This step replaces the `PayrollPeriodConfig` card with a more visual, simplified layout. Big radio cards for frequency selection (not a dropdown). Auto-filled dates. Clear labels.

- [ ] **Step 1: Create the component file**

```tsx
// client/components/payroll/wizard/WizardStepPeriod.tsx
/**
 * Wizard Step 1 — "When are you paying?"
 * Frequency picker (radio cards), date range, pay date, subsidio toggle.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CalendarDays, CalendarRange, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TL_PAY_PERIODS } from "@/lib/payroll/constants-tl";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import { useI18n } from "@/i18n/I18nProvider";

interface WizardStepPeriodProps {
  payFrequency: TLPayFrequency;
  setPayFrequency: (v: TLPayFrequency) => void;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  payDate: string;
  setPayDate: (v: string) => void;
  includeSubsidioAnual: boolean;
  setIncludeSubsidioAnual: (v: boolean) => void;
}

const frequencyOptions: { value: TLPayFrequency; icon: typeof Calendar; labelKey: string; descKey: string }[] = [
  { value: "monthly", icon: CalendarDays, labelKey: "runPayroll.monthly", descKey: "runPayroll.monthlyDesc" },
  { value: "biweekly", icon: CalendarRange, labelKey: "runPayroll.biweekly", descKey: "runPayroll.biweeklyDesc" },
  { value: "weekly", icon: CalendarClock, labelKey: "runPayroll.weekly", descKey: "runPayroll.weeklyDesc" },
];

export function WizardStepPeriod({
  payFrequency,
  setPayFrequency,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  payDate,
  setPayDate,
  includeSubsidioAnual,
  setIncludeSubsidioAnual,
}: WizardStepPeriodProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Frequency Radio Cards */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t("runPayroll.payFrequency")}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {frequencyOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = payFrequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPayFrequency(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                  isSelected
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30 shadow-sm"
                    : "border-border/50 hover:border-green-300 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-xl",
                  isSelected
                    ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn("text-sm font-semibold", isSelected && "text-green-700 dark:text-green-300")}>
                  {t(opt.labelKey)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {TL_PAY_PERIODS[opt.value].periodsPerYear}x {t("runPayroll.perYear")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wiz-period-start" className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {t("runPayroll.periodStart")}
          </Label>
          <Input
            id="wiz-period-start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="border-border/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-period-end" className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {t("runPayroll.periodEnd")}
          </Label>
          <Input
            id="wiz-period-end"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="border-border/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-pay-date" className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {t("runPayroll.payDate")}
          </Label>
          <Input
            id="wiz-pay-date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="border-border/50"
          />
        </div>
      </div>

      {/* Subsidio Anual Toggle */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIncludeSubsidioAnual(!includeSubsidioAnual)}
      >
        <Checkbox
          checked={includeSubsidioAnual}
          onCheckedChange={(checked) => setIncludeSubsidioAnual(!!checked)}
          className="mt-0.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
        <div className="text-sm">
          <span className="font-medium">{t("runPayroll.includeSubsidio")}</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("runPayroll.subsidioDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "WizardStepPeriod" | head -5`
Expected: No errors related to this file (or no output).

- [ ] **Step 3: Commit**

```bash
git add client/components/payroll/wizard/WizardStepPeriod.tsx
git commit -m "feat(payroll): add WizardStepPeriod component for pay period selection"
```

---

## Task 2: Create WizardStepEmployees (Step 2 - "Who are you paying?")

**Files:**
- Create: `client/components/payroll/wizard/WizardStepEmployees.tsx`

This step shows employees as a simple list with compliance badges. Users can exclude employees with issues using checkboxes. Replaces the `PayrollComplianceCard` inline collapsible with a dedicated, full-width step.

- [ ] **Step 1: Create the component file**

```tsx
// client/components/payroll/wizard/WizardStepEmployees.tsx
/**
 * Wizard Step 2 — "Who are you paying?"
 * Employee checklist with compliance badges, include/exclude controls.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import type { Employee } from "@/services/employeeService";
import { useI18n } from "@/i18n/I18nProvider";

interface ComplianceIssue {
  employee: Employee;
  issues: string[];
}

interface WizardStepEmployeesProps {
  employees: Employee[];
  complianceIssues: ComplianceIssue[];
  excludedEmployees: Set<string>;
  setExcludedEmployees: (v: Set<string>) => void;
  complianceAcknowledged: boolean;
  setComplianceAcknowledged: (v: boolean) => void;
  complianceOverrideReason: string;
  setComplianceOverrideReason: (v: string) => void;
}

const OVERRIDE_REASONS = [
  "Documents pending — expected this week",
  "Verbal confirmation from employee",
  "Government office delay — receipt obtained",
  "Manager approved exception",
  "Other",
];

export function WizardStepEmployees({
  employees,
  complianceIssues,
  excludedEmployees,
  setExcludedEmployees,
  complianceAcknowledged,
  setComplianceAcknowledged,
  complianceOverrideReason,
  setComplianceOverrideReason,
}: WizardStepEmployeesProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");

  const issueMap = new Map(
    complianceIssues.map((ci) => [ci.employee.id, ci.issues])
  );

  const filteredEmployees = searchTerm
    ? employees.filter((emp) => {
        const term = searchTerm.toLowerCase();
        return (
          emp.personalInfo.firstName.toLowerCase().includes(term) ||
          emp.personalInfo.lastName.toLowerCase().includes(term) ||
          emp.jobDetails.department.toLowerCase().includes(term)
        );
      })
    : employees;

  const includedCount = employees.length - excludedEmployees.size;
  const hasUnresolvedIssues =
    complianceIssues.length > 0 &&
    complianceIssues.some((ci) => !excludedEmployees.has(ci.employee.id || ""));

  const handleExcludeAllFlagged = () => {
    const newExcluded = new Set(excludedEmployees);
    complianceIssues.forEach((ci) => newExcluded.add(ci.employee.id || ""));
    setExcludedEmployees(newExcluded);
  };

  const handleIncludeAll = () => {
    setExcludedEmployees(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{includedCount}</span> {t("runPayroll.included")}
          </span>
          {excludedEmployees.size > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserX className="h-4 w-4 text-red-500" />
              <span className="font-semibold">{excludedEmployees.size}</span> {t("runPayroll.excluded")}
            </span>
          )}
          {complianceIssues.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">{complianceIssues.length}</span> {t("runPayroll.withIssues")}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {complianceIssues.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExcludeAllFlagged}>
              <UserX className="h-3.5 w-3.5 mr-1.5" />
              {t("runPayroll.excludeFlagged")}
            </Button>
          )}
          {excludedEmployees.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleIncludeAll}>
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              {t("runPayroll.includeAll")}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("runPayroll.searchEmployees")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 border-border/50"
        />
      </div>

      {/* Employee List */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {filteredEmployees.map((emp) => {
          const empId = emp.id || "";
          const isExcluded = excludedEmployees.has(empId);
          const issues = issueMap.get(empId);
          const hasIssues = !!issues && issues.length > 0;

          return (
            <div
              key={empId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                isExcluded
                  ? "bg-red-50/30 border-red-200/50 dark:bg-red-950/10 dark:border-red-800/30 opacity-60"
                  : hasIssues
                    ? "bg-amber-50/30 border-amber-200/50 dark:bg-amber-950/10 dark:border-amber-800/30"
                    : "border-border/50 hover:bg-muted/30"
              }`}
              onClick={() => {
                const newExcluded = new Set(excludedEmployees);
                if (isExcluded) {
                  newExcluded.delete(empId);
                } else {
                  newExcluded.add(empId);
                }
                setExcludedEmployees(newExcluded);
              }}
            >
              <Checkbox
                checked={!isExcluded}
                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                onCheckedChange={() => {
                  // handled by row click
                }}
              />
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">
                  {emp.personalInfo.firstName[0]}
                  {emp.personalInfo.lastName[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {emp.jobDetails.department} &middot; {emp.jobDetails.position}
                </p>
              </div>
              {hasIssues && !isExcluded && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs shrink-0"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                </Badge>
              )}
              {!hasIssues && !isExcluded && (
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
              {isExcluded && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs shrink-0">
                  {t("runPayroll.excluded")}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Compliance Override (only if including employees with issues) */}
      {hasUnresolvedIssues && (
        <div className="p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 space-y-3">
          <div
            className="flex items-start gap-3 cursor-pointer"
            onClick={() => setComplianceAcknowledged(!complianceAcknowledged)}
          >
            <Checkbox
              checked={complianceAcknowledged}
              onCheckedChange={(checked) => setComplianceAcknowledged(!!checked)}
              className="mt-0.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {t("runPayroll.complianceAckText")}
            </span>
          </div>
          {complianceAcknowledged && (
            <div>
              <Label className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1.5 block">
                {t("runPayroll.overrideReasonLabel")}
              </Label>
              <Select
                value={complianceOverrideReason}
                onValueChange={setComplianceOverrideReason}
              >
                <SelectTrigger className="border-amber-300 dark:border-amber-700">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "WizardStepEmployees" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/components/payroll/wizard/WizardStepEmployees.tsx
git commit -m "feat(payroll): add WizardStepEmployees component for employee review"
```

---

## Task 3: Create WizardStepHours (Step 3 - "Adjust hours & pay")

**Files:**
- Create: `client/components/payroll/wizard/WizardStepHours.tsx`

This is the meat of the wizard. Shows the employee table with editable hours and bonus fields. Reuses `PayrollEmployeeRow` directly. Adds the attendance sync button and payroll warnings.

- [ ] **Step 1: Create the component file**

```tsx
// client/components/payroll/wizard/WizardStepHours.tsx
/**
 * Wizard Step 3 — "Adjust hours & pay"
 * Employee payroll table with inline editing, attendance sync, warnings.
 * Reuses PayrollEmployeeRow for each row.
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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
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
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
              {t("runPayroll.modified", { count: String(editedCount) })}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSyncAttendance}
          disabled={syncingAttendance}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncingAttendance ? "animate-spin" : ""}`} />
          {syncingAttendance ? t("runPayroll.syncingAttendance") : t("runPayroll.syncAttendance")}
        </Button>
      </div>

      {/* Warnings */}
      {payrollWarnings.length > 0 && (
        <div className="space-y-1.5 p-3 rounded-lg border border-red-500/30 bg-red-50/30 dark:bg-red-950/10">
          {payrollWarnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 p-2 rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium">{w.employeeName}:</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Employee Table */}
      <div className="overflow-x-auto border rounded-lg">
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

      {/* Running Total - Sticky Footer */}
      <div className="flex items-center justify-end gap-6 px-2 py-3 border-t text-sm">
        <div>
          <span className="text-muted-foreground">{t("runPayroll.totalGrossPay")}: </span>
          <span className="font-semibold tabular-nums">{formatCurrencyTL(totals.grossPay)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("runPayroll.deductions")}: </span>
          <span className="font-semibold tabular-nums text-red-600">-{formatCurrencyTL(totals.totalDeductions)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("runPayroll.netPay")}: </span>
          <span className="font-bold tabular-nums text-emerald-600">{formatCurrencyTL(totals.netPay)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "WizardStepHours" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/components/payroll/wizard/WizardStepHours.tsx
git commit -m "feat(payroll): add WizardStepHours component for employee table editing"
```

---

## Task 4: Create WizardStepReview (Step 4 - "Confirm & Submit")

**Files:**
- Create: `client/components/payroll/wizard/WizardStepReview.tsx`

The final confirmation step. Shows summary cards, per-employee net pay list, and the submit/draft actions. Replaces the modal-based confirmation with an inline review.

- [ ] **Step 1: Create the component file**

```tsx
// client/components/payroll/wizard/WizardStepReview.tsx
/**
 * Wizard Step 4 — "Confirm & Submit"
 * Summary totals, per-employee net pay cards, save draft / submit buttons.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  Calendar,
  CheckCircle,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Save,
  Users,
} from "lucide-react";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import { formatPayPeriod, formatPayDate } from "@/lib/payroll/run-payroll-helpers";
import type { EmployeePayrollData } from "@/lib/payroll/run-payroll-helpers";
import { useI18n } from "@/i18n/I18nProvider";

interface PayrollTotals {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  totalEmployerCost: number;
}

interface WizardStepReviewProps {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  editedCount: number;
  totals: PayrollTotals;
  includedEmployees: EmployeePayrollData[];
  onSaveDraft: () => void;
  onSubmit: () => void;
  saving: boolean;
  processing: boolean;
}

export function WizardStepReview({
  periodStart,
  periodEnd,
  payDate,
  employeeCount,
  editedCount,
  totals,
  includedEmployees,
  onSaveDraft,
  onSubmit,
  saving,
  processing,
}: WizardStepReviewProps) {
  const { t } = useI18n();
  const isSubmitting = saving || processing;

  return (
    <div className="space-y-6">
      {/* Period Summary */}
      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            {t("runPayroll.payPeriod")}
          </span>
        </div>
        <p className="font-semibold text-lg">
          {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : t("runPayroll.notSet")}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("runPayroll.payDateLabel")} {payDate ? formatPayDate(payDate) : t("runPayroll.notSet")}
          {" "}&middot;{" "}{employeeCount} {t("runPayroll.employees")}
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalGross")}</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrencyTL(totals.grossPay)}</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalDeductions")}</p>
          <p className="text-lg font-bold tabular-nums text-red-600">{formatCurrencyTL(totals.totalDeductions)}</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
          <p className="text-xs text-muted-foreground">{t("runPayroll.netToEmployees")}</p>
          <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrencyTL(totals.netPay)}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-500/10">
          <p className="text-xs text-muted-foreground">{t("runPayroll.totalEmployerCost")}</p>
          <p className="text-lg font-bold tabular-nums text-amber-600">{formatCurrencyTL(totals.totalEmployerCost)}</p>
        </div>
      </div>

      {editedCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Pencil className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {t("runPayroll.manuallyAdjusted", { count: String(editedCount) })}
          </span>
        </div>
      )}

      {/* Per-Employee Summary (scrollable) */}
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t("runPayroll.employeeBreakdown")}
        </p>
        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
          {includedEmployees.map((d) => (
            <div
              key={d.employee.id}
              className="flex items-center justify-between px-3 py-2 rounded-md border border-border/30 bg-muted/20 text-sm"
            >
              <span className="font-medium truncate flex-1">
                {d.employee.personalInfo.firstName} {d.employee.personalInfo.lastName}
              </span>
              <span className="tabular-nums font-semibold text-emerald-600 ml-4">
                {d.calculation ? formatCurrencyTL(d.calculation.netPay) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* What happens next */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
        <p className="font-medium text-sm mb-2">{t("runPayroll.thisActionWill")}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {t("runPayroll.submitForReview")}
          </li>
          <li className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {t("runPayroll.differentAdminApprove")}
          </li>
          <li className="flex items-start gap-2">
            <Calculator className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {t("runPayroll.journalEntriesCreated")}
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("runPayroll.savingDraft")}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t("runPayroll.saveDraft")}
            </>
          )}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("runPayroll.submitting")}
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t("runPayroll.submitForApproval")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "WizardStepReview" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/components/payroll/wizard/WizardStepReview.tsx
git commit -m "feat(payroll): add WizardStepReview component for final confirmation"
```

---

## Task 5: Create wizard barrel export and update StepWizard

**Files:**
- Create: `client/components/payroll/wizard/index.ts`
- Modify: `client/components/ui/StepWizard.tsx:168`
- Modify: `client/components/payroll/index.ts`

- [ ] **Step 1: Create barrel export**

```ts
// client/components/payroll/wizard/index.ts
export { WizardStepPeriod } from "./WizardStepPeriod";
export { WizardStepEmployees } from "./WizardStepEmployees";
export { WizardStepHours } from "./WizardStepHours";
export { WizardStepReview } from "./WizardStepReview";
```

- [ ] **Step 2: Update StepWizard to allow content height override**

In `client/components/ui/StepWizard.tsx`, line 168, change:

```tsx
// FROM:
<CardContent className="min-h-[420px]">{children}</CardContent>

// TO:
<CardContent className={cn("min-h-[420px]", contentClassName)}>{children}</CardContent>
```

And add `contentClassName?: string;` to the `StepWizardProps` interface (after `className`), destructure it in the component.

- [ ] **Step 3: Re-export wizard from payroll barrel**

In `client/components/payroll/index.ts`, add at the end:

```ts
export { WizardStepPeriod, WizardStepEmployees, WizardStepHours, WizardStepReview } from "./wizard";
```

- [ ] **Step 4: Commit**

```bash
git add client/components/payroll/wizard/index.ts client/components/ui/StepWizard.tsx client/components/payroll/index.ts
git commit -m "feat(payroll): add wizard barrel exports and StepWizard contentClassName prop"
```

---

## Task 6: Create RunPayrollWizard page (the container)

**Files:**
- Create: `client/pages/payroll/RunPayrollWizard.tsx`

This is the main orchestrator. It uses `StepWizard` for navigation, `usePayrollCalculator` for state, and renders the appropriate step component based on `currentStep`.

**Depends on:** Tasks 1-5 must be complete.

- [ ] **Step 1: Create the wizard page**

```tsx
// client/pages/payroll/RunPayrollWizard.tsx
/**
 * Run Payroll Wizard — 4-step guided payroll flow
 * Replaces the single-page RunPayroll with digestible steps.
 *
 * Step 1: Pay Period (when)
 * Step 2: Employees (who)
 * Step 3: Hours & Pay (what)
 * Step 4: Review & Submit (confirm)
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StepWizard, StepContent } from "@/components/ui/StepWizard";
import type { WizardStep } from "@/components/ui/StepWizard";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useCreatePayrollRunWithRecords } from "@/hooks/usePayroll";
import { usePayrollCalculator } from "@/hooks/usePayrollCalculator";
import { PayrollLoadingSkeleton } from "@/components/payroll";
import {
  WizardStepPeriod,
  WizardStepEmployees,
  WizardStepHours,
  WizardStepReview,
} from "@/components/payroll/wizard";
import MainNavigation from "@/components/layout/MainNavigation";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { payrollNavConfig } from "@/lib/moduleNav";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL } from "@/lib/dateUtils";
import { Calendar, CheckCircle, Clock, Users } from "lucide-react";

const WIZARD_STEPS: WizardStep[] = [
  { id: "period", title: "Pay Period", icon: Calendar },
  { id: "employees", title: "Employees", icon: Users },
  { id: "hours", title: "Hours & Pay", icon: Clock },
  { id: "review", title: "Review", icon: CheckCircle },
];

export default function RunPayrollWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [currentStep, setCurrentStep] = useState(0);

  // Compliance UI state (lives here, not in calculator hook)
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");

  // Data
  const { data: activeEmployees = [], isLoading: loadingEmployees } =
    useEmployeeDirectory({ status: "active" });

  const createPayrollMutation = useCreatePayrollRunWithRecords();

  const calc = usePayrollCalculator({
    activeEmployees,
    tenantId,
    userId: user?.uid || "current-user",
  });

  // Step validation — called before advancing
  const handleBeforeNext = useCallback((): boolean => {
    if (currentStep === 0) {
      // Validate period dates
      if (!calc.periodStart || !calc.periodEnd || !calc.payDate) {
        toast({
          title: t("runPayroll.toastDatesRequired"),
          description: t("runPayroll.toastDatesRequiredDesc"),
          variant: "destructive",
        });
        return false;
      }
      if (calc.periodStart >= calc.periodEnd) {
        toast({
          title: t("runPayroll.toastInvalidPeriod"),
          description: t("runPayroll.toastInvalidPeriodDesc"),
          variant: "destructive",
        });
        return false;
      }
      if (calc.payDate < calc.periodEnd) {
        toast({
          title: t("runPayroll.toastInvalidPayDate"),
          description: t("runPayroll.toastInvalidPayDateDesc"),
          variant: "destructive",
        });
        return false;
      }
      // SEC-6: Date range bounds
      const now = new Date();
      const twoYearsAgo = toDateStringTL(new Date(now.getFullYear() - 2, now.getMonth(), 1));
      const oneMonthAhead = toDateStringTL(new Date(now.getFullYear(), now.getMonth() + 2, 0));
      if (calc.periodStart < twoYearsAgo || calc.periodEnd > oneMonthAhead) {
        toast({
          title: t("runPayroll.toastDateOutOfBounds"),
          description: t("runPayroll.toastDateOutOfBoundsDesc"),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    if (currentStep === 1) {
      // Validate compliance acknowledgment if including flagged employees
      if (
        calc.hasComplianceIssues &&
        calc.excludedEmployees.size < calc.complianceIssues.length
      ) {
        if (!complianceAcknowledged) {
          toast({
            title: t("runPayroll.toastComplianceRequired"),
            description: t("runPayroll.toastComplianceRequiredDesc"),
            variant: "destructive",
          });
          return false;
        }
        if (complianceOverrideReason.trim().length < 5) {
          toast({
            title: t("runPayroll.toastOverrideShort"),
            description: t("runPayroll.toastOverrideShortDesc"),
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }

    if (currentStep === 2) {
      // Validate employee data
      const includedData = calc.getIncludedData();
      const errors = calc.validateAllEmployees(includedData);
      if (errors.length > 0) {
        toast({
          title: t("runPayroll.toastValidationErrors"),
          description:
            errors.slice(0, 3).join("\n") +
            (errors.length > 3 ? `\n...and ${errors.length - 3} more` : ""),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    return true;
  }, [
    currentStep,
    calc,
    complianceAcknowledged,
    complianceOverrideReason,
    toast,
    t,
  ]);

  // Save as draft
  const handleSaveDraft = useCallback(() => {
    const includedData = calc.getIncludedData();
    const payrollRun = calc.buildPayrollRun(includedData);
    const records = calc.buildPayrollRecords(includedData);

    createPayrollMutation.mutate(
      { payrollRun, records },
      {
        onSuccess: () => {
          toast({
            title: t("common.success"),
            description: t("runPayroll.toastDraftSaved"),
          });
          navigate("/payroll/history");
        },
        onError: () => {
          toast({
            title: t("common.error"),
            description: t("runPayroll.toastSaveFailed"),
            variant: "destructive",
          });
        },
      }
    );
  }, [calc, createPayrollMutation, toast, t, navigate]);

  // Submit for approval
  const handleSubmit = useCallback(() => {
    const includedData = calc.getIncludedData();
    const payrollRun = {
      ...calc.buildPayrollRun(includedData),
      status: "processing" as const,
    };
    const records = calc.buildPayrollRecords(includedData);
    const audit = {
      tenantId,
      userId: user?.uid || "current-user",
      userEmail: user?.email || "",
    };

    createPayrollMutation.mutate(
      { payrollRun, records, audit },
      {
        onSuccess: () => {
          toast({
            title: t("runPayroll.toastSubmittedTitle"),
            description: t("runPayroll.toastSubmittedDesc", {
              count: String(includedData.length),
            }),
          });
          navigate("/payroll/history");
        },
        onError: () => {
          toast({
            title: t("runPayroll.toastErrorTitle"),
            description: t("runPayroll.toastErrorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  }, [calc, createPayrollMutation, tenantId, user, toast, t, navigate]);

  if (loadingEmployees) {
    return <PayrollLoadingSkeleton />;
  }

  const currentStepId = WIZARD_STEPS[currentStep].id;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />
      <ModuleSectionNav config={payrollNavConfig} />

      {/* Hero */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <AutoBreadcrumb className="mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("runPayroll.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("runPayroll.processPayrollFor", {
              count: String(activeEmployees.length),
            })}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <StepWizard
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onBeforeNext={handleBeforeNext}
          onCancel={() => navigate("/payroll")}
          onComplete={handleSubmit}
          isSubmitting={createPayrollMutation.isPending}
          submitLabel={t("runPayroll.submitForApproval")}
          contentClassName="min-h-0"
        >
          <StepContent stepId="period" currentStepId={currentStepId}>
            <WizardStepPeriod
              payFrequency={calc.payFrequency}
              setPayFrequency={calc.setPayFrequency}
              periodStart={calc.periodStart}
              setPeriodStart={calc.setPeriodStart}
              periodEnd={calc.periodEnd}
              setPeriodEnd={calc.setPeriodEnd}
              payDate={calc.payDate}
              setPayDate={calc.setPayDate}
              includeSubsidioAnual={calc.includeSubsidioAnual}
              setIncludeSubsidioAnual={calc.setIncludeSubsidioAnual}
            />
          </StepContent>

          <StepContent stepId="employees" currentStepId={currentStepId}>
            <WizardStepEmployees
              employees={activeEmployees}
              complianceIssues={calc.complianceIssues}
              excludedEmployees={calc.excludedEmployees}
              setExcludedEmployees={calc.setExcludedEmployees}
              complianceAcknowledged={complianceAcknowledged}
              setComplianceAcknowledged={setComplianceAcknowledged}
              complianceOverrideReason={complianceOverrideReason}
              setComplianceOverrideReason={setComplianceOverrideReason}
            />
          </StepContent>

          <StepContent stepId="hours" currentStepId={currentStepId}>
            <WizardStepHours
              filteredData={calc.filteredData}
              totalCount={calc.employeePayrollData.length}
              editedCount={calc.editedCount}
              expandedRows={calc.expandedRows}
              searchTerm={calc.searchTerm}
              setSearchTerm={calc.setSearchTerm}
              onToggleExpand={calc.toggleRowExpansion}
              onInputChange={calc.handleInputChange}
              onReset={calc.handleResetRow}
              onSyncAttendance={calc.handleSyncFromAttendance}
              syncingAttendance={calc.syncingAttendance}
              payrollWarnings={calc.payrollWarnings}
              totals={calc.totals}
            />
          </StepContent>

          <StepContent stepId="review" currentStepId={currentStepId}>
            <WizardStepReview
              periodStart={calc.periodStart}
              periodEnd={calc.periodEnd}
              payDate={calc.payDate}
              employeeCount={
                activeEmployees.length - calc.excludedEmployees.size
              }
              editedCount={calc.editedCount}
              totals={calc.totals}
              includedEmployees={calc.getIncludedData()}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
              saving={createPayrollMutation.isPending}
              processing={createPayrollMutation.isPending}
            />
          </StepContent>
        </StepWizard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "RunPayrollWizard\|WizardStep" | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/pages/payroll/RunPayrollWizard.tsx
git commit -m "feat(payroll): add RunPayrollWizard page orchestrating 4-step flow"
```

---

## Task 7: Update route to use wizard

**Files:**
- Modify: `client/routes.tsx`

Swap the lazy import for `/payroll/run` from `RunPayroll` to `RunPayrollWizard`. Keep `RunPayroll.tsx` in the codebase as a fallback (not deleted).

- [ ] **Step 1: Update the lazy import in routes.tsx**

Find the line that imports `RunPayroll`:
```tsx
const RunPayroll = lazy(() => import("./client/pages/payroll/RunPayroll"));
```

Add a new import below it:
```tsx
const RunPayrollWizard = lazy(() => import("./client/pages/payroll/RunPayrollWizard"));
```

Then find the route element for `/payroll/run` and change it from `<RunPayroll />` to `<RunPayrollWizard />`.

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
Navigate to `/payroll/run` in the browser.
Expected: See 4-step wizard with "Pay Period" as step 1.

- [ ] **Step 4: Commit**

```bash
git add client/routes.tsx
git commit -m "feat(payroll): route /payroll/run to wizard flow"
```

---

## Task 8: Add missing i18n keys

**Files:**
- Modify: `client/i18n/locales/en.json` (and `tet.json` if applicable)

The wizard introduces a few new translation keys. Add them to the i18n files.

- [ ] **Step 1: Add new keys to English locale**

Search for existing `runPayroll.*` keys and add these alongside them:

```json
"runPayroll.perYear": "per year",
"runPayroll.monthlyDesc": "Once per month",
"runPayroll.biweeklyDesc": "Every two weeks",
"runPayroll.weeklyDesc": "Every week",
"runPayroll.withIssues": "with issues",
"runPayroll.excludeFlagged": "Exclude flagged",
"runPayroll.employeeBreakdown": "Employee breakdown"
```

- [ ] **Step 2: Add keys to Tetun locale (if exists)**

```json
"runPayroll.perYear": "tinan ida",
"runPayroll.monthlyDesc": "Dala ida fulan ida",
"runPayroll.biweeklyDesc": "Semana rua-rua",
"runPayroll.weeklyDesc": "Semana ida-ida",
"runPayroll.withIssues": "ho problema",
"runPayroll.excludeFlagged": "Esklui ne'ebé iha problema",
"runPayroll.employeeBreakdown": "Detallu funsionáriu"
```

- [ ] **Step 3: Commit**

```bash
git add client/i18n/locales/
git commit -m "feat(i18n): add payroll wizard translation keys"
```
