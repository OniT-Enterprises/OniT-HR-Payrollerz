/**
 * Bills Page
 * List, filter, and manage bills (accounts payable)
 */

import { useRef, useState, type DragEvent } from 'react';
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
import { billService } from '@/services/billService';
import { useSmartBills, billKeys } from '@/hooks/useBills';
import { useDebounce } from '@/hooks/useDebounce';
import { InfiniteScrollTrigger } from '@/components/ui/InfiniteScrollTrigger';
import MoreDetailsSection from '@/components/MoreDetailsSection';
import QuickBillDialog from '@/components/money/QuickBillDialog';
import { partitionBillFiles, BILL_FILE_ACCEPT } from '@/lib/billFiles';

import { formatDateTL, getTodayTL } from '@/lib/dateUtils';
import type { Bill, BillStatus } from '@/types/money';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Upload,
} from 'lucide-react';

const STATUS_STYLES: Record<BillStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const BILL_STATUS_FILTERS = new Set<BillStatus>([
  'pending',
  'paid',
  'partial',
  'overdue',
  'cancelled',
]);
const UNPAID_BILL_STATUSES: BillStatus[] = [
  'pending',
  'partial',
  'overdue',
];

const isBillStatusFilter = (value: string | null): value is BillStatus =>
  value !== null && BILL_STATUS_FILTERS.has(value as BillStatus);

