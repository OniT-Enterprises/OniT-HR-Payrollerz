/**
 * Timor-Leste Payroll Constants
 * Tax rates, INSS, and labor law requirements
 * Based on:
 * - Tax Law: Law 8/2008 (Income Tax)
 * - Social Security: Law 12/2016, Decree-Law 20/2017, and Decree-Law 30/2021
 * - Labor Code: Law 4/2012
 */

// ============================================
// WITHHOLDING INCOME TAX (WIT - Impostu Retidu)
// ============================================

/**
 * Timor-Leste Wage Income Tax (WIT / Impostu Retidu)
 * Legal basis: Decree Law No. 8/2008 (Taxes and Duties Act), Part VI, Schedule V
 * Confirmed by ATTL (attl.gov.tl/wage-income-tax/)
 *
 * - Residents: 10% on income exceeding $500/month ($6,000/year)
 * - Non-residents: 10% on ALL income (no threshold, from first dollar)
 * - Wages generally include allowances and reimbursements unless specifically exempt
 *
 * Note: Some older references cite "20% flat" for non-residents — this traces back to
 * UNTAET Regulation 2000/32 (general income tax, pre-independence) which was superseded
 * by Decree Law 8/2008. The current correct rate is 10%.
 */
export const TL_INCOME_TAX = {
  // Tax rate for residents and non-residents
  rate: 0.10,  // 10%

  // Monthly threshold for residents (no tax below this)
  residentThreshold: 500,  // $500 USD

  // Non-residents pay from first dollar
  nonResidentThreshold: 0,

  // Annual threshold (for yearly calculations)
  annualResidentThreshold: 6000,  // $500 x 12
};

// ============================================
// SOCIAL SECURITY (INSS - Instituto Nacional de Segurança Social)
// ============================================

/**
 * INSS Contribution Rates (Decree-Law 20/2017, Arts. 8-10, as amended by
 * Decree-Law 30/2021)
 * Total: 10% (4% employee + 6% employer)
 * Base: remuneracao contributiva (recurring remuneration, individual
 * performance/productivity pay, annual subsidy, and contractual/legal supplements).
 * Excluded by Art. 9: overtime; employer-economic-performance profit awards;
 * food/transport/board/lodging/travel expense allowances; representation expenses;
 * and other extraordinary benefits. A generic bonus must therefore be classified.
 */
export const TL_INSS = {
  // Employee contribution
  employeeRate: 0.04,  // 4%

  // Employer contribution
  employerRate: 0.06,  // 6%

  // Combined rate
  totalRate: 0.10,  // 10%

  // Minimum salary for INSS
  minimumSalary: 115,  // Current minimum wage ~$115

  // Items excluded from the contribution base by DL 20/2017 Art. 9.
  excludedItems: [
    'per_diem',
    'travel_allowance',
    'food_allowance',
    'transport_allowance',
    'housing_allowance',
    'overtime',
    'company_profit_award',
    'extraordinary_benefit',
    'reimbursement',
    'representation_expense',
  ],
};

/**
 * Small-employer contribution reduction — DL 20/2017 Art. 86 ("Dispensa
 * contributiva"), kept verbatim by DL 30/2021. Private-law employers with 10 or
 * fewer workers, of whom ≥60% are Timorese nationals, and whose contributions
 * are regularized, get a REDUCTION of the EMPLOYER share only (never the
 * employee 4%), on a fixed sunset schedule. INSS's own portal auto-applies it,
 * so a flat 6% overstates employer cost and mismatches the payment guide for
 * eligible small businesses through Dec 2026. From 2027 the general rate returns.
 *
 * NB: NOT "Lei 27/2017" — a different, lapsed support scheme the firm miscited.
 * See docs/MINED_SIGNOFF_ANSWERS_JUL2026.md §3.
 */
const TL_SMALL_EMPLOYER_REDUCTION_BY_YEAR: Record<number, number> = {
  2017: 0.7, 2018: 0.7,
  2019: 0.5, 2020: 0.5,
  2021: 0.3, 2022: 0.3,
  2023: 0.2, 2024: 0.2,
  2025: 0.1, 2026: 0.1,
  // 2027+ → no reduction (returns the general employer rate).
};

/**
 * Art. 86 eligibility headcount: the discount applies to employers with 10 or
 * fewer workers — the right lapses while the headcount is above this.
 */
export const TL_SMALL_EMPLOYER_MAX_WORKERS = 10;

