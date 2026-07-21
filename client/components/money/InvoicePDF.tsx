/* eslint-disable react-refresh/only-export-components */
/**
 * Invoice PDF Generator
 * Uses @react-pdf/renderer to create downloadable invoice documents.
 * Renders one of three templates (classic / modern / minimal) and mirrors
 * the on-screen InvoicePaper component so preview === PDF.
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { Invoice, InvoiceSettings, InvoiceTemplateId, PaymentAccount } from '@/types/money';
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
import { subtractMoney } from '@/lib/currency';
import { invoiceTaxRateLabel } from '@/components/money/InvoicePaper';

const TEXT = '#1f2937';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(79, 70, 229, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Layout styles that don't depend on the accent color
const base = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: TEXT,
  },
  body: {
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  logo: {
    height: 40,
    maxWidth: 130,
    objectFit: 'contain',
    objectPositionX: 0,
    marginBottom: 8,
  },
  companyName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  companyDetail: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 1.5,
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 10,
    color: MUTED,
    textAlign: 'right',
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 9,
    color: MUTED,
    marginRight: 8,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    width: 70,
    textAlign: 'right',
  },
  customerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 1.5,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  cell: { fontSize: 9.5 },
  descCol: { width: '50%' },
  qtyCol: { width: '12%', textAlign: 'right' },
  priceCol: { width: '19%', textAlign: 'right' },
  amountCol: { width: '19%', textAlign: 'right' },
  // Column set when a line discount is present
  descColD: { width: '42%' },
  qtyColD: { width: '10%', textAlign: 'right' },
  priceColD: { width: '17%', textAlign: 'right' },
  discColD: { width: '13%', textAlign: 'right' },
  amountColD: { width: '18%', textAlign: 'right' },
  totalsBox: { width: 220, marginLeft: 'auto', marginTop: 14 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3.5,
  },
  totalLabel: { fontSize: 9.5, color: MUTED },
  totalValue: { fontSize: 9.5 },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentItem: {
    flexDirection: 'row',
    width: '50%',
    marginBottom: 3,
    paddingRight: 8,
  },
  paymentLabel: { fontSize: 8.5, color: MUTED, width: 85 },
  paymentValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', flex: 1 },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  notesText: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  footer: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 8,
    color: FAINT,
  },
  stamp: {
    position: 'absolute',
    top: 100,
    right: 40,
    transform: 'rotate(-12deg)',
    borderWidth: 3,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 10,
    opacity: 0.4,
  },
  stampText: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
  },
});

interface PdfContext {
  invoice: Invoice;
  settings?: Partial<InvoiceSettings>;
  accent: string;
  logoSrc?: string;
  account: PaymentAccount | null;
  termsLabel: string | null;
  methodsLabel: string | null;
}

// ============================================
// SHARED SECTIONS
// ============================================

function StatusStamp({ invoice }: { invoice: Invoice }) {
  const config: Record<string, { label: string; color: string }> = {
    paid: { label: 'PAID', color: '#16a34a' },
    credited: { label: 'CREDITED', color: '#2563eb' },
    draft: { label: 'DRAFT', color: '#9ca3af' },
    overdue: { label: 'OVERDUE', color: '#dc2626' },
    cancelled: { label: 'CANCELLED', color: '#9ca3af' },
  };
  const stamp = config[invoice.status];
  if (!stamp) return null;
  return (
    <View style={[base.stamp, { borderColor: stamp.color }]}>
      <Text style={[base.stampText, { color: stamp.color }]}>{stamp.label}</Text>
    </View>
  );
}

function CompanyBlock({ ctx, light }: { ctx: PdfContext; light?: boolean }) {
  const { invoice, settings, logoSrc } = ctx;
  const detailColor = light ? 'rgba(255,255,255,0.85)' : MUTED;
  const nameColor = light ? '#ffffff' : TEXT;
  const taxId = invoice.supplierVatId || settings?.vatRegistrationNumber || settings?.companyTin;
  return (
    <View style={{ maxWidth: 260 }}>
      {logoSrc && (
        light ? (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginBottom: 8 }}>
            <Image src={logoSrc} style={[base.logo, { marginBottom: 0, height: 32 }]} />
          </View>
        ) : (
          <Image src={logoSrc} style={base.logo} />
        )
      )}
      <Text style={[base.companyName, { color: nameColor }]}>
        {settings?.companyName || 'Your Company Name'}
      </Text>
      {settings?.companyAddress && (
        <Text style={[base.companyDetail, { color: detailColor }]}>{settings.companyAddress}</Text>
      )}
      {settings?.companyPhone && (
        <Text style={[base.companyDetail, { color: detailColor }]}>Tel: {settings.companyPhone}</Text>
      )}
      {settings?.companyEmail && (
        <Text style={[base.companyDetail, { color: detailColor }]}>{settings.companyEmail}</Text>
      )}
      {taxId && (
        <Text style={[base.companyDetail, { color: detailColor }]}>
          {invoice.isVATInvoice ? 'VAT / TIN' : 'TIN'}: {taxId}
        </Text>
      )}
    </View>
  );
}

function BillToBlock({ ctx }: { ctx: PdfContext }) {
  const { invoice } = ctx;
  return (
    <View style={{ maxWidth: 240 }}>
      <Text style={base.label}>Bill To</Text>
      <Text style={base.customerName}>{invoice.customerName}</Text>
      {invoice.customerAddress && <Text style={base.customerDetail}>{invoice.customerAddress}</Text>}
      {invoice.customerPhone && <Text style={base.customerDetail}>{invoice.customerPhone}</Text>}
      {invoice.customerEmail && <Text style={base.customerDetail}>{invoice.customerEmail}</Text>}
      {invoice.customerVatId && <Text style={base.customerDetail}>VAT / TIN: {invoice.customerVatId}</Text>}
    </View>
  );
}

function MetaBlock({ ctx }: { ctx: PdfContext }) {
  const { invoice, termsLabel } = ctx;
  const rows = [
    { label: 'Issue Date', value: formatInvoiceDate(invoice.issueDate) },
    { label: 'Due Date', value: formatInvoiceDate(invoice.dueDate) },
    ...(termsLabel ? [{ label: 'Terms', value: termsLabel }] : []),
    ...(invoice.projectName ? [{ label: 'Project', value: invoice.projectName }] : []),
    ...(invoice.poNumber ? [{ label: 'Ref / PO', value: invoice.poNumber }] : []),
  ];
  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={base.metaRow}>
          <Text style={base.metaLabel}>{row.label}</Text>
          <Text style={base.metaValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ItemsTable({
  ctx,
  headerStyle,
  headerTextColor,
  zebra,
}: {
  ctx: PdfContext;
  headerStyle: Style;
  headerTextColor: string;
  zebra?: boolean;
}) {
  const showDiscount = ctx.invoice.items.some((item) => (item.discount || 0) > 0);
  const cols = showDiscount
    ? { desc: base.descColD, qty: base.qtyColD, price: base.priceColD, amount: base.amountColD }
    : { desc: base.descCol, qty: base.qtyCol, price: base.priceCol, amount: base.amountCol };

  return (
    <View>
      <View style={[{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8 }, headerStyle]}>
        <Text style={[base.tableHeaderText, cols.desc, { color: headerTextColor }]}>Description</Text>
        <Text style={[base.tableHeaderText, cols.qty, { color: headerTextColor }]}>Qty</Text>
        <Text style={[base.tableHeaderText, cols.price, { color: headerTextColor }]}>Unit Price</Text>
        {showDiscount && (
          <Text style={[base.tableHeaderText, base.discColD, { color: headerTextColor }]}>Disc.</Text>
        )}
        <Text style={[base.tableHeaderText, cols.amount, { color: headerTextColor }]}>Amount</Text>
      </View>
      {ctx.invoice.items.map((item, index) => (
        <View
          key={index}
          style={[base.tableRow, zebra && index % 2 === 1 ? { backgroundColor: '#f9fafb' } : {}]}
          wrap={false}
        >
          <Text style={[base.cell, cols.desc]}>{item.description}</Text>
          <Text style={[base.cell, cols.qty]}>{item.quantity}</Text>
          <Text style={[base.cell, cols.price]}>{formatInvoiceMoney(item.unitPrice)}</Text>
          {showDiscount && (
            <Text style={[base.cell, base.discColD, { color: MUTED }]}>
              {item.discount ? `${item.discount}%` : '—'}
            </Text>
          )}
          <Text style={[base.cell, cols.amount, { fontFamily: 'Helvetica-Bold' }]}>
            {formatInvoiceMoney(lineNetAmount(item))}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TotalsBlock({ ctx, variant }: { ctx: PdfContext; variant: InvoiceTemplateId }) {
  const { invoice, accent } = ctx;
  const paid = invoice.amountPaid || 0;
  const credited = invoice.creditedAmount || 0;
  const balance = invoice.balanceDue ?? subtractMoney(invoice.total, paid, credited);

  return (
    <View style={base.totalsBox}>
      <View style={base.totalRow}>
        <Text style={base.totalLabel}>Subtotal</Text>
        <Text style={base.totalValue}>{formatInvoiceMoney(invoice.subtotal)}</Text>
      </View>
      {(invoice.discountTotal || 0) > 0 && (
        <View style={base.totalRow}>
          <Text style={[base.totalLabel, { fontSize: 8.5 }]}>Includes discount of</Text>
          <Text style={[base.totalValue, { fontSize: 8.5, color: MUTED }]}>
            -{formatInvoiceMoney(invoice.discountTotal || 0)}
          </Text>
        </View>
      )}
      {invoice.taxAmount > 0 && (
        <View style={base.totalRow}>
          <Text style={base.totalLabel}>{invoiceTaxRateLabel(invoice.items, invoice.taxRate)}</Text>
          <Text style={base.totalValue}>{formatInvoiceMoney(invoice.taxAmount)}</Text>
        </View>
      )}
      {variant === 'modern' ? (
        <View
          style={[base.totalRow, {
            backgroundColor: accent,
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginTop: 3,
          }]}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' }}>Total</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#ffffff' }}>
            {formatInvoiceMoney(invoice.total)}
          </Text>
        </View>
      ) : (
        <View
          style={[base.totalRow, {
            borderTopWidth: variant === 'minimal' ? 1 : 2,
            borderTopColor: variant === 'minimal' ? TEXT : accent,
            marginTop: 3,
            paddingTop: 6,
          }]}
        >
          <Text style={{ fontSize: 11.5, fontFamily: 'Helvetica-Bold' }}>Total</Text>
          <Text style={{ fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: variant === 'minimal' ? accent : TEXT }}>
            {formatInvoiceMoney(invoice.total)}
          </Text>
        </View>
      )}
      {paid > 0 && (
        <View style={base.totalRow}>
          <Text style={[base.totalLabel, { color: '#16a34a' }]}>Paid</Text>
          <Text style={[base.totalValue, { color: '#16a34a' }]}>-{formatInvoiceMoney(paid)}</Text>
        </View>
      )}
      {credited > 0 && (
        <View style={base.totalRow}>
          <Text style={[base.totalLabel, { color: '#2563eb' }]}>Credit notes</Text>
          <Text style={[base.totalValue, { color: '#2563eb' }]}>-{formatInvoiceMoney(credited)}</Text>
        </View>
      )}
      {(paid > 0 || credited > 0) && (
        <View style={base.totalRow}>
          <Text style={[base.totalLabel, { fontFamily: 'Helvetica-Bold', color: TEXT }]}>Balance Due</Text>
          <Text style={[base.totalValue, { fontFamily: 'Helvetica-Bold' }]}>{formatInvoiceMoney(balance)}</Text>
        </View>
      )}
    </View>
  );
}

function PaymentInfoBlock({ ctx, boxed }: { ctx: PdfContext; boxed?: boolean }) {
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
    <View
      wrap={false}
      style={
        boxed
          ? {
              marginTop: 16,
              padding: 12,
              borderRadius: 6,
              backgroundColor: rgba(accent, 0.06),
              borderWidth: 1,
              borderColor: rgba(accent, 0.25),
            }
          : { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE }
      }
    >
      <Text style={[base.label, boxed ? { color: accent } : {}]}>Payment Details</Text>
      <View style={base.paymentGrid}>
        {rows.map((row) => (
          <View key={row.label} style={base.paymentItem}>
            <Text style={base.paymentLabel}>{row.label}</Text>
            <Text style={base.paymentValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NotesBlock({ ctx }: { ctx: PdfContext }) {
  const { invoice } = ctx;
  if (!invoice.notes && !invoice.terms) return null;
  return (
    <View wrap={false} style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE }}>
      {invoice.notes && (
        <View style={{ marginBottom: invoice.terms ? 8 : 0 }}>
          <Text style={base.notesTitle}>Notes</Text>
          <Text style={base.notesText}>{invoice.notes}</Text>
        </View>
      )}
      {invoice.terms && (
        <View>
          <Text style={base.notesTitle}>Terms & Conditions</Text>
          <Text style={base.notesText}>{invoice.terms}</Text>
        </View>
      )}
    </View>
  );
}

function FooterNote({ ctx, showDefault = true }: { ctx: PdfContext; showDefault?: boolean }) {
  const { settings } = ctx;
  const message = settings?.footerMessage || (showDefault ? 'Thank you for your business!' : null);
  if (!message) return null;
  return (
    <Text style={base.footer}>
      {message}
      {settings?.companyEmail ? `  ·  Questions? Contact ${settings.companyEmail}` : ''}
    </Text>
  );
}

// ============================================
// TEMPLATES
// ============================================

function ClassicTemplate({ ctx }: { ctx: PdfContext }) {
  const { invoice, accent } = ctx;
  return (
    <Page size="LETTER" style={[base.page, { paddingTop: 40 }]}>
      <View style={base.body}>
        <View style={base.rowBetween}>
          <CompanyBlock ctx={ctx} />
          <View>
            <Text style={[base.invoiceTitle, { color: accent }]}>
              {invoice.isVATInvoice ? 'VAT INVOICE' : 'INVOICE'}
            </Text>
            <Text style={base.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 3, borderBottomColor: accent, marginTop: 16, marginBottom: 20 }} />

        <View style={[base.rowBetween, { marginBottom: 20 }]}>
          <BillToBlock ctx={ctx} />
          <MetaBlock ctx={ctx} />
        </View>

        <ItemsTable
          ctx={ctx}
          headerStyle={{ borderBottomWidth: 2, borderBottomColor: accent }}
          headerTextColor={TEXT}
        />
        <TotalsBlock ctx={ctx} variant="classic" />
        <PaymentInfoBlock ctx={ctx} />
        <NotesBlock ctx={ctx} />
        <FooterNote ctx={ctx} />
      </View>
      <StatusStamp invoice={invoice} />
    </Page>
  );
}

function ModernTemplate({ ctx }: { ctx: PdfContext }) {
  const { invoice, accent } = ctx;
  return (
    <Page size="LETTER" style={base.page}>
      <View
        style={{
          backgroundColor: accent,
          paddingHorizontal: 40,
          paddingVertical: 28,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <CompanyBlock ctx={ctx} light />
        <View>
          <Text style={[base.invoiceTitle, { color: '#ffffff' }]}>
            {invoice.isVATInvoice ? 'VAT INVOICE' : 'INVOICE'}
          </Text>
          <Text style={[base.invoiceNumber, { color: 'rgba(255,255,255,0.85)' }]}>
            {invoice.invoiceNumber}
          </Text>
        </View>
      </View>

      <View style={[base.body, { paddingTop: 24 }]}>
        <View style={[base.rowBetween, { marginBottom: 20 }]}>
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 6, padding: 12 }}>
            <BillToBlock ctx={ctx} />
          </View>
          <MetaBlock ctx={ctx} />
        </View>

        <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: 'hidden' }}>
          <ItemsTable
            ctx={ctx}
            headerStyle={{ backgroundColor: accent }}
            headerTextColor="#ffffff"
            zebra
          />
        </View>
        <TotalsBlock ctx={ctx} variant="modern" />
        <PaymentInfoBlock ctx={ctx} boxed />
        <NotesBlock ctx={ctx} />
        <FooterNote ctx={ctx} />
      </View>
      <StatusStamp invoice={invoice} />
    </Page>
  );
}

function MinimalTemplate({ ctx }: { ctx: PdfContext }) {
  const { invoice, accent } = ctx;
  return (
    <Page size="LETTER" style={[base.page, { paddingTop: 48 }]}>
      <View style={[base.body, { paddingHorizontal: 52 }]}>
        <View style={base.rowBetween}>
          <CompanyBlock ctx={ctx} />
          <View>
            <Text style={[base.label, { textAlign: 'right', letterSpacing: 2 }]}>
              {invoice.isVATInvoice ? 'VAT Invoice' : 'Invoice'}
            </Text>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: accent, textAlign: 'right' }}>
              {invoice.invoiceNumber}
            </Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: LINE, marginTop: 20, marginBottom: 20 }} />

        <View style={[base.rowBetween, { marginBottom: 24 }]}>
          <BillToBlock ctx={ctx} />
          <MetaBlock ctx={ctx} />
        </View>

        <ItemsTable
          ctx={ctx}
          headerStyle={{ borderBottomWidth: 1, borderBottomColor: TEXT }}
          headerTextColor={MUTED}
        />
        <TotalsBlock ctx={ctx} variant="minimal" />
        <PaymentInfoBlock ctx={ctx} />
        <NotesBlock ctx={ctx} />
        <FooterNote ctx={ctx} showDefault={false} />
      </View>
      <StatusStamp invoice={invoice} />
    </Page>
  );
}

// ============================================
// DOCUMENT + EXPORTS
// ============================================

interface InvoicePDFProps {
  invoice: Invoice;
  settings?: Partial<InvoiceSettings>;
  /**
   * Pre-fetched logo as a PNG data URL. Raw URLs are deliberately NOT used:
   * react-pdf fetching a URL that fails (or a format it can't decode, like
   * webp/svg) rejects or silently drops the whole image.
   */
  logoSrc?: string;
}

