/* eslint-disable react-refresh/only-export-components */
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

type PayslipLocale = 'en' | 'tet' | 'pt';

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
    employerContributions: 'Employer Contributions',
    employerINSS: 'INSS Employer (6%)',
    totalEmployerCost: 'Total Employer Cost',
    employerNote: 'The following contributions are paid by the employer and are not deducted from your pay.',
    subsidioAnualAccrual: '13th Month Accrual',
    subsidioAnualNote: 'Monthly accrual towards your Subsidio Anual (13th month salary), paid annually.',
    perMonth: '/month',
    footer: 'This is a computer-generated document. No signature is required.',
    footerContact: 'For questions about your pay, please contact HR at',
    // Combined line-items table
    code: 'Code',
    ref: 'Ref.',
    earningsCol: 'Earnings',
    deductionsCol: 'Deductions',
    totalEarnings: 'Total Earnings',
    // Header
    monthOf: 'Month of',
    payslipTitleRow: 'Salary Payment Receipt',
    // Audit row at bottom
    auditBaseSalary: 'Base Salary',
    auditAbsences: 'Absences',
    auditCommissions: 'Commissions',
    auditAllowances: 'Allowances',
    auditTaxableBase: 'Taxable Base',
    auditTaxOfMonth: 'Tax of Month',
    auditSocialSecurity: 'Social Security',
    auditOtherDeductions: 'Other Deductions',
    // Signature block
    copyMark: 'COPY',
    signatureDeclaration:
      'I acknowledge receipt of the net amount itemised in this pay slip.',
    signatureLabel: 'EMPLOYEE SIGNATURE',
    signatureDate: 'Date:',
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
    employerContributions: 'Kontribuisaun Empreza',
    employerINSS: 'INSS Empreza (6%)',
    totalEmployerCost: 'Kustu Totál Empreza',
    employerNote: 'Kontribuisaun tuir mai selu husi empreza no la halo dedusaun husi ita-nia saláriu.',
    subsidioAnualAccrual: 'Akumulasaun Fulan-13',
    subsidioAnualNote: 'Akumulasaun mensal ba ita-nia Subsídiu Anuál (saláriu fulan-13), selu tinan-tinan.',
    perMonth: '/fulan',
    footer: 'Dokumentu ne\'e halo husi komputador. La presiza asinatura.',
    footerContact: 'Se iha dúvida kona-ba ita-nia pagamentu, kontaktu RH iha',
    code: 'Kódigu',
    ref: 'Ref.',
    earningsCol: 'Rendimentu',
    deductionsCol: 'Dedusaun',
    totalEarnings: 'Rendimentu Totál',
    monthOf: 'Fulan',
    payslipTitleRow: 'Resibu Pagamentu Saláriu',
    auditBaseSalary: 'Saláriu Báziku',
    auditAbsences: 'Falta',
    auditCommissions: 'Komisaun',
    auditAllowances: 'Subsídiu',
    auditTaxableBase: 'Báze Impostu',
    auditTaxOfMonth: 'Impostu Fulan',
    auditSocialSecurity: 'Seguransa Sosiál',
    auditOtherDeductions: 'Dedusaun Seluk',
    copyMark: 'KÓPIA',
    signatureDeclaration:
      'Hau rekonese simu montante líkidu ne\'ebé deskrimina iha resibu ne\'e.',
    signatureLabel: 'ASINATURA TRABALHADOR',
    signatureDate: 'Data:',
  },
  pt: {
    title: 'RECIBO DE VENCIMENTO',
    payDate: 'Data de Pagamento:',
    period: 'Período:',
    employeeInfo: 'Informação do Trabalhador',
    name: 'Nome:',
    employeeId: 'Código Trabalhador:',
    department: 'Departamento:',
    position: 'Cargo:',
    payInfo: 'Informação de Pagamento',
    payFrequency: 'Frequência:',
    hourlyRate: 'Valor Hora:',
    overtimeRate: 'Valor Hora Extra:',
    regular: 'REGULAR',
    overtime: 'HORAS EXTRAS',
    doubleTime: 'DOBRO',
    holiday: 'FERIADO',
    ptoUsed: 'FÉRIAS',
    sickUsed: 'DOENÇA',
    hrs: 'h',
    earnings: 'Vencimentos',
    description: 'Descrição',
    hours: 'Horas',
    rate: 'Taxa',
    amount: 'Montante',
    grossPay: 'Vencimento Bruto',
    deductions: 'Descontos',
    preTax: '(Pré-impostos)',
    totalDeductions: 'Total de Descontos',
    netPay: 'Valor Líquido',
    ytdSummary: 'Resumo Ano Atual',
    ytdGrossPay: 'Bruto Acumulado',
    ytdNetPay: 'Líquido Acumulado',
    ytdWIT: 'Imposto Acumulado',
    ytdINSS: 'INSS Acumulado (Trabalhador)',
    employerContributions: 'Contribuições do Empregador',
    employerINSS: 'INSS Empregador (6%)',
    totalEmployerCost: 'Custo Total do Empregador',
    employerNote:
      'As contribuições abaixo são pagas pelo empregador e não são descontadas do seu vencimento.',
    subsidioAnualAccrual: 'Acumulação do 13.º Mês',
    subsidioAnualNote:
      'Acumulação mensal do Subsídio Anual (13.º mês), pago anualmente.',
    perMonth: '/mês',
    footer: 'Este documento é gerado por computador. Não requer assinatura.',
    footerContact: 'Para dúvidas sobre o seu pagamento contacte RH em',
    code: 'Cód.',
    ref: 'Ref.',
    earningsCol: 'Vencimentos',
    deductionsCol: 'Descontos',
    totalEarnings: 'Total de Vencimentos',
    monthOf: 'Mês de',
    payslipTitleRow: 'Recibo de Pagamento de Salário',
    auditBaseSalary: 'Salário Base',
    auditAbsences: 'Faltas',
    auditCommissions: 'Comissões',
    auditAllowances: 'Subsídios',
    auditTaxableBase: 'Base Impostos',
    auditTaxOfMonth: 'Imposto do Mês',
    auditSocialSecurity: 'Seg. Social',
    auditOtherDeductions: 'Descontos',
    copyMark: 'CÓPIA',
    signatureDeclaration:
      'Declaro ter recebido a importância líquida discriminada neste recibo.',
    signatureLabel: 'ASSINATURA DO FUNCIONÁRIO',
    signatureDate: 'Data:',
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
  // Copy watermark (top-right)
  copyMark: {
    position: 'absolute',
    top: 20,
    right: 40,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9ca3af',
    letterSpacing: 2,
  },
  // "Mês de [Month Year]" prominent header box
  monthBox: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 4,
  },
  monthLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  monthValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 2,
  },
  // Title banner across the page
  titleBanner: {
    backgroundColor: '#1e40af',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  titleBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Combined line-items table
  combinedHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    marginTop: 4,
  },
  combinedRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  combinedCell: {
    fontSize: 9,
    color: '#111827',
  },
  codeCol: { width: '10%' },
  descCombinedCol: { width: '45%' },
  refCol: { width: '10%', textAlign: 'right' as const },
  earnCol: { width: '17.5%', textAlign: 'right' as const },
  dedCol: { width: '17.5%', textAlign: 'right' as const },
  combinedTotalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 5,
    backgroundColor: '#f3f4f6',
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#9ca3af',
  },
  // Bottom audit-trail row
  auditSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  auditHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  auditValueRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
  },
  auditCell: {
    flex: 1,
    fontSize: 8,
    textAlign: 'center',
    color: '#374151',
  },
  auditCellHeader: {
    flex: 1,
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#6b7280',
  },
  // Signature block
  signatureBlock: {
    marginTop: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
  },
  signatureDeclaration: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 18,
    fontStyle: 'italic',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 20,
  },
  signatureLineBox: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    paddingBottom: 2,
    minHeight: 24,
  },
  signatureCaption: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 1,
  },
  signatureDateBox: {
    minWidth: 120,
  },
});

