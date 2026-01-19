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
  Heart,
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
  Shield,
  Stethoscope,
  Eye,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { employeeService, Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { payrollService } from "@/services/payrollService";
import { formatCurrency, BENEFIT_LIMITS } from "@/lib/payroll/constants";
import type { BenefitEnrollment } from "@/types/payroll";
import { SEO, seoConfig } from "@/components/SEO";

const BENEFIT_TYPES = [
  { value: "health", label: "Health Insurance", icon: Stethoscope },
  { value: "dental", label: "Dental Insurance", icon: Heart },
  { value: "vision", label: "Vision Insurance", icon: Eye },
  { value: "life", label: "Life Insurance", icon: Shield },
  { value: "401k", label: "401(k) Retirement", icon: Wallet },
  { value: "hsa", label: "HSA", icon: Heart },
  { value: "fsa", label: "FSA", icon: Heart },
];

const COVERAGE_LEVELS = [
  { value: "employee_only", label: "Employee Only" },
  { value: "employee_spouse", label: "Employee + Spouse" },
  { value: "employee_children", label: "Employee + Children" },
  { value: "family", label: "Family" },
];

const SAMPLE_PLANS = {
  health: [
    { id: "health-basic", name: "Basic Health Plan", employeeCost: 150, employerCost: 350 },
    { id: "health-standard", name: "Standard Health Plan", employeeCost: 250, employerCost: 450 },
    { id: "health-premium", name: "Premium Health Plan", employeeCost: 400, employerCost: 600 },
  ],
  dental: [
    { id: "dental-basic", name: "Basic Dental", employeeCost: 25, employerCost: 25 },
    { id: "dental-premium", name: "Premium Dental", employeeCost: 50, employerCost: 50 },
  ],
  vision: [
    { id: "vision-basic", name: "Basic Vision", employeeCost: 10, employerCost: 10 },
    { id: "vision-premium", name: "Premium Vision", employeeCost: 25, employerCost: 25 },
  ],
  life: [
    { id: "life-1x", name: "1x Salary", employeeCost: 15, employerCost: 0 },
    { id: "life-2x", name: "2x Salary", employeeCost: 30, employerCost: 0 },
  ],
  "401k": [
    { id: "401k-standard", name: "401(k) Plan", employeeCost: 0, employerCost: 0 },
  ],
  hsa: [
    { id: "hsa-standard", name: "HSA Account", employeeCost: 0, employerCost: 0 },
  ],
  fsa: [
    { id: "fsa-standard", name: "FSA Account", employeeCost: 0, employerCost: 0 },
  ],
};

export default function BenefitsEnrollment() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<BenefitEnrollment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [benefitType, setBenefitType] = useState("");
  const [planId, setPlanId] = useState("");
  const [coverageLevel, setCoverageLevel] = useState("employee_only");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [employeeContribution, setEmployeeContribution] = useState(0);
  const [employerContribution, setEmployerContribution] = useState(0);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [enrollmentData, employeeData] = await Promise.all([
          payrollService.benefits.getAllEnrollments(),
          employeeService.getAllEmployees(tenantId),
        ]);
        setEnrollments(enrollmentData);
        setEmployees(employeeData.filter((e) => e.status === "active"));
      } catch (error) {
        console.error("Failed to load data:", error);
        toast({
          title: "Error",
          description: "Failed to load benefits data. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = enrollments.filter((e) => e.status === "active");
    const totalEmployeeCost = active.reduce((sum, e) => sum + e.employeeContribution, 0);
    const totalEmployerCost = active.reduce((sum, e) => sum + e.employerContribution, 0);
    const enrolledEmployees = new Set(active.map((e) => e.employeeId)).size;

    return {
      totalEnrollments: active.length,
      enrolledEmployees,
      totalEmployeeCost,
      totalEmployerCost,
    };
  }, [enrollments]);

  // Filter enrollments
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => {
      if (filterType !== "all" && enrollment.benefitType !== filterType) {
        return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const employee = employees.find((e) => e.id === enrollment.employeeId);
        if (employee) {
          const name = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.toLowerCase();
          if (!name.includes(term)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [enrollments, filterType, searchTerm, employees]);

  // Get available plans for selected benefit type
  const availablePlans = useMemo(() => {
    if (!benefitType) return [];
    return SAMPLE_PLANS[benefitType as keyof typeof SAMPLE_PLANS] || [];
  }, [benefitType]);

  // Update contribution when plan changes
  useEffect(() => {
    if (planId && benefitType) {
      const plans = SAMPLE_PLANS[benefitType as keyof typeof SAMPLE_PLANS] || [];
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        setEmployeeContribution(plan.employeeCost);
        setEmployerContribution(plan.employerCost);
      }
    }
  }, [planId, benefitType]);

  // Get employee name
  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    }
    return "Unknown";
  };

  // Get benefit type icon
  const getBenefitIcon = (type: string) => {
    const benefitType = BENEFIT_TYPES.find((t) => t.value === type);
    const Icon = benefitType?.icon || Heart;
    return <Icon className="h-4 w-4" />;
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

  // Handle add enrollment
  const handleAddEnrollment = async () => {
    if (!selectedEmployee || !benefitType || !planId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const plans = SAMPLE_PLANS[benefitType as keyof typeof SAMPLE_PLANS] || [];
      const plan = plans.find((p) => p.id === planId);

      const enrollment: Omit<BenefitEnrollment, "id"> = {
        employeeId: selectedEmployee,
        benefitType: benefitType as BenefitEnrollment["benefitType"],
        planName: plan?.name || "Unknown Plan",
        planId,
        coverageLevel: coverageLevel as BenefitEnrollment["coverageLevel"],
        employeeContribution,
        employerContribution,
        isPreTax: ["health", "dental", "vision", "401k", "hsa", "fsa"].includes(benefitType),
        effectiveDate,
        status: "active",
      };

      await payrollService.benefits.createEnrollment(enrollment);

      toast({
        title: "Success",
        description: "Benefit enrollment created successfully.",
      });

      // Reload enrollments
      const data = await payrollService.benefits.getAllEnrollments();
      setEnrollments(data);

      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create enrollment:", error);
      toast({
        title: "Error",
        description: "Failed to create enrollment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedEmployee("");
    setBenefitType("");
    setPlanId("");
    setCoverageLevel("employee_only");
    setEffectiveDate(new Date().toISOString().split("T")[0]);
    setEmployeeContribution(0);
    setEmployerContribution(0);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-6 w-6 mb-2" />
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20 ml-auto" />
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
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.benefits} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Benefits Enrollment
                </h1>
                <p className="text-muted-foreground mt-1">
                  Manage employee benefits enrollment
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Enrollment
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Active Enrollments
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.totalEnrollments}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Enrolled Employees
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.enrolledEmployees}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Employee Cost/mo
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(stats.totalEmployeeCost)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Employer Cost/mo
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(stats.totalEmployerCost)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefit Type Cards */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
                Benefit Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {BENEFIT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const count = enrollments.filter(
                    (e) => e.benefitType === type.value && e.status === "active"
                  ).length;

                  return (
                    <div
                      key={type.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        filterType === type.value
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "hover:border-border"
                      }`}
                      onClick={() =>
                        setFilterType(filterType === type.value ? "all" : type.value)
                      }
                    >
                      <Icon className="h-6 w-6 text-emerald-500 mb-2" />
                      <p className="text-sm font-medium text-foreground">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{count} enrolled</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Enrollments Table */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Enrollments
                  </CardTitle>
                  <CardDescription>
                    {filteredEnrollments.length} enrollments
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
              {filteredEnrollments.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No enrollments found</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Enrollment
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Benefit</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead className="text-right">Employee Cost</TableHead>
                        <TableHead className="text-right">Employer Cost</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            {getEmployeeName(enrollment.employeeId)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getBenefitIcon(enrollment.benefitType)}
                              {BENEFIT_TYPES.find((t) => t.value === enrollment.benefitType)?.label}
                            </div>
                          </TableCell>
                          <TableCell>{enrollment.planName}</TableCell>
                          <TableCell>
                            {COVERAGE_LEVELS.find((c) => c.value === enrollment.coverageLevel)?.label}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(enrollment.employeeContribution)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(enrollment.employerContribution)}
                          </TableCell>
                          <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Add Enrollment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Benefit Enrollment</DialogTitle>
            <DialogDescription>
              Enroll an employee in a benefit plan
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
              <Label htmlFor="benefit-type">Benefit Type *</Label>
              <Select
                value={benefitType}
                onValueChange={(v) => {
                  setBenefitType(v);
                  setPlanId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select benefit type" />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {benefitType && (
              <div>
                <Label htmlFor="plan">Plan *</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {formatCurrency(plan.employeeCost)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="coverage">Coverage Level</Label>
              <Select value={coverageLevel} onValueChange={setCoverageLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="effective-date">Effective Date</Label>
              <Input
                id="effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employee-contribution">Employee Cost/mo</Label>
                <Input
                  id="employee-contribution"
                  type="number"
                  value={employeeContribution}
                  onChange={(e) => setEmployeeContribution(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={10}
                />
              </div>
              <div>
                <Label htmlFor="employer-contribution">Employer Cost/mo</Label>
                <Input
                  id="employer-contribution"
                  type="number"
                  value={employerContribution}
                  onChange={(e) => setEmployerContribution(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={10}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEnrollment} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Enrollment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