export default function Bills() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session, canManage } = useTenant();
  const tenantId = useTenantId();
  const canManageTenant = canManage();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const isSearching = debouncedSearchTerm.length > 0;
  const statusParam = searchParams.get('status');
  const statusFilter: BillStatus | 'all' = isBillStatusFilter(statusParam)
    ? statusParam
    : 'all';
  const todayIso = getTodayTL();
  const billFilters =
    statusFilter === 'all'
      ? {}
      : statusFilter === 'overdue'
        ? { status: UNPAID_BILL_STATUSES, dueBefore: todayIso }
        : { status: statusFilter };

  // Quick-add bill from dropped/picked files
  const [quickFiles, setQuickFiles] = useState<File[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleIncomingFiles = (incoming: File[]) => {
    if (!canManageTenant || incoming.length === 0) return;
    const { valid, errors } = partitionBillFiles(incoming);
    if (errors.length > 0) {
      toast({
        title: t('money.bills.invalidFiles') || 'Some files were skipped',
        description: errors.join('\n'),
        variant: 'destructive',
      });
    }
    if (valid.length > 0) {
      setQuickFiles(valid);
      setQuickAddOpen(true);
    }
  };

  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  const handlePageDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handlePageDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };

  const handlePageDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  };

  const handlePageDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    handleIncomingFiles(Array.from(e.dataTransfer.files));
  };

  const { bills, totalLoaded, isLoading: loading, error: queryError, refetch: loadBills, fetchNextPage, hasNextPage, isFetchingNextPage } = useSmartBills(
    isSearching,
    billFilters,
  );

  const getDisplayStatus = (bill: Bill): BillStatus =>
    bill.balanceDue > 0 &&
    bill.dueDate < todayIso &&
    UNPAID_BILL_STATUSES.includes(bill.status)
      ? 'overdue'
      : bill.status;

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.billNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || getDisplayStatus(bill) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusFilterChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (isBillStatusFilter(value)) {
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

  const handleDelete = async (bill: Bill) => {
    if (!session?.tid || !canManageTenant || bill.status !== 'pending') return;
    if (
      !confirm(
        t('money.bills.confirmDelete') || `Delete bill from ${bill.vendorName}?`
      )
    ) {
      return;
    }

    try {
      await billService.deleteBill(session.tid, bill.id);
      toast({
        title: t('common.success') || 'Success',
        description: t('money.bills.deleted') || 'Bill deleted',
      });
      // Invalidate React Query cache to refetch
      queryClient.invalidateQueries({ queryKey: billKeys.all(tenantId) });
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.bills.deleteError') || 'Failed to delete bill',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 mx-auto max-w-screen-2xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
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
    <div
      className="min-h-screen bg-background"
      onDragEnter={canManageTenant ? handlePageDragEnter : undefined}
      onDragOver={canManageTenant ? handlePageDragOver : undefined}
      onDragLeave={canManageTenant ? handlePageDragLeave : undefined}
      onDrop={canManageTenant ? handlePageDrop : undefined}
    >
      <SEO title="Bills - Xefe" description="Manage your bills and accounts payable" />
      <MainNavigation />

      {/* Full-page drop overlay */}
      {canManageTenant && dragActive && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-indigo-500 rounded-xl px-12 py-10 text-center bg-background shadow-lg">
            <Upload className="h-10 w-10 mx-auto mb-3 text-indigo-500" />
            <p className="text-lg font-semibold">
              {t('money.bills.dropOverlayTitle') || 'Drop to add a bill'}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('money.bills.dropOverlayHint') || 'PDF or photo — a quick form will open'}
            </p>
          </div>
        </div>
      )}

      {canManageTenant && (
        <>
          <input
            ref={uploadInputRef}
            type="file"
            accept={BILL_FILE_ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => {
              handleIncomingFiles(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />

          <QuickBillDialog
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
            initialFiles={quickFiles}
          />
        </>
      )}

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t('money.bills.title') || 'Bills'}
          subtitle={t('money.bills.subtitle') || 'Manage accounts payable'}
          cardIcon="mn-bills" icon={FileText}
          iconColor="text-indigo-500"
          actions={canManageTenant ? (
            <>
              <Button variant="outline" onClick={() => uploadInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {t('money.bills.uploadBill') || 'Upload Bill'}
              </Button>
              <Button
                onClick={() => navigate('/money/bills/new')}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('money.bills.new') || 'New Bill'}
              </Button>
            </>
          ) : undefined}
        />

        {/* Filters */}
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('money.bills.searchPlaceholder') || 'Search bills...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <MoreDetailsSection className="mb-6" title={t('money.bills.status') || 'Status'}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('money.bills.status') || 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all') || 'All'}</SelectItem>
                <SelectItem value="pending">{t('money.billStatus.pending') || 'Pending'}</SelectItem>
                <SelectItem value="partial">{t('money.billStatus.partial') || 'Partial'}</SelectItem>
                <SelectItem value="paid">{t('money.billStatus.paid') || 'Paid'}</SelectItem>
                <SelectItem value="overdue">{t('money.billStatus.overdue') || 'Overdue'}</SelectItem>
                <SelectItem value="cancelled">{t('money.billStatus.cancelled') || 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </MoreDetailsSection>

        {/* Quick-add dropzone */}
        {canManageTenant && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => uploadInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                uploadInputRef.current?.click();
              }
            }}
            className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-4 py-3 border-2 border-dashed border-muted-foreground/25 rounded-lg text-sm text-muted-foreground hover:border-indigo-400 hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="text-center">
              {t('money.bills.dropStrip') ||
                'Drag & drop bill files here (PDF or photo), or click to browse'}
            </span>
            <span className="hidden md:inline text-xs text-muted-foreground/70">
              {t('money.bills.dropStripHint') || '— works with Google Drive & OneDrive folders'}
            </span>
          </div>
        )}

        {queryError && !loading && bills.length > 0 && (
          <div
            className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{t('common.connectionIssueDesc')}</span>
            <Button size="sm" variant="outline" onClick={() => loadBills()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Bill List */}
        {queryError && !loading && bills.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium mb-1">
                {t('common.connectionIssueTitle') || 'Connection problem'}
              </p>
              <p className="text-muted-foreground mb-4">
                {t('common.connectionIssueDesc') ||
                  'Your signal is weak. Keep this page open and try again when the internet stabilizes.'}
              </p>
              <Button onClick={() => loadBills()} variant="outline">
                {t('common.retry') || 'Retry'}
              </Button>
            </CardContent>
          </Card>
        ) : filteredBills.length === 0 && !hasNextPage ? (
          <Card>
            <CardContent className="py-12 text-center">
              <img src="/images/illustrations/xefe-empty.webp" alt="No bills yet" className="h-28 w-auto mx-auto mb-4 object-contain drop-shadow-lg" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('money.bills.noResults') || 'No bills found'
                  : t('money.bills.empty') || 'No bills yet'}
              </p>
              {canManageTenant && !searchTerm && statusFilter === 'all' && (
                <Button onClick={() => navigate('/money/bills/new')} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('money.bills.createFirst') || 'Add your first bill'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBills.map((bill) => (
              <Card
                key={bill.id}
                className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors cursor-pointer"
                onClick={() => navigate(`/money/bills/${bill.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <div className="hidden h-10 w-10 shrink-0 rounded-full bg-muted sm:flex sm:items-center sm:justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-medium">{bill.vendorName}</p>
                          <Badge className={STATUS_STYLES[getDisplayStatus(bill)]}>
                            {t(`money.billStatus.${getDisplayStatus(bill)}`) || getDisplayStatus(bill)}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {bill.description}
                          {bill.billNumber && ` - ${bill.billNumber}`}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold sm:hidden">
                          {formatCurrency(bill.total)}
                          {bill.balanceDue > 0 && bill.balanceDue !== bill.total && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {t('money.bills.due') || 'Due'}: {formatCurrency(bill.balanceDue)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">{formatCurrency(bill.total)}</p>
                        {bill.balanceDue > 0 && bill.balanceDue !== bill.total && (
                          <p className="text-xs text-muted-foreground">
                            {t('money.bills.due') || 'Due'}: {formatCurrency(bill.balanceDue)}
                          </p>
                        )}
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(bill.dueDate)}
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
                            onClick={() => navigate(`/money/bills/${bill.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('common.view') || 'View'}
                          </DropdownMenuItem>
                          {canManageTenant && bill.status === 'pending' && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/bills/${bill.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit') || 'Edit'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && ['pending', 'partial', 'overdue'].includes(bill.status) && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/money/bills/${bill.id}?record=payment`)}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              {t('money.bills.recordPayment') || 'Record Payment'}
                            </DropdownMenuItem>
                          )}
                          {canManageTenant && bill.status === 'pending' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(bill)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete') || 'Delete'}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <InfiniteScrollTrigger
              onLoadMore={() => fetchNextPage()}
              hasMore={hasNextPage ?? false}
              isLoading={isFetchingNextPage}
            />
          </div>
        )}

        {/* Bill count */}
        {filteredBills.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.bills.showing') || 'Showing'} {filteredBills.length}
            {filteredBills.length !== totalLoaded && ` of ${totalLoaded} loaded`}{' '}
            {filteredBills.length === 1
              ? t('money.bills.bill') || 'bill'
              : t('money.bills.bills') || 'bills'}
          </p>
        )}
      </div>
    </div>
  );
}
