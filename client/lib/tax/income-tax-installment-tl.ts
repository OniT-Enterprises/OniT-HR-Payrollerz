/** Domestic income-tax installments under Law 8/2008, Art. 64. */

import { applyRate } from '@/lib/currency';

export const TL_INCOME_TAX_INSTALLMENT_RATE = 0.005;
export const TL_QUARTERLY_INSTALLMENT_TURNOVER_LIMIT = 1_000_000;

export type TLIncomeTaxInstallmentFrequency = 'monthly' | 'quarterly';

/**
 * What the tenant is actually registered for at ATTL.
 *
 * `auto` applies Sec. 64.1/64.2 to the prior year's turnover, which is what
 * the law prescribes. `monthly` exists because it is what a real portal
 * account can be set to REGARDLESS of turnover: taxpayers well under the $1m
 * line are issued monthly "Domestic Installment Tax" assessments, and remitting
 * evidence shows both cadences in the wild among small businesses. Paying
 * monthly is never a shortfall — Sec. 64.4 credits every instalment paid in the
 * year against the same annual liability — so the override only ever tightens
 * the cadence. There is deliberately no `quarterly` override: above $1m,
 * Sec. 64.1 requires monthly and Xefe will not help a taxpayer under-remit.
 */
export type TLIncomeTaxInstallmentFrequencySetting = 'auto' | 'monthly';

export function getTLIncomeTaxInstallmentFrequency(
  priorTaxYearTurnover: number,
): TLIncomeTaxInstallmentFrequency {
  if (!Number.isFinite(priorTaxYearTurnover) || priorTaxYearTurnover < 0) {
    throw new RangeError('Prior-year turnover must be a non-negative finite amount.');
  }
  return priorTaxYearTurnover <= TL_QUARTERLY_INSTALLMENT_TURNOVER_LIMIT
    ? 'quarterly'
    : 'monthly';
}

/**
 * The cadence to file on: the statutory one, unless the tenant has told us it
 * is registered monthly.
 */
export function resolveTLIncomeTaxInstallmentFrequency(
  priorTaxYearTurnover: number,
  setting: TLIncomeTaxInstallmentFrequencySetting | undefined,
): TLIncomeTaxInstallmentFrequency {
  const statutory = getTLIncomeTaxInstallmentFrequency(priorTaxYearTurnover);
  return setting === 'monthly' ? 'monthly' : statutory;
}

export function calculateTLIncomeTaxInstallment(periodTurnover: number): number {
  if (!Number.isFinite(periodTurnover) || periodTurnover < 0) {
    throw new RangeError('Period turnover must be a non-negative finite amount.');
  }
  return applyRate(periodTurnover, TL_INCOME_TAX_INSTALLMENT_RATE);
}
