/**
 * Payroll Calculation Engine
 * Pure functions for calculating payroll
 */

import type {
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollDeduction,
  FilingStatus,
  BenefitEnrollment,
  RecurringDeduction,
} from '@/types/payroll';

import {
  FEDERAL_TAX_BRACKETS_SINGLE,
  FEDERAL_TAX_BRACKETS_MARRIED,
  FEDERAL_TAX_BRACKETS_HEAD_OF_HOUSEHOLD,
  STANDARD_DEDUCTION,
  FICA_RATES,
  UNEMPLOYMENT_RATES,
  PAY_RATES,
} from './constants';

// ============================================
// EARNINGS CALCULATIONS
// ============================================

/**
 * Calculate regular pay based on salary or hourly rate
 */
export function calculateRegularPay(
  baseSalary: number,
  isHourly: boolean,
  hourlyRate: number = 0,
  regularHours: number = 0,
  payPeriodsPerYear: number = 12
): number {
  if (isHourly) {
    return hourlyRate * regularHours;
  }
  // Salaried: divide annual by pay periods
  return baseSalary / payPeriodsPerYear;
}

/**
 * Calculate overtime pay
 */
export function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  multiplier: number = PAY_RATES.overtimeMultiplier
): number {
  return hourlyRate * overtimeHours * multiplier;
}

/**
 * Calculate double time pay
 */
export function calculateDoubleTimePay(
  hourlyRate: number,
  doubleTimeHours: number
): number {
  return hourlyRate * doubleTimeHours * PAY_RATES.doubleTimeMultiplier;
}

/**
 * Calculate holiday pay
 */
export function calculateHolidayPay(
  hourlyRate: number,
  holidayHours: number,
  multiplier: number = PAY_RATES.holidayMultiplier
): number {
  return hourlyRate * holidayHours * multiplier;
}

/**
 * Calculate total gross pay
 */
export function calculateGrossPay(
  regularPay: number,
  overtimePay: number,
  doubleTimePay: number,
  holidayPay: number,
  bonuses: number,
  commissions: number,
  reimbursements: number,
  allowances: number,
  tips: number
): number {
  return (
    regularPay +
    overtimePay +
    doubleTimePay +
    holidayPay +
    bonuses +
    commissions +
    reimbursements +
    allowances +
    tips
  );
}

// ============================================
// TAX CALCULATIONS
// ============================================

/**
 * Get tax brackets based on filing status
 */
function getTaxBrackets(filingStatus: FilingStatus) {
  switch (filingStatus) {
    case 'married':
      return FEDERAL_TAX_BRACKETS_MARRIED;
    case 'head_of_household':
      return FEDERAL_TAX_BRACKETS_HEAD_OF_HOUSEHOLD;
    case 'single':
    default:
      return FEDERAL_TAX_BRACKETS_SINGLE;
  }
}

/**
 * Calculate federal income tax using progressive brackets
 * This is a simplified calculation for withholding purposes
 */
export function calculateFederalTax(
  annualTaxableIncome: number,
  filingStatus: FilingStatus,
  additionalWithholding: number = 0,
  isExempt: boolean = false
): number {
  if (isExempt || annualTaxableIncome <= 0) {
    return 0;
  }

  const brackets = getTaxBrackets(filingStatus);
  let tax = 0;
  let remainingIncome = annualTaxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketWidth = bracket.max - bracket.min;
    const taxableInBracket = Math.min(remainingIncome, bracketWidth);

    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  // Add additional withholding (annualized)
  tax += additionalWithholding * 12;

  return Math.max(0, tax);
}

/**
 * Calculate state income tax (simplified flat rate approximation)
 * Real implementation would need state-specific brackets
 */
export function calculateStateTax(
  annualTaxableIncome: number,
  state: string,
  additionalWithholding: number = 0,
  isExempt: boolean = false
): number {
  if (isExempt || annualTaxableIncome <= 0) {
    return 0;
  }

  // Simplified state tax rates (would need full state tax tables in production)
  const stateTaxRates: Record<string, number> = {
    CA: 0.0725,  // California (average effective rate)
    NY: 0.0685,  // New York
    TX: 0,       // Texas (no state income tax)
    FL: 0,       // Florida (no state income tax)
    WA: 0,       // Washington (no state income tax)
    PA: 0.0307,  // Pennsylvania (flat rate)
    IL: 0.0495,  // Illinois (flat rate)
    OH: 0.04,    // Ohio (average)
    GA: 0.055,   // Georgia (flat rate as of 2024)
    NC: 0.0525,  // North Carolina (flat rate)
    DEFAULT: 0.05, // Default 5%
  };

  const rate = stateTaxRates[state] ?? stateTaxRates.DEFAULT;
  const tax = annualTaxableIncome * rate;

  return Math.max(0, tax + additionalWithholding * 12);
}

