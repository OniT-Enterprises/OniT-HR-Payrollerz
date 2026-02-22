/**
 * Payroll Constants
 * Tax rates, thresholds, and legal requirements
 * Based on 2024 US Federal rates - update annually
 */

// ============================================
// FEDERAL TAX BRACKETS (2024)
// ============================================

const FEDERAL_TAX_BRACKETS_SINGLE = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

const FEDERAL_TAX_BRACKETS_MARRIED = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 },
];

const FEDERAL_TAX_BRACKETS_HEAD_OF_HOUSEHOLD = [
  { min: 0, max: 16550, rate: 0.10 },
  { min: 16550, max: 63100, rate: 0.12 },
  { min: 63100, max: 100500, rate: 0.22 },
  { min: 100500, max: 191950, rate: 0.24 },
  { min: 191950, max: 243700, rate: 0.32 },
  { min: 243700, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

// Standard deduction amounts (2024)
const STANDARD_DEDUCTION = {
  single: 14600,
  married: 29200,
  head_of_household: 21900,
};

// ============================================
// FICA (SOCIAL SECURITY & MEDICARE)
// ============================================

const FICA_RATES = {
  // Social Security
  socialSecurityRate: 0.062,  // 6.2% employee + 6.2% employer
  socialSecurityWageBase: 168600,  // 2024 limit

  // Medicare
  medicareRate: 0.0145,  // 1.45% employee + 1.45% employer
  additionalMedicareRate: 0.009,  // Additional 0.9% for high earners
  additionalMedicareThreshold: 200000,  // Threshold for additional Medicare
};

// ============================================
// UNEMPLOYMENT TAXES (FUTA/SUTA)
// ============================================

const UNEMPLOYMENT_RATES = {
  // Federal Unemployment Tax Act (employer only)
  futaRate: 0.006,  // 0.6% after state credit
  futaWageBase: 7000,

  // State Unemployment - varies by state, using average
  sutaDefaultRate: 0.027,  // 2.7% default, varies by experience
  sutaWageBase: 7000,  // Varies by state
};

// ============================================
// OVERTIME & PAY RATES
// ============================================

const PAY_RATES = {
  // Overtime multipliers
  overtimeMultiplier: 1.5,      // Time and a half
  doubleTimeMultiplier: 2.0,    // Double time
  holidayMultiplier: 1.5,       // Holiday premium

  // Standard work hours
  standardWeeklyHours: 40,
  standardDailyHours: 8,

  // Pay periods per year
  periodsPerYear: {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
  },
};

// ============================================
// MINIMUM WAGE (Federal - states may be higher)
// ============================================

const MINIMUM_WAGE = {
  federal: 7.25,  // Federal minimum
  // Add state-specific rates as needed
};

// ============================================
// BENEFIT CONTRIBUTION LIMITS (2024)
// ============================================

const BENEFIT_LIMITS = {
  // 401(k) limits
  '401k_employee_limit': 23000,
  '401k_catchup_limit': 7500,  // Age 50+
  '401k_total_limit': 69000,   // Employee + employer combined

  // HSA limits
  hsa_individual_limit: 4150,
  hsa_family_limit: 8300,
  hsa_catchup_limit: 1000,  // Age 55+

  // FSA limits
  fsa_limit: 3200,
  dcfsa_limit: 5000,  // Dependent care FSA
};

// ============================================
// PAY PERIOD DATES HELPER
// ============================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================
// STATUS LABELS & COLORS
// ============================================

export const PAYROLL_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
  },
  writing_records: {
    label: 'Saving...',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
  },
  processing: {
    label: 'Processing',
    color: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
  },
  approved: {
    label: 'Approved',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
  },
  paid: {
    label: 'Paid',
    color: 'emerald',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
  },
  rejected: {
    label: 'Rejected',
    color: 'orange',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
  },
};

// ============================================
// DEDUCTION TYPE LABELS
// ============================================

export const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  federal_tax: 'Federal Income Tax',
  state_tax: 'State Income Tax',
  local_tax: 'Local Income Tax',
  social_security: 'Social Security',
  medicare: 'Medicare',
  health_insurance: 'Health Insurance',
  dental_insurance: 'Dental Insurance',
  vision_insurance: 'Vision Insurance',
  life_insurance: 'Life Insurance',
  '401k': '401(k) Contribution',
  hsa: 'HSA Contribution',
  fsa: 'FSA Contribution',
  garnishment: 'Wage Garnishment',
  advance: 'Payroll Advance Repayment',
  other: 'Other Deduction',
};

// ============================================
// EARNING TYPE LABELS
// ============================================

const EARNING_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular Pay',
  overtime: 'Overtime Pay',
  double_time: 'Double Time Pay',
  holiday: 'Holiday Pay',
  bonus: 'Bonus',
  commission: 'Commission',
  tip: 'Tips',
  reimbursement: 'Reimbursement',
  allowance: 'Allowance',
  other: 'Other Earnings',
};

// ============================================
// DEFAULT TAX SETTINGS
// ============================================

const DEFAULT_TAX_SETTINGS = {
  federalFilingStatus: 'single' as const,
  federalAllowances: 0,
  additionalFederalWithholding: 0,
  isExemptFromFederal: false,
  isExemptFromState: false,
  isExemptFromFICA: false,
};

// ============================================
// CURRENCY & NUMBER FORMATTING
// ============================================

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

const formatPercent = (decimal: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(decimal);
};

// ============================================
// DATE HELPERS
// ============================================

export const formatPayPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = MONTHS[start.getMonth()];
  const endMonth = MONTHS[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
};

export const getPayPeriodLabel = (periodStart: string, _periodEnd: string): string => {
  const start = new Date(periodStart);
  const month = MONTHS[start.getMonth()];
  const year = start.getFullYear();
  return `${month} ${year}`;
};
