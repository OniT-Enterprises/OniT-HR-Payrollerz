/**
 * Timor-Leste Payroll Calculation Engine
 *
 * Implements:
 * - Withholding Income Tax (WIT): 10% above $500 for residents, 10% all income for non-residents
 * - INSS: 4% employee + 6% employer
 * - Overtime calculations per Labor Code
 * - Subsidio Anual (13th month)
 * - Weekly sub-payroll support
 * - Sick leave calculations (6 days 100%, 6 days 50%)
 */

import {
  TL_INCOME_TAX,
  TL_INSS,
  TL_OVERTIME_RATES,
  TL_WORKING_HOURS,
  TL_SICK_LEAVE,
  TL_SUBSIDIO_ANUAL,
  TL_PAY_PERIODS,
  TLPayFrequency,
} from './constants-tl';

// ============================================
// TYPES
// ============================================

export interface TLEmployeeTaxInfo {
  isResident: boolean;           // Resident vs non-resident
  hasTaxExemption: boolean;      // Special exemptions if any
}

export interface TLPayrollInput {
  employeeId: string;

  // Basic pay info
  monthlySalary: number;         // Base monthly salary
  payFrequency: TLPayFrequency;  // weekly, biweekly, monthly

  // For weekly/biweekly - which period of the month
  periodNumber?: number;          // 1-4 for weekly, 1-2 for biweekly
  totalPeriodsInMonth?: number;   // For accurate monthly split

  // Hours (for hourly workers or overtime)
  isHourly: boolean;
  hourlyRate?: number;
  regularHours: number;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  restDayHours: number;

  // Absences (in hours or days)
  absenceHours: number;
  lateArrivalMinutes: number;

  // Sick leave used this period
  sickDaysUsed: number;
  ytdSickDaysUsed: number;       // Year-to-date sick days

  // Additional earnings
  bonus: number;
  commission: number;
  perDiem: number;               // NOT taxable
  foodAllowance: number;         // NOT in INSS base
  transportAllowance: number;
  otherEarnings: number;

  // Tax info
  taxInfo: TLEmployeeTaxInfo;

  // Deductions
  loanRepayment: number;
  advanceRepayment: number;
  courtOrders: number;
  otherDeductions: number;

  // YTD for annual calculations
  ytdGrossPay: number;
  ytdIncomeTax: number;
  ytdINSSEmployee: number;

  // For Subsidio Anual
  monthsWorkedThisYear: number;
  hireDate: string;              // To calculate months for 13th month
}

export interface TLPayrollEarning {
  type: string;
  description: string;
  descriptionTL: string;
  hours?: number;
  rate?: number;
  amount: number;
  isTaxable: boolean;
  isINSSBase: boolean;
}

export interface TLPayrollDeduction {
  type: string;
  description: string;
  descriptionTL: string;
  amount: number;
  isStatutory: boolean;          // Tax/INSS vs voluntary
}

export interface TLPayrollResult {
  // Earnings breakdown
  regularPay: number;
  overtimePay: number;
  nightShiftPay: number;
  holidayPay: number;
  restDayPay: number;
  sickPay: number;
  bonus: number;
  commission: number;
  perDiem: number;
  foodAllowance: number;
  transportAllowance: number;
  otherEarnings: number;

  // Totals
  grossPay: number;              // Total earnings
  taxableIncome: number;         // Gross - non-taxable items
  inssBase: number;              // Base for INSS calculation

  // Deductions - statutory
  incomeTax: number;             // WIT (Withholding Income Tax)
  inssEmployee: number;          // 4%

  // Deductions - other
  loanRepayment: number;
  advanceRepayment: number;
  courtOrders: number;
  absenceDeduction: number;
  lateDeduction: number;
  otherDeductions: number;

  // Employer costs (not deducted from employee)
  inssEmployer: number;          // 6%

  // Final amounts
  totalDeductions: number;
  netPay: number;
  totalEmployerCost: number;     // Gross + employer INSS

  // Line items for display
  earnings: TLPayrollEarning[];
  deductions: TLPayrollDeduction[];

  // YTD updates
  newYtdGrossPay: number;
  newYtdIncomeTax: number;
  newYtdINSSEmployee: number;

