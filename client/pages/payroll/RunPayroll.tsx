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
  Eye,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { employeeService, Employee } from "@/services/employeeService";
import { payrollService } from "@/services/payrollService";

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

import type { EmployeePayrollData } from "@/lib/payroll/run-payroll-helpers";
import {
  mapTLEarningTypeToPayrollEarningType,
  mapTLDeductionTypeToPayrollDeductionType,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeePayrollData, setEmployeePayrollData] = useState<EmployeePayrollData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Payroll period settings
  const [payFrequency, setPayFrequency] = useState<TLPayFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [includeSubsidioAnual, setIncludeSubsidioAnual] = useState(false);

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

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        const data = await employeeService.getAllEmployees(tenantId);
        const activeEmployees = data.filter((e) => e.status === "active");
        setEmployees(activeEmployees);

        // Initialize payroll data for each employee
        // TL standard: 44 hours/week = ~190.67 hours/month (44 * 52/12)
        const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
        const defaultHours = monthlyHours / TL_PAY_PERIODS[payFrequency].periodsPerMonth;

        const initialData: EmployeePayrollData[] = activeEmployees.map((emp) => ({
          employee: emp,
          regularHours: defaultHours,
          overtimeHours: 0,
          nightShiftHours: 0,
          holidayHours: 0,
          sickDays: 0,
          perDiem: 0,
          bonus: 0,
          allowances: 0,
          calculation: null,
          isEdited: false,
          originalValues: {
            regularHours: defaultHours,
            overtimeHours: 0,
            nightShiftHours: 0,
            bonus: 0,
            perDiem: 0,
            allowances: 0,
          },
        }));

        setEmployeePayrollData(initialData);
      } catch (error) {
        console.error("Failed to load employees:", error);
        toast({
          title: "Error",
          description: "Failed to load employees. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [toast, payFrequency, tenantId]);

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
      absenceHours: 0,
      lateArrivalMinutes: 0,
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
    return employees.map(emp => {
      const issues: string[] = [];
      if (!emp.documents?.workContract?.fileUrl) issues.push("Contract needed");
      if (!emp.documents?.socialSecurityNumber?.number) issues.push("INSS needed");
      return { employee: emp, issues };
    }).filter(item => item.issues.length > 0);
  }, [employees]);

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
        warnings.push({ employeeName: name, message: `Salary $${salary} is below minimum wage ($${TL_MINIMUM_WAGE.monthly}/month)`, type: "wage" });
      }
      if (d.overtimeHours > maxMonthlyOT) {
        warnings.push({ employeeName: name, message: `${d.overtimeHours} OT hours exceeds max ${maxMonthlyOT}/month (${TL_WORKING_HOURS.maxOvertimePerWeek}/week)`, type: "hours" });
      }
      const totalDailyHoursEquiv = (d.regularHours + d.overtimeHours + d.nightShiftHours) / 22;
      if (totalDailyHoursEquiv > 12) {
        warnings.push({ employeeName: name, message: `Averaging ${totalDailyHoursEquiv.toFixed(1)} hours/day — exceeds safe limits`, type: "hours" });
      }
    }
    return warnings;
  }, [employeePayrollData, excludedEmployees]);

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
        absenceHours: 0,
        lateArrivalMinutes: 0,
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
        type: mapTLEarningTypeToPayrollEarningType(earning.type),
        description: earning.description,
        hours: earning.hours,
        rate: earning.rate,
        amount: earning.amount,
      })),
      totalGrossPay: d.calculation!.grossPay,
      deductions: d.calculation!.deductions.map((deduction) => ({
        type: mapTLDeductionTypeToPayrollDeductionType(deduction.type),
        description: deduction.description,
        amount: deduction.amount,
        isPreTax: false,
        isPercentage: false,
      })),
      totalDeductions: d.calculation!.totalDeductions,
      employerContributions: [],
      totalEmployerContributions: 0,
      employerTaxes: [{
        type: "social_security" as const,
        description: TL_DEDUCTION_TYPE_LABELS.inss_employer.en,
        amount: d.calculation!.inssEmployer,
      }],
      totalEmployerTaxes: d.calculation!.inssEmployer,
      netPay: d.calculation!.netPay,
      totalEmployerCost: d.calculation!.totalEmployerCost,
      ytdGrossPay: 0,
      ytdNetPay: 0,
      ytdFederalTax: 0,
      ytdStateTax: 0,
      ytdSocialSecurity: 0,
      ytdMedicare: 0,
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

  // Save as draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const includedData = getIncludedData();

      const validationErrors = validateAllEmployees(includedData);
      if (validationErrors.length > 0) {
        toast({
          title: "Validation errors",
          description: validationErrors.slice(0, 3).join("\n") +
            (validationErrors.length > 3 ? `\n...and ${validationErrors.length - 3} more` : ""),
          variant: "destructive",
        });
        return;
      }

      const payrollRun = buildPayrollRun(includedData);
      const records = buildPayrollRecords(includedData);

      await payrollService.runs.createPayrollRunWithRecords(payrollRun, records);

      toast({
        title: "Success",
        description: "Payroll draft saved successfully.",
      });

      setShowSaveDialog(false);
    } catch (error) {
      console.error("Failed to save payroll:", error);
      toast({
        title: "Error",
        description: "Failed to save payroll. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Process payroll (final step)
  const handleProcessPayroll = async () => {
    setProcessing(true);
    try {
      if (!periodStart || !periodEnd || !payDate) {
        toast({
          title: "Dates required",
          description: "Set pay period and pay date before processing.",
          variant: "destructive",
        });
        return;
      }

      if (periodStart >= periodEnd) {
        toast({
          title: "Invalid period",
          description: "Period start must be before period end.",
          variant: "destructive",
        });
        return;
      }

      if (payDate < periodEnd) {
        toast({
          title: "Invalid pay date",
          description: "Pay date should be on or after the period end date.",
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
          title: "Date range out of bounds",
          description: "Pay period must be within the past 2 years and no more than 1 month in the future.",
          variant: "destructive",
        });
        return;
      }

      // SEC-7: Compliance override reason validation
      if (hasComplianceIssues && excludedEmployees.size < complianceIssues.length) {
        if (!complianceAcknowledged) {
          toast({
            title: "Compliance acknowledgment required",
            description: "Please acknowledge the compliance issues before proceeding.",
            variant: "destructive",
          });
          return;
        }
        if (complianceOverrideReason.trim().length < 10) {
          toast({
            title: "Override reason too short",
            description: "Please provide at least 10 characters explaining why you are proceeding without full compliance.",
            variant: "destructive",
          });
          return;
        }
      }

      const includedData = getIncludedData();

      const validationErrors = validateAllEmployees(includedData);
      if (validationErrors.length > 0) {
        toast({
          title: "Validation errors",
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

      await payrollService.runs.createPayrollRunWithRecords(
        payrollRun,
        records,
        { tenantId, userId: user?.uid || "current-user", userEmail: user?.email || "" }
      );

      toast({
        title: t("runPayroll.toastSubmittedTitle"),
        description: t("runPayroll.toastSubmittedDesc", { count: String(includedData.length) }),
      });

      setShowFinalConfirmDialog(false);
      setShowApproveDialog(false);

      navigate("/payroll/history");
    } catch (error) {
      console.error("Failed to process payroll:", error);
      toast({
        title: t("runPayroll.toastErrorTitle"),
        description: t("runPayroll.toastErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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
                  Run Payroll
                </h1>
                <p className="text-muted-foreground mt-1">
                  Process payroll for {employees.length} active employees
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/payroll")}
                className="text-muted-foreground shadow-sm"
              >
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="shadow-sm">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={() => setShowApproveDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25">
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit for Approval
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
                      Pay Period
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal capitalize">
                      {payFrequency}
                    </Badge>
                    {editedCount > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-xs">
                        <Pencil className="h-3 w-3 mr-1" />
                        {editedCount} edited
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold mt-1">
                    {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : "Not set"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Pay Date</p>
                <p className="text-lg font-semibold">{payDate ? formatPayDate(payDate) : "Not set"}</p>
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
          totalEmployees={employees.length}
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
        />

        {/* Summary Cards */}
        <div className="animate-fade-up stagger-2">
          <PayrollSummaryCards totals={totals} employeeCount={employees.length} />
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
                {payrollWarnings.length} Payroll Warning{payrollWarnings.length > 1 ? "s" : ""}
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
                  Employee Payroll
                  <Badge variant="outline" className="text-xs font-normal tabular-nums ml-1">
                    {filteredData.length}{filteredData.length !== employeePayrollData.length ? ` / ${employeePayrollData.length}` : ''}
                  </Badge>
                  {editedCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      {editedCount} modified
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Adjust hours and additional pay for each employee
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="text-muted-foreground"
                  title="Coming soon"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Payslips
                </Button>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Employee</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Department</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Hours</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">OT</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Night</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Bonus</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Gross</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Deductions</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Net Pay</TableHead>
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
                <p className="font-medium text-foreground mb-1">No employees found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search term or clear the filter
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
        employeeCount={employees.length}
        editedCount={editedCount}
        totals={totals}
        t={t}
      />
    </div>
  );
}
