/**
 * Send Reminder Dialog
 * Confirmation dialog for sending payment reminders
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
import { useToast } from '@/hooks/use-toast';
import { invoiceService } from '@/services/invoiceService';
import { useTenant } from '@/contexts/TenantContext';
import type { Invoice } from '@/types/money';
import { formatDateTL } from '@/lib/dateUtils';
import { Loader2, Bell, AlertTriangle } from 'lucide-react';

interface SendReminderDialogProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onReminderSent?: () => void;
}

export function SendReminderDialog({
  invoice,
  open,
  onClose,
  onReminderSent,
}: SendReminderDialogProps) {
  const { toast } = useToast();
  const { session } = useTenant();
  const [loading, setLoading] = useState(false);

  const handleSendReminder = async () => {
    if (!session?.tid) return;

    try {
      setLoading(true);
      await invoiceService.sendReminder(session.tid, invoice.id);

      toast({
        title: 'Reminder sent',
        description: `Payment reminder recorded for ${invoice.invoiceNumber}`,
      });

      onReminderSent?.();
      onClose();
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reminder',
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

  const formatDate = (date: Date) => {
    return formatDateTL(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = invoice.status === 'overdue' || new Date(invoice.dueDate) < new Date();
  const daysOverdue = isOverdue
    ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Send Payment Reminder
          </AlertDialogTitle>
          <AlertDialogDescription>
            Send a payment reminder for invoice <strong>{invoice.invoiceNumber}</strong> to{' '}
            <strong>{invoice.customerName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Invoice Summary */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="text-green-600">-{formatCurrency(invoice.amountPaid)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium pt-1 border-t">
            <span>Balance Due</span>
            <span className={isOverdue ? 'text-red-600' : ''}>
              {formatCurrency(invoice.balanceDue)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Due Date</span>
            <span className={isOverdue ? 'text-red-600' : ''}>
              {formatDate(new Date(invoice.dueDate))}
            </span>
          </div>
        </div>

        {/* Overdue Warning */}
        {isOverdue && daysOverdue > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-red-700 dark:text-red-400">
              <strong>{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue</strong>
              <p className="text-xs mt-0.5 opacity-80">
                Consider following up directly with the customer.
              </p>
            </div>
          </div>
        )}

        {/* Previous Reminders */}
        {invoice.reminderCount && invoice.reminderCount > 0 && (
          <div className="text-sm text-muted-foreground">
            {invoice.reminderCount} reminder{invoice.reminderCount !== 1 ? 's' : ''} sent previously
            {invoice.lastReminderAt && (
              <span> · Last: {formatDate(invoice.lastReminderAt)}</span>
            )}
          </div>
        )}

        {/* Note about email */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          Note: This will record that a reminder was sent. You may need to contact the customer
          directly via phone or email.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSendReminder}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Send Reminder
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