// TL payslip codes — short codes commonly used on TL Portuguese payslips.
const EARNING_CODES: Record<string, string> = {
  regular: 'SL_B',
  overtime: 'C_O',
  double_time: 'HD',
  holiday: 'FER',
  bonus: 'BON',
  subsidio_anual: 'SB_A',
  commission: 'COM',
  tip: 'GOR',
  reimbursement: 'REM',
  allowance: 'SUB',
  other: 'OUT',
};

const DEDUCTION_CODES: Record<string, string> = {
  income_tax: 'IMP',
  inss_employee: 'S_S',
  inss_employer: 'S_S_E',
  absence: 'F_L',
  late_arrival: 'ATR',
  loan_repayment: 'EMP',
  advance_repayment: 'AD',
  court_order: 'OJ',
  health_insurance: 'HS',
  life_insurance: 'LS',
  other: 'OU_DS',
};

// Format currency for PDF
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date — I18N-2: Use dd/mm/yyyy convention (TL standard)
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Dili' });
};

// Format month label — "February 2026" / "Fulan Fevereiru 2026" / "Fevereiro 2026"
const formatMonth = (dateString: string, language: PayslipLocale): string => {
  const date = new Date(dateString);
  const localeMap: Record<PayslipLocale, string> = {
    en: 'en-GB',
    tet: 'pt-PT',
    pt: 'pt-PT',
  };
  return date.toLocaleDateString(localeMap[language], {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });
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

// --- Shared types for sub-components ---

type PayslipStrings = Record<string, string>;

// --- Sub-components ---

function PayslipHeader({
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  payrollRun,
  s,
  language,
  isCopy,
}: {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  payrollRun: PayrollRun;
  s: PayslipStrings;
  language: PayslipLocale;
  isCopy?: boolean;
}) {
  const monthLabel = formatMonth(payrollRun.payDate, language);
  return (
    <>
      {isCopy && <Text style={styles.copyMark}>{s.copyMark}</Text>}
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.companyInfo}>{companyAddress}</Text>
          <Text style={styles.companyInfo}>{companyPhone} | {companyEmail}</Text>
        </View>
        <View style={styles.monthBox}>
          <Text style={styles.monthLabel}>{s.monthOf}</Text>
          <Text style={styles.monthValue}>{monthLabel}</Text>
          <Text style={[styles.payslipSubtitle, { marginTop: 4 }]}>
            {s.payDate} {formatDate(payrollRun.payDate)}
          </Text>
        </View>
      </View>
      <View style={styles.titleBanner}>
        <Text style={styles.titleBannerText}>{s.payslipTitleRow}</Text>
      </View>
    </>
  );
}