  // Warnings
  warnings: string[];
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate regular pay based on salary and frequency
 */
export function calculateRegularPay(
  monthlySalary: number,
  payFrequency: TLPayFrequency,
  isHourly: boolean,
  hourlyRate: number | undefined,
  regularHours: number,
  periodNumber?: number,
  totalPeriodsInMonth?: number
): number {
  if (isHourly && hourlyRate) {
    return hourlyRate * regularHours;
  }

  const periods = TL_PAY_PERIODS[payFrequency];

  // For weekly payroll in partial months, use actual days
  if (payFrequency === 'weekly' && totalPeriodsInMonth) {
    return monthlySalary / totalPeriodsInMonth;
  }

  return monthlySalary / periods.periodsPerMonth;
}

/**
 * Calculate overtime pay
 */
export function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  nightShiftHours: number,
  holidayHours: number,
  restDayHours: number
): {
  overtime: number;
  nightShift: number;
  holiday: number;
  restDay: number;
} {
  return {
    overtime: hourlyRate * overtimeHours * TL_OVERTIME_RATES.standard,
    nightShift: hourlyRate * nightShiftHours * TL_OVERTIME_RATES.nightShift,
    holiday: hourlyRate * holidayHours * TL_OVERTIME_RATES.publicHoliday,
    restDay: hourlyRate * restDayHours * TL_OVERTIME_RATES.restDay,
  };
}

/**
 * Calculate hourly rate from monthly salary
 */
export function calculateHourlyRate(monthlySalary: number): number {
  // 44 hours/week * ~4.33 weeks/month = ~190.5 hours/month
  const monthlyHours = TL_WORKING_HOURS.standardWeeklyHours * (52 / 12);
  return monthlySalary / monthlyHours;
}

/**
 * Calculate sick pay based on TL rules
 * First 6 days: 100%, next 6 days: 50%
 */
export function calculateSickPay(
  dailyRate: number,
  sickDaysThisPeriod: number,
  ytdSickDaysUsed: number
): number {
  let totalSickPay = 0;

  for (let i = 0; i < sickDaysThisPeriod; i++) {
    const dayNumber = ytdSickDaysUsed + i + 1;

    if (dayNumber <= TL_SICK_LEAVE.fullPayDays) {
      totalSickPay += dailyRate * TL_SICK_LEAVE.fullPayRate;
    } else if (dayNumber <= TL_SICK_LEAVE.totalDays) {
      totalSickPay += dailyRate * TL_SICK_LEAVE.reducedPayRate;
    }
    // Beyond 12 days: no pay
  }

  return totalSickPay;
}

/**
 * Calculate Timor-Leste Withholding Income Tax (WIT)
 * - Residents: 10% on income above $500/month
 * - Non-residents: 10% on all income
 */
export function calculateIncomeTax(
  taxableIncome: number,
  isResident: boolean,
  payFrequency: TLPayFrequency
): number {
  if (taxableIncome <= 0) return 0;

  // Convert threshold to period amount
  const periods = TL_PAY_PERIODS[payFrequency];
  const periodThreshold = TL_INCOME_TAX.residentThreshold / periods.periodsPerMonth;

  if (isResident) {
    // Only tax amount above threshold
    const taxableAmount = Math.max(0, taxableIncome - periodThreshold);
    return taxableAmount * TL_INCOME_TAX.rate;
  } else {
    // Non-residents pay on all income
    return taxableIncome * TL_INCOME_TAX.rate;
  }
}

/**
 * Calculate INSS contributions
 * Base: Gross - absences - food allowance - per diem
 */
export function calculateINSS(inssBase: number): {
  employee: number;
  employer: number;
  total: number;
} {
  const employee = inssBase * TL_INSS.employeeRate;
  const employer = inssBase * TL_INSS.employerRate;

  return {
    employee,
    employer,
    total: employee + employer,
  };
}

/**
 * Calculate Subsidio Anual (13th month salary)
 * Pro-rated for employees with less than 12 months
 */
