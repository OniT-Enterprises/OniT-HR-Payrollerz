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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { accountingService } from "@/services/accountingService";
import type { Account, AccountType, AccountSubType } from "@/types/accounting";
import { SEO, seoConfig } from "@/components/SEO";

// Payroll-linked account codes - these should not be edited carelessly
const PAYROLL_LINKED_CODES = [
  '1130', // Cash in Bank - Payroll
  '1220', // Employee Advances
  '2200', '2210', '2220', '2230', '2240', '2250', // All Payroll Liabilities
  '5100', '5110', '5120', '5130', '5140', '5150', '5160', '5170', // Payroll Expenses
];

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    nameTL: "",
    type: "asset" as AccountType,
    subType: "other_asset" as AccountSubType,
    description: "",
    parentAccountId: "",
  });

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountingService.accounts.getAllAccounts();
      setAccounts(data);
    } catch (error) {
      console.error("Failed to load accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load chart of accounts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize default chart of accounts
  const handleInitialize = async () => {
    try {
      setInitializing(true);
      await accountingService.accounts.initializeChartOfAccounts();
      await loadAccounts();
      toast({
        title: "Success",
        description: "Chart of accounts initialized with default TL accounts.",
      });
    } catch (error) {
      console.error("Failed to initialize:", error);
      toast({
        title: "Error",
        description: "Failed to initialize chart of accounts.",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
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
        title: "Validation Error",
        description: "Account code and name are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingAccount) {
        await accountingService.accounts.updateAccount(editingAccount.id!, {
          ...formData,
          level: formData.parentAccountId ? 2 : 1,
        });
        toast({
          title: "Success",
          description: "Account updated successfully.",
        });
      } else {
        await accountingService.accounts.createAccount({
          ...formData,
          isSystem: false,
          isActive: true,
          level: formData.parentAccountId ? 2 : 1,
        });
        toast({
          title: "Success",
          description: "Account created successfully.",
        });
      }

      await loadAccounts();
      setShowAddDialog(false);
      setEditingAccount(null);
      resetForm();
    } catch (error) {
      console.error("Failed to save account:", error);
      toast({
        title: "Error",
        description: "Failed to save account.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
              {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
            </Badge>
          </TableCell>
          <TableCell>
            <span className="text-sm text-muted-foreground capitalize">
              {account.subType.replace(/_/g, " ")}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1.5 flex-wrap">
              {account.isSystem ? (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Lock className="h-3 w-3" />
                  System
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Custom</Badge>
              )}
              {payrollLinked && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 text-xs">
                  <Calculator className="h-3 w-3" />
                  Payroll
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
                title={payrollLinked ? "Edit (affects payroll)" : "Edit account"}
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
                  Chart of Accounts
                </h1>
                <p className="text-muted-foreground mt-1">
                  Plano de Contas - Manage your accounting structure
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
                        Initializing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Initialize Defaults
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
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingAccount ? "Edit Account" : "Add New Account"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingAccount
                          ? "Update account details"
                          : "Create a new account in your chart of accounts"}
                      </DialogDescription>
                    </DialogHeader>
                    {/* Warning for account changes */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-amber-800 dark:text-amber-200">
                        Changing accounts affects financial reports and payroll calculations. Only modify if you understand the impact.
                      </p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="code">Account Code *</Label>
                          <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                              setFormData({ ...formData, code: e.target.value })
                            }
                            placeholder="e.g., 1100"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="type">Type *</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(v) =>
                              setFormData({ ...formData, type: v as AccountType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">Asset</SelectItem>
                              <SelectItem value="liability">Liability</SelectItem>
                              <SelectItem value="equity">Equity</SelectItem>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="name">Account Name (English) *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="e.g., Cash on Hand"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nameTL">Account Name (Tetun)</Label>
                        <Input
                          id="nameTL"
                          value={formData.nameTL}
                          onChange={(e) =>
                            setFormData({ ...formData, nameTL: e.target.value })
                          }
                          placeholder="e.g., Kaixa"
                        />
                      </div>
                      <div>
                        <Label htmlFor="parentAccount">Parent Account</Label>
                        <Select
                          value={formData.parentAccountId || "_none_"}
                          onValueChange={(v) =>
                            setFormData({ ...formData, parentAccountId: v === "_none_" ? "" : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None (top-level)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">None (top-level)</SelectItem>
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
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="Optional description"
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
                          Cancel
                        </Button>
                        <Button type="submit" className="flex-1" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : editingAccount ? (
                            "Update Account"
                          ) : (
                            "Create Account"
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
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">Assets</p>
                <p className="text-xl font-bold">{stats.assets}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-red-600 dark:text-red-400">Liabilities</p>
                <p className="text-xl font-bold">{stats.liabilities}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-purple-600 dark:text-purple-400">Equity</p>
                <p className="text-xl font-bold">{stats.equity}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-green-600 dark:text-green-400">Revenue</p>
                <p className="text-xl font-bold">{stats.revenue}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3">
                <p className="text-xs text-orange-600 dark:text-orange-400">Expenses</p>
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
                      placeholder="Search by code (e.g., 5110) or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Type:</span>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="asset">
                        <span className="flex items-center gap-2">
                          <Wallet className="h-3.5 w-3.5 text-blue-600" />
                          Assets
                        </span>
                      </SelectItem>
                      <SelectItem value="liability">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-red-600" />
                          Liabilities
                        </span>
                      </SelectItem>
                      <SelectItem value="equity">
                        <span className="flex items-center gap-2">
                          <PiggyBank className="h-3.5 w-3.5 text-purple-600" />
                          Equity
                        </span>
                      </SelectItem>
                      <SelectItem value="revenue">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                          Revenue
                        </span>
                      </SelectItem>
                      <SelectItem value="expense">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-3.5 w-3.5 text-orange-600" />
                          Expenses
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
              <CardTitle className="text-lg">Accounts</CardTitle>
              <CardDescription>
                Showing {groupedAccounts.all.length} of {accounts.length} accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No accounts found</p>
                  <Button onClick={handleInitialize} disabled={initializing}>
                    {initializing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      "Initialize Default Chart of Accounts"
                    )}
                  </Button>
                </div>
              ) : groupedAccounts.all.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No accounts match your search</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Type</TableHead>
                        <TableHead className="w-40">Sub-Type</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-16">Edit</TableHead>
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
