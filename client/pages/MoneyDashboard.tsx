/**
 * Money Dashboard - "For Dummies" Version
 * Simple, actionable overview focused on what users need to do TODAY
 * Designed for small business owners, not accountants
 */

import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import { useInvoiceStats, useAllInvoices } from '@/hooks/useInvoices';
import { usePayablesSummary } from '@/hooks/useBills';
import GuidancePanel from '@/components/GuidancePanel';
import {
  FileText,
  Users,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Receipt,
  Send,
  AlertTriangle,
  Activity,
  ChevronRight,
  CircleAlert,
  CircleCheck,
} from 'lucide-react';

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: stats = null, isLoading: statsLoading } = useInvoiceStats();
  const { isLoading: invoicesLoading } = useAllInvoices();
  const { data: payablesSummary = null, isLoading: payablesLoading } = usePayablesSummary();
  const loading = statsLoading || invoicesLoading || payablesLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper for pluralization
  const plural = (count: number, singularKey: string, pluralKey: string, params?: Record<string, string | number>) => {
    return count === 1
      ? t(singularKey, { count, ...params })
      : t(pluralKey, { count, ...params });
  };

  // Calculate action items
  const actionItems: { type: string; icon: React.ReactNode; title: string; description: string; action: () => void; priority: string }[] = [];

  // Drafts that need sending
  if (stats?.invoicesDraft && stats.invoicesDraft > 0) {
    actionItems.push({
      type: 'send_invoice',
      icon: <Send className="h-5 w-5 text-blue-600" />,
      title: plural(stats.invoicesDraft, 'money.dashboard.sendInvoice', 'money.dashboard.sendInvoicePlural'),
      description: t('money.dashboard.readyToSend'),
      action: () => navigate('/money/invoices?status=draft'),
      priority: 'medium',
    });
  }

  // Overdue invoices need follow-up
  if (stats?.invoicesOverdue && stats.invoicesOverdue > 0) {
    actionItems.push({
      type: 'follow_up',
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      title: plural(stats.invoicesOverdue, 'money.dashboard.followUpOverdue', 'money.dashboard.followUpOverduePlural'),
      description: t('money.dashboard.pastDue', { amount: formatCurrency(stats.overdueAmount || 0) }),
      action: () => navigate('/money/invoices?status=overdue'),
      priority: 'high',
    });
  }

  // Bills due this week
  if (payablesSummary?.dueThisWeekCount && payablesSummary.dueThisWeekCount > 0) {
    actionItems.push({
      type: 'pay_bill',
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      title: plural(payablesSummary.dueThisWeekCount, 'money.dashboard.payBillsThisWeek', 'money.dashboard.payBillsThisWeekPlural'),
      description: formatCurrency(payablesSummary.dueThisWeek),
      action: () => navigate('/money/bills'),
      priority: 'medium',
    });
  }

  // Overdue bills
  if (payablesSummary?.overdueCount && payablesSummary.overdueCount > 0) {
    actionItems.push({
      type: 'overdue_bill',
      icon: <CircleAlert className="h-5 w-5 text-red-600" />,
      title: plural(payablesSummary.overdueCount, 'money.dashboard.billOverdue', 'money.dashboard.billOverduePlural'),
      description: t('money.dashboard.needsPayment', { amount: formatCurrency(payablesSummary.overdue) }),
      action: () => navigate('/money/bills?status=overdue'),
      priority: 'high',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title={t('money.dashboard.seoTitle')} description={t('money.dashboard.subtitle')} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
                <img src="/images/illustrations/icons/icon-money.webp" alt="" className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t('money.dashboard.title')}</h1>
                <p className="text-muted-foreground mt-1">
                  {t('money.dashboard.subtitle')}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/money/invoices/new')} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              {t('money.dashboard.createInvoice')}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-5">
        <GuidancePanel section="money" />

        {/* Action items — slim banner when issues, one-liner when clear */}
        {actionItems.length > 0 ? (
          <div className="space-y-2">
            {actionItems.slice(0, 4).map((item, index) => (
              <button
                key={index}
                onClick={item.action}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors text-left ${
                  item.priority === 'high'
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50'
                    : 'bg-muted/30 hover:bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1 text-sm text-green-600 dark:text-green-400">
            <CircleCheck className="h-4 w-4" />
            <span className="font-medium">{t('money.dashboard.allCaughtUp')}</span>
            <span className="text-muted-foreground">&mdash; {t('money.dashboard.noUrgentTasks')}</span>
          </div>
        )}

        {/* Money In / Money Out */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Money Coming In */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-base">{t('money.dashboard.moneyComingIn')}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/money/invoices')}>
                  {t('money.dashboard.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.youAreOwed')}</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(stats?.totalOutstanding || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {plural(stats?.invoicesSent || 0, 'money.dashboard.fromUnpaidInvoices', 'money.dashboard.fromUnpaidInvoicesPlural')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.receivedThisMonth')}</p>
                  <p className="text-xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('money.dashboard.paymentsCollected')}
                  </p>
                </div>
              </div>

              {stats?.overdueAmount && stats.overdueAmount > 0 && (
                <button
                  onClick={() => navigate('/money/invoices?status=overdue')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left"
                >
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400 flex-1">
                    {formatCurrency(stats.overdueAmount)} {t('money.dashboard.overdue')}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-red-600 shrink-0" />
                </button>
              )}
            </CardContent>
          </Card>

          {/* Money Going Out */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <CardTitle className="text-base">{t('money.dashboard.moneyGoingOut')}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/money/bills')}>
                  {t('money.dashboard.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.dueThisWeek')}</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(payablesSummary?.dueThisWeek || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {plural(payablesSummary?.dueThisWeekCount || 0, 'money.dashboard.bill', 'money.dashboard.billPlural')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.dueLater')}</p>
                  <p className="text-xl font-bold">{formatCurrency(payablesSummary?.dueLater || 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {plural(payablesSummary?.dueLaterCount || 0, 'money.dashboard.bill', 'money.dashboard.billPlural')}
                  </p>
                </div>
              </div>

              {payablesSummary?.overdue && payablesSummary.overdue > 0 ? (
                <button
                  onClick={() => navigate('/money/bills?status=overdue')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left"
                >
                  <CircleAlert className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400 flex-1">
                    {formatCurrency(payablesSummary.overdue)} {t('money.dashboard.overdue')}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-red-600 shrink-0" />
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('money.dashboard.noOverdueBills')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Who Owes You — compact table */}
        {stats?.topCustomers && stats.topCustomers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {t('money.dashboard.whoOwesYou')}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/money/customers')}>
                  {t('money.dashboard.viewAllCustomers')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/50">
                {stats.topCustomers.slice(0, 6).map((customer) => {
                  const oldestDays = customer.oldestInvoiceDays || 0;
                  const isOverdue = oldestDays > 30;
                  const needsReminder = oldestDays > 14;

                  return (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        isOverdue ? 'bg-red-100 dark:bg-red-900' : 'bg-indigo-100 dark:bg-indigo-900'
                      }`}>
                        <span className={`text-xs font-medium ${
                          isOverdue ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plural(customer.invoiceCount, 'money.dashboard.invoice', 'money.dashboard.invoicePlural')}
                        </p>
                      </div>
                      <p className="font-semibold text-sm text-green-600 dark:text-green-400 shrink-0">
                        {formatCurrency(customer.outstanding)}
                      </p>
                      <div className="shrink-0 w-24 text-right">
                        {isOverdue ? (
                          <Button
                            size="sm" variant="destructive" className="h-6 text-[11px] px-2"
                            onClick={() => navigate(`/money/invoices?customer=${customer.id}`)}
                          >
                            {t('money.dashboard.sendReminder')}
                          </Button>
                        ) : needsReminder ? (
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-[11px] px-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                            onClick={() => navigate(`/money/invoices?customer=${customer.id}`)}
                          >
                            {t('money.dashboard.followUp')}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {oldestDays > 0 ? t('money.dashboard.daysOld', { count: oldestDays }) : t('money.dashboard.recent')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick links — flat row */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          {[
            { label: t('money.dashboard.customers'), path: '/money/customers', icon: Users },
            { label: t('money.dashboard.vendors'), path: '/money/vendors', icon: Users },
            { label: t('money.dashboard.expenses'), path: '/money/expenses', icon: Receipt },
            { label: t('money.dashboard.reports'), path: '/money/profit-loss', icon: Activity },
            { label: t('money.dashboard.vatSettings'), path: '/money/vat-settings', icon: Receipt },
            { label: t('money.dashboard.vatReturns'), path: '/money/vat-returns', icon: FileText },
          ].map((link) => (
            <Button key={link.path} variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(link.path)}>
              <link.icon className="h-3 w-3 mr-1.5" />
              {link.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
