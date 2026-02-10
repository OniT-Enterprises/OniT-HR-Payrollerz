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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Calculator,
  Users,
  FileText,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Search,
  Lock,
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
  formatCurrencyTL,
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
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import {
  PayrollLoadingSkeleton,
  TaxInfoBanner,
  PayrollSummaryCards,
  PayrollEmployeeRow,
  TaxSummaryCard,
} from "@/components/payroll";

interface EmployeePayrollData {
  employee: Employee;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  sickDays: number;
  perDiem: number;
  bonus: number;
  allowances: number;
  calculation: TLPayrollResult | null;
  // Track if row has been edited
  isEdited: boolean;
  // Store original values for reset
  originalValues: {
    regularHours: number;
    overtimeHours: number;
    nightShiftHours: number;
    bonus: number;
    perDiem: number;
    allowances: number;
  };
}

const mapTLEarningTypeToPayrollEarningType = (
  type: string
): PayrollRecord["earnings"][number]["type"] => {
  switch (type) {
    case "regular":
      return "regular";
    case "overtime":
      return "overtime";
    case "holiday":
      return "holiday";
    case "bonus":
      return "bonus";
    case "subsidio_anual":
      return "subsidio_anual";
    case "commission":
      return "commission";
    case "reimbursement":
      return "reimbursement";
    case "per_diem":
    case "food_allowance":
    case "transport_allowance":
    case "housing_allowance":
    case "travel_allowance":
      return "allowance";
    default:
      return "other";
  }
};

const mapTLDeductionTypeToPayrollDeductionType = (
  type: string
): PayrollRecord["deductions"][number]["type"] => {
  switch (type) {
    case "income_tax":
      return "federal_tax";
    case "inss_employee":
      return "social_security";
    case "advance_repayment":
      return "advance";
    case "court_order":
      return "garnishment";
    default:
      return "other";
  }
};

