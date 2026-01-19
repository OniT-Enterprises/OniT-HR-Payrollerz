/**
 * Employee Allowances - Timor-Leste focused
 * Manages transport, housing, meal, phone, and other allowances
 * Common in TL businesses instead of US-style benefits
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
import {
  Wallet,
  Plus,
  Users,
  DollarSign,
  Search,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Car,
  Home,
  Utensils,
  Phone,
  MapPin,
  GraduationCap,
  Shirt,
  Briefcase,
  Fuel,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { employeeService, Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { payrollService } from "@/services/payrollService";
import { formatCurrency } from "@/lib/payroll/constants";
import type { BenefitEnrollment } from "@/types/payroll";
import { SEO } from "@/components/SEO";

// TL-relevant allowance types
const ALLOWANCE_TYPES = [
  { value: "transport", label: "Transport", icon: Car, description: "Daily commute costs" },
  { value: "fuel", label: "Fuel", icon: Fuel, description: "Vehicle fuel allowance" },
  { value: "housing", label: "Housing", icon: Home, description: "Rent or accommodation" },
  { value: "meal", label: "Meal", icon: Utensils, description: "Daily meal subsidy" },
  { value: "phone", label: "Phone/Data", icon: Phone, description: "Mobile & internet" },
  { value: "hardship", label: "Hardship", icon: MapPin, description: "Remote area posting" },
  { value: "education", label: "Education", icon: GraduationCap, description: "Training & courses" },
  { value: "uniform", label: "Uniform", icon: Shirt, description: "Work clothing" },
  { value: "other", label: "Other", icon: Briefcase, description: "Other allowances" },
];

// Common allowance amounts in TL (in USD)
const SUGGESTED_AMOUNTS: Record<string, { low: number; typical: number; high: number }> = {
  transport: { low: 50, typical: 100, high: 200 },
  fuel: { low: 75, typical: 150, high: 300 },
  housing: { low: 100, typical: 250, high: 500 },
  meal: { low: 50, typical: 100, high: 150 },
  phone: { low: 20, typical: 50, high: 100 },
  hardship: { low: 100, typical: 200, high: 400 },
  education: { low: 50, typical: 100, high: 200 },
  uniform: { low: 25, typical: 50, high: 100 },
  other: { low: 50, typical: 100, high: 200 },
};

export default function EmployeeAllowances() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [allowances, setAllowances] = useState<BenefitEnrollment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [allowanceType, setAllowanceType] = useState("");
  const [amount, setAmount] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!tenantId) return;
      try {
        setLoading(true);
        const [enrollmentData, employeeData] = await Promise.all([
          payrollService.benefits.getAllEnrollments(tenantId),
          employeeService.getAllEmployees(tenantId),
        ]);
        setAllowances(enrollmentData);
        setEmployees(employeeData.filter((e) => e.status === "active"));
      } catch (error) {
        console.error("Failed to load data:", error);
        toast({
          title: "Error",
          description: "Failed to load allowances data. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast, tenantId]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = allowances.filter((e) => e.status === "active");
    const totalMonthly = active.reduce((sum, e) => sum + e.employerContribution, 0);
    const employeesWithAllowances = new Set(active.map((e) => e.employeeId)).size;

    // Count by type
    const byType: Record<string, number> = {};
    active.forEach((a) => {
      byType[a.benefitType] = (byType[a.benefitType] || 0) + a.employerContribution;
    });

    return {
      totalAllowances: active.length,
      employeesWithAllowances,
      totalMonthly,
      byType,
    };
  }, [allowances]);

  // Filter allowances
  const filteredAllowances = useMemo(() => {
    return allowances.filter((allowance) => {
      if (filterType !== "all" && allowance.benefitType !== filterType) {
        return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const employee = employees.find((e) => e.id === allowance.employeeId);
        if (employee) {
          const name = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.toLowerCase();
          if (!name.includes(term)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allowances, filterType, searchTerm, employees]);

  // Get employee name
  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    }
    return "Unknown";
  };

  // Get allowance type config
  const getAllowanceConfig = (type: string) => {
    return ALLOWANCE_TYPES.find((t) => t.value === type) || ALLOWANCE_TYPES[ALLOWANCE_TYPES.length - 1];
  };

  // Get status badge
  const getStatusBadge = (status: BenefitEnrollment["status"]) => {
    const configs = {
      active: { icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
      pending: { icon: Clock, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      terminated: { icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Handle add allowance
  const handleAddAllowance = async () => {
    if (!selectedEmployee || !allowanceType || amount <= 0) {
      toast({
        title: "Missing Information",
        description: "Please select an employee, allowance type, and enter an amount.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const config = getAllowanceConfig(allowanceType);

      const enrollment: Omit<BenefitEnrollment, "id"> = {
        employeeId: selectedEmployee,
        benefitType: allowanceType as BenefitEnrollment["benefitType"],
        planName: config.label,
        planId: `allowance-${allowanceType}`,
        coverageLevel: "employee_only",
        employeeContribution: 0, // Allowances are employer-paid
        employerContribution: amount,
        isPreTax: false,
        effectiveDate,
        status: "active",
      };

      await payrollService.benefits.createEnrollment(tenantId, enrollment);

      toast({
        title: "Allowance Added",
        description: `${config.label} allowance of ${formatCurrency(amount)}/month added.`,
      });

      // Reload allowances
      const data = await payrollService.benefits.getAllEnrollments(tenantId);
      setAllowances(data);

      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create allowance:", error);
      toast({
        title: "Error",
        description: "Failed to add allowance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedEmployee("");
    setAllowanceType("");
    setAmount(0);
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  // Set suggested amount
  const setSuggestedAmount = (level: "low" | "typical" | "high") => {
    if (allowanceType && SUGGESTED_AMOUNTS[allowanceType]) {
      setAmount(SUGGESTED_AMOUNTS[allowanceType][level]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Employee Allowances - OniT" description="Manage employee allowances for transport, housing, meals, and more" />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-teal-50 dark:bg-teal-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
                <Wallet className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Employee Allowances
                </h1>
                <p className="text-muted-foreground mt-1">
                  Transport, housing, meals, and other monthly allowances
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Allowance
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Allowances
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.totalAllowances}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    for {stats.employeesWithAllowances} employees
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Monthly Total
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totalMonthly)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    all allowances combined
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
                    Avg per Employee
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.employeesWithAllowances > 0
                      ? formatCurrency(stats.totalMonthly / stats.employeesWithAllowances)
                      : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    monthly average
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Allowance Type Filter Cards */}
        <Card className="mb-6 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Allowance Types
            </CardTitle>
            <CardDescription>Click to filter by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
              {ALLOWANCE_TYPES.map((type) => {
                const Icon = type.icon;
                const count = allowances.filter(
                  (a) => a.benefitType === type.value && a.status === "active"
                ).length;
                const total = stats.byType[type.value] || 0;

                return (
                  <button
                    key={type.value}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      filterType === type.value
                        ? "border-teal-500 bg-teal-500/10"
                        : "hover:border-teal-300 dark:hover:border-teal-700"
                    }`}
                    onClick={() =>
                      setFilterType(filterType === type.value ? "all" : type.value)
                    }
                  >
                    <Icon className={`h-5 w-5 mb-1.5 ${
                      filterType === type.value ? "text-teal-600" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium truncate">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{count} active</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Allowances Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Allowances
                </CardTitle>
                <CardDescription>
                  {filteredAllowances.length} allowance{filteredAllowances.length !== 1 ? "s" : ""}
                  {filterType !== "all" && ` (${getAllowanceConfig(filterType).label})`}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            {filteredAllowances.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No allowances found</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Allowance
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount/Month</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllowances.map((allowance) => {
                      const config = getAllowanceConfig(allowance.benefitType);
                      const Icon = config.icon;

                      return (
                        <TableRow key={allowance.id}>
                          <TableCell className="font-medium">
                            {getEmployeeName(allowance.employeeId)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded bg-teal-100 dark:bg-teal-900">
                                <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              </div>
                              <span>{config.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(allowance.employerContribution)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(allowance.effectiveDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(allowance.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Remove">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Allowance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee Allowance</DialogTitle>
            <DialogDescription>
              Set up a monthly allowance for an employee
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="employee">Employee *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id || ""}>
                      {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="allowance-type">Allowance Type *</Label>
              <Select
                value={allowanceType}
                onValueChange={(v) => {
                  setAllowanceType(v);
                  // Set typical amount as default
                  if (SUGGESTED_AMOUNTS[v]) {
                    setAmount(SUGGESTED_AMOUNTS[v].typical);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWANCE_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{type.label}</span>
                          <span className="text-xs text-muted-foreground">- {type.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount per Month (USD) *</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min={0}
                step={10}
                placeholder="100"
              />
              {allowanceType && SUGGESTED_AMOUNTS[allowanceType] && (
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Suggested:</span>
                  <button
                    type="button"
                    className="text-xs text-teal-600 hover:underline"
                    onClick={() => setSuggestedAmount("low")}
                  >
                    ${SUGGESTED_AMOUNTS[allowanceType].low}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-teal-600 hover:underline font-medium"
                    onClick={() => setSuggestedAmount("typical")}
                  >
                    ${SUGGESTED_AMOUNTS[allowanceType].typical}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-teal-600 hover:underline"
                    onClick={() => setSuggestedAmount("high")}
                  >
                    ${SUGGESTED_AMOUNTS[allowanceType].high}
                  </button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="effective-date">Start Date</Label>
              <Input
                id="effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAllowance}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Allowance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
