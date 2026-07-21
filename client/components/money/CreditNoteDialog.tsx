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
import { compareMoney, parseMoney } from '@/lib/currency';
import { getTodayTL } from '@/lib/dateUtils';
import type { Invoice } from '@/types/money';
import { Loader2, Receipt } from 'lucide-react';

interface CreditNoteDialogProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onCredited?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

export function CreditNoteDialog({ invoice, open, onClose, onCredited }: CreditNoteDialogProps) {
  const { session, canManage } = useTenant();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayTL());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submitInFlight = useRef(false);
  const today = getTodayTL();
  const available = invoice.balanceDue;

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
        title: 'Invalid credit amount',
        description: `Enter an amount up to ${formatCurrency(available)}.`,
        variant: 'destructive',
      });
      return;
    }
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Add a short reason for this credit note.', variant: 'destructive' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < invoice.issueDate || date > today) {
      toast({
        title: 'Invalid credit-note date',
        description: 'Choose a date from the invoice date through today.',
        variant: 'destructive',
      });
      return;
    }

    submitInFlight.current = true;
    setSaving(true);
    try {
      await invoiceService.createCreditNote(
        session.tid,
        invoice.id,
        { amount: parsed, date, reason: reason.trim() },
        session.member.uid,
      );
      toast({
        title: 'Credit note issued',
        description: `${formatCurrency(parsed)} was credited on ${invoice.invoiceNumber}.`,
      });
      onCredited?.();
      onClose();
    } catch (error) {
      console.error('Error issuing invoice credit note:', error);
      toast({
        title: 'Credit note not issued',
        description: error instanceof Error ? error.message : 'Failed to issue the credit note.',
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
            <Receipt className="h-5 w-5 text-blue-600" />
            Issue credit note
          </DialogTitle>
          <DialogDescription>
            Reduce the unpaid amount without recording cash. The credit and its accounting entry are kept as a permanent record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unpaid balance</span>
              <span className="font-semibold">{formatCurrency(available)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-note-amount">Credit amount</Label>
            <Input
              id="credit-note-amount"
              type="number"
              min="0.01"
              max={available}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-note-date">Credit-note date</Label>
            <Input
              id="credit-note-date"
              type="date"
              min={invoice.issueDate}
              max={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-note-reason">Reason</Label>
            <Textarea
              id="credit-note-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What is being corrected or credited?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || available <= 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Issue credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
