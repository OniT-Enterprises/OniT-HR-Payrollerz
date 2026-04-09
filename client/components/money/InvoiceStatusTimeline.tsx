/**
 * Invoice Status Timeline
 * Visual progress indicator showing invoice status flow
 */

import { Check, Send, Eye, DollarSign, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types/money';
import { cn } from '@/lib/utils';
import { formatDateTL } from '@/lib/dateUtils';

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

/** Derive step-level display flags from invoice status */
function getStepState(
  stepStatus: InvoiceStatus,
  invoiceStatus: InvoiceStatus,
  effectiveOrder: number
) {
  const isOverdue = invoiceStatus === 'overdue';
  const isPartial = invoiceStatus === 'partial';
  const isComplete = STATUS_ORDER[stepStatus] < effectiveOrder;
  const isCurrent = stepStatus === invoiceStatus ||
    (isPartial && stepStatus === 'viewed') ||
    (isOverdue && stepStatus === 'viewed');
  return { isComplete, isCurrent, isOverdue, isPartial };
}

/** Color class for the step dot/circle based on state */
function getStepDotClass(isComplete: boolean, isCurrent: boolean, isOverdue: boolean, isPartial: boolean) {
  if (isComplete) return 'bg-green-500';
  if (isCurrent && isOverdue) return 'bg-red-500';
  if (isCurrent && isPartial) return 'bg-yellow-500';
  if (isCurrent) return 'bg-indigo-500';
  return 'bg-muted';
}

/** Color class for the full-size step circle (with ring) */
function getStepCircleClass(isComplete: boolean, isCurrent: boolean, isOverdue: boolean, isPartial: boolean) {
  if (isComplete) return 'bg-green-500 text-white';
  if (isCurrent && isOverdue) return 'bg-red-500 text-white ring-4 ring-red-100 dark:ring-red-900';
  if (isCurrent && isPartial) return 'bg-yellow-500 text-white ring-4 ring-yellow-100 dark:ring-yellow-900';
  if (isCurrent) return 'bg-indigo-500 text-white ring-4 ring-indigo-100 dark:ring-indigo-900';
  return 'bg-muted text-muted-foreground';
}

/** Color class for the step label text */
function getStepLabelClass(isComplete: boolean, isCurrent: boolean, isOverdue: boolean, isPartial: boolean) {
  if (isComplete) return 'text-green-600 dark:text-green-400';
  if (isCurrent && isOverdue) return 'text-red-600 dark:text-red-400';
  if (isCurrent && isPartial) return 'text-yellow-600 dark:text-yellow-400';
  if (isCurrent) return 'text-indigo-600 dark:text-indigo-400';
  return 'text-muted-foreground';
}

/** Timestamp shown below a step label, if applicable */
function StepTimestamp({ step, invoice, isComplete, isCurrent }: {
  step: StatusStep; invoice: Invoice; isComplete: boolean; isCurrent: boolean;
}) {
  if (isComplete && step.status === 'sent' && invoice.sentAt) {
    return <span className="text-[10px] text-muted-foreground mt-0.5">{formatDateTL(invoice.sentAt)}</span>;
  }
  if (isCurrent && step.status === 'viewed' && invoice.viewedAt) {
    return <span className="text-[10px] text-muted-foreground mt-0.5">{formatDateTL(invoice.viewedAt)}</span>;
  }
  if (isCurrent && step.status === 'paid' && invoice.paidAt) {
    return <span className="text-[10px] text-muted-foreground mt-0.5">{formatDateTL(invoice.paidAt)}</span>;
  }
  return null;
}

/** Compact dot-based timeline */
function CompactTimeline({ invoice, className, effectiveOrder }: {
  invoice: Invoice; className?: string; effectiveOrder: number;
}) {
  const isOverdue = invoice.status === 'overdue';
  const isCancelled = invoice.status === 'cancelled';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {MAIN_FLOW.map((step, index) => {
        const state = getStepState(step.status, invoice.status, effectiveOrder);
        return (
          <div key={step.status} className="flex items-center">
            <div className={cn('w-2 h-2 rounded-full transition-colors', getStepDotClass(state.isComplete, state.isCurrent, state.isOverdue, state.isPartial))} />
            {index < MAIN_FLOW.length - 1 && (
              <div className={cn('w-4 h-0.5 mx-0.5', state.isComplete ? 'bg-green-500' : 'bg-muted')} />
            )}
          </div>
        );
      })}
      {isOverdue && <AlertCircle className="h-3 w-3 text-red-500 ml-1" />}
      {isCancelled && <XCircle className="h-3 w-3 text-muted-foreground ml-1" />}
    </div>
  );
}

/** Full-size step node in the expanded timeline */
function FullTimelineStep({ step, invoice, effectiveOrder }: {
  step: StatusStep; invoice: Invoice; effectiveOrder: number;
}) {
  const { isComplete, isCurrent, isOverdue, isPartial } = getStepState(step.status, invoice.status, effectiveOrder);
  const Icon = step.icon;
  const label = isCurrent && isOverdue ? 'Overdue' : isCurrent && isPartial ? 'Partial' : step.label;

  return (
    <div className="flex flex-col items-center relative z-10">
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-all', getStepCircleClass(isComplete, isCurrent, isOverdue, isPartial))}>
        {isComplete ? <Check className="h-5 w-5" /> : isCurrent && isOverdue ? <AlertCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <span className={cn('text-xs font-medium mt-2', getStepLabelClass(isComplete, isCurrent, isOverdue, isPartial))}>
        {label}
      </span>
      <StepTimestamp step={step} invoice={invoice} isComplete={isComplete} isCurrent={isCurrent} />
    </div>
  );
}

export function InvoiceStatusTimeline({ invoice, className, compact = false }: InvoiceStatusTimelineProps) {
  const currentOrder = STATUS_ORDER[invoice.status];
  const isOverdue = invoice.status === 'overdue';
  const isCancelled = invoice.status === 'cancelled';
  const isPartial = invoice.status === 'partial';
  const effectiveOrder = isOverdue || isPartial ? 2 : currentOrder;

  if (compact) {
    return <CompactTimeline invoice={invoice} className={className} effectiveOrder={effectiveOrder} />;
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
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
        <div
          className={cn('absolute top-5 left-0 h-0.5 transition-all', isOverdue ? 'bg-red-500' : 'bg-green-500')}
          style={{ width: `${Math.min(100, (effectiveOrder / (MAIN_FLOW.length - 1)) * 100)}%` }}
        />
        {MAIN_FLOW.map((step) => (
          <FullTimelineStep key={step.status} step={step} invoice={invoice} effectiveOrder={effectiveOrder} />
        ))}
      </div>

      {isOverdue && (
        <div className="mt-4 text-center">
          <span className="text-sm text-red-600 dark:text-red-400 font-medium">
            Payment overdue since {formatDateTL(invoice.dueDate)}
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