const getPayPeriodsInPayMonth = (
  payDateIso: string,
  payFrequency: TLPayFrequency
): number | undefined => {
  if (!payDateIso) return undefined;
  if (payFrequency !== "weekly" && payFrequency !== "biweekly") return undefined;

  const intervalDays = payFrequency === "weekly" ? 7 : 14;
  const payDate = new Date(`${payDateIso}T00:00:00`);
  if (Number.isNaN(payDate.getTime())) return undefined;

  const targetYear = payDate.getFullYear();
  const targetMonth = payDate.getMonth();

  // Walk backwards to find the first pay date in the month for this cadence.
  let cursor = new Date(payDate);
  while (true) {
    const previous = new Date(cursor);
    previous.setDate(previous.getDate() - intervalDays);
    if (previous.getFullYear() !== targetYear || previous.getMonth() !== targetMonth) break;
    cursor = previous;
  }

  // Count pay dates forward within the same month.
  let count = 0;
  const iter = new Date(cursor);
  while (iter.getFullYear() === targetYear && iter.getMonth() === targetMonth) {
    count += 1;
    iter.setDate(iter.getDate() + intervalDays);
  }

  return count > 0 ? count : undefined;
};

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

    setPeriodStart(firstDay.toISOString().split("T")[0]);
    setPeriodEnd(lastDay.toISOString().split("T")[0]);
    setPayDate(payDay.toISOString().split("T")[0]);
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
   * Extracted to avoid code duplication and enable inline calculation.
   */
  const calculateForEmployee = useCallback((data: EmployeePayrollData): TLPayrollResult | null => {
    const monthlySalary = data.employee.compensation.monthlySalary || 0;
    const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
    const hourlyRate = monthlySalary / monthlyHours;
    const asOfDate = payDate ? new Date(`${payDate}T00:00:00`) : new Date();
    const monthsWorkedThisYear = asOfDate.getMonth() + 1;
	    const hireDate = data.employee.jobDetails.hireDate || new Date().toISOString().split('T')[0];
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
  // Uses sumMoney for precise currency arithmetic (avoids floating-point drift)
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
      const totalDailyHoursEquiv = (d.regularHours + d.overtimeHours + d.nightShiftHours) / 22; // ~22 working days
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
      const hireDate = data.employee.jobDetails.hireDate || new Date().toISOString().split('T')[0];
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

  // Helper: build PayrollRun object (avoids duplication between save/process)
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
      if (value < 0 || value > 744) return; // Max hours in a month (31 * 24)
    }
    if (moneyFields.includes(field)) {
      if (value < 0 || value > 100000) return; // Reasonable cap
    }

    setEmployeePayrollData((prev) =>
      prev.map((d) => {
        if (d.employee.id !== employeeId) return d;

        const updated = { ...d, [field]: value };

        // Check if any value differs from original
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

  // Format pay period
  const formatPayPeriod = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  // Format pay date nicely
  const formatPayDate = (date: string): string => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const includedData = getIncludedData();

      // Validate all employees before saving
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

      // SEC-6: Date range validation — limit to reasonable bounds
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1).toISOString().split("T")[0];
      const oneMonthAhead = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
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

      // CALC-5: Validate all employee inputs before processing
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

      // Navigate to history/success page
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

        {/* ════════════════════════════════════════════════════════════════
            PAY PERIOD BANNER - Critical info, must be prominent
        ════════════════════════════════════════════════════════════════ */}
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

        {/* Compliance Notice - Shows when employees need documents */}
        {hasComplianceIssues && (
          <Card className="mb-6 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 animate-fade-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                {complianceIssues.length} Employee{complianceIssues.length > 1 ? "s" : ""} Need Documents
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                These employees need contracts or INSS numbers. You can still run payroll and add documents later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Issue List */}
              <div className="space-y-2">
                {complianceIssues.slice(0, showAllCompliance ? undefined : 5).map(({ employee, issues }) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-background border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={excludedEmployees.has(employee.id || "")}
                        onCheckedChange={(checked) => {
                          const newExcluded = new Set(excludedEmployees);
                          if (checked) {
                            newExcluded.add(employee.id || "");
                          } else {
                            newExcluded.delete(employee.id || "");
                          }
                          setExcludedEmployees(newExcluded);
                        }}
                        className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      />
                      <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {employee.personalInfo.firstName[0]}{employee.personalInfo.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {issues.join(", ")}
                        </p>
                      </div>
                    </div>
                    <Badge className={
                      excludedEmployees.has(employee.id || "")
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs"
                        : "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 text-xs"
                    }>
                      {excludedEmployees.has(employee.id || "") ? "Excluded" : "Included"}
                    </Badge>
                  </div>
                ))}
                {complianceIssues.length > 5 && !showAllCompliance && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCompliance(true)}
                    className="w-full text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/20 h-8"
                  >
                    Show {complianceIssues.length - 5} more employee{complianceIssues.length - 5 > 1 ? "s" : ""}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {showAllCompliance && complianceIssues.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCompliance(false)}
                    className="w-full text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/20 h-8"
                  >
                    Show less
                    <ChevronDown className="h-3 w-3 ml-1 rotate-180" />
                  </Button>
                )}
              </div>

              {/* Override Acknowledgment */}
              {excludedEmployees.size < complianceIssues.length && (
                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/20">
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => setComplianceAcknowledged(!complianceAcknowledged)}>
                    <Checkbox
                      checked={complianceAcknowledged}
                      onCheckedChange={(checked) => setComplianceAcknowledged(!!checked)}
                      className="mt-0.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      I understand these employees need documents for full compliance.
                      I will add the missing contracts/INSS numbers within 30 days.
                    </span>
                  </div>
                  {complianceAcknowledged && (
                    <div className="mt-3">
                      <Label className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Reason for proceeding (required for audit trail)
                      </Label>
                      <Input
                        value={complianceOverrideReason}
                        onChange={(e) => setComplianceOverrideReason(e.target.value)}
                        placeholder="e.g., INSS office closed, waiting for contract from legal..."
                        className="mt-1 text-sm border-amber-300 border-border/50"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-200 dark:border-amber-800">
                <span className="text-amber-700 dark:text-amber-400">
                  {employees.length - excludedEmployees.size} of {employees.length} employees will be included in payroll
                </span>
                {excludedEmployees.size > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setExcludedEmployees(new Set())}
                    className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 h-auto p-0"
                  >
                    Include all
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Period Settings */}
        <Card className="mb-6 border-border/50 animate-fade-up stagger-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <Calculator className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              Pay Period Configuration
            </CardTitle>
            <CardDescription>
              Configure the payroll period and pay date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay-frequency" className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Pay Frequency
                </Label>
                <Select
                  value={payFrequency}
                  onValueChange={(v) => setPayFrequency(v as TLPayFrequency)}
                >
                  <SelectTrigger className="border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">
                      {TL_PAY_PERIODS.weekly.label} (Weekly)
                    </SelectItem>
                    <SelectItem value="biweekly">
                      {TL_PAY_PERIODS.biweekly.label} (Bi-Weekly)
                    </SelectItem>
                    <SelectItem value="monthly">
                      {TL_PAY_PERIODS.monthly.label} (Monthly)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-start" className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Period Start
                </Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end" className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Period End
                </Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-date" className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Pay Date
                </Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="border-border/50"
                />
              </div>
              <div className="md:col-span-4 pt-2">
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => setIncludeSubsidioAnual(!includeSubsidioAnual)}>
                  <Checkbox
                    checked={includeSubsidioAnual}
                    onCheckedChange={(checked) => setIncludeSubsidioAnual(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <div className="text-sm">
                    Include Subsidio Anual (13th month) in this run
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adds a pro-rated 13th month salary and includes it in WIT and INSS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="animate-fade-up stagger-2">
          <PayrollSummaryCards totals={totals} employeeCount={employees.length} />
        </div>

        {/* Tax Summary Card */}
        <div className="animate-fade-up stagger-3">
          <TaxSummaryCard totals={totals} />
        </div>

        {/* Payroll Warnings - Minimum wage and hours violations */}
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

        {/* ════════════════════════════════════════════════════════════════
            EMPLOYEE PAYROLL TABLE - With edit indicators
        ════════════════════════════════════════════════════════════════ */}
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

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>

      {/* Save Draft Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <Save className="h-4 w-4 text-green-600" />
              </div>
              Save Payroll Draft
            </DialogTitle>
            <DialogDescription>
              Save the current payroll as a draft. You can edit and process it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="font-semibold text-sm mt-0.5">
                  {periodStart && periodEnd
                    ? formatPayPeriod(periodStart, periodEnd)
                    : "Not set"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">Employees</p>
                <p className="font-semibold text-sm mt-0.5">{employees.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">Total Gross</p>
                <p className="font-semibold text-sm mt-0.5">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                <p className="text-xs text-muted-foreground">Total Net</p>
                <p className="font-semibold text-sm text-emerald-600 mt-0.5">{formatCurrencyTL(totals.netPay)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDraft} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          APPROVE DIALOG - First step: Review summary
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              {t("runPayroll.reviewTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("runPayroll.reviewDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Period highlight */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">{t("runPayroll.payPeriod")}</span>
              </div>
              <p className="font-semibold text-lg">
                {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : "Not set"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("runPayroll.payDateLabel")} {payDate ? formatPayDate(payDate) : "Not set"}
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t("runPayroll.employees")}</p>
                <p className="text-lg font-bold tracking-tight">{employees.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">{t("runPayroll.totalGross")}</p>
                <p className="text-lg font-bold tracking-tight">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-500/10">
                <p className="text-xs text-muted-foreground">{t("runPayroll.totalDeductions")}</p>
                <p className="text-lg font-bold tracking-tight text-red-600">{formatCurrencyTL(totals.totalDeductions)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-500/10">
                <p className="text-xs text-muted-foreground">{t("runPayroll.netToEmployees")}</p>
                <p className="text-lg font-bold tracking-tight text-emerald-600">{formatCurrencyTL(totals.netPay)}</p>
              </div>
            </div>

            {/* Total employer cost */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10 border border-amber-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("runPayroll.totalEmployerCost")}</p>
                  <p className="text-[10px] text-muted-foreground/60">{t("runPayroll.employerCostHint")}</p>
                </div>
                <p className="text-lg font-bold tracking-tight text-amber-600">{formatCurrencyTL(totals.totalEmployerCost)}</p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              {t("runPayroll.backToEdit")}
            </Button>
            <Button
              onClick={() => {
                setShowApproveDialog(false);
                setShowFinalConfirmDialog(true);
              }}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25"
            >
              {t("runPayroll.continueToConfirm")}
              <ChevronDown className="h-4 w-4 ml-2 rotate-[-90deg]" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
          FINAL CONFIRM DIALOG - Point of no return
      ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showFinalConfirmDialog} onOpenChange={setShowFinalConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-amber-700 dark:text-amber-400">{t("runPayroll.submitForApprovalTitle")}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Warning banner */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <p className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                {t("runPayroll.aboutToSubmit", { count: String(employees.length) })}
              </p>
              <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <div className="flex justify-between">
                  <span>{t("runPayroll.payDateLabel")}</span>
                  <span className="font-medium">{payDate ? formatPayDate(payDate) : "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("runPayroll.totalNetPay")}</span>
                  <span className="font-medium">{formatCurrencyTL(totals.netPay)}</span>
                </div>
              </div>
            </div>

            {/* Consequences */}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                {t("runPayroll.thisActionWill")}
              </p>
              <ul className="space-y-1.5 text-sm text-amber-700 dark:text-amber-300">
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
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowFinalConfirmDialog(false);
                setShowApproveDialog(true);
              }}
            >
              {t("runPayroll.back")}
            </Button>
            <Button
              onClick={handleProcessPayroll}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/25"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
