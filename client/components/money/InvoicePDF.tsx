/**
 * Invoice PDF Generator
 * Uses @react-pdf/renderer to create downloadable invoice documents
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { Invoice, InvoiceSettings } from '@/types/money';

// Styles for the PDF - Professional invoice layout
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'right',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 2,
  },
  statusBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  twoColumn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  column: {
    width: '48%',
  },
  customerBox: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
  },
  customerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  dateBox: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  dateValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
  },
  descCol: { width: '45%' },
  qtyCol: { width: '15%', textAlign: 'center' as const },
  priceCol: { width: '20%', textAlign: 'right' as const },
  amountCol: { width: '20%', textAlign: 'right' as const },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 25,
  },
  totalsBox: {
    width: 250,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  totalLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 10,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#4f46e5',
    borderRadius: 4,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 4,
    marginTop: 4,
  },
  paidLabel: {
    fontSize: 10,
    color: '#166534',
  },
  paidValue: {
    fontSize: 10,
    color: '#166534',
    fontWeight: 'bold',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    marginTop: 4,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: 'bold',
  },
  balanceValue: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  bankSection: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bankLabel: {
    width: 100,
    fontSize: 9,
    color: '#6b7280',
  },
  bankValue: {
    flex: 1,
    fontSize: 9,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

// Get status badge styles
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'paid':
      return { backgroundColor: '#dcfce7', color: '#166534' };
    case 'sent':
    case 'viewed':
      return { backgroundColor: '#dbeafe', color: '#1e40af' };
    case 'partial':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'overdue':
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    case 'cancelled':
      return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
};

// Format currency
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dili' });
};

interface InvoicePDFProps {
  invoice: Invoice;
  settings?: Partial<InvoiceSettings>;
}

/**
 * InvoiceDocument - The actual PDF document component
 */
export const InvoiceDocument = ({ invoice, settings }: InvoicePDFProps) => {
  const statusStyles = getStatusStyles(invoice.status);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>
              {settings?.companyName || 'Your Company Name'}
            </Text>
            {settings?.companyAddress && (
              <Text style={styles.companyInfo}>{settings.companyAddress}</Text>
            )}
            {settings?.companyPhone && (
              <Text style={styles.companyInfo}>Tel: {settings.companyPhone}</Text>
            )}
            {settings?.companyEmail && (
              <Text style={styles.companyInfo}>{settings.companyEmail}</Text>
            )}
            {settings?.companyTin && (
              <Text style={styles.companyInfo}>TIN: {settings.companyTin}</Text>
            )}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyles.backgroundColor }]}>
              <Text style={[styles.statusText, { color: statusStyles.color }]}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Bill To & Dates */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.customerBox}>
              <Text style={styles.customerName}>{invoice.customerName}</Text>
              {invoice.customerEmail && (
                <Text style={styles.customerDetail}>{invoice.customerEmail}</Text>
              )}
              {invoice.customerPhone && (
                <Text style={styles.customerDetail}>{invoice.customerPhone}</Text>
              )}
              {invoice.customerAddress && (
                <Text style={styles.customerDetail}>{invoice.customerAddress}</Text>
              )}
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <View style={styles.dateBox}>
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Issue Date:</Text>
                <Text style={styles.dateValue}>{formatDate(invoice.issueDate)}</Text>
              </View>
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Due Date:</Text>
                <Text style={styles.dateValue}>{formatDate(invoice.dueDate)}</Text>
              </View>
              <View style={[styles.dateRow, { marginBottom: 0 }]}>
                <Text style={styles.dateLabel}>Currency:</Text>
                <Text style={styles.dateValue}>{invoice.currency}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.descCol]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.priceCol]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.amountCol]}>Amount</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, styles.descCol]}>{item.description}</Text>
              <Text style={[styles.tableCell, styles.qtyCol]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.priceCol]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[styles.tableCell, styles.amountCol]}>
                {formatCurrency(item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            {invoice.taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({invoice.taxRate}%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(invoice.taxAmount)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
            </View>
            {invoice.amountPaid > 0 && (
              <View style={styles.paidRow}>
                <Text style={styles.paidLabel}>Amount Paid</Text>
                <Text style={styles.paidValue}>-{formatCurrency(invoice.amountPaid)}</Text>
              </View>
            )}
            {invoice.balanceDue > 0 && invoice.balanceDue !== invoice.total && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance Due</Text>
                <Text style={styles.balanceValue}>{formatCurrency(invoice.balanceDue)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bank Details */}
        {(settings?.bankName || settings?.bankAccountNumber) && (
          <View style={styles.bankSection}>
            <Text style={styles.bankTitle}>Payment Details</Text>
            {settings.bankName && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Bank:</Text>
                <Text style={styles.bankValue}>{settings.bankName}</Text>
              </View>
            )}
            {settings.bankAccountName && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account Name:</Text>
                <Text style={styles.bankValue}>{settings.bankAccountName}</Text>
              </View>
            )}
            {settings.bankAccountNumber && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account Number:</Text>
                <Text style={styles.bankValue}>{settings.bankAccountNumber}</Text>
              </View>
            )}
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Reference:</Text>
              <Text style={styles.bankValue}>{invoice.invoiceNumber}</Text>
            </View>
          </View>
        )}

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <View style={styles.notesSection}>
            {invoice.notes && (
              <View style={{ marginBottom: invoice.terms ? 10 : 0 }}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            )}
            {invoice.terms && (
              <View>
                <Text style={styles.notesTitle}>Terms & Conditions</Text>
                <Text style={styles.notesText}>{invoice.terms}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business!
          {'\n'}
          {settings?.companyEmail && `Questions? Contact us at ${settings.companyEmail}`}
        </Text>
      </Page>
    </Document>
  );
};

/**
 * Generate and download an invoice PDF
 */
// eslint-disable-next-line react-refresh/only-export-components
export const downloadInvoicePDF = async (
  invoice: Invoice,
  settings?: Partial<InvoiceSettings>
): Promise<void> => {
  const doc = <InvoiceDocument invoice={invoice} settings={settings} />;

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoice.invoiceNumber}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate invoice PDF as blob (for preview or email attachment)
 */
// eslint-disable-next-line react-refresh/only-export-components
export const generateInvoiceBlob = async (
  invoice: Invoice,
  settings?: Partial<InvoiceSettings>
): Promise<Blob> => {
  const doc = <InvoiceDocument invoice={invoice} settings={settings} />;
  return await pdf(doc).toBlob();
};

export default InvoiceDocument;
