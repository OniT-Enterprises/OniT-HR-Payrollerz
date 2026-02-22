/**
 * Seed Accounting Data (Journal Entries + General Ledger)
 * Creates realistic journal entries for the accounting dashboard
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../server/meza-api/serviceAccountKey.json', import.meta.url), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TENANT_ID = 'onit-enterprises';
const now = Timestamp.now();

const journalEntries = [
  // JE-1: January 2026 Payroll
  {
    id: 'je-2026-0001',
    entryNumber: 'JE-2026-0001',
    date: '2026-01-31',
    description: 'January 2026 Payroll - 8 employees',
    source: 'payroll',
    sourceId: 'payroll-run-jan-2026',
    sourceRef: 'January 2026 Payroll',
    lines: [
      { lineNumber: 1, accountId: 'acc-5110', accountCode: '5110', accountName: 'Salaries and Wages', debit: 8400, credit: 0, description: 'Gross salaries' },
      { lineNumber: 2, accountId: 'acc-5150', accountCode: '5150', accountName: 'INSS Employer Contribution', debit: 504, credit: 0, description: 'Employer INSS 6%' },
      { lineNumber: 3, accountId: 'acc-2210', accountCode: '2210', accountName: 'Salaries Payable', debit: 0, credit: 7560, description: 'Net pay to employees' },
      { lineNumber: 4, accountId: 'acc-2220', accountCode: '2220', accountName: 'Withholding Income Tax (WIT)', debit: 0, credit: 390, description: 'Employee WIT 10%' },
      { lineNumber: 5, accountId: 'acc-2230', accountCode: '2230', accountName: 'INSS Payable - Employee', debit: 0, credit: 336, description: 'Employee INSS 4%' },
      { lineNumber: 6, accountId: 'acc-2240', accountCode: '2240', accountName: 'INSS Payable - Employer', debit: 0, credit: 504, description: 'Employer INSS 6%' },
      { lineNumber: 7, accountId: 'acc-5140', accountCode: '5140', accountName: 'Subsidio Anual Expense', debit: 700, credit: 0, description: '13th month accrual 1/12' },
      { lineNumber: 8, accountId: 'acc-2250', accountCode: '2250', accountName: 'Subsidio Anual Accrued', debit: 0, credit: 700, description: '13th month liability' },
      { lineNumber: 9, accountId: 'acc-1130', accountCode: '1130', accountName: 'Cash in Bank - Payroll', debit: 0, credit: 114, description: 'Payroll bank charges' },
    ],
    totalDebit: 9604,
    totalCredit: 9604,
    status: 'posted',
    postedAt: now,
    postedBy: 'system',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-2: February 2026 Payroll
  {
    id: 'je-2026-0002',
    entryNumber: 'JE-2026-0002',
    date: '2026-02-28',
    description: 'February 2026 Payroll - 8 employees',
    source: 'payroll',
    sourceId: 'payroll-run-feb-2026',
    sourceRef: 'February 2026 Payroll',
    lines: [
      { lineNumber: 1, accountId: 'acc-5110', accountCode: '5110', accountName: 'Salaries and Wages', debit: 8400, credit: 0, description: 'Gross salaries' },
      { lineNumber: 2, accountId: 'acc-5150', accountCode: '5150', accountName: 'INSS Employer Contribution', debit: 504, credit: 0, description: 'Employer INSS 6%' },
      { lineNumber: 3, accountId: 'acc-2210', accountCode: '2210', accountName: 'Salaries Payable', debit: 0, credit: 7560, description: 'Net pay to employees' },
      { lineNumber: 4, accountId: 'acc-2220', accountCode: '2220', accountName: 'Withholding Income Tax (WIT)', debit: 0, credit: 390, description: 'Employee WIT 10%' },
      { lineNumber: 5, accountId: 'acc-2230', accountCode: '2230', accountName: 'INSS Payable - Employee', debit: 0, credit: 336, description: 'Employee INSS 4%' },
      { lineNumber: 6, accountId: 'acc-2240', accountCode: '2240', accountName: 'INSS Payable - Employer', debit: 0, credit: 504, description: 'Employer INSS 6%' },
      { lineNumber: 7, accountId: 'acc-5140', accountCode: '5140', accountName: 'Subsidio Anual Expense', debit: 700, credit: 0, description: '13th month accrual 1/12' },
      { lineNumber: 8, accountId: 'acc-2250', accountCode: '2250', accountName: 'Subsidio Anual Accrued', debit: 0, credit: 700, description: '13th month liability' },
      { lineNumber: 9, accountId: 'acc-1130', accountCode: '1130', accountName: 'Cash in Bank - Payroll', debit: 0, credit: 114, description: 'Payroll bank charges' },
    ],
    totalDebit: 9604,
    totalCredit: 9604,
    status: 'posted',
    postedAt: now,
    postedBy: 'system',
    fiscalYear: 2026,
    fiscalPeriod: 2,
  },
  // JE-3: January rent
  {
    id: 'je-2026-0003',
    entryNumber: 'JE-2026-0003',
    date: '2026-01-05',
    description: 'Office rent payment - January 2026',
    source: 'manual',
    lines: [
      { lineNumber: 1, accountId: 'acc-5200', accountCode: '5200', accountName: 'Rent Expense', debit: 2500, credit: 0, description: 'Monthly office rent' },
      { lineNumber: 2, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 0, credit: 2500, description: 'Bank transfer to landlord' },
    ],
    totalDebit: 2500,
    totalCredit: 2500,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-4: February rent
  {
    id: 'je-2026-0004',
    entryNumber: 'JE-2026-0004',
    date: '2026-02-05',
    description: 'Office rent payment - February 2026',
    source: 'manual',
    lines: [
      { lineNumber: 1, accountId: 'acc-5200', accountCode: '5200', accountName: 'Rent Expense', debit: 2500, credit: 0, description: 'Monthly office rent' },
      { lineNumber: 2, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 0, credit: 2500, description: 'Bank transfer to landlord' },
    ],
    totalDebit: 2500,
    totalCredit: 2500,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 2,
  },
  // JE-5: Opening balances
  {
    id: 'je-2026-0005',
    entryNumber: 'JE-2026-0005',
    date: '2026-01-01',
    description: 'Opening balances - company capitalization',
    source: 'manual',
    lines: [
      { lineNumber: 1, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 50000, credit: 0, description: 'Opening bank balance' },
      { lineNumber: 2, accountId: 'acc-1130', accountCode: '1130', accountName: 'Cash in Bank - Payroll', debit: 25000, credit: 0, description: 'Opening payroll account' },
      { lineNumber: 3, accountId: 'acc-1110', accountCode: '1110', accountName: 'Cash on Hand', debit: 2000, credit: 0, description: 'Petty cash' },
      { lineNumber: 4, accountId: 'acc-1530', accountCode: '1530', accountName: 'Equipment', debit: 15000, credit: 0, description: 'Office equipment' },
      { lineNumber: 5, accountId: 'acc-1550', accountCode: '1550', accountName: 'Furniture and Fixtures', debit: 8000, credit: 0, description: 'Office furniture' },
      { lineNumber: 6, accountId: 'acc-3100', accountCode: '3100', accountName: 'Share Capital', debit: 0, credit: 100000, description: 'Initial investment' },
    ],
    totalDebit: 100000,
    totalCredit: 100000,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-6: Consulting revenue
  {
    id: 'je-2026-0006',
    entryNumber: 'JE-2026-0006',
    date: '2026-01-15',
    description: 'Consulting services - UNMIT project',
    source: 'invoice',
    sourceRef: 'INV-2026-001',
    lines: [
      { lineNumber: 1, accountId: 'acc-1210', accountCode: '1210', accountName: 'Trade Receivables', debit: 12000, credit: 0, description: 'UNMIT consulting invoice' },
      { lineNumber: 2, accountId: 'acc-4120', accountCode: '4120', accountName: 'Consulting Revenue', debit: 0, credit: 12000, description: 'Consulting services rendered' },
    ],
    totalDebit: 12000,
    totalCredit: 12000,
    status: 'posted',
    postedAt: now,
    postedBy: 'system',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-7: Payment received
  {
    id: 'je-2026-0007',
    entryNumber: 'JE-2026-0007',
    date: '2026-02-10',
    description: 'Payment received - UNMIT project',
    source: 'payment',
    sourceRef: 'PMT-2026-001',
    lines: [
      { lineNumber: 1, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 12000, credit: 0, description: 'Bank deposit' },
      { lineNumber: 2, accountId: 'acc-1210', accountCode: '1210', accountName: 'Trade Receivables', debit: 0, credit: 12000, description: 'UNMIT invoice paid' },
    ],
    totalDebit: 12000,
    totalCredit: 12000,
    status: 'posted',
    postedAt: now,
    postedBy: 'system',
    fiscalYear: 2026,
    fiscalPeriod: 2,
  },
  // JE-8: Utilities
  {
    id: 'je-2026-0008',
    entryNumber: 'JE-2026-0008',
    date: '2026-01-20',
    description: 'Utilities - electricity and internet January',
    source: 'manual',
    lines: [
      { lineNumber: 1, accountId: 'acc-5310', accountCode: '5310', accountName: 'Electricity', debit: 350, credit: 0 },
      { lineNumber: 2, accountId: 'acc-5330', accountCode: '5330', accountName: 'Telephone and Internet', debit: 180, credit: 0 },
      { lineNumber: 3, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 0, credit: 530, description: 'EDTL and Telkomcel' },
    ],
    totalDebit: 530,
    totalCredit: 530,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-9: Vendor bill payment
  {
    id: 'je-2026-0009',
    entryNumber: 'JE-2026-0009',
    date: '2026-02-15',
    description: 'Bill payment - Timor IT Solutions server maintenance',
    source: 'bill',
    sourceRef: 'BILL-2026-001',
    lines: [
      { lineNumber: 1, accountId: 'acc-2110', accountCode: '2110', accountName: 'Trade Payables', debit: 1800, credit: 0, description: 'Clear vendor balance' },
      { lineNumber: 2, accountId: 'acc-1120', accountCode: '1120', accountName: 'Cash in Bank - Operating', debit: 0, credit: 1800, description: 'Bank transfer to vendor' },
    ],
    totalDebit: 1800,
    totalCredit: 1800,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 2,
  },
  // JE-10: Professional services expense (bill accrual)
  {
    id: 'je-2026-0010',
    entryNumber: 'JE-2026-0010',
    date: '2026-01-25',
    description: 'Legal consultation - employment contracts review',
    source: 'bill',
    sourceRef: 'BILL-2026-002',
    lines: [
      { lineNumber: 1, accountId: 'acc-5600', accountCode: '5600', accountName: 'Professional Services', debit: 3500, credit: 0, description: 'Legal consultation fees' },
      { lineNumber: 2, accountId: 'acc-2110', accountCode: '2110', accountName: 'Trade Payables', debit: 0, credit: 3500, description: 'Accrued vendor payable' },
    ],
    totalDebit: 3500,
    totalCredit: 3500,
    status: 'posted',
    postedAt: now,
    postedBy: 'admin@company.com',
    fiscalYear: 2026,
    fiscalPeriod: 1,
  },
  // JE-11: Draft entry (pending)
  {
    id: 'je-2026-0011',
    entryNumber: 'JE-2026-0011',
    date: '2026-02-20',
    description: 'Office supplies purchase - paper, toner',
    source: 'manual',
    lines: [
      { lineNumber: 1, accountId: 'acc-5400', accountCode: '5400', accountName: 'Office Supplies', debit: 275, credit: 0, description: 'Paper, toner, stationery' },
      { lineNumber: 2, accountId: 'acc-1110', accountCode: '1110', accountName: 'Cash on Hand', debit: 0, credit: 275, description: 'Paid from petty cash' },
    ],
    totalDebit: 275,
    totalCredit: 275,
    status: 'draft',
    fiscalYear: 2026,
    fiscalPeriod: 2,
  },
];

async function seedAccounting() {
  console.log('Seeding journal entries...');
  for (const je of journalEntries) {
    const { id, ...data } = je;
    await db.doc(`tenants/${TENANT_ID}/journalEntries/${id}`).set({
      ...data,
      createdAt: now,
      createdBy: data.postedBy || 'admin@company.com',
      updatedAt: now,
    });
  }
  console.log(`  Created ${journalEntries.length} journal entries`);

  console.log('Seeding general ledger entries...');
  let glCount = 0;
  for (const je of journalEntries) {
    if (je.status !== 'posted') continue;
    for (const line of je.lines) {
      const glId = `gl-${je.id}-${line.lineNumber}`;
      await db.doc(`tenants/${TENANT_ID}/generalLedger/${glId}`).set({
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        journalEntryId: je.id,
        entryNumber: je.entryNumber,
        entryDate: je.date,
        description: line.description || je.description,
        debit: line.debit,
        credit: line.credit,
        balance: 0,
        fiscalYear: je.fiscalYear,
        fiscalPeriod: je.fiscalPeriod,
        createdAt: now,
      });
      glCount++;
    }
  }
  console.log(`  Created ${glCount} general ledger entries`);
  console.log('Done!');
}

seedAccounting().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
