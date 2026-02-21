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
  pdf,
} from '@react-pdf/renderer';
import { PayrollRecord, PayrollRun } from '@/types/payroll';

// ============================================================
// I18N-1: Payslip translations (self-contained, no React context needed)
// Tetum translations for payslip labels so TL workers can read their payslips
// ============================================================

type PayslipLocale = 'en' | 'tet';

const payslipStrings: Record<PayslipLocale, Record<string, string>> = {
  en: {
    title: 'EARNINGS STATEMENT',
    payDate: 'Pay Date:',
    period: 'Period:',
    employeeInfo: 'Employee Information',
    name: 'Name:',
    employeeId: 'Employee ID:',
    department: 'Department:',
    position: 'Position:',
    payInfo: 'Pay Information',
    payFrequency: 'Pay Frequency:',
    hourlyRate: 'Hourly Rate:',
    overtimeRate: 'Overtime Rate:',
    regular: 'REGULAR',
    overtime: 'OVERTIME',
    doubleTime: 'DOUBLE TIME',
    holiday: 'HOLIDAY',
    ptoUsed: 'PTO USED',
    sickUsed: 'SICK USED',
    hrs: 'hrs',
    earnings: 'Earnings',
    description: 'Description',
    hours: 'Hours',
    rate: 'Rate',
    amount: 'Amount',
    grossPay: 'Gross Pay',
    deductions: 'Deductions',
    preTax: '(Pre-tax)',
    totalDeductions: 'Total Deductions',
    netPay: 'Net Pay',
    ytdSummary: 'Year-to-Date Summary',
    ytdGrossPay: 'YTD Gross Pay',
    ytdNetPay: 'YTD Net Pay',
    ytdWIT: 'YTD WIT',
    ytdINSS: 'YTD INSS (Employee)',
    ytdFederalTax: 'YTD Federal Tax',
    ytdStateTax: 'YTD State Tax',
    ytdSocialSecurity: 'YTD Social Security',
    ytdMedicare: 'YTD Medicare',
    employerContributions: 'Employer Contributions',
    employerINSS: 'INSS Employer (6%)',
    totalEmployerCost: 'Total Employer Cost',
    employerNote: 'The following contributions are paid by the employer and are not deducted from your pay.',
    subsidioAnualAccrual: '13th Month Accrual',
    subsidioAnualNote: 'Monthly accrual towards your Subsidio Anual (13th month salary), paid annually.',
    perMonth: '/month',
    footer: 'This is a computer-generated document. No signature is required.',
    footerContact: 'For questions about your pay, please contact HR at',
  },
  tet: {
    title: 'DEKLARASAUN RENDIMENTU',
    payDate: 'Data Pagamentu:',
    period: 'Períodu:',
    employeeInfo: 'Informasaun Trabalhador',
    name: 'Naran:',
    employeeId: 'ID Trabalhador:',
    department: 'Departamentu:',
    position: 'Pozisaun:',
    payInfo: 'Informasaun Pagamentu',
    payFrequency: 'Frequénsia Pagamentu:',
    hourlyRate: 'Taxa Oras:',
    overtimeRate: 'Taxa Hora Extra:',
    regular: 'REGULÁR',
    overtime: 'HORA EXTRA',
    doubleTime: 'DOBRU',
    holiday: 'FERIADU',
    ptoUsed: 'LISENSA',
    sickUsed: 'MORAS',
    hrs: 'oras',
    earnings: 'Rendimentu',
    description: 'Deskrisaun',
    hours: 'Oras',
    rate: 'Taxa',
    amount: 'Montante',
    grossPay: 'Saláriu Brutu',
    deductions: 'Dedusaun',
    preTax: '(Molok impostu)',
    totalDeductions: 'Dedusaun Totál',
    netPay: 'Saláriu Líkidu',
    ytdSummary: 'Rezumu Tinan Tomak',
    ytdGrossPay: 'Brutu Tinan Tomak',
    ytdNetPay: 'Líkidu Tinan Tomak',
    ytdWIT: 'WIT Tinan Tomak',
    ytdINSS: 'INSS Tinan Tomak (Trabalhador)',
    ytdFederalTax: 'Impostu Federal Tinan Tomak',
    ytdStateTax: 'Impostu Estadu Tinan Tomak',
    ytdSocialSecurity: 'Seguransa Sosiál Tinan Tomak',
    ytdMedicare: 'Medicare Tinan Tomak',
    employerContributions: 'Kontribuisaun Empreza',
    employerINSS: 'INSS Empreza (6%)',
    totalEmployerCost: 'Kustu Totál Empreza',
    employerNote: 'Kontribuisaun tuir mai selu husi empreza no la halo dedusaun husi ita-nia saláriu.',
    subsidioAnualAccrual: 'Akumulasaun Fulan-13',
    subsidioAnualNote: 'Akumulasaun mensal ba ita-nia Subsídiu Anuál (saláriu fulan-13), selu tinan-tinan.',
    perMonth: '/fulan',
    footer: 'Dokumentu ne\'e halo husi komputador. La presiza asinatura.',
    footerContact: 'Se iha dúvida kona-ba ita-nia pagamentu, kontaktu RH iha',
  },
};

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
  employerSection: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  employerSectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  employerNote: {
    fontSize: 7,
    color: '#a16207',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  employerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  employerLabel: {
    fontSize: 8,
    color: '#78350f',
  },
  employerValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#78350f',
  },
  employerTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#fcd34d',
  },
  employerTotalLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#78350f',
  },
  employerTotalValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#78350f',
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

