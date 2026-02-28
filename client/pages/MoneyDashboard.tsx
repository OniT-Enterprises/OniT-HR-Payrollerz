/**
 * Money Dashboard - "For Dummies" Version
 * Simple, actionable overview focused on what users need to do TODAY
 * Designed for small business owners, not accountants
 */

import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { SEO } from '@/components/SEO';
import { useInvoiceStats, useAllInvoices } from '@/hooks/useInvoices';
import { usePayablesSummary } from '@/hooks/useBills';
import GuidancePanel from '@/components/GuidancePanel';
import {
  FileText,
  Users,
  AlertCircle,
  Plus,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Receipt,
  Send,
  AlertTriangle,
  Activity,
  ChevronRight,
  Sparkles,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Eye,
  Bell,
} from 'lucide-react';

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: stats = null, isLoading: statsLoading } = useInvoiceStats();
  const { data: recentInvoices = [], isLoading: invoicesLoading } = useAllInvoices();
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

  // Calculate money health
  const getMoneyHealth = () => {
    const hasOverdueInvoices = (stats?.invoicesOverdue || 0) > 0;
    const hasOverdueBills = (payablesSummary?.overdueCount || 0) > 0;
    const hasHighActions = actionItems.filter(a => a.priority === 'high').length > 0;

    if (hasOverdueInvoices || hasOverdueBills) {
      return {
        status: 'attention',
        color: 'amber',
        icon: <CircleAlert className="h-6 w-6" />,
        message: t('money.dashboard.attentionNeeded'),
        description: hasOverdueInvoices
          ? plural(stats?.invoicesOverdue || 0, 'money.dashboard.invoicesOverdue', 'money.dashboard.invoicesOverduePlural')
          : plural(payablesSummary?.overdueCount || 0, 'money.dashboard.billsOverdue', 'money.dashboard.billsOverduePlural'),
      };
    }

    if (hasHighActions) {
      return {
        status: 'action',
        color: 'blue',
        icon: <Bell className="h-6 w-6" />,
        message: t('money.dashboard.actionRequired'),
        description: plural(actionItems.length, 'money.dashboard.itemsNeedAttention', 'money.dashboard.itemsNeedAttentionPlural'),
      };
    }

    return {
      status: 'healthy',
      color: 'green',
      icon: <CircleCheck className="h-6 w-6" />,
      message: t('money.dashboard.lookingGood'),
      description: t('money.dashboard.noUrgentItems'),
    };
  };

  const health = getMoneyHealth();

  // Get invoice status display
  const getInvoiceStatusDisplay = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: t('money.dashboard.statusDraft'), icon: <CircleDashed className="h-3 w-3" />, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' };
      case 'sent':
        return { label: t('money.dashboard.statusSent'), icon: <Send className="h-3 w-3" />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900' };
      case 'viewed':
        return { label: t('money.dashboard.statusViewed'), icon: <Eye className="h-3 w-3" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900' };
      case 'paid':
        return { label: t('money.dashboard.statusPaid'), icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-green-600 bg-green-100 dark:bg-green-900' };
      case 'overdue':
        return { label: t('money.dashboard.statusOverdue'), icon: <AlertTriangle className="h-3 w-3" />, color: 'text-red-600 bg-red-100 dark:bg-red-900' };
      default:
        return { label: status, icon: null, color: 'text-slate-600 bg-slate-100' };
    }
  };

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

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <GuidancePanel section="money" />

        {/* Money Health + Action Required */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Money Health Indicator */}
          <Card className={`border-2 ${
            health.color === 'green' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' :
            health.color === 'amber' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' :
            'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  health.color === 'green' ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' :
                  health.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' :
                  'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                }`}>
                  {health.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{health.message}</h3>
                  <p className="text-sm text-muted-foreground">{health.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Required Today */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-lg">{t('money.dashboard.actionRequired')}</CardTitle>
                </div>
                {actionItems.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {plural(actionItems.length, 'money.dashboard.thingsToDo', 'money.dashboard.thingsToDoPlural')}
                  </Badge>
                )}
              </div>
              <CardDescription>
                {actionItems.length > 0
                  ? plural(actionItems.length, 'money.dashboard.youNeedToDo', 'money.dashboard.youNeedToDoPlural')
                  : t('money.dashboard.thingsNeedAttention')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length > 0 ? (
                <div className="space-y-2">
                  {actionItems.slice(0, 4).map((item, index) => (
                    <button
                      key={index}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
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
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-400">{t('money.dashboard.allCaughtUp')}</p>
                  <p className="text-sm text-muted-foreground">{t('money.dashboard.noUrgentTasks')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Money In / Money Out */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Money Coming In */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <ArrowDownLeft className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('money.dashboard.moneyComingIn')}</CardTitle>
                    <CardDescription>{t('money.dashboard.whatCustomersOwe')}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
                  {t('money.dashboard.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('money.dashboard.youAreOwed')}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(stats?.totalOutstanding || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plural(stats?.invoicesSent || 0, 'money.dashboard.fromUnpaidInvoices', 'money.dashboard.fromUnpaidInvoicesPlural')}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('money.dashboard.receivedThisMonth')}</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('money.dashboard.paymentsCollected')}
                  </p>
                </div>
              </div>

              {/* Overdue Warning */}
              {stats?.overdueAmount && stats.overdueAmount > 0 && (
                <button
                  onClick={() => navigate('/money/invoices?status=overdue')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div className="text-left">
                      <p className="font-medium text-sm text-red-700 dark:text-red-400">
                        {formatCurrency(stats.overdueAmount)} {t('money.dashboard.overdue')}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500">
                        {plural(stats.invoicesOverdue, 'money.dashboard.invoicesNeedFollowUp', 'money.dashboard.invoicesNeedFollowUpPlural')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-600" />
                </button>
              )}

              {/* Quick action */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/money/invoices/new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('money.dashboard.createNewInvoice')}
              </Button>
            </CardContent>
          </Card>

          {/* Money Going Out */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                    <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('money.dashboard.moneyGoingOut')}</CardTitle>
                    <CardDescription>{t('money.dashboard.billsAndExpenses')}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/bills')}>
                  {t('money.dashboard.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('money.dashboard.dueThisWeek')}</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(payablesSummary?.dueThisWeek || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plural(payablesSummary?.dueThisWeekCount || 0, 'money.dashboard.bill', 'money.dashboard.billPlural')}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('money.dashboard.dueLater')}</p>
                  <p className="text-2xl font-bold">{formatCurrency(payablesSummary?.dueLater || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plural(payablesSummary?.dueLaterCount || 0, 'money.dashboard.bill', 'money.dashboard.billPlural')}
                  </p>
                </div>
              </div>

              {/* Overdue Warning */}
              {payablesSummary?.overdue && payablesSummary.overdue > 0 && (
                <button
                  onClick={() => navigate('/money/bills?status=overdue')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CircleAlert className="h-5 w-5 text-red-600" />
                    <div className="text-left">
                      <p className="font-medium text-sm text-red-700 dark:text-red-400">
                        {formatCurrency(payablesSummary.overdue)} {t('money.dashboard.overdue')}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500">
                        {plural(payablesSummary.overdueCount, 'money.dashboard.billsPastDue', 'money.dashboard.billsPastDuePlural')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-600" />
                </button>
              )}

              {/* All clear */}
              {(!payablesSummary?.overdue || payablesSummary.overdue === 0) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-700 dark:text-green-400">{t('money.dashboard.noOverdueBills')}</p>
                </div>
              )}

              {/* Quick action */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/money/bills/new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('money.dashboard.recordNewBill')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity + Top Customers + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{t('money.dashboard.recentInvoices')}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
                  {t('money.dashboard.viewAll')}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentInvoices.length > 0 ? (
                <div className="space-y-2">
                  {recentInvoices.slice(0, 5).map((invoice) => {
                    const statusDisplay = getInvoiceStatusDisplay(invoice.status);
                    return (
                      <button
                        key={invoice.id}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        onClick={() => navigate(`/money/invoices/${invoice.id}`)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg ${statusDisplay.color}`}>
                            {statusDisplay.icon || <FileText className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{invoice.customerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.invoiceNumber} · {statusDisplay.label}
                            </p>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                          {invoice.status === 'overdue' && (
                            <p className="text-xs text-red-600">{t('money.dashboard.needsFollowUp')}</p>
                          )}
                          {invoice.status === 'draft' && (
                            <p className="text-xs text-blue-600">{t('money.dashboard.readyToSendShort')}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">{t('money.dashboard.noInvoicesYet')}</p>
                  <Button onClick={() => navigate('/money/invoices/new')} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('money.dashboard.createFirstInvoice')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions - Simplified to 3 main actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('money.dashboard.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start h-auto py-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => navigate('/money/invoices/new')}
              >
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <Plus className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.createInvoice')}</p>
                  <p className="text-xs text-indigo-200">{t('money.dashboard.billACustomer')}</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/bills/new')}
              >
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center mr-3">
                  <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.recordBill')}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.enterBillToPay')}</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => navigate('/money/invoices')}
              >
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('money.dashboard.viewAllInvoices')}</p>
                  <p className="text-xs text-muted-foreground">{t('money.dashboard.manageYourInvoices')}</p>
                </div>
              </Button>

              {/* Collapsible more actions */}
              <div className="pt-2 border-t mt-3">
                <p className="text-xs text-muted-foreground mb-2">{t('money.dashboard.moreOptions')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/customers')}>
                    <Users className="h-3 w-3 mr-1" />
                    {t('money.dashboard.customers')}
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/vendors')}>
                    <Users className="h-3 w-3 mr-1" />
                    {t('money.dashboard.vendors')}
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/expenses')}>
                    <Receipt className="h-3 w-3 mr-1" />
                    {t('money.dashboard.expenses')}
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/profit-loss')}>
                    <Activity className="h-3 w-3 mr-1" />
                    {t('money.dashboard.reports')}
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/vat-settings')}>
                    <Receipt className="h-3 w-3 mr-1" />
                    {t('money.dashboard.vatSettings')}
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/vat-returns')}>
                    <FileText className="h-3 w-3 mr-1" />
                    {t('money.dashboard.vatReturns')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers - Actionable */}
        {stats?.topCustomers && stats.topCustomers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{t('money.dashboard.whoOwesYou')}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/customers')}>
                  {t('money.dashboard.viewAllCustomers')}
                </Button>
              </div>
              <CardDescription>{t('money.dashboard.customersUnpaid')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.topCustomers.slice(0, 6).map((customer) => {
                  // Determine aging and action based on oldest invoice days
                  const oldestDays = customer.oldestInvoiceDays || 0;
                  const isOverdue = oldestDays > 30;
                  const needsReminder = oldestDays > 14;

                  return (
                    <div
                      key={customer.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        isOverdue
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isOverdue
                              ? 'bg-red-100 dark:bg-red-900'
                              : 'bg-indigo-100 dark:bg-indigo-900'
                          }`}>
                            <span className={`text-sm font-medium ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[120px]">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {plural(customer.invoiceCount, 'money.dashboard.invoice', 'money.dashboard.invoicePlural')}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(customer.outstanding)}
                        </p>
                      </div>

                      {/* Aging info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-3 w-3 ${
                            isOverdue ? 'text-red-500' : needsReminder ? 'text-amber-500' : 'text-muted-foreground'
                          }`} />
                          <span className={`text-xs ${
                            isOverdue ? 'text-red-600 dark:text-red-400' : needsReminder ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                          }`}>
                            {oldestDays > 0 ? t('money.dashboard.daysOld', { count: oldestDays }) : t('money.dashboard.recent')}
                          </span>
                        </div>

                        {/* Action button */}
                        {isOverdue ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs px-2"
                            onClick={() => navigate(`/money/invoices?customer=${customer.id}`)}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            {t('money.dashboard.sendReminder')}
                          </Button>
                        ) : needsReminder ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                            onClick={() => navigate(`/money/invoices?customer=${customer.id}`)}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            {t('money.dashboard.followUp')}
                          </Button>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('money.dashboard.wait')}
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
      </div>
    </div>
  );
}
