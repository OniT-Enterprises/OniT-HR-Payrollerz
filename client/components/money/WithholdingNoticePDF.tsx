/**
 * Withholding Tax Notice PDF (Law 8/2008 Sec. 58.2)
 *
 * Supplier-facing, one-page notice the payer issues at the time of payment,
 * setting out the payment made and the tax withheld. Built from the frozen
 * TLBillWithholdingSnapshot stored on the bill payment, so the figures always
 * match the settlement that was actually posted. Portuguese primary, English
 * secondary. This is Xefe's own layout — Sec. 58.2 prescribes no official
 * form (see the PROVENANCE policy in docs/ACCOUNTING_AUTOMATIONS.md).
 *
 * Uses @react-pdf/renderer, following WITReturnPDF/InvoicePDF conventions.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type {
  TLBillWithholdingCategory,
  TLWithholdingNoticeData,
} from '@/lib/tax/bill-withholding';
import type { CompanyDetails } from '@/types/settings';

const TEXT = '#1f2937';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';
const ACCENT = '#6A9C29';

// PT primary / EN secondary labels for the frozen withholding categories.
// Kept in sync with money.bills.withholdingCategories in the i18n locales.
const CATEGORY_LABELS: Record<
  TLBillWithholdingCategory,
  { pt: string; en: string }
> = {
  general_service: {
    pt: 'Serviço geral — não residente',
    en: 'General service — non-resident',
  },
  construction: {
    pt: 'Atividades de construção',
    en: 'Construction activities',
  },
  construction_consulting: {
    pt: 'Consultoria de construção',
    en: 'Construction consulting',
  },
  air_or_sea_transport: {
    pt: 'Transporte aéreo ou marítimo',
    en: 'Air or sea transport',
  },
  mining_or_mining_support: {
    pt: 'Mineração ou apoio à mineração',
    en: 'Mining or mining support',
  },
  royalty: { pt: 'Royalties', en: 'Royalty' },
  rent: { pt: 'Renda de terreno ou edifício', en: 'Land or building rent' },
  prize: { pt: 'Prémio ou lotaria', en: 'Prize or lottery winning' },
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: TEXT,
  },
  header: {
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 6,
  },
  citation: {
    fontSize: 9,
    color: FAINT,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  parties: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    padding: 10,
  },
  partyTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  partyName: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  partyDetail: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: '46%',
    fontSize: 9,
    color: MUTED,
  },
  detailValue: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT,
  },
  amountsBox: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  amountLabel: {
    fontSize: 10,
    color: TEXT,
  },
  amountLabelEn: {
    fontSize: 8,
    color: MUTED,
  },
  amountValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  amountTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: ACCENT,
  },
  amountTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  amountTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  declaration: {
    marginBottom: 8,
  },
  declarationPt: {
    fontSize: 9,
    color: TEXT,
    marginBottom: 4,
  },
  declarationEn: {
    fontSize: 8,
    color: MUTED,
    fontStyle: 'italic',
  },
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 34,
  },
  signatureLine: {
    width: '40%',
    borderTopWidth: 1,
    borderTopColor: TEXT,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: MUTED,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: FAINT,
  },
});

const formatCurrency = (amount: number): string =>
  `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** ISO YYYY-MM-DD -> DD/MM/YYYY (Portuguese convention); raw value if not ISO. */
