/**
 * VAT Returns Page
 * View and build VAT returns for filing periods.
 * Shows output VAT (collected) vs input VAT (paid) and net due.
 */

import { useState, useEffect, useMemo } from 'react';
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
import { useTenant } from '@/contexts/TenantContext';
import { SEO } from '@/components/SEO';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
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
    const label = d.toLocaleDateString('en-GB', {
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
  const { session } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<VATSummary | null>(null);
  const [savedReturn, setSavedReturn] = useState<VATReturnRecord | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    if (session?.tid && selectedPeriod) {
      loadPeriodData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tid, selectedPeriod]);

  const loadPeriodData = async () => {
    if (!session?.tid) return;
    setLoading(true);

    try {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 1);

      // Query invoices for the period
      const invoicesRef = collection(db, paths.invoices(session.tid));
      const invoiceQuery = query(
        invoicesRef,
        where('issueDate', '>=', periodStart.toISOString().split('T')[0]),
        where('issueDate', '<', periodEnd.toISOString().split('T')[0]),
        orderBy('issueDate', 'desc')
      );
      const invoiceSnap = await getDocs(invoiceQuery);

      let outputVAT = 0;
      let salesCount = 0;
      invoiceSnap.docs.forEach((d) => {
        const data = d.data();
        const taxAmount = Number(data.taxAmount) || 0;
        if (taxAmount > 0) {
          outputVAT += taxAmount;
          salesCount++;
        }
      });

      // Query expenses for the period
      const expensesRef = collection(db, paths.expenses(session.tid));
      const expenseQuery = query(
        expensesRef,
        where('date', '>=', periodStart.toISOString().split('T')[0]),
        where('date', '<', periodEnd.toISOString().split('T')[0])
      );
      const expenseSnap = await getDocs(expenseQuery);

      let inputVAT = 0;
      let expenseCount = 0;
      expenseSnap.docs.forEach((d) => {
        const data = d.data();
        const vatAmount = Number(data.vatAmount) || 0;
        if (vatAmount > 0) {
          inputVAT += vatAmount;
          expenseCount++;
        }
      });

      // Also check bills
      const billsRef = collection(db, paths.bills(session.tid));
      const billQuery = query(
        billsRef,
        where('date', '>=', periodStart.toISOString().split('T')[0]),
        where('date', '<', periodEnd.toISOString().split('T')[0])
      );
      const billSnap = await getDocs(billQuery);

      billSnap.docs.forEach((d) => {
        const data = d.data();
        const vatAmount = Number(data.vatAmount) || 0;
        if (vatAmount > 0) {
          inputVAT += vatAmount;
          expenseCount++;
        }
      });

      const netDue = outputVAT - inputVAT;
      setSummary({ outputVAT, inputVAT, netDue, salesCount, expenseCount });

      // Check if a return has already been saved for this period
      const returnRef = doc(db, paths.vatReturn(session.tid, selectedPeriod));
      const returnSnap = await getDoc(returnRef);
      if (returnSnap.exists()) {
        const rData = returnSnap.data();
        setSavedReturn({
          id: returnSnap.id,
          periodStart: rData.periodStart,
          periodEnd: rData.periodEnd,
          outputVAT: rData.outputVAT,
          inputVAT: rData.inputVAT,
          netDue: rData.netDue,
          status: rData.status || 'draft',
          filedAt: rData.filedAt?.toDate?.(),
          createdAt: rData.createdAt?.toDate?.() || new Date(),
        });
      } else {
        setSavedReturn(null);
      }
    } catch (err) {
      console.error('Failed to load VAT data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load VAT data for this period',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveReturn = async (markAsFiled = false) => {
    if (!session?.tid || !summary) return;
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

      const ref = doc(db, paths.vatReturn(session.tid, selectedPeriod));
      await setDoc(ref, returnData, { merge: true });

      toast({
        title: markAsFiled ? 'Return Filed' : 'Return Saved',
        description: markAsFiled
          ? `VAT return for ${selectedPeriod} marked as filed`
          : `VAT return draft saved for ${selectedPeriod}`,
      });

      // Reload
      await loadPeriodData();
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
                      ` on ${savedReturn.filedAt.toLocaleDateString('en-GB')}`}
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
