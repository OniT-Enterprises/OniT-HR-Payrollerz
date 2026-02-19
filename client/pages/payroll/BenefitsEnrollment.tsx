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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";

// Allowance type icons mapping
const ALLOWANCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  transport: Car,
  fuel: Fuel,
  housing: Home,
  meal: Utensils,
  phone: Phone,
  hardship: MapPin,
  education: GraduationCap,
  uniform: Shirt,
  other: Briefcase,
};

// Allowance type values (keys for i18n lookup)
const ALLOWANCE_TYPE_VALUES = [
  "transport",
  "fuel",
  "housing",
  "meal",
  "phone",
  "hardship",
  "education",
  "uniform",
  "other",
] as const;

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
  const { t } = useI18n();

  // Build allowance types with translated labels
  const ALLOWANCE_TYPES = ALLOWANCE_TYPE_VALUES.map((value) => ({
    value,
    label: t(`allowances.types.${value}`),
    icon: ALLOWANCE_ICONS[value],
    description: t(`allowances.types.${value}Desc`),
  }));
  const [loading, setLoading] = useState(true);
  const [allowances, setAllowances] = useState<BenefitEnrollment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<BenefitEnrollment | null>(null);
  const [deletingAllowance, setDeletingAllowance] = useState<BenefitEnrollment | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [allowanceType, setAllowanceType] = useState("");
  const [amount, setAmount] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState(
    getTodayTL()
  );
  const [_notes, setNotes] = useState("");

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
          title: t("common.error"),
          description: t("allowances.loadError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return t("common.unknown");
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
        title: t("allowances.missingInfo"),
        description: t("allowances.missingInfoDesc"),
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
        title: t("allowances.allowanceAdded"),
        description: t("allowances.allowanceAddedDesc", { type: config.label, amount: formatCurrency(amount) }),
      });

      // Reload allowances
      const data = await payrollService.benefits.getAllEnrollments(tenantId);
      setAllowances(data);

      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create allowance:", error);
      toast({
        title: t("common.error"),
        description: t("allowances.addError"),
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
    setEffectiveDate(getTodayTL());
    setNotes("");
  };

  // Open edit dialog
  const handleEdit = (allowance: BenefitEnrollment) => {
    setEditingAllowance(allowance);
    setSelectedEmployee(allowance.employeeId);
    setAllowanceType(allowance.benefitType);
    setAmount(allowance.employerContribution);
    setEffectiveDate(allowance.effectiveDate);
    setShowAddDialog(true);
  };

  // Handle update allowance
  const handleUpdateAllowance = async () => {
    if (!editingAllowance || !allowanceType || amount <= 0) return;

    setSaving(true);
    try {
      const config = getAllowanceConfig(allowanceType);
      await payrollService.benefits.updateEnrollment(editingAllowance.id!, {
        benefitType: allowanceType as BenefitEnrollment["benefitType"],
        planName: config.label,
        employerContribution: amount,
        effectiveDate,
      });

      toast({
        title: t("allowances.allowanceUpdated") || "Allowance Updated",
        description: t("allowances.allowanceUpdatedDesc", { type: config.label, amount: formatCurrency(amount) }) || `${config.label} updated to ${formatCurrency(amount)}/month`,
      });

      const data = await payrollService.benefits.getAllEnrollments(tenantId);
      setAllowances(data);
      setShowAddDialog(false);
      setEditingAllowance(null);
      resetForm();
    } catch (error) {
      console.error("Failed to update allowance:", error);
      toast({
        title: t("common.error"),
        description: t("allowances.updateError") || "Failed to update allowance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete allowance
  const handleDeleteAllowance = async () => {
    if (!deletingAllowance) return;

    setSaving(true);
    try {
      await payrollService.benefits.terminateEnrollment(
        deletingAllowance.id!,
        getTodayTL()
      );

      toast({
        title: t("allowances.allowanceRemoved") || "Allowance Removed",
        description: t("allowances.allowanceRemovedDesc") || "The allowance has been terminated",
      });

      const data = await payrollService.benefits.getAllEnrollments(tenantId);
      setAllowances(data);
      setDeletingAllowance(null);
    } catch (error) {
      console.error("Failed to remove allowance:", error);
      toast({
        title: t("common.error"),
        description: t("allowances.removeError") || "Failed to remove allowance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
      <SEO title="Employee Allowances - Meza" description="Manage employee allowances for transport, housing, meals, and more" />
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
                  {t("allowances.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("allowances.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600">
              <Plus className="h-4 w-4 mr-2" />
              {t("allowances.add")}
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
                    {t("allowances.activeAllowances")}
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.totalAllowances}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("allowances.forEmployees", { count: stats.employeesWithAllowances })}
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
                    {t("allowances.monthlyTotal")}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totalMonthly)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("allowances.allCombined")}
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
                    {t("allowances.avgPerEmployee")}
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.employeesWithAllowances > 0
                      ? formatCurrency(stats.totalMonthly / stats.employeesWithAllowances)
                      : formatCurrency(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("allowances.monthlyAverage")}
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
              {t("allowances.allowanceTypes")}
            </CardTitle>
            <CardDescription>{t("allowances.clickToFilter")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
              {ALLOWANCE_TYPES.map((type) => {
                const Icon = type.icon;
                const count = allowances.filter(
                  (a) => a.benefitType === type.value && a.status === "active"
                ).length;
                const _total = stats.byType[type.value] || 0;

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
                    <p className="text-xs text-muted-foreground">{count} {t("allowances.active")}</p>
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
                  {t("allowances.title")}
                </CardTitle>
                <CardDescription>
                  {filteredAllowances.length} {filteredAllowances.length !== 1 ? t("allowances.title").toLowerCase() : t("allowances.title").toLowerCase().replace(/s$/, "")}
                  {filterType !== "all" && ` (${getAllowanceConfig(filterType).label})`}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("allowances.searchPlaceholder")}
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
                <p className="text-muted-foreground mb-4">{t("allowances.noResults")}</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("allowances.addFirst")}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("allowances.employee")}</TableHead>
                      <TableHead>{t("allowances.type")}</TableHead>
                      <TableHead className="text-right">{t("allowances.amountPerMonth")}</TableHead>
                      <TableHead>{t("allowances.startDate")}</TableHead>
                      <TableHead>{t("allowances.status")}</TableHead>
                      <TableHead className="text-right">{t("allowances.actions")}</TableHead>
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
                              <Button variant="ghost" size="sm" title={t("common.edit")} onClick={() => handleEdit(allowance)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title={t("common.remove")} onClick={() => setDeletingAllowance(allowance)}>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAllowance} onOpenChange={(open) => !open && setDeletingAllowance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("allowances.confirmRemove") || "Remove Allowance?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("allowances.confirmRemoveDesc") || "This will terminate the allowance. It will no longer be included in future payroll runs."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllowance} className="bg-red-600 hover:bg-red-700">
              {t("common.remove") || "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Allowance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setEditingAllowance(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAllowance ? (t("allowances.edit") || "Edit Allowance") : t("allowances.add")}</DialogTitle>
            <DialogDescription>
              {t("allowances.setMonthlyAllowance")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="employee">{t("allowances.employee")} *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={!!editingAllowance}>
                <SelectTrigger>
                  <SelectValue placeholder={t("allowances.selectEmployee")} />
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
              <Label htmlFor="allowance-type">{t("allowances.type")} *</Label>
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
                  <SelectValue placeholder={t("allowances.selectType")} />
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
              <Label htmlFor="amount">{t("allowances.amountLabel")} *</Label>
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
                  <span className="text-xs text-muted-foreground">{t("allowances.suggested")}</span>
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
              <Label htmlFor="effective-date">{t("allowances.startDate")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button
              onClick={editingAllowance ? handleUpdateAllowance : handleAddAllowance}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : editingAllowance ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("common.save") || "Save"}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("allowances.add")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
