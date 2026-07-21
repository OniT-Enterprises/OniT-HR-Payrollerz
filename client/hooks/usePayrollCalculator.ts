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
  TL_SMALL_EMPLOYER_MAX_WORKERS,
  tlSmallEmployerEmployerRate,
} from "@/lib/payroll/constants-tl";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import type {
  LeaveTypeConfig,
  PayrollConfig,
  TimeOffPolicies,
} from "@/types/settings";
import { addMoney, proRata, sumMoney } from "@/lib/currency";
import { getTodayTL } from "@/lib/dateUtils";
import { getInitialPayrollDates } from "@/lib/payroll/payroll-schedule";
import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";
import { resolveLeaverFinalPay } from "@/lib/payroll/leaver-final-pay";
import { holidayService } from "@/services/holidayService";
import type { Employee } from "@/services/employeeService";
import {
  payrollService,
  type EmployeePayrollYTD,
} from "@/services/payrollService";
import type { AttendanceEmployeeSummary } from "@/services/attendanceService";
import {
  leaveService,
  calculateWorkingDays,
  TL_LEAVE_TYPES,
} from "@/services/leaveService";
import { getComplianceIssues } from "@/lib/employeeUtils";

import {
  calculateProRataHours,
  computeLeaveCredits,
  type EmployeePayrollData,
  getPayPeriodsInPayMonth,
} from "@/lib/payroll/run-payroll-helpers";
import {
  aggregateRecurringInputs,
  resolveScheduledDeductions,
  type EmployeeRecurringInputs,
} from "@/lib/payroll/recurring-deductions";
import {
  aggregateAllowanceInputs,
  perPeriodAllowances,
  type EmployeeAllowanceInputs,
} from "@/lib/payroll/allowance-enrollments";

interface UsePayrollCalculatorOptions {
  activeEmployees: Employee[];
  /** Terminated employees; those whose termination falls inside the pay
   * period are added to the roster for their final-pay run. */
  terminatedEmployees?: Employee[];
  tenantId: string;
  userId: string;
  payrollConfig?: PayrollConfig;
  /** Tenant leave policies — drive the paid fraction credited for approved
   * leave during attendance sync. Without them, TL defaults apply. */
  timeOffPolicies?: TimeOffPolicies;
  defaultPayFrequency?: TLPayFrequency;
  defaultPayDay?: number;
}

const EMPTY_YTD_BY_EMPLOYEE: Record<string, EmployeePayrollYTD> = {};
const EMPTY_ALLOWANCE_INPUTS: Record<string, EmployeeAllowanceInputs> = {};
const EMPTY_COMMITTED_FINAL_PAY: Record<
  string,
  { serviceCompensation: number; subsidioAnual: number }
> = {};
const EMPTY_MTD_WIT: Record<
  string,
  { mtdWitTaxableIncome: number; mtdIncomeTax: number }
> = {};
const EMPTY_RECURRING_DEDUCTIONS: Record<string, EmployeeRecurringInputs> = {};

// Shareholders receive profit distributions, not wages — exempt from WIT withholding and
// INSS enrollment, and outside minimum-wage rules.
function isShareholder(employee: Employee): boolean {
  return (
    (employee.jobDetails.employmentType || "").toLowerCase() === "shareholder"
  );
}

/**
 * A leaver's in-period termination, driving BOTH hours proration and the
 * final-pay items (Art. 56 severance + Art. 44 subsidio). Only the deliberate
 * offboarding-stamped `terminationDate` counts — a bare `contractEndDate` is
 * NOT used, because it may just precede a renewal whose paperwork lags, and
 * neither docking wages nor auto-paying severance may rest on that guess.
 * Honored only when the date falls INSIDE the pay period: a stale past date
 * must never zero out an active employee's pay, and a future one is out of
 * scope for this run. A genuine fixed-term end is handled by offboarding,
 * which stamps `terminationDate`.
 */
function getInPeriodTermination(
  employee: Employee,
  periodStart: string,
  periodEnd: string,
): string | null {
  const end = employee.terminationDate || null;
  return end && end >= periodStart && end <= periodEnd ? end : null;
}

