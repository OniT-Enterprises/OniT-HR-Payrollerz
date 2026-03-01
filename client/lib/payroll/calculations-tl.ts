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
import {
  divideMoney,
  multiplyMoney,
  applyRate,
  addMoney,
  subtractMoney,
  sumMoney,
  proRata,
} from '@/lib/currency';

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
  perDiem: number;               // Per diem / travel allowance (excluded from INSS base)
  foodAllowance: number;         // Food subsidy (excluded from INSS base)
  transportAllowance: number;
  otherEarnings: number;
  subsidioAnual?: number;        // 13th month salary / annual subsidy (paid in a specific run)

  // Tax info
  taxInfo: TLEmployeeTaxInfo;

  // INSS
  inssContributionBase?: number;

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
  subsidioAnual: number;

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
 * Uses decimal.js for precise currency calculations
 */
function calculateRegularPay(
  monthlySalary: number,
  payFrequency: TLPayFrequency,
  isHourly: boolean,
  hourlyRate: number | undefined,
  regularHours: number,
  periodNumber?: number,
  totalPeriodsInMonth?: number
): number {
  if (isHourly && hourlyRate) {
    return multiplyMoney(hourlyRate, regularHours);
  }

  const periods = TL_PAY_PERIODS[payFrequency];

  // For weekly/biweekly payroll in partial months, use actual pay periods in the pay month.
  if ((payFrequency === 'weekly' || payFrequency === 'biweekly') && totalPeriodsInMonth) {
    return divideMoney(monthlySalary, totalPeriodsInMonth);
  }

  return divideMoney(monthlySalary, periods.periodsPerMonth);
}

/**
 * Calculate overtime pay
 * Uses decimal.js for precise currency calculations
 */
function calculateOvertimePay(
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
    overtime: multiplyMoney(multiplyMoney(hourlyRate, overtimeHours), TL_OVERTIME_RATES.standard),
    nightShift: multiplyMoney(multiplyMoney(hourlyRate, nightShiftHours), TL_OVERTIME_RATES.nightShift),
    holiday: multiplyMoney(multiplyMoney(hourlyRate, holidayHours), TL_OVERTIME_RATES.publicHoliday),
    restDay: multiplyMoney(multiplyMoney(hourlyRate, restDayHours), TL_OVERTIME_RATES.restDay),
  };
}

/**
 * Calculate hourly rate from monthly salary
 * Uses decimal.js for precise currency calculations
 */
export function calculateHourlyRate(monthlySalary: number): number {
  // 44 hours/week * ~4.33 weeks/month = ~190.5 hours/month
  const monthlyHours = TL_WORKING_HOURS.standardWeeklyHours * (52 / 12);
  return divideMoney(monthlySalary, monthlyHours);
}

/**
 * Calculate sick pay based on TL rules
 * First 6 days: 100%, next 6 days: 50%
 * Uses decimal.js for precise currency calculations
 */
function calculateSickPay(
  dailyRate: number,
  sickDaysThisPeriod: number,
  ytdSickDaysUsed: number
): number {
  const dayAmounts: number[] = [];

  for (let i = 0; i < sickDaysThisPeriod; i++) {
    const dayNumber = ytdSickDaysUsed + i + 1;

    if (dayNumber <= TL_SICK_LEAVE.fullPayDays) {
      dayAmounts.push(applyRate(dailyRate, TL_SICK_LEAVE.fullPayRate));
    } else if (dayNumber <= TL_SICK_LEAVE.totalDays) {
      dayAmounts.push(applyRate(dailyRate, TL_SICK_LEAVE.reducedPayRate));
    }
    // Beyond 12 days: no pay
  }

  return sumMoney(dayAmounts);
}

/**
 * Calculate Timor-Leste Withholding Income Tax (WIT)
 * - Residents: 10% on income above $500/month
 * - Non-residents: 10% on all income
 * Uses decimal.js for precise currency calculations
 */
