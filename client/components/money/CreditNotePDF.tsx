/* eslint-disable react-refresh/only-export-components */
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { CreditNote, Invoice, InvoiceSettings } from '@/types/money';
import { formatInvoiceDate, formatInvoiceMoney } from '@/lib/invoiceTemplates';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 10, color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  company: { maxWidth: 260 },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  muted: { color: '#6b7280', marginBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#2563eb', textAlign: 'right' },
  number: { color: '#6b7280', textAlign: 'right', marginTop: 4 },
  rule: { borderBottomWidth: 2, borderBottomColor: '#2563eb', marginBottom: 20 },
  columns: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  label: { color: '#6b7280', fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  value: { fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  reasonBox: { backgroundColor: '#f9fafb', borderRadius: 6, padding: 14, marginBottom: 24 },
  totals: { width: 230, marginLeft: 'auto' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandTotal: { borderTopWidth: 2, borderTopColor: '#2563eb', marginTop: 3, paddingTop: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 32, color: '#6b7280', fontSize: 8, textAlign: 'center' },
});

function CreditNoteDocument({
  creditNote,
  invoice,
  settings,
}: {
  creditNote: CreditNote;
  invoice: Invoice;
  settings: Partial<InvoiceSettings>;
}) {
  const supplierTaxId = invoice.supplierVatId || settings.vatRegistrationNumber || settings.companyTin;
  return (
    <Document title={`Credit note ${creditNote.creditNoteNumber}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.company}>
            <Text style={styles.companyName}>{settings.companyName || 'Business'}</Text>
            {settings.companyAddress && <Text style={styles.muted}>{settings.companyAddress}</Text>}
            {settings.companyPhone && <Text style={styles.muted}>Tel: {settings.companyPhone}</Text>}
            {settings.companyEmail && <Text style={styles.muted}>{settings.companyEmail}</Text>}
            {supplierTaxId && <Text style={styles.muted}>VAT / TIN: {supplierTaxId}</Text>}
          </View>
          <View>
            <Text style={styles.title}>CREDIT NOTE</Text>
            <Text style={styles.number}>{creditNote.creditNoteNumber}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <View style={styles.columns}>
          <View>
            <Text style={styles.label}>Credit to</Text>
            <Text style={styles.value}>{creditNote.customerName}</Text>
            {invoice.customerAddress && <Text style={styles.muted}>{invoice.customerAddress}</Text>}
            {invoice.customerVatId && <Text style={styles.muted}>VAT / TIN: {invoice.customerVatId}</Text>}
          </View>
          <View>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatInvoiceDate(creditNote.date)}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Original invoice</Text>
            <Text style={styles.value}>{creditNote.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.label}>Reason for credit</Text>
          <Text>{creditNote.reason}</Text>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Net credit</Text>
            <Text>{formatInvoiceMoney(creditNote.netAmount)}</Text>
          </View>
          {creditNote.taxAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Tax credit</Text>
              <Text>{formatInvoiceMoney(creditNote.taxAmount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.bold}>Total credit</Text>
            <Text style={styles.bold}>{formatInvoiceMoney(creditNote.amount)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This credit note reduces the balance of invoice {creditNote.invoiceNumber}.
        </Text>
      </Page>
    </Document>
  );
}

export async function downloadCreditNotePDF(
  creditNote: CreditNote,
  invoice: Invoice,
  settings: Partial<InvoiceSettings>,
): Promise<void> {
  const blob = await pdf(
    <CreditNoteDocument creditNote={creditNote} invoice={invoice} settings={settings} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${creditNote.creditNoteNumber.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