/** Employer-share reduction fraction for a given wage year (0 outside 2017–2026). */
export function tlSmallEmployerReductionFactor(year: number): number {
  return TL_SMALL_EMPLOYER_REDUCTION_BY_YEAR[year] ?? 0;
}

/**
 * Effective employer INSS rate for a small-employer that qualifies for the
 * Art. 86 discount in the given wage year. 2025–26 → 5.4%; 2027+ → 6% (base).
 */
export function tlSmallEmployerEmployerRate(
  year: number,
  baseEmployerRate: number = TL_INSS.employerRate,
): number {
  const reduced = baseEmployerRate * (1 - tlSmallEmployerReductionFactor(year));
  // Two-decimal rate (e.g. 0.054) — INSS applies whole-percentage-point steps.
  return Math.round(reduced * 10000) / 10000;
}

const TL_SOCIAL_PENSION_USD = 60;

/**
 * Optional registration (voluntary) uses Social Pension (SP) multiples as contribution bands.
 * Reference: INSS contributions guidance.
 */
const TL_INSS_OPTIONAL_CONTRIBUTION_BAND_MULTIPLIERS = [
  2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 55, 70, 95, 125, 160, 200,
] as const;

interface TLInssContributionBand {
  band: number;
  multiplier: number;
  base: number;
}

const getTLInssOptionalContributionBands = (
  socialPensionUSD: number = TL_SOCIAL_PENSION_USD
): TLInssContributionBand[] => {
  return TL_INSS_OPTIONAL_CONTRIBUTION_BAND_MULTIPLIERS.map((multiplier, index) => ({
    band: index + 1,
    multiplier,
    base: Math.round(socialPensionUSD * multiplier * 100) / 100,
  }));
};

export const getDefaultTLInssOptionalContributionBase = (
  declaredMonthlyIncomeUSD: number,
  socialPensionUSD: number = TL_SOCIAL_PENSION_USD
): number => {
  const amount = Math.max(0, declaredMonthlyIncomeUSD);
  if (amount <= 0) return 0;

  const bands = getTLInssOptionalContributionBands(socialPensionUSD);
  return (bands.find(b => b.base >= amount) ?? bands[bands.length - 1]).base;
};

// ============================================
// SUBSIDIO ANUAL (13th Month Salary / Christmas Bonus)
// ============================================

/**
 * Subsidio Anual Rules (Labor Code Article 44)
 * - One full month's salary
 * - Due by December 20th
 * - Pro-rated for employees with less than 12 months
 */
export const TL_SUBSIDIO_ANUAL = {
  // Payment deadline
  deadlineMonth: 12,  // December
  deadlineDay: 20,    // By the 20th

  // Full year months for calculation
  fullYearMonths: 12,

  // Minimum months to qualify (some companies set this)
  minimumMonthsDefault: 0,  // No minimum by law
};

// ============================================
// WORKING HOURS & OVERTIME
// ============================================

/**
 * Working Hours (Labor Code Article 25)
 * - Maximum: 44 hours per week
 * - Daily: 8 hours standard
 * - Overtime must be compensated
 */
export const TL_WORKING_HOURS = {
  // Standard hours — Art. 25(1): normal hours may not exceed 8/day AND 44/week
  standardWeeklyHours: 44,
  standardDailyHours: 8,

  // Maximum overtime per day — Art. 27(4); exceeding it is lawful only for
  // force majeure (Art. 27(5)), so payroll warns and never blocks.
  maxOvertimePerDay: 4,

  // Maximum overtime per week — Art. 27(4)
  maxOvertimePerWeek: 16,
};

/**
 * Overtime Rates (Labor Code Article 27)
 */
export const TL_OVERTIME_RATES = {
  // Standard overtime (beyond 44 hours/week)
  standard: 1.5,  // 150%

  // Additional premium for normal hours worked at night (21:00-06:00).
  // Regular pay already covers the underlying hour, so payroll adds 25%, not 125%.
  nightShiftPremium: 0.25,

  // Sunday/Rest day work
  restDay: 2.0,  // 200%

  // Public holiday work
  publicHoliday: 2.0,  // 200%

  // Night + overtime combined
  nightOvertime: 1.75,  // 175%
};

// ============================================
// TERMINATION AND NON-CASH BENEFITS
// ============================================

/**
 * Service compensation on termination (Labour Law 4/2012, Art. 56): one
 * monthly salary for every completed five-year period of service.
 */
export const TL_SERVICE_COMPENSATION = {
  completedYearsPerSalaryMonth: 5,
};

