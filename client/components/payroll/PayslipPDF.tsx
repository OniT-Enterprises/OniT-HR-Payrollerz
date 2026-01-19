/**
 * PDF Payslip Generator
 * Uses @react-pdf/renderer to create downloadable payslip documents
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';
import { PayrollRecord, PayrollRun, PayrollEarning, PayrollDeduction } from '@/types/payroll';

// Register a standard font (optional, uses default if not specified)
// Font.register({ family: 'Helvetica' });

// Styles for the PDF
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
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  payslipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'right',
    marginBottom: 4,
  },
  payslipSubtitle: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 120,
    fontSize: 9,
    color: '#6b7280',
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  twoColumn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  column: {
    flex: 1,
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 5,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  tableCellRight: {
    fontSize: 9,
    color: '#374151',
    textAlign: 'right',
  },
  descCol: { width: '50%' },
  hoursCol: { width: '15%', textAlign: 'center' as const },
  rateCol: { width: '15%', textAlign: 'right' as const },
  amountCol: { width: '20%', textAlign: 'right' as const },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 15,
    backgroundColor: '#1e40af',
    borderRadius: 4,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  ytdSection: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ytdTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
  },
  ytdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ytdItem: {
    width: '25%',
    marginBottom: 6,
  },
  ytdLabel: {
    fontSize: 7,
    color: '#6b7280',
  },
  ytdValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  hoursGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  hoursItem: {
    alignItems: 'center',
  },
  hoursLabel: {
    fontSize: 7,
    color: '#6b7280',
    marginBottom: 2,
  },
  hoursValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalRow: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#e5e7eb',
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
    width: '70%',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
    width: '30%',
    textAlign: 'right',
  },
});

// Format currency for PDF
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Format pay period
const formatPayPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
};

interface PayslipPDFProps {
  record: PayrollRecord;
  payrollRun: PayrollRun;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

/**
 * PayslipDocument - The actual PDF document component
 */
