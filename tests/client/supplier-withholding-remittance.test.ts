import { describe, expect, it } from 'vitest';
import {
  addSupplierWithholdingLiability,
  calculateSupplierWithholdingPosition,
  totalSupplierWithholdingLiability,
  validateSupplierWithholdingRemittance,
} from '@/lib/tax/supplier-withholding-remittance';
import type { TLBillWithholdingTotals } from '@/lib/tax/bill-withholding';

function totals(): TLBillWithholdingTotals {
  return {
    general_service: { payment: 1_000, tax: 100, rates: [0.1] },
    construction: { payment: 1_000, tax: 20, rates: [0.02] },
    construction_consulting: { payment: 0, tax: 0, rates: [] },
    air_or_sea_transport: { payment: 0, tax: 0, rates: [] },
    mining_or_mining_support: { payment: 0, tax: 0, rates: [] },
    royalty: { payment: 0, tax: 0, rates: [] },
    rent: { payment: 0, tax: 0, rates: [] },
    prize: { payment: 0, tax: 0, rates: [] },
  };
}

describe('supplier withholding remittance controls', () => {
  it('totals the payer-withheld tax lines with currency precision', () => {
    expect(totalSupplierWithholdingLiability(totals())).toBe(120);
    expect(addSupplierWithholdingLiability(120, 13.33)).toBe(133.33);
  });

  it('keeps filing liability, partial remittance, and outstanding separate', () => {
    expect(calculateSupplierWithholdingPosition('2026-06', 120, [
      { period: '2026-06', amount: 40.01 },
      { period: '2026-06', amount: 9.99 },
    ])).toEqual({
      period: '2026-06',
      liability: 120,
      remitted: 50,
      outstanding: 70,
      status: 'partial',
    });
  });

  it('marks a period paid only at exact cent equality', () => {
    expect(calculateSupplierWithholdingPosition('2026-06', 120, [
      { period: '2026-06', amount: 120 },
    ]).status).toBe('paid');
  });

  it('does not invent a payment for a zero-liability period', () => {
    expect(calculateSupplierWithholdingPosition('2026-06', 0, [])).toEqual({
      period: '2026-06',
      liability: 0,
      remitted: 0,
      outstanding: 0,
      status: 'not_due',
    });
  });

  it('rejects overpayment and cross-period payment records', () => {
    expect(() => calculateSupplierWithholdingPosition('2026-06', 100, [
      { period: '2026-06', amount: 100.01 },
    ])).toThrow(/exceed/i);
    expect(() => calculateSupplierWithholdingPosition('2026-06', 100, [
      { period: '2026-05', amount: 20 },
    ])).toThrow(/different period/i);
  });

  it('requires a reference and actual proof before clearing 2320', () => {
    const base = {
      period: '2026-06',
      paymentDate: '2026-07-15',
      amount: 100,
      method: 'bank_transfer' as const,
      paymentReference: 'TRX-100',
      proofUrl: 'https://storage.example/proof.pdf',
    };
    expect(validateSupplierWithholdingRemittance(base, 120)).toEqual(base);
    expect(() => validateSupplierWithholdingRemittance(
      { ...base, paymentReference: ' ' },
      120,
    )).toThrow(/reference/i);
    expect(() => validateSupplierWithholdingRemittance(
      { ...base, proofUrl: '' },
      120,
    )).toThrow(/upload/i);
  });

  it('rejects invalid dates, periods, amounts, and overpayments', () => {
    const base = {
      period: '2026-06',
      paymentDate: '2026-07-15',
      amount: 100,
      method: 'cash_at_bnu' as const,
      paymentReference: 'BNU-100',
      proofUrl: 'https://storage.example/proof.pdf',
    };
    expect(() => validateSupplierWithholdingRemittance({ ...base, period: '2026-13' }, 120)).toThrow(/YYYY-MM/);
    expect(() => validateSupplierWithholdingRemittance({ ...base, paymentDate: '2026-02-30' }, 120)).toThrow(/calendar date/);
    expect(() => validateSupplierWithholdingRemittance({ ...base, amount: 0 }, 120)).toThrow(/0.01/);
    expect(() => validateSupplierWithholdingRemittance({ ...base, amount: 120.01 }, 120)).toThrow(/exceeds/i);
  });
});
