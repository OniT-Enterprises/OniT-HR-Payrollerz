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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  CreditCard,
  Plus,
  DollarSign,
  Search,
  Loader2,
  CheckCircle,
  Pause,
  Edit,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Percent,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { employeeService, Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { payrollService } from "@/services/payrollService";
import { formatCurrency, DEDUCTION_TYPE_LABELS } from "@/lib/payroll/constants";
import type { RecurringDeduction, DeductionType, PayFrequency } from "@/types/payroll";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";

export default function DeductionsAdvances() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [deductions, setDeductions] = useState<RecurringDeduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [deductionType, setDeductionType] = useState<DeductionType>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [isPercentage, setIsPercentage] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [isPreTax, setIsPreTax] = useState(false);
  const [startDate, setStartDate] = useState(getTodayTL());
  const [endDate, setEndDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [frequency, setFrequency] = useState<PayFrequency | "per_paycheck">("per_paycheck");

  // Translated arrays (inside component so t() is available)
  const DEDUCTION_TYPES: { value: DeductionType; label: string }[] = [
    { value: "garnishment", label: t("deductions.typeGarnishment") },
    { value: "advance", label: t("deductions.typeAdvance") },
    { value: "other", label: t("deductions.typeOther") },
  ];

  const FREQUENCY_OPTIONS: { value: PayFrequency | "per_paycheck"; label: string }[] = [
    { value: "per_paycheck", label: t("deductions.freqPerPaycheck") },
    { value: "weekly", label: t("deductions.freqWeekly") },
    { value: "biweekly", label: t("deductions.freqBiweekly") },
    { value: "monthly", label: t("deductions.freqMonthly") },
  ];

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
	        setLoading(true);
	        const [deductionData, employeeData] = await Promise.all([
	          payrollService.deductions.getAllDeductions(tenantId),
	          employeeService.getAllEmployees(tenantId),
	        ]);
        setDeductions(deductionData);
        setEmployees(employeeData.filter((e) => e.status === "active"));
      } catch (error) {
        console.error("Failed to load data:", error);
        toast({
          title: t("common.error"),
          description: t("deductions.loadError"),
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
    const active = deductions.filter((d) => d.status === "active");
    const advances = active.filter((d) => d.type === "advance");
    const garnishments = active.filter((d) => d.type === "garnishment");
    const other = active.filter((d) => d.type === "other");

    const totalActive = active.reduce((sum, d) => sum + d.amount, 0);
    const totalAdvances = advances.reduce((sum, d) => sum + d.amount, 0);
    const totalGarnishments = garnishments.reduce((sum, d) => sum + d.amount, 0);

    return {
      totalActive: active.length,
      totalActiveAmount: totalActive,
      advancesCount: advances.length,
      advancesAmount: totalAdvances,
      garnishmentsCount: garnishments.length,
      garnishmentsAmount: totalGarnishments,
      otherCount: other.length,
    };
  }, [deductions]);

  // Filter deductions
  const filteredDeductions = useMemo(() => {
    return deductions.filter((deduction) => {
      // Tab filter
      if (activeTab === "advances" && deduction.type !== "advance") return false;
      if (activeTab === "garnishments" && deduction.type !== "garnishment") return false;
      if (activeTab === "other" && !["advance", "garnishment"].includes(deduction.type) === false) return false;

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const employee = employees.find((e) => e.id === deduction.employeeId);
        if (employee) {
          const name = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.toLowerCase();
          if (!name.includes(term) && !deduction.description.toLowerCase().includes(term)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [deductions, activeTab, searchTerm, employees]);

  // Get employee name
  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      return `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    }
    return "Unknown";
  };

  // Get status badge
  const getStatusBadge = (status: RecurringDeduction["status"]) => {
    const configs = {
      active: { icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: t("deductions.statusActive") },
      paused: { icon: Pause, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: t("deductions.statusPaused") },
      completed: { icon: CheckCircle, className: "bg-muted text-muted-foreground", label: t("deductions.statusCompleted") },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Get type badge
  const getTypeBadge = (type: DeductionType) => {
    const configs: Record<string, { icon: React.ElementType; className: string }> = {
      advance: { icon: ArrowUpCircle, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      garnishment: { icon: ArrowDownCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
      other: { icon: CreditCard, className: "bg-muted text-muted-foreground" },
    };

    const config = configs[type] || configs.other;
    const Icon = config.icon;
    const label = DEDUCTION_TYPE_LABELS[type] || type;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Handle add deduction
  const handleAddDeduction = async () => {
    if (!selectedEmployee || !description || (isPercentage ? percentage <= 0 : amount <= 0)) {
      toast({
        title: t("deductions.validationError"),
        description: t("deductions.validationDescription"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const deduction: Omit<RecurringDeduction, "id"> = {
        employeeId: selectedEmployee,
        type: deductionType,
        description,
        amount: isPercentage ? 0 : amount,
        isPercentage,
        percentage: isPercentage ? percentage : undefined,
        isPreTax,
        startDate,
        endDate: endDate || undefined,
        totalAmount: deductionType === "advance" ? totalAmount : undefined,
        remainingBalance: deductionType === "advance" ? totalAmount : undefined,
        frequency,
        status: "active",
      };

      await payrollService.deductions.createDeduction(tenantId, deduction);

      toast({
        title: t("common.success"),
        description: t("deductions.createSuccess"),
      });

      // Reload deductions
      const data = await payrollService.deductions.getAllDeductions(tenantId);
      setDeductions(data);

      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create deduction:", error);
      toast({
        title: t("common.error"),
        description: t("deductions.createError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Pause/resume deduction
  const handleToggleStatus = async (deduction: RecurringDeduction) => {
    try {
      if (deduction.status === "active") {
        await payrollService.deductions.pauseDeduction(deduction.id!);
      } else if (deduction.status === "paused") {
        await payrollService.deductions.updateDeduction(deduction.id!, { status: "active" });
      }

      // Reload deductions
      const data = await payrollService.deductions.getAllDeductions(tenantId);
      setDeductions(data);

      toast({
        title: t("common.success"),
        description: deduction.status === "active" ? t("deductions.pausedSuccess") : t("deductions.resumedSuccess"),
      });
    } catch (error) {
      console.error("Failed to update deduction:", error);
      toast({
        title: t("common.error"),
        description: t("deductions.toggleError"),
        variant: "destructive",
      });
    }
  };

  // Delete deduction
  const handleDelete = async (id: string) => {
    try {
      await payrollService.deductions.deleteDeduction(id);

      // Reload deductions
      const data = await payrollService.deductions.getAllDeductions(tenantId);
      setDeductions(data);

      toast({
        title: t("common.success"),
        description: t("deductions.deleteSuccess"),
      });
    } catch (error) {
      console.error("Failed to delete deduction:", error);
      toast({
        title: t("common.error"),
        description: t("deductions.deleteError"),
        variant: "destructive",
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedEmployee("");
    setDeductionType("other");
    setDescription("");
    setAmount(0);
    setIsPercentage(false);
    setPercentage(0);
    setIsPreTax(false);
    setStartDate(getTodayTL());
    setEndDate("");
    setTotalAmount(0);
    setFrequency("per_paycheck");
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
                <Skeleton className="h-8 w-52 mb-2" />
                <Skeleton className="h-4 w-72" />
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
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9 w-24" />
                  ))}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
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
      <SEO {...seoConfig.deductions} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("deductions.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("deductions.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
              <Plus className="h-4 w-4 mr-2" />
              {t("deductions.addDeduction")}
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
                      {t("deductions.activeDeductions")}
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.totalActive}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("deductions.perPeriod", { amount: formatCurrency(stats.totalActiveAmount) })}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("deductions.payrollAdvances")}
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.advancesCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("deductions.outstanding", { amount: formatCurrency(stats.advancesAmount) })}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                    <ArrowUpCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("deductions.garnishments")}
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.garnishmentsCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("deductions.perPeriod", { amount: formatCurrency(stats.garnishmentsAmount) })}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                    <ArrowDownCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("deductions.otherDeductions")}
                    </p>
                    <p className="text-2xl font-bold">
                      {stats.otherCount}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deductions Table with Tabs */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                    {t("deductions.deductionsTableTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("deductions.deductionsTableDescription")}
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("deductions.searchPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">{t("deductions.tabAll")}</TabsTrigger>
                  <TabsTrigger value="advances">{t("deductions.tabAdvances")}</TabsTrigger>
                  <TabsTrigger value="garnishments">{t("deductions.tabGarnishments")}</TabsTrigger>
                  <TabsTrigger value="other">{t("deductions.tabOther")}</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  {filteredDeductions.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">{t("deductions.noDeductions")}</p>
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("deductions.addDeduction")}
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("deductions.employee")}</TableHead>
                            <TableHead>{t("deductions.type")}</TableHead>
                            <TableHead>{t("deductions.description")}</TableHead>
                            <TableHead className="text-right">{t("deductions.amount")}</TableHead>
                            <TableHead>{t("deductions.frequency")}</TableHead>
                            <TableHead>{t("deductions.status")}</TableHead>
                            <TableHead className="text-right">{t("deductions.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDeductions.map((deduction) => (
                            <TableRow key={deduction.id}>
                              <TableCell className="font-medium">
                                {getEmployeeName(deduction.employeeId)}
                              </TableCell>
                              <TableCell>{getTypeBadge(deduction.type)}</TableCell>
                              <TableCell>{deduction.description}</TableCell>
                              <TableCell className="text-right">
                                {deduction.isPercentage ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {deduction.percentage}%
                                    <Percent className="h-3 w-3 text-gray-400" />
                                  </span>
                                ) : (
                                  formatCurrency(deduction.amount)
                                )}
                                {deduction.type === "advance" && deduction.remainingBalance !== undefined && (
                                  <p className="text-xs text-muted-foreground">
                                    {t("deductions.remaining", { amount: formatCurrency(deduction.remainingBalance) })}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                {FREQUENCY_OPTIONS.find((f) => f.value === deduction.frequency)?.label}
                              </TableCell>
                              <TableCell>{getStatusBadge(deduction.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(deduction)}
                                    disabled={deduction.status === "completed"}
                                  >
                                    {deduction.status === "active" ? (
                                      <Pause className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(deduction.id!)}
                                  >
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

      {/* Add Deduction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("deductions.addDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("deductions.addDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="employee">{t("deductions.employeeLabel")}</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder={t("deductions.selectEmployee")} />
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
              <Label htmlFor="deduction-type">{t("deductions.typeLabel")}</Label>
              <Select
                value={deductionType}
                onValueChange={(v) => setDeductionType(v as DeductionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEDUCTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">{t("deductions.descriptionLabel")}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("deductions.descriptionPlaceholder")}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-percentage"
                  checked={isPercentage}
                  onCheckedChange={setIsPercentage}
                />
                <Label htmlFor="is-percentage">{t("deductions.percentageBased")}</Label>
              </div>
            </div>

            {isPercentage ? (
              <div>
                <Label htmlFor="percentage">{t("deductions.percentageLabel")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="percentage"
                    type="number"
                    value={percentage}
                    onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="amount">{t("deductions.amountPerPeriod")}</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={10}
                />
              </div>
            )}

            {deductionType === "advance" && (
              <div>
                <Label htmlFor="total-amount">{t("deductions.totalAdvanceAmount")}</Label>
                <Input
                  id="total-amount"
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={100}
                  placeholder={t("deductions.totalAdvancePlaceholder")}
                />
              </div>
            )}

            <div>
              <Label htmlFor="frequency">{t("deductions.frequencyLabel")}</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as PayFrequency | "per_paycheck")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">{t("deductions.startDate")}</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">{t("deductions.endDate")}</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-pre-tax"
                checked={isPreTax}
                onCheckedChange={setIsPreTax}
              />
              <Label htmlFor="is-pre-tax">{t("deductions.preTaxDeduction")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("deductions.cancel")}
            </Button>
            <Button onClick={handleAddDeduction} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("deductions.saving")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("deductions.addDeduction")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
