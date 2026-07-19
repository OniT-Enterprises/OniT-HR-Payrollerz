import { describe, expect, it } from 'vitest';
import { invoiceTaxRateLabel } from '@/components/money/InvoicePaper';

const line = (over: Partial<{ quantity: number; unitPrice: number; discount: number; vatRate: number }> = {}) => ({
  quantity: 1,
  unitPrice: 100,
  ...over,
});

describe('invoiceTaxRateLabel', () => {
  it('shows the invoice-level rate when every line uses it (no per-line vatRate)', () => {
    expect(invoiceTaxRateLabel([line(), line()], 10)).toBe('Tax (10%)');
  });

  it('shows the shared rate when all taxed lines carry the same explicit rate', () => {
    expect(invoiceTaxRateLabel([line({ vatRate: 5 }), line({ vatRate: 5 })], 10)).toBe('Tax (5%)');
  });

  it('shows "Tax (mixed)" when taxed lines carry different rates', () => {
    expect(invoiceTaxRateLabel([line({ vatRate: 10 }), line({ vatRate: 5 })], 10)).toBe('Tax (mixed)');
  });

  it('mixes when a per-line rate differs from the invoice default', () => {
    // Second line falls back to the 10% default; first is explicit 2.5%.
    expect(invoiceTaxRateLabel([line({ vatRate: 2.5 }), line()], 10)).toBe('Tax (mixed)');
  });

  it('does not treat a 0%/exempt line as a second rate', () => {
    expect(invoiceTaxRateLabel([line({ vatRate: 10 }), line({ vatRate: 0 })], 10)).toBe('Tax (10%)');
  });

  it('ignores zero-net lines when deciding the rate', () => {
    // A qty-0 line at a different rate carries no tax, so it cannot make it mixed.
    expect(invoiceTaxRateLabel([line(), line({ quantity: 0, vatRate: 5 })], 10)).toBe('Tax (10%)');
  });

  it('preserves fractional rates', () => {
    expect(invoiceTaxRateLabel([line({ vatRate: 8.5 })], 0)).toBe('Tax (8.5%)');
  });

  it('falls back to a bare "Tax" when no positive rate can be determined', () => {
    expect(invoiceTaxRateLabel([line()], 0)).toBe('Tax');
  });
});
