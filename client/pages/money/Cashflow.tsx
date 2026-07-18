/**
 * Cashflow Report
 * Shows cash inflows and outflows over a period
 */

import { useState } from 'react';
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
import { accountService, generalLedgerService } from '@/services/accountingService';
import { balanceSnapshotService } from '@/services/balanceSnapshotService';

import { addDaysISO, toDateStringTL, formatDateTL } from '@/lib/dateUtils';
import { addMoney, subtractMoney } from '@/lib/currency';
import MoreDetailsSection from '@/components/MoreDetailsSection';
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
  otherInflows: number;
  totalInflows: number;
  // Outflows
  vendorPayments: number;
  expenses: number;
  otherOutflows: number;
  totalOutflows: number;
  // Net
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
}

export default function Cashflow() {
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [period, setPeriod] = useState<string>('this_month');

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

  const { start, end } = getDateRange(period);
  const startStr = toDateStringTL(start);
  const endStr = toDateStringTL(end);

  const { data = {
    customerPayments: 0,
    otherInflows: 0,
    totalInflows: 0,
    vendorPayments: 0,
    expenses: 0,
    otherOutflows: 0,
    totalOutflows: 0,
    netCashflow: 0,
    openingBalance: 0,
    closingBalance: 0,
  }, isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'money', 'cashflow', startStr, endStr],
    queryFn: async (): Promise<CashflowData> => {
      const openingCutoff = addDaysISO(startStr, -1);
      const accounts = await accountService.getAllAccounts(tenantId);
      const cashAccounts = accounts.filter((account) => (
        account.isActive && account.type === 'asset' && ['cash', 'bank'].includes(account.subType)
      ));

      if (cashAccounts.length > 0) {
        const [entries, openingBalances, customerPayments, vendorPayments, expenseTotal] = await Promise.all([
          balanceSnapshotService.queryGLRange(tenantId, startStr, endStr),
          Promise.all(cashAccounts.map((account) => generalLedgerService.getAccountBalance(
            tenantId,
            account.id!,
            account.code,
            openingCutoff,
          ))),
          invoiceService.getPaidInvoiceTotalByDateRange(tenantId, startStr, endStr),
          billService.getCashPaidByDateRange(tenantId, startStr, endStr),
          expenseService.getTotalExpenses(tenantId, startStr, endStr),
        ]);
        const cashIds = new Set(cashAccounts.map((account) => account.id));
        const cashCodes = new Set(cashAccounts.map((account) => account.code));
        const netByJournal = new Map<string, number>();
        for (const entry of entries) {
          if (!cashIds.has(entry.accountId) && !cashCodes.has(entry.accountCode)) continue;
          netByJournal.set(
            entry.journalEntryId,
            addMoney(
              netByJournal.get(entry.journalEntryId) || 0,
              subtractMoney(entry.debit, entry.credit),
            ),
          );
        }

        let totalInflows = 0;
        let totalOutflows = 0;
        for (const netCash of netByJournal.values()) {
          if (netCash > 0) totalInflows = addMoney(totalInflows, netCash);
          if (netCash < 0) totalOutflows = addMoney(totalOutflows, -netCash);
        }
        const openingBalance = addMoney(...openingBalances);
        const netCashflow = subtractMoney(totalInflows, totalOutflows);

        return {
          customerPayments,
          otherInflows: subtractMoney(totalInflows, customerPayments),
          totalInflows,
          vendorPayments,
          expenses: expenseTotal,
          otherOutflows: subtractMoney(totalOutflows, vendorPayments, expenseTotal),
          totalOutflows,
          netCashflow,
          openingBalance,
          closingBalance: addMoney(openingBalance, netCashflow),
        };
      }

      const [
        customerPayments,
        vendorPayments,
        expenseTotal,
        priorCustomerPayments,
        priorVendorPayments,
        priorExpenses,
      ] = await Promise.all([
        invoiceService.getPaidInvoiceTotalByDateRange(tenantId, startStr, endStr),
        billService.getCashPaidByDateRange(tenantId, startStr, endStr),
        expenseService.getTotalExpenses(tenantId, startStr, endStr),
        invoiceService.getPaidInvoiceTotalAsOf(tenantId, openingCutoff),
        billService.getCashPaidAsOf(tenantId, openingCutoff),
        expenseService.getTotalExpensesAsOf(tenantId, openingCutoff),
      ]);

      const totalInflows = customerPayments;
      const totalOutflows = addMoney(vendorPayments, expenseTotal);
      const netCashflow = subtractMoney(totalInflows, totalOutflows);
      const openingBalance = subtractMoney(
        priorCustomerPayments,
        priorVendorPayments,
        priorExpenses,
      );

      return {
        customerPayments,
        otherInflows: 0,
        totalInflows,
        vendorPayments,
        expenses: expenseTotal,
        otherOutflows: 0,
        totalOutflows,
        netCashflow,
        openingBalance,
        closingBalance: addMoney(openingBalance, netCashflow),
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

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(period);
    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${formatDateTL(start, formatOptions)} - ${formatDateTL(end, formatOptions)}`;
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
      <SEO title="Cashflow - Xefe" description="View your cash flow statement" />
      <MainNavigation />

      <div className="p-6 max-w-screen-2xl mx-auto">
        <PageHeader
          title={t('money.cashflow.title') || 'Cash Flow'}
          subtitle={t('money.cashflow.subtitle') || 'Track money in and out'}
          icon={Banknote}
          iconColor="text-indigo-500"
          actions={
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
          }
        />

        {/* Summary Cards */}
        <MoreDetailsSection className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </MoreDetailsSection>

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
                {data.otherInflows !== 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Other Inflows / Adjustments</span>
                    <span className="font-medium">{formatCurrency(data.otherInflows)}</span>
                  </div>
                )}
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
                {data.otherOutflows !== 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Other Outflows / Adjustments</span>
                    <span className="font-medium">{formatCurrency(data.otherOutflows)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.cashflow.totalOutflows') || 'Total Outflows'}</span>
                <span className="text-red-600">{formatCurrency(data.totalOutflows)}</span>
              </div>
            </div>

            <Separator />

            {/* Cash reconciliation */}
            <div className="space-y-2 bg-muted rounded-lg px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opening Cash Balance</span>
                <span>{formatCurrency(data.openingBalance)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t('money.cashflow.netCashflow') || 'Net Cash Flow'}</span>
                <span className={data.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(data.netCashflow)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Closing Cash Balance</span>
                <span>{formatCurrency(data.closingBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
