import { describe, expect, it } from 'vitest';
import {
  addToMoneyMap,
  calculateBillPaymentState,
  calculateInvoiceAmounts,
  calculateInvoiceCreditState,
  calculateInvoicePaymentState,
  calculateInvoiceRefundState,
  calculateInvoiceSettlementState,
  calculateTaxedTotal,
  getAccountNet,
  getDaysPastDue,
  getDaysPastDueLenient,
  getFiscalDateParts,
  normalizeJournalAmounts,
  parseBankAmount,
} from '@/lib/accounting/calculations';
import type { JournalEntryLine } from '@/types/accounting';

describe('accounting calculations', () => {
  it('uses per-line tax rates and rounds tax per line', () => {
    const result = calculateInvoiceAmounts([
      { description: 'A', quantity: 1, unitPrice: 0.05, amount: 0, vatRate: 10 },
      { description: 'B', quantity: 1, unitPrice: 0.05, amount: 0, vatRate: 10 },
      { description: 'Exempt', quantity: 2, unitPrice: 1.25, amount: 0, vatRate: 0 },
    ], 5);

    expect(result.subtotal).toBe(2.6);
    expect(result.taxAmount).toBe(0.02);
    expect(result.total).toBe(2.62);
    expect(result.items.map((item) => item.vatAmount)).toEqual([0.01, 0.01, 0]);
  });

  it('applies per-line discounts before tax and reports the discount total', () => {
    const result = calculateInvoiceAmounts([
      { description: 'Discounted', quantity: 1, unitPrice: 100, amount: 0, discount: 10, vatRate: 10 },
      { description: 'Full price', quantity: 2, unitPrice: 25, amount: 0 },
    ], 0);

    expect(result.items[0].amount).toBe(90);
    expect(result.subtotal).toBe(140);
    expect(result.discountTotal).toBe(10);
    expect(result.taxAmount).toBe(9);
    expect(result.total).toBe(149);
  });

  it('does not stamp the default rate onto lines without an override', () => {
    const result = calculateInvoiceAmounts([
      { description: 'Default', quantity: 1, unitPrice: 10, amount: 0 },
    ], 10);

    expect(result.items[0].vatRate).toBeUndefined();
    expect(result.taxAmount).toBe(1);
  });

  it('applies the default rate only when a line has no override', () => {
    const result = calculateInvoiceAmounts([
      { description: 'Default', quantity: 3, unitPrice: 2.35, amount: 0 },
      { description: 'Reduced', quantity: 1, unitPrice: 10, amount: 0, vatRate: 2.5 },
    ], 10);

    expect(result.subtotal).toBe(17.05);
    expect(result.taxAmount).toBe(0.96);
    expect(result.total).toBe(18.01);
  });

  it('calculates taxed bill totals at cent precision', () => {
    expect(calculateTaxedTotal(19.999, 10)).toEqual({
      netAmount: 20,
      taxAmount: 2,
      total: 22,
    });
  });

  it('rounds payments before applying them and closes exact balances', () => {
    expect(calculateInvoicePaymentState(10, 4.44, 5.555)).toEqual({
      amount: 5.56,
      amountPaid: 10,
      balanceDue: 0,
      status: 'paid',
    });
    expect(calculateBillPaymentState(10, 0, 3.333)).toEqual({
      amount: 3.33,
      amountPaid: 3.33,
      balanceDue: 6.67,
      status: 'partial',
    });
  });

  it('rejects sub-cent, non-finite, and over-balance payments', () => {
    expect(() => calculateInvoicePaymentState(10, 0, 0.004)).toThrow('at least $0.01');
    expect(() => calculateInvoicePaymentState(10, 0, Number.NaN)).toThrow('finite');
    expect(() => calculateBillPaymentState(10, 9, 1.01)).toThrow('exceeds');
  });

  it('settles invoices with payments and credit notes without losing cents', () => {
    expect(calculateInvoiceSettlementState(100, 40, 60)).toEqual({
      amountPaid: 40,
      creditedAmount: 60,
      balanceDue: 0,
      status: 'paid',
    });
    expect(calculateInvoiceSettlementState(100, 0, 100)).toEqual({
      amountPaid: 0,
      creditedAmount: 100,
      balanceDue: 0,
      status: 'credited',
    });
    expect(calculateInvoiceCreditState(10, 2.22, 1.11, 3.333)).toEqual({
      amount: 3.33,
      amountPaid: 2.22,
      creditedAmount: 4.44,
      balanceDue: 3.34,
      status: 'partial',
    });
  });

  it('reopens a settled invoice when a receipt is refunded', () => {
    expect(calculateInvoiceRefundState(100, 100, 0, 25, 'sent')).toEqual({
      amount: 25,
      amountPaid: 75,
      creditedAmount: 0,
      balanceDue: 25,
      status: 'partial',
    });
    expect(calculateInvoiceRefundState(100, 25, 75, 25, 'overdue')).toEqual({
      amount: 25,
      amountPaid: 0,
      creditedAmount: 75,
      balanceDue: 25,
      status: 'partial',
    });
  });

  it('rejects over-crediting and over-refunding', () => {
    expect(() => calculateInvoiceCreditState(100, 80, 10, 10.01)).toThrow('exceeds');
    expect(() => calculateInvoiceRefundState(100, 5, 0, 5.01)).toThrow('exceeds');
  });

  it('normalizes journal lines and requires exact balance at cents', () => {
    const lines: JournalEntryLine[] = [
      makeLine(1, 10.004, 0),
      makeLine(2, 0, 10.001),
    ];
    const normalized = normalizeJournalAmounts(lines, 10.004, 10.001);

    expect(normalized.totalDebit).toBe(10);
    expect(normalized.totalCredit).toBe(10);
    expect(normalized.lines[0].debit).toBe(10);
  });

  it('rejects a journal that differs by one cent', () => {
    const lines = [makeLine(1, 10, 0), makeLine(2, 0, 9.99)];
    expect(() => normalizeJournalAmounts(lines, 10, 9.99)).toThrow('must balance');
  });

  it('combines legacy and current account IDs through the canonical code map', () => {
    const byId = new Map<string, number>();
    const byCode = new Map<string, number>();
    addToMoneyMap(byId, 'account-doc-id', 40);
    addToMoneyMap(byId, '1210', 60);
    addToMoneyMap(byCode, '1210', 40);
    addToMoneyMap(byCode, '1210', 60);

    expect(getAccountNet(byId, byCode, 'account-doc-id', '1210')).toBe(100);
  });

  it('calculates accounting dates without timezone or DST drift', () => {
    expect(getDaysPastDue('2026-03-31', '2026-04-01')).toBe(1);
    expect(getDaysPastDue('2026-04-02', '2026-04-01')).toBe(-1);
    expect(getFiscalDateParts('2026-01-01')).toEqual({ year: 2026, period: 1 });
    expect(() => getFiscalDateParts('2026-13-01')).toThrow('Invalid accounting date');
  });

  it('tolerates legacy due-date formats in report contexts', () => {
    expect(getDaysPastDueLenient('2026-03-31', '2026-04-01')).toBe(1);
    expect(getDaysPastDueLenient('2026-03-31T15:00:00.000Z', '2026-04-01')).toBe(1);
    expect(getDaysPastDueLenient(new Date(2026, 2, 31), '2026-04-01')).toBe(1);
    expect(getDaysPastDueLenient('not a date', '2026-04-01')).toBe(0);
    expect(getDaysPastDueLenient(undefined, '2026-04-01')).toBe(0);
  });

  it('parses common bank amount formats at currency precision', () => {
    expect(parseBankAmount('$1,234.56')).toBe(1234.56);
    expect(parseBankAmount('1.234,56')).toBe(1234.56);
    expect(parseBankAmount('(42,10)')).toBe(-42.1);
    expect(parseBankAmount('not-a-number')).toBe(0);
    expect(parseBankAmount('1.234')).toBe(1234);
    expect(parseBankAmount('€1.234.567')).toBe(1234567);
    expect(parseBankAmount('12.34')).toBe(12.34);
  });
});

function makeLine(lineNumber: number, debit: number, credit: number): JournalEntryLine {
  return {
    lineNumber,
    accountId: `account-${lineNumber}`,
    accountCode: String(1000 + lineNumber),
    accountName: `Account ${lineNumber}`,
    debit,
    credit,
  };
}
