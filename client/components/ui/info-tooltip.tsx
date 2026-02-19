/**
 * InfoTooltip - Reusable info icon with tooltip for explaining UI elements
 * Used across the Money section to help users understand financial terms,
 * calculations, and TL-specific features.
 */

import * as React from 'react';
import { HelpCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  /** The explanation text to show in the tooltip */
  content: React.ReactNode;
  /** Optional title for the tooltip */
  title?: string;
  /** Icon variant: 'info' (default) or 'help' */
  variant?: 'info' | 'help';
  /** Size of the icon */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className for the icon */
  className?: string;
  /** Side of the trigger to display tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Max width of the tooltip content */
  maxWidth?: number;
}

const sizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function InfoTooltip({
  content,
  title,
  variant = 'info',
  size = 'sm',
  className,
  side = 'top',
  maxWidth = 280,
}: InfoTooltipProps) {
  const Icon = variant === 'help' ? HelpCircle : Info;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={cn(
              'inline-flex items-center justify-center rounded-full cursor-help',
              'text-muted-foreground hover:text-foreground transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
            aria-label={title || 'More information'}
          >
            <Icon className={cn(sizeMap[size], 'shrink-0')} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="text-left"
          style={{ maxWidth: `${maxWidth}px` }}
        >
          {title && (
            <p className="font-semibold text-sm mb-1">{title}</p>
          )}
          <div className="text-xs leading-relaxed">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * InfoLabel - A label with an integrated info tooltip
 * Useful for form fields and data displays
 */
interface InfoLabelProps {
  /** The main label text */
  label: string;
  /** Tooltip content */
  tooltip: React.ReactNode;
  /** Optional tooltip title */
  tooltipTitle?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Additional className for the label */
  className?: string;
  /** HTML for attribute */
  htmlFor?: string;
}

export function InfoLabel({
  label,
  tooltip,
  tooltipTitle,
  required,
  className,
  htmlFor,
}: InfoLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        'flex items-center gap-1.5',
        className
      )}
    >
      {label}
      {required && <span className="text-destructive">*</span>}
      <InfoTooltip content={tooltip} title={tooltipTitle} />
    </label>
  );
}

/**
 * Pre-defined tooltip content for common financial terms
 * Provides consistent explanations across the Money section
 */
// eslint-disable-next-line react-refresh/only-export-components
export const MoneyTooltips = {
  // Invoice statuses
  invoiceStatus: {
    draft: 'Not yet sent to customer. Can be freely edited or deleted.',
    sent: 'Invoice has been sent to the customer and is awaiting payment.',
    viewed: 'Customer has opened the invoice link (tracked automatically).',
    partial: 'Customer has made a partial payment. Remaining balance is still due.',
    paid: 'Full payment received. Invoice is complete.',
    overdue: 'Payment due date has passed without full payment.',
    cancelled: 'Invoice has been voided. No payment expected.',
  },

  // Aging buckets
  aging: {
    current: 'Invoices due within the next 30 days. These are on track for payment.',
    days30to60: 'Invoices 31-60 days past due. Consider sending a reminder.',
    days60to90: 'Invoices 61-90 days past due. Follow up with customer directly.',
    over90: 'Invoices over 90 days past due. High risk of non-payment. May need collection action.',
  },

  // Financial terms
  terms: {
    receivables: 'Money owed TO your business by customers for goods or services delivered.',
    payables: 'Money your business OWES to vendors and suppliers.',
    arAging: 'Accounts Receivable Aging shows how long invoices have been outstanding, helping identify collection priorities.',
    apAging: 'Accounts Payable Aging shows how long you\'ve owed vendors, helping manage payment schedules.',
    balanceDue: 'The remaining amount to be paid after any partial payments.',
    netAmount: 'Total after tax. This is what the customer owes.',
    grossAmount: 'Subtotal before tax is applied.',
    dueDate: 'The date by which payment should be received to avoid being marked overdue.',
  },

  // Payment methods (TL-specific)
  paymentMethods: {
    cash: 'Physical currency payment. Most common in TL for local transactions.',
    bankTransfer: 'Electronic transfer via TL banks (BNU, BNCTL, Mandiri, ANZ).',
    mobileMoney: 'Digital payment via Telemor or Telkomcel mobile money services.',
    check: 'Paper check. Less common in TL, may require longer clearing time.',
  },

  // Recurring invoices
  recurring: {
    frequency: 'How often a new invoice is automatically generated from this template.',
    nextRunDate: 'When the next invoice will be automatically created.',
    endCondition: 'When this recurring series will stop generating new invoices.',
    autoSend: 'If enabled, invoices are automatically marked as sent when generated.',
  },

  // Calculations
  calculations: {
    subtotal: 'Sum of all line items (quantity × unit price for each item).',
    taxAmount: 'Tax calculated on the subtotal. TL standard rate is 10% sales tax.',
    total: 'Subtotal + Tax. The final amount the customer needs to pay.',
    amountPaid: 'Sum of all payments received for this invoice.',
    balanceRemaining: 'Total minus Amount Paid. What\'s still owed.',
  },

  // Dashboard metrics
  dashboard: {
    totalReceivables: 'Total amount owed to you across all unpaid invoices.',
    totalPayables: 'Total amount you owe across all unpaid bills.',
    cashFlow: 'Money in (customer payments) vs money out (bills, expenses). Positive = more coming in than going out.',
    overdueAmount: 'Total of all invoices past their due date. Requires follow-up.',
  },

  // Bills & Expenses
  bills: {
    vendor: 'The company or person you owe money to.',
    expense: 'A one-time cost that\'s already been paid (no invoice involved).',
    bill: 'An invoice from a vendor that you need to pay.',
    dueThisWeek: 'Bills with due dates within the next 7 days.',
  },

  // TL-Specific
  tlSpecific: {
    taxRate: 'Timor-Leste uses a flat 10% sales tax (Imposto sobre Vendas) on most goods and services.',
    currency: 'TL uses USD as official currency. All amounts are in US Dollars.',
    inss: 'Social security contributions (INSS) - 4% employee, 6% employer.',
    banks: 'Common TL banks: BNU (Banco Nacional Ultramarino), BNCTL (Central Bank), Mandiri, ANZ.',
  },
} as const;

export default InfoTooltip;
