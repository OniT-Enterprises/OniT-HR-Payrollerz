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
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import {
  invoiceKeys,
  useInvoicePayments,
  useUpdateInvoiceTemplate,
} from '@/hooks/useInvoices';
import { InvoiceStatusTimeline } from '@/components/money/InvoiceStatusTimeline';
import { RecordPaymentModal } from '@/components/money/RecordPaymentModal';
import { InvoicePaper } from '@/components/money/InvoicePaper';
import { INVOICE_TEMPLATES, paymentMethodLabel, formatInvoiceDate } from '@/lib/invoiceTemplates';
import { getEffectiveInvoiceStatus } from '@/lib/invoiceStatus';
import type { Invoice, InvoiceSettings, InvoiceStatus, InvoiceTemplateId } from '@/types/money';
import {
  FileText,
  ArrowLeft,
  Download,
  Share2,
  DollarSign,
  Loader2,
  Send,
  Copy,
  Palette,
  Receipt,
} from 'lucide-react';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
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
  const { canManage } = useTenant();
  const tenantId = useTenantId();
  const canManageTenant = canManage();
  const queryClient = useQueryClient();

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const sendInFlight = useRef(false);

  const { data: payments = [] } = useInvoicePayments(invoice.id);
  const updateTemplateMutation = useUpdateInvoiceTemplate();
  const displayStatus = getEffectiveInvoiceStatus(invoice);
  const displayInvoice =
    displayStatus === invoice.status ? invoice : { ...invoice, status: displayStatus };
  const canRecordPayment =
    canManageTenant && PAYABLE_STATUSES.includes(invoice.status);

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

  const handleSend = async () => {
    if (!canManageTenant || sendInFlight.current) return;
    sendInFlight.current = true;
    try {
      setSending(true);
      await invoiceService.markAsSent(tenantId, invoice.id);
      invalidateInvoice();
      toast({
        title: t('common.success') || 'Success',
        description: invoice.customerEmail
          ? (t('money.invoices.sentToEmail') || 'Invoice emailed to {{email}}').replace('{{email}}', invoice.customerEmail)
          : t('money.invoices.sentSuccess') || 'Invoice marked as sent',
      });
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.sendError') || 'Failed to send invoice',
        variant: 'destructive',
      });
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(invoiceService.getShareUrl(invoice));
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.linkCopied') || 'Invoice link copied to clipboard',
      });
    } catch (error) {
      console.error('Error sharing:', error);
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
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                {t('money.invoices.share') || 'Share'}
              </Button>
              {canManageTenant && invoice.status === 'draft' && (
                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-indigo-600 hover:bg-indigo-700"
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
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t('money.invoices.recordPayment') || 'Record Payment'}
                </Button>
              )}
            </>
          }
        />

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
            {payments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {t('money.invoices.paymentHistory') || 'Payment History'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInvoiceDate(payment.date)} · {paymentMethodLabel(payment.method)}
                          {payment.reference ? ` · ${payment.reference}` : ''}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {t('money.invoices.received') || 'Received'}
                      </Badge>
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
            invalidateInvoice();
            queryClient.invalidateQueries({
              queryKey: [...invoiceKeys.detail(tenantId, invoice.id), 'payments'],
            });
          }}
        />
      )}
    </div>
  );
}

export default InvoiceViewScreen;
