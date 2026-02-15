/**
 * Money Dashboard - "For Dummies" Version
 * Simple, actionable overview focused on what users need to do TODAY
 * Designed for small business owners, not accountants
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
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { customerService } from '@/services/customerService';
import { billService } from '@/services/billService';
import type { MoneyStats, Invoice } from '@/types/money';
import {
  Wallet,
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
  const { t: _t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MoneyStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [_customerCount, setCustomerCount] = useState(0);
  const [payablesSummary, setPayablesSummary] = useState<{
    overdue: number;
    overdueCount: number;
    dueThisWeek: number;
    dueThisWeekCount: number;
    dueLater: number;
    dueLaterCount: number;
  } | null>(null);

  useEffect(() => {
    if (session?.tid) {
      loadData();
    }
  }, [session?.tid]);

  const loadData = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);
      const [statsData, invoices, customers, payables] = await Promise.all([
        invoiceService.getStats(session.tid),
        invoiceService.getAllInvoices(session.tid, 10),
        customerService.getAllCustomers(session.tid),
        billService.getPayablesSummary(session.tid),
      ]);
      setStats(statsData);
      setRecentInvoices(invoices);
      setCustomerCount(customers.length);
      setPayablesSummary(payables);
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

  const _formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min ago`;
    return 'Just now';
  };

  // Calculate action items
  const actionItems: { type: string; icon: React.ReactNode; title: string; description: string; action: () => void; priority: string }[] = [];

  // Drafts that need sending
  if (stats?.invoicesDraft && stats.invoicesDraft > 0) {
    actionItems.push({
      type: 'send_invoice',
      icon: <Send className="h-5 w-5 text-blue-600" />,
      title: `Send ${stats.invoicesDraft} invoice${stats.invoicesDraft > 1 ? 's' : ''}`,
      description: 'Ready to send to customers',
      action: () => navigate('/money/invoices?status=draft'),
      priority: 'medium',
    });
  }

  // Overdue invoices need follow-up
  if (stats?.invoicesOverdue && stats.invoicesOverdue > 0) {
    actionItems.push({
      type: 'follow_up',
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      title: `Follow up on ${stats.invoicesOverdue} overdue invoice${stats.invoicesOverdue > 1 ? 's' : ''}`,
      description: `${formatCurrency(stats.overdueAmount || 0)} past due`,
      action: () => navigate('/money/invoices?status=overdue'),
      priority: 'high',
    });
  }

  // Bills due this week
  if (payablesSummary?.dueThisWeekCount && payablesSummary.dueThisWeekCount > 0) {
    actionItems.push({
      type: 'pay_bill',
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      title: `Pay ${payablesSummary.dueThisWeekCount} bill${payablesSummary.dueThisWeekCount > 1 ? 's' : ''} this week`,
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
      title: `${payablesSummary.overdueCount} bill${payablesSummary.overdueCount > 1 ? 's' : ''} overdue`,
      description: `${formatCurrency(payablesSummary.overdue)} needs payment`,
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
        message: 'Attention needed',
        description: hasOverdueInvoices
          ? `${stats?.invoicesOverdue} invoice${(stats?.invoicesOverdue || 0) > 1 ? 's' : ''} overdue`
          : `${payablesSummary?.overdueCount} bill${(payablesSummary?.overdueCount || 0) > 1 ? 's' : ''} overdue`,
      };
    }

    if (hasHighActions) {
      return {
        status: 'action',
        color: 'blue',
        icon: <Bell className="h-6 w-6" />,
        message: 'Action required',
        description: `${actionItems.length} item${actionItems.length > 1 ? 's' : ''} need attention`,
      };
    }

    return {
      status: 'healthy',
      color: 'green',
      icon: <CircleCheck className="h-6 w-6" />,
      message: 'Looking good!',
      description: 'No urgent items',
    };
  };

  const health = getMoneyHealth();

  // Get invoice status display
  const getInvoiceStatusDisplay = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', icon: <CircleDashed className="h-3 w-3" />, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' };
      case 'sent':
        return { label: 'Sent', icon: <Send className="h-3 w-3" />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900' };
      case 'viewed':
        return { label: 'Viewed', icon: <Eye className="h-3 w-3" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900' };
      case 'paid':
        return { label: 'Paid', icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-green-600 bg-green-100 dark:bg-green-900' };
      case 'overdue':
        return { label: 'Overdue', icon: <AlertTriangle className="h-3 w-3" />, color: 'text-red-600 bg-red-100 dark:bg-red-900' };
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
      <SEO title="Money - Meza" description="Track who owes you money, what you need to pay, and what to do next" />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
                <Wallet className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Money</h1>
                <p className="text-muted-foreground mt-1">
                  Track who owes you, what you need to pay, and what to do next
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/money/invoices/new')} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
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
                  <CardTitle className="text-lg">Action Required</CardTitle>
                </div>
                {actionItems.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {actionItems.length} thing{actionItems.length !== 1 ? 's' : ''} to do
                  </Badge>
                )}
              </div>
              <CardDescription>
                {actionItems.length > 0
                  ? `You need to do ${actionItems.length} thing${actionItems.length !== 1 ? 's' : ''}`
                  : 'Things that need your attention'}
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
                  <p className="font-medium text-green-700 dark:text-green-400">All caught up!</p>
                  <p className="text-sm text-muted-foreground">No urgent tasks right now</p>
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
                    <CardTitle className="text-lg">Money Coming In</CardTitle>
                    <CardDescription>What customers owe you</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">You are owed</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(stats?.totalOutstanding || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    from {stats?.invoicesSent || 0} unpaid invoice{(stats?.invoicesSent || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Received this month</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    payments collected
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
                        {formatCurrency(stats.overdueAmount)} overdue
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500">
                        {stats.invoicesOverdue} invoice{stats.invoicesOverdue !== 1 ? 's' : ''} need follow-up
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
                Create New Invoice
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
                    <CardTitle className="text-lg">Money Going Out</CardTitle>
                    <CardDescription>Bills and expenses to pay</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/bills')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Due this week</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(payablesSummary?.dueThisWeek || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payablesSummary?.dueThisWeekCount || 0} bill{(payablesSummary?.dueThisWeekCount || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Due later</p>
                  <p className="text-2xl font-bold">{formatCurrency(payablesSummary?.dueLater || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payablesSummary?.dueLaterCount || 0} bill{(payablesSummary?.dueLaterCount || 0) !== 1 ? 's' : ''}
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
                        {formatCurrency(payablesSummary.overdue)} overdue
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500">
                        {payablesSummary.overdueCount} bill{payablesSummary.overdueCount !== 1 ? 's' : ''} past due
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
                  <p className="text-sm text-green-700 dark:text-green-400">No overdue bills</p>
                </div>
              )}

              {/* Quick action */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/money/bills/new')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Record New Bill
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
                  <CardTitle className="text-base">Recent Invoices</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
                  View All
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
                            <p className="text-xs text-red-600">Needs follow-up</p>
                          )}
                          {invoice.status === 'draft' && (
                            <p className="text-xs text-blue-600">Ready to send</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">No invoices yet</p>
                  <Button onClick={() => navigate('/money/invoices/new')} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions - Simplified to 3 main actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
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
                  <p className="font-medium">Create Invoice</p>
                  <p className="text-xs text-indigo-200">Bill a customer</p>
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
                  <p className="font-medium">Record Bill</p>
                  <p className="text-xs text-muted-foreground">Enter a bill to pay</p>
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
                  <p className="font-medium">View All Invoices</p>
                  <p className="text-xs text-muted-foreground">Manage your invoices</p>
                </div>
              </Button>

              {/* Collapsible more actions */}
              <div className="pt-2 border-t mt-3">
                <p className="text-xs text-muted-foreground mb-2">More options</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/customers')}>
                    <Users className="h-3 w-3 mr-1" />
                    Customers
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/vendors')}>
                    <Users className="h-3 w-3 mr-1" />
                    Vendors
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/expenses')}>
                    <Receipt className="h-3 w-3 mr-1" />
                    Expenses
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => navigate('/money/profit-loss')}>
                    <Activity className="h-3 w-3 mr-1" />
                    Reports
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
                  <CardTitle className="text-base">Who Owes You Money</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/customers')}>
                  View All Customers
                </Button>
              </div>
              <CardDescription>Customers with unpaid invoices</CardDescription>
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
                              {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}
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
                            {oldestDays > 0 ? `${oldestDays} days old` : 'Recent'}
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
                            Send reminder
                          </Button>
                        ) : needsReminder ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                            onClick={() => navigate(`/money/invoices?customer=${customer.id}`)}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            Follow up
                          </Button>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Wait
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
