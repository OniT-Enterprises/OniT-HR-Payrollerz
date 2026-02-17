/**
 * Kaixa — SAFT (Standard Audit File for Tax) XML Export
 *
 * Generates SAFT-PT compliant XML adapted for Timor-Leste.
 * Based on the Portuguese SAFT standard (Portaria 321-A/2007)
 * adapted for TL's fiscal environment (USD currency, TL country code).
 *
 * Uses string concatenation for XML generation — no external
 * XML library needed, keeping the bundle lean for React Native.
 */
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { paths } from '@onit/shared';

// ============================================
// Types
// ============================================

interface KaixaTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  vatCategory: 'standard' | 'reduced' | 'zero' | 'exempt' | 'none';
  category: string;
  note: string;
  timestamp: Date;
  receiptNumber?: string;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
}

export interface SAFTBusinessInfo {
  name: string;
  vatRegNumber: string;
  address: string;
  phone: string;
}

// ============================================
// XML Escaping
// ============================================

/**
 * Escape XML special characters to prevent malformed output.
 * Handles the five predefined XML entities.
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// Date Helpers (Dili timezone)
// ============================================

/** Format a Date as YYYY-MM-DD in Dili timezone */
function formatDateISO(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' });
}

/** Get fiscal year boundaries (Jan 1 - Dec 31) in Dili timezone */
function getFiscalYearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(`${year}-01-01T00:00:00+09:00`);
  const end = new Date(`${year + 1}-01-01T00:00:00+09:00`);
  return { start, end };
}

// ============================================
// Firestore Query
// ============================================

/**
 * Fetch all transactions for a tenant within a date range.
 * Uses the same Firestore query pattern as monthlyReport.ts
 * and transactionStore.ts.
 */
async function fetchTransactions(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<KaixaTransaction[]> {
  const colRef = collection(db, paths.transactions(tenantId));
  const q = query(
    colRef,
    where('timestamp', '>=', Timestamp.fromDate(startDate)),
    where('timestamp', '<', Timestamp.fromDate(endDate)),
    orderBy('timestamp', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type as 'in' | 'out',
      amount: (data.amount as number) || 0,
      netAmount: (data.netAmount as number) ?? (data.amount as number) ?? 0,
      vatRate: (data.vatRate as number) ?? 0,
      vatAmount: (data.vatAmount as number) ?? 0,
      vatCategory:
        (data.vatCategory as KaixaTransaction['vatCategory']) ?? 'none',
      category: (data.category as string) || 'other',
      note: (data.note as string) ?? '',
      timestamp:
        data.timestamp instanceof Timestamp
          ? data.timestamp.toDate()
          : new Date(data.timestamp as string),
      receiptNumber: data.receiptNumber as string | undefined,
      tenantId: data.tenantId as string,
      createdBy: data.createdBy as string,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt as string),
    };
  });
}

// ============================================
// Tax Table Builder
// ============================================

interface TaxTableEntry {
  description: string;
  percentage: number;
}

/**
 * Collect unique VAT rates from transactions and build
 * the SAFT TaxTable entries.
 */
function buildTaxTable(transactions: KaixaTransaction[]): TaxTableEntry[] {
  const rateMap = new Map<number, string>();

  for (const tx of transactions) {
    if (rateMap.has(tx.vatRate)) continue;

    let description: string;
    switch (tx.vatCategory) {
      case 'standard':
        description = 'Standard Rate';
        break;
      case 'reduced':
        description = 'Reduced Rate';
        break;
      case 'zero':
        description = 'Zero Rate';
        break;
      case 'exempt':
        description = 'Exempt';
        break;
      default:
        description = tx.vatRate > 0 ? `Rate ${tx.vatRate}%` : 'No VAT';
        break;
    }

    rateMap.set(tx.vatRate, description);
  }

  // Always include a 0% entry if no transactions exist
  if (rateMap.size === 0) {
    rateMap.set(0, 'No VAT');
  }

  return [...rateMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([percentage, description]) => ({ description, percentage }));
}

// ============================================
// XML Generation
// ============================================

function generateHeader(
  businessInfo: SAFTBusinessInfo,
  year: number,
  startDate: string,
  endDate: string,
  now: string
): string {
  return [
    '  <Header>',
    '    <AuditFileVersion>1.0</AuditFileVersion>',
    `    <CompanyID>${escapeXml(businessInfo.vatRegNumber)}</CompanyID>`,
    `    <TaxRegistrationNumber>${escapeXml(businessInfo.vatRegNumber)}</TaxRegistrationNumber>`,
    `    <CompanyName>${escapeXml(businessInfo.name)}</CompanyName>`,
    '    <CompanyAddress>',
    `      <AddressDetail>${escapeXml(businessInfo.address)}</AddressDetail>`,
    '      <City>Dili</City>',
    '      <Country>TL</Country>',
    '    </CompanyAddress>',
    `    <FiscalYear>${year}</FiscalYear>`,
    `    <StartDate>${startDate}</StartDate>`,
    `    <EndDate>${endDate}</EndDate>`,
    '    <CurrencyCode>USD</CurrencyCode>',
    `    <DateCreated>${now}</DateCreated>`,
    '    <TaxEntity>Global</TaxEntity>',
    '    <ProductCompanyTaxID>000000000</ProductCompanyTaxID>',
    '    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>',
    '    <ProductID>Kaixa/OniT</ProductID>',
    '    <ProductVersion>1.0</ProductVersion>',
    '  </Header>',
  ].join('\n');
}

