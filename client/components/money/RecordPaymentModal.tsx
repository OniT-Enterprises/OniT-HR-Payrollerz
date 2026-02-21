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

export function RecordPaymentModal({
  invoice,
  open,
  onClose,
  onPaymentRecorded,
}: RecordPaymentModalProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const [saving, setSaving] = useState(false);

  // Calculate remaining balance
  const remainingBalance = subtractMoney(invoice.total, invoice.amountPaid || 0);

  // Form state
  const [amount, setAmount] = useState(remainingBalance.toString());
  const [isPartial, setIsPartial] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getTodayTL());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!session?.tid) return;

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid payment amount',
        variant: 'destructive',
      });
      return;
    }

    if (paymentAmount > remainingBalance) {
      toast({
        title: 'Amount too high',
        description: `Maximum payment is ${formatCurrency(remainingBalance)}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      await invoiceService.recordPayment(session.tid, invoice.id, {
        amount: paymentAmount,
        date: paymentDate, // YYYY-MM-DD string format
        method: paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
      });

      const isFullPayment = paymentAmount >= remainingBalance - 0.01; // Small tolerance for rounding

      toast({
        title: 'Payment recorded',
        description: isFullPayment
          ? `Invoice ${invoice.invoiceNumber} marked as paid`
          : `Partial payment of ${formatCurrency(paymentAmount)} recorded`,
      });

      onPaymentRecorded?.();
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to record payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue < remainingBalance - 0.01) {
      setIsPartial(true);
    } else {
      setIsPartial(false);
    }
  };

  const handlePartialToggle = (checked: boolean) => {
    setIsPartial(checked);
    if (!checked) {
      setAmount(remainingBalance.toString());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
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

        <div className="space-y-4 py-4">
          {/* Invoice Summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="text-green-600">-{formatCurrency(invoice.amountPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-medium pt-1 border-t">
              <span>Balance Due</span>
              <span>{formatCurrency(remainingBalance)}</span>
            </div>
          </div>

          {/* Amount */}
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
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="partial"
                checked={isPartial}
                onCheckedChange={handlePartialToggle}
              />
              <label
                htmlFor="partial"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Partial payment
              </label>
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Payment Date
            </Label>
            <Input
              id="date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Method
            </Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Reference
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g., Check #1234, Transfer ID"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this payment"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecordPaymentModal;