export function calculateSubsidioAnual(
  monthlySalary: number,
  monthsWorkedThisYear: number,
  hireDate: string
): number {
  const hireMonth = new Date(hireDate).getMonth();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const hireYear = new Date(hireDate).getFullYear();

  // If hired this year, calculate months worked
  let effectiveMonths = monthsWorkedThisYear;
  if (hireYear === currentYear) {
    effectiveMonths = currentMonth - hireMonth + 1;
  }

  // Pro-rate if less than 12 months
  const proRataFactor = Math.min(effectiveMonths, 12) / TL_SUBSIDIO_ANUAL.fullYearMonths;

  return monthlySalary * proRataFactor;
}

/**
 * Calculate absence deduction
 */
export function calculateAbsenceDeduction(
  hourlyRate: number,
  absenceHours: number
): number {
  return hourlyRate * absenceHours;
}

/**
 * Calculate late arrival deduction
 * Typically rounded to nearest 15 or 30 minutes
 */
export function calculateLateDeduction(
  hourlyRate: number,
  lateMinutes: number,
  roundToMinutes: number = 15
): number {
  // Round up to nearest increment
  const roundedMinutes = Math.ceil(lateMinutes / roundToMinutes) * roundToMinutes;
  const lateHours = roundedMinutes / 60;
  return hourlyRate * lateHours;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate complete Timor-Leste payroll for an employee
 */
export function calculateTLPayroll(input: TLPayrollInput): TLPayrollResult {
  const warnings: string[] = [];
  const earnings: TLPayrollEarning[] = [];
  const deductions: TLPayrollDeduction[] = [];

  // Calculate hourly rate for overtime/deductions
  const hourlyRate = input.isHourly && input.hourlyRate
    ? input.hourlyRate
    : calculateHourlyRate(input.monthlySalary);

  const dailyRate = hourlyRate * TL_WORKING_HOURS.standardDailyHours;

  // ========== EARNINGS ==========

  // Regular pay
  const regularPay = calculateRegularPay(
    input.monthlySalary,
    input.payFrequency,
    input.isHourly,
    input.hourlyRate,
    input.regularHours,
    input.periodNumber,
    input.totalPeriodsInMonth
  );

  earnings.push({
    type: 'regular',
    description: 'Regular Salary',
    descriptionTL: 'Saláriu Regular',
    hours: input.regularHours,
    rate: hourlyRate,
    amount: regularPay,
    isTaxable: true,
    isINSSBase: true,
  });

  // Overtime calculations
  const overtimePay = calculateOvertimePay(
    hourlyRate,
    input.overtimeHours,
    input.nightShiftHours,
    input.holidayHours,
    input.restDayHours
  );

  if (input.overtimeHours > 0) {
    earnings.push({
      type: 'overtime',
      description: 'Overtime',
      descriptionTL: 'Oras Extra',
      hours: input.overtimeHours,
      rate: hourlyRate * TL_OVERTIME_RATES.standard,
      amount: overtimePay.overtime,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  if (input.nightShiftHours > 0) {
    earnings.push({
      type: 'night_shift',
      description: 'Night Shift Premium',
      descriptionTL: 'Prémiu Turnu Kalan',
      hours: input.nightShiftHours,
      rate: hourlyRate * TL_OVERTIME_RATES.nightShift,
      amount: overtimePay.nightShift,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  if (input.holidayHours > 0) {
    earnings.push({
      type: 'holiday',
      description: 'Public Holiday Pay',
      descriptionTL: 'Pagamentu Feriadu',
      hours: input.holidayHours,
      rate: hourlyRate * TL_OVERTIME_RATES.publicHoliday,
      amount: overtimePay.holiday,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  if (input.restDayHours > 0) {
    earnings.push({
      type: 'rest_day',
      description: 'Rest Day Pay',
      descriptionTL: 'Pagamentu Loron Deskansa',
      hours: input.restDayHours,
      rate: hourlyRate * TL_OVERTIME_RATES.restDay,
      amount: overtimePay.restDay,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // Sick pay
  const sickPay = calculateSickPay(dailyRate, input.sickDaysUsed, input.ytdSickDaysUsed);
  if (sickPay > 0) {
    earnings.push({
      type: 'sick_pay',
      description: 'Sick Leave Pay',
      descriptionTL: 'Pagamentu Lisensa Moras',
      amount: sickPay,
      isTaxable: true,
      isINSSBase: true,
    });

    // Warning if approaching limit
    const totalSickDays = input.ytdSickDaysUsed + input.sickDaysUsed;
    if (totalSickDays >= 10) {
      warnings.push(`Employee has used ${totalSickDays} of ${TL_SICK_LEAVE.totalDays} annual sick days.`);
    }
  }

  // Bonus
  if (input.bonus > 0) {
    earnings.push({
      type: 'bonus',
      description: 'Bonus',
      descriptionTL: 'Bónus',
      amount: input.bonus,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // Commission
  if (input.commission > 0) {
    earnings.push({
      type: 'commission',
      description: 'Commission',
      descriptionTL: 'Komisaun',
      amount: input.commission,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // Per diem (NOT taxable, NOT INSS)
  if (input.perDiem > 0) {
    earnings.push({
      type: 'per_diem',
      description: 'Per Diem / Travel',
      descriptionTL: 'Per Diem / Viajen',
      amount: input.perDiem,
      isTaxable: false,
      isINSSBase: false,
    });
  }

  // Food allowance (taxable but NOT INSS)
  if (input.foodAllowance > 0) {
    earnings.push({
      type: 'food_allowance',
      description: 'Food Allowance',
      descriptionTL: 'Subsidiu Ai-han',
      amount: input.foodAllowance,
      isTaxable: true,
      isINSSBase: false,
    });
  }

  // Transport allowance
  if (input.transportAllowance > 0) {
    earnings.push({
      type: 'transport_allowance',
      description: 'Transport Allowance',
      descriptionTL: 'Subsidiu Transporte',
      amount: input.transportAllowance,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // Other earnings
  if (input.otherEarnings > 0) {
    earnings.push({
      type: 'other',
      description: 'Other Earnings',
      descriptionTL: 'Rendimentu Seluk',
      amount: input.otherEarnings,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // ========== CALCULATE TOTALS ==========

  const grossPay = earnings.reduce((sum, e) => sum + e.amount, 0);
  const taxableIncome = earnings.filter(e => e.isTaxable).reduce((sum, e) => sum + e.amount, 0);
  const inssBase = earnings.filter(e => e.isINSSBase).reduce((sum, e) => sum + e.amount, 0);

  // ========== DEDUCTIONS ==========

  // Absence deduction
  const absenceDeduction = calculateAbsenceDeduction(hourlyRate, input.absenceHours);
  if (absenceDeduction > 0) {
    deductions.push({
      type: 'absence',
      description: 'Absence Deduction',
      descriptionTL: 'Dedusaun Ausensia',
      amount: absenceDeduction,
      isStatutory: false,
    });
  }

  // Late arrival deduction
  const lateDeduction = calculateLateDeduction(hourlyRate, input.lateArrivalMinutes);
  if (lateDeduction > 0) {
    deductions.push({
      type: 'late_arrival',
      description: 'Late Arrival Deduction',
      descriptionTL: 'Dedusaun Tarde Mai',
      amount: lateDeduction,
      isStatutory: false,
    });
  }

  // Adjust INSS base for absences
  const adjustedInssBase = Math.max(0, inssBase - absenceDeduction);

  // Withholding Income Tax (WIT)
  const incomeTax = calculateIncomeTax(
    taxableIncome - absenceDeduction - lateDeduction,
    input.taxInfo.isResident,
    input.payFrequency
  );

  if (incomeTax > 0) {
    deductions.push({
      type: 'income_tax',
      description: 'Withholding Income Tax (WIT)',
      descriptionTL: 'Impostu Retidu (WIT)',
      amount: incomeTax,
      isStatutory: true,
    });
  }

  // INSS
  const inss = calculateINSS(adjustedInssBase);

  if (inss.employee > 0) {
    deductions.push({
      type: 'inss_employee',
      description: 'INSS Employee (4%)',
      descriptionTL: 'INSS Trabalhador (4%)',
      amount: inss.employee,
      isStatutory: true,
    });
  }

  // Loan repayment
  if (input.loanRepayment > 0) {
    deductions.push({
      type: 'loan_repayment',
      description: 'Loan Repayment',
      descriptionTL: 'Pagamentu Empréstimu',
      amount: input.loanRepayment,
      isStatutory: false,
    });
  }

  // Advance repayment
  if (input.advanceRepayment > 0) {
    deductions.push({
      type: 'advance_repayment',
      description: 'Advance Repayment',
      descriptionTL: 'Pagamentu Adiantamentu',
      amount: input.advanceRepayment,
      isStatutory: false,
    });
  }

  // Court orders
  if (input.courtOrders > 0) {
    deductions.push({
      type: 'court_order',
      description: 'Court Order',
      descriptionTL: 'Ordem Tribunal',
      amount: input.courtOrders,
      isStatutory: true,
    });
  }

  // Other deductions
  if (input.otherDeductions > 0) {
    deductions.push({
      type: 'other',
      description: 'Other Deductions',
      descriptionTL: 'Dedusaun Seluk',
      amount: input.otherDeductions,
      isStatutory: false,
    });
  }

  // ========== FINAL CALCULATIONS ==========

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = grossPay - totalDeductions;
  const totalEmployerCost = grossPay + inss.employer;

  // Warnings
  if (netPay < 0) {
    warnings.push('Net pay is negative. Please review deductions.');
  }

  if (input.taxInfo.isResident && taxableIncome < TL_INCOME_TAX.residentThreshold) {
    warnings.push(`Income below $${TL_INCOME_TAX.residentThreshold} threshold - no income tax applied.`);
  }

  return {
    // Earnings breakdown
    regularPay,
    overtimePay: overtimePay.overtime,
    nightShiftPay: overtimePay.nightShift,
    holidayPay: overtimePay.holiday,
    restDayPay: overtimePay.restDay,
    sickPay,
    bonus: input.bonus,
    commission: input.commission,
    perDiem: input.perDiem,
    foodAllowance: input.foodAllowance,
    transportAllowance: input.transportAllowance,
    otherEarnings: input.otherEarnings,

    // Totals
    grossPay,
    taxableIncome,
    inssBase: adjustedInssBase,

    // Deductions
    incomeTax,
    inssEmployee: inss.employee,
    loanRepayment: input.loanRepayment,
    advanceRepayment: input.advanceRepayment,
    courtOrders: input.courtOrders,
    absenceDeduction,
    lateDeduction,
    otherDeductions: input.otherDeductions,

    // Employer costs
    inssEmployer: inss.employer,

    // Final
    totalDeductions,
    netPay,
    totalEmployerCost,

    // Line items
    earnings,
    deductions,

    // YTD updates
    newYtdGrossPay: input.ytdGrossPay + grossPay,
    newYtdIncomeTax: input.ytdIncomeTax + incomeTax,
    newYtdINSSEmployee: input.ytdINSSEmployee + inss.employee,

    // Warnings
    warnings,
  };
}

/**
 * Calculate weekly sub-payroll as portion of monthly
 * Used when company pays some workers weekly but tracks monthly
 */
export function calculateWeeklySubPayroll(
  monthlySalary: number,
  weekNumber: number,  // 1-5 (some months have 5 weeks)
  daysInWeek: number,  // Working days this week (typically 5-6)
  totalWorkingDaysInMonth: number
): number {
  // Pro-rate based on actual working days
  const dailyRate = monthlySalary / totalWorkingDaysInMonth;
  return dailyRate * daysInWeek;
}

/**
 * Validate payroll input before calculation
 */
export function validateTLPayrollInput(input: TLPayrollInput): string[] {
  const errors: string[] = [];

  if (input.monthlySalary < TL_INSS.minimumSalary) {
    errors.push(`Monthly salary ($${input.monthlySalary}) is below minimum wage ($${TL_INSS.minimumSalary}).`);
  }

  if (input.regularHours < 0) {
    errors.push('Regular hours cannot be negative.');
  }

  if (input.overtimeHours > TL_WORKING_HOURS.maxOvertimePerWeek * 4) {
    errors.push(`Overtime hours (${input.overtimeHours}) exceed maximum allowed per month.`);
  }

  if (input.sickDaysUsed > 0 && input.ytdSickDaysUsed + input.sickDaysUsed > TL_SICK_LEAVE.totalDays) {
    errors.push(`Total sick days (${input.ytdSickDaysUsed + input.sickDaysUsed}) exceed annual limit (${TL_SICK_LEAVE.totalDays}).`);
  }

  return errors;
}

export default calculateTLPayroll;
