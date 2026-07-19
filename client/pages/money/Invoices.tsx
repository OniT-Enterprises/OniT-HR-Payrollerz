/**
 * Invoices Page
 * List, filter, and manage invoices
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
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
import { useTenant, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { invoiceKeys, useSmartInvoices, useInvoiceSettings } from '@/hooks/useInvoices';
import { useDebounce } from '@/hooks/useDebounce';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollTrigger';
import MoreDetailsSection from '@/components/MoreDetailsSection';


import { RecordPaymentModal } from '@/components/money/RecordPaymentModal';
import { VoidInvoiceDialog } from '@/components/money/VoidInvoiceDialog';
import { SendReminderDialog } from '@/components/money/SendReminderDialog';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { formatDateTL, getTodayTL } from '@/lib/dateUtils';
import { getEffectiveInvoiceStatus } from '@/lib/invoiceStatus';
import { buildInvoiceWhatsAppUrl } from '@/lib/publicInvoice';
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
  Download,
  Share2,
  Loader2,
  MessageCircle,
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

const INVOICE_STATUS_FILTERS = new Set<InvoiceStatus>([
  'draft',
  'sent',
  'viewed',
  'paid',
  'partial',
  'overdue',
  'cancelled',
]);
const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [
  'sent',
  'viewed',
  'partial',
  'overdue',
];

const isInvoiceStatusFilter = (value: string | null): value is InvoiceStatus =>
  value !== null && INVOICE_STATUS_FILTERS.has(value as InvoiceStatus);

export default function Invoices() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const { canManage } = useTenant();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const canManageTenant = canManage();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const isSearching = debouncedSearchTerm.length > 0;
  const statusParam = searchParams.get('status');
  const statusFilter: InvoiceStatus | 'all' = isInvoiceStatusFilter(statusParam)
    ? statusParam
    : 'all';
  const todayIso = getTodayTL();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [voidInvoice, setVoidInvoice] = useState<Invoice | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
  const invoiceFilters =
    statusFilter === 'all'
      ? {}
      : statusFilter === 'overdue'
        ? {
            status: OUTSTANDING_INVOICE_STATUSES,
            dueBefore: todayIso,
          }
        : { status: statusFilter };

  // Preload PDF module so download resolves instantly from cache
  const preloaded = useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    import('@/components/money/InvoicePDF');
  }, []);

  const { invoices, totalLoaded, isLoading: loading, error: queryError, refetch: loadInvoices, fetchNextPage, hasNextPage, isFetchingNextPage } = useSmartInvoices(
    isSearching,
    invoiceFilters,
  );
  const {
    data: loadedInvoiceSettings,
    isLoading: invoiceSettingsLoading,
    isError: invoiceSettingsError,
    refetch: retryInvoiceSettings,
  } = useInvoiceSettings();
  const invoiceSettings = loadedInvoiceSettings ?? {};
  const invoiceSettingsUnavailable =
    invoiceSettingsError && loadedInvoiceSettings === undefined;

  const getDisplayStatus = (invoice: Invoice): InvoiceStatus =>
    getEffectiveInvoiceStatus(invoice, todayIso);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || getDisplayStatus(invoice) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusFilterChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (isInvoiceStatusFilter(value)) {
      nextParams.set('status', value);
    } else {
      nextParams.delete('status');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return formatDateTL(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleSend = async (invoice: Invoice) => {
    if (!tenantId || !canManageTenant) return;
    try {
      await invoiceService.markAsSent(tenantId, invoice.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.markedSent') || 'Invoice marked as sent',
      });
      loadInvoices();
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.sendError') || 'Failed to send invoice',
        variant: 'destructive',
      });
    }
  };

  // Publishes (or refreshes) the hosted page and returns its public URL
  const ensureShareUrl = async (invoice: Invoice): Promise<string | null> => {
    try {
      const { url } = await invoiceService.ensureShareLink(tenantId, invoice, invoiceSettings);
      return url;
    } catch (error) {
      console.error('Error creating invoice link:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.invoices.shareError') || 'Failed to share invoice',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleShare = async (invoice: Invoice) => {
    const shareUrl = await ensureShareUrl(invoice);
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.linkCopied') || 'Invoice link copied to clipboard',
      });
    } catch (error) {
      console.error('Error sharing invoice:', error);
    }
  };

  const handleWhatsApp = async (invoice: Invoice) => {
    const shareUrl = await ensureShareUrl(invoice);
    if (!shareUrl) return;
    window.open(
      buildInvoiceWhatsAppUrl(invoice, shareUrl, invoiceSettings.companyName),
      '_blank',
      'noopener',
    );
  };

  const handleDuplicate = async (invoice: Invoice) => {
    if (!canManageTenant) return;
    // Navigate to create with prefilled data
    navigate(`/money/invoices/new?duplicate=${invoice.id}`);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!tenantId || !canManageTenant || invoice.status !== 'draft') return;
    if (
      !confirm(
        t('money.invoices.confirmDelete') || `Delete invoice ${invoice.invoiceNumber}?`
      )
    ) {
      return;
    }

    try {
      await invoiceService.deleteInvoice(tenantId, invoice.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.invoices.deleted') || 'Invoice deleted',
      });
      loadInvoices();
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
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
    if (invoiceSettingsLoading || invoiceSettingsUnavailable) return;
    try {
      setDownloadingId(invoice.id);
      const { downloadInvoicePDF } = await import('@/components/money/InvoicePDF');
      const displayStatus = getDisplayStatus(invoice);
      const displayInvoice =
        displayStatus === invoice.status ? invoice : { ...invoice, status: displayStatus };
      await downloadInvoicePDF(displayInvoice, invoiceSettings);
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
        <div className="p-6 mx-auto max-w-screen-2xl">
          <div className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-md sm:h-10 sm:w-10" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <Skeleton className="mt-3 h-0.5 w-full rounded-full" />
          </div>

          <Skeleton className="h-10 w-full max-w-md mb-4" />
          <div className="mb-6">
            <Skeleton className="mb-3 h-11 w-full rounded-lg" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <Skeleton className="hidden h-10 w-10 shrink-0 rounded-full sm:block" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="mt-2 h-4 w-32" />
                        <Skeleton className="mt-1 h-4 w-20 sm:hidden" />
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden text-right sm:block">
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="hidden text-right md:block">
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-8 w-8 sm:w-28" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Invoices - Xefe" description="Manage your invoices" />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t('money.invoices.title') || 'Invoices'}
          subtitle={t('money.invoices.subtitle') || 'Create and manage invoices'}
          icon={FileText}
          iconColor="text-indigo-500"
          actions={
            <>
              {canManageTenant && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                      {t('common.moreActions') || 'More'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/money/invoices/recurring')}>
                      <Repeat className="h-4 w-4 mr-2" />
                      {t('money.recurring.title') || 'Recurring Invoices'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/money/invoices/settings')}>
                      <Settings className="h-4 w-4 mr-2" />
                      {t('money.settings.title') || 'Invoice Settings'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canManageTenant && (
                <Button
                  onClick={() => navigate('/money/invoices/new')}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.invoices.new') || 'New Invoice'}
                </Button>
              )}
            </>
          }
        />

        {/* Filters */}
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('money.invoices.searchPlaceholder') || 'Search invoices...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <MoreDetailsSection className="mb-6" title={t('money.invoices.status') || 'Status'}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
              title={t('money.invoices.invoiceStatuses') || 'Invoice Statuses'}
              maxWidth={320}
              content={
                <div className="space-y-1.5">
                  <p><strong>{t('money.status.draft') || 'Draft'}:</strong> {MoneyTooltips.invoiceStatus.draft}</p>
                  <p><strong>{t('money.status.sent') || 'Sent'}:</strong> {MoneyTooltips.invoiceStatus.sent}</p>
                  <p><strong>{t('money.status.viewed') || 'Viewed'}:</strong> {MoneyTooltips.invoiceStatus.viewed}</p>
                  <p><strong>{t('money.status.partial') || 'Partial'}:</strong> {MoneyTooltips.invoiceStatus.partial}</p>
                  <p><strong>{t('money.status.paid') || 'Paid'}:</strong> {MoneyTooltips.invoiceStatus.paid}</p>
                  <p><strong>{t('money.status.overdue') || 'Overdue'}:</strong> {MoneyTooltips.invoiceStatus.overdue}</p>
                  <p><strong>{t('money.status.cancelled') || 'Cancelled'}:</strong> {MoneyTooltips.invoiceStatus.cancelled}</p>
                </div>
              }
            />
          </div>
        </MoreDetailsSection>

        {queryError && !loading && invoices.length > 0 && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{t('common.connectionIssueDesc')}</span>
            <Button size="sm" variant="outline" onClick={() => loadInvoices()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {invoiceSettingsError && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{t('common.connectionIssueDesc')}</span>
            <Button size="sm" variant="outline" onClick={() => void retryInvoiceSettings()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Invoice List */}
        {queryError && !loading && invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium mb-1">{t('common.connectionIssueTitle') || 'Connection problem'}</p>
              <p className="text-muted-foreground mb-4">
                {t('common.connectionIssueDesc') || 'Your signal is weak. Keep this page open and try again when the internet stabilizes.'}
              </p>
              <Button onClick={() => loadInvoices()} variant="outline">
                {t('common.retry') || 'Retry'}
              </Button>
            </CardContent>
          </Card>
        ) : filteredInvoices.length === 0 && !hasNextPage ? (
          <Card>
            <CardContent className="py-12 text-center">
              <img src="/images/illustrations/xefe-card-money.webp" alt="No invoices yet" className="h-28 w-auto mx-auto mb-4 object-contain drop-shadow-lg" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('money.invoices.noResults') || 'No invoices found'
                  : t('money.invoices.empty') || 'No invoices yet'}
              </p>
              {canManageTenant && !searchTerm && statusFilter === 'all' && (
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <div className="hidden h-10 w-10 shrink-0 rounded-full bg-muted sm:flex sm:items-center sm:justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-mono text-sm font-medium">
                            {invoice.invoiceNumber}
                          </span>
                          <Badge className={STATUS_STYLES[getDisplayStatus(invoice)]}>
                            {t(`money.status.${getDisplayStatus(invoice)}`) || getDisplayStatus(invoice)}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{invoice.customerName}</p>
                        <p className="mt-0.5 text-sm font-semibold sm:hidden">
                          {formatCurrency(invoice.total)}
                          {invoice.balanceDue > 0 && invoice.balanceDue !== invoice.total && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {t('money.invoices.due') || 'Due'}: {formatCurrency(invoice.balanceDue)}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                          {t('money.invoices.due') || 'Due'}: {formatDate(invoice.dueDate)}
                        </p>
                        {canManageTenant && getDisplayStatus(invoice) === 'draft' && (
                          <p className="mt-1 text-xs font-medium text-primary sm:hidden">
                            {t('money.invoices.markSent') || 'Mark as sent'}
                          </p>
                        )}
                        {canManageTenant && getDisplayStatus(invoice) === 'overdue' && (
                          <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400 sm:hidden">
                            {t('money.invoices.sendReminder') || 'Send reminder'}
                          </p>
                        )}
                        {canManageTenant && ['sent', 'viewed', 'partial'].includes(getDisplayStatus(invoice)) && (
                          <p className="mt-1 text-xs font-medium text-primary sm:hidden">
                            {t('money.invoices.recordPayment') || 'Record payment'}
                          </p>
                        )}
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                            aria-label={t('common.moreActions') || 'More actions'}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">{t('common.moreActions') || 'More actions'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/invoices/${invoice.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('common.view') || 'View'}
                          </DropdownMenuItem>
                          {canManageTenant && invoice.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/invoices/${invoice.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && invoice.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleSend(invoice)}>
                              <Send className="h-4 w-4 mr-2" />
                              {t('money.invoices.markSent') || 'Mark as Sent'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && invoice.status !== 'draft' && (
                            <DropdownMenuItem onClick={() => handleShare(invoice)}>
                              <Share2 className="h-4 w-4 mr-2" />
                              {t('money.invoices.share') || 'Share Link'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && invoice.status !== 'draft' && (
                            <DropdownMenuItem onClick={() => handleWhatsApp(invoice)}>
                              <MessageCircle className="h-4 w-4 mr-2" />
                              {t('money.invoices.shareWhatsApp') || 'Send by WhatsApp'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(invoice)}
                            disabled={
                              downloadingId === invoice.id ||
                              invoiceSettingsLoading ||
                              invoiceSettingsUnavailable
                            }
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {t('money.invoices.downloadPdf') || 'Download PDF'}
                          </DropdownMenuItem>
                          {canManageTenant && (
                            <DropdownMenuItem onClick={() => handleDuplicate(invoice)}>
                              <Copy className="h-4 w-4 mr-2" />
                              {t('money.invoices.duplicate') || 'Duplicate'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && ['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status) && (
                            <DropdownMenuItem
                              onClick={() => setPaymentInvoice(invoice)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              {t('money.invoices.recordPayment') || 'Record Payment'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && ['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status) && (
                            <DropdownMenuItem
                              onClick={() => setReminderInvoice(invoice)}
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              {t('money.invoices.sendReminder') || 'Send Reminder'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant &&
                            invoice.status !== 'cancelled' &&
                            invoice.status !== 'paid' && (
                              <>
                                <DropdownMenuSeparator />
                                {invoice.status === 'draft' ? (
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(invoice)}
                                    className="text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('common.delete') || 'Delete'}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => setVoidInvoice(invoice)}
                                    className="text-red-500"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    {t('money.invoices.void') || 'Void Invoice'}
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Infinite scroll trigger */}
            <InfiniteScrollTrigger
              onLoadMore={() => fetchNextPage()}
              hasMore={hasNextPage ?? false}
              isLoading={isFetchingNextPage}
            />
          </div>
        )}

        {/* Invoice count */}
        {filteredInvoices.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.invoices.showing') || 'Showing'} {filteredInvoices.length}{' '}
            {filteredInvoices.length === 1
              ? t('money.invoices.invoice') || 'invoice'
              : t('money.invoices.invoices') || 'invoices'}
            {totalLoaded > filteredInvoices.length && (
              <span>
                {' '}({t('money.invoices.of') || 'of'} {totalLoaded} {t('money.invoices.loaded') || 'loaded'})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Record Payment Modal */}
      {canManageTenant && paymentInvoice && (
        <RecordPaymentModal
          invoice={paymentInvoice}
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onPaymentRecorded={() => {
            setPaymentInvoice(null);
            loadInvoices();
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
          }}
        />
      )}

      {/* Void Invoice Dialog */}
      {canManageTenant && voidInvoice && (
        <VoidInvoiceDialog
          invoice={voidInvoice}
          open={!!voidInvoice}
          onClose={() => setVoidInvoice(null)}
          onVoided={() => {
            setVoidInvoice(null);
            loadInvoices();
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
          }}
        />
      )}

      {/* Send Reminder Dialog */}
      {canManageTenant && reminderInvoice && (
        <SendReminderDialog
          invoice={reminderInvoice}
          open={!!reminderInvoice}
          onClose={() => setReminderInvoice(null)}
          onReminderSent={() => {
            setReminderInvoice(null);
            loadInvoices();
            queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
          }}
        />
      )}
    </div>
  );
}
