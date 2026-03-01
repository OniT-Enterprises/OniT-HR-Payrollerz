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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Edit,
  Loader2,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  RefreshCw,
  Lock,
  Calculator,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Account, AccountType, AccountSubType } from "@/types/accounting";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { useAccounts, useCreateAccount, useUpdateAccount, useInitializeChartOfAccounts } from "@/hooks/useAccounting";
import { useAuth } from "@/contexts/AuthContext";

// Payroll-linked account codes - these should not be edited carelessly
const PAYROLL_LINKED_CODES = [
  '1130', // Cash in Bank - Payroll
  '1220', // Employee Advances
  '2200', '2210', '2220', '2230', '2240', '2250', // All Payroll Liabilities
  '5100', '5110', '5120', '5130', '5140', '5150', '5160', '5170', // Payroll Expenses
];

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: accounts = [], isLoading: loading } = useAccounts();
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const initializeMutation = useInitializeChartOfAccounts();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const submitting = createAccountMutation.isPending || updateAccountMutation.isPending;
  const initializing = initializeMutation.isPending;

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    nameTL: "",
    type: "asset" as AccountType,
    subType: "other_asset" as AccountSubType,
    description: "",
    parentAccountId: "",
  });

  // Initialize default chart of accounts
  const handleInitialize = async () => {
    try {
      await initializeMutation.mutateAsync({
        userId: user?.uid || user?.email || "unknown",
        userEmail: user?.email || "unknown",
        userName: user?.displayName || undefined,
      });
      toast({
        title: t("accounting.chartOfAccounts.success"),
        description: t("accounting.chartOfAccounts.initialized"),
      });
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("accounting.chartOfAccounts.errorInit"),
        variant: "destructive",
      });
    }
  };

  // Group accounts by type with deduplication
  const groupedAccounts = useMemo(() => {
    // First, deduplicate by code (in case of data issues)
    const uniqueByCode = new Map<string, Account>();
    accounts.forEach((acc) => {
      if (!uniqueByCode.has(acc.code)) {
        uniqueByCode.set(acc.code, acc);
      }
    });
    const deduped = Array.from(uniqueByCode.values());

    const filtered = deduped.filter((acc) => {
      if (typeFilter !== "all" && acc.type !== typeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          acc.code.toLowerCase().includes(term) ||
          acc.name.toLowerCase().includes(term) ||
          acc.nameTL?.toLowerCase().includes(term)
        );
      }
      return true;
    });

    // Build hierarchy - top level are accounts with level 1 only
    const topLevel = filtered.filter((a) => a.level === 1 || !a.parentAccountId);
    // Children are accounts with level > 1 AND a parent (by id or code)
    const children = filtered.filter((a) => a.level > 1 && (a.parentAccountId || a.parentCode));

    // Remove any topLevel accounts that also appear as children (extra safety)
    const childCodes = new Set(children.map(c => c.code));
    const cleanTopLevel = topLevel.filter(a => !childCodes.has(a.code));

    return { topLevel: cleanTopLevel, children, all: filtered };
  }, [accounts, typeFilter, searchTerm]);

  // Get children of an account
  const getChildren = (parentId: string) => {
    // Support both stored parent document IDs and legacy parent codes
    const parent = accounts.find((a) => a.id === parentId);
    const parentCode = parent?.code;

    return groupedAccounts.children.filter(
      (a) =>
        a.parentAccountId === parentId ||
        (!!parentCode && (a.parentAccountId === parentCode || a.parentCode === parentCode))
    );
  };

  // Toggle expand/collapse
  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // Get type icon and color
  const getTypeConfig = (type: AccountType) => {
    switch (type) {
      case "asset":
        return { icon: Wallet, color: "text-blue-600", bg: "bg-blue-100" };
      case "liability":
        return { icon: Building2, color: "text-red-600", bg: "bg-red-100" };
      case "equity":
        return { icon: PiggyBank, color: "text-purple-600", bg: "bg-purple-100" };
      case "revenue":
        return { icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" };
      case "expense":
        return { icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-100" };
      default:
        return { icon: BookOpen, color: "text-gray-600", bg: "bg-gray-100" };
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast({
        title: t("accounting.chartOfAccounts.validationError"),
        description: t("accounting.chartOfAccounts.codeNameRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingAccount) {
        await updateAccountMutation.mutateAsync({
          id: editingAccount.id!,
          updates: {
            ...formData,
            level: formData.parentAccountId ? 2 : 1,
          },
          audit: {
            userId: user?.uid || user?.email || "unknown",
            userEmail: user?.email || "unknown",
            userName: user?.displayName || undefined,
          },
        });
        toast({
          title: t("accounting.chartOfAccounts.success"),
          description: t("accounting.chartOfAccounts.accountUpdated"),
        });
      } else {
        await createAccountMutation.mutateAsync({
          account: {
            ...formData,
            isSystem: false,
            isActive: true,
            level: formData.parentAccountId ? 2 : 1,
          } as Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
          audit: {
            userId: user?.uid || user?.email || "unknown",
            userEmail: user?.email || "unknown",
            userName: user?.displayName || undefined,
          },
        });
        toast({
          title: t("accounting.chartOfAccounts.success"),
          description: t("accounting.chartOfAccounts.accountCreated"),
        });
      }

      setShowAddDialog(false);
      setEditingAccount(null);
      resetForm();
    } catch (_error) {
      toast({
        title: t("common.error"),
        description: t("accounting.chartOfAccounts.errorSave"),
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      nameTL: "",
      type: "asset",
      subType: "other_asset",
      description: "",
      parentAccountId: "",
    });
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      nameTL: account.nameTL || "",
      type: account.type,
      subType: account.subType,
      description: account.description || "",
      parentAccountId: account.parentAccountId || "",
    });
    setShowAddDialog(true);
  };

  // Check if account is payroll-linked
  const isPayrollLinked = (code: string) => PAYROLL_LINKED_CODES.includes(code);

  // Render account row with hierarchy
  const renderAccountRow = (account: Account, depth: number = 0) => {
    const children = getChildren(account.id!);
    const hasChildren = children.length > 0;
    const isExpanded = expandedAccounts.has(account.id!);
    const typeConfig = getTypeConfig(account.type);
    const TypeIcon = typeConfig.icon;
    const payrollLinked = isPayrollLinked(account.code);

    return (
      <React.Fragment key={account.id}>
        <TableRow className={depth > 0 ? "bg-muted/30" : ""}>
          <TableCell>
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id!)}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="w-5" />
              )}
              <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                {account.code}
              </code>
            </div>
          </TableCell>
          <TableCell>
            <div>
              <p className="font-medium">{account.name}</p>
              {account.nameTL && (
                <p className="text-xs text-muted-foreground italic">{account.nameTL}</p>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge className={`${typeConfig.bg} ${typeConfig.color} dark:bg-opacity-20`}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {t(`accounting.chartOfAccounts.${account.type}`)}
            </Badge>
          </TableCell>
          <TableCell>
            <span className="text-sm text-muted-foreground">
              {t(`accounting.chartOfAccounts.subTypes.${account.subType}`)}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1.5 flex-wrap">
              {account.isSystem ? (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Lock className="h-3 w-3" />
                  {t("accounting.chartOfAccounts.system")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">{t("accounting.chartOfAccounts.custom")}</Badge>
              )}
              {payrollLinked && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 text-xs">
                  <Calculator className="h-3 w-3" />
                  {t("accounting.chartOfAccounts.payroll")}
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            {!account.isSystem ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(account)}
                title={t("accounting.chartOfAccounts.edit")}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        </TableRow>
        {isExpanded &&
          children.map((child) => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  // Summary stats
  const stats = useMemo(() => {
    return {
      total: accounts.length,
      assets: accounts.filter((a) => a.type === "asset").length,
      liabilities: accounts.filter((a) => a.type === "liability").length,
      equity: accounts.filter((a) => a.type === "equity").length,
      revenue: accounts.filter((a) => a.type === "revenue").length,
      expenses: accounts.filter((a) => a.type === "expense").length,
    };
  }, [accounts]);

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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-48" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-24" />
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
      <SEO {...seoConfig.chartOfAccounts} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("accounting.chartOfAccounts.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("accounting.chartOfAccounts.subtitle")}
                </p>
              </div>
            </div>
              <div className="flex items-center gap-3">
                {accounts.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={handleInitialize}
                    disabled={initializing}
                  >
                    {initializing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("accounting.chartOfAccounts.initializingBtn")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t("accounting.chartOfAccounts.initializeDefaults")}
                      </>
                    )}
                  </Button>
                )}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => { setEditingAccount(null); resetForm(); }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("accounting.chartOfAccounts.addAccount")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingAccount ? t("accounting.chartOfAccounts.editAccount") : t("accounting.chartOfAccounts.addNewAccount")}
                      </DialogTitle>
                      <DialogDescription>
                        {editingAccount
                          ? t("accounting.chartOfAccounts.editAccountDesc")
                          : t("accounting.chartOfAccounts.addAccountDesc")}
                      </DialogDescription>
                    </DialogHeader>
                    {/* Warning for account changes */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-amber-800 dark:text-amber-200">
                        {t("accounting.chartOfAccounts.warning")}
                      </p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="code">{t("accounting.chartOfAccounts.accountCode")}</Label>
                          <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                              setFormData({ ...formData, code: e.target.value })
                            }
                            placeholder={t("accounting.chartOfAccounts.accountCodePlaceholder")}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="type">{t("accounting.chartOfAccounts.accountType")}</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(v) => {
                              const newType = v as AccountType;
                              const defaultSubTypes: Record<AccountType, AccountSubType> = {
                                asset: 'other_asset',
                                liability: 'other_liability',
                                equity: 'owner_equity',
                                revenue: 'service_revenue',
                                expense: 'other_expense',
                              };
                              setFormData({ ...formData, type: newType, subType: defaultSubTypes[newType] });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">{t("accounting.chartOfAccounts.asset")}</SelectItem>
                              <SelectItem value="liability">{t("accounting.chartOfAccounts.liability")}</SelectItem>
                              <SelectItem value="equity">{t("accounting.chartOfAccounts.equity")}</SelectItem>
                              <SelectItem value="revenue">{t("accounting.chartOfAccounts.revenue")}</SelectItem>
                              <SelectItem value="expense">{t("accounting.chartOfAccounts.expense")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t("accounting.chartOfAccounts.subType")}</Label>
                          <Select
                            value={formData.subType}
                            onValueChange={(v) =>
                              setFormData({ ...formData, subType: v as AccountSubType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {({
                                asset: ['cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid_expense', 'fixed_asset', 'accumulated_depreciation', 'other_asset'],
                                liability: ['accounts_payable', 'accrued_expense', 'salaries_payable', 'tax_payable', 'inss_payable', 'loans_payable', 'other_liability'],
                                equity: ['share_capital', 'retained_earnings', 'owner_equity', 'dividends'],
                                revenue: ['service_revenue', 'sales_revenue', 'interest_income', 'other_income'],
                                expense: ['salary_expense', 'inss_expense', 'rent_expense', 'utilities_expense', 'office_supplies', 'depreciation_expense', 'tax_expense', 'other_expense'],
                              } as Record<string, string[]>)[formData.type]?.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {t(`accounting.chartOfAccounts.subTypes.${value}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="name">{t("accounting.chartOfAccounts.accountNameEn")}</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder={t("accounting.chartOfAccounts.accountNameEnPlaceholder")}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nameTL">{t("accounting.chartOfAccounts.accountNameTet")}</Label>
                        <Input
                          id="nameTL"
                          value={formData.nameTL}
                          onChange={(e) =>
                            setFormData({ ...formData, nameTL: e.target.value })
                          }
                          placeholder={t("accounting.chartOfAccounts.accountNameTetPlaceholder")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="parentAccount">{t("accounting.chartOfAccounts.parentAccount")}</Label>
                        <Select
                          value={formData.parentAccountId || "_none_"}
                          onValueChange={(v) =>
                            setFormData({ ...formData, parentAccountId: v === "_none_" ? "" : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("accounting.chartOfAccounts.noneTopLevel")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">{t("accounting.chartOfAccounts.noneTopLevel")}</SelectItem>
                            {accounts
                              .filter((a) => a.type === formData.type && a.level === 1)
                              .map((a) => (
                                <SelectItem key={a.id} value={a.id!}>
                                  {a.code} - {a.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="description">{t("accounting.chartOfAccounts.description")}</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder={t("accounting.chartOfAccounts.descriptionPlaceholder")}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowAddDialog(false)}
                          className="flex-1"
                          disabled={submitting}
                        >
                          {t("accounting.chartOfAccounts.cancel")}
                        </Button>
                        <Button type="submit" className="flex-1" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {t("accounting.chartOfAccounts.saving")}
                            </>
                          ) : editingAccount ? (
                            t("accounting.chartOfAccounts.updateAccount")
                          ) : (
                            t("accounting.chartOfAccounts.createAccount")
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{t("accounting.chartOfAccounts.total")}</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">{t("accounting.chartOfAccounts.assets")}</p>
                <p className="text-xl font-bold">{stats.assets}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-red-600 dark:text-red-400">{t("accounting.chartOfAccounts.liabilities")}</p>
                <p className="text-xl font-bold">{stats.liabilities}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-purple-600 dark:text-purple-400">{t("accounting.chartOfAccounts.equityLabel")}</p>
                <p className="text-xl font-bold">{stats.equity}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-green-600 dark:text-green-400">{t("accounting.chartOfAccounts.revenueLabel")}</p>
                <p className="text-xl font-bold">{stats.revenue}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-orange-600 dark:text-orange-400">{t("accounting.chartOfAccounts.expenses")}</p>
                <p className="text-xl font-bold">{stats.expenses}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("accounting.chartOfAccounts.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("accounting.chartOfAccounts.typeFilter")}</span>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder={t("accounting.chartOfAccounts.allTypes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("accounting.chartOfAccounts.allTypes")}</SelectItem>
                      <SelectItem value="asset">
                        <span className="flex items-center gap-2">
                          <Wallet className="h-3.5 w-3.5 text-blue-600" />
                          {t("accounting.chartOfAccounts.assets")}
                        </span>
                      </SelectItem>
                      <SelectItem value="liability">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-red-600" />
                          {t("accounting.chartOfAccounts.liabilities")}
                        </span>
                      </SelectItem>
                      <SelectItem value="equity">
                        <span className="flex items-center gap-2">
                          <PiggyBank className="h-3.5 w-3.5 text-purple-600" />
                          {t("accounting.chartOfAccounts.equityLabel")}
                        </span>
                      </SelectItem>
                      <SelectItem value="revenue">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                          {t("accounting.chartOfAccounts.revenueLabel")}
                        </span>
                      </SelectItem>
                      <SelectItem value="expense">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-3.5 w-3.5 text-orange-600" />
                          {t("accounting.chartOfAccounts.expenses")}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accounts Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t("accounting.chartOfAccounts.accounts")}</CardTitle>
              <CardDescription>
                {t("accounting.chartOfAccounts.showingAccounts", { shown: String(groupedAccounts.all.length), total: String(accounts.length) })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <img src="/images/illustrations/empty-accounting.webp" alt="No accounts yet" className="w-32 h-32 mx-auto mb-4 drop-shadow-lg" />
                  <p className="text-muted-foreground mb-4">{t("accounting.chartOfAccounts.noAccountsFound")}</p>
                  <Button onClick={handleInitialize} disabled={initializing}>
                    {initializing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("accounting.chartOfAccounts.initializingBtn")}
                      </>
                    ) : (
                      t("accounting.chartOfAccounts.initializeDefault")
                    )}
                  </Button>
                </div>
              ) : groupedAccounts.all.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("accounting.chartOfAccounts.noAccountsMatch")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">{t("accounting.chartOfAccounts.code")}</TableHead>
                        <TableHead>{t("accounting.chartOfAccounts.name")}</TableHead>
                        <TableHead className="w-32">{t("accounting.chartOfAccounts.type")}</TableHead>
                        <TableHead className="w-40">{t("accounting.chartOfAccounts.subType")}</TableHead>
                        <TableHead className="w-32">{t("accounting.chartOfAccounts.status")}</TableHead>
                        <TableHead className="w-16">{t("accounting.chartOfAccounts.edit")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedAccounts.topLevel.map((account) =>
                        renderAccountRow(account)
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