function generateMasterFiles(taxTable: TaxTableEntry[]): string {
  const entries = taxTable.map(
    (entry) =>
      [
        '        <TaxTableEntry>',
        '          <TaxType>IVA</TaxType>',
        '          <TaxCountryRegion>TL</TaxCountryRegion>',
        `          <Description>${escapeXml(entry.description)}</Description>`,
        `          <TaxPercentage>${entry.percentage}</TaxPercentage>`,
        '        </TaxTableEntry>',
      ].join('\n')
  );

  return [
    '  <MasterFiles>',
    '    <TaxTable>',
    ...entries,
    '    </TaxTable>',
    '  </MasterFiles>',
  ].join('\n');
}

function generateInvoiceXml(tx: KaixaTransaction): string {
  const invoiceNo = tx.receiptNumber || tx.id;
  const invoiceDate = formatDateISO(tx.timestamp);
  // SAFT InvoiceType: FS = simplified invoice (suitable for POS/retail)
  const invoiceType = 'FS';
  // InvoiceStatus: N = normal
  const invoiceStatus = 'N';

  // For 'in' transactions, the line amount is a CreditAmount (revenue).
  // For 'out' transactions, the line amount is a DebitAmount (expense).
  const amountTag =
    tx.type === 'in'
      ? `          <CreditAmount>${tx.netAmount.toFixed(2)}</CreditAmount>`
      : `          <DebitAmount>${tx.netAmount.toFixed(2)}</DebitAmount>`;

  const description = tx.note
    ? `${tx.category}: ${tx.note}`
    : tx.category;

  return [
    '      <Invoice>',
    `        <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>`,
    `        <InvoiceStatus>${invoiceStatus}</InvoiceStatus>`,
    `        <InvoiceDate>${invoiceDate}</InvoiceDate>`,
    `        <InvoiceType>${invoiceType}</InvoiceType>`,
    `        <SourceID>${escapeXml(tx.createdBy)}</SourceID>`,
    '        <DocumentTotals>',
    `          <TaxPayable>${tx.vatAmount.toFixed(2)}</TaxPayable>`,
    `          <NetTotal>${tx.netAmount.toFixed(2)}</NetTotal>`,
    `          <GrossTotal>${tx.amount.toFixed(2)}</GrossTotal>`,
    '        </DocumentTotals>',
    '        <Line>',
    '          <LineNumber>1</LineNumber>',
    amountTag,
    '          <Tax>',
    '            <TaxType>IVA</TaxType>',
    '            <TaxCountryRegion>TL</TaxCountryRegion>',
    `            <TaxPercentage>${tx.vatRate}</TaxPercentage>`,
    '          </Tax>',
    `          <Description>${escapeXml(description)}</Description>`,
    '        </Line>',
    '      </Invoice>',
  ].join('\n');
}

function generateSourceDocuments(transactions: KaixaTransaction[]): string {
  const totalDebit = transactions
    .filter((tx) => tx.type === 'out')
    .reduce((sum, tx) => sum + tx.netAmount, 0);

  const totalCredit = transactions
    .filter((tx) => tx.type === 'in')
    .reduce((sum, tx) => sum + tx.netAmount, 0);

  const invoices = transactions.map((tx) => generateInvoiceXml(tx));

  return [
    '  <SourceDocuments>',
    '    <SalesInvoices>',
    `      <NumberOfEntries>${transactions.length}</NumberOfEntries>`,
    `      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>`,
    `      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>`,
    ...invoices,
    '    </SalesInvoices>',
    '  </SourceDocuments>',
  ].join('\n');
}

// ============================================
// Main Export Function
// ============================================

/**
 * Generate a SAFT XML file for a given tenant and fiscal year.
 *
 * @param tenantId - Multi-tenant ID for Firestore isolation
 * @param businessInfo - Business details for the SAFT header
 * @param year - Fiscal year (e.g. 2026)
 * @returns Complete SAFT XML string
 */
export async function generateSAFT(
  tenantId: string,
  businessInfo: SAFTBusinessInfo,
  year: number
): Promise<string> {
  // Determine fiscal year boundaries (calendar year, Dili timezone)
  const { start, end } = getFiscalYearBounds(year);

  // Fetch all transactions for the period
  const transactions = await fetchTransactions(tenantId, start, end);

  // Build tax table from observed VAT rates
  const taxTable = buildTaxTable(transactions);

  // Format dates for the header
  const startDate = formatDateISO(start);
  const endDate = formatDateISO(new Date(end.getTime() - 1)); // Dec 31, not Jan 1 next year
  const now = formatDateISO(new Date());

  // Assemble the full XML document
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:TL_1.0">',
    generateHeader(businessInfo, year, startDate, endDate, now),
    '',
    generateMasterFiles(taxTable),
    '',
    generateSourceDocuments(transactions),
    '</AuditFile>',
  ].join('\n');

  return xml;
}