const InvoiceDocument = ({ invoice, settings, logoSrc }: InvoicePDFProps) => {
  const templateId = resolveTemplateId(invoice, settings);
  const ctx: PdfContext = {
    invoice,
    settings,
    accent: resolveAccentColor(invoice, settings),
    logoSrc,
    account: resolveInvoicePaymentAccount(invoice, settings),
    termsLabel: paymentTermsLabel(invoice.paymentTermsDays),
    methodsLabel: paymentMethodsSummary(resolveInvoicePaymentMethods(invoice, settings)),
  };

  return (
    <Document title={invoice.invoiceNumber}>
      {templateId === 'modern' && <ModernTemplate ctx={ctx} />}
      {templateId === 'minimal' && <MinimalTemplate ctx={ctx} />}
      {templateId === 'classic' && <ClassicTemplate ctx={ctx} />}
    </Document>
  );
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // document.createElement — `Image` here is react-pdf's component, not the DOM constructor
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Fetch the company logo and normalize it to a PNG data URL so PDF
 * generation never fails on image loading. react-pdf can only decode
 * png/jpg — webp and svg logos (which the app happily displays via <img>)
 * are rasterized through a canvas first.
 */
async function fetchLogoAsPngDataUrl(logoUrl?: string): Promise<string | undefined> {
  if (!logoUrl) return undefined;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      console.warn(`Invoice PDF: logo fetch returned ${response.status}; generating without logo`);
      return undefined;
    }
    const blob = await response.blob();
    if (/image\/(png|jpe?g)/.test(blob.type)) {
      return await blobToDataUrl(blob);
    }

    // webp / svg / anything else — rasterize to PNG. Loading from a data URL
    // keeps the canvas untainted regardless of storage CORS headers.
    const sourceDataUrl = await blobToDataUrl(blob);
    const img = await loadHtmlImage(sourceDataUrl);
    const width = img.naturalWidth || 600;
    const height = img.naturalHeight || 200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Invoice PDF: could not load company logo; generating without it', error);
    return undefined;
  }
}

/**
 * Generate invoice PDF as blob (for preview or email attachment)
 */
export const generateInvoiceBlob = async (
  invoice: Invoice,
  settings?: Partial<InvoiceSettings>
): Promise<Blob> => {
  const logoSrc = await fetchLogoAsPngDataUrl(settings?.logoUrl);
  const doc = <InvoiceDocument invoice={invoice} settings={settings} logoSrc={logoSrc} />;
  return await pdf(doc).toBlob();
};

/**
 * Generate and download an invoice PDF
 */

export const downloadInvoicePDF = async (
  invoice: Invoice,
  settings?: Partial<InvoiceSettings>
): Promise<void> => {
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const blob = await generateInvoiceBlob(invoice, settings);
  downloadBlob(blob, `${invoice.invoiceNumber}.pdf`);
};