function EmployeePayInfoSection({
  record,
  payrollRun,
  s,
}: {
  record: PayrollRecord;
  payrollRun: PayrollRun;
  s: PayslipStrings;
}) {
  return (
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
  );
}

function HoursSummaryGrid({
  hourItems,
  s,
}: {
  hourItems: { label: string; value: number }[];
  s: PayslipStrings;
}) {
  return (
    <View style={styles.hoursGrid}>
      {hourItems.map((item) => (
        <View key={item.label} style={styles.hoursItem}>
          <Text style={styles.hoursLabel}>{item.label}</Text>
          <Text style={styles.hoursValue}>{item.value.toFixed(2)} {s.hrs}</Text>
        </View>
      ))}
    </View>
  );
}

function NetPaySummary({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  return (
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
  );
}

function EmployerContributionsSection({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  if (!(record.employerContributions?.length > 0 || record.employerTaxes?.length > 0)) {
    return null;
  }
  return (
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
  );
}

function SubsidioAnualSection({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  if (!(record.totalGrossPay > 0)) {
    return null;
  }
  return (
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
  );
}

function YtdSection({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  const showYtd = [
    record.ytdGrossPay,
    record.ytdNetPay,
    record.ytdIncomeTax,
    record.ytdINSSEmployee,
  ].some((value) => Math.abs(value || 0) > 0.0001);

  if (!showYtd) {
    return null;
  }

  return (
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
        <View style={styles.ytdItem}>
          <Text style={styles.ytdLabel}>{s.ytdWIT}</Text>
          <Text style={styles.ytdValue}>{formatCurrency(record.ytdIncomeTax)}</Text>
        </View>
        <View style={styles.ytdItem}>
          <Text style={styles.ytdLabel}>{s.ytdINSS}</Text>
          <Text style={styles.ytdValue}>{formatCurrency(record.ytdINSSEmployee)}</Text>
        </View>
      </View>
    </View>
  );
}

function PayslipFooter({
  companyEmail,
  s,
}: {
  companyEmail: string;
  s: PayslipStrings;
}) {
  return (
    <Text style={styles.footer}>
      {s.footer}
      {'\n'}
      {s.footerContact} {companyEmail}
    </Text>
  );
}

/**
 * CombinedLineItemsTable — TL-style single table with earnings + deductions
 * flowing into their respective columns. Matches the example payslip layout
 * where every line shows: Cód | Descrição | Ref | Vencimentos | Descontos.
 */
function CombinedLineItemsTable({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  type Row = {
    code: string;
    description: string;
    ref?: string;
    earning?: number;
    deduction?: number;
  };

  const earnings: Row[] = record.earnings.map((e) => ({
    code: EARNING_CODES[e.type] || 'OUT',
    description: e.description,
    ref: e.hours ? `${e.hours.toFixed(2)} ${s.hrs}` : undefined,
    earning: e.amount,
  }));

  const deductions: Row[] = record.deductions.map((d) => ({
    code: DEDUCTION_CODES[d.type] || 'OU_DS',
    description: d.description,
    deduction: d.amount,
  }));

  const rows: Row[] = [...earnings, ...deductions];

  return (
    <View style={{ marginTop: 4 }}>
      <View style={styles.combinedHeader}>
        <Text style={[styles.tableHeaderText, styles.codeCol]}>{s.code}</Text>
        <Text style={[styles.tableHeaderText, styles.descCombinedCol]}>{s.description}</Text>
        <Text style={[styles.tableHeaderText, styles.refCol]}>{s.ref}</Text>
        <Text style={[styles.tableHeaderText, styles.earnCol]}>{s.earningsCol}</Text>
        <Text style={[styles.tableHeaderText, styles.dedCol]}>{s.deductionsCol}</Text>
      </View>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.combinedRow}>
          <Text style={[styles.combinedCell, styles.codeCol, { fontWeight: 'bold' }]}>
            {row.code}
          </Text>
          <Text style={[styles.combinedCell, styles.descCombinedCol]}>{row.description}</Text>
          <Text style={[styles.combinedCell, styles.refCol, { color: '#6b7280' }]}>
            {row.ref || ''}
          </Text>
          <Text style={[styles.combinedCell, styles.earnCol]}>
            {row.earning !== undefined ? formatCurrency(row.earning) : ''}
          </Text>
          <Text style={[styles.combinedCell, styles.dedCol]}>
            {row.deduction !== undefined ? formatCurrency(row.deduction) : ''}
          </Text>
        </View>
      ))}
      <View style={styles.combinedTotalRow}>
        <Text style={[styles.combinedCell, styles.codeCol]} />
        <Text style={[styles.combinedCell, styles.descCombinedCol, { fontWeight: 'bold' }]}>
          {s.totalEarnings} / {s.totalDeductions}
        </Text>
        <Text style={[styles.combinedCell, styles.refCol]} />
        <Text style={[styles.combinedCell, styles.earnCol, { fontWeight: 'bold' }]}>
          {formatCurrency(record.totalGrossPay)}
        </Text>
        <Text style={[styles.combinedCell, styles.dedCol, { fontWeight: 'bold' }]}>
          {formatCurrency(record.totalDeductions)}
        </Text>
      </View>
    </View>
  );
}

/**
 * AuditTrailRow — bottom summary strip expected by TL finance teams.
 * Eight columns mirroring the example payslip.
 */
function AuditTrailRow({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  const sumEarningsByType = (types: string[]) =>
    record.earnings
      .filter((e) => types.includes(e.type))
      .reduce((sum, e) => sum + e.amount, 0);

  const sumDeductionsByType = (types: string[]) =>
    record.deductions
      .filter((d) => types.includes(d.type))
      .reduce((sum, d) => sum + d.amount, 0);

  const baseSalary = sumEarningsByType(['regular']);
  const absences = sumDeductionsByType(['absence', 'late_arrival']);
  const commissions = sumEarningsByType(['commission', 'tip']);
  const allowances = sumEarningsByType(['allowance', 'reimbursement', 'bonus', 'subsidio_anual']);
  const tax = sumDeductionsByType(['income_tax']);
  const inss = sumDeductionsByType(['inss_employee']);
  const otherDeductions = sumDeductionsByType([
    'loan_repayment',
    'advance_repayment',
    'court_order',
    'health_insurance',
    'life_insurance',
    'other',
  ]);

  // Taxable base = gross minus pre-tax deductions (approximation — inss_employee is deducted pre-tax in TL)
  const taxableBase =
    record.totalGrossPay -
    record.deductions
      .filter((d) => d.isPreTax && d.type !== 'income_tax')
      .reduce((sum, d) => sum + d.amount, 0);

  const cells: { label: string; value: number }[] = [
    { label: s.auditBaseSalary, value: baseSalary },
    { label: s.auditAbsences, value: absences },
    { label: s.auditCommissions, value: commissions },
    { label: s.auditAllowances, value: allowances },
    { label: s.auditTaxableBase, value: taxableBase },
    { label: s.auditTaxOfMonth, value: tax },
    { label: s.auditSocialSecurity, value: inss },
    { label: s.auditOtherDeductions, value: otherDeductions },
  ];

  return (
    <View style={styles.auditSection}>
      <View style={styles.auditHeaderRow}>
        {cells.map((cell) => (
          <Text key={cell.label} style={styles.auditCellHeader}>
            {cell.label}
          </Text>
        ))}
      </View>
      <View style={styles.auditValueRow}>
        {cells.map((cell) => (
          <Text key={cell.label} style={styles.auditCell}>
            {formatCurrency(cell.value)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * SignatureBlock — declaration + physical signature lines for employee + date.
 */
function SignatureBlock({
  record,
  s,
}: {
  record: PayrollRecord;
  s: PayslipStrings;
}) {
  return (
    <View style={styles.signatureBlock}>
      <Text style={styles.signatureDeclaration}>{s.signatureDeclaration}</Text>
      <View style={styles.signatureRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.signatureLineBox} />
          <Text style={styles.signatureCaption}>
            {record.employeeName} — {s.signatureLabel}
          </Text>
        </View>
        <View style={styles.signatureDateBox}>
          <View style={styles.signatureLineBox} />
          <Text style={styles.signatureCaption}>{s.signatureDate}</Text>
        </View>
      </View>
    </View>
  );
}

// --- Helpers ---

function buildHourItems(record: PayrollRecord, s: PayslipStrings) {
  return [
    { label: s.regular, value: record.regularHours },
    { label: s.overtime, value: record.overtimeHours },
    { label: s.doubleTime, value: record.doubleTimeHours },
    { label: s.holiday, value: record.holidayHours },
    { label: s.ptoUsed, value: record.ptoHoursUsed },
    { label: s.sickUsed, value: record.sickHoursUsed },
  ].filter((item) => item.label === s.regular || item.value > 0);
}

/**
 * PayslipDocument - The actual PDF document component
 */
const PayslipDocument = ({
  record,
  payrollRun,
  companyName = 'OniT Enterprises',
  companyAddress = '123 Business Park, Suite 100, San Francisco, CA 94107',
  companyPhone = '(555) 123-4567',
  companyEmail = 'payroll@onit.com',
  language = 'en',
}: PayslipPDFProps) => {
  const s = payslipStrings[language];
  const hourItems = buildHourItems(record, s);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <PayslipHeader
          companyName={companyName}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          companyEmail={companyEmail}
          payrollRun={payrollRun}
          s={s}
          language={language}
          isCopy
        />
        <EmployeePayInfoSection record={record} payrollRun={payrollRun} s={s} />
        <HoursSummaryGrid hourItems={hourItems} s={s} />

        {/* Combined TL-style earnings/deductions table */}
        <CombinedLineItemsTable record={record} s={s} />

        <NetPaySummary record={record} s={s} />
        <AuditTrailRow record={record} s={s} />
        <SignatureBlock record={record} s={s} />
        <EmployerContributionsSection record={record} s={s} />
        <SubsidioAnualSection record={record} s={s} />
        <YtdSection record={record} s={s} />
        <PayslipFooter companyEmail={companyEmail} s={s} />
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
  },
  language?: PayslipLocale
): Promise<void> => {
  const { downloadBlob } = await import("@/lib/downloadBlob");
  const blob = await generatePayslipBlob(record, payrollRun, companyInfo, language);

  // Generate filename
  const payDate = new Date(payrollRun.payDate);
  const monthYear = payDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Dili' }).replace(' ', '');
  const safeName = record.employeeName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
  downloadBlob(blob, `Payslip_${safeName}_${monthYear}.pdf`);
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
