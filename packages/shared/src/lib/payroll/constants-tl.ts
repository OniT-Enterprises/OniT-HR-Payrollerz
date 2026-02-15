/**
 * Timor-Leste Payroll Constants
 * Tax rates, INSS, and labor law requirements
 * Based on:
 * - Tax Law: Law 8/2008 (Income Tax)
 * - Social Security: Decree-Law 19/2016 (INSS)
 * - Labor Code: Law 4/2012
 */

import { getTLPublicHolidays } from "./tl-holidays";

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
 * INSS Contribution Rates (Decree-Law 19/2016)
 * Total: 10% (4% employee + 6% employer)
 * Base: remuneracao contributiva (remuneração base + certain supplements per INSS guidance)
 * Excluded (per INSS guidance): overtime; bonuses/gratuities/profit-sharing; food subsidies; subsistence subsidies
 * (transport/board/lodging/travel); representation expenses; and other extraordinary allowances.
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

  // Items excluded from INSS contribution base (see INSS guidance)
  excludedItems: [
    'per_diem',
    'travel_allowance',
    'food_allowance',
    'transport_allowance',
    'housing_allowance',
    'overtime',
    'bonus',
    'commission',
    'gratuity',
    'profit_sharing',
    'reimbursement',
    'representation_expense',
  ],
};

export const TL_SOCIAL_PENSION_USD = 60;

/**
 * Optional registration (voluntary) uses Social Pension (SP) multiples as contribution bands.
 * Reference: INSS contributions guidance.
 */
export const TL_INSS_OPTIONAL_CONTRIBUTION_BAND_MULTIPLIERS = [
  2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 100, 200,
] as const;

export interface TLInssContributionBand {
  band: number;
  multiplier: number;
  base: number;
}

