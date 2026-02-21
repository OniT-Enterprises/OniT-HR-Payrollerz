/**
 * Balance Sheet Report
 * Shows assets, liabilities, and equity at a point in time
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
import { formatDateTL } from '@/lib/dateUtils';
import {
  Scale,
  Calendar,
  Building2,
  Landmark,
  Wallet,
} from 'lucide-react';

interface BalanceSheetData {
  // Assets
  cashAndBank: number;
  accountsReceivable: number;
  totalAssets: number;
  // Liabilities
  accountsPayable: number;
  totalLiabilities: number;
  // Equity
  retainedEarnings: number;
  totalEquity: number;
}

export default function BalanceSheet() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState<string>('today');
  const [data, setData] = useState<BalanceSheetData>({
    cashAndBank: 0,
    accountsReceivable: 0,
    totalAssets: 0,
    accountsPayable: 0,
    totalLiabilities: 0,
    retainedEarnings: 0,
    totalEquity: 0,
  });

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOfDate, session?.tid]);

  const getAsOfDateValue = (): Date => {
    const now = new Date();
    switch (asOfDate) {
      case 'today':
        return now;
      case 'month_end':
        return new Date(now.getFullYear(), now.getMonth(), 0);
      case 'quarter_end': {
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 0);
      }
      case 'year_end':
        return new Date(now.getFullYear() - 1, 11, 31);
      default:
        return now;
    }
  };

  const loadData = async () => {
    if (!session?.tid) return;
    try {
      setLoading(true);

      // Get all invoices and bills to calculate balances
      const [invoices, bills] = await Promise.all([
        invoiceService.getAllInvoices(session.tid),
        billService.getAllBills(session.tid),
      ]);

      const asOf = getAsOfDateValue();

      // Calculate Accounts Receivable (unpaid invoices as of date)
      const accountsReceivable = invoices
        .filter(inv => {
          const invoiceDate = new Date(inv.issueDate);
          return invoiceDate <= asOf && inv.status !== 'paid' && inv.status !== 'cancelled';
        })
        .reduce((sum, inv) => sum + (inv.total - (inv.amountPaid || 0)), 0);

      // Calculate Accounts Payable (unpaid bills as of date)
      const accountsPayable = bills
        .filter(bill => {
          const billDate = new Date(bill.billDate);
          return billDate <= asOf && bill.status !== 'paid' && bill.status !== 'cancelled';
        })
        .reduce((sum, bill) => sum + (bill.amount - (bill.amountPaid || 0)), 0);

      // Calculate cash received (simplified - sum of paid invoices)
      const cashReceived = invoices
        .filter(inv => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) <= asOf)
        .reduce((sum, inv) => sum + inv.total, 0);

      // Calculate cash paid (simplified - sum of paid bills)
      const cashPaid = bills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + bill.amount, 0);

      const cashAndBank = cashReceived - cashPaid;
      const totalAssets = cashAndBank + accountsReceivable;
      const totalLiabilities = accountsPayable;
      const retainedEarnings = totalAssets - totalLiabilities;
      const totalEquity = retainedEarnings;

      setData({
        cashAndBank,
        accountsReceivable,
        totalAssets,
        accountsPayable,
        totalLiabilities,
        retainedEarnings,
        totalEquity,
      });
    } catch (error) {
      console.error('Error loading balance sheet:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.balanceSheet.loadError') || 'Failed to load report',
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

  const getAsOfLabel = () => {
    const date = getAsOfDateValue();
    return formatDateTL(date, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
      <SEO title="Balance Sheet - Meza" description="View your balance sheet" />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.balanceSheet.title') || 'Balance Sheet'}</h1>
              <p className="text-muted-foreground">
                {t('money.balanceSheet.subtitle') || 'Financial position snapshot'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={asOfDate} onValueChange={setAsOfDate}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t('money.balanceSheet.today') || 'Today'}</SelectItem>
                <SelectItem value="month_end">{t('money.balanceSheet.lastMonthEnd') || 'Last Month End'}</SelectItem>
                <SelectItem value="quarter_end">{t('money.balanceSheet.lastQuarterEnd') || 'Last Quarter End'}</SelectItem>
                <SelectItem value="year_end">{t('money.balanceSheet.lastYearEnd') || 'Last Year End'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Balance Sheet Statement */}
        <Card>
          <CardHeader>
            <CardTitle>{t('money.balanceSheet.statement') || 'Statement of Financial Position'}</CardTitle>
            <CardDescription>
              {t('money.balanceSheet.asOf') || 'As of'} {getAsOfLabel()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Assets Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t('money.balanceSheet.assets') || 'Assets'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.balanceSheet.cashAndBank') || 'Cash and Bank'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.cashAndBank)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.balanceSheet.accountsReceivable') || 'Accounts Receivable'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.accountsReceivable)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.balanceSheet.totalAssets') || 'Total Assets'}</span>
                <span className="text-green-600">{formatCurrency(data.totalAssets)}</span>
              </div>
            </div>

            <Separator />

            {/* Liabilities Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t('money.balanceSheet.liabilities') || 'Liabilities'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.balanceSheet.accountsPayable') || 'Accounts Payable'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.accountsPayable)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.balanceSheet.totalLiabilities') || 'Total Liabilities'}</span>
                <span className="text-red-600">{formatCurrency(data.totalLiabilities)}</span>
              </div>
            </div>

            <Separator />

            {/* Equity Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-600 flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                {t('money.balanceSheet.equity') || 'Equity'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.balanceSheet.retainedEarnings') || 'Retained Earnings'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.retainedEarnings)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.balanceSheet.totalEquity') || 'Total Equity'}</span>
                <span className="text-blue-600">{formatCurrency(data.totalEquity)}</span>
              </div>
            </div>

            <Separator />

            {/* Total Liabilities & Equity */}
            <div className="flex justify-between py-3 text-lg font-bold bg-muted rounded-lg px-4">
              <span>{t('money.balanceSheet.totalLiabilitiesEquity') || 'Total Liabilities & Equity'}</span>
              <span>{formatCurrency(data.totalLiabilities + data.totalEquity)}</span>
            </div>

            {/* Balance Check */}
            {Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) > 0.01 && (
              <p className="text-sm text-amber-600 text-center">
                {t('money.balanceSheet.outOfBalance') || 'Note: Balance sheet is out of balance'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
