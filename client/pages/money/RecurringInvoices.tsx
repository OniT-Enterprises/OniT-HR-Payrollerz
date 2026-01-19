/**
 * Recurring Invoices Page
 * List and manage recurring invoice templates
 */

import { useState, useEffect } from 'react';
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
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { recurringInvoiceService } from '@/services/recurringInvoiceService';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
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

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function RecurringInvoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecurringInvoice[]>([]);

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [session?.tid]);

  const loadData = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);
      const data = await recurringInvoiceService.getAll(session.tid);
      setItems(data);
    } catch (error) {
      console.error('Error loading recurring invoices:', error);
      toast({
        title: t('common.error') || 'Error',
        description: 'Failed to load recurring invoices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (item: RecurringInvoice) => {
    if (!session?.tid) return;

    try {
      await recurringInvoiceService.pause(session.tid, item.id);
      toast({
        title: 'Paused',
        description: `Recurring invoice for ${item.customerName} paused`,
      });
      loadData();
    } catch (error) {
      console.error('Error pausing recurring invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to pause recurring invoice',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async (item: RecurringInvoice) => {
    if (!session?.tid) return;

    try {
      await recurringInvoiceService.resume(session.tid, item.id);
      toast({
        title: 'Resumed',
        description: `Recurring invoice for ${item.customerName} resumed`,
      });
      loadData();
    } catch (error) {
      console.error('Error resuming recurring invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to resume recurring invoice',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateNow = async (item: RecurringInvoice) => {
    if (!session?.tid) return;

    try {
      const invoiceId = await recurringInvoiceService.generateInvoice(session.tid, item.id);
      toast({
        title: 'Invoice generated',
        description: `New invoice created for ${item.customerName}`,
      });
      navigate(`/money/invoices/${invoiceId}`);
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate invoice',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (item: RecurringInvoice) => {
    if (!session?.tid) return;

    if (!confirm(`Delete recurring invoice for ${item.customerName}? This cannot be undone.`)) {
      return;
    }

    try {
      await recurringInvoiceService.delete(session.tid, item.id);
      toast({
        title: 'Deleted',
        description: 'Recurring invoice deleted',
      });
      loadData();
    } catch (error) {
      console.error('Error deleting recurring invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete recurring invoice',
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
      <SEO title="Recurring Invoices - OniT" description="Manage recurring invoice templates" />
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
                  title="Recurring Invoices"
                  content="Templates that automatically generate new invoices on a schedule. Great for subscription services, retainers, or regular billing cycles."
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
                            {item.status}
                          </Badge>
                          <Badge variant="outline">
                            {FREQUENCY_LABELS[item.frequency]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next: {formatDate(item.nextRunDate)}
                            <InfoTooltip content={MoneyTooltips.recurring.nextRunDate} size="sm" />
                          </span>
                          <span>
                            {item.generatedCount} generated
                          </span>
                          {item.endAfterOccurrences && (
                            <span>
                              ({item.endAfterOccurrences - item.generatedCount} remaining)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="font-semibold">{formatCurrency(calculateTotal(item))}</p>
                        <p className="text-xs text-muted-foreground">per invoice</p>
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
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/money/invoices/recurring/${item.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {item.status === 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => handleGenerateNow(item)}>
                                <Zap className="h-4 w-4 mr-2" />
                                Generate Now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePause(item)}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            </>
                          )}
                          {item.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleResume(item)}>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
              {items.length} recurring invoice{items.length !== 1 ? 's' : ''}
            </span>
            <span>
              {items.filter((i) => i.status === 'active').length} active
            </span>
            <span>
              {items.filter((i) => i.status === 'paused').length} paused
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