export function usePayrollCalculator({
  activeEmployees,
  terminatedEmployees,
  tenantId,
  userId,
  payrollConfig,
  timeOffPolicies,
  defaultPayFrequency,
  defaultPayDay,
}: UsePayrollCalculatorOptions) {
  const { toast } = useToast();
  const { t } = useI18n();
  const showAdvancedTax = useAdvancedTax();

  const [employeePayrollData, setEmployeePayrollData] = useState<
    EmployeePayrollData[]
  >([]);
  // Mirror of employeePayrollData so the attendance sync can build the next
  // array and count matches synchronously (React batches the functional
  // updater, so a counter mutated inside it is still 0 when the toast reads it).
  const employeePayrollDataRef = useRef<EmployeePayrollData[]>([]);
  useEffect(() => {
    employeePayrollDataRef.current = employeePayrollData;
  }, [employeePayrollData]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Payroll period settings
  const initialPayrollDates = useMemo(
    () => getInitialPayrollDates({ frequency: "monthly", payDay: 25 }),
    [],
  );
  const [payFrequency, setPayFrequency] = useState<TLPayFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState(
    initialPayrollDates.periodStart,
  );
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
  const calculationConfig = useMemo(
    () =>
      payrollConfig
        ? {
            incomeTax: {
              residentRate: payrollConfig.tax.residentRate / 100,
              nonResidentRate: payrollConfig.tax.nonResidentRate / 100,
              residentThreshold: payrollConfig.tax.residentThreshold,
            },
            inss: {
              employeeRate: payrollConfig.socialSecurity.employeeRate / 100,
              // Small-employer discount (DL 20/2017 Art. 86): reduce ONLY the
              // employer share, keyed to the wage (period) year, when the tenant
              // has opted in. Employee 4% is untouched. 2025–26 → 5.4%, 2027 → 6%.
              employerRate: payrollConfig.smallEmployerInssDiscount
                ? tlSmallEmployerEmployerRate(
                    Number.parseInt((periodEnd || "").slice(0, 4), 10),
                    payrollConfig.socialSecurity.employerRate / 100,
                  )
                : payrollConfig.socialSecurity.employerRate / 100,
            },
            // Allowance-vs-INSS-base classification (DL 20/2017 Arts. 8-9):
            // the settings toggles decide whether food allowance / per diem
            // count as remuneracao contributiva for this tenant.
            inssBase: {
              excludeFoodAllowance:
                payrollConfig.socialSecurity.excludeFoodAllowance,
              excludePerDiem: payrollConfig.socialSecurity.excludePerDiem,
            },
            overtime: {
              standard: payrollConfig.overtimeRates.standard,
              sundayHoliday: payrollConfig.overtimeRates.sundayHoliday,
              // Stored as a percent (25 = +25%); the engine takes a fraction.
              nightShiftPremium:
                (payrollConfig.overtimeRates.nightShiftPremium ?? 25) / 100,
              rounding:
                payrollConfig.hourlyRateConvention === "fixed_190_round_up"
                  ? ("aggregate" as const)
                  : ("per_component" as const),
            },
            hourlyRate:
              payrollConfig.hourlyRateConvention === "fixed_190_round_up"
                ? { monthlyHoursDivisor: 190, rounding: "up" as const }
                : undefined,
            minimumWage: payrollConfig.minimumWage,
            subsidioAnual: {
              proRataForNewEmployees:
                payrollConfig.subsidioAnual?.proRataForNewEmployees ?? true,
            },
          }
        : undefined,
    [payrollConfig, periodEnd],
  );
  // Key the civil-year windows (subsidio proration, severance/subsidio dedup,
  // YTD) to the PERIOD the payroll is FOR, not the pay date. A December run paid
  // in January belongs to the earlier civil year — paying it against the pay-date
  // year mis-prorates the 13th month (Art. 44 "civil year") and looks up the
  // once-per-year dedup in the wrong year, re-paying an already-committed subsidio.
  const payrollYear = Number.parseInt((periodEnd || payDate).slice(0, 4), 10);
  const ytdQuery = useQuery({
    queryKey: ["tenants", tenantId, "payrollYtd", payrollYear],
    queryFn: () =>
      payrollService.records.getTenantYTDTotals(tenantId, payrollYear),
    enabled:
      Boolean(tenantId) &&
      Number.isInteger(payrollYear) &&
      activeEmployees.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const ytdByEmployee = ytdQuery.data ?? EMPTY_YTD_BY_EMPLOYEE;

  const {
    // Cached period summary, also read by payrollWarnings for the
    // Art. 27(3)/(4) hour-cap checks (per-day/per-week maxima computed by the
    // attendance summary's classification pass).
    data: attendanceSummaryRows,
    isFetching: attendanceSummaryFetching,
    refetch: refetchAttendanceSummary,
  } = useAttendanceSummary(periodStart, periodEnd);

  // Compliance states
  const [excludedEmployees, setExcludedEmployees] = useState<Set<string>>(
    new Set(),
  );
  const [attendanceSyncPending, setAttendanceSyncPending] = useState(false);
  const attendanceSyncRequestRef = useRef(0);

  // Roster: active employees plus leavers whose termination falls inside this
  // pay period — their final run pays the worked fraction, Art. 56 service
  // compensation, and the netted Art. 44 subsidio.
  const inPeriodLeavers = useMemo(() => {
    if (!terminatedEmployees || terminatedEmployees.length === 0) return [];
    return terminatedEmployees.filter((employee) =>
      Boolean(getInPeriodTermination(employee, periodStart, periodEnd)),
    );
  }, [terminatedEmployees, periodStart, periodEnd]);
  const rosterEmployees = useMemo(
    () =>
      inPeriodLeavers.length > 0
        ? [...activeEmployees, ...inPeriodLeavers]
        : activeEmployees,
    [activeEmployees, inPeriodLeavers],
  );

  // Final pay (Art. 56 severance + Art. 44 subsidio) already committed this
  // year, so a leaver's final pay is disbursed exactly once even across two
  // runs over the same period (e.g. a regular run plus a separate 13th-month
  // run). Only fetched when the roster actually contains a leaver.
  const committedFinalPayQuery = useQuery({
    // Nested under the 'payrollRecords' prefix ON PURPOSE: usePayroll's
    // run/record mutations invalidate ['tenants', tid, 'payrollRecords'], so
    // finalizing a run refreshes this immediately — otherwise the 5-minute
    // staleTime would let a second run over the same period re-pay a leaver's
    // severance from a stale "nothing committed" map.
    queryKey: [
      "tenants",
      tenantId,
      "payrollRecords",
      "committedFinalPay",
      payrollYear,
    ],
    queryFn: () =>
      payrollService.records.getCommittedFinalPayByEmployee(
        tenantId,
        payrollYear,
      ),
    enabled:
      Boolean(tenantId) &&
      Number.isInteger(payrollYear) &&
      inPeriodLeavers.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const committedFinalPay =
    committedFinalPayQuery.data ?? EMPTY_COMMITTED_FINAL_PAY;

  // Month-to-date WIT already withheld this calendar month, so the resident
  // $500/month exemption is applied per employee-month (not per run). Only
  // needed for monthly runs; a same-month top-up run (e.g. a 13th-month run)
  // then taxes against the remaining threshold. Keyed on the pay-period month.
  const periodMonth = periodStart.slice(0, 7); // 'YYYY-MM'
  const mtdWitQuery = useQuery({
    // Under 'payrollRecords' so finalizing a run invalidates it immediately
    // (same reasoning as committedFinalPay).
    queryKey: ["tenants", tenantId, "payrollRecords", "mtdWit", periodMonth],
    queryFn: () =>
      payrollService.records.getMonthToDateWITByEmployee(tenantId, periodMonth),
    enabled:
      Boolean(tenantId) &&
      payFrequency === "monthly" &&
      /^\d{4}-\d{2}$/.test(periodMonth) &&
      activeEmployees.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const mtdWitByEmployee = mtdWitQuery.data ?? EMPTY_MTD_WIT;

  // Active Deductions & Advances register docs (advances, loans, court orders
  // — client/pages/payroll/DeductionsAdvances.tsx) feed the engine's
  // loanRepayment/advanceRepayment/courtOrders/otherDeductions inputs. Keyed
  // under the 'deductions' prefix ON PURPOSE: the register page's mutations
  // (usePayroll) invalidate ['tenants', tid, 'deductions'], so edits there
  // refresh this immediately. markPayrollRunAsPaid stamps lastAppliedPeriod /
  // decrements balances on these docs but has no handle on this cache, so
  // refetchOnMount 'always' makes every wizard visit re-read the register — a
  // second same-month run can never reuse a stale, un-stamped snapshot and
  // double-take a deduction.
  const recurringDeductionsQuery = useQuery({
    queryKey: ["tenants", tenantId, "deductions", "activeForPayroll"],
    queryFn: () =>
      payrollService.deductions.getActiveDeductionsForPayroll(tenantId),
    enabled: Boolean(tenantId) && activeEmployees.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  // Per-employee engine inputs from the register: active docs only, taken at
  // most once per period month (lastAppliedPeriod guard), advances capped at
  // min(installment, remainingBalance). Percentage docs resolve against the
  // employee's monthly salary.
  const salaryByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    for (const employee of rosterEmployees) {
      if (employee.id) {
        map[employee.id] = employee.compensation.monthlySalary || 0;
      }
    }
    return map;
  }, [rosterEmployees]);
  const recurringInputsByEmployee = useMemo(() => {
    const docs = recurringDeductionsQuery.data;
    if (!docs || docs.length === 0) return EMPTY_RECURRING_DEDUCTIONS;
    return aggregateRecurringInputs(
      resolveScheduledDeductions(docs, {
        periodStart,
        periodEnd,
        salaryByEmployee,
      }),
    );
  }, [recurringDeductionsQuery.data, periodStart, periodEnd, salaryByEmployee]);

  // Allowances register (benefitEnrollments): active enrollments become
  // recurring earning inputs, classified per DL 20/2017 Arts. 8-9 (see
  // allowance-enrollments.ts). Additive model like the deductions register —
  // a hand-typed row amount adds on top. No settlement: allowances recur
  // until terminated on the register, nothing counts down.
  const allowanceEnrollmentsQuery = useQuery({
    queryKey: ["tenants", tenantId, "benefits", "activeForPayroll"],
    queryFn: () => payrollService.benefits.getAllEnrollments(tenantId),
    enabled: Boolean(tenantId) && activeEmployees.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const allowancesByEmployee = useMemo(() => {
    const docs = allowanceEnrollmentsQuery.data;
    if (!docs || docs.length === 0) return EMPTY_ALLOWANCE_INPUTS;
    return aggregateAllowanceInputs(docs, { periodStart, periodEnd });
  }, [allowanceEnrollmentsQuery.data, periodStart, periodEnd]);

  // ─── Core calculation ───────────────────────────────────────────
  const calculateForEmployee = useCallback(
    (data: EmployeePayrollData): TLPayrollResult | null => {
      const monthlySalary = data.employee.compensation.monthlySalary || 0;
      const hourlyRate = calculateHourlyRate(
        monthlySalary,
        calculationConfig?.hourlyRate,
      );
      // As-of the PERIOD end (the civil-year month the payroll covers), not the
      // pay date — so a December period paid in January still prorates the 13th
      // month against December of the correct civil year.
      const asOfDate = periodEnd
        ? new Date(`${periodEnd}T00:00:00`)
        : payDate
          ? new Date(`${payDate}T00:00:00`)
          : new Date();
      const monthsWorkedThisYear = asOfDate.getMonth() + 1;
      const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
      // A leaver's final run pays Art. 56 severance + Art. 44 subsidio exactly
      // once — resolveLeaverFinalPay nets both against what's already committed
      // and honors offboarding's cause-aware severance decision.
      const { terminationDate: engineTerminationDate, subsidioAnual } =
        resolveLeaverFinalPay({
          inPeriodTermination: getInPeriodTermination(
            data.employee,
            periodStart,
            periodEnd,
          ),
          monthlySalary,
          hireDate,
          asOfDate,
          includeSubsidioAnual,
          subsidioConfig: calculationConfig?.subsidioAnual,
          committed: committedFinalPay[data.employee.id || ""] ?? {
            serviceCompensation: 0,
            subsidioAnual: 0,
          },
          severanceEntitled: data.employee.severanceOnTermination === true,
        });
      // Per-employee frequency overrides the run-level selector
      const effectiveFrequency =
        data.employee.compensation.payFrequency ?? payFrequency;
      const totalPeriodsInMonth = getPayPeriodsInPayMonth(
        payDate,
        effectiveFrequency,
      );
      const isResident =
        data.employee.compensation?.isResident ??
        (data.employee.documents?.residencyStatus
          ? data.employee.documents.residencyStatus !== "foreign_worker"
          : true);
      const ytd = ytdByEmployee[data.employee.id || ""];
      const recurring = recurringInputsByEmployee[data.employee.id || ""];
      // Allowances register, split to this run's period. Row fields stay
      // hand-editable and ADD on top of enrolled amounts.
      const enrolled = perPeriodAllowances(
        allowancesByEmployee[data.employee.id || ""],
        totalPeriodsInMonth,
      );

      const input: TLPayrollInput = {
        employeeId: data.employee.id || "",
        monthlySalary,
        payFrequency: effectiveFrequency,
        employmentType: data.employee.jobDetails.employmentType,
        contractedWeeklyHours: data.employee.jobDetails.contractedWeeklyHours,
        minimumWageTreatment: data.employee.jobDetails.minimumWageTreatment,
        minimumWageReviewNote: data.employee.jobDetails.minimumWageReviewNote,
        totalPeriodsInMonth,
        isHourly: false,
        hourlyRate,
        regularHours: data.regularHours,
        overtimeHours: data.overtimeHours,
        nightShiftHours: data.nightShiftHours,
        holidayHours: data.holidayHours,
        restDayHours: data.restDayHours,
        absenceHours: data.absenceHours,
        lateArrivalMinutes: data.lateArrivalMinutes,
        sickDaysUsed: data.sickDays,
        ytdSickDaysUsed: ytd?.ytdSickDaysUsed || 0,
        bonus: data.bonus,
        bonusINSSCategory: data.bonusINSSCategory,
        commission: 0,
        perDiem: data.perDiem,
        foodAllowance: enrolled.foodAllowance,
        transportAllowance: addMoney(data.allowances || 0, enrolled.transportAllowance),
        otherEarnings: enrolled.otherEarnings,
        regularAllowances: enrolled.regularAllowances,
        subsidioAnual,
        // Fires the engine's Art. 56 service-compensation earning for a leaver's
        // final run only, and only if not already committed in an earlier run.
        terminationDate: engineTerminationDate,
        nonCashBenefits: 0,
        nonCashBenefitINSSCategory: null,
        taxInfo: {
          isResident,
          hasTaxExemption: isShareholder(data.employee),
          inssExempt: isShareholder(data.employee),
        },
        // Deductions & Advances register; the engine applies the Lei 4/2012
        // Art. 42(3) 30% cap (court orders exempt) to these.
        loanRepayment: recurring?.loanRepayment ?? 0,
        advanceRepayment: recurring?.advanceRepayment ?? 0,
        courtOrders: recurring?.courtOrders ?? 0,
        otherDeductions: recurring?.otherDeductions ?? 0,
        ytdGrossPay: ytd?.ytdGrossPay || 0,
        ytdIncomeTax: ytd?.ytdIncomeTax || 0,
        ytdINSSEmployee: ytd?.ytdINSSEmployee || 0,
        mtdWitTaxableIncome:
          mtdWitByEmployee[data.employee.id || ""]?.mtdWitTaxableIncome || 0,
        mtdIncomeTax:
          mtdWitByEmployee[data.employee.id || ""]?.mtdIncomeTax || 0,
        monthsWorkedThisYear,
        hireDate,
      };

      try {
        return calculateTLPayroll(input, calculationConfig);
      } catch (error) {
        console.error(
          "Calculation error for employee:",
          data.employee.id,
          error,
        );
        return null;
      }
    },
    [
      payFrequency,
      payDate,
      periodStart,
      periodEnd,
      includeSubsidioAnual,
      ytdByEmployee,
      committedFinalPay,
      mtdWitByEmployee,
      recurringInputsByEmployee,
      allowancesByEmployee,
      calculationConfig,
    ],
  );

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
    if (rosterEmployees.length === 0) {
      // Query-backed callers briefly pass an empty roster while employees load.
      // Preserve the existing empty array so that an unstable fallback `[]`
      // cannot trigger an effect -> state update -> render loop.
      setEmployeePayrollData((current) =>
        current.length === 0 ? current : [],
      );
      return;
    }

    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const defaultHours =
      monthlyHours / TL_PAY_PERIODS[payFrequency].periodsPerMonth;

    const initialData = rosterEmployees.map((employee): EmployeePayrollData => {
      const hireDate = employee.jobDetails.hireDate || "";
      const proratedHours = calculateProRataHours(
        hireDate,
        periodStart,
        periodEnd,
        defaultHours,
        getInPeriodTermination(employee, periodStart, periodEnd),
      );
      // Salaried pay is a fixed monthly amount with any shortfall docked via the
      // absence deduction (not by scaling regularHours — calculateRegularPay
      // ignores hours for salaried). So for a partial period of employment
      // (mid-period hire, or a leaver's final period) we keep the full
      // expected hours as the baseline and book the unemployed days as
      // absence; the existing absence deduction then prorates the pay. A
      // full-period employee has proratedHours === defaultHours, so the
      // seeded absence is 0 and nothing changes. This also makes the
      // attendance sync correct: it measures absence against the full-month
      // expectation.
      const preHireAbsence = Number(
        Math.max(0, defaultHours - proratedHours).toFixed(2),
      );
      const regularHours = defaultHours;
      const row: EmployeePayrollData = {
        employee,
        regularHours,
        overtimeHours: 0,
        nightShiftHours: 0,
        holidayHours: 0,
        restDayHours: 0,
        absenceHours: preHireAbsence,
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
          holidayHours: 0,
          restDayHours: 0,
          absenceHours: preHireAbsence,
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
  }, [rosterEmployees, payFrequency, periodStart, periodEnd]);

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
    updated.holidayHours !== updated.originalValues.holidayHours ||
    updated.restDayHours !== updated.originalValues.restDayHours ||
    updated.absenceHours !== updated.originalValues.absenceHours ||
    updated.lateArrivalMinutes !== updated.originalValues.lateArrivalMinutes ||
    updated.bonus !== updated.originalValues.bonus ||
    updated.bonusINSSCategory !== updated.originalValues.bonusINSSCategory ||
    updated.perDiem !== updated.originalValues.perDiem ||
    updated.allowances !== updated.originalValues.allowances;

  // ─── Input change with validation ──────────────────────────────

  const handleInputChange = useCallback(
    (employeeId: string, field: string, value: number) => {
      if (!Number.isFinite(value)) return;

      const hourFields = [
        "regularHours",
        "overtimeHours",
        "nightShiftHours",
        "holidayHours",
        "restDayHours",
      ];
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
            updated.bonusINSSCategory =
              value > 0
                ? (d.bonusINSSCategory ?? "individual_performance")
                : null;
          }
          const isEdited = checkIsEdited(updated);
          const withEdit = { ...updated, isEdited };
          return { ...withEdit, calculation: calculateForEmployee(withEdit) };
        }),
      );
    },
    [calculateForEmployee, showAdvancedTax],
  );

  const handleBonusCategoryChange = useCallback(
    (employeeId: string, category: TLBonusINSSCategory) => {
      setEmployeePayrollData((previous) =>
        previous.map((data) => {
          if (data.employee.id !== employeeId) return data;
          const updated = { ...data, bonusINSSCategory: category };
          const withEdit = { ...updated, isEdited: checkIsEdited(updated) };
          return { ...withEdit, calculation: calculateForEmployee(withEdit) };
        }),
      );
    },
    [calculateForEmployee],
  );

  // ─── Reset row ──────────────────────────────────────────────────

  const handleResetRow = useCallback(
    (employeeId: string) => {
      setEmployeePayrollData((prev) =>
        prev.map((d) => {
          if (d.employee.id !== employeeId) return d;
          const reset = {
            ...d,
            regularHours: d.originalValues.regularHours,
            overtimeHours: d.originalValues.overtimeHours,
            nightShiftHours: d.originalValues.nightShiftHours,
            holidayHours: d.originalValues.holidayHours,
            restDayHours: d.originalValues.restDayHours,
            absenceHours: d.originalValues.absenceHours,
            lateArrivalMinutes: d.originalValues.lateArrivalMinutes,
            bonus: d.originalValues.bonus,
            bonusINSSCategory: d.originalValues.bonusINSSCategory,
            perDiem: d.originalValues.perDiem,
            allowances: d.originalValues.allowances,
            isEdited: false,
          };
          return { ...reset, calculation: calculateForEmployee(reset) };
        }),
      );
    },
    [calculateForEmployee],
  );

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

    const summaryByEmployee = new Map(
      summaryRows.map((row) => [row.employeeId, row]),
    );

    // Holidays inside the pay period: the national TL list MERGED with the
    // tenant's overrides (tenants/{tid}/holidays), exactly like the server's
    // canonical leave-duration calculation — a company holiday the tenant
    // added must not dock absence, and a national holiday they removed (staff
    // work it) must. Union the start/end years in case a period straddles a
    // year boundary.
    const holidayYears = Array.from(
      new Set([periodStart.slice(0, 4), periodEnd.slice(0, 4)].map(Number)),
    );
    const holidaySet = new Set(
      holidayYears.flatMap((y) => getTLPublicHolidays(y).map((h) => h.date)),
    );
    try {
      const overrides = (
        await Promise.all(
          holidayYears.map((y) =>
            holidayService.listTenantHolidayOverrides(tenantId, y),
          ),
        )
      ).flat();
      if (attendanceSyncRequestRef.current !== requestId) return;
      for (const override of overrides) {
        if (override.isHoliday) holidaySet.add(override.date);
        else holidaySet.delete(override.date);
      }
    } catch (error) {
      if (attendanceSyncRequestRef.current !== requestId) return;
      // Sync with the national list alone rather than aborting — losing one
      // override mis-books a day; losing the whole sync loses everything.
      console.error(
        "Failed to load tenant holiday overrides for payroll sync:",
        error,
      );
    }
    const periodHolidayDates = [...holidaySet]
      .filter((d) => d >= periodStart && d <= periodEnd)
      .sort();
    // Hours the schedule loses to one holiday: Mon–Fri are full standard days;
    // Saturday carries only the remainder of the 44h week (44 − 5×8 = 4h), so
    // a Saturday holiday must not credit a full day; Sunday (the weekly rest
    // day) was never expected working time.
    const saturdayHours = Math.max(
      0,
      TL_WORKING_HOURS.standardWeeklyHours -
        5 * TL_WORKING_HOURS.standardDailyHours,
    );
    const holidayHoursForDate = (date: string): number => {
      const weekday = new Date(`${date}T00:00:00`).getDay();
      if (weekday === 0) return 0;
      return weekday === 6
        ? saturdayHours
        : TL_WORKING_HOURS.standardDailyHours;
    };

    // Approved leave overlapping the pay period. Without this, paid leave days
    // (zero recorded hours) would be docked as unpaid absence. Paid leave types
    // reduce absence hours; sick leave feeds sickDays so the TL 100%/50% sick
    // pay rules apply; unpaid leave stays as absence.
    let leaveByEmployee: ReturnType<typeof computeLeaveCredits>;
    try {
      const approvedLeave = await leaveService.getEmployeesOnLeave(
        tenantId,
        periodStart,
        periodEnd,
      );
      if (attendanceSyncRequestRef.current !== requestId) return;
      leaveByEmployee = computeLeaveCredits(
        approvedLeave,
        periodStart,
        periodEnd,
        TL_WORKING_HOURS.standardDailyHours,
        // Paid fraction from the tenant's configured policy (a 50%-paid type
        // credits half the hours). Unknown/custom types default to fully
        // paid: wrongly docking pay is worse than paying a day — admins can
        // still adjust the row manually.
        (leaveType) => {
          const policies: (LeaveTypeConfig | undefined)[] = timeOffPolicies
            ? [
                timeOffPolicies.annualLeave,
                timeOffPolicies.sickLeave,
                timeOffPolicies.maternityLeave,
                timeOffPolicies.paternityLeave,
                timeOffPolicies.miscarriageLeave,
                timeOffPolicies.specialLeave,
                timeOffPolicies.unpaidLeave,
                timeOffPolicies.studyLeave,
                ...(timeOffPolicies.customLeaveTypes ?? []),
              ]
            : [];
          const configured = policies.find((p) => p?.id === leaveType);
          if (configured) {
            if (!configured.isPaid) return 0;
            const percentage = Number(configured.paidPercentage ?? 100);
            return Number.isFinite(percentage)
              ? Math.min(1, Math.max(0, percentage / 100))
              : 1;
          }
          const typeInfo = TL_LEAVE_TYPES.find((lt) => lt.id === leaveType);
          return typeInfo ? (typeInfo.isPaid ? 1 : 0) : 1;
        },
        // Holiday-aware working-day count so leave duration (and sick banding)
        // matches the server's canonical, holiday-excluding calculation.
        (start, end) => calculateWorkingDays(start, end, periodHolidayDates),
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

    // Build the next rows from a synchronous snapshot so the counts below are
    // accurate the moment the toast reads them.
    const nextData = employeePayrollDataRef.current.map((data) => {
      const employeeId = data.employee.id || "";
      const summary = summaryByEmployee.get(employeeId);
      if (!summary) return data;

      const regularHours = Number(summary.regularHours.toFixed(2));
      const overtimeHours = Number(summary.overtimeHours.toFixed(2));
      // Hours worked at night carry the +25% premium on top of base pay; they
      // are a subset of regular/overtime, so they are set, not added.
      const nightShiftHours = Number((summary.nightHours ?? 0).toFixed(2));
      // Hours worked on a public holiday, already reclassified out of regular/
      // overtime by the attendance summary — pay them the Art. 27 2× rate.
      const holidayHours = Number((summary.holidayHours ?? 0).toFixed(2));
      // Hours worked on the weekly rest day (Sunday — Art. 30(2)), likewise
      // reclassified by the summary and paid at the engine's 2× rest_day rate.
      // Non-Sunday per-employee rest days stay manual (wizard row field).
      const restDayHours = Number((summary.restDayHours ?? 0).toFixed(2));
      // Public holidays are paid non-working time — subtract them from the
      // expected baseline so a non-worked holiday is never docked as absence.
      // Only holidays inside THIS employee's employment window count: days
      // before a mid-period hire or after a leaver's termination are docked
      // as absence in full (that's how the salary is prorated), and a holiday
      // falling there must stay docked with them.
      const hireDate = data.employee.jobDetails.hireDate || "";
      const employmentStart =
        hireDate && hireDate > periodStart ? hireDate : periodStart;
      const employmentEnd =
        getInPeriodTermination(data.employee, periodStart, periodEnd) ??
        periodEnd;
      const holidayHoursInWindow = periodHolidayDates
        .filter((d) => d >= employmentStart && d <= employmentEnd)
        .reduce((sum, d) => sum + holidayHoursForDate(d), 0);
      const expectedRegularHours = Math.max(
        0,
        data.originalValues.regularHours - holidayHoursInWindow,
      );
      const credit = leaveByEmployee.get(employeeId);
      const paidLeaveHours = credit?.paidLeaveHours ?? 0;
      const sickDays = credit?.sickDays ?? 0;
      if (paidLeaveHours > 0 || sickDays > 0) leaveCreditedCount += 1;
      const absenceHours = Number(
        Math.max(
          0,
          expectedRegularHours - regularHours - paidLeaveHours,
        ).toFixed(2),
      );
      const lateArrivalMinutes = Math.max(0, Math.round(summary.lateMinutes));

      const updated: EmployeePayrollData = {
        ...data,
        regularHours,
        overtimeHours,
        nightShiftHours,
        holidayHours,
        restDayHours,
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
    });

    setEmployeePayrollData(nextData);

    toast({
      title: t("runPayroll.syncAttendance"),
      description:
        leaveCreditedCount > 0
          ? t("runPayroll.toastSyncedAttendanceWithLeave", {
              count: String(syncedCount),
              leaveCount: String(leaveCreditedCount),
            })
          : t("runPayroll.toastSyncedAttendance", {
              count: String(syncedCount),
            }),
    });
    finishSync();
  }, [periodStart, periodEnd, tenantId, toast, t, refetchAttendanceSummary, timeOffPolicies]);

  // ─── Compliance issues ──────────────────────────────────────────

  const complianceIssues = useMemo(() => {
    const raw = getComplianceIssues(rosterEmployees);
    // Group by employee
    const map = new Map<string, { employee: Employee; issues: string[] }>();
    raw.forEach(({ employee, issue }) => {
      const id = employee.id || "";
      if (!map.has(id)) map.set(id, { employee, issues: [] });
      map.get(id)!.issues.push(issue);
    });
    return Array.from(map.values());
  }, [rosterEmployees]);

  const hasComplianceIssues = complianceIssues.length > 0;

  // ─── Totals ─────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const includedData = employeePayrollData.filter(
      (data) =>
        !excludedEmployees.has(data.employee.id || "") && data.calculation,
    );

    return {
      grossPay: sumMoney(includedData.map((d) => d.calculation!.grossPay)),
      totalDeductions: sumMoney(
        includedData.map((d) => d.calculation!.totalDeductions),
      ),
      netPay: sumMoney(includedData.map((d) => d.calculation!.netPay)),
      incomeTax: sumMoney(includedData.map((d) => d.calculation!.incomeTax)),
      inssEmployee: sumMoney(
        includedData.map((d) => d.calculation!.inssEmployee),
      ),
      inssEmployer: sumMoney(
        includedData.map((d) => d.calculation!.inssEmployer),
      ),
      totalEmployerCost: sumMoney(
        includedData.map((d) => d.calculation!.totalEmployerCost),
      ),
    };
  }, [employeePayrollData, excludedEmployees]);

  const editedCount = useMemo(() => {
    return employeePayrollData.filter((d) => d.isEdited).length;
  }, [employeePayrollData]);

  // ─── Warnings ───────────────────────────────────────────────────

  const payrollWarnings = useMemo(() => {
    const warnings: {
      employeeName: string;
      message: string;
      type: "wage" | "hours";
    }[] = [];
    const maxMonthlyOT = TL_WORKING_HOURS.maxOvertimePerWeek * 4;
    // Per-day / per-ISO-week maxima from the attendance summary's
    // classification pass, for the Art. 27(3)/(4) hour-cap warnings. Older
    // cached summaries may predate these fields, hence the ?? 0 guards.
    const summaryByEmployee = new Map(
      (attendanceSummaryRows ?? []).map((row) => [row.employeeId, row]),
    );
    let includedCount = 0;
    for (const d of employeePayrollData) {
      if (excludedEmployees.has(d.employee.id || "")) continue;
      includedCount += 1;
      const name = `${d.employee.personalInfo.firstName} ${d.employee.personalInfo.lastName}`;
      const salary = d.employee.compensation.monthlySalary || 0;
      const minimumWage = calculationConfig?.minimumWage ?? 115;
      const isPartTime =
        d.employee.jobDetails.employmentType?.toLowerCase() === "part-time";
      const treatment = d.employee.jobDetails.minimumWageTreatment;
      const weeklyHours = d.employee.jobDetails.contractedWeeklyHours;
      const applicableMinimumWage = isPartTime
        ? treatment === "full_floor"
          ? minimumWage
          : treatment === "pro_rata" && weeklyHours
            ? proRata(minimumWage, weeklyHours, TL_WORKING_HOURS.standardWeeklyHours)
            : null
        : minimumWage;
      if (
        applicableMinimumWage !== null
        && salary > 0
        && salary < applicableMinimumWage
        && !isShareholder(d.employee)
      ) {
        warnings.push({
          employeeName: name,
          message: t("runPayroll.warningBelowMinWage", {
            salary: String(salary),
            min: String(applicableMinimumWage),
          }),
          type: "wage",
        });
      }
      if (d.overtimeHours > maxMonthlyOT) {
        warnings.push({
          employeeName: name,
          message: t("runPayroll.warningOTExceeds", {
            hours: String(d.overtimeHours),
            max: String(maxMonthlyOT),
            weekly: String(TL_WORKING_HOURS.maxOvertimePerWeek),
          }),
          type: "hours",
        });
      }
      const totalDailyHoursEquiv =
        (d.regularHours + d.overtimeHours + d.nightShiftHours) / 22;
      if (totalDailyHoursEquiv > 12) {
        warnings.push({
          employeeName: name,
          message: t("runPayroll.warningExcessiveHours", {
            hours: totalDailyHoursEquiv.toFixed(1),
          }),
          type: "hours",
        });
      }
      const summary = summaryByEmployee.get(d.employee.id || "");
      if (summary) {
        // Art. 27(4): overtime is capped at 4h/day and 16h/week; exceeding it
        // is lawful only for force majeure (Art. 27(5)) — warn, never block.
        if (
          (summary.maxDailyOvertimeHours ?? 0) >
            TL_WORKING_HOURS.maxOvertimePerDay ||
          (summary.maxWeeklyOvertimeHours ?? 0) >
            TL_WORKING_HOURS.maxOvertimePerWeek
        ) {
          warnings.push({
            employeeName: name,
            message:
              t("runPayroll.warningOTCapArt27") ||
              `exceeded the Art. 27(4) overtime cap (${TL_WORKING_HOURS.maxOvertimePerDay}h/day / ${TL_WORKING_HOURS.maxOvertimePerWeek}h/week) in this period — allowed only for force majeure (Art. 27(5))`,
            type: "hours",
          });
        }
        // Art. 27(3): at most 8h of work on a rest day or public holiday.
        if (
          (summary.maxHolidayOrRestDayHours ?? 0) >
          TL_WORKING_HOURS.standardDailyHours
        ) {
          warnings.push({
            employeeName: name,
            message:
              t("runPayroll.warningRestDayCapArt27") ||
              `worked more than ${TL_WORKING_HOURS.standardDailyHours}h on a rest day or public holiday — Art. 27(3) caps such work at ${TL_WORKING_HOURS.standardDailyHours} hours`,
            type: "hours",
          });
        }
      }
    }
    // DL 20/2017 Art. 86: the small-employer INSS discount requires ≤10
    // workers; the right lapses while the headcount is above that.
    if (
      payrollConfig?.smallEmployerInssDiscount &&
      includedCount > TL_SMALL_EMPLOYER_MAX_WORKERS
    ) {
      warnings.push({
        employeeName: "DL 20/2017 Art. 86",
        message:
          t("runPayroll.warningArt86Headcount", {
            max: String(TL_SMALL_EMPLOYER_MAX_WORKERS),
            count: String(includedCount),
          }) ||
          `the Art. 86 INSS discount requires ${TL_SMALL_EMPLOYER_MAX_WORKERS} or fewer workers — this run has ${includedCount}; the discount right lapses while over ${TL_SMALL_EMPLOYER_MAX_WORKERS}`,
        type: "wage",
      });
    }
    return warnings;
  }, [
    employeePayrollData,
    excludedEmployees,
    t,
    calculationConfig,
    attendanceSummaryRows,
    payrollConfig,
  ]);

  // ─── Filtered data ──────────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!searchTerm) return employeePayrollData;
    const term = searchTerm.toLowerCase();
    return employeePayrollData.filter(
      (d) =>
        d.employee.personalInfo.firstName.toLowerCase().includes(term) ||
        d.employee.personalInfo.lastName.toLowerCase().includes(term) ||
        d.employee.jobDetails.employeeId.toLowerCase().includes(term) ||
        d.employee.jobDetails.department.toLowerCase().includes(term),
    );
  }, [employeePayrollData, searchTerm]);

  // ─── Included data helper ───────────────────────────────────────

  const getIncludedData = useCallback(
    () =>
      employeePayrollData
        .filter((d) => d.calculation)
        .filter((d) => !excludedEmployees.has(d.employee.id || "")),
    [employeePayrollData, excludedEmployees],
  );

  // ─── Validation ─────────────────────────────────────────────────

  const validateAllEmployees = useCallback(
    (includedData: EmployeePayrollData[]): string[] => {
      const allErrors: string[] = [];
      for (const data of includedData) {
        const monthlySalary = data.employee.compensation.monthlySalary || 0;
        const hourlyRate = calculateHourlyRate(
          monthlySalary,
          calculationConfig?.hourlyRate,
        );
        // Period-based as-of (matches calculateForEmployee) so subsidio proration
        // and the leaver dedup use the civil year the payroll covers.
        const asOfDate = periodEnd
          ? new Date(`${periodEnd}T00:00:00`)
          : payDate
            ? new Date(`${payDate}T00:00:00`)
            : new Date();
        const monthsWorkedThisYear = asOfDate.getMonth() + 1;
        const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
        // Same once-only leaver resolution as calculateForEmployee (shared helper).
        const { terminationDate: engineTerminationDate, subsidioAnual } =
          resolveLeaverFinalPay({
            inPeriodTermination: getInPeriodTermination(
              data.employee,
              periodStart,
              periodEnd,
            ),
            monthlySalary,
            hireDate,
            asOfDate,
            includeSubsidioAnual,
            subsidioConfig: calculationConfig?.subsidioAnual,
            committed: committedFinalPay[data.employee.id || ""] ?? {
              serviceCompensation: 0,
              subsidioAnual: 0,
            },
            severanceEntitled: data.employee.severanceOnTermination === true,
          });
        const effectiveFrequency =
          data.employee.compensation.payFrequency ?? payFrequency;
        const totalPeriodsInMonth = getPayPeriodsInPayMonth(
          payDate,
          effectiveFrequency,
        );
        const isResident =
          data.employee.compensation?.isResident ??
          (data.employee.documents?.residencyStatus
            ? data.employee.documents.residencyStatus !== "foreign_worker"
            : true);
        const ytd = ytdByEmployee[data.employee.id || ""];
        const recurring = recurringInputsByEmployee[data.employee.id || ""];
        // Must mirror calculateForEmployee so validation sees the same
        // enrolled-allowance inputs the run will persist.
        const enrolled = perPeriodAllowances(
          allowancesByEmployee[data.employee.id || ""],
          totalPeriodsInMonth,
        );

        const input: TLPayrollInput = {
          employeeId: data.employee.id || "",
          monthlySalary,
          payFrequency: effectiveFrequency,
          employmentType: data.employee.jobDetails.employmentType,
          contractedWeeklyHours: data.employee.jobDetails.contractedWeeklyHours,
          minimumWageTreatment: data.employee.jobDetails.minimumWageTreatment,
          minimumWageReviewNote: data.employee.jobDetails.minimumWageReviewNote,
          totalPeriodsInMonth,
          isHourly: false,
          hourlyRate,
          regularHours: data.regularHours,
          overtimeHours: data.overtimeHours,
          nightShiftHours: data.nightShiftHours,
          holidayHours: data.holidayHours,
          restDayHours: data.restDayHours,
          absenceHours: data.absenceHours,
          lateArrivalMinutes: data.lateArrivalMinutes,
          sickDaysUsed: data.sickDays,
          ytdSickDaysUsed: ytd?.ytdSickDaysUsed || 0,
          bonus: data.bonus,
          bonusINSSCategory: data.bonusINSSCategory,
          commission: 0,
          perDiem: data.perDiem,
          foodAllowance: enrolled.foodAllowance,
          transportAllowance: addMoney(data.allowances || 0, enrolled.transportAllowance),
          otherEarnings: enrolled.otherEarnings,
          regularAllowances: enrolled.regularAllowances,
          subsidioAnual,
          terminationDate: engineTerminationDate,
          nonCashBenefits: 0,
          nonCashBenefitINSSCategory: null,
          taxInfo: {
            isResident,
            hasTaxExemption: isShareholder(data.employee),
            inssExempt: isShareholder(data.employee),
          },
          // Deductions & Advances register — must match calculateForEmployee
          // so validation sees the same inputs the run will persist.
          loanRepayment: recurring?.loanRepayment ?? 0,
          advanceRepayment: recurring?.advanceRepayment ?? 0,
          courtOrders: recurring?.courtOrders ?? 0,
          otherDeductions: recurring?.otherDeductions ?? 0,
          ytdGrossPay: ytd?.ytdGrossPay || 0,
          ytdIncomeTax: ytd?.ytdIncomeTax || 0,
          ytdINSSEmployee: ytd?.ytdINSSEmployee || 0,
          monthsWorkedThisYear,
          hireDate,
        };

        const errors = validateTLPayrollInput(input, calculationConfig);
        if (errors.length > 0) {
          const name = `${data.employee.personalInfo.firstName} ${data.employee.personalInfo.lastName}`;
          allErrors.push(...errors.map((e) => `${name}: ${e}`));
        }
      }
      return allErrors;
    },
    [
      payDate,
      payFrequency,
      periodStart,
      periodEnd,
      includeSubsidioAnual,
      ytdByEmployee,
      committedFinalPay,
      recurringInputsByEmployee,
      allowancesByEmployee,
      calculationConfig,
    ],
  );

  // ─── Build payroll run / records ────────────────────────────────

  const buildPayrollRun = useCallback(
    (includedData: EmployeePayrollData[]): Omit<PayrollRun, "id"> => ({
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
    }),
    [tenantId, periodStart, periodEnd, payDate, payFrequency, totals, userId],
  );

  const buildPayrollRecords = useCallback(
    (
      includedData: EmployeePayrollData[],
    ): Omit<PayrollRecord, "id" | "payrollRunId">[] =>
      includedData.map((d) => ({
        tenantId,
        employeeId: d.employee.id || "",
        employeeName: `${d.employee.personalInfo.firstName} ${d.employee.personalInfo.lastName}`,
        employeeNumber: d.employee.jobDetails.employeeId,
        department: d.employee.jobDetails.department,
        position: d.employee.jobDetails.position,
        // Keep allocation dimensions with the payroll transaction so a later
        // employee edit cannot rewrite historical NGO/donor reporting.
        projectCode: d.employee.jobDetails.projectCode?.trim() || "",
        fundingSource: d.employee.jobDetails.fundingSource?.trim() || "",
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
        overtimeRate:
          calculationConfig?.overtime?.standard ?? TL_OVERTIME_RATES.standard,
        earnings: d.calculation!.earnings.map((earning) => ({
          type: ([
            "regular",
            "overtime",
            "double_time",
            "holiday",
            "night_shift",
            "rest_day",
            "sick_pay",
            "bonus",
            "subsidio_anual",
            "service_compensation",
            "non_cash_benefit",
            "commission",
            "tip",
            "reimbursement",
            "allowance",
          ].includes(earning.type)
            ? earning.type
            : [
                  "per_diem",
                  "food_allowance",
                  "transport_allowance",
                  "housing_allowance",
                  "travel_allowance",
                ].includes(earning.type)
              ? "allowance"
              : "other") as PayrollRecord["earnings"][number]["type"],
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
          type: deduction.type as PayrollRecord["deductions"][number]["type"],
          description: deduction.description,
          amount: deduction.amount,
          isPreTax: false,
          isPercentage: false,
        })),
        totalDeductions: d.calculation!.totalDeductions,
        employerContributions: [],
        totalEmployerContributions: 0,
        employerTaxes: [
          {
            type: "inss_employer" as const,
            description: TL_DEDUCTION_TYPE_LABELS.inss_employer.en,
            amount: d.calculation!.inssEmployer,
          },
        ],
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
    [tenantId, ytdByEmployee, calculationConfig],
  );

  return {
    // State
    employeePayrollData,
    // Active employees plus in-period leavers getting their final-pay run
    rosterEmployees,
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
    // One gate for ALL money-critical aggregations (YTD, committed final pay,
    // MTD WIT, recurring deductions). If any is still loading or failed,
    // computing anyway would silently fall back to the empty map — a fresh
    // $500/month exemption, a re-paid severance, or a run that skips every
    // advance repayment and court order — so the wizard must block persistence
    // on these, not just on YTD. Disabled queries (weekly runs, no leavers)
    // report false.
    isYtdLoading:
      ytdQuery.isLoading ||
      committedFinalPayQuery.isLoading ||
      mtdWitQuery.isLoading ||
      recurringDeductionsQuery.isLoading,
    isYtdError:
      (ytdQuery.isError && ytdQuery.data === undefined) ||
      (committedFinalPayQuery.isError &&
        committedFinalPayQuery.data === undefined) ||
      (mtdWitQuery.isError && mtdWitQuery.data === undefined) ||
      (recurringDeductionsQuery.isError &&
        recurringDeductionsQuery.data === undefined),
    isYtdFetching:
      ytdQuery.isFetching ||
      committedFinalPayQuery.isFetching ||
      mtdWitQuery.isFetching ||
      recurringDeductionsQuery.isFetching,

    // Actions
    handleInputChange,
    handleBonusCategoryChange,
    handleResetRow,
    toggleRowExpansion,
    handleSyncFromAttendance,
    refetchYtd: () =>
      Promise.all([
        ytdQuery.refetch(),
        // refetch() bypasses `enabled`, so only retry queries that have
        // actually run (errored or resolved) — never force a disabled one.
        ...(committedFinalPayQuery.isError ||
        committedFinalPayQuery.data !== undefined
          ? [committedFinalPayQuery.refetch()]
          : []),
        ...(mtdWitQuery.isError || mtdWitQuery.data !== undefined
          ? [mtdWitQuery.refetch()]
          : []),
        ...(recurringDeductionsQuery.isError ||
        recurringDeductionsQuery.data !== undefined
          ? [recurringDeductionsQuery.refetch()]
          : []),
      ]),

    // Submission helpers
    getIncludedData,
    validateAllEmployees,
    buildPayrollRun,
    buildPayrollRecords,
  };
}
