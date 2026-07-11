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
  maxMoney,
} from '@/lib/currency';

// ============================================
// TYPES
// ============================================

export interface TLEmployeeTaxInfo {
  isResident: boolean;           // Resident vs non-resident
  hasTaxExemption: boolean;      // Exempt from WIT withholding (e.g. shareholder distributions)
  inssExempt?: boolean;          // Not INSS-enrolled (e.g. shareholders paid distributions, not wages)
}

export interface TLPayrollCalculationConfig {
  incomeTax?: {
    residentRate: number;
    nonResidentRate: number;
    residentThreshold: number;
  };
  inss?: { employeeRate: number; employerRate: number };
  overtime?: { standard: number; sundayHoliday: number };
  minimumWage?: number;
  maxOvertimePerWeek?: number;
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
  wagesPaid: number;             // Gross earnings less unpaid absence/late reductions
  taxableIncome: number;         // Taxable wages after absence/late reductions
  witTaxableAmount: number;      // Amount to which the WIT rate was applied
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
  restDayHours: number,
  config?: TLPayrollCalculationConfig['overtime'],
): {
  overtime: number;
  nightShift: number;
  holiday: number;
  restDay: number;
} {
  return {
    overtime: multiplyMoney(
      multiplyMoney(hourlyRate, overtimeHours),
      config?.standard ?? TL_OVERTIME_RATES.standard,
    ),
    nightShift: multiplyMoney(
      multiplyMoney(hourlyRate, nightShiftHours),
      TL_OVERTIME_RATES.nightShiftPremium,
    ),
    holiday: multiplyMoney(
      multiplyMoney(hourlyRate, holidayHours),
      config?.sundayHoliday ?? TL_OVERTIME_RATES.publicHoliday,
    ),
    restDay: multiplyMoney(
      multiplyMoney(hourlyRate, restDayHours),
      config?.sundayHoliday ?? TL_OVERTIME_RATES.restDay,
    ),
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
  configOverride?: {
    residentRate: number;
    nonResidentRate: number;
    residentThreshold: number;
  }
): number {
  if (taxableIncome <= 0) return 0;

  const rate = isResident
    ? configOverride?.residentRate ?? TL_INCOME_TAX.rate
    : configOverride?.nonResidentRate ?? TL_INCOME_TAX.rate;
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
export function calculateTLPayroll(
  input: TLPayrollInput,
  config?: TLPayrollCalculationConfig,
): TLPayrollResult {
  const warnings: string[] = [];
  const earnings: TLPayrollEarning[] = [];
  const deductions: TLPayrollDeduction[] = [];

  // Calculate hourly rate for overtime/deductions
  const hourlyRate = input.isHourly && input.hourlyRate
    ? input.hourlyRate
    : calculateHourlyRate(input.monthlySalary);

  const dailyRate = multiplyMoney(hourlyRate, TL_WORKING_HOURS.standardDailyHours);

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
    input.restDayHours,
    config?.overtime,
  );

  if (input.overtimeHours > 0) {
    earnings.push({
      type: 'overtime',
      description: 'Overtime',
      descriptionTL: 'Oras Extra',
      hours: input.overtimeHours,
      rate: multiplyMoney(
        hourlyRate,
        config?.overtime?.standard ?? TL_OVERTIME_RATES.standard,
      ),
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
      rate: multiplyMoney(hourlyRate, TL_OVERTIME_RATES.nightShiftPremium),
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
      rate: multiplyMoney(
        hourlyRate,
        config?.overtime?.sundayHoliday ?? TL_OVERTIME_RATES.publicHoliday,
      ),
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
      rate: multiplyMoney(
        hourlyRate,
        config?.overtime?.sundayHoliday ?? TL_OVERTIME_RATES.restDay,
      ),
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
  const taxableEarnings = sumMoney(earnings.filter(e => e.isTaxable).map(e => e.amount));
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

  // Attendance reductions are not money owed to a third party. Keep them as
  // payslip deductions, but report statutory wages and employer cost after the
  // reduction. This also nets the separate sick-pay earning against the absent
  // hours for salaried staff.
  const wagesPaid = Math.max(0, subtractMoney(grossPay, absenceDeduction, lateDeduction));
  const taxableIncome = Math.max(
    0,
    subtractMoney(taxableEarnings, absenceDeduction, lateDeduction),
  );

  // INSS mandatory registration: contribution base is the contributable remuneration earned in the period.
  // Exempt payees (e.g. shareholders) are not enrolled, so their base is zero.
  const contributableRemuneration = Math.max(0, subtractMoney(inssBase, absenceDeduction, lateDeduction));
  const inssContributionBase = input.taxInfo.inssExempt
    ? 0
    : input.inssContributionBase ?? contributableRemuneration;

  // Withholding Income Tax (WIT)
  const incomeTax = input.taxInfo.hasTaxExemption
    ? 0
    : calculateIncomeTax(
        taxableIncome,
        input.taxInfo.isResident,
        input.payFrequency,
        input.totalPeriodsInMonth,
        config?.incomeTax,
      );
  const appliedIncomeTaxRate = input.taxInfo.isResident
    ? config?.incomeTax?.residentRate ?? TL_INCOME_TAX.rate
    : config?.incomeTax?.nonResidentRate ?? TL_INCOME_TAX.rate;
  const witTaxableAmount = appliedIncomeTaxRate > 0
    ? divideMoney(incomeTax, appliedIncomeTaxRate)
    : 0;

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
  const inss = calculateINSS(inssContributionBase, config?.inss);

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
  // Timor-Leste Labour Law (Lei 4/2012), Artigo 42.º(3) — CONFIRMED from primary source:
  //   "Os descontos efetuados não podem exceder, por mês, 30 por cento do valor total
  //    da remuneração recebida pelo trabalhador."
  //   ("Deductions made may not exceed, per month, 30% of the total remuneration received.")
  // WIT and INSS must be withheld at their statutory amounts. All remaining
  // deductions (including court orders) share what remains of the 30% ceiling.
  // Unpaid absence/late time is a loss of remuneration under Art. 33(5), not a
  // retained amount awaiting remittance, so it sits outside this ceiling.
  const DEDUCTION_CAP_RATIO = 0.30;
  const protectedDeductions = deductions.filter(
    d => d.type === 'income_tax' || d.type === 'inss_employee',
  );
  const deductionsToCap = deductions.filter(
    d => !protectedDeductions.includes(d) && d.type !== 'absence' && d.type !== 'late_arrival',
  );
  const protectedTotal = sumMoney(protectedDeductions.map(d => d.amount));
  const cappedTotal = sumMoney(deductionsToCap.map(d => d.amount));
  const totalCap = multiplyMoney(wagesPaid, DEDUCTION_CAP_RATIO);
  const availableCap = maxMoney(0, subtractMoney(totalCap, protectedTotal));
  let finalDeductions = deductions;

  if (cappedTotal > availableCap && deductionsToCap.length > 0) {
    warnings.push(
      `Payroll deductions exceed the 30% cap ($${totalCap.toFixed(2)}). ` +
      `Excess deductions have been reduced proportionally.`
    );
    const reductionRatio = availableCap / cappedTotal;
    let allocatedCap = 0;
    const adjustedCapped = deductionsToCap.map((deduction, index) => {
      const remainingCap = maxMoney(0, subtractMoney(availableCap, allocatedCap));
      const proportionalAmount = index === deductionsToCap.length - 1
        ? remainingCap
        : multiplyMoney(deduction.amount, reductionRatio);
      // Never deduct more than the line's requested amount, even when the last
      // line absorbs the cent remainder (the cap is a ceiling, not a target).
      const amount = Math.min(proportionalAmount, remainingCap, deduction.amount);
      allocatedCap = addMoney(allocatedCap, amount);
      return { ...deduction, amount };
    });
    const cappedSet = new Set(deductionsToCap);
    let cappedIndex = 0;
    finalDeductions = deductions.map(d =>
      cappedSet.has(d) ? adjustedCapped[cappedIndex++] : d
    );
  }

  // ========== FINAL CALCULATIONS ==========
  // Use decimal.js for precise final totals

  const totalDeductions = sumMoney(finalDeductions.map(d => d.amount));
  const netPay = subtractMoney(grossPay, totalDeductions);
  const totalEmployerCost = addMoney(wagesPaid, inss.employer);
  const finalDeductionAmount = (type: string): number => sumMoney(
    finalDeductions.filter(deduction => deduction.type === type).map(deduction => deduction.amount),
  );

  // Warnings
  if (netPay < 0) {
    warnings.push('Net pay is negative. Please review deductions.');
  }

  if (input.taxInfo.hasTaxExemption || input.taxInfo.inssExempt) {
    const exempted = [
      ...(input.taxInfo.hasTaxExemption ? ['WIT'] : []),
      ...(input.taxInfo.inssExempt ? ['INSS'] : []),
    ];
    warnings.push(`Statutory exemption applied: ${exempted.join(' and ')} not withheld for this payee.`);
  } else if (input.taxInfo.isResident && incomeTax === 0) {
    warnings.push('Income is below the pro-rated resident threshold for this pay period - no WIT applied.');
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
    wagesPaid,
    taxableIncome,
    witTaxableAmount,
    inssBase: inssContributionBase,

    // Deductions
    incomeTax,
    inssEmployee: inss.employee,
    loanRepayment: finalDeductionAmount('loan_repayment'),
    advanceRepayment: finalDeductionAmount('advance_repayment'),
    courtOrders: finalDeductionAmount('court_order'),
    absenceDeduction,
    lateDeduction,
    otherDeductions: finalDeductionAmount('other'),

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
interface WeeklyPayrollBreakdown {
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
export function validateTLPayrollInput(
  input: TLPayrollInput,
  config?: TLPayrollCalculationConfig,
): string[] {
  const errors: string[] = [];

  // Minimum wage applies to employment relationships. Fully exempt payees (shareholders
  // receiving distributions rather than wages) are outside it and may be paid any amount.
  const isStatutoryExempt = input.taxInfo.hasTaxExemption && input.taxInfo.inssExempt;

  if (input.monthlySalary < 0) {
    errors.push('Monthly salary cannot be negative.');
  } else if (
    input.monthlySalary < (config?.minimumWage ?? TL_INSS.minimumSalary) &&
    !isStatutoryExempt
  ) {
    const minimumWage = config?.minimumWage ?? TL_INSS.minimumSalary;
    errors.push(`Monthly salary ($${input.monthlySalary}) is below minimum wage ($${minimumWage}).`);
  }

  if (input.regularHours < 0) {
    errors.push('Regular hours cannot be negative.');
  }

  const maxOvertimePerWeek = config?.maxOvertimePerWeek ?? TL_WORKING_HOURS.maxOvertimePerWeek;
  if (input.overtimeHours > maxOvertimePerWeek * 4) {
    errors.push(`Overtime hours (${input.overtimeHours}) exceed maximum allowed per month.`);
  }

  if (input.sickDaysUsed > 0 && input.ytdSickDaysUsed + input.sickDaysUsed > TL_SICK_LEAVE.totalDays) {
    errors.push(`Total sick days (${input.ytdSickDaysUsed + input.sickDaysUsed}) exceed annual limit (${TL_SICK_LEAVE.totalDays}).`);
  }

  return errors;
}
