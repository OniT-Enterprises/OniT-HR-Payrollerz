import { describe, expect, it } from 'vitest';
import { validateTLIban } from '@/lib/tlBanking';
import {
  generateBankFile,
  validateBankTransferRecords,
} from '@/lib/bank-transfers';
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