export const getTLInssOptionalContributionBands = (
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
 * Subsidio Anual Rules (Labor Code Article 40)
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
 * Working Hours (Labor Code Article 18-22)
 * - Maximum: 44 hours per week
 * - Daily: 8 hours standard
 * - Overtime must be compensated
 */
export const TL_WORKING_HOURS = {
  // Standard hours
  standardWeeklyHours: 44,
  standardDailyHours: 8,

  // Maximum overtime per day
  maxOvertimePerDay: 4,

  // Maximum overtime per week
  maxOvertimePerWeek: 16,
};

/**
 * Overtime Rates (Labor Code Article 24)
 */
export const TL_OVERTIME_RATES = {
  // Standard overtime (beyond 44 hours/week)
  standard: 1.5,  // 150%

  // Night shift (10pm - 6am)
  nightShift: 1.25,  // 125% (25% premium)

  // Sunday/Rest day work
  restDay: 2.0,  // 200%

  // Public holiday work
  publicHoliday: 2.0,  // 200%

  // Night + overtime combined
  nightOvertime: 1.75,  // 175%
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
// MATERNITY LEAVE
// ============================================

/**
 * Maternity Leave (Labor Code Article 44)
 */
export const TL_MATERNITY_LEAVE = {
  // Duration
  totalDays: 90,  // 12 weeks

  // Before birth
  preNatalDays: 30,

  // After birth
  postNatalDays: 60,

  // Payment rate
  payRate: 1.0,  // 100% paid

  // INSS may cover portion - check current rules
};

// ============================================
// ANNUAL LEAVE / HOLIDAYS
// ============================================

/**
 * Annual Leave (Labor Code Article 38)
 */
export const TL_ANNUAL_LEAVE = {
  // Minimum annual leave days
  minimumDays: 12,

  // After 3 years of service
  after3Years: 15,

  // After 6 years of service
  after6Years: 18,

  // After 9 years of service
  after9Years: 22,

  // Probation period before leave accrual
  probationMonths: 6,  // Typical, but company can define
};

// ============================================
// PUBLIC HOLIDAYS (Timor-Leste)
// ============================================

/**
 * Keep a concrete year list for backwards compatibility in the codebase.
 * Prefer `getTLPublicHolidays(year)` for new code.
 */
export const TL_PUBLIC_HOLIDAYS_2025 = getTLPublicHolidays(2025);

// ============================================
// CONTRACT TYPES
// ============================================

export type TLContractType =
  | 'prazo_indeterminado'  // Open-ended / Permanent
  | 'prazo_certo'          // Fixed-term
  | 'agencia'              // Agency / Temporary
  | 'prestacao_servicos';  // Service provider / Contractor

export const TL_CONTRACT_TYPES = {
  prazo_indeterminado: {
    label: 'Prazo Indeterminado',
    labelEn: 'Open-ended / Permanent',
    description: 'No end date, standard employment',
  },
  prazo_certo: {
    label: 'Prazo Certo',
    labelEn: 'Fixed-term',
    description: 'Contract with defined end date',
    maxDuration: 24,  // Maximum 24 months
    maxRenewals: 2,   // Can be renewed twice
  },
  agencia: {
    label: 'Agência',
    labelEn: 'Agency / Temporary',
    description: 'Through employment agency',
  },
  prestacao_servicos: {
    label: 'Prestação de Serviços',
    labelEn: 'Service Provider',
    description: 'Independent contractor',
  },
};

// ============================================
// TERMINATION & SEVERANCE
// ============================================

/**
 * Severance Pay (Labor Code Article 51)
 * For dismissal without just cause or redundancy
 */
export const TL_SEVERANCE = {
  // Days of salary per year of service
  daysPerYear: 30,

  // Minimum service for severance
  minimumMonths: 3,

  // Notice period (days)
  noticePeriodDays: 30,
};

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

export const TL_CURRENCY = {
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

export const formatNumberTL = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat(TL_CURRENCY.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercentTL = (decimal: number): string => {
  return new Intl.NumberFormat(TL_CURRENCY.locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(decimal);
};

// ============================================
// STATUS LABELS (Bilingual)
// ============================================

export const TL_PAYROLL_STATUS_CONFIG = {
  draft: {
    label: 'Rascunho',
    labelEn: 'Draft',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
  },
  processing: {
    label: 'Prosesamentu',
    labelEn: 'Processing',
    color: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
  },
  approved: {
    label: 'Aprovadu',
    labelEn: 'Approved',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
  },
  paid: {
    label: 'Selu Ona',
    labelEn: 'Paid',
    color: 'emerald',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
  },
  cancelled: {
    label: 'Kanseladu',
    labelEn: 'Cancelled',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
  },
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

export const TL_EARNING_TYPE_LABELS: Record<string, { tl: string; en: string }> = {
  regular: { tl: 'Saláriu Regular', en: 'Regular Salary' },
  overtime: { tl: 'Oras Extra', en: 'Overtime' },
  night_shift: { tl: 'Turnu Kalan', en: 'Night Shift' },
  holiday: { tl: 'Feriadu', en: 'Holiday Pay' },
  bonus: { tl: 'Bónus', en: 'Bonus' },
  commission: { tl: 'Komisaun', en: 'Commission' },
  per_diem: { tl: 'Per Diem', en: 'Per Diem' },
  food_allowance: { tl: 'Subsidiu Ai-han', en: 'Food Allowance' },
  transport_allowance: { tl: 'Subsidiu Transporte', en: 'Transport Allowance' },
  subsidio_anual: { tl: 'Subsídiu Anual', en: '13th Month Salary' },
  reimbursement: { tl: 'Reembolsu', en: 'Reimbursement' },
  other: { tl: 'Seluk', en: 'Other Earning' },
};

// ============================================
// MONTHS (Tetun/Portuguese)
// ============================================

export const TL_MONTHS = [
  { en: 'January', tl: 'Janeiru' },
  { en: 'February', tl: 'Fevereiru' },
  { en: 'March', tl: 'Marsu' },
  { en: 'April', tl: 'Abril' },
  { en: 'May', tl: 'Maiu' },
  { en: 'June', tl: 'Junhu' },
  { en: 'July', tl: 'Julhu' },
  { en: 'August', tl: 'Agostu' },
  { en: 'September', tl: 'Setembru' },
  { en: 'October', tl: 'Outubru' },
  { en: 'November', tl: 'Novembru' },
  { en: 'December', tl: 'Dezembru' },
];

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
  monthly: 115,  // $115 USD (as of 2023)
  lastUpdated: '2023-01-01',
  // Note: Check for updates annually
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a date is a public holiday
 */
export const isPublicHoliday = (date: Date | string, year: number = new Date().getFullYear()): boolean => {
  const dateStr = typeof date === 'string'
    ? date
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const holidays = getTLPublicHolidays(year);
  return holidays.some(h => h.date === dateStr);
};

/**
 * Get public holiday name if date is a holiday
 */
export const getHolidayName = (date: Date | string): string | null => {
  const dateStr = typeof date === 'string'
    ? date
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const year = parseInt(dateStr.substring(0, 4), 10);
  const holiday = getTLPublicHolidays(year).find(h => h.date === dateStr);
  return holiday?.name ?? null;
};

/**
 * Calculate annual leave entitlement based on years of service
 */
export const calculateAnnualLeave = (yearsOfService: number): number => {
  if (yearsOfService >= 9) return TL_ANNUAL_LEAVE.after9Years;
  if (yearsOfService >= 6) return TL_ANNUAL_LEAVE.after6Years;
  if (yearsOfService >= 3) return TL_ANNUAL_LEAVE.after3Years;
  return TL_ANNUAL_LEAVE.minimumDays;
};

/**
 * Calculate sick pay for a given day number (1-12)
 */
export const calculateSickPayRate = (dayNumber: number, usedDays: number): number => {
  if (dayNumber > TL_SICK_LEAVE.totalDays) return 0;  // Beyond 12 days
  if (usedDays < TL_SICK_LEAVE.fullPayDays) return TL_SICK_LEAVE.fullPayRate;
  return TL_SICK_LEAVE.reducedPayRate;
};
