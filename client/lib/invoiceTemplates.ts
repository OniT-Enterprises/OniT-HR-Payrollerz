/**
 * Invoice template registry & shared payment-option helpers
 * Used by InvoicePaper (HTML preview), InvoicePDF (react-pdf), the editor,
 * and the settings page so all of them stay in sync.
 */

import type {
  Invoice,
  InvoiceSettings,
  InvoiceTemplateId,
  PaymentAccount,
  PaymentMethod,
} from '@/types/money';
import { multiplyMoney, percentOf, subtractMoney, sumMoney } from '@/lib/currency';

// ============================================
// TEMPLATES
// ============================================

export interface InvoiceTemplateMeta {
  id: InvoiceTemplateId;
  name: string;
  description: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional letterhead with a clean ruled table',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold color header with strong contrast',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Airy and understated with fine lines',
  },
];

export const DEFAULT_TEMPLATE_ID: InvoiceTemplateId = 'classic';

/** Accent color presets offered in the pickers */
export const ACCENT_COLORS: { value: string; name: string }[] = [
  { value: '#4f46e5', name: 'Indigo' },
  { value: '#6A9C29', name: 'Xefe Green' },
  { value: '#0f766e', name: 'Teal' },
  { value: '#b45309', name: 'Amber' },
  { value: '#be123c', name: 'Crimson' },
  { value: '#2648B6', name: 'Navy' },
];

export const DEFAULT_ACCENT_COLOR = ACCENT_COLORS[0].value;

export function resolveTemplateId(
  invoice?: Pick<Invoice, 'templateId'> | null,
  settings?: Partial<InvoiceSettings>
): InvoiceTemplateId {
  return invoice?.templateId || settings?.defaultTemplate || DEFAULT_TEMPLATE_ID;
}

export function resolveAccentColor(
  invoice?: Pick<Invoice, 'accentColor'> | null,
  settings?: Partial<InvoiceSettings>
): string {
  return invoice?.accentColor || settings?.accentColor || DEFAULT_ACCENT_COLOR;
}

// ============================================
// PAYMENT TERMS
// ============================================

export interface PaymentTermPreset {
  /** Days until due; null = custom due date */
  days: number | null;
  labelKey: string;
  fallbackLabel: string;
}

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  { days: 0, labelKey: 'money.invoices.termsDueOnReceipt', fallbackLabel: 'Due on receipt' },
  { days: 7, labelKey: 'money.invoices.termsNet7', fallbackLabel: 'Net 7 days' },
  { days: 14, labelKey: 'money.invoices.termsNet14', fallbackLabel: 'Net 14 days' },
  { days: 30, labelKey: 'money.invoices.termsNet30', fallbackLabel: 'Net 30 days' },
  { days: 45, labelKey: 'money.invoices.termsNet45', fallbackLabel: 'Net 45 days' },
  { days: 60, labelKey: 'money.invoices.termsNet60', fallbackLabel: 'Net 60 days' },
  { days: null, labelKey: 'money.invoices.termsCustom', fallbackLabel: 'Custom due date' },
];

/** Human label for stored payment terms, e.g. shown on the printed invoice */
export function paymentTermsLabel(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  if (days === 0) return 'Due on receipt';
  return `Net ${days} days`;
}

// ============================================
// PAYMENT METHODS
// ============================================

export interface PaymentMethodOption {
  value: PaymentMethod;
  labelKey: string;
  fallbackLabel: string;
}

/** Methods a business can accept (shown on the invoice) */
export const ACCEPTED_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'cash', labelKey: 'money.payments.cash', fallbackLabel: 'Cash' },
  { value: 'bank_transfer', labelKey: 'money.payments.bankTransfer', fallbackLabel: 'Bank Transfer' },
  { value: 'card', labelKey: 'money.payments.card', fallbackLabel: 'Card' },
  { value: 'mobile_money', labelKey: 'money.payments.mobileMoney', fallbackLabel: 'Mobile Money' },
  { value: 'check', labelKey: 'money.payments.check', fallbackLabel: 'Check' },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  const option = ACCEPTED_METHOD_OPTIONS.find((o) => o.value === method);
  if (option) return option.fallbackLabel;
  return method === 'other' ? 'Other' : method;
}

export function paymentMethodsSummary(methods?: PaymentMethod[]): string | null {
  if (!methods || methods.length === 0) return null;
  return methods.map(paymentMethodLabel).join(' · ');
}

// ============================================
// PAYMENT ACCOUNTS
// ============================================

/**
 * All payment accounts configured in settings, including the legacy single
 * bank-details fields (exposed as a synthetic "legacy" account so existing
 * tenants keep working without re-entering data).
 */
export function getSettingsPaymentAccounts(
  settings?: Partial<InvoiceSettings>
): PaymentAccount[] {
  const accounts = [...(settings?.paymentAccounts || [])];

  const hasLegacy = settings?.bankName || settings?.bankAccountNumber;
  const legacyAlreadyMigrated = accounts.some(
    (a) =>
      a.bankName === settings?.bankName &&
      a.accountNumber === settings?.bankAccountNumber
  );

  if (hasLegacy && !legacyAlreadyMigrated) {
    accounts.push({
      id: 'legacy',
      label: settings?.bankName ? `${settings.bankName} Account` : 'Bank Account',
      bankName: settings?.bankName || '',
      accountName: settings?.bankAccountName || '',
      accountNumber: settings?.bankAccountNumber || '',
    });
  }

  return accounts;
}

/**
 * The account to display on an invoice: the snapshot stored on the invoice
 * wins; otherwise fall back to the tenant default / first configured account.
 */
export function resolveInvoicePaymentAccount(
  invoice?: Pick<Invoice, 'paymentAccount'> | null,
  settings?: Partial<InvoiceSettings>
): PaymentAccount | null {
  if (invoice?.paymentAccount) return invoice.paymentAccount;

  const accounts = getSettingsPaymentAccounts(settings);
  if (accounts.length === 0) return null;

  const preferred = settings?.defaultPaymentAccountId
    ? accounts.find((a) => a.id === settings.defaultPaymentAccountId)
    : undefined;

  return preferred || accounts[0];
}

// ============================================
// LINE MATH
// ============================================

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number;
  discount?: number | null;        // percent 0-100
}

/** Net amount for one line: qty × price, less the line discount */
export function lineNetAmount(item: InvoiceLineInput): number {
  const gross = multiplyMoney(Number(item.quantity) || 0, Number(item.unitPrice) || 0);
  const rate = Number(item.discount);
  if (isNaN(rate) || rate <= 0) return gross;
  return subtractMoney(gross, percentOf(gross, rate));
}

/** Discount amount included in one line */
export function lineDiscountAmount(item: InvoiceLineInput): number {
  const gross = multiplyMoney(Number(item.quantity) || 0, Number(item.unitPrice) || 0);
  const rate = Number(item.discount);
  if (isNaN(rate) || rate <= 0) return 0;
  return percentOf(gross, rate);
}

/** Subtotal (after line discounts) + informational discount total */
export function computeLineTotals(items: InvoiceLineInput[]): {
  subtotal: number;
  discountTotal: number;
} {
  return {
    subtotal: sumMoney(items.map(lineNetAmount)),
    discountTotal: sumMoney(items.map(lineDiscountAmount)),
  };
}

// ============================================
// FORMATTING
// ============================================

export function formatInvoiceMoney(amount: number): string {
  return `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "15 Jan 2026" — compact, unambiguous, same in preview + PDF */
export function formatInvoiceDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
