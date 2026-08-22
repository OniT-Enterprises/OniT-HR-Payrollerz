/**
 * The debit side of a statutory tax payment — which GL accounts a remittance
 * charges, and for how much.
 *
 * Pure on purpose: this is the money decision, so it is unit-tested rather
 * than only reachable through Firestore. taxFilingService.recordPayment wraps
 * it and posts the result with the cash credit in one transaction.
 *
 * Two shapes, both cash-complete on their own:
 *
 *  - PAYROLL filings clear a liability that payroll already accrued
 *    (2220 WIT, 2230/2240 INSS).
 *  - BUSINESS taxes have no prior accrual anywhere in Xefe, so the debit goes
 *    straight to its proper home: 1330 Prepaid Income Tax for a Sec. 64
 *    instalment (Sec. 64.4 credits it against the annual liability, and
 *    Sec. 31(g) forbids expensing income tax at all) and 5940 Taxes and Duties
 *    for the Secs. 5-9 services tax, which the business genuinely bears.
 *
 * Assessed penalties and interest always go to 5950, never to the tax's own
 * account: Sec. 31(j),(l) make them non-deductible and the annual workpaper
 * excludes that account by name.
 */

import { addMoney } from '@/lib/currency';

/** Sec. 31(j),(l) — penalties, fines and late-payment interest. */
export const PENALTY_ACCOUNT_CODE = '5950';
export const PREPAID_INCOME_TAX_ACCOUNT_CODE = '1330';
export const TAXES_AND_DUTIES_ACCOUNT_CODE = '5940';

export type StatutoryPaymentFilingType =
  | 'monthly_wit'
  | 'inss_monthly'
  | 'installment_tax'
  | 'services_tax';

export interface StatutoryPaymentChargeLine {
  accountCode: string;
  amount: number;
  description: string;
}

export interface StatutoryPaymentChargeInput {
  type: StatutoryPaymentFilingType;
  period: string;
  /** Payroll filings only. */
  totalWITWithheld?: number;
  totalINSSEmployee?: number;
  totalINSSEmployer?: number;
  /** Business taxes only — the as-filed figure, the sole authority. */
  taxDue?: number;
  assessedPenalty?: number;
  assessedInterest?: number;
}

export function isBusinessTaxPaymentType(
  type: string,
): type is 'installment_tax' | 'services_tax' {
  return type === 'installment_tax' || type === 'services_tax';
}

export function isStatutoryPaymentType(
  type: string,
): type is StatutoryPaymentFilingType {
  return (
    type === 'monthly_wit' || type === 'inss_monthly' || isBusinessTaxPaymentType(type)
  );
}

/**
 * Every account code a payment of this type may touch. Resolved up front so a
 * missing or inactive account fails before the transaction opens — and so the
 * codes resolved can never drift from the codes posted.
 */
export function statutoryPaymentChargeCodes(
  type: StatutoryPaymentFilingType,
): string[] {
  switch (type) {
    case 'monthly_wit':
      return ['2220'];
    case 'inss_monthly':
      return ['2230', '2240'];
    case 'installment_tax':
      return [PREPAID_INCOME_TAX_ACCOUNT_CODE, PENALTY_ACCOUNT_CODE];
    case 'services_tax':
      return [TAXES_AND_DUTIES_ACCOUNT_CODE, PENALTY_ACCOUNT_CODE];
  }
}

export function buildStatutoryPaymentChargeLines(
  input: StatutoryPaymentChargeInput,
): StatutoryPaymentChargeLine[] {
  const { period } = input;

  if (input.type === 'monthly_wit') {
    return [
      {
        accountCode: '2220',
        amount: input.totalWITWithheld || 0,
        description: `Clear WIT payable - ${period}`,
      },
    ];
  }

  if (input.type === 'inss_monthly') {
    return [
      {
        accountCode: '2230',
        amount: input.totalINSSEmployee || 0,
        description: `Clear employee INSS payable - ${period}`,
      },
      {
        accountCode: '2240',
        amount: input.totalINSSEmployer || 0,
        description: `Clear employer INSS payable - ${period}`,
      },
    ];
  }

  // A payment can never be recorded before its declaration, so an absent
  // as-filed figure means a broken record, not a nil return.
  const taxDue = input.taxDue;
  if (!Number.isFinite(taxDue) || (taxDue as number) < 0) {
    throw new Error(
      'Record the declaration before its payment — the as-filed tax due is missing',
    );
  }

  const isInstallment = input.type === 'installment_tax';
  const lines: StatutoryPaymentChargeLine[] = [
    {
      accountCode: isInstallment
        ? PREPAID_INCOME_TAX_ACCOUNT_CODE
        : TAXES_AND_DUTIES_ACCOUNT_CODE,
      amount: taxDue as number,
      description: isInstallment
        ? `Income tax instalment - ${period}`
        : `Services tax - ${period}`,
    },
  ];

  const surcharge = addMoney(
    input.assessedPenalty || 0,
    input.assessedInterest || 0,
  );
  if (surcharge > 0) {
    lines.push({
      accountCode: PENALTY_ACCOUNT_CODE,
      amount: surcharge,
      description: `ATTL penalty/interest - ${period}`,
    });
  }
  return lines;
}
