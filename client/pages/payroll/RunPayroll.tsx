/**
 * Run Payroll Page - Timor-Leste Version
 * Uses TL tax law (10% above $500) and INSS (4% + 6%)
 */

import React, { useState, useEffect, useMemo } from "react";
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
}

export default function RunPayroll() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        const initialData: EmployeePayrollData[] = activeEmployees.map((emp) => ({
          employee: emp,
          regularHours: payFrequency === "monthly" ? monthlyHours : monthlyHours / 2,
          overtimeHours: 0,
          nightShiftHours: 0,
          holidayHours: 0,
          sickDays: 0,
          perDiem: 0,
          bonus: 0,
          allowances: 0,
          calculation: null,
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

  // Calculate totals
  const totals = useMemo(() => {
    return employeePayrollData.reduce(
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

  // Handle input changes
  const handleInputChange = (
    employeeId: string,
    field: keyof EmployeePayrollData,
    value: number
  ) => {
    setEmployeePayrollData((prev) =>
      prev.map((d) =>
        d.employee.id === employeeId ? { ...d, [field]: value } : d
      )
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
    })} - ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
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

            {/* Info Banner Skeleton */}
            <Skeleton className="h-16 w-full mb-6 rounded-lg" />

            {/* Period Settings Skeleton */}
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-56 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 rounded-lg bg-muted/50">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Employee Table Skeleton */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-44 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-10 w-64" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-4" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainNavigation />

      <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calculator className="h-8 w-8 text-emerald-500" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Prosesa Saláriu
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Process payroll for {employees.length} active employees
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Rai Rascunhu
                </Button>
                <Button onClick={() => setShowApproveDialog(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprova & Prosesa
                </Button>
              </div>
            </div>
          </div>

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

          {/* Period Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Konfigurasaun Períodu Pagamentu</CardTitle>
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
              {periodStart && periodEnd && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Processing payroll for:{" "}
                  <strong>{formatPayPeriod(periodStart, periodEnd)}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Gross
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrencyTL(totals.grossPay)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Deductions
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrencyTL(totals.totalDeductions)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Net Pay
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrencyTL(totals.netPay)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Employees
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {employees.length}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tax Summary - TL Version */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sumáriu Impostu no INSS</CardTitle>
              <CardDescription>Tax and Social Security Summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
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

          {/* Employee Payroll Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Saláriu Empregadu Sira</CardTitle>
                  <CardDescription>
                    Adjust hours and additional pay for each employee
                  </CardDescription>
                </div>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((data) => (
                      <React.Fragment key={data.employee.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
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
                            <div>
                              <p className="font-medium">
                                {data.employee.personalInfo.firstName}{" "}
                                {data.employee.personalInfo.lastName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {data.employee.jobDetails.employeeId}
                              </p>
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
                              className="w-20 text-right"
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
                              className="w-16 text-right"
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
                              className="w-16 text-right"
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
                              className="w-24 text-right"
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
                        </TableRow>

                        {/* Expanded details row */}
                        {expandedRows.has(data.employee.id || "") && data.calculation && (
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableCell colSpan={10}>
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
                                    Impostu Rendimentu
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
      </div>

      {/* Save Draft Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rai Rascunhu Saláriu</DialogTitle>
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
                  Rai Rascunhu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprova & Prosesa Saláriu</DialogTitle>
            <DialogDescription>
              This will finalize the payroll and prepare it for payment. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Please Review
                  </p>
                  <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>Total Net Pay: {formatCurrencyTL(totals.netPay)}</li>
                    <li>Employees: {employees.length}</li>
                    <li>Pay Date: {payDate}</li>
                    <li>Total INSS (Employee + Employer): {formatCurrencyTL(totals.inssEmployee + totals.inssEmployer)}</li>
                    <li>Total Income Tax: {formatCurrencyTL(totals.incomeTax)}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Payroll approval workflow is being implemented.",
                });
                setShowApproveDialog(false);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprova Saláriu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
