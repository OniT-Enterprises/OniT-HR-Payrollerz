/**
 * Profit & Loss Report Page
 * Simple income statement showing revenue vs expenses
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAdvancedTax, useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import { accountService, trialBalanceService } from '@/services/accountingService';
import { addMoney, subtractMoney } from '@/lib/currency';

import MoreDetailsSection from '@/components/MoreDetailsSection';
import { InstallmentTaxEtaxFiling } from '@/components/reports/InstallmentTaxEtaxFiling';
import { getTLIncomeTaxInstallmentFrequency } from '@/lib/tax/income-tax-installment-tl';
import type { ExpenseCategory } from '@/types/money';
import { toDateStringTL, formatDateTL } from '@/lib/dateUtils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface PeriodData {
  revenue: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  profit: number;
}

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  supplies: 'Supplies',
  equipment: 'Equipment',
  transport: 'Transport',
  fuel: 'Fuel',
  meals: 'Meals',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  taxes_licenses: 'Taxes & Licenses',
  marketing: 'Marketing',
  communication: 'Communication',
  maintenance: 'Maintenance',
  other: 'Other',
};

export default function ProfitLoss() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const showAdvancedTax = useAdvancedTax();
  const [period, setPeriod] = useState<string>('this_month');

  const getDateRange = (periodValue: string): { start: string; end: string } => {
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
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      start: toDateStringTL(start),
      end: toDateStringTL(end),
    };
  };

  const { start: startStr, end: endStr } = getDateRange(period);

  const { data = {
    revenue: 0,
    expenses: 0,
    expensesByCategory: {},
    profit: 0,
  }, isLoading: loading } = useQuery({
    queryKey: ['tenants', tenantId, 'money', 'profitLoss', startStr, endStr],
    queryFn: async (): Promise<PeriodData> => {
      const accounts = await accountService.getAllAccounts(tenantId);
      if (accounts.length > 0) {
        const statement = await trialBalanceService.generateIncomeStatement(
          tenantId,
          startStr,
          endStr,
          Number(endStr.slice(0, 4)),
        );
        const expensesByAccount: Record<string, number> = {};
        for (const item of statement.expenseItems) {
          expensesByAccount[item.accountName] = addMoney(
            expensesByAccount[item.accountName] || 0,
            item.amount,
          );
        }
        return {
          revenue: statement.totalRevenue,
          expenses: statement.totalExpenses,
          expensesByCategory: expensesByAccount,
          profit: statement.netIncome,
        };
      }

      const [revenue, directExpenseSummary, billExpenseSummary] = await Promise.all([
        invoiceService.getRevenueTotalByDateRange(tenantId, startStr, endStr),
        expenseService.getExpenseSummaryByDateRange(tenantId, startStr, endStr),
        billService.getExpenseSummaryByDateRange(tenantId, startStr, endStr),
      ]);

      const expensesByCategory = { ...directExpenseSummary.expensesByCategory };
      for (const [category, amount] of Object.entries(billExpenseSummary.expensesByCategory)) {
        expensesByCategory[category] = addMoney(expensesByCategory[category] || 0, amount);
      }
      const expenses = addMoney(
        directExpenseSummary.totalExpenses,
        billExpenseSummary.totalExpenses,
      );

      return {
        revenue,
        expenses,
        expensesByCategory,
        profit: subtractMoney(revenue, expenses),
      };
    },
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });

  // Art. 64 uses the preceding tax year's total turnover to choose monthly vs
  // quarterly installments. Use the ledger rather than guessing from the
  // currently selected report period.
  const selectedTaxYear = Number(endStr.slice(0, 4));
  const priorTaxYear = selectedTaxYear - 1;
  const priorYearStart = `${priorTaxYear}-01-01`;
  const priorYearEnd = `${priorTaxYear}-12-31`;
  const {
    data: priorYearTurnover = 0,
    isLoading: priorYearTurnoverLoading,
    isError: priorYearTurnoverError,
  } = useQuery({
    queryKey: ['tenants', tenantId, 'money', 'installmentTaxTurnover', priorTaxYear],
    queryFn: async (): Promise<number> => {
      const accounts = await accountService.getAllAccounts(tenantId);
      if (accounts.length > 0) {
        const statement = await trialBalanceService.generateIncomeStatement(
          tenantId,
          priorYearStart,
          priorYearEnd,
          priorTaxYear,
        );
        return statement.totalRevenue;
      }
      return invoiceService.getRevenueTotalByDateRange(tenantId, priorYearStart, priorYearEnd);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });

  const installmentFrequency = getTLIncomeTaxInstallmentFrequency(priorYearTurnover);
  const isInstallmentPeriod = installmentFrequency === 'quarterly'
    ? period === 'this_quarter'
    : period === 'this_month' || period === 'last_month';

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
    const startDate = new Date(start);
    const endDate = new Date(end);

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${formatDateTL(startDate, formatOptions)} - ${formatDateTL(endDate, formatOptions)}`;
  };

  const profitMargin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-screen-2xl mx-auto">
          <div className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-lg" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-10 w-[180px] shrink-0" />
            </div>
            <Skeleton className="mt-3 h-0.5 w-full rounded-full" />
          </div>

          <div className="mb-8">
            <Skeleton className="mb-3 h-11 w-full rounded-lg" />
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="ml-6 space-y-1">
                  <div className="flex justify-between py-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <div className="flex justify-between py-2 border-t">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="ml-6 space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between py-1">
                      <Skeleton className="h-4" style={{ width: `${140 - i * 12}px` }} />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between py-2 border-t">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex justify-between py-3 bg-muted rounded-lg px-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-4 w-28 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-5 w-5 rounded-full" />
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
      <SEO title="Profit & Loss - Xefe" description="View your profit and loss statement" />
      <MainNavigation />

      <div className="p-6 max-w-screen-2xl mx-auto">
        <PageHeader
          title={t('money.profitLoss.title') || 'Profit & Loss'}
          subtitle={t('money.profitLoss.subtitle') || 'Income statement'}
          icon={TrendingUp}
          iconColor="text-indigo-500"
          actions={
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">{t('money.profitLoss.thisMonth') || 'This Month'}</SelectItem>
                <SelectItem value="last_month">{t('money.profitLoss.lastMonth') || 'Last Month'}</SelectItem>
                <SelectItem value="this_quarter">{t('money.profitLoss.thisQuarter') || 'This Quarter'}</SelectItem>
                <SelectItem value="this_year">{t('money.profitLoss.thisYear') || 'This Year'}</SelectItem>
                <SelectItem value="last_year">{t('money.profitLoss.lastYear') || 'Last Year'}</SelectItem>
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
                    {t('money.profitLoss.revenue') || 'Revenue'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data.revenue)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.profitLoss.expenses') || 'Expenses'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(data.expenses)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.profitLoss.netProfit') || 'Net Profit'}
                  </p>
                  <p className={`text-2xl font-bold ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.profit)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profitMargin}% {t('money.profitLoss.margin') || 'margin'}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  data.profit >= 0
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
                }`}>
                  <DollarSign className={`h-6 w-6 ${
                    data.profit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </MoreDetailsSection>

        {/* Detailed P&L Statement */}
        <Card>
          <CardHeader>
            <CardTitle>{t('money.profitLoss.statement') || 'Income Statement'}</CardTitle>
            <CardDescription>{getPeriodLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Revenue Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('money.profitLoss.revenue') || 'Revenue'}
              </h3>
              <div className="ml-6 space-y-1">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">
                    {t('money.profitLoss.salesRevenue') || 'Sales Revenue'}
                  </span>
                  <span className="font-medium">{formatCurrency(data.revenue)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.profitLoss.totalRevenue') || 'Total Revenue'}</span>
                <span className="text-green-600">{formatCurrency(data.revenue)}</span>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Expenses Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {t('money.profitLoss.expenses') || 'Expenses'}
              </h3>
              <div className="ml-6 space-y-1">
                {Object.entries(data.expensesByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span className="text-muted-foreground">
                        {t(`money.expenses.categories.${category}`) ||
                          EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ||
                          category}
                      </span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                {Object.keys(data.expensesByCategory).length === 0 && (
                  <p className="text-muted-foreground text-sm py-2">
                    {t('money.profitLoss.noExpenses') || 'No expenses recorded'}
                  </p>
                )}
              </div>
              <div className="flex justify-between py-2 font-semibold border-t">
                <span>{t('money.profitLoss.totalExpenses') || 'Total Expenses'}</span>
                <span className="text-red-600">{formatCurrency(data.expenses)}</span>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Net Profit */}
            <div className="flex justify-between py-3 text-lg font-bold bg-muted rounded-lg px-4">
              <span>{t('money.profitLoss.netProfit') || 'Net Profit'}</span>
              <span className={data.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(data.profit)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Art. 64: quarterly at <= $1m prior-year turnover; monthly above it.
            Accountant-grade filing panel — hidden on the simple flow. */}
        {showAdvancedTax
          && !priorYearTurnoverLoading
          && !priorYearTurnoverError
          && isInstallmentPeriod && (
          <div className="mt-6">
            <InstallmentTaxEtaxFiling
              revenue={data.revenue}
              priorYearTurnover={priorYearTurnover}
              periodLabel={getPeriodLabel()}
            />
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card className="cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                onClick={() => navigate('/money/invoices')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('money.profitLoss.viewInvoices') || 'View Invoices'}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('money.profitLoss.invoicesDescription') || 'See all your revenue sources'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                onClick={() => navigate('/money/expenses')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('money.profitLoss.viewExpenses') || 'View Expenses'}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('money.profitLoss.expensesDescription') || 'See all your expense details'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
