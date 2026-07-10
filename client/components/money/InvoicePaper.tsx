/**
 * InvoicePaper — WYSIWYG HTML invoice renderer
 *
 * Renders an invoice as a printable "paper" document in one of three
 * templates (classic / modern / minimal). Used by the invoice view screen
 * and the editor live preview; mirrors InvoicePDF so what you see on
 * screen is what the customer receives.
 *
 * NOTE: the paper deliberately uses fixed light-document colors (not theme
 * tokens) — like the PDF, an invoice document does not invert in dark mode.
 */

import type {
  InvoiceStatus,
  InvoiceSettings,
  InvoiceTemplateId,
  PaymentAccount,
  PaymentMethod,
} from '@/types/money';
import {
  resolveTemplateId,
  resolveAccentColor,
  resolveInvoicePaymentAccount,
  resolveInvoicePaymentMethods,
  paymentTermsLabel,
  paymentMethodsSummary,
  formatInvoiceMoney,
  formatInvoiceDate,
  lineNetAmount,
} from '@/lib/invoiceTemplates';

export interface InvoicePaperItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

/** Minimal shape needed to render — a full Invoice satisfies this */
export interface InvoicePaperData {
  invoiceNumber: string;
  status?: InvoiceStatus;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  items: InvoicePaperItem[];
  projectName?: string;
  poNumber?: string;
  subtotal: number;
  discountTotal?: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  notes?: string;
  terms?: string;
  templateId?: InvoiceTemplateId;
  accentColor?: string;
  paymentTermsDays?: number | null;
  paymentMethods?: PaymentMethod[];
  paymentAccount?: PaymentAccount | null;
}

interface InvoicePaperProps {
  invoice: InvoicePaperData;
  settings?: Partial<InvoiceSettings>;
  /** Force a template (e.g. hovering options in a picker) */
  templateId?: InvoiceTemplateId;
  className?: string;
}