export const PayslipDocument = ({
  record,
  payrollRun,
  companyName = 'OniT Enterprises',
  companyAddress = '123 Business Park, Suite 100, San Francisco, CA 94107',
  companyPhone = '(555) 123-4567',
  companyEmail = 'payroll@onit.com',
}: PayslipPDFProps) => {
  // Group earnings
  const taxableEarnings = record.earnings.filter(e => !['reimbursement'].includes(e.type));
  const nonTaxableEarnings = record.earnings.filter(e => ['reimbursement'].includes(e.type));

  const isTimorLestePayslip = record.deductions.some((d) =>
    /\b(inss|wit)\b/i.test(d.description || "")
  );

  const showYtd = [
    record.ytdGrossPay,
    record.ytdNetPay,
    record.ytdFederalTax,
    record.ytdStateTax,
    record.ytdSocialSecurity,
    record.ytdMedicare,
  ].some((value) => Math.abs(value || 0) > 0.0001);

  const hourItems = [
    { label: "REGULAR", value: record.regularHours },
    { label: "OVERTIME", value: record.overtimeHours },
    { label: "DOUBLE TIME", value: record.doubleTimeHours },
    { label: "HOLIDAY", value: record.holidayHours },
    { label: "PTO USED", value: record.ptoHoursUsed },
    { label: "SICK USED", value: record.sickHoursUsed },
  ].filter((item) => item.label === "REGULAR" || item.value > 0);

  // Group deductions
  const taxDeductions = record.deductions.filter(d =>
    ['federal_tax', 'state_tax', 'local_tax', 'social_security', 'medicare'].includes(d.type)
  );
  const preTaxDeductions = record.deductions.filter(d =>
    d.isPreTax && !['federal_tax', 'state_tax', 'local_tax', 'social_security', 'medicare'].includes(d.type)
  );
  const postTaxDeductions = record.deductions.filter(d =>
    !d.isPreTax && !['federal_tax', 'state_tax', 'local_tax', 'social_security', 'medicare'].includes(d.type)
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyInfo}>{companyAddress}</Text>
            <Text style={styles.companyInfo}>{companyPhone} | {companyEmail}</Text>
          </View>
          <View>
            <Text style={styles.payslipTitle}>EARNINGS STATEMENT</Text>
            <Text style={styles.payslipSubtitle}>Pay Date: {formatDate(payrollRun.payDate)}</Text>
            <Text style={styles.payslipSubtitle}>Period: {formatPayPeriod(payrollRun.periodStart, payrollRun.periodEnd)}</Text>
          </View>
        </View>

        {/* Employee & Pay Info */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Employee Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>{record.employeeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Employee ID:</Text>
                <Text style={styles.infoValue}>{record.employeeNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department:</Text>
                <Text style={styles.infoValue}>{record.department}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Position:</Text>
                <Text style={styles.infoValue}>{record.position}</Text>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pay Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pay Frequency:</Text>
                <Text style={styles.infoValue}>{payrollRun.payFrequency.charAt(0).toUpperCase() + payrollRun.payFrequency.slice(1)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hourly Rate:</Text>
                <Text style={styles.infoValue}>{formatCurrency(record.hourlyRate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Overtime Rate:</Text>
                <Text style={styles.infoValue}>{record.overtimeRate}x</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Hours Summary */}
        <View style={styles.hoursGrid}>
          {hourItems.map((item) => (
            <View key={item.label} style={styles.hoursItem}>
              <Text style={styles.hoursLabel}>{item.label}</Text>
              <Text style={styles.hoursValue}>{item.value.toFixed(2)} hrs</Text>
            </View>
          ))}
        </View>

        {/* Two Column Layout for Earnings/Deductions */}
        <View style={styles.twoColumn}>
          {/* Earnings Column */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: '50%' }]}>Description</Text>
                  <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'center' }]}>Hours</Text>
                  <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Rate</Text>
                  <Text style={[styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>Amount</Text>
                </View>
                {record.earnings.map((earning, index) => (
                  <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { width: '50%' }]}>{earning.description}</Text>
                    <Text style={[styles.tableCell, { width: '15%', textAlign: 'center' }]}>
                      {earning.hours?.toFixed(2) || '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
                      {earning.rate ? formatCurrency(earning.rate) : '-'}
                    </Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                      {formatCurrency(earning.amount)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Gross Pay</Text>
                  <Text style={styles.totalValue}>{formatCurrency(record.totalGrossPay)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Deductions Column */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deductions</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: '70%' }]}>Description</Text>
                  <Text style={[styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>Amount</Text>
                </View>

                {/* Tax Deductions */}
                {taxDeductions.map((deduction, index) => (
                  <View key={`tax-${index}`} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { width: '70%' }]}>{deduction.description}</Text>
                    <Text style={[styles.tableCell, { width: '30%', textAlign: 'right' }]}>
                      {formatCurrency(deduction.amount)}
                    </Text>
                  </View>
                ))}

                {/* Pre-tax Deductions */}
                {preTaxDeductions.length > 0 && (
                  <>
                    {preTaxDeductions.map((deduction, index) => (
                      <View key={`pre-${index}`} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { width: '70%' }]}>{deduction.description} (Pre-tax)</Text>
                        <Text style={[styles.tableCell, { width: '30%', textAlign: 'right' }]}>
                          {formatCurrency(deduction.amount)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Post-tax Deductions */}
                {postTaxDeductions.length > 0 && (
                  <>
                    {postTaxDeductions.map((deduction, index) => (
                      <View key={`post-${index}`} style={styles.tableRowAlt}>
                        <Text style={[styles.tableCell, { width: '70%' }]}>{deduction.description}</Text>
                        <Text style={[styles.tableCell, { width: '30%', textAlign: 'right' }]}>
                          {formatCurrency(deduction.amount)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Deductions</Text>
                  <Text style={styles.totalValue}>{formatCurrency(record.totalDeductions)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Net Pay Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gross Pay</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.totalGrossPay)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Deductions</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.totalDeductions)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net Pay</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.netPay)}</Text>
          </View>
        </View>

        {/* YTD Section */}
        {showYtd && (
          <View style={styles.ytdSection}>
            <Text style={styles.ytdTitle}>Year-to-Date Summary</Text>
            <View style={styles.ytdGrid}>
              <View style={styles.ytdItem}>
                <Text style={styles.ytdLabel}>YTD Gross Pay</Text>
                <Text style={styles.ytdValue}>{formatCurrency(record.ytdGrossPay)}</Text>
              </View>
              <View style={styles.ytdItem}>
                <Text style={styles.ytdLabel}>YTD Net Pay</Text>
                <Text style={styles.ytdValue}>{formatCurrency(record.ytdNetPay)}</Text>
              </View>

              {isTimorLestePayslip ? (
                <>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD WIT</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdFederalTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD INSS (Employee)</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdSocialSecurity)}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD Federal Tax</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdFederalTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD State Tax</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdStateTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD Social Security</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdSocialSecurity)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>YTD Medicare</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdMedicare)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated document. No signature is required.
          {'\n'}
          For questions about your pay, please contact HR at {companyEmail}
        </Text>
      </Page>
    </Document>
  );
};

/**
 * Generate and download a payslip PDF
 */
export const downloadPayslip = async (
  record: PayrollRecord,
  payrollRun: PayrollRun,
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  }
): Promise<void> => {
  const doc = (
    <PayslipDocument
      record={record}
      payrollRun={payrollRun}
      companyName={companyInfo?.name}
      companyAddress={companyInfo?.address}
      companyPhone={companyInfo?.phone}
      companyEmail={companyInfo?.email}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename
  const payDate = new Date(payrollRun.payDate);
  const monthYear = payDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '');
  const safeName = record.employeeName.replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `Payslip_${safeName}_${monthYear}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate payslip PDF as blob (for preview or other uses)
 */
export const generatePayslipBlob = async (
  record: PayrollRecord,
  payrollRun: PayrollRun,
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  }
): Promise<Blob> => {
  const doc = (
    <PayslipDocument
      record={record}
      payrollRun={payrollRun}
      companyName={companyInfo?.name}
      companyAddress={companyInfo?.address}
      companyPhone={companyInfo?.phone}
      companyEmail={companyInfo?.email}
    />
  );

  return await pdf(doc).toBlob();
};

export default PayslipDocument;
