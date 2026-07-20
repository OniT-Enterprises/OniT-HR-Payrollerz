import React, { useState, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  CreditCard,
  Plus,
  Search,
  Loader2,
  CheckCircle,
  Pause,
  Edit,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Percent,
  Landmark,
  Scale,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecurringDeductions, useCreateDeduction, useUpdateDeduction, usePauseDeduction, useDeleteDeduction } from "@/hooks/usePayroll";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { formatCurrency } from "@/lib/payroll/constants";
import { TL_DEDUCTION_TYPE_LABELS } from "@/lib/payroll/constants-tl";
import type { RecurringDeduction, DeductionType, PayFrequency } from "@/types/payroll";
import { buildDeductionEditUpdates } from "@/lib/payroll/deduction-edit";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL } from "@/lib/dateUtils";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";

// Columns the deductions table can be sorted by (Actions is not sortable)
type DeductionSortKey = "employee" | "type" | "description" | "amount" | "frequency" | "status";

export default function DeductionsAdvances() {
  const { toast } = useToast();
  const { t } = useI18n();

  // React Query data
  const { data: deductions = [], isLoading: loadingDeductions } = useRecurringDeductions();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeDirectory({ status: 'active' });
  const loading = loadingDeductions || loadingEmployees;

  // Mutations
  const createDeduction = useCreateDeduction();
  const updateDeduction = useUpdateDeduction();
  const pauseDeduction = usePauseDeduction();
  const deleteDeduction = useDeleteDeduction();
  const saving = createDeduction.isPending || updateDeduction.isPending;

  const [showAddDialog, setShowAddDialog] = useState(false);
  // Non-null while the dialog is editing an existing register doc (the same
  // dialog serves create and edit; employee/type are frozen when editing).
  const [editingDeduction, setEditingDeduction] = useState<RecurringDeduction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<DeductionType | "all">("all");

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
    { value: "court_order", label: t("deductions.typeGarnishment") },
    { value: "advance_repayment", label: t("deductions.typeAdvance") },
    { value: "loan_repayment", label: t("deductions.typeLoanRepayment") || "Loan Repayment" },
    { value: "other", label: t("deductions.typeOther") },
  ];

  const FREQUENCY_OPTIONS: { value: PayFrequency | "per_paycheck"; label: string }[] = [
    { value: "per_paycheck", label: t("deductions.freqPerPaycheck") },
    { value: "weekly", label: t("deductions.freqWeekly") },
    { value: "biweekly", label: t("deductions.freqBiweekly") },
    { value: "monthly", label: t("deductions.freqMonthly") },
  ];

  // Clickable type-filter cards (mirrors the Benefits page layout)
  const DEDUCTION_TYPE_CARDS: { value: DeductionType; label: string; icon: React.ElementType }[] = [
    { value: "advance_repayment", label: t("deductions.typeAdvance"), icon: ArrowUpCircle },
    { value: "loan_repayment", label: t("deductions.typeLoanRepayment") || "Loan Repayment", icon: Landmark },
    { value: "court_order", label: t("deductions.typeGarnishment"), icon: Scale },
    { value: "other", label: t("deductions.typeOther"), icon: CreditCard },
  ];

  // Filter deductions
  const filteredDeductions = useMemo(() => {
    return deductions.filter((deduction) => {
      // Type filter (from the clickable type cards)
      if (filterType !== "all" && deduction.type !== filterType) return false;

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
  }, [deductions, filterType, searchTerm, employees]);

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
      advance_repayment: { icon: ArrowUpCircle, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      loan_repayment: { icon: ArrowUpCircle, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
      court_order: { icon: ArrowDownCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
      other: { icon: CreditCard, className: "bg-muted text-muted-foreground" },
    };

    const config = configs[type] || configs.other;
    const Icon = config.icon;
    const tlLabel = TL_DEDUCTION_TYPE_LABELS[type as keyof typeof TL_DEDUCTION_TYPE_LABELS];
    const label = tlLabel ? tlLabel.en : type;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Raw label used for the "Type" column sort (mirrors getTypeBadge's text)
  const getTypeLabel = (type: DeductionType) =>
    TL_DEDUCTION_TYPE_LABELS[type as keyof typeof TL_DEDUCTION_TYPE_LABELS]?.en ?? type;

  // Column sorting (asc → desc → off)
  const { sorted: sortedDeductions, sort, toggleSort } = useTableSort<RecurringDeduction, DeductionSortKey>(
    filteredDeductions,
    {
      employee: (d) => getEmployeeName(d.employeeId),
      type: (d) => getTypeLabel(d.type),
      description: (d) => d.description,
      amount: (d) => (d.isPercentage ? d.percentage ?? 0 : d.amount),
      frequency: (d) => FREQUENCY_OPTIONS.find((f) => f.value === d.frequency)?.label ?? "",
      status: (d) => d.status,
    },
  );

  // Renders a sortable shadcn <TableHead> wired to the sort state above
  const sortableHead = (key: DeductionSortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort?.key === key;
    return (
      <TableHead
        aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
        className={align === "right" ? "text-right" : undefined}
      >
        <SortableColumnHeader
          label={label}
          active={active}
          direction={active ? sort!.direction : "asc"}
          onSort={() => toggleSort(key)}
          align={align}
        />
      </TableHead>
    );
  };

  // Handle add deduction
  const handleAddDeduction = () => {
    if (!selectedEmployee || !description || (isPercentage ? percentage <= 0 : amount <= 0)) {
      toast({
        title: t("deductions.validationError"),
        description: t("deductions.validationDescription"),
        variant: "destructive",
      });
      return;
    }

    const deduction: Omit<RecurringDeduction, "id" | "tenantId"> = {
      employeeId: selectedEmployee,
      type: deductionType,
      description,
      amount: isPercentage ? 0 : amount,
      isPercentage,
      percentage: isPercentage ? percentage : 0,
      isPreTax,
      startDate,
      endDate: endDate || "",
      totalAmount: deductionType === "advance_repayment" ? totalAmount : 0,
      remainingBalance: deductionType === "advance_repayment" ? totalAmount : 0,
      frequency,
      status: "active",
    };

    createDeduction.mutate(deduction, {
      onSuccess: () => {
        toast({
          title: t("common.success"),
          description: t("deductions.createSuccess"),
        });
        closeDialog();
      },
      onError: () => {
        toast({
          title: t("common.error"),
          description: t("deductions.createError"),
          variant: "destructive",
        });
      },
    });
  };

  // Open the dialog prefilled with an existing register doc
  const openEditDialog = (deduction: RecurringDeduction) => {
    setEditingDeduction(deduction);
    setSelectedEmployee(deduction.employeeId);
    setDeductionType(deduction.type);
    setDescription(deduction.description);
    setAmount(deduction.amount);
    setIsPercentage(!!deduction.isPercentage);
    setPercentage(deduction.percentage ?? 0);
    setIsPreTax(!!deduction.isPreTax);
    setStartDate(deduction.startDate || getTodayTL());
    setEndDate(deduction.endDate || "");
    setTotalAmount(deduction.totalAmount ?? 0);
    setFrequency(deduction.frequency);
    setShowAddDialog(true);
  };

  // Save an edit. Balance semantics live in buildDeductionEditUpdates:
  // installment edits never touch remainingBalance/lastAppliedPeriod; a
  // totalAmount change keeps what was already repaid
  // (remaining = clamp(newTotal - alreadyRepaid, 0, newTotal)).
  const handleSaveEdit = () => {
    if (!editingDeduction?.id) return;
    if (!description || (isPercentage ? percentage <= 0 : amount <= 0)) {
      toast({
        title: t("deductions.validationError"),
        description: t("deductions.validationDescription"),
        variant: "destructive",
      });
      return;
    }

    let updates: Partial<RecurringDeduction>;
    try {
      updates = buildDeductionEditUpdates(
        {
          type: editingDeduction.type,
          status: editingDeduction.status,
          totalAmount: editingDeduction.totalAmount,
          remainingBalance: editingDeduction.remainingBalance,
        },
        {
          description,
          amount,
          isPercentage,
          percentage,
          isPreTax,
          startDate,
          endDate,
          frequency,
          totalAmount,
        },
      );
    } catch {
      // Dropping the total off a balance-tracked advance would turn it into
      // an open-ended installment that deducts forever.
      toast({
        title: t("deductions.validationError"),
        description:
          t("deductions.totalAmountRequired") ||
          "An advance that tracks a balance needs a total amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    updateDeduction.mutate(
      { id: editingDeduction.id, updates },
      {
        onSuccess: () => {
          toast({
            title: t("common.success"),
            description: t("deductions.updateSuccess") || "Deduction updated.",
          });
          closeDialog();
        },
        onError: () => {
          toast({
            title: t("common.error"),
            description:
              t("deductions.updateError") || "Failed to update the deduction.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // Pause/resume deduction
  const handleToggleStatus = (deduction: RecurringDeduction) => {
    const callbacks = {
      onSuccess: () => {
        toast({
          title: t("common.success"),
          description: deduction.status === "active" ? t("deductions.pausedSuccess") : t("deductions.resumedSuccess"),
        });
      },
      onError: () => {
        toast({
          title: t("common.error"),
          description: t("deductions.toggleError"),
          variant: "destructive",
        });
      },
    };

    if (deduction.status === "active") {
      pauseDeduction.mutate(deduction.id!, callbacks);
    } else if (deduction.status === "paused") {
      updateDeduction.mutate({ id: deduction.id!, updates: { status: "active" } }, callbacks);
    }
  };

  // Delete deduction
  const handleDelete = (id: string) => {
    deleteDeduction.mutate(id, {
      onSuccess: () => {
        toast({
          title: t("common.success"),
          description: t("deductions.deleteSuccess"),
        });
      },
      onError: () => {
        toast({
          title: t("common.error"),
          description: t("deductions.deleteError"),
          variant: "destructive",
        });
      },
    });
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

  // Close the shared create/edit dialog and clear edit state so a stale
  // prefill never leaks into the next "Add Deduction".
  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingDeduction(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />

        <div className="mx-auto max-w-screen-2xl px-6 py-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-8 w-52 mb-2" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-10 w-40" />
          </div>

          <Card className="mb-6 border-border/50">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <Skeleton className="h-5 w-5 mb-1.5" />
                    <Skeleton className="h-3 w-16 mb-1.5" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-10 w-64" />
              </div>
            </CardHeader>
            <CardContent>
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
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-36" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-4 w-16 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.deductions} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("deductions.title")}
          subtitle={t("deductions.subtitle")}
          icon={CreditCard}
          iconColor="text-primary"
          actions={
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("deductions.addDeduction")}
            </Button>
          }
        />

          {/* Deduction Type Filter Cards */}
          <Card className="mb-6 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                {t("deductions.deductionTypes")}
              </CardTitle>
              <CardDescription>{t("deductions.clickToFilter")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DEDUCTION_TYPE_CARDS.map((type) => {
                  const Icon = type.icon;
                  const count = deductions.filter(
                    (d) => d.type === type.value && d.status === "active"
                  ).length;

                  return (
                    <button
                      key={type.value}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        filterType === type.value
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary/40"
                      }`}
                      onClick={() =>
                        setFilterType(filterType === type.value ? "all" : type.value)
                      }
                    >
                      <Icon className={`h-5 w-5 mb-1.5 ${
                        filterType === type.value ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <p className="text-xs font-medium truncate">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{count} {t("deductions.active")}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Deductions Table */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t("deductions.deductionsTableTitle")}
                  </CardTitle>
                  <CardDescription>
                    {filteredDeductions.length} {t("deductions.deductionsTableTitle").toLowerCase()}
                    {filterType !== "all" && ` (${DEDUCTION_TYPE_CARDS.find((c) => c.value === filterType)?.label})`}
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
                            {sortableHead("employee", t("deductions.employee"))}
                            {sortableHead("type", t("deductions.type"))}
                            {sortableHead("description", t("deductions.description"))}
                            {sortableHead("amount", t("deductions.amount"), "right")}
                            {sortableHead("frequency", t("deductions.frequency"))}
                            {sortableHead("status", t("deductions.status"))}
                            <TableHead className="text-right">{t("deductions.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedDeductions.map((deduction) => (
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
                                {deduction.type === "advance_repayment" && deduction.remainingBalance !== undefined && (
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={t("deductions.edit") || "Edit"}
                                    aria-label={t("deductions.edit") || "Edit"}
                                    onClick={() => openEditDialog(deduction)}
                                  >
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
            </CardContent>
          </Card>
        </div>

      {/* Add / Edit Deduction Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          } else {
            setShowAddDialog(true);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDeduction
                ? t("deductions.editDialogTitle") || "Edit Deduction"
                : t("deductions.addDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingDeduction
                ? t("deductions.editDialogDescription") ||
                  "Update this deduction. Advance repayment progress is kept — the remaining balance only changes if you change the total amount."
                : t("deductions.addDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="employee">{t("deductions.employeeLabel")}</Label>
              {editingDeduction ? (
                // Identity field: an edited doc keeps its employee (its settled
                // history is meaningless under someone else). Plain input so
                // inactive employees still show a name.
                <Input
                  id="employee"
                  value={getEmployeeName(editingDeduction.employeeId)}
                  disabled
                />
              ) : (
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
              )}
            </div>

            <div>
              <Label htmlFor="deduction-type">{t("deductions.typeLabel")}</Label>
              {editingDeduction ? (
                // Identity field: type fixes the engine slot the doc feeds, so
                // it cannot change after settlements. Plain input so types
                // outside the create list still display.
                <Input
                  id="deduction-type"
                  value={
                    DEDUCTION_TYPES.find((tp) => tp.value === editingDeduction.type)
                      ?.label || editingDeduction.type
                  }
                  disabled
                />
              ) : (
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
              )}
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

            {deductionType === "advance_repayment" && (
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
                {editingDeduction && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("deductions.editTotalHint") ||
                      "Changing the total keeps what has already been repaid — the remaining balance becomes the new total minus the amount repaid so far."}
                  </p>
                )}
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
            <Button variant="outline" onClick={closeDialog}>
              {t("deductions.cancel")}
            </Button>
            <Button
              onClick={editingDeduction ? handleSaveEdit : handleAddDeduction}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("deductions.saving")}
                </>
              ) : editingDeduction ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("deductions.saveChanges") || "Save Changes"}
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
