import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Upload,
} from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import PageHeader from '@/components/layout/PageHeader';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeDirectory } from '@/hooks/useEmployees';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDateTL, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import { formatCurrencyTL } from '@/lib/payroll/constants-tl';
import {
  CASH_ADVANCE_EXPENSE_CATEGORIES,
  type CashAdvanceClearingType,
  type CashAdvanceFundingMethod,
} from '@/lib/accounting/cash-advance';
import type { ExpenseCategory } from '@/types/money';
import { cashAdvanceService, type CashAdvanceWithClearings } from '@/services/cashAdvanceService';
import { fileUploadService } from '@/services/fileUploadService';

export default function CashAdvances() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const categoryLabel = (value: ExpenseCategory): string => (
    t(`cashAdvances.categories.${value}`)
    || value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())
  );
  const queryClient = useQueryClient();
  const queryKey = ['cash-advances', tenantId] as const;
  const { data: advances = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => cashAdvanceService.getAll(tenantId),
    enabled: Boolean(tenantId),
  });
  const { data: employees = [] } = useEmployeeDirectory({ status: 'active' });

  const ordered = useMemo(() => [...advances].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return b.issueDate.localeCompare(a.issueDate);
  }), [advances]);

  const [newOpen, setNewOpen] = useState(false);
  const [advanceId, setAdvanceId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayTL());
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [fundingMethod, setFundingMethod] = useState<CashAdvanceFundingMethod>('cash');
  const [issueReference, setIssueReference] = useState('');
  const [issueProof, setIssueProof] = useState<File | null>(null);
  const [issueProofUrl, setIssueProofUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [clearingAdvance, setClearingAdvance] = useState<CashAdvanceWithClearings | null>(null);
  const [clearingId, setClearingId] = useState('');
  const [clearingType, setClearingType] = useState<CashAdvanceClearingType>('expense');
  const [clearingDate, setClearingDate] = useState(getTodayTL());
  const [clearingAmount, setClearingAmount] = useState('');
  const [clearingDescription, setClearingDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('other');
  const [returnMethod, setReturnMethod] = useState<CashAdvanceFundingMethod>('cash');
  const [returnReference, setReturnReference] = useState('');
  const [clearingProof, setClearingProof] = useState<File | null>(null);
  const [clearingProofUrl, setClearingProofUrl] = useState('');
  const [historyAdvance, setHistoryAdvance] = useState<CashAdvanceWithClearings | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setAdvanceId(cashAdvanceService.createAdvanceId(tenantId));
    setEmployeeId('');
    setPurpose('');
    setIssueDate(getTodayTL());
    setDueDate('');
    setAmount('');
    setFundingMethod('cash');
    setIssueReference('');
    setIssueProof(null);
    setIssueProofUrl('');
    setNotes('');
    setNewOpen(true);
  };

  const openClearing = (advance: CashAdvanceWithClearings) => {
    setClearingAdvance(advance);
    setClearingId(cashAdvanceService.createClearingId(tenantId));
    setClearingType('expense');
    setClearingDate(getTodayTL());
    setClearingAmount(advance.outstanding.toFixed(2));
    setClearingDescription('');
    setExpenseCategory('other');
    setReturnMethod('cash');
    setReturnReference('');
    setClearingProof(null);
    setClearingProofUrl('');
  };

  const validateEvidence = (file: File | null): File => {
    if (!file) throw new Error('Upload a signed voucher, transfer proof, receipt, or return evidence.');
    const validation = fileUploadService.validateReceiptFile(file);
    if (!validation.valid) throw new Error(validation.error);
    return file;
  };

  const saveAdvance = async () => {
    if (!user?.uid || !advanceId) return;
    setSaving(true);
    try {
      const proof = validateEvidence(issueProof);
      const uploaded = issueProofUrl || await fileUploadService.uploadCashAdvanceEvidence(
        proof,
        tenantId,
        advanceId,
        'issue',
      );
      setIssueProofUrl(uploaded);
      await cashAdvanceService.create(tenantId, advanceId, {
        employeeId,
        purpose,
        issueDate,
        dueDate,
        amount: Number(amount),
        fundingMethod,
        issueReference,
        issueProofUrl: uploaded,
        notes,
      }, user.uid);
      await queryClient.invalidateQueries({ queryKey });
      setNewOpen(false);
      toast({ title: t('cashAdvances.savedTitle') || 'Cash advance recorded', description: t('cashAdvances.savedDescription') || 'The amount is held in account 1230 until receipts or returned money clear it.' });
    } catch (caught) {
      toast({ title: t('cashAdvances.errorTitle') || 'Could not save cash advance', description: caught instanceof Error ? caught.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveClearing = async () => {
    if (!user?.uid || !clearingAdvance || !clearingId) return;
    setSaving(true);
    try {
      const proof = validateEvidence(clearingProof);
      const uploaded = clearingProofUrl || await fileUploadService.uploadCashAdvanceEvidence(
        proof,
        tenantId,
        clearingAdvance.id,
        clearingId,
      );
      setClearingProofUrl(uploaded);
      await cashAdvanceService.clear(tenantId, clearingAdvance.id, clearingId, {
        type: clearingType,
        date: clearingDate,
        amount: Number(clearingAmount),
        description: clearingDescription,
        proofUrl: uploaded,
        ...(clearingType === 'expense'
          ? { expenseCategory }
          : { returnMethod, reference: returnReference }),
      }, user.uid);
      await queryClient.invalidateQueries({ queryKey });
      setClearingAdvance(null);
      toast({ title: t('cashAdvances.clearingSaved') || 'Clearing recorded', description: t('cashAdvances.clearingSavedDescription') || 'The receipt or returned cash reduced account 1230.' });
    } catch (caught) {
      toast({ title: t('cashAdvances.errorTitle') || 'Could not save cash advance', description: caught instanceof Error ? caught.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={t('cashAdvances.title') || 'Cash advances'} description={t('cashAdvances.subtitle') || 'Issue and clear accountable staff expense advances.'} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader title={t('cashAdvances.title') || 'Cash advances'} subtitle={t('cashAdvances.subtitle') || 'Money given to a worker before receipts, tracked until fully accounted for.'} icon={Banknote} iconColor="text-primary" actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />{t('cashAdvances.new') || 'New cash advance'}</Button>} />

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium">{t('cashAdvances.scopeTitle') || 'Use the right workflow'}</p><p className="text-muted-foreground">{t('cashAdvances.scopeDescription') || 'Use this page only when a named person receives money before receipts. Use Expenses for direct petty-cash purchases; salary loans stay in Payroll.'}</p></div>
            <Button variant="outline" asChild><a href="/money/expenses">{t('cashAdvances.openExpenses') || 'Open Expenses'}</a></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('cashAdvances.listTitle') || 'Accountable advances'}</CardTitle><CardDescription>{t('cashAdvances.listDescription') || 'Open items need receipts or unused money returned. Records and journal postings are immutable evidence.'}</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading') || 'Loading...'}</div>
              : error ? <p className="py-4 text-sm text-destructive">{error instanceof Error ? error.message : (t('cashAdvances.loadError') || 'Could not load cash advances.')}</p>
                : ordered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('cashAdvances.empty') || 'No cash advances recorded.'}</p>
                  : <div className="space-y-3">{ordered.map((advance) => {
                    const overdue = advance.status === 'open' && advance.dueDate < getTodayTL();
                    return <div key={advance.id} className="rounded-lg border border-border/70 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-1"><p className="font-medium">{advance.employeeName}</p><p className="text-sm">{advance.purpose}</p><p className="text-xs text-muted-foreground">{t('cashAdvances.issued') || 'Issued'} {formatDateTL(parseDateISO(advance.issueDate))} · {t('cashAdvances.clearBy') || 'Clear by'} {formatDateTL(parseDateISO(advance.dueDate))}</p></div>
                        <div className="space-y-1 md:text-right"><p className="font-semibold">{formatCurrencyTL(advance.outstanding)} {t('cashAdvances.outstanding') || 'outstanding'}</p><p className="text-xs text-muted-foreground">{formatCurrencyTL(advance.amount)} {t('cashAdvances.issuedAmount') || 'issued'} · {formatCurrencyTL(advance.expenseCleared)} {t('cashAdvances.receipts') || 'receipts'} · {formatCurrencyTL(advance.cashReturned)} {t('cashAdvances.returned') || 'returned'}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                        {advance.status === 'cleared' ? <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><CheckCircle className="mr-1 h-3 w-3" />{t('cashAdvances.statusCleared') || 'Cleared'}</Badge> : overdue ? <Badge className="bg-red-500/10 text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 h-3 w-3" />{t('cashAdvances.statusOverdue') || 'Overdue'}</Badge> : <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">{t('cashAdvances.statusOpen') || 'Open'}</Badge>}
                        <Button variant="ghost" size="sm" onClick={() => setHistoryAdvance(advance)}>{t('cashAdvances.history') || 'Evidence history'}</Button>
                        {advance.status === 'open' && <Button size="sm" onClick={() => openClearing(advance)}>{t('cashAdvances.clear') || 'Add receipt / return'}</Button>}
                      </div>
                    </div>;
                  })}</div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={(next) => !saving && setNewOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t('cashAdvances.new') || 'New cash advance'}</DialogTitle><DialogDescription>{t('cashAdvances.newDescription') || 'Record who received the money, when it must be cleared, and evidence that it was issued.'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('cashAdvances.employee') || 'Employee receiving money'}</Label><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={t('cashAdvances.selectEmployee') || 'Select employee'} /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id || ''}>{employee.personalInfo.firstName} {employee.personalInfo.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="advance-purpose">{t('cashAdvances.purpose') || 'Business purpose'}</Label><Textarea id="advance-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="advance-issued">{t('cashAdvances.issueDate') || 'Issue date'}</Label><Input id="advance-issued" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="advance-due">{t('cashAdvances.dueDate') || 'Clear-by date'}</Label><Input id="advance-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="advance-amount">{t('common.amount') || 'Amount'}</Label><Input id="advance-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>{t('cashAdvances.fundingMethod') || 'Issued from'}</Label><Select value={fundingMethod} onValueChange={(value) => setFundingMethod(value as CashAdvanceFundingMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">{t('cashAdvances.cash') || 'Cash on hand'}</SelectItem><SelectItem value="bank_transfer">{t('cashAdvances.bank') || 'Bank transfer'}</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-2"><Label htmlFor="advance-reference">{t('cashAdvances.issueReference') || 'Voucher / transfer reference'}</Label><Input id="advance-reference" value={issueReference} onChange={(event) => setIssueReference(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="advance-proof">{t('cashAdvances.issueProof') || 'Signed voucher or transfer proof'}</Label><Input id="advance-proof" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={(event) => { setIssueProof(event.target.files?.[0] || null); setIssueProofUrl(''); }} /></div>
            <div className="space-y-2"><Label htmlFor="advance-notes">{t('common.notes') || 'Notes'} ({t('common.optional') || 'optional'})</Label><Textarea id="advance-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          </div><DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)} disabled={saving}>{t('common.cancel') || 'Cancel'}</Button><Button onClick={saveAdvance} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t('common.save') || 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(clearingAdvance)} onOpenChange={(next) => !next && !saving && setClearingAdvance(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t('cashAdvances.clearTitle') || 'Clear part of the advance'}</DialogTitle><DialogDescription>{clearingAdvance ? `${clearingAdvance.employeeName} · ${formatCurrencyTL(clearingAdvance.outstanding)} ${t('cashAdvances.outstanding') || 'outstanding'}` : ''}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>{t('cashAdvances.clearingType') || 'What happened to the money?'}</Label><Select value={clearingType} onValueChange={(value) => setClearingType(value as CashAdvanceClearingType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">{t('cashAdvances.expenseReceipt') || 'Business expense receipt'}</SelectItem><SelectItem value="return">{t('cashAdvances.cashReturn') || 'Unused money returned'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="clearing-date">{t('common.date') || 'Date'}</Label><Input id="clearing-date" type="date" value={clearingDate} onChange={(event) => setClearingDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="clearing-amount">{t('common.amount') || 'Amount'}</Label><Input id="clearing-amount" type="number" min="0.01" step="0.01" value={clearingAmount} onChange={(event) => setClearingAmount(event.target.value)} /></div></div>
            <div className="space-y-2"><Label htmlFor="clearing-description">{t('common.description') || 'Description'}</Label><Textarea id="clearing-description" value={clearingDescription} onChange={(event) => setClearingDescription(event.target.value)} /></div>
            {clearingType === 'expense' ? <div className="space-y-2"><Label>{t('cashAdvances.category') || 'Expense category'}</Label><Select value={expenseCategory} onValueChange={(value) => setExpenseCategory(value as ExpenseCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CASH_ADVANCE_EXPENSE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>)}</SelectContent></Select></div> : <><div className="space-y-2"><Label>{t('cashAdvances.returnMethod') || 'Returned to'}</Label><Select value={returnMethod} onValueChange={(value) => setReturnMethod(value as CashAdvanceFundingMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">{t('cashAdvances.cash') || 'Cash on hand'}</SelectItem><SelectItem value="bank_transfer">{t('cashAdvances.bank') || 'Bank transfer'}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="return-reference">{t('cashAdvances.returnReference') || 'Return receipt / transfer reference'}</Label><Input id="return-reference" value={returnReference} onChange={(event) => setReturnReference(event.target.value)} /></div></>}
            <div className="space-y-2"><Label htmlFor="clearing-proof">{clearingType === 'expense' ? (t('cashAdvances.receiptProof') || 'Receipt / invoice evidence') : (t('cashAdvances.returnProof') || 'Return evidence')}</Label><Input id="clearing-proof" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={(event) => { setClearingProof(event.target.files?.[0] || null); setClearingProofUrl(''); }} /></div>
          </div><DialogFooter><Button variant="outline" onClick={() => setClearingAdvance(null)} disabled={saving}>{t('common.cancel') || 'Cancel'}</Button><Button onClick={saveClearing} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}{t('common.save') || 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyAdvance)} onOpenChange={(next) => !next && setHistoryAdvance(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t('cashAdvances.history') || 'Evidence history'}</DialogTitle><DialogDescription>{historyAdvance ? `${historyAdvance.employeeName} · ${historyAdvance.purpose}` : ''}</DialogDescription></DialogHeader>
          {historyAdvance && <div className="space-y-3 py-2"><div className="rounded-lg border border-border/70 p-3 text-sm"><p className="font-medium">{formatCurrencyTL(historyAdvance.amount)} {t('cashAdvances.issuedAmount') || 'issued'}</p><p className="text-xs text-muted-foreground">{formatDateTL(parseDateISO(historyAdvance.issueDate))} · {historyAdvance.issueReference}</p><Button variant="ghost" size="sm" asChild><a href={historyAdvance.issueProofUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />{t('cashAdvances.issueProof') || 'Issue proof'}</a></Button></div>{historyAdvance.clearings.length === 0 ? <p className="text-sm text-muted-foreground">{t('cashAdvances.noClearings') || 'No receipts or returns recorded yet.'}</p> : historyAdvance.clearings.map((clearing) => <div key={clearing.id} className="rounded-lg border border-border/70 p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{formatCurrencyTL(clearing.amount)} · {clearing.type === 'expense' ? (t('cashAdvances.expenseReceipt') || 'Business expense receipt') : (t('cashAdvances.cashReturn') || 'Unused money returned')}</p><p className="text-xs text-muted-foreground">{formatDateTL(parseDateISO(clearing.date))} · {clearing.description}</p></div><FileText className="h-4 w-4 text-muted-foreground" /></div><Button variant="ghost" size="sm" asChild><a href={clearing.proofUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />{t('common.view') || 'View'}</a></Button></div>)}</div>}
          <DialogFooter><Button variant="outline" onClick={() => setHistoryAdvance(null)}>{t('common.close') || 'Close'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
