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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  FileText,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Filter,
  Trash2,
  Calculator,
  ChevronRight,
  Lock,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { accountingService } from "@/services/accountingService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { JournalEntry, JournalEntryLine, Account } from "@/types/accounting";
import { SEO, seoConfig } from "@/components/SEO";

interface EntryLineForm {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
}

export default function JournalEntries() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  // Expanded entries state
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // New entry form
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryDescription, setEntryDescription] = useState("");
  const [entryLines, setEntryLines] = useState<EntryLineForm[]>([
    { accountId: "", accountCode: "", accountName: "", debit: "", credit: "", description: "" },
    { accountId: "", accountCode: "", accountName: "", debit: "", credit: "", description: "" },
  ]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesData, accountsData] = await Promise.all([
        accountingService.journalEntries.getAllJournalEntries({
          fiscalYear: parseInt(yearFilter),
        }),
        accountingService.accounts.getAllAccounts(),
      ]);
      setEntries(entriesData);
      setAccounts(accountsData.filter((a) => a.isActive));
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: "Failed to load journal entries.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (sourceFilter !== "all" && entry.source !== sourceFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          entry.entryNumber.toLowerCase().includes(term) ||
          entry.description.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [entries, statusFilter, sourceFilter, searchTerm]);

  // Toggle entry expansion
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  // Check if entry is from payroll (locked)
  const isLockedEntry = (source: JournalEntry["source"] | undefined) => {
    return source === "payroll";
  };

  // Calculate totals for form
  const formTotals = useMemo(() => {
    const totalDebit = entryLines.reduce(
      (sum, line) => sum + (parseFloat(line.debit) || 0),
      0
    );
    const totalCredit = entryLines.reduce(
      (sum, line) => sum + (parseFloat(line.credit) || 0),
      0
    );
    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01;

    return { totalDebit, totalCredit, difference, isBalanced };
  }, [entryLines]);

  // Status badge
  const getStatusBadge = (status: JournalEntry["status"]) => {
    switch (status) {
      case "posted":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Posted
          </Badge>
        );
      case "draft":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "void":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Void
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Source badge
  const getSourceBadge = (source: JournalEntry["source"] | undefined) => {
    if (!source) {
      return <Badge className="bg-gray-100 text-gray-800">Manual</Badge>;
    }
    const colors: Record<string, string> = {
      manual: "bg-gray-100 text-gray-800",
      payroll: "bg-blue-100 text-blue-800",
      invoice: "bg-purple-100 text-purple-800",
      adjustment: "bg-orange-100 text-orange-800",
      opening: "bg-green-100 text-green-800",
      expense: "bg-red-100 text-red-800",
      revenue: "bg-emerald-100 text-emerald-800",
      receipt: "bg-cyan-100 text-cyan-800",
      payment: "bg-amber-100 text-amber-800",
    };

    return (
      <Badge className={colors[source] || "bg-gray-100 text-gray-800"}>
        {source.charAt(0).toUpperCase() + source.slice(1)}
      </Badge>
    );
  };

  // Add line to entry
  const addLine = () => {
    setEntryLines([
      ...entryLines,
      { accountId: "", accountCode: "", accountName: "", debit: "", credit: "", description: "" },
    ]);
  };

  // Remove line from entry
  const removeLine = (index: number) => {
    if (entryLines.length <= 2) {
      toast({
        title: "Error",
        description: "Journal entry must have at least 2 lines.",
        variant: "destructive",
      });
      return;
    }
    setEntryLines(entryLines.filter((_, i) => i !== index));
  };

  // Update line
  const updateLine = (index: number, field: keyof EntryLineForm, value: string) => {
    const newLines = [...entryLines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If account selected, populate account info
    if (field === "accountId" && value) {
      const account = accounts.find((a) => a.id === value);
      if (account) {
        newLines[index].accountCode = account.code;
        newLines[index].accountName = account.name;
      }
    }

    // Only debit OR credit can have value
    if (field === "debit" && value) {
      newLines[index].credit = "";
    } else if (field === "credit" && value) {
      newLines[index].debit = "";
    }

    setEntryLines(newLines);
  };

  // Submit new entry
  const handleSubmit = async (asDraft: boolean = false) => {
    if (!entryDate || !entryDescription) {
      toast({
        title: "Validation Error",
        description: "Date and description are required.",
        variant: "destructive",
      });
      return;
    }

    if (!formTotals.isBalanced) {
      toast({
        title: "Validation Error",
        description: "Debits must equal credits.",
        variant: "destructive",
      });
      return;
    }

    // Validate lines have accounts
    const validLines = entryLines.filter((l) => l.accountId);
    if (validLines.length < 2) {
      toast({
        title: "Validation Error",
        description: "At least 2 lines with accounts are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const year = new Date(entryDate).getFullYear();
      const month = new Date(entryDate).getMonth() + 1;
      const entryNumber = await accountingService.journalEntries.getNextEntryNumber(year);

      const lines: JournalEntryLine[] = validLines.map((line, index) => ({
        lineNumber: index + 1,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: parseFloat(line.debit) || 0,
        credit: parseFloat(line.credit) || 0,
        description: line.description,
      }));

      const entry: Omit<JournalEntry, "id" | "createdAt"> = {
        entryNumber,
        date: entryDate,
        description: entryDescription,
        source: "manual",
        lines,
        totalDebit: formTotals.totalDebit,
        totalCredit: formTotals.totalCredit,
        status: asDraft ? "draft" : "posted",
        fiscalYear: year,
        fiscalPeriod: month,
        createdBy: "current-user", // TODO: Get from auth
      };

      if (!asDraft) {
        entry.postedAt = new Date();
        entry.postedBy = "current-user";
      }

      await accountingService.journalEntries.createJournalEntry(entry);

      toast({
        title: "Success",
        description: `Journal entry ${entryNumber} ${asDraft ? "saved as draft" : "posted"}.`,
      });

      await loadData();
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create entry:", error);
      toast({
        title: "Error",
        description: "Failed to create journal entry.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split("T")[0]);
    setEntryDescription("");
    setEntryLines([
      { accountId: "", accountCode: "", accountName: "", debit: "", credit: "", description: "" },
      { accountId: "", accountCode: "", accountName: "", debit: "", credit: "", description: "" },
    ]);
  };

  // View entry details
  const viewDetails = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setShowDetailsDialog(true);
  };

  // Summary stats
  const stats = useMemo(() => {
    const posted = entries.filter((e) => e.status === "posted");
    const drafts = entries.filter((e) => e.status === "draft");
    const totalDebit = posted.reduce((sum, e) => sum + e.totalDebit, 0);

    return {
      total: entries.length,
      posted: posted.length,
      drafts: drafts.length,
      totalDebit,
    };
  }, [entries]);

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
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16" />
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
      <SEO {...seoConfig.journalEntries} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-orange-50 dark:bg-orange-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Journal Entries
                </h1>
                <p className="text-muted-foreground mt-1">
                  Lançamentos Contábeis - Review accounting entries from payroll and operations
                </p>
              </div>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <div className="flex flex-col items-end gap-1">
                    <Button onClick={resetForm} variant="outline" size="sm" className="border-orange-300 hover:border-orange-400 hover:bg-orange-50">
                      <Plus className="h-4 w-4 mr-2" />
                      Manual Entry
                    </Button>
                    <span className="text-xs text-muted-foreground">For non-payroll adjustments only</span>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Journal Entry</DialogTitle>
                    <DialogDescription>
                      Enter debits and credits. Total must balance.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="entry-date">Date *</Label>
                        <Input
                          id="entry-date"
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description *</Label>
                        <Input
                          id="description"
                          value={entryDescription}
                          onChange={(e) => setEntryDescription(e.target.value)}
                          placeholder="e.g., Monthly payroll"
                          required
                        />
                      </div>
                    </div>

                    {/* Entry Lines */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Entry Lines</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addLine}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Line
                        </Button>
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-64">Account</TableHead>
                              <TableHead className="w-32">Debit</TableHead>
                              <TableHead className="w-32">Credit</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entryLines.map((line, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Select
                                    value={line.accountId}
                                    onValueChange={(v) => updateLine(index, "accountId", v)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {accounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id!}>
                                          {acc.code} - {acc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={line.debit}
                                    onChange={(e) => updateLine(index, "debit", e.target.value)}
                                    placeholder="0.00"
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={line.credit}
                                    onChange={(e) => updateLine(index, "credit", e.target.value)}
                                    placeholder="0.00"
                                    className="text-right"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={line.description}
                                    onChange={(e) =>
                                      updateLine(index, "description", e.target.value)
                                    }
                                    placeholder="Optional"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeLine(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Totals row */}
                            <TableRow className="bg-gray-50 font-semibold">
                              <TableCell>Totals</TableCell>
                              <TableCell className="text-right">
                                {formatCurrencyTL(formTotals.totalDebit)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrencyTL(formTotals.totalCredit)}
                              </TableCell>
                              <TableCell colSpan={2}>
                                {formTotals.isBalanced ? (
                                  <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    Balanced
                                  </span>
                                ) : (
                                  <span className="text-red-600">
                                    Difference: {formatCurrencyTL(formTotals.difference)}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddDialog(false)}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleSubmit(true)}
                        disabled={submitting}
                      >
                        Save as Draft
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        disabled={submitting || !formTotals.isBalanced}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          "Post Entry"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground/70">for {yearFilter}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-green-600 dark:text-green-400">Posted</p>
                <p className="text-2xl font-bold">{stats.posted}</p>
                <p className="text-xs text-muted-foreground/70">entries finalized</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Drafts</p>
                <p className="text-2xl font-bold">{stats.drafts}</p>
                <p className="text-xs text-muted-foreground/70">pending review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Debits</p>
                <p className="text-2xl font-bold">{formatCurrencyTL(stats.totalDebit)}</p>
                <p className="text-xs text-muted-foreground/70">posted entries for {yearFilter}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by entry number or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-36">
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="opening">Opening</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2026, 2025, 2024].map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entries Table - Grouped by Journal Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Journal Entries</CardTitle>
              <CardDescription>
                Showing {filteredEntries.length} entries for {yearFilter}
                {sourceFilter !== "all" && ` • Source: ${sourceFilter}`}
                {statusFilter !== "all" && ` • Status: ${statusFilter}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No journal entries found</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Journal entries are typically generated from payroll runs
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEntries.map((entry) => {
                    const isExpanded = expandedEntries.has(entry.id!);
                    const isLocked = isLockedEntry(entry.source);
                    const isBalanced = Math.abs(entry.totalDebit - entry.totalCredit) < 0.01;

                    return (
                      <Collapsible
                        key={entry.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpanded(entry.id!)}
                      >
                        {/* Entry Header Row */}
                        <div className="border rounded-lg overflow-hidden bg-card hover:bg-muted/30 transition-colors">
                          <CollapsibleTrigger asChild>
                            <button className="w-full px-4 py-3 flex items-center gap-4 text-left">
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                              <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                                {/* Entry Number + Lock */}
                                <div className="col-span-2 flex items-center gap-2">
                                  <code className="font-mono text-sm font-medium">
                                    {entry.entryNumber}
                                  </code>
                                  {isLocked && (
                                    <span title="Linked to payroll run">
                                      <Lock className="h-3 w-3 text-blue-500" />
                                    </span>
                                  )}
                                </div>

                                {/* Date */}
                                <div className="col-span-1 text-sm text-muted-foreground">
                                  {new Date(entry.date).toLocaleDateString()}
                                </div>

                                {/* Description */}
                                <div className="col-span-4">
                                  <span className="text-sm font-medium line-clamp-1">
                                    {entry.description}
                                  </span>
                                </div>

                                {/* Source */}
                                <div className="col-span-1">
                                  {getSourceBadge(entry.source)}
                                </div>

                                {/* Balanced Totals */}
                                <div className="col-span-2 text-right">
                                  <span className="font-mono text-sm font-semibold">
                                    {formatCurrencyTL(entry.totalDebit)}
                                  </span>
                                  {isBalanced ? (
                                    <CheckCircle className="h-3 w-3 text-green-500 inline ml-1" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-red-500 inline ml-1" />
                                  )}
                                </div>

                                {/* Status */}
                                <div className="col-span-2">
                                  {getStatusBadge(entry.status)}
                                </div>
                              </div>
                            </button>
                          </CollapsibleTrigger>

                          {/* Expanded Lines */}
                          <CollapsibleContent>
                            <div className="border-t bg-muted/20">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-16"></TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead className="text-right w-32">Debit</TableHead>
                                    <TableHead className="text-right w-32">Credit</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entry.lines.map((line, index) => (
                                    <TableRow key={index} className="hover:bg-muted/30">
                                      <TableCell></TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs text-muted-foreground">
                                            {line.accountCode}
                                          </code>
                                          <span className="text-sm">{line.accountName}</span>
                                        </div>
                                        {line.description && (
                                          <p className="text-xs text-muted-foreground mt-0.5 pl-12">
                                            {line.description}
                                          </p>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {line.debit > 0 ? formatCurrencyTL(line.debit) : "-"}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {line.credit > 0 ? formatCurrencyTL(line.credit) : "-"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {/* Totals Row */}
                                  <TableRow className="bg-muted/50 font-semibold border-t">
                                    <TableCell></TableCell>
                                    <TableCell className="text-sm">Total</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrencyTL(entry.totalDebit)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrencyTL(entry.totalCredit)}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>

                              {/* Entry metadata footer */}
                              <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t">
                                <div className="flex items-center gap-4">
                                  {isLocked && (
                                    <span className="flex items-center gap-1">
                                      <Lock className="h-3 w-3" />
                                      Linked to payroll run
                                    </span>
                                  )}
                                  {entry.sourceRef && (
                                    <span>Ref: {entry.sourceRef}</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewDetails(entry);
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Full Details
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Journal Entry {selectedEntry?.entryNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">
                    {new Date(selectedEntry.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p>{getSourceBadge(selectedEntry.source)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p>{getStatusBadge(selectedEntry.status)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <code className="text-sm">{line.accountCode}</code>
                            <span className="ml-2">{line.accountName}</span>
                          </div>
                          {line.description && (
                            <p className="text-sm text-gray-500">{line.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {line.debit > 0 ? formatCurrencyTL(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {line.credit > 0 ? formatCurrencyTL(line.credit) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrencyTL(selectedEntry.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrencyTL(selectedEntry.totalCredit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {selectedEntry.sourceRef && (
                <p className="text-sm text-gray-500">
                  Reference: {selectedEntry.sourceRef}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
