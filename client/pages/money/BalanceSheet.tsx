/**
 * Balance Sheet Report
 * Shows assets, liabilities, and equity at a point in time
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
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
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import { accountService, trialBalanceService } from '@/services/accountingService';
import { addMoney, subtractMoney, sumMoney } from '@/lib/currency';

import { formatDateTL, toDateStringTL } from '@/lib/dateUtils';
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
  otherAssets: number;
  totalAssets: number;
  // Liabilities
  accountsPayable: number;
  otherLiabilities: number;
  totalLiabilities: number;
  // Equity
  equityBalance: number;
  totalEquity: number;
}

export default function BalanceSheet() {
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [asOfDate, setAsOfDate] = useState<string>('today');

  const asOf = useMemo(() => {
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
  }, [asOfDate]);
  const asOfStr = toDateStringTL(asOf);

  const { data = {
    cashAndBank: 0,
    accountsReceivable: 0,
    otherAssets: 0,
    totalAssets: 0,
    accountsPayable: 0,
    otherLiabilities: 0,
    totalLiabilities: 0,
    equityBalance: 0,
    totalEquity: 0,
  }, isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'money', 'balanceSheet', asOfStr],
    queryFn: async (): Promise<BalanceSheetData> => {
      const accounts = await accountService.getAllAccounts(tenantId);
      if (accounts.length > 0) {
        const report = await trialBalanceService.generateBalanceSheet(
          tenantId,
          asOfStr,
          Number(asOfStr.slice(0, 4)),
        );
        const accountsById = new Map(accounts.map((account) => [account.id, account]));
        const accountsByCode = new Map(accounts.map((account) => [account.code, account]));
        const rowsForSubTypes = (
          rows: typeof report.assetItems,
          subTypes: string[],
        ) => sumMoney(rows
          .filter((row) => {
            const account = accountsById.get(row.accountId) || accountsByCode.get(row.accountCode);
            return account ? subTypes.includes(account.subType) : false;
          })
          .map((row) => row.amount));

        const cashAndBank = rowsForSubTypes(report.assetItems, ['cash', 'bank']);
        const accountsReceivable = rowsForSubTypes(report.assetItems, ['accounts_receivable']);
        const accountsPayable = rowsForSubTypes(report.liabilityItems, ['accounts_payable']);

        return {
          cashAndBank,
          accountsReceivable,
          otherAssets: subtractMoney(report.totalAssets, cashAndBank, accountsReceivable),
          totalAssets: report.totalAssets,
          accountsPayable,
          otherLiabilities: subtractMoney(report.totalLiabilities, accountsPayable),
          totalLiabilities: report.totalLiabilities,
          equityBalance: report.totalEquity,
          totalEquity: report.totalEquity,
        };
      }

      const [
        accountsReceivable,
        accountsPayable,
        cashReceived,
        cashPaid,
        directExpensesPaid,
      ] = await Promise.all([
        invoiceService.getOutstandingReceivablesTotalAsOf(tenantId, asOfStr),
        billService.getOutstandingPayablesTotalAsOf(tenantId, asOfStr),
        invoiceService.getPaidInvoiceTotalAsOf(tenantId, asOfStr),
        billService.getPaidBillAmountAsOf(tenantId, asOfStr),
        expenseService.getTotalExpensesAsOf(tenantId, asOfStr),
      ]);

      const cashAndBank = subtractMoney(cashReceived, cashPaid, directExpensesPaid);
      const totalAssets = addMoney(cashAndBank, accountsReceivable);
      const totalLiabilities = accountsPayable;
      const equityBalance = subtractMoney(totalAssets, totalLiabilities);
      const totalEquity = equityBalance;

      return {
        cashAndBank,
        accountsReceivable,
        otherAssets: 0,
        totalAssets,
        accountsPayable,
        otherLiabilities: 0,
        totalLiabilities,
        equityBalance,
        totalEquity,
      };
    },
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAsOfLabel = () => {
    return formatDateTL(asOf, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-screen-2xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Balance Sheet - Xefe" description="View your balance sheet" />
      <MainNavigation />

      <div className="p-6 max-w-screen-2xl mx-auto">
        <PageHeader
          title={t('money.balanceSheet.title') || 'Balance Sheet'}
          subtitle={t('money.balanceSheet.subtitle') || 'Financial position snapshot'}
          icon={Scale}
          iconColor="text-indigo-500"
          actions={
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
          }
        />

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
                {data.otherAssets !== 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Other Assets</span>
                    <span className="font-medium">{formatCurrency(data.otherAssets)}</span>
                  </div>
                )}
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
                {data.otherLiabilities !== 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Other Liabilities</span>
                    <span className="font-medium">{formatCurrency(data.otherLiabilities)}</span>
                  </div>
                )}
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
                    Equity Balance
                  </span>
                  <span className="font-medium">{formatCurrency(data.equityBalance)}</span>
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
              <span>{formatCurrency(addMoney(data.totalLiabilities, data.totalEquity))}</span>
            </div>

            {/* Balance Check */}
            {Math.abs(subtractMoney(data.totalAssets, data.totalLiabilities, data.totalEquity)) >= 0.01 && (
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
