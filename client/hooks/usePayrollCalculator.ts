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

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useAttendanceSummary } from "@/hooks/useAttendance";

import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  validateTLPayrollInput,
  type TLPayrollInput,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import {
  TL_PAY_PERIODS,
  TL_WORKING_HOURS,
  TL_OVERTIME_RATES,
  TL_DEDUCTION_TYPE_LABELS,
  TL_MINIMUM_WAGE,
} from "@/lib/payroll/constants-tl";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import { sumMoney } from "@/lib/currency";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import type { Employee } from "@/services/employeeService";

import {
  calculateProRataHours,
  type EmployeePayrollData,
  getPayPeriodsInPayMonth,
} from "@/lib/payroll/run-payroll-helpers";

interface UsePayrollCalculatorOptions {
  activeEmployees: Employee[];
  tenantId: string;
  userId: string;
}

export function usePayrollCalculator({
  activeEmployees,
  tenantId,
  userId,
}: UsePayrollCalculatorOptions) {
  const { toast } = useToast();
  const { t } = useI18n();

  const [employeePayrollData, setEmployeePayrollData] = useState<EmployeePayrollData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Payroll period settings
  const [payFrequency, setPayFrequency] = useState<TLPayFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [includeSubsidioAnual, setIncludeSubsidioAnual] = useState(false);

  const {
    data: attendanceSummary = [],
    isFetching: syncingAttendance,
    refetch: refetchAttendanceSummary,
  } = useAttendanceSummary(periodStart, periodEnd);

  // Compliance states
  const [excludedEmployees, setExcludedEmployees] = useState<Set<string>>(new Set());

  // Initialize dates to current month
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const payDay = new Date(year, month + 1, 5);

    setPeriodStart(toDateStringTL(firstDay));
    setPeriodEnd(toDateStringTL(lastDay));
    setPayDate(toDateStringTL(payDay));
  }, []);

  // Initialize payroll data when active employees change
  useEffect(() => {
    if (activeEmployees.length === 0) return;

    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const defaultHours = monthlyHours / TL_PAY_PERIODS[payFrequency].periodsPerMonth;

    const initialData: EmployeePayrollData[] = activeEmployees.map((emp) => {
      const hireDate = emp.jobDetails.hireDate || '';
      const empHours = calculateProRataHours(hireDate, periodStart, periodEnd, defaultHours);

      return {
        employee: emp,
        regularHours: empHours,
        overtimeHours: 0,
        nightShiftHours: 0,
        holidayHours: 0,
        absenceHours: 0,
        lateArrivalMinutes: 0,
        sickDays: 0,
        perDiem: 0,
        bonus: 0,
        allowances: 0,
        calculation: null,
        isEdited: false,
        originalValues: {
          regularHours: empHours,
          overtimeHours: 0,
          nightShiftHours: 0,
          absenceHours: 0,
          lateArrivalMinutes: 0,
          bonus: 0,
          perDiem: 0,
          allowances: 0,
        },
      };
    });

    setEmployeePayrollData(initialData);
  }, [activeEmployees, payFrequency, periodStart, periodEnd]);

  // ─── Core calculation ───────────────────────────────────────────
  const calculateForEmployee = useCallback((data: EmployeePayrollData): TLPayrollResult | null => {
    const monthlySalary = data.employee.compensation.monthlySalary || 0;
    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const hourlyRate = monthlySalary / monthlyHours;
    const asOfDate = payDate ? new Date(`${payDate}T00:00:00`) : new Date();
    const monthsWorkedThisYear = asOfDate.getMonth() + 1;
    const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
    const subsidioAnual = includeSubsidioAnual
      ? calculateSubsidioAnual(monthlySalary, monthsWorkedThisYear, hireDate, asOfDate)
      : 0;
    const totalPeriodsInMonth = getPayPeriodsInPayMonth(payDate, payFrequency);
    const isResident =
      data.employee.compensation?.isResident ??
      (data.employee.documents?.residencyStatus
        ? data.employee.documents.residencyStatus !== "foreign_worker"
        : true);

    const input: TLPayrollInput = {
      employeeId: data.employee.id || "",
      monthlySalary,
      payFrequency,
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
      ytdSickDaysUsed: 0,
      bonus: data.bonus,
      commission: 0,
      perDiem: data.perDiem,
      foodAllowance: 0,
      transportAllowance: data.allowances,
      otherEarnings: 0,
      subsidioAnual,
      taxInfo: {
        isResident,
        hasTaxExemption: false,
      },
      loanRepayment: 0,
      advanceRepayment: 0,
      courtOrders: 0,
      otherDeductions: 0,
      ytdGrossPay: 0,
      ytdIncomeTax: 0,
      ytdINSSEmployee: 0,
      monthsWorkedThisYear,
      hireDate,
    };

    try {
      return calculateTLPayroll(input);
    } catch (error) {
      console.error("Calculation error for employee:", data.employee.id, error);
      return null;
    }
  }, [payFrequency, payDate, includeSubsidioAnual]);

  // Track recalculation
  const calculationVersion = useRef(0);

  // Initial calculation when data is first loaded
  useEffect(() => {
    if (employeePayrollData.length === 0) return;
    if (employeePayrollData.every(d => d.calculation !== null)) return;

    calculationVersion.current++;
    const updatedData = employeePayrollData.map((data) => ({
      ...data,
      calculation: calculateForEmployee(data),
    }));
    setEmployeePayrollData(updatedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeePayrollData.length, calculateForEmployee]);

  // Recalculate when pay frequency changes
  useEffect(() => {
    if (employeePayrollData.length === 0) return;

    calculationVersion.current++;
    setEmployeePayrollData((prev) =>
      prev.map((data) => ({
        ...data,
        calculation: calculateForEmployee(data),
      }))
    );
  }, [payFrequency, payDate, includeSubsidioAnual, calculateForEmployee, employeePayrollData.length]);

  // ─── Edit tracking helpers ──────────────────────────────────────

  const checkIsEdited = (updated: EmployeePayrollData): boolean =>
    updated.regularHours !== updated.originalValues.regularHours ||
    updated.overtimeHours !== updated.originalValues.overtimeHours ||
    updated.nightShiftHours !== updated.originalValues.nightShiftHours ||
    updated.absenceHours !== updated.originalValues.absenceHours ||
    updated.lateArrivalMinutes !== updated.originalValues.lateArrivalMinutes ||
    updated.bonus !== updated.originalValues.bonus ||
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
        const isEdited = checkIsEdited(updated);
        const withEdit = { ...updated, isEdited };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      })
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

  const handleSyncFromAttendance = useCallback(async () => {
    if (!periodStart || !periodEnd) {
      toast({
        title: t("runPayroll.toastDatesRequired"),
        description: t("runPayroll.toastDatesRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    const result = await refetchAttendanceSummary();
    const summaryRows = result.data ?? attendanceSummary;
    if (!summaryRows || summaryRows.length === 0) {
      toast({
        title: t("runPayroll.syncAttendance"),
        description: t("runPayroll.toastSyncAttendanceNoData"),
      });
      return;
    }

    const summaryByEmployee = new Map(summaryRows.map((row) => [row.employeeId, row]));
    let syncedCount = 0;

    setEmployeePayrollData((prev) =>
      prev.map((data) => {
        const employeeId = data.employee.id || "";
        const summary = summaryByEmployee.get(employeeId);
        if (!summary) return data;

        const regularHours = Number(summary.regularHours.toFixed(2));
        const overtimeHours = Number(summary.overtimeHours.toFixed(2));
        const expectedRegularHours = data.originalValues.regularHours;
        const absenceHours = Number(Math.max(0, expectedRegularHours - regularHours).toFixed(2));
        const lateArrivalMinutes = Math.max(0, Math.round(summary.lateMinutes));

        const updated: EmployeePayrollData = {
          ...data,
          regularHours,
          overtimeHours,
          absenceHours,
          lateArrivalMinutes,
        };

        const isEdited = checkIsEdited(updated);
        syncedCount += 1;
        const withEdit = { ...updated, isEdited };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      })
    );

    toast({
      title: t("runPayroll.syncAttendance"),
      description: t("runPayroll.toastSyncedAttendance", { count: String(syncedCount) }),
    });
  }, [periodStart, periodEnd, toast, t, refetchAttendanceSummary, attendanceSummary, calculateForEmployee]);

  // ─── Compliance issues ──────────────────────────────────────────

  const complianceIssues = useMemo(() => {
    return activeEmployees.map(emp => {
      const issues: string[] = [];
      if (!emp.documents?.workContract?.fileUrl) issues.push(t("runPayroll.contractNeeded"));
      if (!emp.documents?.socialSecurityNumber?.number) issues.push(t("runPayroll.inssNeeded"));
      return { employee: emp, issues };
    }).filter(item => item.issues.length > 0);
  }, [activeEmployees, t]);

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
      if (salary > 0 && salary < TL_MINIMUM_WAGE.monthly) {
        warnings.push({ employeeName: name, message: t("runPayroll.warningBelowMinWage", { salary: String(salary), min: String(TL_MINIMUM_WAGE.monthly) }), type: "wage" });
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
  }, [employeePayrollData, excludedEmployees, t]);

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
      const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
      const hourlyRate = monthlySalary / monthlyHours;
      const asOfDate = payDate ? new Date(`${payDate}T00:00:00`) : new Date();
      const monthsWorkedThisYear = asOfDate.getMonth() + 1;
      const hireDate = data.employee.jobDetails.hireDate || getTodayTL();
      const subsidioAnual = includeSubsidioAnual
        ? calculateSubsidioAnual(monthlySalary, monthsWorkedThisYear, hireDate, asOfDate)
        : 0;
      const totalPeriodsInMonth = getPayPeriodsInPayMonth(payDate, payFrequency);
      const isResident =
        data.employee.compensation?.isResident ??
        (data.employee.documents?.residencyStatus
          ? data.employee.documents.residencyStatus !== "foreign_worker"
          : true);

      const input: TLPayrollInput = {
        employeeId: data.employee.id || "",
        monthlySalary,
        payFrequency,
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
        ytdSickDaysUsed: 0,
        bonus: data.bonus,
        commission: 0,
        perDiem: data.perDiem,
        foodAllowance: 0,
        transportAllowance: data.allowances,
        otherEarnings: 0,
        subsidioAnual,
        taxInfo: { isResident, hasTaxExemption: false },
        loanRepayment: 0,
        advanceRepayment: 0,
        courtOrders: 0,
        otherDeductions: 0,
        ytdGrossPay: 0,
        ytdIncomeTax: 0,
        ytdINSSEmployee: 0,
        monthsWorkedThisYear,
        hireDate,
      };

      const errors = validateTLPayrollInput(input);
      if (errors.length > 0) {
        const name = `${data.employee.personalInfo.firstName} ${data.employee.personalInfo.lastName}`;
        allErrors.push(...errors.map(e => `${name}: ${e}`));
      }
    }
    return allErrors;
  }, [payDate, payFrequency, includeSubsidioAnual]);

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
      regularHours: d.regularHours,
      overtimeHours: d.overtimeHours,
      doubleTimeHours: 0,
      holidayHours: d.holidayHours,
      ptoHoursUsed: 0,
      sickHoursUsed: d.sickDays * 8,
      hourlyRate: (d.employee.compensation.monthlySalary || 0) / ((TL_WORKING_HOURS.standardWeeklyHours * 52) / 12),
      overtimeRate: TL_OVERTIME_RATES.standard,
      earnings: d.calculation!.earnings.map((earning) => ({
        type: (['regular','overtime','double_time','holiday','bonus','subsidio_anual','commission','tip','reimbursement','allowance'].includes(earning.type)
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
      ytdGrossPay: 0,
      ytdNetPay: 0,
      ytdIncomeTax: 0,
      ytdINSSEmployee: 0,
    })),
    [tenantId]
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
    syncingAttendance,

    // Actions
    handleInputChange,
    handleResetRow,
    toggleRowExpansion,
    handleSyncFromAttendance,

    // Submission helpers
    getIncludedData,
    validateAllEmployees,
    buildPayrollRun,
    buildPayrollRecords,
  };
}
