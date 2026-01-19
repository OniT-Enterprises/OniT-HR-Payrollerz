/**
 * Money Dashboard
 * Overview of invoicing, payments, and financial health
 * Enhanced with charts, activity feed, and top customers
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, AreaChart, Area, ResponsiveContainer, Cell } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import { invoiceService } from '@/services/invoiceService';
import { customerService } from '@/services/customerService';
import { billService } from '@/services/billService';
import { ReceivablesWidget } from '@/components/money/ReceivablesWidget';
import { PayablesSummaryWidget } from '@/components/money/PayablesSummaryWidget';
import { InfoTooltip, MoneyTooltips } from '@/components/ui/info-tooltip';
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
  Eye,
  Send,
  AlertTriangle,
  Activity,
  Repeat,
} from 'lucide-react';

// Chart colors
const AGING_COLORS = {
  current: '#22c55e',    // green
  days30to60: '#eab308', // yellow
  days60to90: '#f97316', // orange
  over90: '#ef4444',     // red
};

const CHART_CONFIG = {
  current: { label: 'Current', color: AGING_COLORS.current },
  days30to60: { label: '31-60 Days', color: AGING_COLORS.days30to60 },
  days60to90: { label: '61-90 Days', color: AGING_COLORS.days60to90 },
  over90: { label: '90+ Days', color: AGING_COLORS.over90 },
  received: { label: 'Received', color: '#6366f1' },
  spent: { label: 'Spent', color: '#f43f5e' },
};

export default function MoneyDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MoneyStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
        invoiceService.getAllInvoices(session.tid, 5),
        customerService.getAllCustomers(session.tid),
        billService.getPayablesSummary(session.tid),
      ]);
      setStats(statsData);
      setRecentInvoices(invoices);
      setCustomerCount(customers.length);
      setPayablesSummary(payables);
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
      draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment_received':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'invoice_viewed':
        return <Eye className="h-4 w-4 text-purple-500" />;
      case 'invoice_sent':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'invoice_overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-slate-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Prepare aging chart data
  const agingData = stats?.aging
    ? [
        { name: 'Current', value: stats.aging.current, fill: AGING_COLORS.current },
        { name: '31-60', value: stats.aging.days30to60, fill: AGING_COLORS.days30to60 },
        { name: '61-90', value: stats.aging.days60to90, fill: AGING_COLORS.days60to90 },
        { name: '90+', value: stats.aging.over90, fill: AGING_COLORS.over90 },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        {/* Hero Skeleton */}
        <div className="border-b bg-indigo-50 dark:bg-indigo-950/30">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-5 w-64" />
                </div>
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        </div>

        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>

          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>

          {/* Bottom Section Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Money - OniT" description="Manage invoices and track payments" />
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
                <h1 className="text-3xl font-bold text-foreground">
                  {t('money.dashboard.title') || 'Money'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t('money.dashboard.subtitle') || 'Invoices, payments, and daily cash flow'}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/money/invoices/new')} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              {t('money.dashboard.newInvoice') || 'New Invoice'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Onboarding Checklist */}
        {showOnboarding && (
          <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950/30 dark:to-transparent">
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
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                >
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">Company Details</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Add your business name and address</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                >
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">Invoice Settings</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Set default terms and tax rate</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/money/customers')}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    customerCount > 0
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  {customerCount > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-sm">Add First Customer</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customerCount > 0 ? `${customerCount} customer${customerCount > 1 ? 's' : ''} added` : 'Create a customer to invoice'}
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Revenue MTD
                    <InfoTooltip
                      content="Month-to-date revenue from paid invoices. Shows total payments received this month."
                      title="Revenue MTD"
                    />
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
                        vs {formatCurrency(stats.revenuePreviousMonth)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Outstanding
                    <InfoTooltip
                      content={MoneyTooltips.dashboard.totalReceivables}
                      title="Total Outstanding"
                    />
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalOutstanding || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.invoicesSent || 0} unpaid invoices
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${stats?.overdueAmount && stats.overdueAmount > 0 ? 'border-l-red-500' : 'border-l-slate-300'}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Overdue
                    <InfoTooltip
                      content={MoneyTooltips.dashboard.overdueAmount}
                      title="Overdue Amount"
                    />
                  </p>
                  <p className={`text-2xl font-bold ${stats?.overdueAmount && stats.overdueAmount > 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(stats?.overdueAmount || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.invoicesOverdue || 0} overdue invoices
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-400">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Drafts
                    <InfoTooltip
                      content={MoneyTooltips.invoiceStatus.draft}
                      title="Draft Invoices"
                    />
                  </p>
                  <p className="text-2xl font-bold">{stats?.invoicesDraft || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ready to send</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Receivables Widget */}
          {stats?.aging && (
            <ReceivablesWidget aging={stats.aging} />
          )}

          {/* Payables Widget */}
          {payablesSummary && (
            <PayablesSummaryWidget payables={payablesSummary} />
          )}

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-1">
                    Cash Flow
                    <InfoTooltip
                      content={MoneyTooltips.dashboard.cashFlow}
                      title="Cash Flow"
                    />
                  </CardTitle>
                  <CardDescription>Payments received (6 months)</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/cashflow')}>
                  View Details
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.cashFlow && stats.cashFlow.some(d => d.received > 0) ? (
                <ChartContainer config={CHART_CONFIG} className="h-[200px]">
                  <AreaChart data={stats.cashFlow}>
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2" />
                    <p>No payment data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Activity, Top Customers, Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.slice(0, 6).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors"
                      onClick={() => activity.entityId && navigate(`/money/invoices/${activity.entityId}`)}
                    >
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.amount && formatCurrency(activity.amount)} · {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Top Customers</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/money/customers')}>
                  View All
                </Button>
              </div>
              <CardDescription>By outstanding balance</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.topCustomers && stats.topCustomers.length > 0 ? (
                <div className="space-y-3">
                  {stats.topCustomers.map((customer, index) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-lg -mx-2 transition-colors"
                      onClick={() => navigate(`/money/customers`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-medium text-indigo-600">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[140px]">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">{formatCurrency(customer.outstanding)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No outstanding balances</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/invoices/new')}>
                <div className="h-7 w-7 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                  <Plus className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Create Invoice</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/invoices')}>
                <div className="h-7 w-7 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">View Invoices</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/expenses')}>
                <div className="h-7 w-7 rounded bg-red-100 dark:bg-red-900 flex items-center justify-center mr-3">
                  <Receipt className="h-3.5 w-3.5 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Track Expense</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/bills')}>
                <div className="h-7 w-7 rounded bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mr-3">
                  <FileText className="h-3.5 w-3.5 text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Enter Bill</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/vendors')}>
                <div className="h-7 w-7 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center mr-3">
                  <Truck className="h-3.5 w-3.5 text-orange-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Manage Vendors</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/invoices/recurring')}>
                <div className="h-7 w-7 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center mr-3">
                  <Repeat className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Recurring Invoices</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/profit-loss')}>
                <div className="h-7 w-7 rounded bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mr-3">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Profit & Loss</p>
                </div>
              </Button>

              <Button variant="ghost" className="w-full justify-start h-auto py-2.5" onClick={() => navigate('/money/invoices/settings')}>
                <div className="h-7 w-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3">
                  <Settings className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Invoice Settings</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <CardDescription>Your latest invoices</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/money/invoices')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No invoices yet</p>
                <Button onClick={() => navigate('/money/invoices/new')} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first invoice
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/money/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate">{invoice.customerName}</p>
                      <Badge className={getStatusBadge(invoice.status)} variant="secondary">
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
                    <p className="text-lg font-semibold mt-1">{formatCurrency(invoice.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
