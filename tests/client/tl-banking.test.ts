import { describe, expect, it } from 'vitest';
import { ATTL_TAX_ACCOUNTS, validateTLIban } from '@/lib/tlBanking';
import {
  generateBankFile,
  validateBankTransferRecords,
} from '@/lib/bank-transfers';
import { buildBankCoverEmail } from '@/lib/bank-transfers/payment-pack';
import type { PayrollRecord, PayrollRun } from '@/types/payroll';
import type { Employee } from '@/services/employeeService';

describe('TL IBAN validation', () => {
  it('accepts the published ATTL wage-tax account (real-world IBAN)', () => {
    const result = validateTLIban('TL38 0020 0028 6442 1000 162');
    expect(result.valid).toBe(true);
    expect(result.iban).toBe('TL380020002864421000162');
    expect(result.bankCode).toBe('002');
    expect(result.bankName).toContain('BNU');
    expect(result.formatted).toBe('TL38 0020 0028 6442 1000 162');
  });

  it('accepts the published ATTL special-withholding account', () => {
    const result = validateTLIban(ATTL_TAX_ACCOUNTS.accounts.specialWithholdingTax);
    expect(result.valid).toBe(true);
    expect(result.iban).toBe('TL380020002868301000162');
    expect(result.bankName).toContain('BNU');
  });

  it('rejects wrong check digits, wrong length, and non-TL prefixes', () => {
    expect(validateTLIban('TL390020002864421000162').valid).toBe(false);
    expect(validateTLIban('TL38002000286442100016').valid).toBe(false);
    expect(validateTLIban('PT50000201231234567890154').valid).toBe(false);
    expect(validateTLIban('').valid).toBe(false);
    expect(validateTLIban('TL38 0020 0028 644X 1000 162').valid).toBe(false);
  });
});

describe('bank salary file safety', () => {
  const record = {
    employeeId: 'employee-1',
    employeeName: 'Ana Soares',
    employeeNumber: 'E001',
    netPay: 500,
  } as PayrollRecord;
  const employee = {
    id: 'employee-1',
    bankName: 'BNU',
    bankAccountNumber: '123456789',
  } as Employee;

  it('rejects incomplete beneficiary details before generating files', () => {
    expect(() =>
      validateBankTransferRecords(
        [record],
        [{ ...employee, bankAccountNumber: '' }],
      ),
    ).toThrow(/account number missing/i);
  });

  it('rejects a missing company debit account', () => {
    expect(() =>
      generateBankFile('BNU', {
        payrollRun: {
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
        } as PayrollRun,
        records: [record],
        employees: [employee],
        valueDate: '2026-07-25',
        companyName: 'Example Lda',
        companyAccountNumber: '',
      }),
    ).toThrow(/debit account/i);
  });
});

// April distinguishes English ("APR"/"April") from Portuguese ("Abril"),
// proving the month is actually localized rather than passed through.
describe('bank period label localization (finding 11)', () => {
  const bnuRecord = {
    employeeId: 'employee-1',
    employeeName: 'Ana Soares',
    employeeNumber: 'E001',
    netPay: 500,
  } as PayrollRecord;
  const bnuEmployee = {
    id: 'employee-1',
    bankName: 'BNU',
    bankAccountNumber: '123456789',
  } as Employee;

  const buildBNUSummary = () =>
    generateBankFile('BNU', {
      payrollRun: {
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      } as PayrollRun,
      records: [bnuRecord],
      employees: [bnuEmployee],
      valueDate: '2026-05-05',
      companyName: 'Example Lda',
      companyAccountNumber: '9876543210',
    }).summary;

  it('exposes the period as a canonical YYYY-MM key, not an English label', () => {
    expect(buildBNUSummary().payrollPeriod).toBe('2026-04');
  });

  it('renders the Portuguese full month on the bank cover email', () => {
    const email = buildBankCoverEmail(buildBNUSummary(), {
      name: 'Example Lda',
      accountNumber: '9876543210',
    });
    // Portuguese full month, per payment-pack.ts's format contract.
    expect(email).toContain('Abril de 2026');
    // Never the English label, its abbreviation, or the raw machine key.
    expect(email).not.toContain('April');
    expect(email).not.toContain('APR');
    expect(email).not.toContain('2026-04');
  });
});

describe('CSV UTF-8 BOM for Excel (finding 12)', () => {
  const payrollRun = {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  } as PayrollRun;
  const baseInput = {
    payrollRun,
    valueDate: '2026-05-05',
    companyName: 'Example Lda',
    companyAccountNumber: '9876543210',
  };
  // Accented TL/PT name that corrupts in Excel without a BOM.
  const accentedName = 'Conceição Gonçalves';

  it('prepends a UTF-8 BOM to the ANZ CSV so accented names survive Excel', () => {
    const result = generateBankFile('ANZ', {
      ...baseInput,
      records: [
        {
          employeeId: 'employee-2',
          employeeName: accentedName,
          employeeNumber: 'E002',
          netPay: 750,
        } as PayrollRecord,
      ],
      employees: [
        {
          id: 'employee-2',
          bankName: 'ANZ',
          bankAccountNumber: '55554444',
        } as Employee,
      ],
    });
    expect(result.content.charCodeAt(0)).toBe(0xfeff);
    expect(result.content.startsWith('﻿')).toBe(true);
    expect(result.content).toContain(accentedName);
  });

  it('does NOT add a BOM to the Mandiri fixed-width upload file', () => {
    const result = generateBankFile('MANDIRI', {
      ...baseInput,
      records: [
        {
          employeeId: 'employee-3',
          employeeName: accentedName,
          employeeNumber: 'E003',
          netPay: 600,
        } as PayrollRecord,
      ],
      employees: [
        {
          id: 'employee-3',
          bankName: 'MANDIRI',
          bankAccountNumber: '11112222',
        } as Employee,
      ],
    });
    // A BOM would shift every fixed-width byte offset; the first byte must
    // still be the 'H' header record type.
    expect(result.content.charCodeAt(0)).not.toBe(0xfeff);
    expect(result.content.startsWith('H')).toBe(true);
  });
});
