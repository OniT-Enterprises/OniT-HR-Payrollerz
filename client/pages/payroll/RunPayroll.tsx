/**
 * Run Payroll Page - Timor-Leste Version
 * Uses TL tax law (10% above $500) and INSS (4% + 6%)
 *
 * UX Principle: "Point of no return" - treat this page with seriousness
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator,
  DollarSign,
  Users,
  FileText,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Building,
  Lock,
  Calendar,
  Eye,
  RotateCcw,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { employeeService, Employee } from "@/services/employeeService";
import { payrollService } from "@/services/payrollService";
import {
  calculateTLPayroll,
  type TLPayrollInput,
  type TLPayrollResult,
} from "@/lib/payroll/calculations-tl";
import {
  formatCurrencyTL,
  TL_PAY_PERIODS,
  TL_PAYROLL_STATUS_CONFIG,
  TL_WORKING_HOURS,
  TL_OVERTIME_RATES,
  TL_DEDUCTION_TYPE_LABELS,
  TL_EARNING_TYPE_LABELS,
  TL_INSS,
  TL_INCOME_TAX,
} from "@/lib/payroll/constants-tl";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import { SEO, seoConfig } from "@/components/SEO";

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

export default function RunPayroll() {
  const navigate = useNavigate();
  const { toast } = useToast();
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

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);

  // Compliance states - for NGO "run anyway" scenarios
  const [excludedEmployees, setExcludedEmployees] = useState<Set<string>>(new Set());
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");

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
        const data = await employeeService.getAllEmployees();
        const activeEmployees = data.filter((e) => e.status === "active");
        setEmployees(activeEmployees);

        // Initialize payroll data for each employee
        // TL standard: 44 hours/week = ~190.67 hours/month (44 * 52/12)
        const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
        const defaultHours = payFrequency === "monthly" ? monthlyHours : monthlyHours / 2;

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
  }, [toast, payFrequency]);

  // Recalculate payroll whenever inputs change
  useEffect(() => {
    if (employeePayrollData.length === 0) return;

    const updatedData = employeePayrollData.map((data) => {
      const monthlySalary = data.employee.compensation.monthlySalary || 0;
      const monthlyHours = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;
      const hourlyRate = monthlySalary / monthlyHours;

      const input: TLPayrollInput = {
        employeeId: data.employee.id || "",
        monthlySalary,
        payFrequency,
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
        taxInfo: {
          isResident: true,
          hasTaxExemption: false,
        },
        loanRepayment: 0,
        advanceRepayment: 0,
        courtOrders: 0,
        otherDeductions: 0,
        ytdGrossPay: 0,
        ytdIncomeTax: 0,
        ytdINSSEmployee: 0,
        monthsWorkedThisYear: new Date().getMonth() + 1,
        hireDate: data.employee.jobDetails.hireDate || new Date().toISOString().split('T')[0],
      };

      try {
        const calculation = calculateTLPayroll(input);
        return { ...data, calculation };
      } catch (error) {
        console.error("Calculation error for employee:", data.employee.id, error);
        return { ...data, calculation: null };
      }
    });

    // Only update if calculations changed
    const hasChanges = updatedData.some(
      (item, i) =>
        item.calculation?.grossPay !== employeePayrollData[i].calculation?.grossPay ||
        item.calculation?.netPay !== employeePayrollData[i].calculation?.netPay
    );

    if (hasChanges) {
      setEmployeePayrollData(updatedData);
    }
  }, [
    employeePayrollData
      .map(
        (d) =>
          `${d.regularHours}-${d.overtimeHours}-${d.nightShiftHours}-${d.bonus}-${d.perDiem}`
      )
      .join(","),
    payFrequency,
  ]);

  // Detect employees with compliance issues (for NGO "run anyway" scenarios)
  const complianceIssues = useMemo(() => {
    return employees.map(emp => {
      const issues: string[] = [];
      if (!emp.documents?.workContract?.fileUrl) issues.push("Missing contract");
      if (!emp.documents?.socialSecurityNumber?.number) issues.push("Missing INSS");
      return { employee: emp, issues };
    }).filter(item => item.issues.length > 0);
  }, [employees]);

  const hasComplianceIssues = complianceIssues.length > 0;

  // Calculate totals (excluding excluded employees)
  const totals = useMemo(() => {
    return employeePayrollData
      .filter(data => !excludedEmployees.has(data.employee.id || ""))
      .reduce(
        (acc, data) => {
          if (!data.calculation) return acc;
          return {
            grossPay: acc.grossPay + data.calculation.grossPay,
            totalDeductions: acc.totalDeductions + data.calculation.totalDeductions,
            netPay: acc.netPay + data.calculation.netPay,
            incomeTax: acc.incomeTax + data.calculation.incomeTax,
            inssEmployee: acc.inssEmployee + data.calculation.inssEmployee,
            inssEmployer: acc.inssEmployer + data.calculation.inssEmployer,
            totalEmployerCost: acc.totalEmployerCost + data.calculation.totalEmployerCost,
          };
        },
        {
          grossPay: 0,
          totalDeductions: 0,
          netPay: 0,
          incomeTax: 0,
          inssEmployee: 0,
          inssEmployer: 0,
          totalEmployerCost: 0,
        }
      );
  }, [employeePayrollData, excludedEmployees]);

  // Count edited rows
  const editedCount = useMemo(() => {
    return employeePayrollData.filter((d) => d.isEdited).length;
  }, [employeePayrollData]);

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

  // Handle input changes with edit tracking
  const handleInputChange = (
    employeeId: string,
    field: keyof EmployeePayrollData,
    value: number
  ) => {
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

        return { ...updated, isEdited };
      })
    );
  };

  // Reset row to original values
  const handleResetRow = (employeeId: string) => {
    setEmployeePayrollData((prev) =>
      prev.map((d) => {
        if (d.employee.id !== employeeId) return d;
        return {
          ...d,
          regularHours: d.originalValues.regularHours,
          overtimeHours: d.originalValues.overtimeHours,
          nightShiftHours: d.originalValues.nightShiftHours,
          bonus: d.originalValues.bonus,
          perDiem: d.originalValues.perDiem,
          allowances: d.originalValues.allowances,
          isEdited: false,
        };
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
      const payrollRun: Omit<PayrollRun, "id"> = {
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
        employeeCount: employeePayrollData.length,
        createdBy: "current-user",
        notes: "",
      };

      const runId = await payrollService.runs.createPayrollRun(payrollRun);

      // Create individual payroll records
      const records: Omit<PayrollRecord, "id">[] = employeePayrollData
        .filter((d) => d.calculation)
        .map((d) => ({
          payrollRunId: runId,
          employeeId: d.employee.id || "",
          employeeName: `${d.employee.personalInfo.firstName} ${d.employee.personalInfo.lastName}`,
          employeeNumber: d.employee.jobDetails.employeeId,
          department: d.employee.jobDetails.department,
          position: d.employee.jobDetails.position,
          regularHours: d.regularHours,
          overtimeHours: d.overtimeHours,
          doubleTimeHours: d.holidayHours,
          holidayHours: d.holidayHours,
          ptoHoursUsed: 0,
          sickHoursUsed: d.sickDays * 8,
          hourlyRate: d.calculation!.regularPay / d.regularHours,
          overtimeRate: TL_OVERTIME_RATES.standard,
          earnings: [
            {
              type: "regular" as const,
              description: TL_EARNING_TYPE_LABELS.regular.en,
              amount: d.calculation!.regularPay,
            },
            ...(d.calculation!.overtimePay > 0
              ? [
                  {
                    type: "overtime" as const,
                    description: TL_EARNING_TYPE_LABELS.overtime.en,
                    hours: d.overtimeHours,
                    amount: d.calculation!.overtimePay,
                  },
                ]
              : []),
            ...(d.calculation!.nightShiftPay > 0
              ? [
                  {
                    type: "other" as const,
                    description: TL_EARNING_TYPE_LABELS.night_shift.en,
                    amount: d.calculation!.nightShiftPay,
                  },
                ]
              : []),
            ...(d.bonus > 0
              ? [
                  {
                    type: "bonus" as const,
                    description: TL_EARNING_TYPE_LABELS.bonus.en,
                    amount: d.bonus,
                  },
                ]
              : []),
            ...(d.perDiem > 0
              ? [
                  {
                    type: "other" as const,
                    description: TL_EARNING_TYPE_LABELS.per_diem.en,
                    amount: d.perDiem,
                  },
                ]
              : []),
          ],
          totalGrossPay: d.calculation!.grossPay,
          deductions: [
            {
              type: "federal_tax" as const,
              description: TL_DEDUCTION_TYPE_LABELS.income_tax.en,
              amount: d.calculation!.incomeTax,
              isPreTax: false,
              isPercentage: false,
            },
            {
              type: "social_security" as const,
              description: TL_DEDUCTION_TYPE_LABELS.inss_employee.en,
              amount: d.calculation!.inssEmployee,
              isPreTax: false,
              isPercentage: false,
            },
          ],
          totalDeductions: d.calculation!.totalDeductions,
          employerContributions: [],
          totalEmployerContributions: 0,
          employerTaxes: [
            {
              type: "social_security" as const,
              description: TL_DEDUCTION_TYPE_LABELS.inss_employer.en,
              amount: d.calculation!.inssEmployer,
            },
          ],
          totalEmployerTaxes: d.calculation!.inssEmployer,
          netPay: d.calculation!.netPay,
          totalEmployerCost: d.calculation!.totalEmployerCost,
          ytdGrossPay: 0,
          ytdNetPay: 0,
          ytdFederalTax: 0,
          ytdStateTax: 0,
          ytdSocialSecurity: 0,
          ytdMedicare: 0,
        }));

      await payrollService.records.createPayrollRecordsBatch(records);

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
      // In a real app, this would:
      // 1. Lock the payroll data
      // 2. Generate payslips
      // 3. Create accounting entries
      // 4. Trigger bank transfers

      // For now, show a success message
      toast({
        title: "Payroll Processed",
        description: `Payroll for ${employees.length} employees has been processed successfully.`,
      });

      setShowFinalConfirmDialog(false);
      setShowApproveDialog(false);

      // Navigate to history/success page
      navigate("/payroll/history");
    } catch (error) {
      console.error("Failed to process payroll:", error);
      toast({
        title: "Error",
        description: "Failed to process payroll. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
              </div>
            </div>

            {/* Period Banner Skeleton */}
            <Skeleton className="h-20 w-full mb-6 rounded-lg" />

            {/* Summary Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-28" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tax Summary Skeleton */}
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Employee Table Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-44 mb-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Run Payroll
                </h1>
                <p className="text-muted-foreground mt-1">
                  Process payroll for {employees.length} active employees
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/payroll")}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={() => setShowApproveDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Process
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ════════════════════════════════════════════════════════════════
            PAY PERIOD BANNER - Critical info, must be prominent
        ════════════════════════════════════════════════════════════════ */}
        <Card className="mb-6 border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
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
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Timor-Leste Tax Rates
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Income Tax: {(TL_INCOME_TAX.rate * 100).toFixed(0)}% (above $
                  {TL_INCOME_TAX.residentThreshold}/month for residents) • INSS Employee:{" "}
                  {(TL_INSS.employeeRate * 100).toFixed(0)}% • INSS Employer:{" "}
                  {(TL_INSS.employerRate * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Warning Banner - Shows when employees have issues */}
        {hasComplianceIssues && (
          <Card className="mb-6 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                {complianceIssues.length} Employee{complianceIssues.length > 1 ? "s" : ""} with Compliance Issues
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-400">
                The following employees have missing documents that may affect compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Issue List */}
              <div className="space-y-2">
                {complianceIssues.slice(0, 5).map(({ employee, issues }) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-background border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={excludedEmployees.has(employee.id || "")}
                        onChange={(e) => {
                          const newExcluded = new Set(excludedEmployees);
                          if (e.target.checked) {
                            newExcluded.add(employee.id || "");
                          } else {
                            newExcluded.delete(employee.id || "");
                          }
                          setExcludedEmployees(newExcluded);
                        }}
                        className="h-4 w-4 rounded border-amber-400"
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {issues.join(", ")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-700 border-amber-400">
                      {excludedEmployees.has(employee.id || "") ? "Excluded" : "Included"}
                    </Badge>
                  </div>
                ))}
                {complianceIssues.length > 5 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ... and {complianceIssues.length - 5} more
                  </p>
                )}
              </div>

              {/* Override Acknowledgment */}
              {excludedEmployees.size < complianceIssues.length && (
                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/20">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={complianceAcknowledged}
                      onChange={(e) => setComplianceAcknowledged(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-400"
                    />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      I acknowledge that including employees with compliance issues may affect
                      INSS submissions and audit compliance. I will resolve these issues within 30 days.
                    </span>
                  </label>
                  {complianceAcknowledged && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Reason for proceeding (required for audit trail)
                      </label>
                      <Input
                        value={complianceOverrideReason}
                        onChange={(e) => setComplianceOverrideReason(e.target.value)}
                        placeholder="e.g., INSS office closed, waiting for contract from legal..."
                        className="mt-1 text-sm border-amber-300"
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
                  <button
                    onClick={() => setExcludedEmployees(new Set())}
                    className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 underline"
                  >
                    Include all
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Period Settings */}
        <Card className="mb-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600 dark:text-green-400" />
              Pay Period Configuration
            </CardTitle>
            <CardDescription>
              Configure the payroll period and pay date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="pay-frequency">Pay Frequency</Label>
                <Select
                  value={payFrequency}
                  onValueChange={(v) => setPayFrequency(v as TLPayFrequency)}
                >
                  <SelectTrigger>
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
              <div>
                <Label htmlFor="period-start">Period Start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="period-end">Period End</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pay-date">Pay Date</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            SUMMARY CARDS - With micro-labels for clarity
        ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Gross
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Before tax & INSS
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrencyTL(totals.grossPay)}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Employee Deductions
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Tax + INSS (4%)
                  </p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {formatCurrencyTL(totals.totalDeductions)}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Net Pay to Employees
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Take-home pay
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {formatCurrencyTL(totals.netPay)}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Employees
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Active in payroll
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {employees.length}
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAX SUMMARY - With lock indicators (system-calculated)
        ════════════════════════════════════════════════════════════════ */}
        <Card className="mb-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              Tax & INSS Summary
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                <Lock className="h-3 w-3 mr-1" />
                System calculated
              </Badge>
            </CardTitle>
            <CardDescription>Income tax and social security contributions (read-only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative">
                <Lock className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {TL_DEDUCTION_TYPE_LABELS.income_tax.tl}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Income Tax (10%)
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrencyTL(totals.incomeTax)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative">
                <Lock className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {TL_DEDUCTION_TYPE_LABELS.inss_employee.tl}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  INSS Employee (4%)
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrencyTL(totals.inssEmployee)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg relative">
                <Lock className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {TL_DEDUCTION_TYPE_LABELS.inss_employer.tl}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  INSS Employer (6%)
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrencyTL(totals.inssEmployer)}
                </p>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg relative">
                <Lock className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Employer Cost
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Gross + INSS Employer
                </p>
                <p className="text-lg font-semibold text-emerald-600">
                  {formatCurrencyTL(totals.totalEmployerCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            EMPLOYEE PAYROLL TABLE - With edit indicators
        ════════════════════════════════════════════════════════════════ */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Employee Payroll
                  {editedCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs ml-2">
                      {editedCount} row{editedCount > 1 ? "s" : ""} modified
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
                  onClick={() => toast({
                    title: "Preview Payslips",
                    description: "Payslip preview coming soon.",
                  })}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Payslips
                </Button>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Night</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((data) => (
                    <React.Fragment key={data.employee.id}>
                      <TableRow
                        className={`cursor-pointer transition-colors ${
                          data.isEdited
                            ? "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                        onClick={() => toggleRowExpansion(data.employee.id || "")}
                      >
                        <TableCell>
                          {expandedRows.has(data.employee.id || "") ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {data.isEdited && (
                              <div className="h-2 w-2 rounded-full bg-amber-500" title="Modified" />
                            )}
                            <div>
                              <p className="font-medium">
                                {data.employee.personalInfo.firstName}{" "}
                                {data.employee.personalInfo.lastName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {data.employee.jobDetails.employeeId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{data.employee.jobDetails.department}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={data.regularHours}
                            onChange={(e) =>
                              handleInputChange(
                                data.employee.id || "",
                                "regularHours",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-20 text-right ${
                              data.regularHours !== data.originalValues.regularHours
                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                : ""
                            }`}
                            min={0}
                            step={0.5}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={data.overtimeHours}
                            onChange={(e) =>
                              handleInputChange(
                                data.employee.id || "",
                                "overtimeHours",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-16 text-right ${
                              data.overtimeHours !== data.originalValues.overtimeHours
                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                : ""
                            }`}
                            min={0}
                            step={0.5}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={data.nightShiftHours}
                            onChange={(e) =>
                              handleInputChange(
                                data.employee.id || "",
                                "nightShiftHours",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-16 text-right ${
                              data.nightShiftHours !== data.originalValues.nightShiftHours
                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                : ""
                            }`}
                            min={0}
                            step={0.5}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={data.bonus}
                            onChange={(e) =>
                              handleInputChange(
                                data.employee.id || "",
                                "bonus",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={`w-24 text-right ${
                              data.bonus !== data.originalValues.bonus
                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30"
                                : ""
                            }`}
                            min={0}
                            step={50}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {data.calculation
                            ? formatCurrencyTL(data.calculation.grossPay)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {data.calculation
                            ? formatCurrencyTL(data.calculation.totalDeductions)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {data.calculation
                            ? formatCurrencyTL(data.calculation.netPay)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {data.isEdited && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Reset to original"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetRow(data.employee.id || "");
                              }}
                            >
                              <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded details row */}
                      {expandedRows.has(data.employee.id || "") && data.calculation && (
                        <TableRow className="bg-gray-50 dark:bg-gray-800">
                          <TableCell colSpan={11}>
                            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Regular Pay
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.regularPay)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Overtime Pay
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.overtimePay)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Night Shift
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.nightShiftPay)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Income Tax
                                </p>
                                <p className="font-medium text-red-600">
                                  -{formatCurrencyTL(data.calculation.incomeTax)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  INSS (4%)
                                </p>
                                <p className="font-medium text-red-600">
                                  -{formatCurrencyTL(data.calculation.inssEmployee)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  INSS Employer (6%)
                                </p>
                                <p className="font-medium text-amber-600">
                                  {formatCurrencyTL(data.calculation.inssEmployer)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Employer Cost
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.totalEmployerCost)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Taxable Income
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.taxableIncome)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  INSS Base
                                </p>
                                <p className="font-medium">
                                  {formatCurrencyTL(data.calculation.inssBase)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredData.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No employees found matching your search.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save Draft Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Payroll Draft</DialogTitle>
            <DialogDescription>
              Save the current payroll as a draft. You can edit and process it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="font-medium">
                  {periodStart && periodEnd
                    ? formatPayPeriod(periodStart, periodEnd)
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Employees</p>
                <p className="font-medium">{employees.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Gross</p>
                <p className="font-medium">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Net</p>
                <p className="font-medium">{formatCurrencyTL(totals.netPay)}</p>
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
              <CheckCircle className="h-5 w-5 text-green-600" />
              Review Payroll
            </DialogTitle>
            <DialogDescription>
              Review the payroll summary before processing.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Period highlight */}
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Pay Period</span>
              </div>
              <p className="font-semibold text-lg">
                {periodStart && periodEnd ? formatPayPeriod(periodStart, periodEnd) : "Not set"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Pay date: {payDate ? formatPayDate(payDate) : "Not set"}
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Employees</p>
                <p className="text-lg font-semibold">{employees.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Gross</p>
                <p className="text-lg font-semibold">{formatCurrencyTL(totals.grossPay)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Deductions</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrencyTL(totals.totalDeductions)}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-xs text-muted-foreground">Net to Employees</p>
                <p className="text-lg font-semibold text-emerald-600">{formatCurrencyTL(totals.netPay)}</p>
              </div>
            </div>

            {editedCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Pencil className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  {editedCount} employee{editedCount > 1 ? "s" : ""} have been manually adjusted
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Back to Edit
            </Button>
            <Button
              onClick={() => {
                setShowApproveDialog(false);
                setShowFinalConfirmDialog(true);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue to Confirm
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
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Confirm Payroll Processing
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Warning banner */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <p className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
                You are about to process payroll for {employees.length} employees
              </p>
              <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <div className="flex justify-between">
                  <span>Pay date:</span>
                  <span className="font-medium">{payDate ? formatPayDate(payDate) : "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total net pay:</span>
                  <span className="font-medium">{formatCurrencyTL(totals.netPay)}</span>
                </div>
              </div>
            </div>

            {/* Consequences */}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-red-800 dark:text-red-200 mb-2">
                This action will:
              </p>
              <ul className="space-y-1.5 text-sm text-red-700 dark:text-red-300">
                <li className="flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Lock payroll data for this period
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Generate payslips for all employees
                </li>
                <li className="flex items-start gap-2">
                  <Calculator className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Create accounting journal entries
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="font-semibold">Cannot be undone</span>
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
              Back
            </Button>
            <Button
              onClick={handleProcessPayroll}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Run Payroll
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
