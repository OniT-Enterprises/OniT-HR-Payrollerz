/**
 * Invoice Status Timeline
 * Visual progress indicator showing invoice status flow
 */

import { Check, Send, Eye, DollarSign, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types/money';
import { cn } from '@/lib/utils';

interface StatusStep {
  status: InvoiceStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const MAIN_FLOW: StatusStep[] = [
  { status: 'draft', label: 'Draft', icon: Clock, description: 'Invoice created' },
  { status: 'sent', label: 'Sent', icon: Send, description: 'Sent to customer' },
  { status: 'viewed', label: 'Viewed', icon: Eye, description: 'Customer viewed' },
  { status: 'paid', label: 'Paid', icon: DollarSign, description: 'Payment received' },
];

const STATUS_ORDER: Record<InvoiceStatus, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  partial: 2.5, // Between viewed and paid
  paid: 3,
  overdue: -1, // Special
  cancelled: -2, // Special
};

interface InvoiceStatusTimelineProps {
  invoice: Invoice;
  className?: string;
  compact?: boolean;
}

export function InvoiceStatusTimeline({ invoice, className, compact = false }: InvoiceStatusTimelineProps) {
  const currentOrder = STATUS_ORDER[invoice.status];
  const isOverdue = invoice.status === 'overdue';
  const isCancelled = invoice.status === 'cancelled';
  const isPartial = invoice.status === 'partial';

  // For overdue, show progress up to 'viewed' with alert
  // For partial, show progress up to 'viewed' with partial indicator
  const effectiveOrder = isOverdue || isPartial ? 2 : currentOrder;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {MAIN_FLOW.map((step, index) => {
          const isComplete = STATUS_ORDER[step.status] < effectiveOrder;
          const isCurrent = step.status === invoice.status ||
            (isPartial && step.status === 'viewed') ||
            (isOverdue && step.status === 'viewed');

          return (
            <div key={step.status} className="flex items-center">
              <div
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  isComplete && 'bg-green-500',
                  isCurrent && !isOverdue && !isPartial && 'bg-indigo-500',
                  isCurrent && isOverdue && 'bg-red-500',
                  isCurrent && isPartial && 'bg-yellow-500',
                  !isComplete && !isCurrent && 'bg-muted'
                )}
              />
              {index < MAIN_FLOW.length - 1 && (
                <div
                  className={cn(
                    'w-4 h-0.5 mx-0.5',
                    isComplete ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
        {isOverdue && (
          <AlertCircle className="h-3 w-3 text-red-500 ml-1" />
        )}
        {isCancelled && (
          <XCircle className="h-3 w-3 text-muted-foreground ml-1" />
        )}
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Invoice Cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('py-4', className)}>
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />

        {/* Progress line */}
        <div
          className={cn(
            'absolute top-5 left-0 h-0.5 transition-all',
            isOverdue ? 'bg-red-500' : 'bg-green-500'
          )}
          style={{
            width: `${Math.min(100, (effectiveOrder / (MAIN_FLOW.length - 1)) * 100)}%`
          }}
        />

        {MAIN_FLOW.map((step, _index) => {
          const isComplete = STATUS_ORDER[step.status] < effectiveOrder;
          const isCurrent = step.status === invoice.status ||
            (isPartial && step.status === 'viewed') ||
            (isOverdue && step.status === 'viewed');
          const Icon = step.icon;

          return (
            <div key={step.status} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isComplete && 'bg-green-500 text-white',
                  isCurrent && !isOverdue && !isPartial && 'bg-indigo-500 text-white ring-4 ring-indigo-100 dark:ring-indigo-900',
                  isCurrent && isOverdue && 'bg-red-500 text-white ring-4 ring-red-100 dark:ring-red-900',
                  isCurrent && isPartial && 'bg-yellow-500 text-white ring-4 ring-yellow-100 dark:ring-yellow-900',
                  !isComplete && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? (
                  <Check className="h-5 w-5" />
                ) : isCurrent && isOverdue ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium mt-2',
                  isComplete && 'text-green-600 dark:text-green-400',
                  isCurrent && !isOverdue && !isPartial && 'text-indigo-600 dark:text-indigo-400',
                  isCurrent && isOverdue && 'text-red-600 dark:text-red-400',
                  isCurrent && isPartial && 'text-yellow-600 dark:text-yellow-400',
                  !isComplete && !isCurrent && 'text-muted-foreground'
                )}
              >
                {isCurrent && isOverdue ? 'Overdue' : isCurrent && isPartial ? 'Partial' : step.label}
              </span>
              {/* Timestamp below label */}
              {isComplete && step.status === 'sent' && invoice.sentAt && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(invoice.sentAt).toLocaleDateString()}
                </span>
              )}
              {isCurrent && step.status === 'viewed' && invoice.viewedAt && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(invoice.viewedAt).toLocaleDateString()}
                </span>
              )}
              {isCurrent && step.status === 'paid' && invoice.paidAt && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(invoice.paidAt).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {isOverdue && (
        <div className="mt-4 text-center">
          <span className="text-sm text-red-600 dark:text-red-400 font-medium">
            Payment overdue since {new Date(invoice.dueDate).toLocaleDateString()}
          </span>
        </div>
      )}
      {isPartial && (
        <div className="mt-4 text-center">
          <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
            Partial payment received - ${invoice.amountPaid.toLocaleString()} of ${invoice.total.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

export default InvoiceStatusTimeline;
