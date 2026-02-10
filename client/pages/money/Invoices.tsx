/**
 * Invoices Page
 * List, filter, and manage invoices
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { useAllInvoices, useInvoiceSettings } from '@/hooks/useInvoices';
import { useQueryClient } from '@tanstack/react-query';
import { downloadInvoicePDF } from '@/components/money/InvoicePDF';
import { InvoiceStatusTimeline } from '@/components/money/InvoiceStatusTimeline';
import { RecordPaymentModal } from '@/components/money/RecordPaymentModal';
import { VoidInvoiceDialog } from '@/components/money/VoidInvoiceDialog';
import { SendReminderDialog } from '@/components/money/SendReminderDialog';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import type { Invoice, InvoiceStatus } from '@/types/money';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  Copy,
  Trash2,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Share2,
  Loader2,
  Settings,
  XCircle,
  Bell,
  Repeat,
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

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const _queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [voidInvoice, setVoidInvoice] = useState<Invoice | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);

  // Use React Query hooks instead of manual state management
  const { data: invoices = [], isLoading: loading, refetch: loadInvoices } = useAllInvoices();
  const { data: invoiceSettings = {} } = useInvoiceSettings();

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSend = async (invoice: Invoice) => {
    if (!session?.tid) return;
    try {
      await invoiceService.markAsSent(session.tid, invoice.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.markedSent') || 'Invoice marked as sent',
      });
      loadInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.sendError') || 'Failed to send invoice',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async (invoice: Invoice) => {
    try {
      // Get share URL
      const shareUrl = invoiceService.getShareUrl(invoice);

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);

      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.linkCopied') || 'Invoice link copied to clipboard',
      });
    } catch (error) {
      console.error('Error sharing invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.shareError') || 'Failed to share invoice',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    // Navigate to create with prefilled data
    navigate(`/money/invoices/new?duplicate=${invoice.id}`);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!session?.tid) return;
    if (
      !confirm(
        t('money.invoices.confirmDelete') || `Delete invoice ${invoice.invoiceNumber}?`
      )
    ) {
      return;
    }

    try {
      await invoiceService.deleteInvoice(session.tid, invoice.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.deleted') || 'Invoice deleted',
      });
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.deleteError') || 'Failed to delete invoice',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);
      await downloadInvoicePDF(invoice, invoiceSettings);
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
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Invoices - OniT" description="Manage your invoices" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.invoices.title') || 'Invoices'}</h1>
              <p className="text-muted-foreground">
                {t('money.invoices.subtitle') || 'Create and manage invoices'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/money/invoices/recurring')}
              title={t('money.recurring.title') || 'Recurring Invoices'}
            >
              <Repeat className="h-4 w-4 mr-2" />
              Recurring
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/money/invoices/settings')}
              title={t('money.settings.title') || 'Invoice Settings'}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => navigate('/money/invoices/new')}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('money.invoices.new') || 'New Invoice'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.invoices.searchPlaceholder') || 'Search invoices...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('money.invoices.status') || 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all') || 'All'}</SelectItem>
                <SelectItem value="draft">{t('money.status.draft') || 'Draft'}</SelectItem>
                <SelectItem value="sent">{t('money.status.sent') || 'Sent'}</SelectItem>
                <SelectItem value="viewed">{t('money.status.viewed') || 'Viewed'}</SelectItem>
                <SelectItem value="partial">{t('money.status.partial') || 'Partial'}</SelectItem>
                <SelectItem value="paid">{t('money.status.paid') || 'Paid'}</SelectItem>
                <SelectItem value="overdue">{t('money.status.overdue') || 'Overdue'}</SelectItem>
                <SelectItem value="cancelled">{t('money.status.cancelled') || 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
            <InfoTooltip
              title="Invoice Statuses"
              maxWidth={320}
              content={
                <div className="space-y-1.5">
                  <p><strong>Draft:</strong> {MoneyTooltips.invoiceStatus.draft}</p>
                  <p><strong>Sent:</strong> {MoneyTooltips.invoiceStatus.sent}</p>
                  <p><strong>Viewed:</strong> {MoneyTooltips.invoiceStatus.viewed}</p>
                  <p><strong>Partial:</strong> {MoneyTooltips.invoiceStatus.partial}</p>
                  <p><strong>Paid:</strong> {MoneyTooltips.invoiceStatus.paid}</p>
                  <p><strong>Overdue:</strong> {MoneyTooltips.invoiceStatus.overdue}</p>
                  <p><strong>Cancelled:</strong> {MoneyTooltips.invoiceStatus.cancelled}</p>
                </div>
              }
            />
          </div>
        </div>

        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('money.invoices.noResults') || 'No invoices found'
                  : t('money.invoices.empty') || 'No invoices yet'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => navigate('/money/invoices/new')} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.invoices.createFirst') || 'Create your first invoice'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <Card
                key={invoice.id}
                className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors cursor-pointer"
                onClick={() => navigate(`/money/invoices/${invoice.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {invoice.invoiceNumber}
                          </span>
                          <Badge className={STATUS_STYLES[invoice.status]}>
                            {t(`money.status.${invoice.status}`) || invoice.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
                        <InvoiceStatusTimeline invoice={invoice} compact className="mt-1" />
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                        {invoice.balanceDue > 0 && invoice.balanceDue !== invoice.total && (
                          <p className="text-xs text-muted-foreground">
                            {t('money.invoices.due') || 'Due'}: {formatCurrency(invoice.balanceDue)}
                          </p>
                        )}
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/invoices/${invoice.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('common.view') || 'View'}
                          </DropdownMenuItem>
                          {invoice.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/invoices/${invoice.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {invoice.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleSend(invoice)}>
                              <Send className="h-4 w-4 mr-2" />
                              {t('money.invoices.markSent') || 'Mark as Sent'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleShare(invoice)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            {t('money.invoices.share') || 'Share Link'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(invoice)}
                            disabled={downloadingId === invoice.id}
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {t('money.invoices.downloadPdf') || 'Download PDF'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(invoice)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('money.invoices.duplicate') || 'Duplicate'}
                          </DropdownMenuItem>
                          {['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status) && (
                            <DropdownMenuItem
                              onClick={() => setPaymentInvoice(invoice)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              {t('money.invoices.recordPayment') || 'Record Payment'}
                            </DropdownMenuItem>
                          )}
                          {['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status) && (
                            <DropdownMenuItem
                              onClick={() => setReminderInvoice(invoice)}
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              {t('money.invoices.sendReminder') || 'Send Reminder'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {invoice.status === 'draft' ? (
                            <DropdownMenuItem
                              onClick={() => handleDelete(invoice)}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete') || 'Delete'}
                            </DropdownMenuItem>
                          ) : invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                            <DropdownMenuItem
                              onClick={() => setVoidInvoice(invoice)}
                              className="text-red-500"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {t('money.invoices.void') || 'Void Invoice'}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Invoice count */}
        {filteredInvoices.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.invoices.showing') || 'Showing'} {filteredInvoices.length}{' '}
            {filteredInvoices.length === 1
              ? t('money.invoices.invoice') || 'invoice'
              : t('money.invoices.invoices') || 'invoices'}
          </p>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <RecordPaymentModal
          invoice={paymentInvoice}
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onPaymentRecorded={() => {
            setPaymentInvoice(null);
            loadInvoices();
          }}
        />
      )}

      {/* Void Invoice Dialog */}
      {voidInvoice && (
        <VoidInvoiceDialog
          invoice={voidInvoice}
          open={!!voidInvoice}
          onClose={() => setVoidInvoice(null)}
          onVoided={() => {
            setVoidInvoice(null);
            loadInvoices();
          }}
        />
      )}

      {/* Send Reminder Dialog */}
      {reminderInvoice && (
        <SendReminderDialog
          invoice={reminderInvoice}
          open={!!reminderInvoice}
          onClose={() => setReminderInvoice(null)}
          onReminderSent={() => {
            setReminderInvoice(null);
            loadInvoices();
          }}
        />
      )}
    </div>
  );
}
