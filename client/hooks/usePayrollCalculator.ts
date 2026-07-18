/**
 * usePayrollCalculator - Extracted payroll calculation logic from RunPayroll.tsx
 *
 * Handles:
 * - Per-employee payroll calculation (TL tax law)
 * - Input change with validation and edit tracking
 * - Attendance sync
 * - Row reset
 * - Totals computation
 * - Payroll warnings (min wage, excessive hours)
 * - Validation, build run/records for submission
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useAdvancedTax } from "@/contexts/TenantContext";
import { useAttendanceSummary } from "@/hooks/useAttendance";

import {
  calculateHourlyRate,
  calculateTLPayroll,
  calculateSubsidioAnual,
  validateTLPayrollInput,
  type TLPayrollInput,
  type TLBonusINSSCategory,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import {
  TL_PAY_PERIODS,
  TL_WORKING_HOURS,
  TL_OVERTIME_RATES,
  TL_DEDUCTION_TYPE_LABELS,
} from "@/lib/payroll/constants-tl";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import type { PayrollConfig } from "@/types/settings";
import { addMoney, sumMoney } from "@/lib/currency";
import { getTodayTL } from "@/lib/dateUtils";
import { getInitialPayrollDates } from "@/lib/payroll/payroll-schedule";
import type { Employee } from "@/services/employeeService";
import { payrollService, type EmployeePayrollYTD } from "@/services/payrollService";
import type { AttendanceEmployeeSummary } from "@/services/attendanceService";
import { leaveService, calculateWorkingDays, TL_LEAVE_TYPES } from "@/services/leaveService";
import { getComplianceIssues } from "@/lib/employeeUtils";

import {
  calculateProRataHours,
  computeLeaveCredits,
  type EmployeePayrollData,
  getPayPeriodsInPayMonth,
} from "@/lib/payroll/run-payroll-helpers";

interface UsePayrollCalculatorOptions {
  activeEmployees: Employee[];
  tenantId: string;
  userId: string;
  payrollConfig?: PayrollConfig;
  defaultPayFrequency?: TLPayFrequency;
  defaultPayDay?: number;
}

const EMPTY_YTD_BY_EMPLOYEE: Record<string, EmployeePayrollYTD> = {};

// Shareholders receive profit distributions, not wages — exempt from WIT withholding and
// INSS enrollment, and outside minimum-wage rules.
function isShareholder(employee: Employee): boolean {
  return (employee.jobDetails.employmentType || "").toLowerCase() === "shareholder";
}

export function usePayrollCalculator({
  activeEmployees,
  tenantId,
  userId,
  payrollConfig,
  defaultPayFrequency,
  defaultPayDay,
}: UsePayrollCalculatorOptions) {
  const { toast } = useToast();
  const { t } = useI18n();
  const showAdvancedTax = useAdvancedTax();

  const [employeePayrollData, setEmployeePayrollData] = useState<EmployeePayrollData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Payroll period settings
  const initialPayrollDates = useMemo(
    () => getInitialPayrollDates({ frequency: "monthly", payDay: 25 }),
    [],
  );
  const [payFrequency, setPayFrequency] = useState<TLPayFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState(initialPayrollDates.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPayrollDates.periodEnd);
  const [payDate, setPayDate] = useState(initialPayrollDates.payDate);
  const configuredScheduleApplied = useRef(false);
  const [includeSubsidioAnual, setIncludeSubsidioAnual] = useState(false);

  useEffect(() => {
    if (
      configuredScheduleApplied.current ||
      !defaultPayFrequency ||
      defaultPayDay === undefined
    ) {
      return;
    }

    const dates = getInitialPayrollDates({
      frequency: defaultPayFrequency,
      payDay: defaultPayDay,
    });
    configuredScheduleApplied.current = true;
    setPayFrequency(defaultPayFrequency);
    setPeriodStart(dates.periodStart);
    setPeriodEnd(dates.periodEnd);
    setPayDate(dates.payDate);
  }, [defaultPayDay, defaultPayFrequency]);
  const calculationConfig = useMemo(() => payrollConfig ? ({
    incomeTax: {
      residentRate: payrollConfig.tax.residentRate / 100,
      nonResidentRate: payrollConfig.tax.nonResidentRate / 100,
      residentThreshold: payrollConfig.tax.residentThreshold,
    },
    inss: {
      employeeRate: payrollConfig.socialSecurity.employeeRate / 100,
      employerRate: payrollConfig.socialSecurity.employerRate / 100,
    },
    overtime: {
      standard: payrollConfig.overtimeRates.standard,
      sundayHoliday: payrollConfig.overtimeRates.sundayHoliday,
      rounding: payrollConfig.hourlyRateConvention === 'fixed_190_round_up'
        ? 'aggregate' as const
        : 'per_component' as const,
    },
    hourlyRate: payrollConfig.hourlyRateConvention === 'fixed_190_round_up'
      ? { monthlyHoursDivisor: 190, rounding: 'up' as const }
      : undefined,
    minimumWage: payrollConfig.minimumWage,
  }) : undefined, [payrollConfig]);
  const payrollYear = Number.parseInt(payDate.slice(0, 4), 10);
  const ytdQuery = useQuery({
    queryKey: ["tenants", tenantId, "payrollYtd", payrollYear],
    queryFn: () => payrollService.records.getTenantYTDTotals(tenantId, payrollYear),
    enabled: Boolean(tenantId) && Number.isInteger(payrollYear) && activeEmployees.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const ytdByEmployee = ytdQuery.data ?? EMPTY_YTD_BY_EMPLOYEE;

  const {
    isFetching: attendanceSummaryFetching,
    refetch: refetchAttendanceSummary,
  } = useAttendanceSummary(periodStart, periodEnd);

  // Compliance states
  const [excludedEmployees, setExcludedEmployees] = useState<Set<string>>(new Set());
  const [attendanceSyncPending, setAttendanceSyncPending] = useState(false);
  const attendanceSyncRequestRef = useRef(0);

  // ─── Core calculation ───────────────────────────────────────────
  const calculateForEmployee = useCallback((data: EmployeePayrollData): TLPayrollResult | null => {
    const monthlySalary = data.employee.compensation.monthlySalary || 0;
    const hourlyRate = calculateHourlyRate(monthlySalary, calculationConfig?.hourlyRate);
    const asOfDate = payDate ? new Date(`${payDate}T00:00:00`) : new Date();
    const monthsWorkedThisYear = asOfDate.getMonth() + 1;
    const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
    const subsidioAnual = includeSubsidioAnual
      ? calculateSubsidioAnual(monthlySalary, monthsWorkedThisYear, hireDate, asOfDate)
      : 0;
    // Per-employee frequency overrides the run-level selector
    const effectiveFrequency = data.employee.compensation.payFrequency ?? payFrequency;
    const totalPeriodsInMonth = getPayPeriodsInPayMonth(payDate, effectiveFrequency);
    const isResident =
      data.employee.compensation?.isResident ??
      (data.employee.documents?.residencyStatus
        ? data.employee.documents.residencyStatus !== "foreign_worker"
        : true);
    const ytd = ytdByEmployee[data.employee.id || ""];

    const input: TLPayrollInput = {
      employeeId: data.employee.id || "",
      monthlySalary,
      payFrequency: effectiveFrequency,
      totalPeriodsInMonth,
      isHourly: false,
      hourlyRate,
      regularHours: data.regularHours,
      overtimeHours: data.overtimeHours,
      nightShiftHours: data.nightShiftHours,
      holidayHours: data.holidayHours,
      restDayHours: 0,
      absenceHours: data.absenceHours,
      lateArrivalMinutes: data.lateArrivalMinutes,
      sickDaysUsed: data.sickDays,
      ytdSickDaysUsed: ytd?.ytdSickDaysUsed || 0,
      bonus: data.bonus,
      bonusINSSCategory: data.bonusINSSCategory,
      commission: 0,
      perDiem: data.perDiem,
      foodAllowance: 0,
      transportAllowance: data.allowances,
      otherEarnings: 0,
      subsidioAnual,
      nonCashBenefits: 0,
      nonCashBenefitINSSCategory: null,
      taxInfo: {
        isResident,
        hasTaxExemption: isShareholder(data.employee),
        inssExempt: isShareholder(data.employee),
      },
      loanRepayment: 0,
      advanceRepayment: 0,
      courtOrders: 0,
      otherDeductions: 0,
      ytdGrossPay: ytd?.ytdGrossPay || 0,
      ytdIncomeTax: ytd?.ytdIncomeTax || 0,
      ytdINSSEmployee: ytd?.ytdINSSEmployee || 0,
      monthsWorkedThisYear,
      hireDate,
    };

    try {
      return calculateTLPayroll(input, calculationConfig);
    } catch (error) {
      console.error("Calculation error for employee:", data.employee.id, error);
      return null;
    }
  }, [payFrequency, payDate, includeSubsidioAnual, ytdByEmployee, calculationConfig]);

  const latestCalculatorRef = useRef(calculateForEmployee);
  const [appliedCalculator, setAppliedCalculator] = useState(
    () => calculateForEmployee,
  );

  useEffect(() => {
    latestCalculatorRef.current = calculateForEmployee;
  }, [calculateForEmployee]);

  // Initialize rows when the employee set or period changes. The calculator ref
  // keeps async config/YTD changes from resetting manual row edits.
  useEffect(() => {
    if (activeEmployees.length === 0) {
      setEmployeePayrollData([]);
      return;
    }

    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const defaultHours = monthlyHours / TL_PAY_PERIODS[payFrequency].periodsPerMonth;

    const initialData = activeEmployees.map((employee): EmployeePayrollData => {
      const hireDate = employee.jobDetails.hireDate || "";
      const regularHours = calculateProRataHours(
        hireDate,
        periodStart,
        periodEnd,
        defaultHours,
      );
      const row: EmployeePayrollData = {
        employee,
        regularHours,
        overtimeHours: 0,
        nightShiftHours: 0,
        holidayHours: 0,
        absenceHours: 0,
        lateArrivalMinutes: 0,
        sickDays: 0,
        perDiem: 0,
        bonus: 0,
        bonusINSSCategory: null,
        allowances: 0,
        calculation: null,
        isEdited: false,
        originalValues: {
          regularHours,
          overtimeHours: 0,
          nightShiftHours: 0,
          absenceHours: 0,
          lateArrivalMinutes: 0,
          bonus: 0,
          bonusINSSCategory: null,
          perDiem: 0,
          allowances: 0,
        },
      };

      return {
        ...row,
        calculation: latestCalculatorRef.current(row),
      };
    });

    setEmployeePayrollData(initialData);
  }, [activeEmployees, payFrequency, periodStart, periodEnd]);

  // Recalculate every existing row when tax configuration, YTD totals, pay
  // date, frequency, or Subsidio settings change. Because row state is not a
  // dependency, this cannot loop, and manually edited inputs are preserved.
  useEffect(() => {
    setEmployeePayrollData((previous) => {
      if (previous.length === 0) return previous;

      return previous.map((data) => ({
        ...data,
        calculation: calculateForEmployee(data),
      }));
    });
    setAppliedCalculator(() => calculateForEmployee);
  }, [calculateForEmployee]);

  const calculationsPending = appliedCalculator !== calculateForEmployee;

  // ─── Edit tracking helpers ──────────────────────────────────────

  const checkIsEdited = (updated: EmployeePayrollData): boolean =>
    updated.regularHours !== updated.originalValues.regularHours ||
    updated.overtimeHours !== updated.originalValues.overtimeHours ||
    updated.nightShiftHours !== updated.originalValues.nightShiftHours ||
    updated.absenceHours !== updated.originalValues.absenceHours ||
    updated.lateArrivalMinutes !== updated.originalValues.lateArrivalMinutes ||
    updated.bonus !== updated.originalValues.bonus ||
    updated.bonusINSSCategory !== updated.originalValues.bonusINSSCategory ||
    updated.perDiem !== updated.originalValues.perDiem ||
    updated.allowances !== updated.originalValues.allowances;

  // ─── Input change with validation ──────────────────────────────

  const handleInputChange = useCallback((
    employeeId: string,
    field: string,
    value: number
  ) => {
    if (!Number.isFinite(value)) return;

    const hourFields = ["regularHours", "overtimeHours", "nightShiftHours", "holidayHours"];
    const moneyFields = ["bonus", "perDiem", "allowances"];

    if (hourFields.includes(field)) {
      if (value < 0 || value > 744) return;
    }
    if (moneyFields.includes(field)) {
      if (value < 0 || value > 100000) return;
    }

    setEmployeePayrollData((prev) =>
      prev.map((d) => {
        if (d.employee.id !== employeeId) return d;

        const updated = { ...d, [field]: value };
        // Simple flow never shows the INSS category select, so a paid bonus is
        // auto-classified as individual performance — DL 20/2017 Art. 8's
        // contributable case, the conservative default (never under-remits
        // INSS). Accountants (advanced mode) must classify it themselves.
        if (field === "bonus" && !showAdvancedTax) {
          updated.bonusINSSCategory = value > 0
            ? (d.bonusINSSCategory ?? "individual_performance")
            : null;
        }
        const isEdited = checkIsEdited(updated);
        const withEdit = { ...updated, isEdited };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      })
    );
  }, [calculateForEmployee, showAdvancedTax]);

  const handleBonusCategoryChange = useCallback((
    employeeId: string,
    category: TLBonusINSSCategory,
  ) => {
    setEmployeePayrollData((previous) =>
      previous.map((data) => {
        if (data.employee.id !== employeeId) return data;
        const updated = { ...data, bonusINSSCategory: category };
        const withEdit = { ...updated, isEdited: checkIsEdited(updated) };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      }),
    );
  }, [calculateForEmployee]);

  // ─── Reset row ──────────────────────────────────────────────────

  const handleResetRow = useCallback((employeeId: string) => {
    setEmployeePayrollData((prev) =>
      prev.map((d) => {
        if (d.employee.id !== employeeId) return d;
        const reset = {
          ...d,
          regularHours: d.originalValues.regularHours,
          overtimeHours: d.originalValues.overtimeHours,
          nightShiftHours: d.originalValues.nightShiftHours,
          absenceHours: d.originalValues.absenceHours,
          lateArrivalMinutes: d.originalValues.lateArrivalMinutes,
          bonus: d.originalValues.bonus,
          bonusINSSCategory: d.originalValues.bonusINSSCategory,
          perDiem: d.originalValues.perDiem,
          allowances: d.originalValues.allowances,
          isEdited: false,
        };
        return { ...reset, calculation: calculateForEmployee(reset) };
      })
    );
  }, [calculateForEmployee]);

  // ─── Toggle row expansion ───────────────────────────────────────

  const toggleRowExpansion = useCallback((employeeId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  }, []);

  // ─── Sync from attendance ───────────────────────────────────────

  useEffect(() => {
    attendanceSyncRequestRef.current += 1;
    setAttendanceSyncPending(false);
  }, [periodStart, periodEnd]);

  const handleSyncFromAttendance = useCallback(async () => {
    if (!periodStart || !periodEnd) {
      toast({
        title: t("runPayroll.toastDatesRequired"),
        description: t("runPayroll.toastDatesRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    const requestId = ++attendanceSyncRequestRef.current;
    const finishSync = () => {
      if (attendanceSyncRequestRef.current === requestId) {
        setAttendanceSyncPending(false);
      }
    };
    setAttendanceSyncPending(true);

    let summaryRows: AttendanceEmployeeSummary[] | undefined;
    try {
      const result = await refetchAttendanceSummary();
      if (attendanceSyncRequestRef.current !== requestId) return;
      if (result.isError || result.error) {
        throw result.error ?? new Error("Attendance refresh failed");
      }
      // Never fall back to cached rows after this explicit refresh. A failed
      // refresh must not silently put stale attendance into a new payroll run.
      summaryRows = result.data;
    } catch (error) {
      if (attendanceSyncRequestRef.current !== requestId) return;
      console.error("Failed to refresh attendance for payroll sync:", error);
      toast({
        title: t("runPayroll.syncAttendance"),
        description: t("common.connectionIssueDesc"),
        variant: "destructive",
      });
      finishSync();
      return;
    }

    if (!summaryRows || summaryRows.length === 0) {
      toast({
        title: t("runPayroll.syncAttendance"),
        description: t("runPayroll.toastSyncAttendanceNoData"),
      });
      finishSync();
      return;
    }

    const summaryByEmployee = new Map(summaryRows.map((row) => [row.employeeId, row]));

    // Approved leave overlapping the pay period. Without this, paid leave days
    // (zero recorded hours) would be docked as unpaid absence. Paid leave types
    // reduce absence hours; sick leave feeds sickDays so the TL 100%/50% sick
    // pay rules apply; unpaid leave stays as absence.
    let leaveByEmployee: ReturnType<typeof computeLeaveCredits>;
    try {
      const approvedLeave = await leaveService.getEmployeesOnLeave(tenantId, periodStart, periodEnd);
      if (attendanceSyncRequestRef.current !== requestId) return;
      leaveByEmployee = computeLeaveCredits(
        approvedLeave,
        periodStart,
        periodEnd,
        TL_WORKING_HOURS.standardDailyHours,
        // Unknown/custom types default to paid: wrongly docking pay is worse
        // than paying a day — admins can still adjust the row manually.
        (leaveType) => {
          const typeInfo = TL_LEAVE_TYPES.find((lt) => lt.id === leaveType);
          return typeInfo ? typeInfo.isPaid : true;
        },
        calculateWorkingDays,
      );
    } catch (error) {
      if (attendanceSyncRequestRef.current !== requestId) return;
      // Abort rather than sync without leave data — that would silently dock
      // pay for employees on approved paid leave.
      console.error("Failed to load approved leave for payroll sync:", error);
      toast({
        title: t("runPayroll.syncAttendance"),
        description: t("runPayroll.toastSyncLeaveLookupFailed"),
        variant: "destructive",
      });
      finishSync();
      return;
    }

    let syncedCount = 0;
    let leaveCreditedCount = 0;

    setEmployeePayrollData((prev) =>
      prev.map((data) => {
        const employeeId = data.employee.id || "";
        const summary = summaryByEmployee.get(employeeId);
        if (!summary) return data;

        const regularHours = Number(summary.regularHours.toFixed(2));
        const overtimeHours = Number(summary.overtimeHours.toFixed(2));
        const expectedRegularHours = data.originalValues.regularHours;
        const credit = leaveByEmployee.get(employeeId);
        const paidLeaveHours = credit?.paidLeaveHours ?? 0;
        const sickDays = credit?.sickDays ?? 0;
        if (paidLeaveHours > 0 || sickDays > 0) leaveCreditedCount += 1;
        const absenceHours = Number(
          Math.max(0, expectedRegularHours - regularHours - paidLeaveHours).toFixed(2)
        );
        const lateArrivalMinutes = Math.max(0, Math.round(summary.lateMinutes));

        const updated: EmployeePayrollData = {
          ...data,
          regularHours,
          overtimeHours,
          absenceHours,
          lateArrivalMinutes,
          sickDays,
        };

        const isEdited = checkIsEdited(updated);
        syncedCount += 1;
        const withEdit = { ...updated, isEdited };
        return {
          ...withEdit,
          calculation: latestCalculatorRef.current(withEdit),
        };
      })
    );

    toast({
      title: t("runPayroll.syncAttendance"),
      description:
        leaveCreditedCount > 0
          ? t("runPayroll.toastSyncedAttendanceWithLeave", {
              count: String(syncedCount),
              leaveCount: String(leaveCreditedCount),
            })
          : t("runPayroll.toastSyncedAttendance", { count: String(syncedCount) }),
    });
    finishSync();
  }, [periodStart, periodEnd, tenantId, toast, t, refetchAttendanceSummary]);

  // ─── Compliance issues ──────────────────────────────────────────

  const complianceIssues = useMemo(() => {
    const raw = getComplianceIssues(activeEmployees);
    // Group by employee
    const map = new Map<string, { employee: Employee; issues: string[] }>();
    raw.forEach(({ employee, issue }) => {
      const id = employee.id || "";
      if (!map.has(id)) map.set(id, { employee, issues: [] });
      map.get(id)!.issues.push(issue);
    });
    return Array.from(map.values());
  }, [activeEmployees]);

  const hasComplianceIssues = complianceIssues.length > 0;

  // ─── Totals ─────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const includedData = employeePayrollData
      .filter(data => !excludedEmployees.has(data.employee.id || "") && data.calculation);

    return {
      grossPay: sumMoney(includedData.map(d => d.calculation!.grossPay)),
      totalDeductions: sumMoney(includedData.map(d => d.calculation!.totalDeductions)),
      netPay: sumMoney(includedData.map(d => d.calculation!.netPay)),
      incomeTax: sumMoney(includedData.map(d => d.calculation!.incomeTax)),
      inssEmployee: sumMoney(includedData.map(d => d.calculation!.inssEmployee)),
      inssEmployer: sumMoney(includedData.map(d => d.calculation!.inssEmployer)),
      totalEmployerCost: sumMoney(includedData.map(d => d.calculation!.totalEmployerCost)),
    };
  }, [employeePayrollData, excludedEmployees]);

  const editedCount = useMemo(() => {
    return employeePayrollData.filter((d) => d.isEdited).length;
  }, [employeePayrollData]);

  // ─── Warnings ───────────────────────────────────────────────────

  const payrollWarnings = useMemo(() => {
    const warnings: { employeeName: string; message: string; type: "wage" | "hours" }[] = [];
    const maxMonthlyOT = TL_WORKING_HOURS.maxOvertimePerWeek * 4;
    for (const d of employeePayrollData) {
      if (excludedEmployees.has(d.employee.id || "")) continue;
      const name = `${d.employee.personalInfo.firstName} ${d.employee.personalInfo.lastName}`;
      const salary = d.employee.compensation.monthlySalary || 0;
      const minimumWage = calculationConfig?.minimumWage ?? 115;
      if (salary > 0 && salary < minimumWage && !isShareholder(d.employee)) {
        warnings.push({ employeeName: name, message: t("runPayroll.warningBelowMinWage", { salary: String(salary), min: String(minimumWage) }), type: "wage" });
      }
      if (d.overtimeHours > maxMonthlyOT) {
        warnings.push({ employeeName: name, message: t("runPayroll.warningOTExceeds", { hours: String(d.overtimeHours), max: String(maxMonthlyOT), weekly: String(TL_WORKING_HOURS.maxOvertimePerWeek) }), type: "hours" });
      }
      const totalDailyHoursEquiv = (d.regularHours + d.overtimeHours + d.nightShiftHours) / 22;
      if (totalDailyHoursEquiv > 12) {
        warnings.push({ employeeName: name, message: t("runPayroll.warningExcessiveHours", { hours: totalDailyHoursEquiv.toFixed(1) }), type: "hours" });
      }
    }
    return warnings;
  }, [employeePayrollData, excludedEmployees, t, calculationConfig]);

  // ─── Filtered data ──────────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!searchTerm) return employeePayrollData;
    const term = searchTerm.toLowerCase();
    return employeePayrollData.filter(
      (d) =>
        d.employee.personalInfo.firstName.toLowerCase().includes(term) ||
        d.employee.personalInfo.lastName.toLowerCase().includes(term) ||
        d.employee.jobDetails.employeeId.toLowerCase().includes(term) ||
        d.employee.jobDetails.department.toLowerCase().includes(term)
    );
  }, [employeePayrollData, searchTerm]);

  // ─── Included data helper ───────────────────────────────────────

  const getIncludedData = useCallback(() =>
    employeePayrollData
      .filter((d) => d.calculation)
      .filter((d) => !excludedEmployees.has(d.employee.id || "")),
    [employeePayrollData, excludedEmployees]
  );

  // ─── Validation ─────────────────────────────────────────────────

  const validateAllEmployees = useCallback((includedData: EmployeePayrollData[]): string[] => {
    const allErrors: string[] = [];
    for (const data of includedData) {
      const monthlySalary = data.employee.compensation.monthlySalary || 0;
      const hourlyRate = calculateHourlyRate(monthlySalary, calculationConfig?.hourlyRate);
      const asOfDate = payDate ? new Date(`${payDate}T00:00:00`) : new Date();
      const monthsWorkedThisYear = asOfDate.getMonth() + 1;
      const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
      const subsidioAnual = includeSubsidioAnual
        ? calculateSubsidioAnual(monthlySalary, monthsWorkedThisYear, hireDate, asOfDate)
        : 0;
      const effectiveFrequency = data.employee.compensation.payFrequency ?? payFrequency;
      const totalPeriodsInMonth = getPayPeriodsInPayMonth(payDate, effectiveFrequency);
      const isResident =
        data.employee.compensation?.isResident ??
        (data.employee.documents?.residencyStatus
          ? data.employee.documents.residencyStatus !== "foreign_worker"
          : true);
      const ytd = ytdByEmployee[data.employee.id || ""];

      const input: TLPayrollInput = {
        employeeId: data.employee.id || "",
        monthlySalary,
        payFrequency: effectiveFrequency,
        totalPeriodsInMonth,
        isHourly: false,
        hourlyRate,
        regularHours: data.regularHours,
        overtimeHours: data.overtimeHours,
        nightShiftHours: data.nightShiftHours,
        holidayHours: data.holidayHours,
        restDayHours: 0,
        absenceHours: data.absenceHours,
        lateArrivalMinutes: data.lateArrivalMinutes,
        sickDaysUsed: data.sickDays,
        ytdSickDaysUsed: ytd?.ytdSickDaysUsed || 0,
        bonus: data.bonus,
        bonusINSSCategory: data.bonusINSSCategory,
        commission: 0,
        perDiem: data.perDiem,
        foodAllowance: 0,
        transportAllowance: data.allowances,
        otherEarnings: 0,
        subsidioAnual,
        nonCashBenefits: 0,
        nonCashBenefitINSSCategory: null,
        taxInfo: {
          isResident,
          hasTaxExemption: isShareholder(data.employee),
          inssExempt: isShareholder(data.employee),
        },
        loanRepayment: 0,
        advanceRepayment: 0,
        courtOrders: 0,
        otherDeductions: 0,
        ytdGrossPay: ytd?.ytdGrossPay || 0,
        ytdIncomeTax: ytd?.ytdIncomeTax || 0,
        ytdINSSEmployee: ytd?.ytdINSSEmployee || 0,
        monthsWorkedThisYear,
        hireDate,
      };

      const errors = validateTLPayrollInput(input, calculationConfig);
      if (errors.length > 0) {
        const name = `${data.employee.personalInfo.firstName} ${data.employee.personalInfo.lastName}`;
        allErrors.push(...errors.map(e => `${name}: ${e}`));
      }
    }
    return allErrors;
  }, [payDate, payFrequency, includeSubsidioAnual, ytdByEmployee, calculationConfig]);

  // ─── Build payroll run / records ────────────────────────────────

  const buildPayrollRun = useCallback((includedData: EmployeePayrollData[]): Omit<PayrollRun, "id"> => ({
    tenantId,
    periodStart,
    periodEnd,
    payDate,
    payFrequency,
    status: "draft",
    totalGrossPay: totals.grossPay,
    totalNetPay: totals.netPay,
    totalDeductions: totals.totalDeductions,
    totalEmployerTaxes: totals.inssEmployer,
    totalEmployerContributions: 0,
    employeeCount: includedData.length,
    createdBy: userId,
    notes: "",
  }), [tenantId, periodStart, periodEnd, payDate, payFrequency, totals, userId]);

  const buildPayrollRecords = useCallback((includedData: EmployeePayrollData[]): Omit<PayrollRecord, "id" | "payrollRunId">[] =>
    includedData.map((d) => ({
      tenantId,
      employeeId: d.employee.id || "",
      employeeName: `${d.employee.personalInfo.firstName} ${d.employee.personalInfo.lastName}`,
      employeeNumber: d.employee.jobDetails.employeeId,
      department: d.employee.jobDetails.department,
      position: d.employee.jobDetails.position,
      isResident:
        d.employee.compensation?.isResident ??
        (d.employee.documents?.residencyStatus
          ? d.employee.documents.residencyStatus !== "foreign_worker"
          : true),
      regularHours: d.regularHours,
      overtimeHours: d.overtimeHours,
      doubleTimeHours: 0,
      holidayHours: d.holidayHours,
      ptoHoursUsed: 0,
      sickHoursUsed: d.sickDays * 8,
      hourlyRate: calculateHourlyRate(
        d.employee.compensation.monthlySalary || 0,
        calculationConfig?.hourlyRate,
      ),
      overtimeRate: calculationConfig?.overtime?.standard ?? TL_OVERTIME_RATES.standard,
      earnings: d.calculation!.earnings.map((earning) => ({
        type: (['regular','overtime','double_time','holiday','night_shift','rest_day','sick_pay','bonus','subsidio_anual','service_compensation','non_cash_benefit','commission','tip','reimbursement','allowance'].includes(earning.type)
          ? earning.type
          : ['per_diem','food_allowance','transport_allowance','housing_allowance','travel_allowance'].includes(earning.type)
            ? 'allowance'
            : 'other') as PayrollRecord['earnings'][number]['type'],
        description: earning.description,
        hours: earning.hours,
        rate: earning.rate,
        amount: earning.amount,
      })),
      totalGrossPay: d.calculation!.grossPay,
      wagesPaid: d.calculation!.wagesPaid,
      taxableIncome: d.calculation!.taxableIncome,
      witTaxableAmount: d.calculation!.witTaxableAmount,
      inssBase: d.calculation!.inssBase,
      // Statutory filing generators (ATTL WIT + INSS) read these off the
      // saved record and refuse to infer them — without them every filing
      // for a wizard-created run fails its strict-reader guard.
      incomeTax: d.calculation!.incomeTax,
      inssEmployee: d.calculation!.inssEmployee,
      inssEmployer: d.calculation!.inssEmployer,
      deductions: d.calculation!.deductions.map((deduction) => ({
        type: deduction.type as PayrollRecord['deductions'][number]['type'],
        description: deduction.description,
        amount: deduction.amount,
        isPreTax: false,
        isPercentage: false,
      })),
      totalDeductions: d.calculation!.totalDeductions,
      employerContributions: [],
      totalEmployerContributions: 0,
      employerTaxes: [{
        type: "inss_employer" as const,
        description: TL_DEDUCTION_TYPE_LABELS.inss_employer.en,
        amount: d.calculation!.inssEmployer,
      }],
      totalEmployerTaxes: d.calculation!.inssEmployer,
      netPay: d.calculation!.netPay,
      totalEmployerCost: d.calculation!.totalEmployerCost,
      ytdGrossPay: d.calculation!.newYtdGrossPay,
      ytdNetPay: addMoney(
        ytdByEmployee[d.employee.id || ""]?.ytdNetPay || 0,
        d.calculation!.netPay,
      ),
      ytdIncomeTax: d.calculation!.newYtdIncomeTax,
      ytdINSSEmployee: d.calculation!.newYtdINSSEmployee,
    })),
    [tenantId, ytdByEmployee, calculationConfig]
  );

  return {
    // State
    employeePayrollData,
    searchTerm,
    setSearchTerm,
    expandedRows,
    filteredData,

    // Period settings
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

    // Compliance
    excludedEmployees,
    setExcludedEmployees,
    complianceIssues,
    hasComplianceIssues,

    // Computed
    totals,
    editedCount,
    payrollWarnings,
    syncingAttendance: attendanceSummaryFetching || attendanceSyncPending,
    attendanceSyncPending,
    calculationsPending,
    isYtdLoading: ytdQuery.isLoading,
    isYtdError: ytdQuery.isError && ytdQuery.data === undefined,
    isYtdFetching: ytdQuery.isFetching,

    // Actions
    handleInputChange,
    handleBonusCategoryChange,
    handleResetRow,
    toggleRowExpansion,
    handleSyncFromAttendance,
    refetchYtd: ytdQuery.refetch,

    // Submission helpers
    getIncludedData,
    validateAllEmployees,
    buildPayrollRun,
    buildPayrollRecords,
  };
}
