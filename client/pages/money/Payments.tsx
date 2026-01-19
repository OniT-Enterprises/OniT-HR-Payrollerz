/**
 * Payments Page
 * View payment history and summaries
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { InfoTooltip } from '@/components/ui/info-tooltip';
import type { PaymentReceived } from '@/types/money';
import {
  DollarSign,
  Search,
  Calendar,
  FileText,
  CreditCard,
  Banknote,
  Building2,
  TrendingUp,
} from 'lucide-react';

// PaymentReceived already contains invoiceNumber and customerName
type PaymentDisplay = PaymentReceived;

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  cash: Banknote,
  bank_transfer: Building2,
  check: FileText,
  other: CreditCard,
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  check: 'Check',
  other: 'Other',
};

export default function Payments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { session } = useTenant();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentDisplay[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  useEffect(() => {
    if (session?.tid) {
      loadPayments();
    }
  }, [session?.tid]);

  const loadPayments = async () => {
    if (!session?.tid) return;
    try {
      setLoading(true);
      // Get all payments directly
      const allPayments = await invoiceService.getAllPayments(session.tid);
      setPayments(allPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: t('common.error') || 'Error',
        description: t('money.payments.loadError') || 'Failed to load payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      (payment.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (payment.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate summary stats
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const thisMonthPayments = payments.filter((p) => {
    const paymentDate = new Date(p.date);
    const now = new Date();
    return (
      paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear()
    );
  });
  const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Payments - OniT" description="View payment history" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('money.payments.title') || 'Payments'}
                <InfoTooltip
                  title="Payments Received"
                  content="Record of all payments received from customers. Each payment is linked to an invoice and updates that invoice's balance."
                />
              </h1>
            <p className="text-muted-foreground">
              {t('money.payments.subtitle') || 'Payment history and summaries'}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.payments.thisMonth') || 'This Month'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(thisMonthTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {thisMonthPayments.length}{' '}
                    {thisMonthPayments.length === 1
                      ? t('money.payments.payment') || 'payment'
                      : t('money.payments.payments') || 'payments'}
                  </p>
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
                    {t('money.payments.totalReceived') || 'Total Received'}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(totalReceived)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payments.length}{' '}
                    {payments.length === 1
                      ? t('money.payments.payment') || 'payment'
                      : t('money.payments.payments') || 'payments'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('money.payments.avgPayment') || 'Average Payment'}
                  </p>
                  <p className="text-2xl font-bold">
                    {payments.length > 0
                      ? formatCurrency(totalReceived / payments.length)
                      : formatCurrency(0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('money.payments.searchPlaceholder') || 'Search by invoice or customer...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('money.payments.method') || 'Payment Method'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all') || 'All Methods'}</SelectItem>
              <SelectItem value="cash">{t('money.payments.cash') || 'Cash'}</SelectItem>
              <SelectItem value="bank_transfer">
                {t('money.payments.bankTransfer') || 'Bank Transfer'}
              </SelectItem>
              <SelectItem value="check">{t('money.payments.check') || 'Check'}</SelectItem>
              <SelectItem value="other">{t('money.payments.other') || 'Other'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment List */}
        {filteredPayments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchTerm || methodFilter !== 'all'
                  ? t('money.payments.noResults') || 'No payments found'
                  : t('money.payments.empty') || 'No payments recorded yet'}
              </p>
              {!searchTerm && methodFilter === 'all' && (
                <Button onClick={() => navigate('/money/invoices')} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  {t('money.payments.viewInvoices') || 'View Invoices'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => {
              const MethodIcon = METHOD_ICONS[payment.method] || CreditCard;
              return (
                <Card
                  key={payment.id}
                  className="hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors cursor-pointer"
                  onClick={() => payment.invoiceId && navigate(`/money/invoices/${payment.invoiceId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <MethodIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{payment.customerName || 'Unknown'}</p>
                            <span className="text-sm text-muted-foreground">
                              • {payment.invoiceNumber || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {t(`money.payments.${payment.method}`) ||
                                METHOD_LABELS[payment.method] ||
                                payment.method}
                            </Badge>
                            {payment.notes && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {payment.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          +{formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(payment.date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Payment count */}
        {filteredPayments.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {t('money.payments.showing') || 'Showing'} {filteredPayments.length}{' '}
            {filteredPayments.length === 1
              ? t('money.payments.payment') || 'payment'
              : t('money.payments.payments') || 'payments'}
          </p>
        )}
      </div>
    </div>
  );
}
