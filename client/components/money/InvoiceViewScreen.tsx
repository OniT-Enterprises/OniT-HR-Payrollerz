/**
 * InvoiceViewScreen — read view for sent/paid invoices
 * Template-rendered invoice paper with a side rail for balance,
 * template switching, and payment history.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import {
  invoiceKeys,
  useInvoiceCreditNotes,
  useInvoicePayments,
  useUpdateInvoiceTemplate,
} from '@/hooks/useInvoices';
import { InvoiceStatusTimeline } from '@/components/money/InvoiceStatusTimeline';
import { RecordPaymentModal } from '@/components/money/RecordPaymentModal';
import { RefundPaymentDialog } from '@/components/money/RefundPaymentDialog';
import { CreditNoteDialog } from '@/components/money/CreditNoteDialog';
import { SendReminderDialog } from '@/components/money/SendReminderDialog';
import { VoidInvoiceDialog } from '@/components/money/VoidInvoiceDialog';
import { InvoicePaper } from '@/components/money/InvoicePaper';
import { INVOICE_TEMPLATES, paymentMethodLabel, formatInvoiceDate } from '@/lib/invoiceTemplates';
import { getEffectiveInvoiceStatus } from '@/lib/invoiceStatus';
import { buildInvoiceWhatsAppUrl } from '@/lib/publicInvoice';
import { compareMoney, subtractMoney } from '@/lib/currency';
import type {
  Invoice,
  InvoiceSettings,
  InvoiceStatus,
  InvoiceTemplateId,
  PaymentReceived,
} from '@/types/money';
import {
  FileText,
  ArrowLeft,
  Download,
  Share2,
  DollarSign,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Copy,
  Palette,
  Receipt,
  AlertTriangle,
  Bell,
  MoreHorizontal,
  RotateCcw,
  XCircle,
} from 'lucide-react';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  credited: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const PAYABLE_STATUSES: InvoiceStatus[] = ['sent', 'viewed', 'partial', 'overdue'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

interface InvoiceViewScreenProps {
  invoice: Invoice;
  settings: Partial<InvoiceSettings>;
}

export function InvoiceViewScreen({ invoice, settings }: InvoiceViewScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session, canManage } = useTenant();
  const tenantId = useTenantId();
  const canManageTenant = canManage();
  const queryClient = useQueryClient();

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [refundPayment, setRefundPayment] = useState<PaymentReceived | null>(null);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCreditId, setDownloadingCreditId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [retryingDelivery, setRetryingDelivery] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showResetLinkDialog, setShowResetLinkDialog] = useState(false);
  const [resettingLink, setResettingLink] = useState(false);
  const sendInFlight = useRef(false);

  const paymentsQuery = useInvoicePayments(invoice.id);
  const creditsQuery = useInvoiceCreditNotes(invoice.id);
  const payments = paymentsQuery.data ?? [];
  const creditNotes = creditsQuery.data ?? [];
  const updateTemplateMutation = useUpdateInvoiceTemplate();
  const displayStatus = getEffectiveInvoiceStatus(invoice);
  const displayInvoice =
    displayStatus === invoice.status ? invoice : { ...invoice, status: displayStatus };
  const canRecordPayment =
    canManageTenant && PAYABLE_STATUSES.includes(invoice.status);
  const canIssueCredit =
    canManageTenant &&
    PAYABLE_STATUSES.includes(invoice.status) &&
    compareMoney(invoice.balanceDue, 0) > 0;
  const canSendReminder = canRecordPayment;
  const canVoid =
    canManageTenant &&
    invoice.status !== 'draft' &&
    !['paid', 'credited', 'cancelled'].includes(invoice.status) &&
    compareMoney(invoice.amountPaid || 0, 0) === 0 &&
    compareMoney(invoice.creditedAmount || 0, 0) === 0;

  useEffect(() => {
    if (
      canManageTenant &&
      searchParams.get('record') === 'payment' &&
      PAYABLE_STATUSES.includes(invoice.status)
    ) {
      setShowPaymentDialog(true);
    }
  }, [canManageTenant, searchParams, invoice.status]);

  const invalidateInvoice = () => {
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
  };

  const invalidateFinancialActivity = () => {
    invalidateInvoice();
    queryClient.invalidateQueries({
      queryKey: [...invoiceKeys.detail(tenantId, invoice.id), 'payments'],
    });
    queryClient.invalidateQueries({
      queryKey: [...invoiceKeys.detail(tenantId, invoice.id), 'creditNotes'],
    });
  };

  // Radix menus and modal dialogs both manage a document-level pointer lock.
  // Let the menu fully close before opening a dialog so its cleanup cannot
  // remove (or strand) the dialog's lock on the next frame.
  const openAfterMenuClose = (openDialog: () => void) => {
    window.setTimeout(openDialog, 0);
  };

  const handleSend = async () => {
    if (!canManageTenant || !session?.member.uid || sendInFlight.current) return;
    sendInFlight.current = true;
    try {
      setSending(true);
      const delivery = await invoiceService.markAsSent(
        tenantId,
        invoice.id,
        session.member.uid,
      );
      invalidateInvoice();
      toast({
        title: 'Invoice issued',
        description:
          delivery.email === 'queued'
            ? `Email queued for ${invoice.customerEmail}.`
            : delivery.email === 'not_requested'
              ? 'The invoice is ready to share. This customer has no email address.'
              : `The invoice is issued, but delivery needs attention. ${delivery.error || ''}`.trim(),
      });
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error ? error.message : t('money.invoices.sendError') || 'Failed to issue invoice',
        variant: 'destructive',
      });
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const handleRetryDelivery = async () => {
    if (!canManageTenant || !session?.member.uid || retryingDelivery) return;
    setRetryingDelivery(true);
    try {
      const delivery = await invoiceService.retryInvoiceDelivery(
        tenantId,
        invoice.id,
        session.member.uid,
      );
      invalidateInvoice();
      toast({
        title: delivery.email === 'queued' ? 'Email queued' : 'Delivery not completed',
        description:
          delivery.email === 'queued'
            ? `Invoice email queued for ${invoice.customerEmail}.`
            : delivery.error || 'The customer link is ready, but no email was queued.',
        ...(delivery.email === 'failed' ? { variant: 'destructive' as const } : {}),
      });
    } catch (error) {
      console.error('Error retrying invoice delivery:', error);
      toast({
        title: 'Delivery not completed',
        description: error instanceof Error ? error.message : 'Failed to retry invoice delivery.',
        variant: 'destructive',
      });
    } finally {
      setRetryingDelivery(false);
    }
  };

  // Publishes (or refreshes) the hosted page and returns its public URL
  const ensureShareUrl = async (): Promise<string | null> => {
    try {
      setSharing(true);
      const { url } = await invoiceService.ensureShareLink(tenantId, invoice, settings);
      return url;
    } catch (error) {
      console.error('Error creating invoice link:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.shareError') || 'Failed to share invoice',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    const url = await ensureShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.linkCopied') || 'Invoice link copied to clipboard',
      });
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: 'Link not copied',
        description: 'Copying is unavailable in this browser. Open the customer page and copy its address instead.',
        variant: 'destructive',
      });
    }
  };

  const handleWhatsApp = async () => {
    const url = await ensureShareUrl();
    if (!url) return;
    window.open(buildInvoiceWhatsAppUrl(invoice, url, settings.companyName), '_blank', 'noopener');
  };

  const handleOpenPublicPage = async () => {
    const url = await ensureShareUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  };

  const handleResetLink = async () => {
    try {
      setResettingLink(true);
      const { url } = await invoiceService.regenerateShareLink(tenantId, invoice.id);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      invalidateInvoice();
      toast({
        title: t('common.success') || 'Success',
        description:
          t('money.invoices.linkReset') ||
          'Old link disabled. New link copied to clipboard.',
      });
    } catch (error) {
      console.error('Error resetting invoice link:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.linkResetError') || 'Failed to reset link',
        variant: 'destructive',
      });
    } finally {
      setResettingLink(false);
      setShowResetLinkDialog(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPdf(true);
      const { downloadInvoicePDF } = await import('@/components/money/InvoicePDF');
      await downloadInvoicePDF(displayInvoice, settings);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.pdfDownloaded') || 'Invoice PDF downloaded',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.pdfError') || 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCreditNote = async (creditNote: (typeof creditNotes)[number]) => {
    setDownloadingCreditId(creditNote.id);
    try {
      const { downloadCreditNotePDF } = await import('@/components/money/CreditNotePDF');
      await downloadCreditNotePDF(creditNote, invoice, settings);
    } catch (error) {
      console.error('Error downloading credit note:', error);
      toast({
        title: 'Credit note not downloaded',
        description: error instanceof Error ? error.message : 'Failed to generate the credit-note PDF.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingCreditId(null);
    }
  };

  const handleDuplicate = () => {
    if (!canManageTenant) return;
    navigate(`/money/invoices/new?duplicate=${invoice.id}`);
  };

  const handleTemplateChange = (templateId: InvoiceTemplateId) => {
    if (!canManageTenant || updateTemplateMutation.isPending) return;
    updateTemplateMutation.mutate(
      { id: invoice.id, templateId },
      {
        onError: () =>
          toast({
            title: t('common.error') || 'Error',
            description: t('money.invoices.templateError') || 'Failed to change template',
            variant: 'destructive',
          }),
      }
    );
  };

  // Optimistic template while the mutation is in flight
  const activeTemplate =
    (updateTemplateMutation.isPending && updateTemplateMutation.variables?.templateId) ||
    invoice.templateId;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`Invoice ${invoice.invoiceNumber} - Xefe`} />
      <MainNavigation />

      <div className="p-6 max-w-screen-xl mx-auto">
        <PageHeader
          title={`${t('money.invoices.invoice') || 'Invoice'} ${invoice.invoiceNumber}`}
          subtitle={invoice.customerName}
          icon={FileText}
          iconColor="text-indigo-500"
          actions={
            <>
              <Button variant="ghost" onClick={() => navigate('/money/invoices')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back') || 'Back'}
              </Button>
              {canManageTenant && (
                <Button variant="outline" onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('money.invoices.duplicate') || 'Duplicate'}
                </Button>
              )}
              <Button variant="outline" onClick={handleDownloadPDF} disabled={downloadingPdf}>
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t('money.invoices.downloadPdf') || 'Download PDF'}
              </Button>
              {canManageTenant && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={sharing}>
                      {sharing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Share2 className="h-4 w-4 mr-2" />
                      )}
                      {t('money.invoices.share') || 'Share'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Link2 className="h-4 w-4 mr-2" />
                      {t('money.invoices.copyLink') || 'Copy link'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleWhatsApp}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {t('money.invoices.shareWhatsApp') || 'Send by WhatsApp'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenPublicPage}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('money.invoices.openPublicPage') || 'Open customer page'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        openAfterMenuClose(() => setShowResetLinkDialog(true))
                      }
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('money.invoices.resetLink') || 'Reset link…'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canManageTenant && invoice.status === 'draft' && (
                <Button
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {t('money.invoices.send') || 'Send'}
                </Button>
              )}
              {canRecordPayment && (
                <Button
                  onClick={() => setShowPaymentDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t('money.invoices.recordPayment') || 'Record Payment'}
                </Button>
              )}
            </>
          }
        />

        {invoice.deliveryStatus === 'failed' && invoice.status !== 'draft' && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Invoice issued, but customer delivery failed</p>
                <p className="text-muted-foreground">
                  {invoice.deliveryError || 'The customer email could not be prepared or queued.'}
                </p>
              </div>
            </div>
            {canManageTenant && (
              <Button variant="outline" size="sm" onClick={handleRetryDelivery} disabled={retryingDelivery}>
                {retryingDelivery ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry delivery
              </Button>
            )}
          </div>
        )}

        {['preparing', 'queued'].includes(invoice.deliveryStatus || '') && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {invoice.deliveryStatus === 'queued'
              ? 'Invoice issued. The customer email is queued.'
              : 'Invoice issued. Preparing the customer link and PDF…'}
          </div>
        )}

        {/* Status Timeline */}
        <Card className="mb-6">
          <CardContent className="py-2">
            <InvoiceStatusTimeline invoice={invoice} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Invoice paper */}
          <div className="lg:col-span-2">
            <InvoicePaper
              invoice={displayInvoice}
              settings={settings}
              templateId={activeTemplate}
            />
          </div>

          {/* Side rail */}
          <div className="space-y-6">
            {/* Balance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  {t('money.invoices.balanceDue') || 'Balance Due'}
                  <Badge className={STATUS_STYLES[displayStatus]} variant="secondary">
                    {t(`money.status.${displayStatus}`) || displayStatus}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrency(invoice.balanceDue)}
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('money.invoices.total') || 'Total'}
                    </span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('money.invoices.paid') || 'Paid'}
                    </span>
                    <span className="text-green-600">{formatCurrency(invoice.amountPaid || 0)}</span>
                  </div>
                  {(invoice.creditedAmount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credited</span>
                      <span className="text-blue-600">{formatCurrency(invoice.creditedAmount || 0)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('money.invoices.dueDate') || 'Due Date'}
                    </span>
                    <span className="font-medium">{formatInvoiceDate(invoice.dueDate)}</span>
                  </div>
                </div>
                {canRecordPayment && (
                  <Button className="w-full" variant="outline" onClick={() => setShowPaymentDialog(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t('money.invoices.recordPayment') || 'Record Payment'}
                  </Button>
                )}
                {canManageTenant && (canIssueCredit || canSendReminder || canVoid) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full" variant="ghost">
                        <MoreHorizontal className="mr-2 h-4 w-4" />
                        More actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {canIssueCredit && (
                        <DropdownMenuItem
                          onSelect={() =>
                            openAfterMenuClose(() => setShowCreditNoteDialog(true))
                          }
                        >
                          <Receipt className="mr-2 h-4 w-4" />
                          Issue credit note
                        </DropdownMenuItem>
                      )}
                      {canSendReminder && (
                        <DropdownMenuItem
                          onSelect={() =>
                            openAfterMenuClose(() => setShowReminderDialog(true))
                          }
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          Send reminder
                        </DropdownMenuItem>
                      )}
                      {canVoid && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={() =>
                              openAfterMenuClose(() => setShowVoidDialog(true))
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Void invoice
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>

            {/* Template switcher */}
            {canManageTenant && invoice.status !== 'cancelled' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    {t('money.invoices.template') || 'Template'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={activeTemplate || 'classic'}
                    onValueChange={(v) => handleTemplateChange(v as InvoiceTemplateId)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {t(`money.invoices.template_${template.id}`) || template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('money.invoices.templateHint') || 'Changes how this invoice looks on screen and in the PDF.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Payment history */}
            {(paymentsQuery.isLoading || paymentsQuery.error || payments.length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {t('money.invoices.paymentHistory') || 'Payment History'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentsQuery.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading payments…
                    </div>
                  )}
                  {paymentsQuery.error && (
                    <div className="space-y-2 text-sm">
                      <p className="text-destructive">Payment history could not be loaded.</p>
                      <Button size="sm" variant="outline" onClick={() => paymentsQuery.refetch()}>
                        Retry
                      </Button>
                    </div>
                  )}
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className={`font-medium ${payment.kind === 'refund' ? 'text-orange-600' : ''}`}>
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatInvoiceDate(payment.date)} · {paymentMethodLabel(payment.method)}
                          {payment.reference ? ` · ${payment.reference}` : ''}
                        </p>
                        {payment.kind !== 'refund' && (payment.refundedAmount || 0) > 0 && (
                          <p className="text-xs text-orange-600">
                            {formatCurrency(payment.refundedAmount || 0)} refunded
                          </p>
                        )}
                        {payment.kind === 'refund' && payment.notes && (
                          <p className="text-xs text-muted-foreground">{payment.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant="secondary"
                          className={payment.kind === 'refund'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}
                        >
                          {payment.kind === 'refund' ? 'Refund' : t('money.invoices.received') || 'Received'}
                        </Badge>
                        {canManageTenant &&
                          payment.kind !== 'refund' &&
                          compareMoney(subtractMoney(payment.amount, payment.refundedAmount || 0), 0) > 0 &&
                          invoice.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setRefundPayment(payment)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Refund
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(creditsQuery.isLoading || creditsQuery.error || creditNotes.length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4" />
                    Credit notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creditsQuery.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading credit notes…
                    </div>
                  )}
                  {creditsQuery.error && (
                    <div className="space-y-2 text-sm">
                      <p className="text-destructive">Credit notes could not be loaded.</p>
                      <Button size="sm" variant="outline" onClick={() => creditsQuery.refetch()}>
                        Retry
                      </Button>
                    </div>
                  )}
                  {creditNotes.map((creditNote) => (
                    <div key={creditNote.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">{creditNote.creditNoteNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInvoiceDate(creditNote.date)} · {creditNote.reason}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="font-medium text-blue-600">-{formatCurrency(creditNote.amount)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`Download ${creditNote.creditNoteNumber}`}
                          disabled={downloadingCreditId === creditNote.id}
                          onClick={() => handleDownloadCreditNote(creditNote)}
                        >
                          {downloadingCreditId === creditNote.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {canManageTenant && (
        <RecordPaymentModal
          invoice={invoice}
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onPaymentRecorded={() => {
            invalidateFinancialActivity();
          }}
        />
      )}

      {canManageTenant && refundPayment && (
        <RefundPaymentDialog
          invoice={invoice}
          payment={refundPayment}
          open={!!refundPayment}
          onClose={() => setRefundPayment(null)}
          onRefunded={invalidateFinancialActivity}
        />
      )}

      {canManageTenant && (
        <CreditNoteDialog
          invoice={invoice}
          open={showCreditNoteDialog}
          onClose={() => setShowCreditNoteDialog(false)}
          onCredited={invalidateFinancialActivity}
        />
      )}

      {canManageTenant && (
        <SendReminderDialog
          invoice={invoice}
          open={showReminderDialog}
          onClose={() => setShowReminderDialog(false)}
          onReminderSent={invalidateInvoice}
        />
      )}

      {canManageTenant && (
        <VoidInvoiceDialog
          invoice={invoice}
          open={showVoidDialog}
          onClose={() => setShowVoidDialog(false)}
          onVoided={invalidateInvoice}
        />
      )}

      <AlertDialog open={showResetLinkDialog} onOpenChange={setShowResetLinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('money.invoices.resetLinkTitle') || 'Reset the invoice link?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('money.invoices.resetLinkDescription') ||
                'The current link will stop working immediately and a new one will be created. Use this if the link was shared with the wrong person.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingLink}>
              {t('common.cancel') || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResetLink();
              }}
              disabled={resettingLink}
            >
              {resettingLink ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('money.invoices.resetLink') || 'Reset link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default InvoiceViewScreen;
