/**
 * Recurring Invoices Page
 * List and manage recurring invoice templates
 */

import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import {
  useRecurringInvoices,
  usePauseRecurringInvoice,
  useResumeRecurringInvoice,
  useDeleteRecurringInvoice,
  useGenerateFromRecurring,
} from '@/hooks/useRecurringInvoices';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import { formatDateTL } from '@/lib/dateUtils';
import type { RecurringInvoice, RecurringStatus } from '@/types/money';
import {
  Repeat,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Play,
  Pause,
  Trash2,
  Zap,
  Calendar,
  Users,
} from 'lucide-react';

const STATUS_STYLES: Record<RecurringStatus, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function RecurringInvoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const { data: items = [], isLoading: loading } = useRecurringInvoices();
  const pauseMutation = usePauseRecurringInvoice();
  const resumeMutation = useResumeRecurringInvoice();
  const deleteMutation = useDeleteRecurringInvoice();
  const generateMutation = useGenerateFromRecurring();

  const getFrequencyLabel = (freq: string) => {
    return t(`money.recurring.frequency${freq.charAt(0).toUpperCase() + freq.slice(1)}`) || freq;
  };

  const handlePause = async (item: RecurringInvoice) => {
    try {
      await pauseMutation.mutateAsync(item.id);
      toast({
        title: t('money.recurring.pausedToast') || 'Paused',
        description: (t('money.recurring.pausedDesc') || 'Recurring invoice for {{name}} paused').replace('{{name}}', item.customerName),
      });
    } catch {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.recurring.pauseError') || 'Failed to pause recurring invoice',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async (item: RecurringInvoice) => {
    try {
      await resumeMutation.mutateAsync(item.id);
      toast({
        title: t('money.recurring.resumedToast') || 'Resumed',
        description: (t('money.recurring.resumedDesc') || 'Recurring invoice for {{name}} resumed').replace('{{name}}', item.customerName),
      });
    } catch {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.recurring.resumeError') || 'Failed to resume recurring invoice',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateNow = async (item: RecurringInvoice) => {
    try {
      const invoiceId = await generateMutation.mutateAsync(item.id);
      toast({
        title: t('money.recurring.invoiceGenerated') || 'Invoice generated',
        description: (t('money.recurring.invoiceGeneratedDesc') || 'New invoice created for {{name}}').replace('{{name}}', item.customerName),
      });
      navigate(`/money/invoices/${invoiceId}`);
    } catch (error) {
      toast({
        title: t('common.error') || 'Error',
        description: error instanceof Error ? error.message : (t('money.recurring.generateError') || 'Failed to generate invoice'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (item: RecurringInvoice) => {
    if (!confirm((t('money.recurring.confirmDeleteMsg') || 'Delete recurring invoice for {{name}}? This cannot be undone.').replace('{{name}}', item.customerName))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(item.id);
      toast({
        title: t('money.recurring.deletedToast') || 'Deleted',
        description: t('money.recurring.deletedDesc') || 'Recurring invoice deleted',
      });
    } catch {
      toast({
        title: t('common.error') || 'Error',
        description: t('money.recurring.deleteError') || 'Failed to delete recurring invoice',
        variant: 'destructive',
      });
    }
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

  const calculateTotal = (item: RecurringInvoice) => {
    const subtotal = item.items.reduce((sum, i) => sum + i.amount, 0);
    const tax = subtotal * (item.taxRate / 100);
    return subtotal + tax;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Recurring Invoices - Meza" description="Manage recurring invoice templates" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Repeat className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.recurring.title') || 'Recurring Invoices'}
                <InfoTooltip
                  title={t('money.recurring.tooltipTitle') || 'Recurring Invoices'}
                  content={t('money.recurring.tooltipContent') || 'Templates that automatically generate new invoices on a schedule. Great for subscription services, retainers, or regular billing cycles.'}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.recurring.subtitle') || 'Auto-generate invoices on a schedule'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/money/invoices/recurring/new')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('money.recurring.new') || 'New Recurring'}
          </Button>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Repeat className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {t('money.recurring.empty') || 'No recurring invoices set up'}
              </p>
              <Button onClick={() => navigate('/money/invoices/recurring/new')} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                {t('money.recurring.createFirst') || 'Create your first recurring invoice'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card
                key={item.id}
                className="hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Repeat className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.customerName}</span>
                          <Badge className={STATUS_STYLES[item.status]}>
                            {t(`money.recurring.${item.status}`) || item.status}
                          </Badge>
                          <Badge variant="outline">
                            {getFrequencyLabel(item.frequency)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t('money.recurring.next') || 'Next'}: {formatDate(item.nextRunDate)}
                            <InfoTooltip content={MoneyTooltips.recurring.nextRunDate} size="sm" />
                          </span>
                          <span>
                            {item.generatedCount} {t('money.recurring.generated') || 'generated'}
                          </span>
                          {item.endAfterOccurrences && (
                            <span>
                              ({item.endAfterOccurrences - item.generatedCount} {t('money.recurring.remaining') || 'remaining'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">{formatCurrency(calculateTotal(item))}</p>
                        <p className="text-xs text-muted-foreground">{t('money.recurring.perInvoice') || 'per invoice'}</p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/invoices/recurring/${item.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('money.recurring.viewDetails') || 'View Details'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/invoices/recurring/${item.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('money.recurring.edit') || 'Edit'}
                          </DropdownMenuItem>
                          {item.status === 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => handleGenerateNow(item)}>
                                <Zap className="h-4 w-4 mr-2" />
                                {t('money.recurring.generateNow') || 'Generate Now'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePause(item)}>
                                <Pause className="h-4 w-4 mr-2" />
                                {t('money.recurring.pause') || 'Pause'}
                              </DropdownMenuItem>
                            </>
                          )}
                          {item.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleResume(item)}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('money.recurring.resume') || 'Resume'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('money.recurring.delete') || 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {items.length > 0 && (
          <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {items.length} {items.length !== 1 ? (t('money.recurring.recurringInvoices') || 'recurring invoices') : (t('money.recurring.recurringInvoice') || 'recurring invoice')}
            </span>
            <span>
              {items.filter((i) => i.status === 'active').length} {t('money.recurring.active') || 'active'}
            </span>
            <span>
              {items.filter((i) => i.status === 'paused').length} {t('money.recurring.paused') || 'paused'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
