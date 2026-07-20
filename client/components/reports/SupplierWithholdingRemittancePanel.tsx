import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, ExternalLink, Landmark, Loader2, Upload } from 'lucide-react';
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
import { useI18n } from '@/i18n/I18nProvider';
import { getTodayTL } from '@/lib/dateUtils';
import { formatCurrencyTL } from '@/lib/payroll/constants-tl';
import {
  isSupplierWithholdingRemittanceOverdue,
  type SupplierWithholdingPaymentMethod,
} from '@/lib/tax/supplier-withholding-remittance';
import { fileUploadService } from '@/services/fileUploadService';
import { supplierWithholdingRemittanceService } from '@/services/supplierWithholdingRemittanceService';

export function SupplierWithholdingRemittancePanel({ period }: { period: string }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const queryKey = ['supplier-withholding-remittance', tenantId, period] as const;
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => supplierWithholdingRemittanceService.getPosition(tenantId, period),
    enabled: Boolean(tenantId && period),
  });

  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayTL());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<SupplierWithholdingPaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const position = data?.position;

  // Law 8/2008 Sec. 32.2 — unremitted withholding past the due date suspends
  // the payer's expense deduction. Non-blocking: never crashes the panel.
  let deductionSuspended = false;
  if (position) {
    try {
      deductionSuspended = isSupplierWithholdingRemittanceOverdue(position, getTodayTL());
    } catch {
      deductionSuspended = false;
    }
  }

  const openDialog = () => {
    const id = supplierWithholdingRemittanceService.createId(tenantId);
    setPaymentId(id);
    setPaymentDate(getTodayTL());
    setAmount(position?.outstanding.toFixed(2) || '');
    setMethod('bank_transfer');
    setReference('');
    setNotes('');
    setProofFile(null);
    setProofUrl('');
    setOpen(true);
  };

  const recordPayment = async () => {
    if (!user?.uid || !proofFile || !paymentId) {
      toast({
        title: t('supplierRemittance.errorTitle') || 'Cannot record payment',
        description: !proofFile
          ? (t('supplierRemittance.proofRequired') || 'Upload the bank confirmation or BNU receipt.')
          : (t('supplierRemittance.signInRequired') || 'Sign in again and retry.'),
        variant: 'destructive',
      });
      return;
    }
    const validation = fileUploadService.validateReceiptFile(proofFile);
    if (!validation.valid) {
      toast({ title: 'Invalid file', description: validation.error, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const uploadedProof = proofUrl || await fileUploadService.uploadSupplierWithholdingProof(
        proofFile,
        tenantId,
        paymentId,
      );
      setProofUrl(uploadedProof);
      await supplierWithholdingRemittanceService.recordRemittance(
        tenantId,
        paymentId,
        {
          period,
          paymentDate,
          amount: Number(amount),
          method,
          paymentReference: reference,
          proofUrl: uploadedProof,
          notes,
        },
        user.uid,
      );
      await queryClient.invalidateQueries({ queryKey });
      setOpen(false);
      toast({
        title: t('supplierRemittance.savedTitle') || 'Payment recorded',
        description: t('supplierRemittance.savedDescription')
          || 'The payment evidence was saved and account 2320 was reduced.',
      });
    } catch (caught) {
      toast({
        title: t('supplierRemittance.errorTitle') || 'Cannot record payment',
        description: caught instanceof Error ? caught.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-primary" />
                {t('supplierRemittance.title') || 'Supplier withholding payment'}
              </CardTitle>
              <CardDescription>
                {t('supplierRemittance.description')
                  || 'Filing and payment are tracked separately. Only an actual payment with proof clears account 2320.'}
              </CardDescription>
            </div>
            {position && position.outstanding > 0 && (
              <Button onClick={openDialog} className="min-h-11">
                {t('supplierRemittance.record') || 'Record tax payment'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('supplierRemittance.loading') || 'Checking this period...'}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Could not load supplier withholding.'}
            </p>
          ) : position ? (
            <>
              <div className="space-y-2 rounded-lg border border-border/70 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('supplierRemittance.liability') || 'Withheld from suppliers'}</span>
                  <span className="font-medium">{formatCurrencyTL(position.liability)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('supplierRemittance.remitted') || 'Paid to ATTL'}</span>
                  <span className="font-medium">{formatCurrencyTL(position.remitted)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border/70 pt-2">
                  <span className="font-medium">{t('supplierRemittance.outstanding') || 'Still to pay'}</span>
                  <span className="font-semibold">{formatCurrencyTL(position.outstanding)}</span>
                </div>
              </div>

              {deductionSuspended && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t('supplierRemittance.deductionSuspended')
                      || 'Unremitted withholding suspends the deductibility of the underlying expense (Law 8/2008 Sec. 32.2) — remit to keep the deduction.'}
                  </span>
                </div>
              )}

              {position.status === 'paid' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  {t('supplierRemittance.paid') || 'Paid in full — evidence recorded'}
                </div>
              )}
              {position.status === 'not_due' && (
                <p className="text-sm text-muted-foreground">
                  {t('supplierRemittance.none') || 'No payer-withheld supplier tax was recorded for this period.'}
                </p>
              )}

              {data.remittances.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('supplierRemittance.history') || 'Payment evidence'}</p>
                  {data.remittances.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{formatCurrencyTL(item.amount)} · {item.paymentDate}</p>
                        <p className="text-xs text-muted-foreground">{item.paymentReference}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t('supplierRemittance.evidenceSaved') || 'Evidence saved'}</Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={item.proofUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-4 w-4" />
                            {t('common.view') || 'View'}
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('supplierRemittance.dialogTitle') || 'Record supplier withholding payment'}</DialogTitle>
            <DialogDescription>
              {t('supplierRemittance.dialogDescription')
                || 'Use the date and amount on the bank confirmation or BNU receipt. This posts Dr 2320 / Cr cash or bank.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplier-tax-date">{t('supplierRemittance.paymentDate') || 'Payment date'}</Label>
                <Input id="supplier-tax-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-tax-amount">{t('common.amount') || 'Amount'}</Label>
                <Input id="supplier-tax-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('supplierRemittance.method') || 'How it was paid'}</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as SupplierWithholdingPaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t('supplierRemittance.bankTransfer') || 'Bank transfer'}</SelectItem>
                  <SelectItem value="cash_at_bnu">{t('supplierRemittance.cashBnu') || 'Cash at BNU branch'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-tax-reference">{t('supplierRemittance.reference') || 'Bank / receipt reference'}</Label>
              <Input id="supplier-tax-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-tax-proof">{t('supplierRemittance.proof') || 'Payment proof'}</Label>
              <Input
                id="supplier-tax-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(event) => {
                  setProofFile(event.target.files?.[0] || null);
                  setProofUrl('');
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('supplierRemittance.proofHint') || 'PDF or image, up to 10 MB. Required because filing alone does not prove payment.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-tax-notes">{t('common.notes') || 'Notes'} ({t('common.optional') || 'optional'})</Label>
              <Textarea id="supplier-tax-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t('common.cancel') || 'Cancel'}</Button>
            <Button onClick={recordPayment} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {saving ? (t('common.saving') || 'Saving...') : (t('supplierRemittance.record') || 'Record tax payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
