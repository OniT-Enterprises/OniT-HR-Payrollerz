/**
 * Profit & Loss Report Page
 * Simple income statement showing revenue vs expenses
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
import { expenseService } from '@/services/expenseService';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { ExpenseCategory } from '@/types/money';
import { toDateStringTL } from '@/lib/dateUtils';
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
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('this_month');
  const [data, setData] = useState<PeriodData>({
    revenue: 0,
    expenses: 0,
    expensesByCategory: {},
    profit: 0,
  });

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [period, session?.tid]);

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

  const loadData = async () => {
    if (!session?.tid) return;
    try {
      setLoading(true);
      const { start, end } = getDateRange(period);

      // Get all paid invoices in the period
      const invoices = await invoiceService.getAllInvoices(session.tid);
      const paidInvoices = invoices.filter((inv) => {
        if (inv.status !== 'paid' || !inv.paidAt) return false;
        const paidDate = toDateStringTL(inv.paidAt);
        return paidDate >= start && paidDate <= end;
      });

      const revenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Get expenses in the period
      const expenses = await expenseService.getExpensesByDateRange(session.tid, start, end);
      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Group expenses by category
      const expensesByCategory: Record<string, number> = {};
      expenses.forEach((exp) => {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
      });

      setData({
        revenue,
        expenses: totalExpenses,
        expensesByCategory,
        profit: revenue - totalExpenses,
      });
    } catch (error) {
      console.error('Error loading P&L data:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.profitLoss.loadError') || 'Failed to load report',
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
    const startDate = new Date(start);
    const endDate = new Date(end);

    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', formatOptions)} - ${endDate.toLocaleDateString('en-US', formatOptions)}`;
  };

  const profitMargin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : '0';

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
      <SEO title="Profit & Loss - Meza" description="View your profit and loss statement" />
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.profitLoss.title') || 'Profit & Loss'}
                <InfoTooltip
                  title={t('money.profitLoss.tooltipTitle') || 'Profit & Loss Statement'}
                  content={t('money.profitLoss.tooltipContent') || 'Also called an Income Statement. Shows revenue (money earned from invoices) minus expenses (costs) to calculate net profit or loss for a period.'}
                />
              </h1>
              <p className="text-muted-foreground">
                {t('money.profitLoss.subtitle') || 'Income statement'}
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
                <SelectItem value="this_month">{t('money.profitLoss.thisMonth') || 'This Month'}</SelectItem>
                <SelectItem value="last_month">{t('money.profitLoss.lastMonth') || 'Last Month'}</SelectItem>
                <SelectItem value="this_quarter">{t('money.profitLoss.thisQuarter') || 'This Quarter'}</SelectItem>
                <SelectItem value="this_year">{t('money.profitLoss.thisYear') || 'This Year'}</SelectItem>
                <SelectItem value="last_year">{t('money.profitLoss.lastYear') || 'Last Year'}</SelectItem>
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

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card className="cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                onClick={() => window.location.href = '/money/invoices'}>
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
                onClick={() => window.location.href = '/money/expenses'}>
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
