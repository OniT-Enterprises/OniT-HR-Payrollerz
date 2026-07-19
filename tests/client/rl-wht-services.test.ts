import { describe, expect, it } from 'vitest';
import {
  calculateTLWithholding,
  type TLWithholdingInput,
} from '@/lib/tax/withholding-tl';

/**
 * Real-life scenario: a Timor-Leste hotel/restaurant company (synthetic firm
 * "Uma Furak Lda") pays several suppliers in one month and must decide how much
 * withholding tax to hold back on each payment.
 *
 * TL legal reference (Law 8/2008 / Taxes and Duties Act):
 *  - Non-resident service payment: 10% withholding from the first dollar (Art. 57).
 *  - Dividends: exempt income (Art. 29(f)) -> no withholding.
 *  - Treaty-reduced non-resident payment: withhold the reduced treaty rate (5%).
 *  - Resident specified services (Art. 53 / Annex VIII), e.g. construction: 2%.
 *
 * Tolerance for money comparisons: <= $0.02.
 */

const MONEY_TOLERANCE = 0.02;

function baseInput(overrides: Partial<TLWithholdingInput>): TLWithholdingInput {
  return {
    grossAmount: 0,
    category: 'general_service',
    recipientResidence: 'resident',
    recipientHasTimorLestePermanentEstablishment: false,
    payerIsIndividual: false,
    taxRegime: 'domestic',
    ...overrides,
  };
}

describe('TL non-wage withholding on supplier payments (Art. 53-60)', () => {
  it('withholds 10% on a non-resident service payment (Art. 57)', () => {
    // Uma Furak pays a Singapore-based IT consultancy (no TL branch) $10,000.
    const result = calculateTLWithholding(
      baseInput({
        grossAmount: 10000,
        category: 'general_service',
        recipientResidence: 'non_resident',
      }),
    );

    expect(result.rate).toBeCloseTo(0.1, 10);
    expect(result.withholdingTax).toBeCloseTo(1000, 2);
    expect(Math.abs(result.taxDue - 1000)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(Math.abs(result.netPayment - 9000)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.collectionMethod).toBe('payer_withholding');
    expect(result.legalBasis).toBe('Law 8/2008 Art. 57');
  });

  it('exempts dividends from withholding (Art. 29(f))', () => {
    // Uma Furak declares a $5,000 dividend to a shareholder.
    const result = calculateTLWithholding(
      baseInput({
        grossAmount: 5000,
        category: 'dividend',
        recipientResidence: 'non_resident',
      }),
    );

    expect(result.rate).toBe(0);
    expect(result.taxDue).toBe(0);
    expect(result.withholdingTax).toBe(0);
    expect(Math.abs(result.netPayment - 5000)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.collectionMethod).toBe('none');
    expect(result.legalBasis).toBe('Law 8/2008 Arts. 29(f) and 60(1)');
  });

  it('applies a documented 5% treaty rate to a non-resident payment', () => {
    // Portugal-resident supplier under a treaty capping withholding at 5%; $8,000.
    const result = calculateTLWithholding(
      baseInput({
        grossAmount: 8000,
        category: 'general_service',
        recipientResidence: 'non_resident',
        treatyRate: 0.05,
      }),
    );

    expect(result.rate).toBeCloseTo(0.05, 10);
    expect(Math.abs(result.taxDue - 400)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.withholdingTax).toBeCloseTo(400, 2);
    expect(Math.abs(result.netPayment - 7600)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.collectionMethod).toBe('payer_withholding');
  });

  it('rejects a treaty rate for a resident recipient', () => {
    // A treaty rate is meaningless for a resident supplier; the engine must guard it.
    expect(() =>
      calculateTLWithholding(
        baseInput({
          grossAmount: 8000,
          category: 'general_service',
          recipientResidence: 'resident',
          treatyRate: 0.05,
        }),
      ),
    ).toThrow(/treaty rate/i);
  });

  it('withholds the Art. 53 specified-service rate on resident construction (2%)', () => {
    // Uma Furak pays a resident construction company $12,000 for building works.
    const result = calculateTLWithholding(
      baseInput({
        grossAmount: 12000,
        category: 'construction',
        recipientResidence: 'resident',
        payerIsIndividual: false,
      }),
    );

    expect(result.rate).toBeCloseTo(0.02, 10);
    expect(Math.abs(result.taxDue - 240)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.withholdingTax).toBeCloseTo(240, 2);
    expect(Math.abs(result.netPayment - 11760)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.collectionMethod).toBe('payer_withholding');
    expect(result.legalBasis).toBe('Law 8/2008 Art. 53 and Annex VIII');
  });

  it('shifts Art. 53 collection to the recipient when the payer is an individual', () => {
    // Same construction service, but the payer is an individual: the recipient
    // self-withholds, so the payment is NOT reduced (taxDue stands, withheld = 0).
    const result = calculateTLWithholding(
      baseInput({
        grossAmount: 12000,
        category: 'construction',
        recipientResidence: 'resident',
        payerIsIndividual: true,
      }),
    );

    expect(Math.abs(result.taxDue - 240)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.withholdingTax).toBe(0);
    expect(Math.abs(result.netPayment - 12000)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.collectionMethod).toBe('recipient_self_withholding');
  });
});