// Format date — I18N-2: Use dd/mm/yyyy convention (TL standard)
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dili' });
};

// Format pay period
const formatPayPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-GB', { ...options, timeZone: 'Asia/Dili' })} - ${end.toLocaleDateString('en-GB', { ...options, year: 'numeric', timeZone: 'Asia/Dili' })}`;
};

interface PayslipPDFProps {
  record: PayrollRecord;
  payrollRun: PayrollRun;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  language?: PayslipLocale;
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
  language = 'en',
}: PayslipPDFProps) => {
  const s = payslipStrings[language];

  // Group earnings
  const _taxableEarnings = record.earnings.filter(e => !['reimbursement'].includes(e.type));
  const _nonTaxableEarnings = record.earnings.filter(e => ['reimbursement'].includes(e.type));

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
    { label: s.regular, value: record.regularHours },
    { label: s.overtime, value: record.overtimeHours },
    { label: s.doubleTime, value: record.doubleTimeHours },
    { label: s.holiday, value: record.holidayHours },
    { label: s.ptoUsed, value: record.ptoHoursUsed },
    { label: s.sickUsed, value: record.sickHoursUsed },
  ].filter((item) => item.label === s.regular || item.value > 0);

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
            <Text style={styles.payslipTitle}>{s.title}</Text>
            <Text style={styles.payslipSubtitle}>{s.payDate} {formatDate(payrollRun.payDate)}</Text>
            <Text style={styles.payslipSubtitle}>{s.period} {formatPayPeriod(payrollRun.periodStart, payrollRun.periodEnd)}</Text>
          </View>
        </View>

        {/* Employee & Pay Info */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{s.employeeInfo}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.name}</Text>
                <Text style={styles.infoValue}>{record.employeeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.employeeId}</Text>
                <Text style={styles.infoValue}>{record.employeeNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.department}</Text>
                <Text style={styles.infoValue}>{record.department}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.position}</Text>
                <Text style={styles.infoValue}>{record.position}</Text>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{s.payInfo}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.payFrequency}</Text>
                <Text style={styles.infoValue}>{payrollRun.payFrequency.charAt(0).toUpperCase() + payrollRun.payFrequency.slice(1)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.hourlyRate}</Text>
                <Text style={styles.infoValue}>{formatCurrency(record.hourlyRate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{s.overtimeRate}</Text>
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
              <Text style={styles.hoursValue}>{item.value.toFixed(2)} {s.hrs}</Text>
            </View>
          ))}
        </View>

        {/* Two Column Layout for Earnings/Deductions */}
        <View style={styles.twoColumn}>
          {/* Earnings Column */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{s.earnings}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: '50%' }]}>{s.description}</Text>
                  <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'center' }]}>{s.hours}</Text>
                  <Text style={[styles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>{s.rate}</Text>
                  <Text style={[styles.tableHeaderText, { width: '20%', textAlign: 'right' }]}>{s.amount}</Text>
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
                  <Text style={styles.totalLabel}>{s.grossPay}</Text>
                  <Text style={styles.totalValue}>{formatCurrency(record.totalGrossPay)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Deductions Column */}
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{s.deductions}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: '70%' }]}>{s.description}</Text>
                  <Text style={[styles.tableHeaderText, { width: '30%', textAlign: 'right' }]}>{s.amount}</Text>
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
                        <Text style={[styles.tableCell, { width: '70%' }]}>{deduction.description} {s.preTax}</Text>
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
                  <Text style={styles.totalLabel}>{s.totalDeductions}</Text>
                  <Text style={styles.totalValue}>{formatCurrency(record.totalDeductions)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Net Pay Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{s.grossPay}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.totalGrossPay)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{s.totalDeductions}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.totalDeductions)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{s.netPay}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(record.netPay)}</Text>
          </View>
        </View>

        {/* Employer Contributions (informational — not deducted from employee) */}
        {(record.employerContributions?.length > 0 || record.employerTaxes?.length > 0) && (
          <View style={styles.employerSection}>
            <Text style={styles.employerSectionTitle}>{s.employerContributions}</Text>
            <Text style={styles.employerNote}>{s.employerNote}</Text>
            {record.employerTaxes?.map((tax, i) => (
              <View key={`etax-${i}`} style={styles.employerRow}>
                <Text style={styles.employerLabel}>{tax.description}</Text>
                <Text style={styles.employerValue}>{formatCurrency(tax.amount)}</Text>
              </View>
            ))}
            {record.employerContributions?.map((contrib, i) => (
              <View key={`econtrib-${i}`} style={styles.employerRow}>
                <Text style={styles.employerLabel}>{contrib.description}</Text>
                <Text style={styles.employerValue}>{formatCurrency(contrib.amount)}</Text>
              </View>
            ))}
            <View style={styles.employerTotalRow}>
              <Text style={styles.employerTotalLabel}>{s.totalEmployerCost}</Text>
              <Text style={styles.employerTotalValue}>{formatCurrency(record.totalEmployerCost)}</Text>
            </View>
          </View>
        )}

        {/* 13th Month Accrual (TL payslips only — informational) */}
        {isTimorLestePayslip && record.totalGrossPay > 0 && (
          <View style={styles.employerSection}>
            <Text style={styles.employerSectionTitle}>{s.subsidioAnualAccrual}</Text>
            <Text style={styles.employerNote}>{s.subsidioAnualNote}</Text>
            <View style={styles.employerRow}>
              <Text style={styles.employerLabel}>{s.subsidioAnualAccrual}</Text>
              <Text style={styles.employerValue}>
                {formatCurrency(+(record.totalGrossPay / 12).toFixed(2))}{s.perMonth}
              </Text>
            </View>
          </View>
        )}

        {/* YTD Section */}
        {showYtd && (
          <View style={styles.ytdSection}>
            <Text style={styles.ytdTitle}>{s.ytdSummary}</Text>
            <View style={styles.ytdGrid}>
              <View style={styles.ytdItem}>
                <Text style={styles.ytdLabel}>{s.ytdGrossPay}</Text>
                <Text style={styles.ytdValue}>{formatCurrency(record.ytdGrossPay)}</Text>
              </View>
              <View style={styles.ytdItem}>
                <Text style={styles.ytdLabel}>{s.ytdNetPay}</Text>
                <Text style={styles.ytdValue}>{formatCurrency(record.ytdNetPay)}</Text>
              </View>

              {isTimorLestePayslip ? (
                <>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdWIT}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdFederalTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdINSS}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdSocialSecurity)}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdFederalTax}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdFederalTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdStateTax}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdStateTax)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdSocialSecurity}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdSocialSecurity)}</Text>
                  </View>
                  <View style={styles.ytdItem}>
                    <Text style={styles.ytdLabel}>{s.ytdMedicare}</Text>
                    <Text style={styles.ytdValue}>{formatCurrency(record.ytdMedicare)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {s.footer}
          {'\n'}
          {s.footerContact} {companyEmail}
        </Text>
      </Page>
    </Document>
  );
};