const formatNoticeDate = (isoDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export interface WithholdingNoticePDFParams {
  notice: TLWithholdingNoticeData;
  /** ISO date (YYYY-MM-DD) of the bill payment the notice covers. */
  paymentDate: string;
  billNumber?: string;
  billDescription?: string;
  company?: Partial<CompanyDetails>;
}

interface WithholdingNoticeDocumentProps extends WithholdingNoticePDFParams {
  generatedDate: Date;
}

const NOT_SPECIFIED = '—';

// eslint-disable-next-line react-refresh/only-export-components
const WithholdingNoticeDocument = ({
  notice,
  paymentDate,
  billNumber,
  billDescription,
  company,
  generatedDate,
}: WithholdingNoticeDocumentProps) => {
  const category = CATEGORY_LABELS[notice.category];
  const payerName =
    company?.legalName || company?.tradingName || NOT_SPECIFIED;
  const payerAddress = [company?.registeredAddress, company?.city, company?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Declaração de Retenção na Fonte</Text>
          <Text style={styles.subtitle}>Withholding Tax Notice</Text>
          <Text style={styles.citation}>
            Emitida nos termos da Lei n.º 8/2008, Secção 58.2 — Issued under
            Law 8/2008 Sec. 58.2
          </Text>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>Entidade pagadora / Payer</Text>
            <Text style={styles.partyName}>{payerName}</Text>
            {company?.tinNumber ? (
              <Text style={styles.partyDetail}>TIN: {company.tinNumber}</Text>
            ) : null}
            {payerAddress ? (
              <Text style={styles.partyDetail}>{payerAddress}</Text>
            ) : null}
            {company?.phone ? (
              <Text style={styles.partyDetail}>Tel: {company.phone}</Text>
            ) : null}
            {company?.email ? (
              <Text style={styles.partyDetail}>{company.email}</Text>
            ) : null}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>
              Beneficiário / Recipient (supplier)
            </Text>
            <Text style={styles.partyName}>{notice.recipientName}</Text>
            <Text style={styles.partyDetail}>
              TIN: {notice.recipientTin || NOT_SPECIFIED}
            </Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Detalhes do pagamento / Payment details
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Referência da fatura / Bill reference
            </Text>
            <Text style={styles.detailValue}>
              {billNumber || NOT_SPECIFIED}
            </Text>
          </View>
          {billDescription ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Descrição / Description</Text>
              <Text style={styles.detailValue}>{billDescription}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Data do pagamento / Payment date
            </Text>
            <Text style={styles.detailValue}>
              {formatNoticeDate(paymentDate)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Categoria de retenção / Withholding category
            </Text>
            <Text style={styles.detailValue}>
              {category.pt} / {category.en}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Taxa de retenção / Withholding rate
            </Text>
            <Text style={styles.detailValue}>{notice.ratePercentLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base legal / Legal basis</Text>
            <Text style={styles.detailValue}>{notice.legalBasis}</Text>
          </View>
        </View>

        {/* Amounts */}
        <View style={styles.amountsBox}>
          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>Pagamento bruto</Text>
              <Text style={styles.amountLabelEn}>Gross payment</Text>
            </View>
            <Text style={styles.amountValue}>
              {formatCurrency(notice.grossAmount)}
            </Text>
          </View>
          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>
                Imposto retido na fonte ({notice.ratePercentLabel})
              </Text>
              <Text style={styles.amountLabelEn}>
                Tax withheld ({notice.ratePercentLabel})
              </Text>
            </View>
            <Text style={styles.amountValue}>
              {formatCurrency(notice.withholdingTax)}
            </Text>
          </View>
          <View style={styles.amountTotalRow}>
            <View>
              <Text style={styles.amountTotalLabel}>
                Pagamento líquido ao beneficiário
              </Text>
              <Text style={styles.amountLabelEn}>Net paid to recipient</Text>
            </View>
            <Text style={styles.amountTotalValue}>
              {formatCurrency(notice.netPayment)}
            </Text>
          </View>
        </View>

        {/* Declaration */}
        <View style={styles.declaration}>
          <Text style={styles.declarationPt}>
            Declaramos que, no pagamento acima identificado, foi retido na
            fonte o imposto indicado, nos termos da Secção 58.2 da Lei
            n.º 8/2008 (Lei Tributária). Este documento serve de comprovativo
            da retenção para o beneficiário.
          </Text>
          <Text style={styles.declarationEn}>
            We declare that the tax shown above was withheld at source from
            the payment identified above, as required by Law 8/2008 Sec. 58.2.
            This document serves as the recipient's evidence of the amount
            withheld.
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>
              Assinatura autorizada / Authorized signature
            </Text>
          </View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Data / Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Gerado / Generated:{' '}
            {generatedDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Dili' })}{' '}
            {generatedDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dili' })}
          </Text>
          <Text style={styles.footerText}>
            Xefe — Declaração de Retenção na Fonte / Withholding Tax Notice
          </Text>
        </View>
      </Page>
    </Document>
  );
};

const generateWithholdingNoticeBlob = async (
  params: WithholdingNoticePDFParams,
): Promise<Blob> => {
  const doc = (
    <WithholdingNoticeDocument {...params} generatedDate={new Date()} />
  );
  return await pdf(doc).toBlob();
};

const sanitizeForFilename = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

/** Download the Sec. 58.2 withholding tax notice as a PDF. */
export const downloadWithholdingNoticePDF = async (
  params: WithholdingNoticePDFParams,
  filename?: string,
): Promise<void> => {
  const { downloadBlob } = await import('@/lib/downloadBlob');
  const blob = await generateWithholdingNoticeBlob(params);
  const reference = params.billNumber
    ? sanitizeForFilename(params.billNumber)
    : '';
  downloadBlob(
    blob,
    filename
      || `withholding-notice-${reference ? `${reference}-` : ''}${params.paymentDate}.pdf`,
  );
};
