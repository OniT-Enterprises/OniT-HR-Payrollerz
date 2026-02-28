/**
 * Run Payroll Page - Timor-Leste Version
 * Uses TL tax law (10% above $500) and INSS (4% + 6%)
 *
 * UX Principle: "Point of no return" - treat this page with seriousness
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Calculator,
  Users,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  Calendar,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useCreatePayrollRunWithRecords } from "@/hooks/usePayroll";
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
import { SEO, seoConfig } from "@/components/SEO";
import { sumMoney } from "@/lib/currency";
import { getTodayTL, toDateStringTL } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import {
  PayrollLoadingSkeleton,
  TaxInfoBanner,
  PayrollSummaryCards,
  PayrollEmployeeRow,
  TaxSummaryCard,
  PayrollPeriodConfig,
  PayrollComplianceCard,
  PayrollDialogs,
} from "@/components/payroll";

import {
  calculateProRataHours,
  type EmployeePayrollData,
  getPayPeriodsInPayMonth,
  formatPayPeriod,
  formatPayDate,
} from "@/lib/payroll/run-payroll-helpers";

export default function RunPayroll() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();

  // React Query: fetch all employees
  const { data: allEmployees = [], isLoading: loadingEmployees } = useAllEmployees();
  const activeEmployees = useMemo(() => allEmployees.filter(e => e.status === 'active'), [allEmployees]);

  // React Query: mutation for creating payroll runs
  const createPayrollMutation = useCreatePayrollRunWithRecords();

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

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);

  // Compliance states - for NGO "run anyway" scenarios
  const [excludedEmployees, setExcludedEmployees] = useState<Set<string>>(new Set());
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");
  const [showAllCompliance, setShowAllCompliance] = useState(false);

  // Initialize dates to current month
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const payDay = new Date(year, month + 1, 5); // 5th of next month

    setPeriodStart(toDateStringTL(firstDay));
    setPeriodEnd(toDateStringTL(lastDay));
    setPayDate(toDateStringTL(payDay));
  }, []);

  // Initialize payroll data when active employees change
  useEffect(() => {
    if (activeEmployees.length === 0) return;

    // TL standard: 44 hours/week = ~190.67 hours/month (44 * 52/12)
    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const defaultHours = monthlyHours / TL_PAY_PERIODS[payFrequency].periodsPerMonth;

    const initialData: EmployeePayrollData[] = activeEmployees.map((emp) => {
      // Auto-prorate hours for mid-period hires
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

  /**
   * Calculate payroll for a single employee data object.
   */
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

  // Track if we need to recalculate (used by useEffect below)
  const calculationVersion = useRef(0);

  // Initial calculation when data is first loaded
  useEffect(() => {
    if (employeePayrollData.length === 0) return;
    // Only run initial calculation if no calculations exist yet
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

  // Detect employees with compliance issues (for NGO "run anyway" scenarios)
  const complianceIssues = useMemo(() => {
    return activeEmployees.map(emp => {
      const issues: string[] = [];
      if (!emp.documents?.workContract?.fileUrl) issues.push(t("runPayroll.contractNeeded"));
      if (!emp.documents?.socialSecurityNumber?.number) issues.push(t("runPayroll.inssNeeded"));
      return { employee: emp, issues };
    }).filter(item => item.issues.length > 0);
  }, [activeEmployees, t]);

  const hasComplianceIssues = complianceIssues.length > 0;

  // Calculate totals (excluding excluded employees)
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

  // Count edited rows
  const editedCount = useMemo(() => {
    return employeePayrollData.filter((d) => d.isEdited).length;
  }, [employeePayrollData]);

  // Inline warnings for minimum wage and excessive hours
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

  // Helper: get employees included in the payroll run
  const getIncludedData = useCallback(() =>
    employeePayrollData
      .filter((d) => d.calculation)
      .filter((d) => !excludedEmployees.has(d.employee.id || "")),
    [employeePayrollData, excludedEmployees]
  );

  // Validate all included employee payroll inputs using TL tax law rules
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

  // Helper: build PayrollRun object
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
    createdBy: user?.uid || "current-user",
    notes: "",
  }), [tenantId, periodStart, periodEnd, payDate, payFrequency, totals, user?.uid]);

  // Helper: build PayrollRecord array from employee data
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

  // Filter employees by search
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

  // Handle input changes with edit tracking, validation, and inline recalculation
  const handleInputChange = (
    employeeId: string,
    field: string,
    value: number
  ) => {
    // Reject non-finite values (NaN, Infinity)
    if (!Number.isFinite(value)) return;

    // Field-specific range validation
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

        const isEdited =
          updated.regularHours !== d.originalValues.regularHours ||
          updated.overtimeHours !== d.originalValues.overtimeHours ||
          updated.nightShiftHours !== d.originalValues.nightShiftHours ||
          updated.absenceHours !== d.originalValues.absenceHours ||
          updated.lateArrivalMinutes !== d.originalValues.lateArrivalMinutes ||
          updated.bonus !== d.originalValues.bonus ||
          updated.perDiem !== d.originalValues.perDiem ||
          updated.allowances !== d.originalValues.allowances;

        const withEdit = { ...updated, isEdited };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      })
    );
  };

  // Reset row to original values and recalculate
  const handleResetRow = (employeeId: string) => {
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
  };

  // Toggle row expansion
  const toggleRowExpansion = (employeeId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Sync attendance totals (regular/overtime/late) into payroll inputs.
  const handleSyncFromAttendance = async () => {
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

        const isEdited =
          updated.regularHours !== data.originalValues.regularHours ||
          updated.overtimeHours !== data.originalValues.overtimeHours ||
          updated.nightShiftHours !== data.originalValues.nightShiftHours ||
          updated.absenceHours !== data.originalValues.absenceHours ||
          updated.lateArrivalMinutes !== data.originalValues.lateArrivalMinutes ||
          updated.bonus !== data.originalValues.bonus ||
          updated.perDiem !== data.originalValues.perDiem ||
          updated.allowances !== data.originalValues.allowances;

        syncedCount += 1;
        const withEdit = { ...updated, isEdited };
        return { ...withEdit, calculation: calculateForEmployee(withEdit) };
      })
    );

    toast({
      title: t("runPayroll.syncAttendance"),
      description: t("runPayroll.toastSyncedAttendance", { count: String(syncedCount) }),
    });
  };

  // Save as draft
  const handleSaveDraft = async () => {
    const includedData = getIncludedData();

    const validationErrors = validateAllEmployees(includedData);
    if (validationErrors.length > 0) {
      toast({
        title: t("runPayroll.toastValidationErrors"),
        description: validationErrors.slice(0, 3).join("\n") +
          (validationErrors.length > 3 ? `\n...and ${validationErrors.length - 3} more` : ""),
        variant: "destructive",
      });
      return;
    }

    const payrollRun = buildPayrollRun(includedData);
    const records = buildPayrollRecords(includedData);

    createPayrollMutation.mutate(
      { payrollRun, records },
      {
        onSuccess: () => {
          toast({
            title: t("common.success"),
            description: t("runPayroll.toastDraftSaved"),
          });
          setShowSaveDialog(false);
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
  };

  // Process payroll (final step)
  const handleProcessPayroll = async () => {
    if (!periodStart || !periodEnd || !payDate) {
      toast({
        title: t("runPayroll.toastDatesRequired"),
        description: t("runPayroll.toastDatesRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (periodStart >= periodEnd) {
      toast({
        title: t("runPayroll.toastInvalidPeriod"),
        description: t("runPayroll.toastInvalidPeriodDesc"),
        variant: "destructive",
      });
      return;
    }

    if (payDate < periodEnd) {
      toast({
        title: t("runPayroll.toastInvalidPayDate"),
        description: t("runPayroll.toastInvalidPayDateDesc"),
        variant: "destructive",
      });
      return;
    }

    // SEC-6: Date range validation
    const now = new Date();
    const twoYearsAgo = toDateStringTL(new Date(now.getFullYear() - 2, now.getMonth(), 1));
    const oneMonthAhead = toDateStringTL(new Date(now.getFullYear(), now.getMonth() + 2, 0));
    if (periodStart < twoYearsAgo || periodEnd > oneMonthAhead) {
      toast({
        title: t("runPayroll.toastDateOutOfBounds"),
        description: t("runPayroll.toastDateOutOfBoundsDesc"),
        variant: "destructive",
      });
      return;
    }

    // SEC-7: Compliance override reason validation
    if (hasComplianceIssues && excludedEmployees.size < complianceIssues.length) {
      if (!complianceAcknowledged) {
        toast({
          title: t("runPayroll.toastComplianceRequired"),
          description: t("runPayroll.toastComplianceRequiredDesc"),
          variant: "destructive",
        });
        return;
      }
      if (complianceOverrideReason.trim().length < 10) {
        toast({
          title: t("runPayroll.toastOverrideShort"),
          description: t("runPayroll.toastOverrideShortDesc"),
          variant: "destructive",
        });
        return;
      }
    }

    const includedData = getIncludedData();

    const validationErrors = validateAllEmployees(includedData);
    if (validationErrors.length > 0) {
      toast({
        title: t("runPayroll.toastValidationErrors"),
        description: validationErrors.slice(0, 3).join("\n") +
          (validationErrors.length > 3 ? `\n...and ${validationErrors.length - 3} more` : ""),
        variant: "destructive",
      });
      return;
    }

    const payrollRun = {
      ...buildPayrollRun(includedData),
      status: 'processing' as const,
    };
    const records = buildPayrollRecords(includedData);
    const audit = { tenantId, userId: user?.uid || "current-user", userEmail: user?.email || "" };

    createPayrollMutation.mutate(
      { payrollRun, records, audit },
      {
        onSuccess: () => {
          toast({
            title: t("runPayroll.toastSubmittedTitle"),
            description: t("runPayroll.toastSubmittedDesc", { count: String(includedData.length) }),
          });

          setShowFinalConfirmDialog(false);
          setShowApproveDialog(false);

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
  };

  // Derive saving/processing from mutation state
  const saving = createPayrollMutation.isPending;
  const processing = createPayrollMutation.isPending;

  if (loadingEmployees) {
    return <PayrollLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {t("runPayroll.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("runPayroll.processPayrollFor", { count: String(activeEmployees.length) })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/payroll")}
                className="text-muted-foreground shadow-sm"
              >
                {t("common.cancel")}
              </Button>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="shadow-sm">
                <Save className="h-4 w-4 mr-2" />
                {t("runPayroll.saveDraft")}
              </Button>
              <Button onClick={() => setShowApproveDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25">
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("runPayroll.submitForApproval")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Pay Period Banner */}
        <Card className="mb-6 border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 animate-fade-up stagger-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 text-sm px-3 py-1">
                      {t("runPayroll.payPeriod")}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal capitalize">
                      {t(`runPayroll.${payFrequency}`)}
                    </Badge>
                    {editedCount > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                        <Pencil className="h-3 w-3 mr-1" />
                        {t("runPayroll.edited", { count: String(editedCount) })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold mt-1">
                    {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : t("runPayroll.notSet")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("runPayroll.payDateBanner")}</p>
                <p className="text-lg font-semibold">{payDate ? formatPayDate(payDate) : t("runPayroll.notSet")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TL Tax Info Banner */}
        <TaxInfoBanner />

        {/* Compliance Notice */}
        <PayrollComplianceCard
          complianceIssues={complianceIssues}
          excludedEmployees={excludedEmployees}
          setExcludedEmployees={setExcludedEmployees}
          complianceAcknowledged={complianceAcknowledged}
          setComplianceAcknowledged={setComplianceAcknowledged}
          complianceOverrideReason={complianceOverrideReason}
          setComplianceOverrideReason={setComplianceOverrideReason}
          showAllCompliance={showAllCompliance}
          setShowAllCompliance={setShowAllCompliance}
          totalEmployees={activeEmployees.length}
        />

        {/* Period Settings */}
        <PayrollPeriodConfig
          payFrequency={payFrequency}
          setPayFrequency={setPayFrequency}
          periodStart={periodStart}
          setPeriodStart={setPeriodStart}
          periodEnd={periodEnd}
          setPeriodEnd={setPeriodEnd}
          payDate={payDate}
          setPayDate={setPayDate}
          includeSubsidioAnual={includeSubsidioAnual}
          setIncludeSubsidioAnual={setIncludeSubsidioAnual}
          onSyncAttendance={handleSyncFromAttendance}
          syncingAttendance={syncingAttendance}
        />

        {/* Summary Cards */}
        <div className="animate-fade-up stagger-2">
          <PayrollSummaryCards totals={totals} employeeCount={activeEmployees.length} />
        </div>

        {/* Tax Summary Card */}
        <div className="animate-fade-up stagger-3">
          <TaxSummaryCard totals={totals} />
        </div>

        {/* Payroll Warnings */}
        {payrollWarnings.length > 0 && (
          <Card className="mb-6 border-red-500/30 bg-red-50/30 dark:bg-red-950/10 animate-fade-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200 text-base">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                {t("runPayroll.payrollWarnings", { count: String(payrollWarnings.length) })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {payrollWarnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 p-2 rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-medium">{w.employeeName}:</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Payroll Table */}
        <Card className="border-border/50 animate-fade-up stagger-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                    <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {t("runPayroll.employeePayroll")}
                  <Badge variant="outline" className="text-xs font-normal tabular-nums ml-1">
                    {filteredData.length}{filteredData.length !== employeePayrollData.length ? ` / ${employeePayrollData.length}` : ''}
                  </Badge>
                  {editedCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      {t("runPayroll.modified", { count: String(editedCount) })}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {t("runPayroll.adjustHoursDesc")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("runPayroll.searchEmployees")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 border-border/50"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                      onToggleExpand={toggleRowExpansion}
                      onInputChange={handleInputChange}
                      onReset={handleResetRow}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredData.length === 0 && (
              <div className="text-center py-16">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/20 dark:to-emerald-950/10 flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-green-400" />
                </div>
                <p className="font-medium text-foreground mb-1">{t("runPayroll.noEmployeesFound")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("runPayroll.tryAdjustSearch")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-8" />
      </div>

      {/* Dialogs */}
      <PayrollDialogs
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        handleSaveDraft={handleSaveDraft}
        saving={saving}
        showApproveDialog={showApproveDialog}
        setShowApproveDialog={setShowApproveDialog}
        showFinalConfirmDialog={showFinalConfirmDialog}
        setShowFinalConfirmDialog={setShowFinalConfirmDialog}
        handleProcessPayroll={handleProcessPayroll}
        processing={processing}
        periodStart={periodStart}
        periodEnd={periodEnd}
        payDate={payDate}
        employeeCount={activeEmployees.length}
        editedCount={editedCount}
        totals={totals}
        t={t}
      />
    </div>
  );
}
