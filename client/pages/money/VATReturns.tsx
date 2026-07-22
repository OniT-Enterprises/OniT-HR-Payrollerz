/**
 * VAT Returns Page
 * View and build VAT returns for filing periods.
 * Shows output VAT (collected) vs input VAT (paid) and net due.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import DashboardLoadError from '@/components/dashboard/DashboardLoadError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';

import MoreDetailsSection from '@/components/MoreDetailsSection';
import { Timestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { formatDateTL, toDateStringTL } from '@/lib/dateUtils';
import { addMoney, subtractMoney } from '@/lib/currency';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoiceService';
import { billService } from '@/services/billService';
import { expenseService } from '@/services/expenseService';
import { isVATConfigOperational, type VATConfig } from '@onit/shared';
import {
  Receipt,
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calculator,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface VATSummary {
  outputVAT: number; // VAT collected from sales
  inputVAT: number; // VAT paid on expenses
  netDue: number; // outputVAT - inputVAT
  salesCount: number;
  adjustmentCount: number;
  expenseCount: number;
}

interface VATReturnRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  outputVAT: number;
  inputVAT: number;
  netDue: number;
  status: 'draft' | 'filed';
  filedAt?: Date;
  createdAt: Date;
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = formatDateTL(d, {
      month: 'long',
      year: 'numeric',
    });
    options.push({ value, label });
  }
  return options;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function VATReturnsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const {
    data: vatStatus = { platformActive: false, tenantActive: false },
    isLoading: platformLoading,
    isError: platformError,
    isFetching: platformFetching,
    refetch: refetchPlatform,
  } = useQuery({
    queryKey: ['config', 'vat', 'status', tenantId],
    queryFn: async () => {
      const [platformSnap, tenantSnap] = await Promise.all([
        getDoc(doc(db, paths.vatConfig())),
        getDoc(doc(db, paths.vatSettings(tenantId))),
      ]);
      const platformActive = platformSnap.exists() && isVATConfigOperational(platformSnap.data() as Partial<VATConfig>);
      const tenantData = tenantSnap.exists() ? tenantSnap.data() : null;
      return {
        platformActive,
        tenantActive: tenantData?.vatEnabled === true && tenantData.vatRegistered === true,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
  const vatActive = vatStatus.platformActive && vatStatus.tenantActive;

  // Fetch saved VAT return for the selected period
  const {
    data: savedReturn,
    isLoading: returnLoading,
    isError: returnError,
    isFetching: returnFetching,
    refetch: refetchReturn,
  } = useQuery({
    queryKey: ['vatReturn', tenantId, selectedPeriod],
    queryFn: async () => {
      const returnRef = doc(db, paths.vatReturn(tenantId, selectedPeriod));
      const returnSnap = await getDoc(returnRef);
      if (!returnSnap.exists()) return null;
      const rData = returnSnap.data();
      return {
        id: returnSnap.id,
        periodStart: rData.periodStart,
        periodEnd: rData.periodEnd,
        outputVAT: rData.outputVAT,
        inputVAT: rData.inputVAT,
        netDue: rData.netDue,
        status: rData.status || 'draft',
        filedAt: rData.filedAt?.toDate?.(),
        createdAt: rData.createdAt?.toDate?.() || new Date(),
      } as VATReturnRecord;
    },
    staleTime: 0,
    enabled: !!tenantId && vatActive,
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['vatSummary', tenantId, selectedPeriod],
    queryFn: async (): Promise<VATSummary | null> => {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const periodStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const periodEndStr = toDateStringTL(new Date(year, month, 0));

      const [invoiceVAT, billVAT, expenseVAT] = await Promise.all([
        invoiceService.getVATSummary(tenantId, periodStartStr, periodEndStr),
        billService.getVATSummary(tenantId, periodStartStr, periodEndStr),
        expenseService.getVATSummary(tenantId, periodStartStr, periodEndStr),
      ]);

      const outputVAT = invoiceVAT.outputVAT;
      const inputVAT = addMoney(billVAT.inputVAT, expenseVAT.inputVAT);
      const salesCount = invoiceVAT.salesCount;
      const adjustmentCount = invoiceVAT.adjustmentCount;
      const expenseCount = billVAT.expenseCount + expenseVAT.expenseCount;
      const netDue = subtractMoney(outputVAT, inputVAT);

      if (salesCount === 0 && adjustmentCount === 0 && expenseCount === 0)
        return null;

      return {
        outputVAT,
        inputVAT,
        netDue,
        salesCount,
        adjustmentCount,
        expenseCount,
      };
    },
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId && vatActive,
  });

  const loading = platformLoading || (vatActive && (summaryLoading || returnLoading));
  const loadError = platformError || (vatActive && (summaryError || returnError));
  const retrying =
    platformFetching || (vatActive && (summaryFetching || returnFetching));

  const saveReturn = async (markAsFiled = false) => {
    if (!tenantId || !summary || !vatActive) return;
    setSaving(true);
    try {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const periodStart = toDateStringTL(new Date(year, month - 1, 1));
      const periodEnd = toDateStringTL(new Date(year, month, 0));

      const returnData = {
        periodStart,
        periodEnd,
        outputVAT: summary.outputVAT,
        inputVAT: summary.inputVAT,
        netDue: summary.netDue,
        salesCount: summary.salesCount,
        adjustmentCount: summary.adjustmentCount,
        expenseCount: summary.expenseCount,
        status: markAsFiled ? 'filed' : 'draft',
        ...(markAsFiled && { filedAt: Timestamp.fromDate(new Date()) }),
        createdAt: savedReturn ? Timestamp.fromDate(savedReturn.createdAt) : Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const ref = doc(db, paths.vatReturn(tenantId, selectedPeriod));
      await setDoc(ref, returnData, { merge: true });

      toast({
        title: markAsFiled ? 'Return Filed' : 'Return Saved',
        description: markAsFiled
          ? `VAT return for ${selectedPeriod} marked as filed`
          : `VAT return draft saved for ${selectedPeriod}`,
      });

      // Invalidate the saved return query to refetch
      queryClient.invalidateQueries({
        queryKey: ['vatReturn', tenantId, selectedPeriod],
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to save VAT return',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="VAT Returns - Xefe" />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 space-y-6">
        <PageHeader
          title="VAT Returns"
          subtitle="Build and file VAT returns for each period"
          icon={Receipt}
          iconColor="text-orange-500"
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('common.back')}
                onClick={() => navigate('/accounting')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />

        {loadError ? (
          <DashboardLoadError
            isRetrying={retrying}
            onRetry={() => {
              const retries: Promise<unknown>[] = [refetchPlatform()];
              if (vatActive) retries.push(refetchReturn(), refetchSummary());
              return Promise.all(retries);
            }}
          />
        ) : !loading && !vatActive ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {vatStatus.platformActive
                    ? 'VAT filing is not enabled for this business'
                    : 'VAT filing is not active in Timor-Leste'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {vatStatus.platformActive
                    ? 'Register and enable VAT in settings before Xefe calculates or files a return.'
                    : 'This page is kept ready for the future VAT rollout. Xefe will not calculate, save, or mark a VAT return as filed until an enacted, effective configuration is published.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : loading ? (
          <>
            <Skeleton className="mb-4 h-11 w-full rounded-lg" />

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 mt-1" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between text-sm">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-32" />
            </div>
          </>
        ) : summary ? (
          <>
            {/* Status Badge */}
            {savedReturn && (
              <div className="flex items-center gap-2">
                {savedReturn.status === 'filed' ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filed
                    {savedReturn.filedAt && ` on ${formatDateTL(savedReturn.filedAt)}`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Draft
                  </Badge>
                )}
              </div>
            )}

            {/* Summary Cards */}
            <MoreDetailsSection className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Output VAT */}
                <Card className="border-green-500/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Output VAT (Collected)</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(summary.outputVAT)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      from {summary.salesCount} invoice
                      {summary.salesCount !== 1 ? 's' : ''}
                      {summary.adjustmentCount > 0
                        ? ` · ${summary.adjustmentCount} credit/void adjustment${summary.adjustmentCount !== 1 ? 's' : ''}`
                        : ''}
                    </p>
                  </CardContent>
                </Card>

                {/* Input VAT */}
                <Card className="border-red-500/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">Input VAT (Paid)</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(summary.inputVAT)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      from {summary.expenseCount} expense
                      {summary.expenseCount !== 1 ? 's' : ''} / bill
                      {summary.expenseCount !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>

                {/* Net Due */}
                <Card
                  className={
                    summary.netDue > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-green-500/20 bg-green-500/5'
                  }
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {summary.netDue > 0 ? 'Net VAT Due' : 'VAT Refund Due'}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${summary.netDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(summary.netDue))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.netDue > 0
                        ? 'Amount to pay to tax authority'
                        : summary.netDue < 0
                          ? 'Amount to claim from tax authority'
                          : 'No VAT liability this period'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </MoreDetailsSection>

            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  VAT Calculation
                </CardTitle>
                <CardDescription>
                  Summary for {monthOptions.find((m) => m.value === selectedPeriod)?.label || selectedPeriod}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Output VAT (from invoices)</span>
                  <span className="font-medium text-green-600">{formatCurrency(summary.outputVAT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Input VAT (from expenses & bills)</span>
                  <span className="font-medium text-red-600">({formatCurrency(summary.inputVAT)})</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>{summary.netDue >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}</span>
                  <span className={summary.netDue >= 0 ? 'text-amber-600' : 'text-green-600'}>
                    {formatCurrency(Math.abs(summary.netDue))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => saveReturn(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Save Draft
              </Button>
              {savedReturn?.status !== 'filed' && (
                <Button onClick={() => saveReturn(true)} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Mark as Filed
                </Button>
              )}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No data for this period</p>
              <p className="text-sm text-muted-foreground mt-1">
                No invoices or expenses with VAT found for the selected month.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
