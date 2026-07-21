import React, { useEffect, useState, useMemo, useRef } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  Plus,
  Copy,
  Download,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Filter,
  Loader2,
  RefreshCw,
  FileText,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  useBankTransfers,
  usePayrollRuns,
  usePayrollRecordsByRun,
  useCreateBankTransfer,
  useUpdateBankTransferStatus,
  useMarkPayrollRunAsPaid,
} from "@/hooks/usePayroll";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { formatCurrency } from "@/lib/payroll/constants";
import type { BankTransfer } from "@/types/payroll";
import { useAuth } from "@/contexts/AuthContext";
import { SEO, seoConfig } from "@/components/SEO";
import {
  BANK_FORMAT_CONFIDENCE,
  BankCode,
  generateBankFile,
  groupRecordsByBank,
  downloadBankFile,
  validateBankTransferRecords,
} from "@/lib/bank-transfers";
import {
  buildBankCoverEmail,
  generatePaymentPackXlsx,
  supportsPaymentPack,
} from "@/lib/bank-transfers/payment-pack";
import { downloadBlob } from "@/lib/downloadBlob";
import { TL_BANKS } from "@/lib/payroll/constants-tl";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { settingsService } from "@/services/settingsService";
import { useI18n } from "@/i18n/I18nProvider";
import { getTodayTL, formatDateTL } from "@/lib/dateUtils";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";

// Columns the transfers table can be sorted by (Actions is not sortable)
type BankTransferSortKey =
  | "payrollPeriod"
  | "amount"
  | "employees"
  | "transferDate"
  | "bankAccount"
  | "status"
  | "reference";

