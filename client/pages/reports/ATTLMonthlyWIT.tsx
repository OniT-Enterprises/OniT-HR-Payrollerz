/**
 * ATTL Monthly WIT Return Page
 *
 * Generate and track monthly Wage Income Tax returns for
 * Timor-Leste Tax Authority (Autoridade Tributaria Timor-Leste)
 *
 * Due: 15th of the following month
 * Submission: e-Tax portal or BNU bank branches
 */

import { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReportCardHeader } from "@/components/reports/ReportLayout";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Building,
  Landmark,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettings";
import { useCompanyPaymentProfile } from "@/hooks/useCompanyPaymentProfile";
import {
  useTaxFilings,
  useTaxFilingsDueSoon,
  useGenerateMonthlyWIT,
  useMarkTaxFilingAsFiled,
  useSaveTaxFiling,
  useRecordTaxFilingPayment,
} from "@/hooks/useTaxFiling";

import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import type {
  MonthlyWITReturn,
  TaxFiling,
  SubmissionMethod,
  TaxFilingStatus,
  TaxFilingTask,
} from "@/types/tax-filing";
import type { CompanyDetails } from "@/types/settings";
import { SEO } from "@/components/SEO";
import { ATTL_TAX_ACCOUNTS } from "@/lib/tlBanking";
import { AssistedEtaxFiling } from "@/components/reports/AssistedEtaxFiling";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { downloadBlob } from "@/lib/downloadBlob";
import { SupplierWithholdingRemittancePanel } from "@/components/reports/SupplierWithholdingRemittancePanel";
import { formatDateTL, getTodayTL } from "@/lib/dateUtils";
import {
  getDaysUntilDueIso,
  resolveMonthlyWITTaskStatuses,
} from "@/lib/tax/compliance";

// ============================================
// COMPONENT
// ============================================

