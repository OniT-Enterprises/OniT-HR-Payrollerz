import { describe, expect, it } from 'vitest';
import {
  calculateTLServicesTax,
  TL_SERVICES_TAX_RATE,
  TL_SERVICES_TAX_THRESHOLD,
  type TLDesignatedServiceReceipts,
} from '@/lib/tax/services-tax-tl';

/**
 * TL domestic services tax (Law 8/2008, Arts. 5-8, Annex I):
 *   - Only hotel, restaurant/bar, and telecommunications receipts are designated.
 *   - Combined monthly designated receipts < $500  -> 0%.
 *   - Combined monthly designated receipts >= $500 -> 5% on the WHOLE amount.
 *
 * Synthetic scenario: "Kafe Lafaek Lda" runs a small hotel + restaurant in Dili
 * and also earns non-designated consulting fees that must never be taxed here.
 */

const MONEY_TOLERANCE = 0.02;

function receipts(
  hotel: number,
  restaurantBar: number,
  telecom: number,
): TLDesignatedServiceReceipts {
  return {
    hotelServices: hotel,
    restaurantBarServices: restaurantBar,
    telecommunicationsServices: telecom,
  };
}

describe('TL domestic services tax — 5% $500 boundary', () => {
  it('exposes the statutory threshold and rate', () => {
    expect(TL_SERVICES_TAX_THRESHOLD).toBe(500);
    expect(TL_SERVICES_TAX_RATE).toBe(0.05);
  });

  it('charges 0% when combined receipts are $499.99 (one cent below threshold)', () => {
    // 249.99 hotel + 150.00 restaurant + 100.00 telecom = 499.99
    const result = calculateTLServicesTax(receipts(249.99, 150, 100));

    expect(result.totalDesignatedReceipts).toBe(499.99);
    expect(result.rate).toBe(0);
    expect(Math.abs(result.taxDue - 0)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(result.taxByService.hotelServices).toBe(0);
    expect(result.taxByService.restaurantBarServices).toBe(0);
    expect(result.taxByService.telecommunicationsServices).toBe(0);
  });

  it('charges 5% on the WHOLE amount at exactly $500 (threshold crossed)', () => {
    // 300 hotel + 150 restaurant + 50 telecom = 500.00
    const result = calculateTLServicesTax(receipts(300, 150, 50));

    expect(result.totalDesignatedReceipts).toBe(500);
    expect(result.rate).toBe(0.05);
    // 5% of the whole $500 = $25.00 (not just the amount above threshold)
    expect(Math.abs(result.taxDue - 25)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    // Per-service tax must reconcile to the total.
    const perServiceSum =
      result.taxByService.hotelServices +
      result.taxByService.restaurantBarServices +
      result.taxByService.telecommunicationsServices;
    expect(Math.abs(perServiceSum - result.taxDue)).toBeLessThanOrEqual(
      MONEY_TOLERANCE,
    );
    expect(Math.abs(result.taxByService.hotelServices - 15)).toBeLessThanOrEqual(
      MONEY_TOLERANCE,
    );
  });

  it('charges 5% of $800 = $40 when comfortably above threshold', () => {
    // 500 hotel + 200 restaurant + 100 telecom = 800.00
    const result = calculateTLServicesTax(receipts(500, 200, 100));

    expect(result.totalDesignatedReceipts).toBe(800);
    expect(result.rate).toBe(0.05);
    expect(Math.abs(result.taxDue - 40)).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(Math.abs(result.taxByService.hotelServices - 25)).toBeLessThanOrEqual(
      MONEY_TOLERANCE,
    );
    expect(
      Math.abs(result.taxByService.restaurantBarServices - 10),
    ).toBeLessThanOrEqual(MONEY_TOLERANCE);
    expect(
      Math.abs(result.taxByService.telecommunicationsServices - 5),
    ).toBeLessThanOrEqual(MONEY_TOLERANCE);
  });

  it('does not tax non-designated services — only the 3 designated fields count', () => {
    // The firm bills $10,000 of consulting (non-designated) but only $200 of
    // designated hotel/restaurant/telecom. Consulting has no field in the
    // designated-receipts input and must not pull the firm over the threshold.
    const result = calculateTLServicesTax(receipts(120, 80, 0));

    // Total reflects ONLY designated receipts ($200), well below $500.
    expect(result.totalDesignatedReceipts).toBe(200);
    expect(result.rate).toBe(0);
    expect(result.taxDue).toBe(0);
    // The result surface offers no channel for non-designated turnover.
    expect(Object.keys(result.receipts).sort()).toEqual([
      'hotelServices',
      'restaurantBarServices',
      'telecommunicationsServices',
    ]);
  });

  it('rejects negative or non-finite receipts rather than silently zeroing them', () => {
    expect(() => calculateTLServicesTax(receipts(-1, 0, 0))).toThrow(RangeError);
    expect(() =>
      calculateTLServicesTax(receipts(Number.NaN, 0, 0)),
    ).toThrow(RangeError);
  });
});