const PAPER_TEXT = '#1f2937';
const PAPER_MUTED = '#6b7280';
const PAPER_FAINT = '#9ca3af';
const PAPER_LINE = '#e5e7eb';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(79, 70, 229, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface TemplateContext {
  invoice: InvoicePaperData;
  settings?: Partial<InvoiceSettings>;
  accent: string;
  account: PaymentAccount | null;
  termsLabel: string | null;
  methodsLabel: string | null;
}

// ============================================
// SHARED PIECES
// ============================================

function CompanyLogo({ settings, size = 56 }: { settings?: Partial<InvoiceSettings>; size?: number }) {
  if (!settings?.logoUrl) return null;
  return (
    <img
      src={settings.logoUrl}
      alt={settings.companyName || 'Company logo'}
      style={{ height: size, maxWidth: size * 3 }}
      className="object-contain object-left"
      crossOrigin="anonymous"
    />
  );
}

/** Rotated rubber-stamp for paid / draft / overdue states */
function StatusStamp({ status }: { status?: InvoiceStatus }) {
  if (!status || !['paid', 'draft', 'overdue', 'cancelled'].includes(status)) return null;
  const config: Record<string, { label: string; color: string }> = {
    paid: { label: 'PAID', color: '#16a34a' },
    draft: { label: 'DRAFT', color: '#9ca3af' },
    overdue: { label: 'OVERDUE', color: '#dc2626' },
    cancelled: { label: 'CANCELLED', color: '#9ca3af' },
  };
  const { label, color } = config[status];
  return (
    <div
      className="absolute right-8 top-24 -rotate-12 rounded-md border-4 px-4 py-1 text-2xl font-black tracking-widest opacity-40 print:opacity-40"
      style={{ borderColor: color, color }}
    >
      {label}
    </div>
  );
}

function ItemsTable({
  ctx,
  headerStyle,
  headerClassName,
  zebra,
}: {
  ctx: TemplateContext;
  headerStyle?: React.CSSProperties;
  headerClassName?: string;
  zebra?: boolean;
}) {
  const showDiscount = ctx.invoice.items.some((item) => (item.discount || 0) > 0);
  return (
    <table className="w-full text-sm" style={{ color: PAPER_TEXT }}>
      <thead>
        <tr className={headerClassName} style={headerStyle}>
          <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase tracking-wider">Description</th>
          <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-16">Qty</th>
          <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">Unit Price</th>
          {showDiscount && (
            <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-16">Disc.</th>
          )}
          <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">Amount</th>
        </tr>
      </thead>
      <tbody>
        {ctx.invoice.items.map((item, idx) => (
          <tr
            key={idx}
            style={{
              borderBottom: `1px solid ${PAPER_LINE}`,
              backgroundColor: zebra && idx % 2 === 1 ? '#f9fafb' : 'transparent',
            }}
          >
            <td className="py-3 px-3">{item.description}</td>
            <td className="py-3 px-3 text-right tabular-nums">{item.quantity}</td>
            <td className="py-3 px-3 text-right tabular-nums">{formatInvoiceMoney(item.unitPrice)}</td>
            {showDiscount && (
              <td className="py-3 px-3 text-right tabular-nums" style={{ color: PAPER_MUTED }}>
                {item.discount ? `${item.discount}%` : '—'}
              </td>
            )}
            <td className="py-3 px-3 text-right font-medium tabular-nums">
              {formatInvoiceMoney(lineNetAmount(item))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsBlock({ ctx, variant }: { ctx: TemplateContext; variant: InvoiceTemplateId }) {
  const { invoice, accent } = ctx;
  const paid = invoice.amountPaid || 0;
  const balance = invoice.balanceDue ?? invoice.total - paid;

  return (
    <div className="ml-auto w-64 space-y-1.5 text-sm" style={{ color: PAPER_TEXT }}>
      <div className="flex justify-between py-0.5">
        <span style={{ color: PAPER_MUTED }}>Subtotal</span>
        <span className="tabular-nums">{formatInvoiceMoney(invoice.subtotal)}</span>
      </div>
      {(invoice.discountTotal || 0) > 0 && (
        <div className="flex justify-between py-0.5 text-xs" style={{ color: PAPER_MUTED }}>
          <span>Includes discount of</span>
          <span className="tabular-nums">-{formatInvoiceMoney(invoice.discountTotal || 0)}</span>
        </div>
      )}
      {invoice.taxAmount > 0 && (
        <div className="flex justify-between py-0.5">
          <span style={{ color: PAPER_MUTED }}>Tax ({invoice.taxRate}%)</span>
          <span className="tabular-nums">{formatInvoiceMoney(invoice.taxAmount)}</span>
        </div>
      )}
      {variant === 'modern' ? (
        <div
          className="flex justify-between rounded-lg px-3 py-2.5 text-base font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          <span>Total</span>
          <span className="tabular-nums">{formatInvoiceMoney(invoice.total)}</span>
        </div>
      ) : (
        <div
          className={`flex justify-between pt-2 text-base font-bold ${variant === 'minimal' ? 'text-lg' : ''}`}
          style={{ borderTop: variant === 'minimal' ? `1px solid ${PAPER_TEXT}` : `2px solid ${accent}` }}
        >
          <span>Total</span>
          <span className="tabular-nums" style={{ color: variant === 'minimal' ? accent : PAPER_TEXT }}>
            {formatInvoiceMoney(invoice.total)}
          </span>
        </div>
      )}
      {paid > 0 && (
        <>
          <div className="flex justify-between py-0.5" style={{ color: '#16a34a' }}>
            <span>Paid</span>
            <span className="tabular-nums">-{formatInvoiceMoney(paid)}</span>
          </div>
          <div className="flex justify-between py-0.5 font-semibold">
            <span>Balance Due</span>
            <span className="tabular-nums">{formatInvoiceMoney(balance)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function PaymentInfoBlock({ ctx, boxed }: { ctx: TemplateContext; boxed?: boolean }) {
  const { account, termsLabel, methodsLabel, accent, invoice } = ctx;
  if (!account && !termsLabel && !methodsLabel) return null;

  const rows: { label: string; value: string }[] = [];
  if (termsLabel) rows.push({ label: 'Payment Terms', value: termsLabel });
  if (methodsLabel) rows.push({ label: 'We Accept', value: methodsLabel });
  if (account) {
    if (account.bankName) rows.push({ label: 'Bank', value: account.bankName });
    if (account.accountName) rows.push({ label: 'Account Name', value: account.accountName });
    if (account.accountNumber) rows.push({ label: 'Account Number', value: account.accountNumber });
    if (account.swiftCode) rows.push({ label: 'SWIFT', value: account.swiftCode });
    if (account.iban) rows.push({ label: 'IBAN', value: account.iban });
    if (account.bin) rows.push({ label: 'BIN', value: account.bin });
    rows.push({ label: 'Reference', value: invoice.invoiceNumber });
  }

  return (
    <div
      className={boxed ? 'rounded-lg p-4' : 'pt-4'}
      style={
        boxed
          ? { backgroundColor: hexToRgba(accent, 0.06), border: `1px solid ${hexToRgba(accent, 0.25)}` }
          : { borderTop: `1px solid ${PAPER_LINE}` }
      }
    >
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: boxed ? accent : PAPER_MUTED }}>
        Payment Details
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-xs">
            <span className="w-28 shrink-0" style={{ color: PAPER_MUTED }}>
              {row.label}
            </span>
            <span className="font-medium" style={{ color: PAPER_TEXT }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesBlock({ ctx }: { ctx: TemplateContext }) {
  const { invoice } = ctx;
  if (!invoice.notes && !invoice.terms) return null;
  return (
    <div className="space-y-3 pt-4 text-xs" style={{ borderTop: `1px solid ${PAPER_LINE}` }}>
      {invoice.notes && (
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: PAPER_MUTED }}>
            Notes
          </p>
          <p className="whitespace-pre-line" style={{ color: PAPER_MUTED }}>{invoice.notes}</p>
        </div>
      )}
      {invoice.terms && (
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: PAPER_MUTED }}>
            Terms & Conditions
          </p>
          <p className="whitespace-pre-line" style={{ color: PAPER_MUTED }}>{invoice.terms}</p>
        </div>
      )}
    </div>
  );
}

/** Thank-you line; minimal template shows it only when explicitly configured */
function PaperFooter({ ctx, showDefault = true }: { ctx: TemplateContext; showDefault?: boolean }) {
  const message = ctx.settings?.footerMessage || (showDefault ? 'Thank you for your business!' : null);
  if (!message) return null;
  return (
    <p className="pt-2 text-center text-xs" style={{ color: PAPER_FAINT }}>
      {message}
    </p>
  );
}

function CompanyDetails({ settings, light }: { settings?: Partial<InvoiceSettings>; light?: boolean }) {
  const muted = light ? 'rgba(255,255,255,0.85)' : PAPER_MUTED;
  return (
    <div className="space-y-0.5 text-xs" style={{ color: muted }}>
      {settings?.companyAddress && <p className="whitespace-pre-line">{settings.companyAddress}</p>}
      {settings?.companyPhone && <p>Tel: {settings.companyPhone}</p>}
      {settings?.companyEmail && <p>{settings.companyEmail}</p>}
      {settings?.companyTin && <p>TIN: {settings.companyTin}</p>}
    </div>
  );
}

function BillTo({ ctx }: { ctx: TemplateContext }) {
  const { invoice } = ctx;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: PAPER_MUTED }}>
        Bill To
      </p>
      <p className="text-sm font-semibold" style={{ color: PAPER_TEXT }}>{invoice.customerName}</p>
      <div className="mt-0.5 space-y-0.5 text-xs" style={{ color: PAPER_MUTED }}>
        {invoice.customerAddress && <p className="whitespace-pre-line">{invoice.customerAddress}</p>}
        {invoice.customerPhone && <p>{invoice.customerPhone}</p>}
        {invoice.customerEmail && <p>{invoice.customerEmail}</p>}
      </div>
    </div>
  );
}

function MetaRows({ ctx, align = 'right' }: { ctx: TemplateContext; align?: 'left' | 'right' }) {
  const { invoice, termsLabel } = ctx;
  const rows = [
    { label: 'Issue Date', value: formatInvoiceDate(invoice.issueDate) },
    { label: 'Due Date', value: formatInvoiceDate(invoice.dueDate) },
    ...(termsLabel ? [{ label: 'Terms', value: termsLabel }] : []),
    ...(invoice.projectName ? [{ label: 'Project', value: invoice.projectName }] : []),
    ...(invoice.poNumber ? [{ label: 'Ref / PO', value: invoice.poNumber }] : []),
  ];
  return (
    <div className={`space-y-1 text-xs ${align === 'right' ? 'text-right' : ''}`}>
      {rows.map((row) => (
        <div key={row.label} className={`flex gap-3 ${align === 'right' ? 'justify-end' : ''}`}>
          <span style={{ color: PAPER_MUTED }}>{row.label}</span>
          <span className="w-24 font-semibold tabular-nums" style={{ color: PAPER_TEXT }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// TEMPLATE: CLASSIC
// ============================================

function ClassicTemplate({ ctx }: { ctx: TemplateContext }) {
  const { invoice, settings, accent } = ctx;
  return (
    <div className="space-y-6 p-8 sm:p-10">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <CompanyLogo settings={settings} />
          <p className="text-lg font-bold" style={{ color: PAPER_TEXT }}>
            {settings?.companyName || 'Your Company Name'}
          </p>
          <CompanyDetails settings={settings} />
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: accent }}>
            INVOICE
          </h2>
          <p className="mt-1 font-mono text-sm" style={{ color: PAPER_MUTED }}>
            {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      <div style={{ borderBottom: `3px solid ${accent}` }} />

      <div className="flex items-start justify-between gap-6">
        <BillTo ctx={ctx} />
        <MetaRows ctx={ctx} />
      </div>

      <ItemsTable
        ctx={ctx}
        headerStyle={{ borderBottom: `2px solid ${accent}`, color: PAPER_TEXT }}
      />

      <TotalsBlock ctx={ctx} variant="classic" />
      <PaymentInfoBlock ctx={ctx} />
      <NotesBlock ctx={ctx} />
      <PaperFooter ctx={ctx} />
    </div>
  );
}

// ============================================
// TEMPLATE: MODERN
// ============================================

function ModernTemplate({ ctx }: { ctx: TemplateContext }) {
  const { invoice, settings, accent } = ctx;
  return (
    <div>
      <div className="flex items-start justify-between gap-6 p-8 sm:p-10" style={{ backgroundColor: accent }}>
        <div className="space-y-2">
          {settings?.logoUrl && (
            <div className="inline-block rounded-lg bg-white p-2">
              <CompanyLogo settings={settings} size={44} />
            </div>
          )}
          <p className="text-lg font-bold text-white">
            {settings?.companyName || 'Your Company Name'}
          </p>
          <CompanyDetails settings={settings} light />
        </div>
        <div className="text-right text-white">
          <h2 className="text-3xl font-bold tracking-tight">INVOICE</h2>
          <p className="mt-1 font-mono text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      <div className="space-y-6 p-8 sm:p-10">
        <div className="flex items-start justify-between gap-6">
          <div className="rounded-lg p-4" style={{ backgroundColor: '#f9fafb' }}>
            <BillTo ctx={ctx} />
          </div>
          <MetaRows ctx={ctx} />
        </div>

        <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${PAPER_LINE}` }}>
          <ItemsTable
            ctx={ctx}
            headerStyle={{ backgroundColor: accent, color: '#ffffff' }}
            zebra
          />
        </div>

        <TotalsBlock ctx={ctx} variant="modern" />
        <PaymentInfoBlock ctx={ctx} boxed />
        <NotesBlock ctx={ctx} />
        <PaperFooter ctx={ctx} />
      </div>
    </div>
  );
}

// ============================================
// TEMPLATE: MINIMAL
// ============================================

function MinimalTemplate({ ctx }: { ctx: TemplateContext }) {
  const { invoice, settings, accent } = ctx;
  return (
    <div className="space-y-8 p-8 sm:p-12">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <CompanyLogo settings={settings} size={44} />
          <div>
            <p className="text-sm font-semibold" style={{ color: PAPER_TEXT }}>
              {settings?.companyName || 'Your Company Name'}
            </p>
            <CompanyDetails settings={settings} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: PAPER_MUTED }}>
            Invoice
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: accent }}>
            {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-6 pt-2" style={{ borderTop: `1px solid ${PAPER_LINE}` }}>
        <BillTo ctx={ctx} />
        <MetaRows ctx={ctx} />
      </div>

      <ItemsTable
        ctx={ctx}
        headerStyle={{ borderBottom: `1px solid ${PAPER_TEXT}`, color: PAPER_MUTED }}
      />

      <TotalsBlock ctx={ctx} variant="minimal" />
      <PaymentInfoBlock ctx={ctx} />
      <NotesBlock ctx={ctx} />
      <PaperFooter ctx={ctx} showDefault={false} />
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InvoicePaper({ invoice, settings, templateId, className = '' }: InvoicePaperProps) {
  const resolved = templateId || resolveTemplateId(invoice, settings);
  const accent = resolveAccentColor(invoice, settings);
  const account = resolveInvoicePaymentAccount(invoice, settings);

  const ctx: TemplateContext = {
    invoice,
    settings,
    accent,
    account,
    termsLabel: paymentTermsLabel(invoice.paymentTermsDays),
    methodsLabel: paymentMethodsSummary(resolveInvoicePaymentMethods(invoice, settings)),
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 ${className}`}
      style={{
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: PAPER_TEXT,
      }}
    >
      <StatusStamp status={invoice.status} />
      {resolved === 'modern' && <ModernTemplate ctx={ctx} />}
      {resolved === 'minimal' && <MinimalTemplate ctx={ctx} />}
      {resolved === 'classic' && <ClassicTemplate ctx={ctx} />}
    </div>
  );
}

export default InvoicePaper;