export default function ATTLMonthlyWIT() {
  const { toast } = useToast();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { t } = useI18n();

  // React Query hooks
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    isFetching: settingsFetching,
    refetch: refetchSettings,
  } = useSettings();
  const paymentProfile = useCompanyPaymentProfile();
  const {
    data: filings = [],
    isLoading: filingsLoading,
    isError: filingsError,
    isFetching: filingsFetching,
    refetch: refetchFilings,
  } = useTaxFilings("monthly_wit");
  const {
    data: allDueDates = [],
    isLoading: duesLoading,
    isError: duesError,
    isFetching: duesFetching,
    refetch: refetchDues,
  } = useTaxFilingsDueSoon(6);
  const generateWIT = useGenerateMonthlyWIT();
  const saveFiling = useSaveTaxFiling();
  const markFiled = useMarkTaxFilingAsFiled();
  const recordPayment = useRecordTaxFilingPayment();

  const company: Partial<CompanyDetails> = settings?.companyDetails || {};
  const dueDates = useMemo(
    () => allDueDates.filter((d) => d.type === "monthly_wit"),
    [allDueDates],
  );
  const loading = settingsLoading || filingsLoading || duesLoading;
  const loadError = settingsError || filingsError || duesError;
  const retrying = settingsFetching || filingsFetching || duesFetching;

  // Local state
  const [selectedReturn, setSelectedReturn] = useState<MonthlyWITReturn | null>(
    null,
  );
  const [showMarkFiledDialog, setShowMarkFiledDialog] = useState(false);
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaxFilingTask>("statement");

  // Form state for period selection
  const currentDate = new Date();
  const previousMonthDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1,
  );
  const defaultYear = previousMonthDate.getFullYear();
  const defaultMonth = String(previousMonthDate.getMonth() + 1).padStart(
    2,
    "0",
  );
  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const attentionPeriodApplied = useRef(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showSupplierWithholding, setShowSupplierWithholding] = useState(false);

  // Form state for mark as filed
  const [filedMethod, setFiledMethod] = useState<SubmissionMethod>("etax");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [filedNotes, setFiledNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayTL());
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const paymentAccounts = useMemo(
    () =>
      (settings?.paymentStructure?.bankAccounts ?? []).filter(
        (account) => account.isActive && Boolean(account.accountNumber?.trim()),
      ),
    [settings],
  );

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          value: String(month).padStart(2, "0"),
          label: t(`common.months.${month}`),
        };
      }),
    [t],
  );

  const getMonthLabel = (month: string) => t(`common.months.${Number(month)}`);
  const formatPeriodLabel = (period: string) => {
    const [year, month] = period.split("-");
    if (!year || !month) return period;
    return `${getMonthLabel(month)} ${year}`;
  };
  const formatDisplayDate = (date: string) =>
    formatDateTL(date, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const getStatusConfig = (status: TaxFilingStatus) => {
    switch (status) {
      case "pending":
        return {
          label: t("reports.attlMonthlyWit.status.pending"),
          className:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: Clock,
        };
      case "overdue":
        return {
          label: t("reports.attlMonthlyWit.status.overdue"),
          className:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          icon: AlertTriangle,
        };
      case "filed":
        return {
          label: t("reports.attlMonthlyWit.status.filed"),
          className:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          icon: CheckCircle,
        };
      default:
        return {
          label: t("reports.attlMonthlyWit.status.draft"),
          className:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
          icon: FileText,
        };
    }
  };

  const getTaskStatuses = (filing: TaxFiling) =>
    resolveMonthlyWITTaskStatuses({
      ...filing,
      daysUntilDue: getDaysUntilDueIso(
        getTodayTL(),
        filing.paymentDueDate || filing.dueDate,
      ),
    });

  // ============================================
  // ACTIONS
  // ============================================

  const handleGenerateReturn = async () => {
    const period = `${selectedYear}-${selectedMonth}`;

    try {
      // Generate the return data
      const returnData = await generateWIT.mutateAsync({ period, company });
      setSelectedReturn(returnData);

      // Save as draft
      await saveFiling.mutateAsync({
        type: "monthly_wit",
        period,
        dataSnapshot: returnData,
        userId: user?.uid || "",
      });

      toast({
        title: t("reports.attlMonthlyWit.toast.generatedTitle"),
        description: t("reports.attlMonthlyWit.toast.generatedDescription", {
          period: formatPeriodLabel(period),
        }),
      });
    } catch (error) {
      console.error("Failed to generate return:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.errorTitle"),
        description: t("reports.attlMonthlyWit.toast.generateErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleViewReturn = async (filing: TaxFiling) => {
    setSelectedReturn(filing.dataSnapshot as MonthlyWITReturn);
  };

  const handleExportCSV = () => {
    if (!selectedReturn) return;

    // Build CSV content
    const headers = [
      t("reports.attlMonthlyWit.csv.employeeId"),
      t("reports.attlMonthlyWit.csv.fullName"),
      t("reports.attlMonthlyWit.csv.tin"),
      t("reports.attlMonthlyWit.csv.resident"),
      t("reports.attlMonthlyWit.csv.grossWages"),
      t("reports.attlMonthlyWit.csv.taxableWages"),
      t("reports.attlMonthlyWit.csv.witWithheld"),
    ];

    const rows = selectedReturn.employees.map((emp) => [
      emp.employeeId,
      emp.fullName,
      emp.tinNumber || "",
      emp.isResident ? "Y" : "N",
      emp.grossWages.toFixed(2),
      emp.taxableWages.toFixed(2),
      emp.witWithheld.toFixed(2),
    ]);

    // Add totals row
    rows.push([
      "",
      t("reports.attlMonthlyWit.table.total"),
      "",
      "",
      selectedReturn.totalGrossWages.toFixed(2),
      selectedReturn.totalTaxableWages.toFixed(2),
      selectedReturn.totalWITWithheld.toFixed(2),
    ]);

    // Escape every field via papaparse so a comma, quote, or newline in an
    // employee/company name cannot corrupt the CSV. The header info lines are
    // single-column rows; the table is a ragged block below them.
    const csvContent = Papa.unparse(
      [
        [
          `${t("reports.attlMonthlyWit.csv.employer")}: ${selectedReturn.employerName}`,
        ],
        [
          `${t("reports.attlMonthlyWit.csv.tinLabel")}: ${selectedReturn.employerTIN}`,
        ],
        [
          `${t("reports.attlMonthlyWit.csv.period")}: ${selectedReturn.reportingPeriod}`,
        ],
        [],
        headers,
        ...rows,
      ],
      { newline: "\n" },
    );

    // Download
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    downloadBlob(blob, `WIT_Monthly_${selectedReturn.reportingPeriod}.csv`);

    toast({
      title: t("reports.attlMonthlyWit.toast.csvExportedTitle"),
      description: t("reports.attlMonthlyWit.toast.csvExportedDescription"),
    });
  };

  const handleExportPDF = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: t("reports.attlMonthlyWit.toast.tinRequiredTitle"),
        description: t("reports.attlMonthlyWit.toast.tinRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { downloadWITReturnPDF } = await import(
        "@/components/reports/WITReturnPDF"
      );
      await downloadWITReturnPDF(
        selectedReturn,
        company || undefined,
        `wit-return-${selectedReturn.reportingPeriod}.pdf`,
      );

      toast({
        title: t("reports.attlMonthlyWit.toast.pdfExportedTitle"),
        description: t("reports.attlMonthlyWit.toast.pdfExportedDescription"),
      });
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.exportFailedTitle"),
        description: t(
          "reports.attlMonthlyWit.toast.pdfExportFailedDescription",
        ),
        variant: "destructive",
      });
    }
  };

  // Signed bank payment order for the month's WIT remittance to the
  // published ATTL BNU account (docs/BANK_PAYMENTS.md). ATTL requires the
  // payment advice to be marked "electronic payment".
  const handleDownloadPaymentOrder = async () => {
    if (!selectedReturn) return;
    try {
      const [
        {
          generateSinglePaymentOrderXlsx,
          formatPeriodLabelPT,
          formatPeriodRefPT,
        },
        { ATTL_TAX_ACCOUNTS },
        { downloadBlob },
        { getTodayTL },
      ] = await Promise.all([
        import("@/lib/bank-transfers/payment-pack"),
        import("@/lib/tlBanking"),
        import("@/lib/downloadBlob"),
        import("@/lib/dateUtils"),
      ]);
      const period = selectedReturn.reportingPeriod;
      const tin =
        selectedReturn.employerTIN || paymentProfile.tin || "________";
      const pack = await generateSinglePaymentOrderXlsx({
        company: {
          name: paymentProfile.companyName || selectedReturn.employerName,
          accountNumber: paymentProfile.debitAccount || "____________",
        },
        bankDisplayName: ATTL_TAX_ACCOUNTS.bank,
        purpose: `do Imposto sobre os Rendimentos Salariais (WIT) de ${formatPeriodLabelPT(period)}`,
        beneficiaryName: ATTL_TAX_ACCOUNTS.beneficiary,
        beneficiaryAccount: ATTL_TAX_ACCOUNTS.accounts.wageIncomeTax,
        reference: `TIN ${tin} — WIT ${formatPeriodRefPT(period)}`,
        amount: selectedReturn.totalWITWithheld,
        valueDate: getTodayTL(),
        fileBaseName: `WIT_Pagamento_${period}`,
        extraNote:
          'Nota: marcar o aviso de pagamento como "electronic payment" (requisito da ATTL).',
      });
      downloadBlob(pack.blob, pack.fileName);
      toast({
        title: t("paymentOrders.downloadedTitle"),
        description: t("paymentOrders.downloadedDescription"),
      });
    } catch (error) {
      console.error("Error generating WIT payment order:", error);
      toast({
        title: t("common.error") || "Error",
        description: t("paymentOrders.failed"),
        variant: "destructive",
      });
    }
  };

  const handleExportOfficialForm = async () => {
    if (!selectedReturn) return;

    if (!company.tinNumber) {
      toast({
        title: t("reports.attlMonthlyWit.toast.tinRequiredTitle"),
        description: t(
          "reports.attlMonthlyWit.toast.officialTinRequiredDescription",
        ),
        variant: "destructive",
      });
      return;
    }

    try {
      const [
        { downloadATTLExcel },
        { billService },
        { mapTLBillWithholdingToATTL },
        { isTLServicesTaxLiableSector, mapSectorReceiptsToDesignatedServices },
      ] = await Promise.all([
        import("@/lib/excel/attlExport"),
        import("@/services/billService"),
        import("@/lib/tax/bill-withholding"),
        import("@/lib/tax/services-tax-tl"),
      ]);
      const [year, month] = selectedReturn.reportingPeriod.split("-");
      const yearNumber = Number(year);
      const monthNumber = Number(month);
      if (
        !/^\d{4}$/.test(year) ||
        !/^\d{2}$/.test(month) ||
        !Number.isInteger(monthNumber) ||
        monthNumber < 1 ||
        monthNumber > 12
      ) {
        throw new Error("The return has an invalid reporting period.");
      }
      const lastDay = new Date(yearNumber, monthNumber, 0).getDate();
      const periodStart = `${year}-${month}-01`;
      const periodEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      const withholdingTotals = await billService.getWithholdingSummary(
        tenantId,
        periodStart,
        periodEnd,
      );

      // Section 3 (services tax, Law 8/2008 Secs. 5-9): for hotel/restaurant
      // tenants the base is the consideration RECEIVED in the month (cash
      // basis, Sec. 9) — customer payments recorded in the period, NOT
      // invoiced/accrued revenue — mapped onto the sector's designated-service
      // line. Other sectors leave Section 3 empty.
      let servicesReceipts: {
        hotelServices?: number;
        restaurantBarServices?: number;
        telecomServices?: number;
      } = {};
      const sector = settings?.companyStructure?.businessSector;
      if (isTLServicesTaxLiableSector(sector)) {
        const { invoiceService } = await import("@/services/invoiceService");
        const receiptsTotal =
          await invoiceService.getPaidInvoiceTotalByDateRange(
            tenantId,
            periodStart,
            periodEnd,
          );
        const designated = mapSectorReceiptsToDesignatedServices(
          sector,
          receiptsTotal,
        );
        servicesReceipts = {
          hotelServices: designated.hotelServices,
          restaurantBarServices: designated.restaurantBarServices,
          telecomServices: designated.telecommunicationsServices,
        };
      }

      await downloadATTLExcel(
        selectedReturn,
        company || undefined,
        `ATTL_Monthly_Tax_${selectedReturn.reportingPeriod}.xlsx`,
        {
          ...mapTLBillWithholdingToATTL(withholdingTotals),
          ...servicesReceipts,
        },
      );

      toast({
        title: t("reports.attlMonthlyWit.toast.officialExportedTitle"),
        description: t(
          "reports.attlMonthlyWit.toast.officialExportedDescription",
        ),
      });
    } catch (error) {
      console.error("Failed to export Excel:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.exportFailedTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("reports.attlMonthlyWit.toast.officialExportFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleMarkAsFiled = async () => {
    if (!selectedFilingId) return;

    try {
      const filing = filings.find((item) => item.id === selectedFilingId);
      if (!filing) throw new Error("Tax filing not found");
      if (selectedTask === "payment") {
        const bankAccount = paymentAccounts.find(
          (account) => account.id === paymentAccountId,
        );
        const isCash = paymentAccountId === "cash";
        await recordPayment.mutateAsync({
          filingId: selectedFilingId,
          payment: {
            paymentDate,
            paymentReference: receiptNumber,
            paymentMethod: isCash ? "cash" : "bank_transfer",
            paymentAccountCode: isCash
              ? "1110"
              : bankAccount?.ledgerAccountCode || "1120",
            bankAccountId: bankAccount?.id,
            bankAccountName: bankAccount
              ? `${bankAccount.accountName} - ${bankAccount.bankName}`
              : undefined,
            paidBy: user?.uid || "",
            notes: filedNotes,
            audit: {
              tenantId,
              userId: user?.uid || "",
              userEmail: user?.email || "",
            },
          },
        });
      } else {
        await markFiled.mutateAsync({
          filingId: selectedFilingId,
          method: filedMethod,
          receiptNumber,
          notes: filedNotes,
          userId: user?.uid || "",
          task: "statement",
          audit: {
            tenantId,
            userId: user?.uid || "",
            userEmail: user?.email || "",
          },
        });
      }

      setShowMarkFiledDialog(false);
      setSelectedFilingId(null);
      setReceiptNumber("");
      setFiledNotes("");

      toast({
        title: t(
          selectedTask === "payment"
            ? "reports.attlMonthlyWit.toast.paymentTitle"
            : "reports.attlMonthlyWit.toast.filedTitle",
        ),
        description: t(
          selectedTask === "payment"
            ? "reports.attlMonthlyWit.toast.paymentDescription"
            : "reports.attlMonthlyWit.toast.filedDescription",
        ),
      });
    } catch (error) {
      console.error("Failed to mark as filed:", error);
      toast({
        title: t("reports.attlMonthlyWit.toast.errorTitle"),
        description: t("reports.attlMonthlyWit.toast.updateErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const openMarkFiledDialog = (filingId: string, task: TaxFilingTask) => {
    setSelectedFilingId(filingId);
    setSelectedTask(task);
    setReceiptNumber("");
    setFiledNotes("");
    if (task === "payment") {
      const preferred =
        paymentAccounts.find((account) => account.purpose === "tax") ||
        paymentAccounts.find((account) => account.purpose === "general") ||
        paymentAccounts[0];
      setPaymentAccountId(preferred?.id || "cash");
      setPaymentDate(getTodayTL());
    }
    setShowMarkFiledDialog(true);
  };

  const selectedFiling = filings.find((item) => item.id === selectedFilingId);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
      value: String(y),
      label: String(y),
    }));
  }, []);

  const overdueFiling = dueDates.find((d) => d.isOverdue);
  const selectedPeriod = `${selectedYear}-${selectedMonth}`;
  const selectedPeriodFiling = filings.find(
    (filing) => filing.period === selectedPeriod,
  );
  const selectedPeriodStatuses = selectedPeriodFiling
    ? getTaskStatuses(selectedPeriodFiling)
    : null;
  const selectedPeriodDue =
    dueDates.find((due) => due.period === selectedPeriod && due.isOverdue) ||
    dueDates.find(
      (due) =>
        due.period === selectedPeriod &&
        due.task === "statement" &&
        due.status === "pending",
    );

  const generating = generateWIT.isPending || saveFiling.isPending;

  useEffect(() => {
    if (attentionPeriodApplied.current || !overdueFiling?.period) return;
    const [year, month] = overdueFiling.period.split("-");
    if (!year || !month) return;
    setSelectedYear(year);
    setSelectedMonth(month);
    attentionPeriodApplied.current = true;
  }, [overdueFiling?.period]);

  const getFilingPrimaryAction = (filing: TaxFiling) => {
    const taskStatuses = getTaskStatuses(filing);

    if (taskStatuses.statement !== "filed") {
      return {
        kind: "view" as const,
        label: t("reports.attlMonthlyWit.actions.continueReturn"),
        icon: FileText,
      };
    }

    if (taskStatuses.payment !== "filed") {
      return {
        kind: "payment" as const,
        label: t("reports.attlMonthlyWit.actions.recordPayment"),
        icon: DollarSign,
      };
    }

    return {
      kind: "view" as const,
      label: t("reports.attlMonthlyWit.actions.viewReturn"),
      icon: FileText,
    };
  };

  const handleFilingPrimaryAction = async (filing: TaxFiling) => {
    const action = getFilingPrimaryAction(filing);
    if (action.kind === "payment") {
      openMarkFiledDialog(filing.id, "payment");
      return;
    }
    await handleViewReturn(filing);
  };

  const handleSelectedPeriodAction = async () => {
    if (!selectedPeriodFiling) {
      await handleGenerateReturn();
      return;
    }
    await handleFilingPrimaryAction(selectedPeriodFiling);
  };

  const selectedPeriodAction = selectedPeriodFiling
    ? getFilingPrimaryAction(selectedPeriodFiling)
    : {
        kind: "generate" as const,
        label: t("reports.attlMonthlyWit.generate.button"),
        icon: FileText,
      };
  const SelectedPeriodActionIcon = selectedPeriodAction.icon;

  const renderFilingActions = (filing: TaxFiling, mobile = false) => {
    const taskStatuses = getTaskStatuses(filing);
    const primaryAction = getFilingPrimaryAction(filing);
    const PrimaryActionIcon = primaryAction.icon;
    const hasMoreActions =
      taskStatuses.statement !== "filed" || taskStatuses.payment !== "filed";

    return (
      <div
        className={
          mobile
            ? "flex w-full items-center gap-2"
            : "flex items-center justify-end gap-1"
        }
      >
        <Button
          variant="outline"
          size="sm"
          className={mobile ? "min-h-11 flex-1" : undefined}
          onClick={() => handleFilingPrimaryAction(filing)}
        >
          <PrimaryActionIcon className="mr-2 h-4 w-4" />
          {primaryAction.label}
        </Button>

        {hasMoreActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 md:h-9 md:w-9"
                aria-label={t("common.moreActions")}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {taskStatuses.statement === "filed" &&
                taskStatuses.payment !== "filed" && (
                  <DropdownMenuItem onClick={() => handleViewReturn(filing)}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("reports.attlMonthlyWit.actions.viewReturn")}
                  </DropdownMenuItem>
                )}
              {taskStatuses.statement !== "filed" && (
                <DropdownMenuItem
                  onClick={() => openMarkFiledDialog(filing.id, "statement")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("reports.attlMonthlyWit.actions.markFiled")}
                </DropdownMenuItem>
              )}
              {taskStatuses.statement !== "filed" &&
                taskStatuses.payment !== "filed" && (
                  <DropdownMenuItem
                    onClick={() => openMarkFiledDialog(filing.id, "payment")}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    {t("reports.attlMonthlyWit.actions.recordPayment")}
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-3 border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-56 max-w-full" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,240px)_max-content]">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full lg:w-48" />
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {Array.from({ length: 3 }, (_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Array.from({ length: 7 }, (_, i) => (
                        <TableHead key={i}>
                          <Skeleton className="h-4 w-16" />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }, (_, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Array.from({ length: 7 }, (_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
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

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={t("reports.attlMonthlyWit.title")}
          description={t("reports.attlMonthlyWit.subtitle")}
        />
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("reports.attlMonthlyWit.title")}
            subtitle={t("reports.attlMonthlyWit.subtitle")}
            icon={Landmark}
            iconColor="text-primary"
          />
          <DashboardLoadError
            isRetrying={retrying}
            onRetry={() =>
              Promise.all([refetchSettings(), refetchFilings(), refetchDues()])
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("reports.attlMonthlyWit.title")}
        description={t("reports.attlMonthlyWit.subtitle")}
      />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("reports.attlMonthlyWit.title")}
          subtitle={t("reports.attlMonthlyWit.subtitle")}
          icon={Landmark}
          iconColor="text-primary"
        />

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <ReportCardHeader
              icon={FileText}
              accent="amber"
              title={t("reports.attlMonthlyWit.generate.title")}
              description={t("reports.attlMonthlyWit.generate.description")}
            />
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedPeriodDue && (
              <div
                role="alert"
                className={
                  selectedPeriodDue.isOverdue
                    ? "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                    : "flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                }
              >
                {selectedPeriodDue.isOverdue ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {t(
                      selectedPeriodDue.isOverdue
                        ? "reports.attlMonthlyWit.alerts.overdueTitle"
                        : "reports.attlMonthlyWit.alerts.upcomingTitle",
                    )}
                  </p>
                  <p className="mt-0.5 text-sm">
                    {t(
                      selectedPeriodDue.task === "payment"
                        ? selectedPeriodDue.isOverdue
                          ? "reports.attlMonthlyWit.alerts.paymentOverdueDescription"
                          : "reports.attlMonthlyWit.alerts.paymentUpcomingDescription"
                        : selectedPeriodDue.isOverdue
                          ? "reports.attlMonthlyWit.alerts.overdueDescription"
                          : "reports.attlMonthlyWit.alerts.upcomingDescription",
                      {
                        period: formatPeriodLabel(selectedPeriodDue.period),
                        dueDate: formatDisplayDate(selectedPeriodDue.dueDate),
                        days: selectedPeriodDue.daysUntilDue,
                      },
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,240px)_max-content] lg:items-end">
              <div>
                <Label className="mb-2 block" htmlFor="wit-report-year">
                  {t("reports.attlMonthlyWit.generate.year")}
                </Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger
                    id="wit-report-year"
                    className="min-h-11 text-base sm:text-sm"
                  >
                    <SelectValue
                      placeholder={t(
                        "reports.attlMonthlyWit.generate.selectYear",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block" htmlFor="wit-report-month">
                  {t("reports.attlMonthlyWit.generate.month")}
                </Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger
                    id="wit-report-month"
                    className="min-h-11 text-base sm:text-sm"
                  >
                    <SelectValue
                      placeholder={t(
                        "reports.attlMonthlyWit.generate.selectMonth",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="min-h-11 w-full lg:w-auto lg:justify-self-start"
                variant={
                  selectedPeriodStatuses?.statement === "filed" &&
                  selectedPeriodStatuses?.payment === "filed"
                    ? "outline"
                    : "default"
                }
                onClick={handleSelectedPeriodAction}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SelectedPeriodActionIcon className="mr-2 h-4 w-4" />
                )}
                {generating
                  ? t("reports.attlMonthlyWit.generate.generating")
                  : selectedPeriodAction.label}
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Building className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {company.legalName ||
                      company.tradingName ||
                      t("reports.attlMonthlyWit.company.notSet")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("reports.attlMonthlyWit.company.tin")}{" "}
                    <span className="font-mono">
                      {company.tinNumber ||
                        t("reports.attlMonthlyWit.company.notSet")}
                    </span>
                  </p>
                </div>
              </div>
              {company.tinNumber ? (
                <Badge
                  variant="outline"
                  className="w-fit border-green-500/30 text-green-700 dark:text-green-400"
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  {t("reports.attlMonthlyWit.company.tinReady")}
                </Badge>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t("reports.attlMonthlyWit.company.tinHint")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Return Preview */}
        {selectedReturn && (
          <>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-4">
                <ReportCardHeader
                  icon={FileText}
                  title={t("reports.attlMonthlyWit.preview.title", {
                    period: formatPeriodLabel(selectedReturn.reportingPeriod),
                  })}
                  description={t(
                    "reports.attlMonthlyWit.preview.periodDescription",
                    {
                      start: formatDisplayDate(selectedReturn.periodStartDate),
                      end: formatDisplayDate(selectedReturn.periodEndDate),
                    },
                  )}
                  actions={
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportOfficialForm}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        {t("reports.attlMonthlyWit.actions.officialForm")}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="mr-2 h-4 w-4" />
                            {t("common.moreActions")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleExportCSV}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleDownloadPaymentOrder}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {t("paymentOrders.action")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  }
                />
              </CardHeader>
              <CardContent>
                {/* Assisted e-Tax filing — the two numbers the portal wants */}
                <AssistedEtaxFiling ret={selectedReturn} />

                {/* Summary */}
                <dl className="mb-6 grid gap-x-8 sm:grid-cols-2">
                  <div className="border-b border-border/50 py-2.5">
                    <dt className="text-sm text-muted-foreground">
                      {t("reports.attlMonthlyWit.preview.totalEmployees")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {selectedReturn.totalEmployees}
                    </dd>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("reports.attlMonthlyWit.preview.employeeBreakdown", {
                        residents: selectedReturn.totalResidentEmployees,
                        nonResidents: selectedReturn.totalNonResidentEmployees,
                      })}
                    </p>
                  </div>
                  <div className="border-b border-border/50 py-2.5">
                    <dt className="text-sm text-muted-foreground">
                      {t("reports.attlMonthlyWit.preview.totalGrossWages")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {formatCurrencyTL(selectedReturn.totalGrossWages)}
                    </dd>
                  </div>
                  <div className="py-2.5">
                    <dt className="text-sm text-muted-foreground">
                      {t("reports.attlMonthlyWit.preview.taxableWages")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {formatCurrencyTL(selectedReturn.totalTaxableWages)}
                    </dd>
                  </div>
                  <div className="py-2.5">
                    <dt className="text-sm text-muted-foreground">
                      {t("reports.attlMonthlyWit.preview.totalWit")}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums">
                      {formatCurrencyTL(selectedReturn.totalWITWithheld)}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-3 md:hidden">
                  {selectedReturn.employees.map((emp) => (
                    <Card key={emp.employeeId}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{emp.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {emp.employeeId}
                            </p>
                          </div>
                          <Badge
                            variant={emp.isResident ? "default" : "secondary"}
                          >
                            {emp.isResident
                              ? t("reports.attlMonthlyWit.table.residentYes")
                              : t("reports.attlMonthlyWit.table.residentNo")}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.table.grossWages")}
                            </p>
                            <p>{formatCurrencyTL(emp.grossWages)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.table.taxable")}
                            </p>
                            <p>{formatCurrencyTL(emp.taxableWages)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("reports.attlMonthlyWit.table.witWithheld")}
                            </p>
                            <p className="font-semibold">
                              {formatCurrencyTL(emp.witWithheld)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t("reports.attlMonthlyWit.table.employeeId")}
                        </TableHead>
                        <TableHead>
                          {t("reports.attlMonthlyWit.table.name")}
                        </TableHead>
                        <TableHead>
                          {t("reports.attlMonthlyWit.table.resident")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.attlMonthlyWit.table.grossWages")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.attlMonthlyWit.table.taxable")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.attlMonthlyWit.table.witWithheld")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.employees.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell className="font-mono text-sm">
                            {emp.employeeId}
                          </TableCell>
                          <TableCell>{emp.fullName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={emp.isResident ? "default" : "secondary"}
                            >
                              {emp.isResident
                                ? t("reports.attlMonthlyWit.table.residentYes")
                                : t("reports.attlMonthlyWit.table.residentNo")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyTL(emp.grossWages)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyTL(emp.taxableWages)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrencyTL(emp.witWithheld)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Collapsible
              open={showPaymentDetails}
              onOpenChange={setShowPaymentDetails}
            >
              <Card className="border-border/70 shadow-sm">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start justify-between gap-4 rounded-lg p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <Landmark className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">
                          {t("reports.attlMonthlyWit.payment.title")}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {t(
                            "reports.attlMonthlyWit.instructions.dueDateValue",
                          )}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        showPaymentDetails ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <p className="text-sm text-muted-foreground">
                      {t("reports.attlMonthlyWit.payment.description")}
                    </p>
                    <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
                      <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
                        <dt className="text-muted-foreground">
                          {t("reports.attlMonthlyWit.payment.beneficiary")}
                        </dt>
                        <dd className="text-right font-medium">
                          {ATTL_TAX_ACCOUNTS.beneficiary}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-border/50 py-2.5">
                        <dt className="text-muted-foreground">
                          {t("reports.attlMonthlyWit.payment.bank")}
                        </dt>
                        <dd className="text-right font-medium">
                          {ATTL_TAX_ACCOUNTS.bank}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1 border-b border-border/50 py-2.5 sm:border-b-0">
                        <dt className="text-muted-foreground">
                          {t("reports.attlMonthlyWit.payment.account")}
                        </dt>
                        <dd className="break-all font-mono font-medium">
                          {ATTL_TAX_ACCOUNTS.accounts.wageIncomeTax}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-muted-foreground">SWIFT</dt>
                        <dd className="font-mono font-medium">
                          {ATTL_TAX_ACCOUNTS.swift}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground">
                      <strong className="font-medium text-foreground">
                        {t("reports.attlMonthlyWit.instructions.supportLabel")}
                      </strong>{" "}
                      {t("reports.attlMonthlyWit.instructions.supportValue")}
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}

        {/* Filing History */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <ReportCardHeader
              icon={Calendar}
              title={t("reports.attlMonthlyWit.history.title")}
              description={t("reports.attlMonthlyWit.history.description")}
            />
          </CardHeader>
          <CardContent>
            <div className="md:hidden">
              {filings.length === 0 ? (
                <p className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
                  {t("reports.attlMonthlyWit.history.empty")}
                </p>
              ) : (
                <div className="divide-y divide-border/70 rounded-lg border border-border/70">
                  {filings.map((filing) => {
                    const taskStatuses = getTaskStatuses(filing);
                    const statusConfig = getStatusConfig(
                      taskStatuses.statement,
                    );
                    const paymentConfig = getStatusConfig(taskStatuses.payment);
                    const StatusIcon = statusConfig.icon;
                    const PaymentIcon = paymentConfig.icon;

                    return (
                      <div key={filing.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {formatPeriodLabel(filing.period)}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.dueDate")}:{" "}
                              {formatDisplayDate(filing.dueDate)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.wit")}
                            </p>
                            <p className="font-semibold tabular-nums">
                              {formatCurrencyTL(filing.totalWITWithheld)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={statusConfig.className}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {t(
                              "reports.attlMonthlyWit.history.returnStatus",
                            )}: {statusConfig.label}
                          </Badge>
                          <Badge className={paymentConfig.className}>
                            <PaymentIcon className="mr-1 h-3 w-3" />
                            {t(
                              "reports.attlMonthlyWit.history.paymentStatus",
                            )}: {paymentConfig.label}
                          </Badge>
                        </div>
                        {renderFilingActions(filing, true)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("reports.attlMonthlyWit.history.period")}
                    </TableHead>
                    <TableHead>
                      {t("reports.attlMonthlyWit.history.status")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.attlMonthlyWit.history.wit")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("reports.attlMonthlyWit.history.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {t("reports.attlMonthlyWit.history.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filings.map((filing) => {
                      const taskStatuses = getTaskStatuses(filing);
                      const statusConfig = getStatusConfig(
                        taskStatuses.statement,
                      );
                      const paymentConfig = getStatusConfig(
                        taskStatuses.payment,
                      );
                      const StatusIcon = statusConfig.icon;
                      const PaymentIcon = paymentConfig.icon;

                      return (
                        <TableRow key={filing.id}>
                          <TableCell>
                            <p className="font-medium">
                              {formatPeriodLabel(filing.period)}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t("reports.attlMonthlyWit.history.dueDate")}:{" "}
                              {formatDisplayDate(filing.dueDate)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={statusConfig.className}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {t(
                                  "reports.attlMonthlyWit.history.returnStatus",
                                )}
                                : {statusConfig.label}
                              </Badge>
                              <Badge className={paymentConfig.className}>
                                <PaymentIcon className="mr-1 h-3 w-3" />
                                {t(
                                  "reports.attlMonthlyWit.history.paymentStatus",
                                )}
                                : {paymentConfig.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrencyTL(filing.totalWITWithheld)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderFilingActions(filing)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Collapsible
          open={showSupplierWithholding}
          onOpenChange={setShowSupplierWithholding}
          className="space-y-3"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-start justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  aria-hidden
                >
                  <Landmark className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">
                    {t("supplierRemittance.title")}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {t("supplierRemittance.description")}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  showSupplierWithholding ? "rotate-180" : ""
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {showSupplierWithholding && (
              <SupplierWithholdingRemittancePanel period={selectedPeriod} />
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Mark as Filed Dialog */}
      <Dialog open={showMarkFiledDialog} onOpenChange={setShowMarkFiledDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                selectedTask === "payment"
                  ? "reports.attlMonthlyWit.markFiled.paymentTitle"
                  : "reports.attlMonthlyWit.markFiled.title",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                selectedTask === "payment"
                  ? "reports.attlMonthlyWit.markFiled.paymentDescription"
                  : "reports.attlMonthlyWit.markFiled.description",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTask === "statement" && (
              <div>
                <Label htmlFor="wit-submission-method">
                  {t("reports.attlMonthlyWit.markFiled.submissionMethod")}
                </Label>
                <Select
                  value={filedMethod}
                  onValueChange={(v) => setFiledMethod(v as SubmissionMethod)}
                >
                  <SelectTrigger id="wit-submission-method">
                    <SelectValue
                      placeholder={t(
                        "reports.attlMonthlyWit.markFiled.selectMethod",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etax">
                      {t("reports.attlMonthlyWit.markFiled.etax")}
                    </SelectItem>
                    <SelectItem value="bnu_paper">
                      {t("reports.attlMonthlyWit.markFiled.bnu")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedTask === "payment" && (
              <>
                <div>
                  <Label htmlFor="wit-payment-date">
                    {t("reports.attlMonthlyWit.markFiled.paymentDate")}
                  </Label>
                  <Input
                    id="wit-payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="wit-payment-account">
                    {t("reports.attlMonthlyWit.markFiled.paymentAccount")}
                  </Label>
                  <Select
                    value={paymentAccountId}
                    onValueChange={setPaymentAccountId}
                  >
                    <SelectTrigger id="wit-payment-account">
                      <SelectValue
                        placeholder={t(
                          "reports.attlMonthlyWit.markFiled.selectPaymentAccount",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName} - {account.bankName} ****
                          {account.accountNumber.slice(-4)}
                        </SelectItem>
                      ))}
                      <SelectItem value="cash">
                        {t("reports.attlMonthlyWit.markFiled.cashOnHand")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="wit-receipt-reference">
                {t(
                  selectedTask === "payment"
                    ? "reports.attlMonthlyWit.markFiled.paymentReferenceLabel"
                    : "reports.attlMonthlyWit.markFiled.receiptLabel",
                )}
              </Label>
              <Input
                id="wit-receipt-reference"
                placeholder={t(
                  "reports.attlMonthlyWit.markFiled.receiptPlaceholder",
                )}
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="wit-filing-notes">
                {t("reports.attlMonthlyWit.markFiled.notesLabel")}
              </Label>
              <Textarea
                id="wit-filing-notes"
                placeholder={t(
                  "reports.attlMonthlyWit.markFiled.notesPlaceholder",
                )}
                value={filedNotes}
                onChange={(e) => setFiledNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMarkFiledDialog(false)}
            >
              {t("reports.attlMonthlyWit.markFiled.cancel")}
            </Button>
            <Button
              onClick={handleMarkAsFiled}
              disabled={
                markFiled.isPending ||
                recordPayment.isPending ||
                (selectedTask === "payment" &&
                  (!paymentDate ||
                    !paymentAccountId ||
                    ((selectedFiling?.totalWITWithheld || 0) > 0 &&
                      !receiptNumber.trim())))
              }
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t(
                selectedTask === "payment"
                  ? "reports.attlMonthlyWit.markFiled.confirmPayment"
                  : "reports.attlMonthlyWit.markFiled.confirm",
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
