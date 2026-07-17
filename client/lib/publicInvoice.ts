/**
 * Public hosted-invoice link helpers.
 *
 * The hosted page lives at /i/:token (public route, see routes.tsx). Links
 * that leave the app (email, WhatsApp) must always use the canonical domain;
 * in dev the current origin keeps the flow testable against localhost.
 */
import type { Invoice } from '@/types/money';
import { formatInvoiceDate, formatInvoiceMoney } from '@/lib/invoiceTemplates';

export const PUBLIC_BASE_URL = import.meta.env.PROD
  ? 'https://xefe.tl'
  : window.location.origin;

export function publicInvoiceUrl(token: string): string {
  return `${PUBLIC_BASE_URL}/i/${token}`;
}

/**
 * Digits-only phone for wa.me. TL mobile numbers are 8 digits starting with
 * 7 — prefix the 670 country code when it's missing so the link opens the
 * right chat instead of failing silently.
 */
function whatsAppPhone(phone: string | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('670')) return digits;
  if (digits.length === 8 && digits.startsWith('7')) return `670${digits}`;
  return digits;
}

/**
 * wa.me URL with a prefilled invoice message. Opens the customer's chat when
 * their phone is on file, otherwise WhatsApp's contact picker.
 */
export function buildInvoiceWhatsAppUrl(
  invoice: Pick<Invoice, 'invoiceNumber' | 'total' | 'balanceDue' | 'dueDate' | 'customerPhone' | 'status'>,
  url: string,
  companyName?: string,
): string {
  const from = companyName ? ` from ${companyName}` : '';
  const amount = formatInvoiceMoney(invoice.balanceDue ?? invoice.total);
  const message =
    invoice.status === 'paid'
      ? `Invoice ${invoice.invoiceNumber}${from} — PAID. Thank you!\nView it here: ${url}`
      : `Invoice ${invoice.invoiceNumber}${from}\n${amount} due ${formatInvoiceDate(invoice.dueDate)}\nView & download: ${url}`;

  const phone = whatsAppPhone(invoice.customerPhone);
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
