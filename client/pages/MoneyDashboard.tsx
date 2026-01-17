/**
 * Money Dashboard
 * Overview of invoicing, payments, and financial health
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { customerService } from '@/services/customerService';
import type { MoneyStats, Invoice } from '@/types/money';
import {
  Wallet,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  ArrowRight,
  DollarSign,
  Clock,
  CheckCircle2,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  FileCheck,
  UserPlus,
  Circle,
  CheckCircle,
} from 'lucide-react';

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MoneyStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, invoices, customers] = await Promise.all([
        invoiceService.getStats(),
        invoiceService.getAllInvoices(5),
        customerService.getAllCustomers(),
      ]);
      setStats(statsData);
      setRecentInvoices(invoices);
      setCustomerCount(customers.length);
      // Show onboarding if no customers or no invoices
      setShowOnboarding(customers.length === 0 || invoices.length === 0);
    } catch (error) {
      console.error('Error loading money dashboard:', error);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-purple-100 text-purple-700',
      paid: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-500',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Skeleton className="h-4 w-24 mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-7 w-32 mb-1" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Links & Recent Invoices */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Links */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Invoices */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-8 w-20" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1 ml-auto" />
                      <Skeleton className="h-5 w-14 ml-auto" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Money - OniT" description="Manage invoices and track payments" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('money.dashboard.title') || 'Money'}</h1>
              <p className="text-muted-foreground">
                {t('money.dashboard.subtitle') || 'Run the business — invoices, expenses, and daily cash flow'}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/money/invoices/new')} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('money.dashboard.newInvoice') || 'New Invoice'}
          </Button>
        </div>

        {/* Onboarding Checklist - Shows for new users */}
        {showOnboarding && (
          <Card className="mb-8 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950/30 dark:to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-600" />
                {t('money.dashboard.getStarted') || 'Get Started with Invoicing'}
              </CardTitle>
              <CardDescription>
                {t('money.dashboard.getStartedDesc') || 'Complete these steps to start sending invoices'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1: Company Details */}
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="mt-0.5">
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">
                        {t('money.dashboard.step1Title') || 'Company Details'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('money.dashboard.step1Desc') || 'Add your business name and address'}
                    </p>
                  </div>
                </button>

                {/* Step 2: Invoice Template */}
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="mt-0.5">
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">
                        {t('money.dashboard.step2Title') || 'Invoice Settings'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('money.dashboard.step2Desc') || 'Set default terms and tax rate'}
                    </p>
                  </div>
                </button>

                {/* Step 3: Add Customer */}
                <button
                  onClick={() => navigate('/money/customers')}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    customerCount > 0
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="mt-0.5">
                    {customerCount > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">
                        {t('money.dashboard.step3Title') || 'Add First Customer'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customerCount > 0
                        ? t('money.dashboard.step3Done') || `${customerCount} customer${customerCount > 1 ? 's' : ''} added`
                        : t('money.dashboard.step3Desc') || 'Create a customer to invoice'}
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Revenue This Month */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.dashboard.revenueThisMonth') || 'Revenue This Month'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
                  {stats && stats.revenuePreviousMonth > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {stats.revenueThisMonth >= stats.revenuePreviousMonth ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        vs {formatCurrency(stats.revenuePreviousMonth)} last month
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.dashboard.outstanding') || 'Outstanding'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalOutstanding || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.invoicesSent || 0} {t('money.dashboard.unpaidInvoices') || 'unpaid invoices'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card className={stats?.overdueAmount && stats.overdueAmount > 0 ? 'border-red-200 dark:border-red-800' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.dashboard.overdue') || 'Overdue'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats?.overdueAmount || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.invoicesOverdue || 0} {t('money.dashboard.overdueInvoices') || 'overdue invoices'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Draft Invoices */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.dashboard.drafts') || 'Drafts'}
                  </p>
                  <p className="text-2xl font-bold">{stats?.invoicesDraft || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('money.dashboard.readyToSend') || 'Ready to send'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links & Recent Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('money.dashboard.quickActions') || 'Quick Actions'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/invoices/new')}
              >
                <div className="h-8 w-8 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                  <Plus className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.createInvoice') || 'Create Invoice'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.createInvoiceDesc') || 'Bill a customer'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/invoices')}
              >
                <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.viewInvoices') || 'View Invoices'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.viewInvoicesDesc') || 'Manage all invoices'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/customers')}
              >
                <div className="h-8 w-8 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center mr-3">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.customers') || 'Customers'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.customersDesc') || 'Manage customer list'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/payments')}
              >
                <div className="h-8 w-8 rounded bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.payments') || 'Payments'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.paymentsDesc') || 'View payment history'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/vendors')}
              >
                <div className="h-8 w-8 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center mr-3">
                  <Truck className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.vendors') || 'Vendors'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.vendorsDesc') || 'Manage suppliers'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/expenses')}
              >
                <div className="h-8 w-8 rounded bg-red-100 dark:bg-red-900 flex items-center justify-center mr-3">
                  <Receipt className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.expenses') || 'Expenses'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.expensesDesc') || 'Track spending'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/bills')}
              >
                <div className="h-8 w-8 rounded bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mr-3">
                  <FileText className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.bills') || 'Bills'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.billsDesc') || 'Accounts payable'}</p>
                </div>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/profit-loss')}
              >
                <div className="h-8 w-8 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.profitLoss') || 'Profit & Loss'}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.profitLossDesc') || 'Income statement'}</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t('money.dashboard.recentInvoices') || 'Recent Invoices'}</CardTitle>
                <CardDescription>{t('money.dashboard.recentInvoicesDesc') || 'Your latest invoices'}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
                {t('common.viewAll') || 'View All'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">
                    {t('money.dashboard.noInvoices') || 'No invoices yet'}
                  </p>
                  <Button onClick={() => navigate('/money/invoices/new')} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('money.dashboard.createFirstInvoice') || 'Create your first invoice'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/money/invoices/${invoice.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.customerName}</p>
                          <p className="text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(invoice.total)}</p>
                        <Badge className={getStatusBadge(invoice.status)} variant="secondary">
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