function calculateIncomeTax(
  taxableIncome: number,
  isResident: boolean,
  payFrequency: TLPayFrequency,
  totalPeriodsInMonth?: number,
  configOverride?: { rate: number; residentThreshold: number }
): number {
  if (taxableIncome <= 0) return 0;

  const rate = configOverride?.rate ?? TL_INCOME_TAX.rate;
  const residentThreshold = configOverride?.residentThreshold ?? TL_INCOME_TAX.residentThreshold;

  // Convert the monthly threshold to the current pay period.
  // For weekly/biweekly runs we prefer the actual number of periods in the month when provided
  // (prevents under/over-withholding in 4 vs 5-week months).
  const periods = TL_PAY_PERIODS[payFrequency];
  const effectivePeriodsPerMonth =
    (payFrequency === 'weekly' || payFrequency === 'biweekly') && totalPeriodsInMonth
      ? totalPeriodsInMonth
      : periods.periodsPerMonth;
  const periodThreshold = divideMoney(residentThreshold, effectivePeriodsPerMonth);

  if (isResident) {
    // Only tax amount above threshold
    const taxableAmount = Math.max(0, subtractMoney(taxableIncome, periodThreshold));
    return applyRate(taxableAmount, rate);
  } else {
    // Non-residents pay on all income
    return applyRate(taxableIncome, rate);
  }
}

/**
 * Calculate INSS contributions
 * Base: Gross - absences - food allowance - per diem
 * Uses decimal.js for precise currency calculations
 */
export function calculateINSS(
  inssBase: number,
  configOverride?: { employeeRate: number; employerRate: number }
): {
  employee: number;
  employer: number;
  total: number;
} {
  const employeeRate = configOverride?.employeeRate ?? TL_INSS.employeeRate;
  const employerRate = configOverride?.employerRate ?? TL_INSS.employerRate;

  const employee = applyRate(inssBase, employeeRate);
  const employer = applyRate(inssBase, employerRate);

  return {
    employee,
    employer,
    total: addMoney(employee, employer),
  };
}

/**
 * Calculate Subsidio Anual (13th month salary)
 * Pro-rated for employees with less than 12 months
 * Uses decimal.js for precise currency calculations
 */
export function calculateSubsidioAnual(
  monthlySalary: number,
  monthsWorkedThisYear: number,
  hireDate: string,
  asOfDate: Date = new Date()
): number {
  const hireDateObj = new Date(hireDate);
  const hireMonth = hireDateObj.getMonth();
  const hireYear = hireDateObj.getFullYear();

  const currentMonth = asOfDate.getMonth();
  const currentYear = asOfDate.getFullYear();

  // If hired this year, calculate months worked
  let effectiveMonths = monthsWorkedThisYear;
  if (hireYear > currentYear) {
    effectiveMonths = 0;
  }
  if (hireYear === currentYear) {
    effectiveMonths = Math.max(0, currentMonth - hireMonth + 1);
  }

  // Pro-rate if less than 12 months
  return proRata(monthlySalary, Math.min(effectiveMonths, 12), TL_SUBSIDIO_ANUAL.fullYearMonths);
}

/**
 * Calculate absence deduction
 * Uses decimal.js for precise currency calculations
 */
export function calculateAbsenceDeduction(
  hourlyRate: number,
  absenceHours: number
): number {
  return multiplyMoney(hourlyRate, absenceHours);
}

/**
 * Calculate late arrival deduction
 * Typically rounded to nearest 15 or 30 minutes
 * Uses decimal.js for precise currency calculations
 */