/**
 * Tax Law 8/2008, Art. 1: non-cash benefits enter salary only when their
 * monthly value is greater than US$20. Exactly US$20 remains outside the WIT base.
 */
export const TL_NON_CASH_BENEFITS = {
  monthlyTaxableThreshold: 20,
};

// ============================================
// SICK LEAVE
// ============================================

/**
 * Sick Leave Rules (Labor Code Article 42)
 * - 12 days per year maximum with medical certificate
 * - First 6 days: 100% pay
 * - Remaining 6 days: 50% pay
 */
export const TL_SICK_LEAVE = {
  // Total annual sick days
  totalDays: 12,

  // Full pay days
  fullPayDays: 6,
  fullPayRate: 1.0,  // 100%

  // Reduced pay days
  reducedPayDays: 6,
  reducedPayRate: 0.5,  // 50%

  // Medical certificate required
  certificateRequired: true,
};

// ============================================
// CONTRACT TYPES
// ============================================

export type TLContractType =
  | 'prazo_indeterminado'  // Open-ended / Permanent
  | 'prazo_certo'          // Fixed-term
  | 'agencia'              // Agency / Temporary
  | 'prestacao_servicos';  // Service provider / Contractor

// ============================================
// PAY FREQUENCY
// ============================================

export type TLPayFrequency = 'weekly' | 'biweekly' | 'monthly';

export const TL_PAY_PERIODS = {
  weekly: {
    label: 'Semanal',
    labelEn: 'Weekly',
    periodsPerYear: 52,
    periodsPerMonth: 4.33,
  },
  biweekly: {
    label: 'Quinzenal',
    labelEn: 'Biweekly',
    periodsPerYear: 26,
    periodsPerMonth: 2.17,
  },
  monthly: {
    label: 'Mensal',
    labelEn: 'Monthly',
    periodsPerYear: 12,
    periodsPerMonth: 1,
  },
};

// ============================================
// CURRENCY & FORMATTING
// ============================================

const TL_CURRENCY = {
  code: 'USD',
  symbol: '$',
  name: 'US Dollar',
  locale: 'en-US',  // Timor-Leste uses USD
};

export const formatCurrencyTL = (amount: number): string => {
  return new Intl.NumberFormat(TL_CURRENCY.locale, {
    style: 'currency',
    currency: TL_CURRENCY.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ============================================
// DEDUCTION & EARNING LABELS (Bilingual)
// ============================================

export const TL_DEDUCTION_TYPE_LABELS: Record<string, { tl: string; en: string }> = {
  income_tax: { tl: 'Impostu Retidu (WIT)', en: 'Withholding Income Tax (WIT)' },
  inss_employee: { tl: 'INSS Trabalhador', en: 'INSS Employee (4%)' },
  inss_employer: { tl: 'INSS Empregador', en: 'INSS Employer (6%)' },
  health_insurance: { tl: 'Seguru Saúde', en: 'Health Insurance' },
  life_insurance: { tl: 'Seguru Vida', en: 'Life Insurance' },
  loan_repayment: { tl: 'Pagamentu Empréstimu', en: 'Loan Repayment' },
  advance_repayment: { tl: 'Pagamentu Adiantamentu', en: 'Advance Repayment' },
  court_order: { tl: 'Ordem Tribunal', en: 'Court Order' },
  absence: { tl: 'Ausensia', en: 'Absence Deduction' },
  late_arrival: { tl: 'Tarde Mai', en: 'Late Arrival' },
  other: { tl: 'Seluk', en: 'Other Deduction' },
};

// ============================================
// BANKS IN TIMOR-LESTE
// ============================================

export const TL_BANKS = [
  { code: 'BNU', name: 'Banco Nacional Ultramarino' },
  { code: 'MANDIRI', name: 'Bank Mandiri (Timor-Leste)' },
  { code: 'ANZ', name: 'ANZ Bank' },
  { code: 'BNCTL', name: 'Banco Nacional de Comércio de Timor-Leste' },
];

// ============================================
// MINIMUM WAGE
// ============================================

export const TL_MINIMUM_WAGE = {
  // Government decision: https://timor-leste.gov.tl/?lang=en&p=6964&print=1
  // A 2026 increase is proposed, not enacted; keep this runtime-overridable and recheck.
  monthly: 115,  // $115 USD (effective 2012-06-22; still current as of 2026-07-17)
  lastUpdated: '2012-06-22',
  // Note: Check the Jornal da República before every release.
};