export default function BankTransfers() {
  const { toast } = useToast();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { canManage } = useTenant();
  const canManageTenant = canManage();
  const { t } = useI18n();
  // ─── React Query data fetching ──────────────────────────────────
  const transferQuery = useBankTransfers();
  const payrollRunsQuery = usePayrollRuns();
  const transfers = useMemo(
    () => transferQuery.data ?? [],
    [transferQuery.data],
  );
  const payrollRuns = useMemo(
    () => payrollRunsQuery.data ?? [],
    [payrollRunsQuery.data],
  );
  const loadingTransfers = transferQuery.isLoading;
  const loadingRuns = payrollRunsQuery.isLoading;
  const createTransferMutation = useCreateBankTransfer();
  const updateTransferStatusMutation = useUpdateBankTransferStatus();
  const markRunPaidMutation = useMarkPayrollRunAsPaid();

  const settingsQuery = useQuery({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: () => settingsService.getSettings(tenantId),
    enabled: canManageTenant,
    staleTime: 10 * 60 * 1000,
  });
  const companySettings = settingsQuery.data;

  const companyName =
    companySettings?.companyDetails?.legalName ||
    companySettings?.companyDetails?.tradingName ||
    t("bankTransfers.company");

  const bankAccounts = useMemo(() => {
    if (!companySettings?.paymentStructure?.bankAccounts) return [];
    return companySettings.paymentStructure.bankAccounts
      .filter((a) => a.isActive && Boolean(a.accountNumber?.trim()))
      .map((a) => ({
        id: a.id,
        name: `${a.accountName} - ${a.bankName} ****${(a.accountNumber || "").slice(-4)}`,
        accountNumber: a.accountNumber || "",
        purpose: a.purpose || "general",
        ledgerAccountCode:
          a.ledgerAccountCode || (a.purpose === "payroll" ? "1130" : "1120"),
      }));
  }, [companySettings]);

  const companyAccount = useMemo(() => {
    const payrollAccount =
      bankAccounts.find((a) => a.purpose === "payroll") || bankAccounts[0];
    return payrollAccount?.accountNumber ?? "";
  }, [bankAccounts]);

  const loading = loadingTransfers || loadingRuns;

  // ─── Local UI state ────────────────────────────────────────────
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  // Row status actions (pending/processing -> completed/failed). The transfer
  // doc is Xefe-side bookkeeping — the bank executes from the emailed
  // pack/file, so a human confirms the outcome here.
  const [statusAction, setStatusAction] = useState<{
    transfer: BankTransfer;
    to: "completed" | "failed";
  } | null>(null);

  // Bank file generation state
  const [showBankFileDialog, setShowBankFileDialog] = useState(false);
  const [selectedBankFileRun, setSelectedBankFileRun] = useState<string>("");
  const [selectedBanks, setSelectedBanks] = useState<BankCode[]>([]);
  const [generatingFiles, setGeneratingFiles] = useState(false);
  // Cover emails for banks that take salary batches by emailed instruction
  // (BNU/BNCTL) — shown with a copy button after the packs download.
  const [coverEmails, setCoverEmails] = useState<
    { bankCode: BankCode; text: string }[]
  >([]);
  const bankFilesInFlight = useRef(false);
  const shouldLoadEmployees =
    canManageTenant && (showBankFileDialog || !!selectedBankFileRun);
  const employeeDirectoryQuery = useEmployeeDirectory({}, shouldLoadEmployees);
  const employees = useMemo(
    () => employeeDirectoryQuery.data ?? [],
    [employeeDirectoryQuery.data],
  );
  const loadingEmployees = employeeDirectoryQuery.isLoading;

  const [formData, setFormData] = useState({
    payrollRunId: "",
    bankAccount: "",
    transferDate: "",
    notes: "",
  });
  const transferInFlight = useRef(false);

  // ─── Payroll records for bank file generation ──────────────────
  const bankFileRecordsQuery = usePayrollRecordsByRun(
    selectedBankFileRun || undefined,
  );
  const bankFileRecords = useMemo(
    () => bankFileRecordsQuery.data ?? [],
    [bankFileRecordsQuery.data],
  );

  const bankFileSummary = useMemo(() => {
    if (
      !selectedBankFileRun ||
      employees.length === 0 ||
      bankFileRecords.length === 0
    )
      return null;
    const grouped = groupRecordsByBank(
      bankFileRecords.filter((record) => record.netPay > 0),
      employees,
    );
    return {
      BNU: grouped.BNU.length,
      MANDIRI: grouped.MANDIRI.length,
      ANZ: grouped.ANZ.length,
      BNCTL: grouped.BNCTL.length,
    } as Record<BankCode, number>;
  }, [bankFileRecords, employees, selectedBankFileRun]);

  const bankFileCoverage = useMemo(() => {
    const payableRecords = bankFileRecords.filter(
      (record) => record.netPay > 0,
    );
    if (
      payableRecords.length === 0 ||
      employeeDirectoryQuery.data === undefined
    ) {
      return { missingEmployeeCount: 0, unsupportedBankCount: 0 };
    }
    const employeeIds = new Set(
      employees.flatMap((employee) => (employee.id ? [employee.id] : [])),
    );
    const missingEmployeeIds = new Set(
      payableRecords
        .filter((record) => !employeeIds.has(record.employeeId))
        .map((record) => record.employeeId),
    );
    const knownRecords = payableRecords.filter((record) =>
      employeeIds.has(record.employeeId),
    );
    const grouped = groupRecordsByBank(knownRecords, employees);
    const supportedEmployeeIds = new Set(
      Object.values(grouped).flatMap((entries) =>
        entries.map(({ record }) => record.employeeId),
      ),
    );
    const unsupportedEmployeeIds = new Set(
      knownRecords
        .filter((record) => !supportedEmployeeIds.has(record.employeeId))
        .map((record) => record.employeeId),
    );
    return {
      missingEmployeeCount: missingEmployeeIds.size,
      unsupportedBankCount: unsupportedEmployeeIds.size,
    };
  }, [bankFileRecords, employeeDirectoryQuery.data, employees]);
  const { missingEmployeeCount, unsupportedBankCount } = bankFileCoverage;

  // Pre-select banks that have employees when summary changes
  useEffect(() => {
    if (bankFileSummary) {
      const availableBanks = (
        Object.keys(bankFileSummary) as BankCode[]
      ).filter((bank) => bankFileSummary[bank] > 0);
      setSelectedBanks(availableBanks);
    }
  }, [bankFileSummary]);

  // Handle bank file generation
  const handleGenerateBankFiles = async () => {
    if (!canManageTenant || bankFilesInFlight.current) return;
    if (!selectedBankFileRun || selectedBanks.length === 0) {
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description: t("bankTransfers.toastSelectRunAndBank"),
        variant: "destructive",
      });
      return;
    }

    const selectedRun = payrollRuns.find((r) => r.id === selectedBankFileRun);
    if (!selectedRun) {
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description: t("bankTransfers.toastRunNotFound"),
        variant: "destructive",
      });
      return;
    }

    bankFilesInFlight.current = true;
    setGeneratingFiles(true);
    try {
      if (
        settingsQuery.isFetching ||
        employeeDirectoryQuery.isFetching ||
        bankFileRecordsQuery.isFetching
      ) {
        throw new Error(
          t("bankTransfers.toastEmployeesLoading") ||
            "Bank details are still loading",
        );
      }
      if (
        settingsQuery.isError ||
        employeeDirectoryQuery.isError ||
        bankFileRecordsQuery.isError
      )
        throw new Error("Required bank-file data could not be loaded");
      if (!companySettings || !companyAccount.trim()) {
        throw new Error("A company debit account must be configured first");
      }

      const records = bankFileRecords;
      if (records.length === 0)
        throw new Error("No payroll records were found");
      const payableRecords = records.filter((record) => record.netPay > 0);
      if (payableRecords.length === 0)
        throw new Error("No positive salary payments were found");
      const employeeIds = new Set(
        employees.flatMap((employee) => (employee.id ? [employee.id] : [])),
      );
      if (
        payableRecords.some((record) => !employeeIds.has(record.employeeId))
      ) {
        throw new Error(
          "One or more payroll employee records could not be loaded",
        );
      }
      const grouped = groupRecordsByBank(payableRecords, employees);
      const selectedEmployeeIds = new Set(
        selectedBanks.flatMap((bankCode) =>
          grouped[bankCode].map(({ record }) => record.employeeId),
        ),
      );
      const selectedRecords = payableRecords.filter((record) =>
        selectedEmployeeIds.has(record.employeeId),
      );
      if (selectedRecords.length === 0) {
        throw new Error("No salary records matched the selected banks");
      }
      validateBankTransferRecords(selectedRecords, employees);

      const today = getTodayTL();
      // Build and validate every selected file before starting any downloads so
      // a later invalid bank cannot leave the user with a partial set.
      const results = selectedBanks.map((bankCode) =>
        generateBankFile(bankCode, {
          payrollRun: selectedRun,
          records: payableRecords,
          employees,
          valueDate: today,
          companyName,
          companyAccountNumber: companyAccount,
        }),
      );

      const packEmails: { bankCode: BankCode; text: string }[] = [];
      for (const result of results) {
        if (supportsPaymentPack(result.summary.bankCode)) {
          // BNU/BNCTL execute salary batches from an emailed Excel list plus a
          // signed payment order — generate that pack instead of a CSV.
          const company = { name: companyName, accountNumber: companyAccount };
          const pack = await generatePaymentPackXlsx(result.summary, company);
          downloadBlob(pack.blob, pack.fileName);
          packEmails.push({
            bankCode: result.summary.bankCode,
            text: buildBankCoverEmail(result.summary, company),
          });
        } else {
          downloadBankFile(result);
        }

        // Small delay between downloads to prevent browser blocking
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      setCoverEmails(packEmails);

      toast({
        title: t("bankTransfers.toastTransferSuccess"),
        description: t(
          unsupportedBankCount > 0
            ? "bankTransfers.toastBankFilesSuccessWithExcluded"
            : "bankTransfers.toastBankFilesSuccess",
          {
            count: String(selectedBanks.length),
            excluded: String(unsupportedBankCount),
          },
        ),
      });

      setShowBankFileDialog(false);
      setSelectedBankFileRun("");
      setSelectedBanks([]);
    } catch (error) {
      console.error("Failed to generate bank files:", error);
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description: t(
          error instanceof Error && error.message.includes("employee records")
            ? "bankTransfers.toastPayrollDataError"
            : error instanceof Error && error.message.includes("account")
              ? "bankTransfers.toastBankDetailsError"
              : "bankTransfers.toastBankFilesError",
        ),
        variant: "destructive",
      });
    } finally {
      bankFilesInFlight.current = false;
      setGeneratingFiles(false);
    }
  };

  const copyCoverEmail = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t("bankTransfers.coverEmail.copied"),
      });
    } catch {
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        variant: "destructive",
      });
    }
  };

  const toggleBankSelection = (bankCode: BankCode) => {
    setSelectedBanks((prev) =>
      prev.includes(bankCode)
        ? prev.filter((b) => b !== bankCode)
        : [...prev, bankCode],
    );
  };

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
        !transferredRunIds.has(run.id),
    );
  }, [payrollRuns, transfers]);

  const getStatusBadge = (status: BankTransfer["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t("bankTransfers.completed")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            {t("bankTransfers.pending")}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            {t("bankTransfers.processing")}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            {t("bankTransfers.failed")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ─── Transfer status actions ────────────────────────────────────
  const statusActionRun = statusAction
    ? payrollRuns.find((run) => run.id === statusAction.transfer.payrollRunId)
    : undefined;
  // Completing the bank transfer is the payment event. Current approved runs,
  // plus legacy paid runs missing their settlement journal, are posted through
  // one atomic service transaction.
  const willSettlePayroll =
    statusAction?.to === "completed" &&
    !!statusActionRun &&
    (statusActionRun.status === "approved" ||
      (statusActionRun.status === "paid" &&
        !statusActionRun.settlementJournalEntryId));
  const statusActionPending =
    updateTransferStatusMutation.isPending || markRunPaidMutation.isPending;

  const openStatusAction = (
    transfer: BankTransfer,
    to: "completed" | "failed",
  ) => {
    setStatusAction({ transfer, to });
  };

  const handleConfirmStatusAction = async () => {
    const action = statusAction;
    if (!action?.transfer.id || statusActionPending) return;
    const linkedRun = payrollRuns.find(
      (run) => run.id === action.transfer.payrollRunId,
    );
    const shouldSettlePayroll =
      action.to === "completed" &&
      !!linkedRun?.id &&
      (linkedRun.status === "approved" ||
        (linkedRun.status === "paid" && !linkedRun.settlementJournalEntryId));

    try {
      if (shouldSettlePayroll) {
        const configuredAccount = bankAccounts.find(
          (account) => account.id === action.transfer.bankAccountId,
        );
        if (!user?.uid) throw new Error("A signed-in user is required");
        await markRunPaidMutation.mutateAsync({
          id: linkedRun!.id!,
          payment: {
            tenantId,
            paymentDate: action.transfer.transferDate,
            paymentReference: action.transfer.reference,
            paymentMethod: "bank_transfer",
            paidBy: user.uid,
            paymentAccountCode: configuredAccount?.ledgerAccountCode || "1130",
            bankAccountId: action.transfer.bankAccountId,
            bankAccountName: action.transfer.bankAccountName,
            bankTransferId: action.transfer.id,
            audit: {
              tenantId,
              userId: user.uid,
              userEmail: user.email || "",
            },
          },
        });
      } else {
        await updateTransferStatusMutation.mutateAsync({
          id: action.transfer.id,
          status: action.to,
        });
      }
    } catch (error) {
      console.error("Failed to update transfer status:", error);
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description:
          t("bankTransfers.toastStatusUpdateError") ||
          "Failed to update the transfer status. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("bankTransfers.toastTransferSuccess"),
      description:
        action.to === "completed"
          ? t("bankTransfers.toastMarkedCompleted", {
              reference: action.transfer.reference,
            }) || `Transfer ${action.transfer.reference} marked completed.`
          : t("bankTransfers.toastMarkedFailed", {
              reference: action.transfer.reference,
            }) || `Transfer ${action.transfer.reference} marked failed.`,
    });

    if (shouldSettlePayroll) {
      toast({
        title: t("bankTransfers.toastTransferSuccess"),
        description:
          t("bankTransfers.toastRunMarkedPaid") ||
          "Payroll payment and accounting entry recorded.",
      });
    }

    setStatusAction(null);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTenant || transferInFlight.current) return;

    if (
      !formData.payrollRunId ||
      !formData.bankAccount ||
      !formData.transferDate
    ) {
      toast({
        title: t("bankTransfers.toastValidationError"),
        description: t("bankTransfers.toastValidationDesc"),
        variant: "destructive",
      });
      return;
    }

    // Find the selected payroll run
    const selectedRun = payrollRuns.find((r) => r.id === formData.payrollRunId);
    if (!selectedRun) {
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description: t("bankTransfers.toastRunNotFound"),
        variant: "destructive",
      });
      return;
    }

    // Find the bank account name
    const bankAccount = bankAccounts.find((a) => a.id === formData.bankAccount);
    if (!bankAccount?.accountNumber.trim()) {
      toast({
        title: t("bankTransfers.toastErrorTitle"),
        description: t("bankTransfers.bankDetailsRequired"),
        variant: "destructive",
      });
      return;
    }

    // Generate reference number
    const now = new Date();
    const reference = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${selectedRun.id}`;

    const newTransfer: Omit<BankTransfer, "id" | "tenantId"> = {
      payrollRunId: formData.payrollRunId,
      payrollPeriod: formatDateTL(selectedRun.periodStart, {
        month: "long",
        year: "numeric",
      }),
      amount: selectedRun.totalNetPay,
      employeeCount: selectedRun.employeeCount,
      transferDate: formData.transferDate,
      bankAccountId: formData.bankAccount,
      bankAccountName: bankAccount?.name || formData.bankAccount,
      status: "pending",
      reference,
      initiatedBy: user?.email || t("bankTransfers.unknown"),
      notes: formData.notes || "",
    };

    transferInFlight.current = true;
    createTransferMutation.mutate(newTransfer, {
      onSuccess: () => {
        transferInFlight.current = false;
        toast({
          title: t("bankTransfers.toastTransferSuccess"),
          description:
            t("bankTransfers.toastTransferRecordedDesc", { reference }) ||
            `Transfer ${reference} recorded as pending. Take or email the bank file/pack to your bank, then mark the transfer completed here.`,
        });
        setFormData({
          payrollRunId: "",
          bankAccount: "",
          transferDate: "",
          notes: "",
        });
        setShowTransferDialog(false);
      },
      onError: () => {
        transferInFlight.current = false;
        toast({
          title: t("bankTransfers.toastErrorTitle"),
          description: t("bankTransfers.toastTransferError"),
          variant: "destructive",
        });
      },
    });
  };

  const handleExportCSV = () => {
    if (filteredTransfers.length === 0) {
      toast({
        title: t("bankTransfers.toastNoData"),
        description: t("bankTransfers.toastNoDataDesc"),
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = [
      t("bankTransfers.csvPayrollPeriod"),
      t("bankTransfers.csvAmount"),
      t("bankTransfers.csvEmployeeCount"),
      t("bankTransfers.csvTransferDate"),
      t("bankTransfers.csvBankAccount"),
      t("bankTransfers.csvStatus"),
      t("bankTransfers.csvReference"),
      t("bankTransfers.csvInitiatedBy"),
      t("bankTransfers.csvNotes"),
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
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Download file
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank-transfers-${getTodayTL()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t("bankTransfers.toastExportComplete"),
      description: t("bankTransfers.toastExportCompleteDesc", {
        count: String(filteredTransfers.length),
      }),
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

  // Column sorting for the transfers table (asc → desc → off)
  const {
    sorted: sortedTransfers,
    sort,
    toggleSort,
  } = useTableSort<BankTransfer, BankTransferSortKey>(filteredTransfers, {
    payrollPeriod: (transfer) => transfer.payrollPeriod,
    amount: (transfer) => transfer.amount,
    employees: (transfer) => transfer.employeeCount,
    transferDate: (transfer) => transfer.transferDate,
    bankAccount: (transfer) => transfer.bankAccountName,
    status: (transfer) => transfer.status,
    reference: (transfer) => transfer.reference,
  });

  // Renders a sortable shadcn <TableHead> wired to the sort state above
  const sortableHead = (
    key: BankTransferSortKey,
    label: string,
    align: "left" | "right" = "left",
  ) => {
    const active = sort?.key === key;
    return (
      <TableHead
        aria-sort={
          active
            ? sort!.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10" />
              <div className="min-w-0">
                <Skeleton className="mb-2 h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            {canManageTenant && <Skeleton className="h-10 w-40" />}
          </div>

          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-20" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Skeleton className="mb-2 h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="mb-2 h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-40" />
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    <Skeleton className="mt-2 h-4 w-32" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  {canManageTenant && <Skeleton className="h-10 w-32" />}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bankTransfers.payrollPeriod")}</TableHead>
                    <TableHead>{t("bankTransfers.amount")}</TableHead>
                    <TableHead>{t("bankTransfers.employees")}</TableHead>
                    <TableHead>{t("bankTransfers.transferDate")}</TableHead>
                    <TableHead>{t("bankTransfers.bankAccount")}</TableHead>
                    <TableHead>{t("bankTransfers.status")}</TableHead>
                    <TableHead>{t("bankTransfers.reference")}</TableHead>
                    <TableHead>{t("bankTransfers.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-8 rounded" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (
    (transferQuery.isError && transfers.length === 0) ||
    (payrollRunsQuery.isError && payrollRuns.length === 0)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.bankTransfers} />
        <MainNavigation />
        <DashboardLoadError
          isRetrying={transferQuery.isFetching || payrollRunsQuery.isFetching}
          onRetry={() =>
            Promise.all([transferQuery.refetch(), payrollRunsQuery.refetch()])
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.bankTransfers} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("bankTransfers.title")}
          subtitle={t("bankTransfers.subtitle")}
          icon={Send}
          iconColor="text-primary"
          actions={
            canManageTenant ? (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={availablePayrollRuns.length === 0}
                onClick={() => setShowTransferDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("bankTransfers.newTransfer")}
              </Button>
            ) : undefined
          }
        />

        {/* Filters */}
        <Card className="mb-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-green-600 dark:text-green-400" />
              {t("bankTransfers.filters")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="status-filter">
                  {t("bankTransfers.status")}
                </Label>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("bankTransfers.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("bankTransfers.allStatuses")}
                    </SelectItem>
                    <SelectItem value="completed">
                      {t("bankTransfers.completed")}
                    </SelectItem>
                    <SelectItem value="pending">
                      {t("bankTransfers.pending")}
                    </SelectItem>
                    <SelectItem value="processing">
                      {t("bankTransfers.processing")}
                    </SelectItem>
                    <SelectItem value="failed">
                      {t("bankTransfers.failed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="period-filter">
                  {t("bankTransfers.payrollPeriod")}
                </Label>
                <Select
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("bankTransfers.allPeriods")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("bankTransfers.allPeriods")}
                    </SelectItem>
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
                  {t("bankTransfers.transferHistory")}
                </CardTitle>
                <CardDescription>
                  {t("bankTransfers.showingTransfers", {
                    count: String(filteredTransfers.length),
                  })}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("bankTransfers.exportCsv")}
                </Button>

                {canManageTenant && (
                  <>
                    {/* Bank File Generation Dialog */}
                    <Dialog
                      open={showBankFileDialog}
                      onOpenChange={setShowBankFileDialog}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {t("bankTransfers.bankFiles")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-green-600" />
                            {t("bankTransfers.generateBankFiles")}
                          </DialogTitle>
                          <DialogDescription>
                            {t("bankTransfers.generateBankFilesDesc")}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 mt-4">
                          {/* Payroll Run Selection */}
                          <div>
                            <Label>{t("bankTransfers.selectPayrollRun")}</Label>
                            <Select
                              value={selectedBankFileRun}
                              onValueChange={setSelectedBankFileRun}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "bankTransfers.selectPayrollRunPlaceholder",
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {payrollRuns
                                  .filter(
                                    (r) =>
                                      (r.status === "approved" ||
                                        r.status === "paid") &&
                                      r.id,
                                  )
                                  .map((run) => (
                                    <SelectItem key={run.id} value={run.id!}>
                                      {formatDateTL(run.periodStart, {
                                        month: "long",
                                        year: "numeric",
                                      })}{" "}
                                      - {formatCurrency(run.totalNetPay)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {bankAccounts.length === 0 && (
                              <p className="mt-1 flex items-center gap-1 text-sm text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                {t("bankTransfers.bankDetailsRequired")}
                              </p>
                            )}
                          </div>

                          {/* Bank Summary & Selection */}
                          {selectedBankFileRun &&
                            (loadingEmployees ||
                              settingsQuery.isFetching ||
                              bankFileRecordsQuery.isFetching) && (
                              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>
                                  {t("bankTransfers.loadingEmployees") ||
                                    "Loading employees..."}
                                </span>
                              </div>
                            )}

                          {selectedBankFileRun &&
                            (settingsQuery.isError ||
                              employeeDirectoryQuery.isError ||
                              bankFileRecordsQuery.isError ||
                              !companyAccount) && (
                              <div
                                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
                                role="alert"
                              >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                  {t("bankTransfers.bankDetailsRequired")}
                                </span>
                              </div>
                            )}

                          {bankFileSummary && (
                            <div className="space-y-3">
                              <Label>
                                {t("bankTransfers.selectBanksToGenerate")}
                              </Label>
                              <div className="grid grid-cols-2 gap-3">
                                {TL_BANKS.map((bank) => {
                                  const bankCode = bank.code as BankCode;
                                  const count = bankFileSummary[bankCode] || 0;
                                  const isSelected =
                                    selectedBanks.includes(bankCode);
                                  const isDisabled = count === 0;

                                  return (
                                    <div
                                      key={bank.code}
                                      className={`
                                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                                      ${isDisabled ? "bg-gray-50 dark:bg-gray-900 opacity-50 cursor-not-allowed" : ""}
                                      ${isSelected && !isDisabled ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-border hover:border-green-300"}
                                    `}
                                      onClick={() =>
                                        !isDisabled &&
                                        toggleBankSelection(bankCode)
                                      }
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        aria-label={`${bank.code} ${bank.name}`}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onCheckedChange={() =>
                                          !isDisabled &&
                                          toggleBankSelection(bankCode)
                                        }
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">
                                          {bank.code}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {bank.name}
                                        </p>
                                        <p
                                          className={`text-[11px] ${
                                            BANK_FORMAT_CONFIDENCE[bankCode] ===
                                            "verified"
                                              ? "text-green-700 dark:text-green-400"
                                              : "text-amber-700 dark:text-amber-400"
                                          }`}
                                        >
                                          {t(
                                            BANK_FORMAT_CONFIDENCE[bankCode] ===
                                              "verified"
                                              ? "bankTransfers.formatVerified"
                                              : "bankTransfers.formatBestEffort",
                                          )}
                                        </p>
                                      </div>
                                      <Badge
                                        variant={
                                          count > 0 ? "default" : "secondary"
                                        }
                                        className="shrink-0"
                                      >
                                        {count} {t("bankTransfers.emp")}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {missingEmployeeCount > 0 && (
                            <div
                              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                              role="alert"
                            >
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                {t(
                                  "bankTransfers.missingEmployeeRecordsNotice",
                                  {
                                    count: missingEmployeeCount,
                                  },
                                )}
                              </span>
                            </div>
                          )}

                          {unsupportedBankCount > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                {t("bankTransfers.excludedEmployeesNotice", {
                                  count: unsupportedBankCount,
                                })}
                              </span>
                            </div>
                          )}

                          {/* Company Account Info */}
                          {selectedBankFileRun && (
                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm">
                              <p className="text-muted-foreground">
                                {t("bankTransfers.filesGeneratedFor")}{" "}
                                <strong>{companyName}</strong>
                              </p>
                              {companyAccount && (
                                <p className="text-muted-foreground">
                                  {t("bankTransfers.debitAccount")}: ****
                                  {companyAccount.slice(-4)}
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
                              {t("bankTransfers.cancel")}
                            </Button>
                            <Button
                              onClick={handleGenerateBankFiles}
                              disabled={
                                !selectedBankFileRun ||
                                selectedBanks.length === 0 ||
                                generatingFiles ||
                                loadingEmployees ||
                                settingsQuery.isFetching ||
                                bankFileRecordsQuery.isFetching ||
                                settingsQuery.isError ||
                                employeeDirectoryQuery.isError ||
                                bankFileRecordsQuery.isError ||
                                missingEmployeeCount > 0 ||
                                !companyAccount
                              }
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {generatingFiles ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  {t("bankTransfers.generating")}
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4 mr-2" />
                                  {t("bankTransfers.generateFiles", {
                                    count: String(selectedBanks.length),
                                  })}
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
                      {/* New Transfer button moved to PageHeader */}
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            {t("bankTransfers.recordBankTransfer") ||
                              "Record Bank Transfer"}
                          </DialogTitle>
                          <DialogDescription>
                            {t("bankTransfers.recordBankTransferDesc") ||
                              "Records this payroll's transfer as pending in Xefe. No money is sent — generate the bank files, take or email them to your bank, then mark the transfer completed here."}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="payroll-run">
                              {t("bankTransfers.payrollRunLabel")} *
                            </Label>
                            <Select
                              value={formData.payrollRunId}
                              onValueChange={(value) =>
                                handleInputChange("payrollRunId", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "bankTransfers.selectPayrollRunFormPlaceholder",
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePayrollRuns.map((run) => (
                                  <SelectItem key={run.id} value={run.id!}>
                                    {formatDateTL(run.periodStart, {
                                      month: "long",
                                      year: "numeric",
                                    })}{" "}
                                    - {formatCurrency(run.totalNetPay)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {availablePayrollRuns.length === 0 && (
                              <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {t("bankTransfers.noApprovedRuns")}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="bank-account">
                              {t("bankTransfers.bankAccountLabel")} *
                            </Label>
                            <Select
                              value={formData.bankAccount}
                              onValueChange={(value) =>
                                handleInputChange("bankAccount", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "bankTransfers.selectBankAccount",
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map((account) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {bankAccounts.length === 0 && (
                              <p className="mt-1 flex items-center gap-1 text-sm text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                {t("bankTransfers.bankDetailsRequired")}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="transfer-date">
                              {t("bankTransfers.transferDateLabel")} *
                            </Label>
                            <Input
                              id="transfer-date"
                              type="date"
                              value={formData.transferDate}
                              onChange={(e) =>
                                handleInputChange(
                                  "transferDate",
                                  e.target.value,
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="notes">
                              {t("bankTransfers.notesLabel")}
                            </Label>
                            <Input
                              id="notes"
                              value={formData.notes}
                              onChange={(e) =>
                                handleInputChange("notes", e.target.value)
                              }
                              placeholder={t("bankTransfers.optionalNotes")}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowTransferDialog(false)}
                              className="flex-1"
                              disabled={createTransferMutation.isPending}
                            >
                              {t("bankTransfers.cancel")}
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1"
                              disabled={createTransferMutation.isPending}
                            >
                              {createTransferMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  {t("bankTransfers.processing")}...
                                </>
                              ) : (
                                t("bankTransfers.recordTransfer") ||
                                "Record Transfer"
                              )}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransfers.length === 0 ? (
              <div className="text-center py-12">
                <Send className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  {t("bankTransfers.noTransfersFound")}
                </p>
                <p className="text-sm text-muted-foreground/70">
                  {transfers.length === 0
                    ? t("bankTransfers.createFirstTransfer")
                    : t("bankTransfers.adjustFilters")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {sortableHead(
                      "payrollPeriod",
                      t("bankTransfers.payrollPeriod"),
                    )}
                    {sortableHead("amount", t("bankTransfers.amount"))}
                    {sortableHead("employees", t("bankTransfers.employees"))}
                    {sortableHead(
                      "transferDate",
                      t("bankTransfers.transferDate"),
                    )}
                    {sortableHead(
                      "bankAccount",
                      t("bankTransfers.bankAccount"),
                    )}
                    {sortableHead("status", t("bankTransfers.status"))}
                    {sortableHead("reference", t("bankTransfers.reference"))}
                    <TableHead>{t("bankTransfers.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">
                        {transfer.payrollPeriod}
                      </TableCell>
                      <TableCell>{formatCurrency(transfer.amount)}</TableCell>
                      <TableCell>{transfer.employeeCount}</TableCell>
                      <TableCell>
                        {formatDateTL(transfer.transferDate)}
                      </TableCell>
                      <TableCell>{transfer.bankAccountName}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.reference}
                      </TableCell>
                      <TableCell>
                        {canManageTenant && transfer.status !== "completed" ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title={
                                t("bankTransfers.markCompleted") ||
                                "Mark completed"
                              }
                              aria-label={
                                t("bankTransfers.markCompleted") ||
                                "Mark completed"
                              }
                              onClick={() =>
                                openStatusAction(transfer, "completed")
                              }
                            >
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            </Button>
                            {transfer.status !== "failed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title={
                                  t("bankTransfers.markFailed") || "Mark failed"
                                }
                                aria-label={
                                  t("bankTransfers.markFailed") || "Mark failed"
                                }
                                onClick={() =>
                                  openStatusAction(transfer, "failed")
                                }
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            &mdash;
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm advancing a transfer's status. Xefe never talks to the
            bank — a human confirms what the bank did with the emailed
            pack/file, and (for completed) can flip the linked run to paid. */}
      <AlertDialog
        open={!!statusAction}
        onOpenChange={(open) => {
          if (!open) setStatusAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusAction?.to === "completed"
                ? t("bankTransfers.markCompletedTitle") ||
                  "Mark transfer completed?"
                : t("bankTransfers.markFailedTitle") || "Mark transfer failed?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction?.to === "completed"
                ? t("bankTransfers.markCompletedDesc") ||
                  "Confirm your bank has executed this salary batch. This only updates the record in Xefe — it does not contact the bank."
                : t("bankTransfers.markFailedDesc") ||
                  "Record that your bank rejected or did not execute this salary batch. This only updates the record in Xefe — you can mark it completed later if the bank processes a retry."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statusAction && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-mono text-xs">
                {statusAction.transfer.reference}
              </p>
              <p className="text-muted-foreground">
                {statusAction.transfer.payrollPeriod} &middot;{" "}
                {formatCurrency(statusAction.transfer.amount)} &middot;{" "}
                {statusAction.transfer.employeeCount} {t("bankTransfers.emp")}
              </p>
            </div>
          )}
          {willSettlePayroll && (
            <p className="text-sm text-muted-foreground">
              {t("bankTransfers.completePostsPayment") ||
                "This will mark payroll paid, update deduction balances, and post the bank payment to accounting."}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusActionPending}>
              {t("bankTransfers.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusAction}
              disabled={statusActionPending}
              className={
                statusAction?.to === "failed"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {statusAction?.to === "completed"
                ? t("bankTransfers.markCompleted") || "Mark completed"
                : t("bankTransfers.markFailed") || "Mark failed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* BNU/BNCTL run on emailed instructions — hand the user the exact
            message their branch already accepts, next to the downloaded pack. */}
      <Dialog
        open={coverEmails.length > 0}
        onOpenChange={(open) => {
          if (!open) setCoverEmails([]);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("bankTransfers.coverEmail.title")}</DialogTitle>
            <DialogDescription>
              {t("bankTransfers.coverEmail.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {coverEmails.map(({ bankCode, text }) => (
              <div key={bankCode} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{bankCode}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCoverEmail(text)}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    {t("bankTransfers.coverEmail.copy")}
                  </Button>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-5">
                  {text}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