export function calculateLateDeduction(
  hourlyRate: number,
  lateMinutes: number,
  roundToMinutes: number = 15
): number {
  // Round up to nearest increment
  const roundedMinutes = Math.ceil(lateMinutes / roundToMinutes) * roundToMinutes;
  const lateHours = divideMoney(roundedMinutes, 60);
  return multiplyMoney(hourlyRate, lateHours);
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
      isINSSBase: false,
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
      // INSS excludes overtime/extraordinary pay; public holiday premiums are treated as overtime.
      isINSSBase: false,
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
      // INSS excludes overtime/extraordinary pay; rest day premiums are treated as overtime.
      isINSSBase: false,
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
      isINSSBase: false,
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
      // INSS excludes commissions/gratuities per INSS contribution guidance.
      isINSSBase: false,
    });
  }

  // Per diem / travel allowance (taxable wages per Taxes & Duties Act definition; excluded from INSS base)
  if (input.perDiem > 0) {
    earnings.push({
      type: 'per_diem',
      description: 'Per Diem / Travel',
      descriptionTL: 'Per Diem / Viajen',
      amount: input.perDiem,
      isTaxable: true,
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
      isINSSBase: false,
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
      isINSSBase: false,
    });
  }

  // Subsidio Anual (13th month salary / annual subsidy)
  const subsidioAnual = Math.max(0, input.subsidioAnual ?? 0);
  if (subsidioAnual > 0) {
    earnings.push({
      type: 'subsidio_anual',
      description: 'Annual Subsidy (13th Month)',
      descriptionTL: 'Subsidiu Anual (13º Mês)',
      amount: subsidioAnual,
      isTaxable: true,
      isINSSBase: true,
    });
  }

  // ========== CALCULATE TOTALS ==========
  // Use decimal.js for precise currency summation

  const grossPay = sumMoney(earnings.map(e => e.amount));
  const taxableIncome = sumMoney(earnings.filter(e => e.isTaxable).map(e => e.amount));
  const inssBase = sumMoney(earnings.filter(e => e.isINSSBase).map(e => e.amount));

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

  // INSS mandatory registration: contribution base is the contributable remuneration earned in the period.
  const contributableRemuneration = Math.max(0, subtractMoney(inssBase, absenceDeduction, lateDeduction));
  const inssContributionBase = input.inssContributionBase ?? contributableRemuneration;

  // Withholding Income Tax (WIT)
  const incomeTax = calculateIncomeTax(
    subtractMoney(taxableIncome, absenceDeduction, lateDeduction),
    input.taxInfo.isResident,
    input.payFrequency,
    input.totalPeriodsInMonth
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
  const inss = calculateINSS(inssContributionBase);

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

  // ========== DEDUCTION CAP (CALC-3) ==========
  // Timor-Leste Labour Law (Law 4/2012, Art. 42):
  // - Non-statutory deductions are capped at 30% of monthly salary
  // - Statutory deductions (e.g., WIT, INSS) and court orders are exempt
  const VOLUNTARY_DEDUCTION_CAP_RATIO = 0.30; // 30%

  const _statutoryTotal = sumMoney(deductions.filter(d => d.isStatutory).map(d => d.amount));
  const voluntaryDeductions = deductions.filter(d => !d.isStatutory);
  const voluntaryTotal = sumMoney(voluntaryDeductions.map(d => d.amount));
  const voluntaryCap = multiplyMoney(grossPay, VOLUNTARY_DEDUCTION_CAP_RATIO);
  let finalDeductions = deductions;

  if (voluntaryTotal > voluntaryCap && voluntaryDeductions.length > 0) {
    warnings.push(
      `Voluntary deductions ($${voluntaryTotal.toFixed(2)}) exceed the 30% cap ($${voluntaryCap.toFixed(2)}). ` +
      `Excess deductions have been reduced proportionally.`
    );
    // Proportionally reduce each voluntary deduction to fit within cap (immutable)
    const reductionRatio = voluntaryCap / voluntaryTotal;
    const adjustedVoluntary = voluntaryDeductions.map(d => ({
      ...d,
      amount: multiplyMoney(d.amount, reductionRatio),
    }));
    // Rebuild deductions array with adjusted voluntary amounts
    const voluntarySet = new Set(voluntaryDeductions);
    let volIdx = 0;
    finalDeductions = deductions.map(d =>
      voluntarySet.has(d) ? adjustedVoluntary[volIdx++] : d
    );
  }

  // ========== FINAL CALCULATIONS ==========
  // Use decimal.js for precise final totals

  const totalDeductions = sumMoney(finalDeductions.map(d => d.amount));
  const netPay = subtractMoney(grossPay, totalDeductions);
  const totalEmployerCost = addMoney(grossPay, inss.employer);

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
    subsidioAnual,

    // Totals
    grossPay,
    taxableIncome,
    inssBase: inssContributionBase,

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
    deductions: finalDeductions,

    // YTD updates (use decimal.js for precision)
    newYtdGrossPay: addMoney(input.ytdGrossPay, grossPay),
    newYtdIncomeTax: addMoney(input.ytdIncomeTax, incomeTax),
    newYtdINSSEmployee: addMoney(input.ytdINSSEmployee, inss.employee),

    // Warnings
    warnings,
  };
}

