/**
 * VAT Returns Page
 * View and build VAT returns for filing periods.
 * Shows output VAT (collected) vs input VAT (paid) and net due.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import AutoBreadcrumb from '@/components/AutoBreadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenantId } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import {
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { formatDateTL } from '@/lib/dateUtils';
import { useAllInvoices } from '@/hooks/useInvoices';
import { useAllBills } from '@/hooks/useBills';
import { useAllExpenses } from '@/hooks/useExpenses';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';

interface VATSummary {
  outputVAT: number; // VAT collected from sales
  inputVAT: number; // VAT paid on expenses
  netDue: number; // outputVAT - inputVAT
  salesCount: number;
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
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch all invoices, bills, expenses via React Query
  const { data: invoices, isLoading: invoicesLoading } = useAllInvoices();
  const { data: bills, isLoading: billsLoading } = useAllBills();
  const { data: expenses, isLoading: expensesLoading } = useAllExpenses();

  // Fetch saved VAT return for the selected period
  const { data: savedReturn, isLoading: returnLoading } = useQuery({
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
    staleTime: 5 * 60 * 1000,
  });

  // Compute VAT summary from invoices, bills, expenses for selected period
  const summary = useMemo<VATSummary | null>(() => {
    if (!invoices || !bills || !expenses) return null;

    const [year, month] = selectedPeriod.split('-').map(Number);
    const periodStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    // First day of next month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const periodEndStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // Output VAT from invoices
    let outputVAT = 0;
    let salesCount = 0;
    for (const inv of invoices) {
      if (inv.issueDate >= periodStartStr && inv.issueDate < periodEndStr) {
        const taxAmount = Number(inv.taxAmount) || 0;
        if (taxAmount > 0) {
          outputVAT += taxAmount;
          salesCount++;
        }
      }
    }

    // Input VAT from expenses
    let inputVAT = 0;
    let expenseCount = 0;
    for (const exp of expenses) {
      if (exp.date >= periodStartStr && exp.date < periodEndStr) {
        const vatAmount = Number(exp.vatAmount) || 0;
        if (vatAmount > 0) {
          inputVAT += vatAmount;
          expenseCount++;
        }
      }
    }

    // Input VAT from bills
    for (const bill of bills) {
      if (bill.billDate >= periodStartStr && bill.billDate < periodEndStr) {
        const vatAmount = Number(bill.vatAmount) || 0;
        if (vatAmount > 0) {
          inputVAT += vatAmount;
          expenseCount++;
        }
      }
    }

    const netDue = outputVAT - inputVAT;

    if (salesCount === 0 && expenseCount === 0) return null;

    return { outputVAT, inputVAT, netDue, salesCount, expenseCount };
  }, [invoices, bills, expenses, selectedPeriod]);

  const loading = invoicesLoading || billsLoading || expensesLoading || returnLoading;

  const saveReturn = async (markAsFiled = false) => {
    if (!tenantId || !summary) return;
    setSaving(true);
    try {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1)
        .toISOString()
        .split('T')[0];
      const periodEnd = new Date(year, month, 0)
        .toISOString()
        .split('T')[0];

      const returnData = {
        periodStart,
        periodEnd,
        outputVAT: summary.outputVAT,
        inputVAT: summary.inputVAT,
        netDue: summary.netDue,
        salesCount: summary.salesCount,
        expenseCount: summary.expenseCount,
        status: markAsFiled ? 'filed' : 'draft',
        ...(markAsFiled && { filedAt: Timestamp.fromDate(new Date()) }),
        createdAt: savedReturn
          ? Timestamp.fromDate(savedReturn.createdAt)
          : Timestamp.fromDate(new Date()),
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
      queryClient.invalidateQueries({ queryKey: ['vatReturn', tenantId, selectedPeriod] });
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
      <SEO title="VAT Returns - Meza" />
      <MainNavigation />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <AutoBreadcrumb className="mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/money')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">VAT Returns</h1>
              <p className="text-sm text-muted-foreground">
                Build and file VAT returns for each period
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <Select
            value={selectedPeriod}
            onValueChange={setSelectedPeriod}
          >
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
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : summary ? (
          <>
            {/* Status Badge */}
            {savedReturn && (
              <div className="flex items-center gap-2">
                {savedReturn.status === 'filed' ? (
                  <Badge className="bg-green-100 text-green-700 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filed
                    {savedReturn.filedAt &&
                      ` on ${formatDateTL(savedReturn.filedAt)}`}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Output VAT */}
              <Card className="border-green-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Output VAT (Collected)
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.outputVAT)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    from {summary.salesCount} invoice
                    {summary.salesCount !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              {/* Input VAT */}
              <Card className="border-red-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Input VAT (Paid)
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.inputVAT)}
                  </p>
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
                  summary.netDue > 0
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-green-500/20 bg-green-500/5'
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {summary.netDue > 0 ? 'Net VAT Due' : 'VAT Refund Due'}
                    </span>
                  </div>
                  <p
                    className={`text-2xl font-bold ${summary.netDue > 0 ? 'text-amber-600' : 'text-green-600'}`}
                  >
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

            {/* Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  VAT Calculation
                </CardTitle>
                <CardDescription>
                  Summary for{' '}
                  {monthOptions.find((m) => m.value === selectedPeriod)
                    ?.label || selectedPeriod}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Output VAT (from invoices)
                  </span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(summary.outputVAT)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Input VAT (from expenses & bills)
                  </span>
                  <span className="font-medium text-red-600">
                    ({formatCurrency(summary.inputVAT)})
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>
                    {summary.netDue >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}
                  </span>
                  <span
                    className={
                      summary.netDue >= 0
                        ? 'text-amber-600'
                        : 'text-green-600'
                    }
                  >
                    {formatCurrency(Math.abs(summary.netDue))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => saveReturn(false)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
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
