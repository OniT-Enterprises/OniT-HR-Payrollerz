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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { accountingService } from "@/services/accountingService";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type { JournalEntry, JournalEntryLine, Account } from "@/types/accounting";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          entry.entryNumber.toLowerCase().includes(term) ||
          entry.description.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [entries, statusFilter, searchTerm]);

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
  const getSourceBadge = (source: JournalEntry["source"]) => {
    const colors: Record<string, string> = {
      manual: "bg-gray-100 text-gray-800",
      payroll: "bg-blue-100 text-blue-800",
      invoice: "bg-purple-100 text-purple-800",
      adjustment: "bg-orange-100 text-orange-800",
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
      <MainNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-emerald-500" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Journal Entries
                  </h1>
                  <p className="text-gray-600">
                    Lançamentos Contábeis - Record and manage transactions
                  </p>
                </div>
              </div>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Entry
                  </Button>
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-green-600">Posted</p>
                <p className="text-2xl font-bold">{stats.posted}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-yellow-600">Drafts</p>
                <p className="text-2xl font-bold">{stats.drafts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Total Debits</p>
                <p className="text-2xl font-bold">{formatCurrencyTL(stats.totalDebit)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by entry number or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-40">
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
                <div className="w-32">
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

          {/* Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle>Journal Entries</CardTitle>
              <CardDescription>
                Showing {filteredEntries.length} entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No journal entries found</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    Create Your First Entry
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <code className="font-mono text-sm">
                              {entry.entryNumber}
                            </code>
                          </TableCell>
                          <TableCell>
                            {new Date(entry.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className="line-clamp-1">{entry.description}</span>
                          </TableCell>
                          <TableCell>{getSourceBadge(entry.source)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrencyTL(entry.totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrencyTL(entry.totalCredit)}
                          </TableCell>
                          <TableCell>{getStatusBadge(entry.status)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetails(entry)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
