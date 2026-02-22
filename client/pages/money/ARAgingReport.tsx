/**
 * A/R Aging Report
 * Shows outstanding invoices grouped by age (current, 30, 60, 90+ days)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
import type { Invoice } from '@/types/money';
import {
  Clock,
  AlertTriangle,
  Users,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface AgingBucket {
  label: string;
  days: string;
  invoices: Invoice[];
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  total: number;
}

export default function ARAgingReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<AgingBucket[]>([]);
  const [customerAging, setCustomerAging] = useState<CustomerAging[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const invoices = await invoiceService.getAllInvoices(tenantId);

      // Filter to only unpaid invoices
      const unpaidInvoices = invoices.filter(
        inv => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft'
      );

      const now = new Date();

      // Calculate days overdue for each invoice
      const invoicesWithAge = unpaidInvoices.map(inv => {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...inv, daysOverdue };
      });

      // Group into aging buckets
      const current = invoicesWithAge.filter(inv => inv.daysOverdue <= 0);
      const days1to30 = invoicesWithAge.filter(inv => inv.daysOverdue > 0 && inv.daysOverdue <= 30);
      const days31to60 = invoicesWithAge.filter(inv => inv.daysOverdue > 30 && inv.daysOverdue <= 60);
      const days61to90 = invoicesWithAge.filter(inv => inv.daysOverdue > 60 && inv.daysOverdue <= 90);
      const days90Plus = invoicesWithAge.filter(inv => inv.daysOverdue > 90);

      const calcTotal = (invs: Invoice[]) => invs.reduce((sum, inv) => sum + (inv.total - (inv.amountPaid || 0)), 0);

      setBuckets([
        { label: t('money.arAging.current') || 'Current', days: '0 days', invoices: current, total: calcTotal(current) },
        { label: t('money.arAging.days1to30') || '1-30 Days', days: '1-30', invoices: days1to30, total: calcTotal(days1to30) },
        { label: t('money.arAging.days31to60') || '31-60 Days', days: '31-60', invoices: days31to60, total: calcTotal(days31to60) },
        { label: t('money.arAging.days61to90') || '61-90 Days', days: '61-90', invoices: days61to90, total: calcTotal(days61to90) },
        { label: t('money.arAging.days90Plus') || '90+ Days', days: '90+', invoices: days90Plus, total: calcTotal(days90Plus) },
      ]);

      // Group by customer
      const customerMap = new Map<string, CustomerAging>();

      invoicesWithAge.forEach(inv => {
        const balance = inv.total - (inv.amountPaid || 0);
        if (!customerMap.has(inv.customerId)) {
          customerMap.set(inv.customerId, {
            customerId: inv.customerId,
            customerName: inv.customerName,
            current: 0,
            days30: 0,
            days60: 0,
            days90Plus: 0,
            total: 0,
          });
        }

        const customer = customerMap.get(inv.customerId)!;
        customer.total += balance;

        if (inv.daysOverdue <= 0) {
          customer.current += balance;
        } else if (inv.daysOverdue <= 30) {
          customer.days30 += balance;
        } else if (inv.daysOverdue <= 60) {
          customer.days60 += balance;
        } else {
          customer.days90Plus += balance;
        }
      });

      const sortedCustomers = Array.from(customerMap.values()).sort((a, b) => b.total - a.total);
      setCustomerAging(sortedCustomers);
      setTotalOutstanding(calcTotal(unpaidInvoices));
    } catch (error) {
      console.error('Error loading A/R aging:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.arAging.loadError') || 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="A/R Aging - Meza" description="Accounts receivable aging report" />
      <MainNavigation />

      <div className="p-6 max-w-6xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.arAging.title') || 'A/R Aging Report'}
                <InfoTooltip
                  title={t('money.arAging.tooltipTitle') || 'Accounts Receivable Aging'}
                  content={MoneyTooltips.terms.arAging}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.arAging.subtitle') || 'Outstanding invoices by age'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{t('money.arAging.totalOutstanding') || 'Total Outstanding'}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>

        {/* Aging Buckets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {buckets.map((bucket, index) => (
            <Card key={bucket.label} className={index >= 3 ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
                <p className={`text-xl font-bold ${index >= 3 ? 'text-red-600' : ''}`}>
                  {formatCurrency(bucket.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bucket.invoices.length} {bucket.invoices.length === 1
                    ? (t('money.arAging.invoice') || 'invoice')
                    : (t('money.arAging.invoices') || 'invoices')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Customer Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('money.arAging.byCustomer') || 'Aging by Customer'}
            </CardTitle>
            <CardDescription>
              {t('money.arAging.byCustomerDesc') || 'Outstanding balances grouped by customer'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customerAging.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {t('money.arAging.noOutstanding') || 'No outstanding invoices'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm">
                      <th className="text-left py-3 font-medium">{t('money.arAging.customer') || 'Customer'}</th>
                      <th className="text-right py-3 font-medium">{t('money.arAging.current') || 'Current'}</th>
                      <th className="text-right py-3 font-medium">1-30</th>
                      <th className="text-right py-3 font-medium">31-60</th>
                      <th className="text-right py-3 font-medium">90+</th>
                      <th className="text-right py-3 font-medium">{t('money.arAging.total') || 'Total'}</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerAging.map((customer) => (
                      <tr key={customer.customerId} className="border-b hover:bg-muted/50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {customer.days90Plus > 0 && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{customer.customerName}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(customer.current)}</td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(customer.days30)}</td>
                        <td className="text-right py-3 tabular-nums">{formatCurrency(customer.days60)}</td>
                        <td className="text-right py-3 text-red-600 tabular-nums">{formatCurrency(customer.days90Plus)}</td>
                        <td className="text-right py-3 font-semibold tabular-nums">{formatCurrency(customer.total)}</td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/money/customers`)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-semibold">
                      <td className="py-3">{t('money.arAging.total') || 'Total'}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[0]?.total || 0)}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[1]?.total || 0)}</td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(buckets[2]?.total || 0)}</td>
                      <td className="text-right py-3 text-red-600 tabular-nums">
                        {formatCurrency((buckets[3]?.total || 0) + (buckets[4]?.total || 0))}
                      </td>
                      <td className="text-right py-3 tabular-nums">{formatCurrency(totalOutstanding)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
