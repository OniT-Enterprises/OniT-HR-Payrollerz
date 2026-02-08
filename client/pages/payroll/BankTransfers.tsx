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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  DollarSign,
  Plus,
  Download,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  FileText,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollService } from "@/services/payrollService";
import { formatCurrency } from "@/lib/payroll/constants";
import type { BankTransfer, PayrollRun } from "@/types/payroll";
import { useAuth } from "@/contexts/AuthContext";
import { SEO, seoConfig } from "@/components/SEO";
import {
  BankCode,
  BankFileResult,
  generateBankFile,
  groupRecordsByBank,
  downloadBankFile,
} from "@/lib/bank-transfers";
import { TL_BANKS } from "@/lib/payroll/constants-tl";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import { settingsService } from "@/services/settingsService";

export default function BankTransfers() {
  const { toast } = useToast();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  // Bank file generation state
  const [showBankFileDialog, setShowBankFileDialog] = useState(false);
  const [selectedBankFileRun, setSelectedBankFileRun] = useState<string>("");
  const [selectedBanks, setSelectedBanks] = useState<BankCode[]>([]);
  const [generatingFiles, setGeneratingFiles] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyName, setCompanyName] = useState("Company");
  const [companyAccount, setCompanyAccount] = useState("");
  const [bankFileSummary, setBankFileSummary] = useState<Record<BankCode, number> | null>(null);

  const [formData, setFormData] = useState({
    payrollRunId: "",
    bankAccount: "",
    transferDate: "",
    notes: "",
  });

  // Bank accounts from settings
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; name: string; accountNumber: string; purpose: string }>>([]);

  // Load transfers and payroll runs
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [transfersData, runsData] = await Promise.all([
          payrollService.transfers.getAllTransfers(tenantId),
          payrollService.runs.getAllPayrollRuns({ tenantId }),
        ]);
        setTransfers(transfersData);
        setPayrollRuns(runsData);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast({
          title: "Error",
          description: "Failed to load transfers. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast, tenantId]);

  // Load employees and company details for bank file generation
  useEffect(() => {
    const loadEmployeesAndSettings = async () => {
      try {
        // Load all employees
        const result = await employeeService.getAllEmployees(tenantId);
        setEmployees(result);

        // Load company details and bank accounts from settings
        if (tenantId && tenantId !== "local-dev-tenant") {
          const settings = await settingsService.getSettings(tenantId);
          if (settings?.companyDetails) {
            setCompanyName(settings.companyDetails.legalName || settings.companyDetails.tradingName || "Company");
          }
          if (settings?.paymentStructure?.bankAccounts) {
            const accounts = settings.paymentStructure.bankAccounts
              .filter((a: any) => a.isActive)
              .map((a: any) => ({
                id: a.id,
                name: `${a.accountName} - ${a.bankName} ****${(a.accountNumber || "").slice(-4)}`,
                accountNumber: a.accountNumber || "",
                purpose: a.purpose || "general",
              }));
            setBankAccounts(accounts);
            // Use the first payroll account (or first available) as company debit account
            const payrollAccount = accounts.find((a: any) => a.purpose === "payroll") || accounts[0];
            if (payrollAccount) {
              setCompanyAccount(payrollAccount.accountNumber);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load employees:", error);
      }
    };
    loadEmployeesAndSettings();
  }, [tenantId]);

  // Payroll records for the selected bank file run
  const [bankFileRecords, setBankFileRecords] = useState<any[]>([]);

  // Load real payroll records and calculate bank file summary when payroll run is selected
  useEffect(() => {
    if (!selectedBankFileRun || employees.length === 0) {
      setBankFileSummary(null);
      setBankFileRecords([]);
      return;
    }

    const loadRecords = async () => {
      try {
        const records = await payrollService.records.getPayrollRecordsByRunId(selectedBankFileRun, tenantId);
        setBankFileRecords(records);

        const grouped = groupRecordsByBank(records as any, employees);
        const summary: Record<BankCode, number> = {
          BNU: grouped.BNU.length,
          MANDIRI: grouped.MANDIRI.length,
          ANZ: grouped.ANZ.length,
          BNCTL: grouped.BNCTL.length,
        };
        setBankFileSummary(summary);

        // Pre-select banks that have employees
        const availableBanks = (Object.keys(summary) as BankCode[]).filter(bank => summary[bank] > 0);
        setSelectedBanks(availableBanks);
      } catch (error) {
        console.error("Failed to load payroll records:", error);
        setBankFileSummary(null);
      }
    };
    loadRecords();
  }, [selectedBankFileRun, employees, tenantId]);

  // Handle bank file generation
  const handleGenerateBankFiles = async () => {
    if (!selectedBankFileRun || selectedBanks.length === 0) {
      toast({
        title: "Error",
        description: "Please select a payroll run and at least one bank.",
        variant: "destructive",
      });
      return;
    }

    const selectedRun = payrollRuns.find(r => r.id === selectedBankFileRun);
    if (!selectedRun) {
      toast({
        title: "Error",
        description: "Selected payroll run not found.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingFiles(true);
    try {
      // Use real payroll records (already loaded when run was selected)
      const records = bankFileRecords.length > 0
        ? bankFileRecords
        : await payrollService.records.getPayrollRecordsByRunId(selectedBankFileRun, tenantId);

      const today = new Date().toISOString().split('T')[0];

      for (const bankCode of selectedBanks) {
        const result = generateBankFile(bankCode, {
          payrollRun: selectedRun as any,
          records: records as any,
          employees,
          valueDate: today,
          companyName,
          companyAccountNumber: companyAccount,
        });

        downloadBankFile(result);

        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      toast({
        title: "Success",
        description: `Generated ${selectedBanks.length} bank file(s) successfully.`,
      });

      setShowBankFileDialog(false);
      setSelectedBankFileRun("");
      setSelectedBanks([]);
    } catch (error) {
      console.error("Failed to generate bank files:", error);
      toast({
        title: "Error",
        description: "Failed to generate bank files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFiles(false);
    }
  };

  const toggleBankSelection = (bankCode: BankCode) => {
    setSelectedBanks(prev =>
      prev.includes(bankCode)
        ? prev.filter(b => b !== bankCode)
        : [...prev, bankCode]
    );
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTransfers = transfers.filter((t) => {
      const transferDate = new Date(t.transferDate);
      return (
        transferDate.getMonth() === currentMonth &&
        transferDate.getFullYear() === currentYear
      );
    });

    const thisMonthTotal = thisMonthTransfers.reduce(
      (sum, t) => sum + t.amount,
      0
    );
    const pendingCount = transfers.filter(
      (t) => t.status === "pending" || t.status === "processing"
    ).length;
    const completedCount = transfers.filter(
      (t) => t.status === "completed"
    ).length;
    const failedCount = transfers.filter((t) => t.status === "failed").length;

    return {
      thisMonthTotal,
      pendingCount,
      completedCount,
      failedCount,
    };
  }, [transfers]);

  // Get unique periods for filter
  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    transfers.forEach((t) => periods.add(t.payrollPeriod));
    return Array.from(periods).sort().reverse();
  }, [transfers]);

  // Get approved/paid payroll runs that haven't been transferred yet
  const availablePayrollRuns = useMemo(() => {
    const transferredRunIds = new Set(transfers.map((t) => t.payrollRunId));
    return payrollRuns.filter(
      (run) =>
        (run.status === "approved" || run.status === "paid") &&
        run.id &&
        !transferredRunIds.has(run.id)
    );
  }, [payrollRuns, transfers]);

  const getStatusBadge = (status: BankTransfer["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.payrollRunId ||
      !formData.bankAccount ||
      !formData.transferDate
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Find the selected payroll run
    const selectedRun = payrollRuns.find((r) => r.id === formData.payrollRunId);
    if (!selectedRun) {
      toast({
        title: "Error",
        description: "Selected payroll run not found.",
        variant: "destructive",
      });
      return;
    }

    // Find the bank account name
    const bankAccount = bankAccounts.find((a) => a.id === formData.bankAccount);

    try {
      setSubmitting(true);

      // Generate reference number
      const now = new Date();
      const reference = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(transfers.length + 1).padStart(3, "0")}`;

      const newTransfer: Omit<BankTransfer, "id" | "createdAt" | "updatedAt"> = {
        payrollRunId: formData.payrollRunId,
        payrollPeriod: `${new Date(selectedRun.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
        amount: selectedRun.totalNetPay,
        employeeCount: selectedRun.employeeCount,
        transferDate: formData.transferDate,
        bankAccountId: formData.bankAccount,
        bankAccountName: bankAccount?.name || formData.bankAccount,
        status: "pending",
        reference,
        initiatedBy: user?.email || "Unknown",
        notes: formData.notes || undefined,
      };

      const transferId = await payrollService.transfers.createTransfer(tenantId, newTransfer);

      // Update local state with the new transfer including its ID
      const createdTransfer: BankTransfer = {
        ...newTransfer,
        id: transferId,
      };
      setTransfers((prev) => [createdTransfer, ...prev]);

      toast({
        title: "Success",
        description: `Bank transfer ${reference} initiated successfully.`,
      });

      setFormData({
        payrollRunId: "",
        bankAccount: "",
        transferDate: "",
        notes: "",
      });
      setShowTransferDialog(false);
    } catch (error) {
      console.error("Failed to create transfer:", error);
      toast({
        title: "Error",
        description: "Failed to initiate transfer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredTransfers.length === 0) {
      toast({
        title: "No Data",
        description: "No transfers to export.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = [
      "Payroll Period",
      "Amount",
      "Employee Count",
      "Transfer Date",
      "Bank Account",
      "Status",
      "Reference",
      "Initiated By",
      "Notes",
    ];

    const rows = filteredTransfers.map((transfer) => [
      transfer.payrollPeriod,
      transfer.amount.toFixed(2),
      transfer.employeeCount.toString(),
      transfer.transferDate,
      transfer.bankAccountName,
      transfer.status,
      transfer.reference,
      transfer.initiatedBy,
      transfer.notes || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank-transfers-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredTransfers.length} transfers to CSV.`,
    });
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      if (
        selectedStatus &&
        selectedStatus !== "all" &&
        transfer.status !== selectedStatus
      )
        return false;
      if (
        selectedPeriod &&
        selectedPeriod !== "all" &&
        transfer.payrollPeriod !== selectedPeriod
      )
        return false;
      return true;
    });
  }, [transfers, selectedStatus, selectedPeriod]);

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
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
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
      <SEO {...seoConfig.bankTransfers} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25">
              <Send className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Bank Transfers
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage payroll bank transfers and transaction history
              </p>
            </div>
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
                      This Month
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(stats.thisMonthTotal)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Pending Transfers
                    </p>
                    <p className="text-2xl font-bold">{stats.pendingCount}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Completed
                    </p>
                    <p className="text-2xl font-bold">{stats.completedCount}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold">{stats.failedCount}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-green-600 dark:text-green-400" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="period-filter">Payroll Period</Label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All periods</SelectItem>
                      {availablePeriods.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Transfer History
                  </CardTitle>
                  <CardDescription>
                    Showing {filteredTransfers.length} transfers
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>

                  {/* Bank File Generation Dialog */}
                  <Dialog open={showBankFileDialog} onOpenChange={setShowBankFileDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                        <FileText className="h-4 w-4 mr-2" />
                        Bank Files
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-green-600" />
                          Generate Bank Transfer Files
                        </DialogTitle>
                        <DialogDescription>
                          Generate bank-specific files for salary payments (BNU, Mandiri, ANZ, BNCTL)
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 mt-4">
                        {/* Payroll Run Selection */}
                        <div>
                          <Label>Select Payroll Run</Label>
                          <Select
                            value={selectedBankFileRun}
                            onValueChange={setSelectedBankFileRun}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a payroll run" />
                            </SelectTrigger>
                            <SelectContent>
                              {payrollRuns
                                .filter(r => r.status === "approved" || r.status === "paid")
                                .map((run) => (
                                  <SelectItem key={run.id} value={run.id || ""}>
                                    {new Date(run.periodStart).toLocaleDateString("en-US", {
                                      month: "long",
                                      year: "numeric",
                                    })}{" "}
                                    - {formatCurrency(run.totalNetPay)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Bank Summary & Selection */}
                        {bankFileSummary && (
                          <div className="space-y-3">
                            <Label>Select Banks to Generate</Label>
                            <div className="grid grid-cols-2 gap-3">
                              {TL_BANKS.map((bank) => {
                                const bankCode = bank.code as BankCode;
                                const count = bankFileSummary[bankCode] || 0;
                                const isSelected = selectedBanks.includes(bankCode);
                                const isDisabled = count === 0;

                                return (
                                  <div
                                    key={bank.code}
                                    className={`
                                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                                      ${isDisabled ? 'bg-gray-50 dark:bg-gray-900 opacity-50 cursor-not-allowed' : ''}
                                      ${isSelected && !isDisabled ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border hover:border-green-300'}
                                    `}
                                    onClick={() => !isDisabled && toggleBankSelection(bankCode)}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onCheckedChange={() => !isDisabled && toggleBankSelection(bankCode)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm">{bank.code}</p>
                                      <p className="text-xs text-muted-foreground truncate">{bank.name}</p>
                                    </div>
                                    <Badge variant={count > 0 ? "default" : "secondary"} className="shrink-0">
                                      {count} emp
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Company Account Info */}
                        {selectedBankFileRun && (
                          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
                            <p className="text-muted-foreground">
                              Files will be generated for <strong>{companyName}</strong>
                            </p>
                            {companyAccount && (
                              <p className="text-muted-foreground">
                                Debit account: ****{companyAccount.slice(-4)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowBankFileDialog(false)}
                            className="flex-1"
                            disabled={generatingFiles}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleGenerateBankFiles}
                            disabled={!selectedBankFileRun || selectedBanks.length === 0 || generatingFiles}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            {generatingFiles ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Generate {selectedBanks.length} File(s)
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={showTransferDialog}
                    onOpenChange={setShowTransferDialog}
                  >
                    <DialogTrigger asChild>
                      <Button disabled={availablePayrollRuns.length === 0}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Transfer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Initiate Bank Transfer</DialogTitle>
                        <DialogDescription>
                          Set up a new payroll bank transfer
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="payroll-run">Payroll Run *</Label>
                          <Select
                            value={formData.payrollRunId}
                            onValueChange={(value) =>
                              handleInputChange("payrollRunId", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select payroll run" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePayrollRuns.map((run) => (
                                <SelectItem key={run.id} value={run.id || ""}>
                                  {new Date(run.periodStart).toLocaleDateString(
                                    "en-US",
                                    { month: "long", year: "numeric" }
                                  )}{" "}
                                  - {formatCurrency(run.totalNetPay)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {availablePayrollRuns.length === 0 && (
                            <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              No approved payroll runs available
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="bank-account">Bank Account *</Label>
                          <Select
                            value={formData.bankAccount}
                            onValueChange={(value) =>
                              handleInputChange("bankAccount", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select bank account" />
                            </SelectTrigger>
                            <SelectContent>
                              {bankAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="transfer-date">Transfer Date *</Label>
                          <Input
                            id="transfer-date"
                            type="date"
                            value={formData.transferDate}
                            onChange={(e) =>
                              handleInputChange("transferDate", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) =>
                              handleInputChange("notes", e.target.value)
                            }
                            placeholder="Optional notes"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowTransferDialog(false)}
                            className="flex-1"
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1"
                            disabled={submitting}
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              "Initiate Transfer"
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No transfers found</p>
                  <p className="text-sm text-muted-foreground/70">
                    {transfers.length === 0
                      ? "Create your first transfer by running payroll and initiating a bank transfer."
                      : "Try adjusting your filters."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payroll Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Transfer Date</TableHead>
                      <TableHead>Bank Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium">
                          {transfer.payrollPeriod}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(transfer.amount)}
                        </TableCell>
                        <TableCell>{transfer.employeeCount}</TableCell>
                        <TableCell>
                          {new Date(transfer.transferDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{transfer.bankAccountName}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {transfer.reference}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
