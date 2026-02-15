/**
 * Cashflow Report
 * Shows cash inflows and outflows over a period
 */

import { useState, useEffect } from 'react';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Banknote,
} from 'lucide-react';

interface CashflowData {
  // Inflows
  customerPayments: number;
  totalInflows: number;
  // Outflows
  vendorPayments: number;
  expenses: number;
  totalOutflows: number;
  // Net
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
}

export default function Cashflow() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('this_month');
  const [data, setData] = useState<CashflowData>({
    customerPayments: 0,
    totalInflows: 0,
    vendorPayments: 0,
    expenses: 0,
    totalOutflows: 0,
    netCashflow: 0,
    openingBalance: 0,
    closingBalance: 0,
  });

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [period, session?.tid]);

  const getDateRange = (periodValue: string): { start: Date; end: Date } => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodValue) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      }
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { start, end };
  };

  const loadData = async () => {
    if (!session?.tid) return;
    try {
      setLoading(true);
      const { start, end } = getDateRange(period);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const [invoices, bills, expenses] = await Promise.all([
        invoiceService.getAllInvoices(session.tid),
        billService.getAllBills(session.tid),
        expenseService.getExpensesByDateRange(session.tid, startStr, endStr),
      ]);

      // Calculate customer payments (cash inflows from paid invoices in period)
      const customerPayments = invoices
        .filter(inv => {
          if (inv.status !== 'paid' || !inv.paidAt) return false;
          const paidDate = new Date(inv.paidAt);
          return paidDate >= start && paidDate <= end;
        })
        .reduce((sum, inv) => sum + inv.total, 0);

      // Calculate vendor payments (cash outflows from paid bills in period)
      const vendorPayments = bills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + bill.amount, 0);

      // Calculate expenses in period
      const expenseTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      const totalInflows = customerPayments;
      const totalOutflows = vendorPayments + expenseTotal;
      const netCashflow = totalInflows - totalOutflows;

      // For simplicity, opening balance is 0 (would need historical data)
      const openingBalance = 0;
      const closingBalance = openingBalance + netCashflow;

      setData({
        customerPayments,
        totalInflows,
        vendorPayments,
        expenses: expenseTotal,
        totalOutflows,
        netCashflow,
        openingBalance,
        closingBalance,
      });
    } catch (error) {
      console.error('Error loading cashflow:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.cashflow.loadError') || 'Failed to load report',
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

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(period);
    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Cashflow - Meza" description="View your cash flow statement" />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.cashflow.title') || 'Cash Flow'}</h1>
              <p className="text-muted-foreground">
                {t('money.cashflow.subtitle') || 'Track money in and out'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">{t('money.cashflow.thisMonth') || 'This Month'}</SelectItem>
                <SelectItem value="last_month">{t('money.cashflow.lastMonth') || 'Last Month'}</SelectItem>
                <SelectItem value="this_quarter">{t('money.cashflow.thisQuarter') || 'This Quarter'}</SelectItem>
                <SelectItem value="this_year">{t('money.cashflow.thisYear') || 'This Year'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.cashflow.inflows') || 'Cash In'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalInflows)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <ArrowDownLeft className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.cashflow.outflows') || 'Cash Out'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalOutflows)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <ArrowUpRight className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.cashflow.netCashflow') || 'Net Cash Flow'}
                  </p>
                  <p className={`text-2xl font-bold ${data.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.netCashflow)}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  data.netCashflow >= 0
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
                }`}>
                  {data.netCashflow >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Statement */}
        <Card>
          <CardHeader>
            <CardTitle>{t('money.cashflow.statement') || 'Cash Flow Statement'}</CardTitle>
            <CardDescription>{getPeriodLabel()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cash Inflows */}
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600 flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                {t('money.cashflow.inflows') || 'Cash Inflows'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.cashflow.customerPayments') || 'Customer Payments'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.customerPayments)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.cashflow.totalInflows') || 'Total Inflows'}</span>
                <span className="text-green-600">{formatCurrency(data.totalInflows)}</span>
              </div>
            </div>

            <Separator />

            {/* Cash Outflows */}
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                {t('money.cashflow.outflows') || 'Cash Outflows'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.cashflow.vendorPayments') || 'Vendor Payments'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.vendorPayments)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.cashflow.operatingExpenses') || 'Operating Expenses'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.expenses)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.cashflow.totalOutflows') || 'Total Outflows'}</span>
                <span className="text-red-600">{formatCurrency(data.totalOutflows)}</span>
              </div>
            </div>

            <Separator />

            {/* Net Cash Flow */}
            <div className="flex justify-between py-3 text-lg font-bold bg-muted rounded-lg px-4">
              <span>{t('money.cashflow.netCashflow') || 'Net Cash Flow'}</span>
              <span className={data.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(data.netCashflow)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
