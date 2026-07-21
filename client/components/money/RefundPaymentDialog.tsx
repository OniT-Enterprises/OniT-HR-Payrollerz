import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { invoiceService } from '@/services/invoiceService';
import { compareMoney, parseMoney, subtractMoney } from '@/lib/currency';
import { getTodayTL } from '@/lib/dateUtils';
import type { Invoice, PaymentReceived } from '@/types/money';
import { Loader2, RotateCcw } from 'lucide-react';

interface RefundPaymentDialogProps {
  invoice: Invoice;
  payment: PaymentReceived;
  open: boolean;
  onClose: () => void;
  onRefunded?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

export function RefundPaymentDialog({
  invoice,
  payment,
  open,
  onClose,
  onRefunded,
}: RefundPaymentDialogProps) {
  const { session, canManage } = useTenant();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayTL());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submitInFlight = useRef(false);
  const available = subtractMoney(payment.amount, payment.refundedAmount || 0);
  const today = getTodayTL();

  useEffect(() => {
    if (!open) return;
    setAmount(available.toFixed(2));
    setDate(today);
    setReason('');
  }, [available, open, today]);

  const handleSubmit = async () => {
    if (!session?.tid || !canManage() || submitInFlight.current) return;
    const parsed = parseMoney(amount);
    if (parsed === null || compareMoney(parsed, 0) <= 0 || compareMoney(parsed, available) > 0) {
      toast({
        title: 'Invalid refund amount',
        description: `Enter an amount up to ${formatCurrency(available)}.`,
        variant: 'destructive',
      });
      return;
    }
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Add a short reason for the refund.', variant: 'destructive' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < payment.date || date > today) {
      toast({
        title: 'Invalid refund date',
        description: 'Choose a date from the payment date through today.',
        variant: 'destructive',
      });
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    try {
      await invoiceService.refundPayment(
        session.tid,
        payment.id,
        { amount: parsed, date, reason: reason.trim() },
        session.member.uid,
      );
      toast({
        title: 'Refund recorded',
        description: `${formatCurrency(parsed)} was refunded for ${invoice.invoiceNumber}.`,
      });
      onRefunded?.();
      onClose();
    } catch (error) {
      console.error('Error refunding invoice payment:', error);
      toast({
        title: 'Refund not recorded',
        description: error instanceof Error ? error.message : 'Failed to record the refund.',
        variant: 'destructive',
      });
    } finally {
      submitInFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            Refund payment
          </DialogTitle>
          <DialogDescription>
            Record money returned from the payment received on {payment.date}. This also reverses the matching accounting entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available to refund</span>
              <span className="font-semibold">{formatCurrency(available)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Refund amount</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0.01"
              max={available}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-date">Refund date</Label>
            <Input
              id="refund-date"
              type="date"
              min={payment.date}
              max={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why was this payment refunded?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || available <= 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