/**
 * Calculate Social Security tax (employee portion)
 */
export function calculateSocialSecurityEmployee(
  grossPay: number,
  ytdSocialSecurityWages: number = 0,
  isExempt: boolean = false
): number {
  if (isExempt) {
    return 0;
  }

  const wageBase = FICA_RATES.socialSecurityWageBase;
  const remainingWageBase = Math.max(0, wageBase - ytdSocialSecurityWages);
  const taxableWages = Math.min(grossPay, remainingWageBase);

  return taxableWages * FICA_RATES.socialSecurityRate;
}

/**
 * Calculate Social Security tax (employer portion)
 */
export function calculateSocialSecurityEmployer(
  grossPay: number,
  ytdSocialSecurityWages: number = 0
): number {
  const wageBase = FICA_RATES.socialSecurityWageBase;
  const remainingWageBase = Math.max(0, wageBase - ytdSocialSecurityWages);
  const taxableWages = Math.min(grossPay, remainingWageBase);

  return taxableWages * FICA_RATES.socialSecurityRate;
}

/**
 * Calculate Medicare tax (employee portion)
 */
export function calculateMedicareEmployee(
  grossPay: number,
  ytdGrossPay: number = 0,
  isExempt: boolean = false
): { regularMedicare: number; additionalMedicare: number } {
  if (isExempt) {
    return { regularMedicare: 0, additionalMedicare: 0 };
  }

  const regularMedicare = grossPay * FICA_RATES.medicareRate;

  // Additional Medicare tax (0.9%) on wages over $200k
  let additionalMedicare = 0;
  const threshold = FICA_RATES.additionalMedicareThreshold;

  if (ytdGrossPay + grossPay > threshold) {
    const wagesOverThreshold = Math.max(
      0,
      ytdGrossPay + grossPay - threshold
    );
    const currentPeriodOverThreshold = Math.min(grossPay, wagesOverThreshold);
    additionalMedicare = currentPeriodOverThreshold * FICA_RATES.additionalMedicareRate;
  }

  return { regularMedicare, additionalMedicare };
}

/**
 * Calculate Medicare tax (employer portion)
 */
export function calculateMedicareEmployer(grossPay: number): number {
  return grossPay * FICA_RATES.medicareRate;
}

/**
 * Calculate FUTA (Federal Unemployment Tax - employer only)
 */
export function calculateFUTA(
  grossPay: number,
  ytdFUTAWages: number = 0
): number {
  const wageBase = UNEMPLOYMENT_RATES.futaWageBase;
  const remainingWageBase = Math.max(0, wageBase - ytdFUTAWages);
  const taxableWages = Math.min(grossPay, remainingWageBase);

  return taxableWages * UNEMPLOYMENT_RATES.futaRate;
}

/**
 * Calculate SUTA (State Unemployment Tax - employer only)
 */
export function calculateSUTA(
  grossPay: number,
  ytdSUTAWages: number = 0,
  sutaRate: number = UNEMPLOYMENT_RATES.sutaDefaultRate,
  sutaWageBase: number = UNEMPLOYMENT_RATES.sutaWageBase
): number {
  const remainingWageBase = Math.max(0, sutaWageBase - ytdSUTAWages);
  const taxableWages = Math.min(grossPay, remainingWageBase);

  return taxableWages * sutaRate;
}

// ============================================
// BENEFIT & DEDUCTION CALCULATIONS
// ============================================

/**
 * Calculate benefit deductions from enrollments
 */
export function calculateBenefitDeductions(
  enrollments: BenefitEnrollment[]
): { preTax: PayrollDeduction[]; postTax: PayrollDeduction[] } {
  const preTax: PayrollDeduction[] = [];
  const postTax: PayrollDeduction[] = [];

  for (const enrollment of enrollments) {
    if (enrollment.status !== 'active') continue;

    const deduction: PayrollDeduction = {
      type: mapBenefitToDeductionType(enrollment.benefitType),
      description: enrollment.planName,
      amount: enrollment.employeeContribution,
      isPreTax: enrollment.isPreTax,
      isPercentage: false,
    };

    if (enrollment.isPreTax) {
      preTax.push(deduction);
    } else {
      postTax.push(deduction);
    }
  }

  return { preTax, postTax };
}

