/**
 * Void Invoice Dialog
 * Confirmation dialog with reason input for voiding invoices
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { invoiceService } from '@/services/invoiceService';
import { useTenant } from '@/contexts/TenantContext';
import type { Invoice } from '@/types/money';
import { Loader2, XCircle } from 'lucide-react';

interface VoidInvoiceDialogProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onVoided?: () => void;
}

export function VoidInvoiceDialog({
  invoice,
  open,
  onClose,
  onVoided,
}: VoidInvoiceDialogProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handleVoid = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);
      await invoiceService.cancelInvoice(session.tid, invoice.id, reason || undefined);

      toast({
        title: 'Invoice voided',
        description: `Invoice ${invoice.invoiceNumber} has been voided`,
      });

      onVoided?.();
      onClose();
    } catch (error) {
      console.error('Error voiding invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to void invoice',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Void Invoice
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to void invoice <strong>{invoice.invoiceNumber}</strong>?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Invoice Summary */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{invoice.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between text-yellow-600">
              <span>Payments Received</span>
              <span>{formatCurrency(invoice.amountPaid)}</span>
            </div>
          )}
        </div>

        {invoice.amountPaid > 0 && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> This invoice has received partial payments.
            Voiding will not refund these payments. You may need to process a refund separately.
          </div>
        )}

        {/* Reason Input */}
        <div className="space-y-2">
          <Label htmlFor="reason">
            Reason for voiding
            <span className="text-muted-foreground font-normal ml-1">(optional)</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Duplicate invoice, Customer cancelled order, Incorrect amount"
            rows={2}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleVoid}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Voiding...
              </>
            ) : (
              'Void Invoice'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

