import { describe, expect, it } from 'vitest';
import {
  TL_INCOME_TAX_INSTALLMENT_RATE,
  TL_QUARTERLY_INSTALLMENT_TURNOVER_LIMIT,
  calculateTLIncomeTaxInstallment,
  getTLIncomeTaxInstallmentFrequency,
} from '@/lib/tax/income-tax-installment-tl';

/**
 * TL income-tax installment regime (Law 8/2008, Art. 64):
 *   prior-year turnover <= $1,000,000  -> quarterly, 0.5% of period turnover
 *   prior-year turnover  > $1,000,000  -> monthly regime
 *
 * Synthetic scenarios (invented names / numbers, no client data):
 *   - "Kafé Lafaek Dili": a small cafe, prior-year turnover $248,500 -> quarterly.
 *   - "Loron Naroman Trading": a large importer, prior-year turnover $2,400,000 -> monthly.
 */

const CENT = 0.02;

describe('rl-wit-quarterly: monthly vs quarterly income-tax regime by turnover', () => {
  it('constants encode the Art.64 rate and $1M boundary', () => {
    expect(TL_INCOME_TAX_INSTALLMENT_RATE).toBe(0.005);
    expect(TL_QUARTERLY_INSTALLMENT_TURNOVER_LIMIT).toBe(1_000_000);
  });

  it('small business (turnover below $1M) files quarterly', () => {
    // Kafe Lafaek Dili: prior-year turnover well under the cap.
    expect(getTLIncomeTaxInstallmentFrequency(248_500)).toBe('quarterly');
    // A brand-new business with no prior turnover also defaults to quarterly.
    expect(getTLIncomeTaxInstallmentFrequency(0)).toBe('quarterly');
  });

  it('large business (turnover above $1M) files monthly', () => {
    // Loron Naroman Trading: prior-year turnover far above the cap.
    expect(getTLIncomeTaxInstallmentFrequency(2_400_000)).toBe('monthly');
  });

  it('switches exactly at the $1,000,000 boundary (inclusive -> quarterly)', () => {
    // Law: "<= $1M -> quarterly". So exactly $1M stays quarterly...
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000)).toBe('quarterly');
    // ...and one cent above tips into the monthly regime.
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000.01)).toBe('monthly');
  });

  it('rejects a negative or non-finite prior-year turnover', () => {
    expect(() => getTLIncomeTaxInstallmentFrequency(-1)).toThrow(RangeError);
    expect(() => getTLIncomeTaxInstallmentFrequency(Number.NaN)).toThrow(RangeError);
  });

  it('quarterly installment is 0.5% of the period turnover', () => {
    // Kafe Lafaek Dili Q1 receipts: $61,200 -> 0.005 * 61200 = $306.00
    expect(calculateTLIncomeTaxInstallment(61_200)).toBeCloseTo(306.0, 2);
    // Q2 receipts: $47,850 -> 0.005 * 47850 = $239.25
    expect(calculateTLIncomeTaxInstallment(47_850)).toBeCloseTo(239.25, 2);
  });

  it('rounds the installment half-up to the cent', () => {
    // $250.50 turnover -> 0.005 * 250.50 = 1.2525 -> rounds to $1.25
    expect(calculateTLIncomeTaxInstallment(250.5)).toBeCloseTo(1.25, 2);
    // $251.00 turnover -> 0.005 * 251 = 1.255 -> half-up -> $1.26
    expect(calculateTLIncomeTaxInstallment(251)).toBeCloseTo(1.26, 2);
  });

  it('law-derived vs engine: exact installment amounts within a cent', () => {
    const cases = [
      { turnover: 61_200, expected: 61_200 * 0.005 },
      { turnover: 47_850, expected: 47_850 * 0.005 },
      { turnover: 0, expected: 0 },
      { turnover: 1_000_000, expected: 1_000_000 * 0.005 },
    ];
    for (const { turnover, expected } of cases) {
      expect(Math.abs(calculateTLIncomeTaxInstallment(turnover) - expected))
        .toBeLessThanOrEqual(CENT);
    }
  });

  it('rejects a negative or non-finite period turnover for the installment', () => {
    expect(() => calculateTLIncomeTaxInstallment(-100)).toThrow(RangeError);
    expect(() => calculateTLIncomeTaxInstallment(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
