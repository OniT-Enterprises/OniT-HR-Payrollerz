/**
 * Record Payment Modal
 * Quick payment recording for invoices
 * Supports full and partial payments
 */

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { invoiceService } from '@/services/invoiceService';
import { useTenant } from '@/contexts/TenantContext';
import type { Invoice, PaymentMethod } from '@/types/money';
import { Loader2, DollarSign, Calendar, CreditCard, FileText } from 'lucide-react';
import { getTodayTL } from '@/lib/dateUtils';
import { subtractMoney } from '@/lib/currency';

// Payment methods relevant for Timor-Leste
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money (Telemor/Telkomcel)' },
  { value: 'check', label: 'Check' },
];

interface RecordPaymentModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

const formatPaymentCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

/** Validate payment amount and return an error toast config, or null if valid */
function validatePaymentAmount(amount: string, remainingBalance: number): { title: string; description: string; variant: 'destructive' } | null {
  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return { title: 'Invalid amount', description: 'Please enter a valid payment amount', variant: 'destructive' };
  }
  if (paymentAmount > remainingBalance) {
    return { title: 'Amount too high', description: `Maximum payment is ${formatPaymentCurrency(remainingBalance)}`, variant: 'destructive' };
  }
  return null;
}

/** Invoice summary section showing customer, total, paid, and balance */
function PaymentInvoiceSummary({ invoice, remainingBalance }: { invoice: Invoice; remainingBalance: number }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Customer</span>
        <span className="font-medium">{invoice.customerName}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Invoice Total</span>
        <span>{formatPaymentCurrency(invoice.total)}</span>
      </div>
      {invoice.amountPaid > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Already Paid</span>
          <span className="text-green-600">-{formatPaymentCurrency(invoice.amountPaid)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-medium pt-1 border-t">
        <span>Balance Due</span>
        <span>{formatPaymentCurrency(remainingBalance)}</span>
      </div>
    </div>
  );
}

/** Amount input with partial payment checkbox */
function PaymentAmountField({ amount, remainingBalance, isPartial, onAmountChange, onPartialToggle }: {
  amount: string; remainingBalance: number; isPartial: boolean;
  onAmountChange: (value: string) => void; onPartialToggle: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="amount">Amount Received</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={remainingBalance}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="pl-7"
          placeholder="0.00"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="partial" checked={isPartial} onCheckedChange={onPartialToggle} />
        <label htmlFor="partial" className="text-sm text-muted-foreground cursor-pointer">
          Partial payment
        </label>
      </div>
    </div>
  );
}

/** Payment method, date, reference, and notes fields */
function PaymentDetailsFields({ paymentDate, paymentMethod, reference, notes, onDateChange, onMethodChange, onReferenceChange, onNotesChange }: {
  paymentDate: string; paymentMethod: PaymentMethod; reference: string; notes: string;
  onDateChange: (v: string) => void; onMethodChange: (v: PaymentMethod) => void;
  onReferenceChange: (v: string) => void; onNotesChange: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="date" className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Payment Date
        </Label>
        <Input id="date" type="date" value={paymentDate} onChange={(e) => onDateChange(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          Payment Method
        </Label>
        <Select value={paymentMethod} onValueChange={(value) => onMethodChange(value as PaymentMethod)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference" className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Reference
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="reference" value={reference} onChange={(e) => onReferenceChange(e.target.value)} placeholder="e.g., Check #1234, Transfer ID" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        </Label>
        <Textarea id="notes" value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Additional notes about this payment" rows={2} />
      </div>
    </>
  );
}

/** Dialog footer with cancel and submit buttons */
function PaymentDialogFooter({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button onClick={onSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700">
        {saving ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
        ) : (
          <><DollarSign className="h-4 w-4 mr-2" />Record Payment</>
        )}
      </Button>
    </DialogFooter>
  );
}

/** Form body with invoice summary, amount, and detail fields */
function PaymentFormBody({
  invoice, remainingBalance, amount, isPartial, paymentDate, paymentMethod, reference, notes,
  onAmountChange, onPartialToggle, onDateChange, onMethodChange, onReferenceChange, onNotesChange,
}: {
  invoice: Invoice; remainingBalance: number; amount: string; isPartial: boolean;
  paymentDate: string; paymentMethod: PaymentMethod; reference: string; notes: string;
  onAmountChange: (v: string) => void; onPartialToggle: (c: boolean) => void;
  onDateChange: (v: string) => void; onMethodChange: (v: PaymentMethod) => void;
  onReferenceChange: (v: string) => void; onNotesChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <PaymentInvoiceSummary invoice={invoice} remainingBalance={remainingBalance} />
      <PaymentAmountField
        amount={amount} remainingBalance={remainingBalance} isPartial={isPartial}
        onAmountChange={onAmountChange} onPartialToggle={onPartialToggle}
      />
      <PaymentDetailsFields
        paymentDate={paymentDate} paymentMethod={paymentMethod} reference={reference} notes={notes}
        onDateChange={onDateChange} onMethodChange={onMethodChange}
        onReferenceChange={onReferenceChange} onNotesChange={onNotesChange}
      />
    </div>
  );
}

export function RecordPaymentModal({
  invoice,
  open,
  onClose,
  onPaymentRecorded,
}: RecordPaymentModalProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const [saving, setSaving] = useState(false);

  const remainingBalance = subtractMoney(invoice.total, invoice.amountPaid || 0);

  const [amount, setAmount] = useState(remainingBalance.toString());
  const [isPartial, setIsPartial] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getTodayTL());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const numValue = parseFloat(value);
    setIsPartial(!isNaN(numValue) && numValue < remainingBalance - 0.01);
  };

  const handlePartialToggle = (checked: boolean) => {
    setIsPartial(checked);
    if (!checked) setAmount(remainingBalance.toString());
  };

  const handleSubmit = async () => {
    if (!session?.tid) return;

    const validationError = validatePaymentAmount(amount, remainingBalance);
    if (validationError) { toast(validationError); return; }

    const paymentAmount = parseFloat(amount);
    try {
      setSaving(true);
      await invoiceService.recordPayment(session.tid, invoice.id, {
        amount: paymentAmount,
        date: paymentDate,
        method: paymentMethod,
        reference: reference || "",
        notes: notes || "",
      });

      const isFullPayment = paymentAmount >= remainingBalance - 0.01;
      toast({
        title: 'Payment recorded',
        description: isFullPayment
          ? `Invoice ${invoice.invoiceNumber} marked as paid`
          : `Partial payment of ${formatPaymentCurrency(paymentAmount)} recorded`,
      });
      onPaymentRecorded?.();
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({ title: 'Error', description: 'Failed to record payment. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Record a payment for invoice {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <PaymentFormBody
          invoice={invoice} remainingBalance={remainingBalance}
          amount={amount} isPartial={isPartial}
          paymentDate={paymentDate} paymentMethod={paymentMethod}
          reference={reference} notes={notes}
          onAmountChange={handleAmountChange} onPartialToggle={handlePartialToggle}
          onDateChange={setPaymentDate} onMethodChange={setPaymentMethod}
          onReferenceChange={setReference} onNotesChange={setNotes}
        />

        <PaymentDialogFooter saving={saving} onClose={onClose} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}