/**
 * Weekly payroll breakdown with reconciliation
 */
export interface WeeklyPayrollBreakdown {
  weekNumber: number;
  workingDays: number;
  amount: number;
  isReconciled: boolean;  // true for final week (adjusted to ensure sum = monthly)
}

/**
 * Calculate all weekly payrolls for a month with guaranteed reconciliation
 * The final week is calculated as (monthly salary - sum of previous weeks)
 * to ensure the total exactly equals the monthly salary.
 *
 * @param monthlySalary - The employee's monthly salary
 * @param weeklyWorkingDays - Array of working days per week [5, 5, 5, 5, 3] for a 23-day month
 * @returns Array of weekly payroll breakdowns that sum exactly to monthly salary
 *
 * @example
 * // Month with 23 working days (5+5+5+5+3)
 * const breakdown = calculateMonthlyWeeklyPayrolls(1000, [5, 5, 5, 5, 3]);
 * // Returns:
 * // [
 * //   { weekNumber: 1, workingDays: 5, amount: 217.39, isReconciled: false },
 * //   { weekNumber: 2, workingDays: 5, amount: 217.39, isReconciled: false },
 * //   { weekNumber: 3, workingDays: 5, amount: 217.39, isReconciled: false },
 * //   { weekNumber: 4, workingDays: 5, amount: 217.39, isReconciled: false },
 * //   { weekNumber: 5, workingDays: 3, amount: 130.44, isReconciled: true }  // adjusted!
 * // ]
 * // Total: $1000.00 (exact)
 */
export function calculateMonthlyWeeklyPayrolls(
  monthlySalary: number,
  weeklyWorkingDays: number[]
): WeeklyPayrollBreakdown[] {
  if (weeklyWorkingDays.length === 0) {
    return [];
  }

  const totalWorkingDays = weeklyWorkingDays.reduce((sum, days) => sum + days, 0);

  if (totalWorkingDays === 0) {
    return weeklyWorkingDays.map((days, index) => ({
      weekNumber: index + 1,
      workingDays: days,
      amount: 0,
      isReconciled: index === weeklyWorkingDays.length - 1,
    }));
  }

  const result: WeeklyPayrollBreakdown[] = [];
  let paidSoFar = 0;

  for (let i = 0; i < weeklyWorkingDays.length; i++) {
    const weekNumber = i + 1;
    const workingDays = weeklyWorkingDays[i];
    const isLastWeek = i === weeklyWorkingDays.length - 1;

    let amount: number;

    if (isLastWeek) {
      // Final week: calculate as remainder to ensure exact reconciliation
      amount = subtractMoney(monthlySalary, paidSoFar);
    } else {
      // Regular weeks: pro-rata based on working days
      amount = proRata(monthlySalary, workingDays, totalWorkingDays);
      paidSoFar = addMoney(paidSoFar, amount);
    }

    result.push({
      weekNumber,
      workingDays,
      amount,
      isReconciled: isLastWeek,
    });
  }

  return result;
}

/**
 * Validate payroll input before calculation
 */
export function validateTLPayrollInput(input: TLPayrollInput): string[] {
  const errors: string[] = [];

  if (input.monthlySalary < 0) {
    errors.push('Monthly salary cannot be negative.');
  } else if (input.monthlySalary < TL_INSS.minimumSalary) {
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