/**
 * Calculate recurring deductions
 */
export function calculateRecurringDeductions(
  deductions: RecurringDeduction[],
  grossPay: number
): { preTax: PayrollDeduction[]; postTax: PayrollDeduction[] } {
  const preTax: PayrollDeduction[] = [];
  const postTax: PayrollDeduction[] = [];

  for (const deduction of deductions) {
    if (deduction.status !== 'active') continue;

    let amount = deduction.amount;
    if (deduction.isPercentage && deduction.percentage) {
      amount = grossPay * (deduction.percentage / 100);
    }

    const payrollDeduction: PayrollDeduction = {
      type: deduction.type,
      description: deduction.description,
      amount,
      isPreTax: deduction.isPreTax,
      isPercentage: deduction.isPercentage,
      percentage: deduction.percentage,
    };

    if (deduction.isPreTax) {
      preTax.push(payrollDeduction);
    } else {
      postTax.push(payrollDeduction);
    }
  }

  return { preTax, postTax };
}

/**
 * Map benefit type to deduction type
 */
function mapBenefitToDeductionType(benefitType: string): PayrollDeduction['type'] {
  const mapping: Record<string, PayrollDeduction['type']> = {
    health: 'health_insurance',
    dental: 'dental_insurance',
    vision: 'vision_insurance',
    life: 'life_insurance',
    '401k': '401k',
    hsa: 'hsa',
    fsa: 'fsa',
  };
  return mapping[benefitType] || 'other';
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate complete payroll for an employee
 */
export function calculatePayroll(
  input: PayrollCalculationInput,
  payPeriodsPerYear: number = 12
): PayrollCalculationResult {
  const warnings: string[] = [];

  // 1. Calculate hourly rate (if salaried, derive from annual salary)
  let effectiveHourlyRate = input.hourlyRate || 0;
  if (!input.isHourly && input.baseSalary > 0) {
    // Assume 2080 work hours per year (40 hours * 52 weeks)
    effectiveHourlyRate = input.baseSalary / 2080;
  }

  // 2. Calculate earnings
  const regularPay = calculateRegularPay(
    input.baseSalary,
    input.isHourly,
    effectiveHourlyRate,
    input.regularHours,
    payPeriodsPerYear
  );

  const overtimePay = calculateOvertimePay(effectiveHourlyRate, input.overtimeHours);
  const doubleTimePay = calculateDoubleTimePay(effectiveHourlyRate, input.doubleTimeHours);
  const holidayPay = calculateHolidayPay(effectiveHourlyRate, input.holidayHours);

  const grossPay = calculateGrossPay(
    regularPay,
    overtimePay,
    doubleTimePay,
    holidayPay,
    input.bonuses,
    input.commissions,
    input.reimbursements,
    input.allowances,
    input.tips
  );

  // 3. Calculate pre-tax deductions (benefits, 401k, HSA, etc.)
  const benefitDeductions = calculateBenefitDeductions(input.benefitEnrollments);
  const recurringDeductionsCalc = calculateRecurringDeductions(
    input.recurringDeductions,
    grossPay
  );

  const preTaxDeductions = [
    ...benefitDeductions.preTax,
    ...recurringDeductionsCalc.preTax,
  ];

  const totalPreTaxDeductions = preTaxDeductions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // 4. Calculate taxable income
  const taxableIncome = Math.max(0, grossPay - totalPreTaxDeductions);

  // 5. Calculate taxes
  // Annualize for tax bracket calculation
  const annualTaxableIncome = taxableIncome * payPeriodsPerYear;
  const standardDeduction = STANDARD_DEDUCTION[input.taxInfo.federalFilingStatus];
  const annualTaxableAfterDeduction = Math.max(0, annualTaxableIncome - standardDeduction);

  // Federal tax (annualized, then divide by periods)
  const annualFederalTax = calculateFederalTax(
    annualTaxableAfterDeduction,
    input.taxInfo.federalFilingStatus,
    input.taxInfo.additionalFederalWithholding,
    input.taxInfo.isExemptFromFederal
  );
  const federalTax = annualFederalTax / payPeriodsPerYear;

  // State tax
  const annualStateTax = calculateStateTax(
    annualTaxableAfterDeduction,
    input.state,
    input.taxInfo.additionalStateWithholding || 0,
    input.taxInfo.isExemptFromState
  );
  const stateTax = annualStateTax / payPeriodsPerYear;

  // Local tax (placeholder - typically 1-3% in cities that have it)
  const localTax = 0;

  // Social Security (employee)
  const socialSecurityEmployee = calculateSocialSecurityEmployee(
    grossPay,
    input.ytdSocialSecurity,
    input.taxInfo.isExemptFromFICA
  );

  // Medicare (employee)
  const { regularMedicare: medicareEmployee, additionalMedicare } = calculateMedicareEmployee(
    grossPay,
    input.ytdGrossPay,
    input.taxInfo.isExemptFromFICA
  );

  const totalEmployeeTaxes =
    federalTax +
    stateTax +
    localTax +
    socialSecurityEmployee +
    medicareEmployee +
    additionalMedicare;

  // 6. Calculate post-tax deductions
  const postTaxDeductions = [
    ...benefitDeductions.postTax,
    ...recurringDeductionsCalc.postTax,
  ];

  const totalPostTaxDeductions = postTaxDeductions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // 7. Calculate net pay
  const totalDeductions = totalPreTaxDeductions + totalEmployeeTaxes + totalPostTaxDeductions;
  const netPay = Math.max(0, grossPay - totalDeductions);

  // 8. Calculate employer costs
  const socialSecurityEmployer = calculateSocialSecurityEmployer(
    grossPay,
    input.ytdSocialSecurity
  );

  const medicareEmployer = calculateMedicareEmployer(grossPay);

  const futa = calculateFUTA(grossPay, input.ytdGrossPay);
  const suta = calculateSUTA(grossPay, input.ytdGrossPay);

  // Employer benefit contributions
  const employerBenefitContributions = input.benefitEnrollments
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + e.employerContribution, 0);

  const totalEmployerCost =
    grossPay +
    socialSecurityEmployer +
    medicareEmployer +
    futa +
    suta +
    employerBenefitContributions;

  // 9. Validate and add warnings
  if (netPay < 0) {
    warnings.push('Net pay is negative - deductions exceed gross pay');
  }

  if (input.isHourly && effectiveHourlyRate < 7.25) {
    warnings.push('Hourly rate is below federal minimum wage ($7.25)');
  }

  return {
    // Earnings
    regularPay,
    overtimePay,
    doubleTimePay,
    holidayPay,
    bonuses: input.bonuses,
    commissions: input.commissions,
    reimbursements: input.reimbursements,
    allowances: input.allowances,
    tips: input.tips,
    grossPay,

    // Pre-tax deductions
    preTaxDeductions,
    totalPreTaxDeductions,

    // Taxable income
    taxableIncome,

    // Taxes
    federalTax,
    stateTax,
    localTax,
    socialSecurityEmployee,
    medicareEmployee,
    additionalMedicare,
    totalEmployeeTaxes,

    // Post-tax deductions
    postTaxDeductions,
    totalPostTaxDeductions,

    // Net pay
    totalDeductions,
    netPay,

    // Employer costs
    socialSecurityEmployer,
    medicareEmployer,
    futa,
    suta,
    employerBenefitContributions,
    totalEmployerCost,

    // Warnings
    warnings,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate effective hourly rate from salary
 */
export function salaryToHourlyRate(
  annualSalary: number,
  hoursPerYear: number = 2080
): number {
  return annualSalary / hoursPerYear;
}

/**
 * Calculate annual salary from hourly rate
 */
export function hourlyToAnnualSalary(
  hourlyRate: number,
  hoursPerYear: number = 2080
): number {
  return hourlyRate * hoursPerYear;
}

/**
 * Get pay periods per year from frequency
 */
export function getPayPeriodsPerYear(frequency: string): number {
  return PAY_RATES.periodsPerYear[frequency as keyof typeof PAY_RATES.periodsPerYear] || 12;
}

/**
 * Calculate gross-to-net summary
 */
export function getPayrollSummary(result: PayrollCalculationResult) {
  return {
    grossPay: result.grossPay,
    totalDeductions: result.totalDeductions,
    netPay: result.netPay,
    effectiveTaxRate: result.grossPay > 0
      ? (result.totalEmployeeTaxes / result.grossPay) * 100
      : 0,
    totalEmployerCost: result.totalEmployerCost,
  };
}