/**
 * Generate and download a payslip PDF
 */
// eslint-disable-next-line react-refresh/only-export-components
export const downloadPayslip = async (
  record: PayrollRecord,
  payrollRun: PayrollRun,
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  },
  language?: PayslipLocale
): Promise<void> => {
  const doc = (
    <PayslipDocument
      record={record}
      payrollRun={payrollRun}
      companyName={companyInfo?.name}
      companyAddress={companyInfo?.address}
      companyPhone={companyInfo?.phone}
      companyEmail={companyInfo?.email}
      language={language}
    />
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename
  const payDate = new Date(payrollRun.payDate);
  const monthYear = payDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Dili' }).replace(' ', '');
  const safeName = record.employeeName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
  link.download = `Payslip_${safeName}_${monthYear}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate payslip PDF as blob (for preview or other uses)
 */
// eslint-disable-next-line react-refresh/only-export-components
export const generatePayslipBlob = async (
  record: PayrollRecord,
  payrollRun: PayrollRun,
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  },
  language?: PayslipLocale
): Promise<Blob> => {
  const doc = (
    <PayslipDocument
      record={record}
      payrollRun={payrollRun}
      companyName={companyInfo?.name}
      companyAddress={companyInfo?.address}
      companyPhone={companyInfo?.phone}
      companyEmail={companyInfo?.email}
      language={language}
    />
  );

  return await pdf(doc).toBlob();
};

export type { PayslipLocale };
export default PayslipDocument;
