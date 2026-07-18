/** Domestic income-tax installments under Law 8/2008, Art. 64. */

import { applyRate } from '@/lib/currency';

export const TL_INCOME_TAX_INSTALLMENT_RATE = 0.005;
export const TL_QUARTERLY_INSTALLMENT_TURNOVER_LIMIT = 1_000_000;

export type TLIncomeTaxInstallmentFrequency = 'monthly' | 'quarterly';

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

export function calculateTLIncomeTaxInstallment(periodTurnover: number): number {
  if (!Number.isFinite(periodTurnover) || periodTurnover < 0) {
    throw new RangeError('Period turnover must be a non-negative finite amount.');
  }
  return applyRate(periodTurnover, TL_INCOME_TAX_INSTALLMENT_RATE);
}
