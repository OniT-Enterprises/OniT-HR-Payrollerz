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
  TL_SERVICE_COMPENSATION,
  TL_NON_CASH_BENEFITS,
  TL_PAY_PERIODS,
  TLPayFrequency,
} from './constants-tl';
import {
  divideMoney,
  divideMoneyRoundUp,
  multiplyMoney,
  multiplyMoneyByFactors,
  multiplyMoneyPartsToRoundedTotal,
  applyRate,
  addMoney,
  roundMoney,
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
  overtime?: {
    standard: number;
    sundayHoliday: number;
    /** Whether overtime categories round separately or once as a combined total. */
    rounding?: 'per_component' | 'aggregate';
  };
  minimumWage?: number;
  maxOvertimePerWeek?: number;
  nonCashBenefits?: { monthlyTaxableThreshold: number };
  /** Contract/accounting convention for deriving a salaried worker's hourly rate. */
  hourlyRate?: {
    monthlyHoursDivisor: number;
    rounding: 'nearest' | 'up';
  };
  subsidioAnual?: {
    /** When false, current-year hires still receive the full month (tenant choice). */
    proRataForNewEmployees?: boolean;
  };
}

export type TLBonusINSSCategory =
  | 'individual_performance'
  | 'company_profit'
  | 'extraordinary';

export type TLNonCashBenefitINSSCategory =
  | 'regular_remuneration'
  | 'expense_allowance'
  | 'extraordinary';

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
  /**
   * INSS classification required by DL 20/2017 Arts. 8-9. It may be null only
   * when bonus is zero; payroll refuses to guess the treatment of a paid award.
   */
  bonusINSSCategory: TLBonusINSSCategory | null;
  commission: number;
  perDiem: number;               // Per diem / travel allowance (excluded from INSS base)
  foodAllowance: number;         // Food subsidy (excluded from INSS base)
  transportAllowance: number;
  otherEarnings: number;
  subsidioAnual?: number;        // 13th month salary / annual subsidy (paid in a specific run)
  /** When present, Art. 56 service compensation is derived from salary and service dates. */
  terminationDate?: string;
  /** Monthly benefit in kind. It is compensation, but is not cash paid in payroll. */
  nonCashBenefits: number;
  /** Required for a non-zero benefit because the $20 rule governs WIT, not INSS. */
  nonCashBenefitINSSCategory: TLNonCashBenefitINSSCategory | null;

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

  // Month-to-date WIT context (monthly runs only) so the resident $500/month
  // exemption is granted per employee-month, not per run. Sum of this employee's
  // taxable income (pre-threshold) and WIT already withheld from OTHER committed
  // runs in the same calendar month. Absent/0 for the first run of the month.
  mtdWitTaxableIncome?: number;
  mtdIncomeTax?: number;

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
  /** False for benefits in kind that affect tax but must not inflate cash net pay. */
  isCash?: boolean;
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
  serviceCompensation: number;
  nonCashBenefits: number;

  // Totals
  grossPay: number;              // Cash earnings before attendance reductions
  cashGrossPay: number;          // Explicit alias for grossPay at integration boundaries
  totalCompensation: number;     // Cash plus benefits in kind
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
export function calculateOvertimePay(
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
  const standardRate = config?.standard ?? TL_OVERTIME_RATES.standard;
  const sundayHolidayRate = config?.sundayHoliday ?? TL_OVERTIME_RATES.publicHoliday;

  if (config?.rounding === 'aggregate') {
    const [overtime, nightShift, holiday, restDay] =
      multiplyMoneyPartsToRoundedTotal(hourlyRate, [
        [overtimeHours, standardRate],
        [nightShiftHours, TL_OVERTIME_RATES.nightShiftPremium],
        [holidayHours, sundayHolidayRate],
        [restDayHours, sundayHolidayRate],
      ]);
    return { overtime, nightShift, holiday, restDay };
  }

  return {
    overtime: multiplyMoneyByFactors(
      hourlyRate,
      overtimeHours,
      standardRate,
    ),
    nightShift: multiplyMoneyByFactors(
      hourlyRate,
      nightShiftHours,
      TL_OVERTIME_RATES.nightShiftPremium,
    ),
    holiday: multiplyMoneyByFactors(
      hourlyRate,
      holidayHours,
      sundayHolidayRate,
    ),
    restDay: multiplyMoneyByFactors(
      hourlyRate,
      restDayHours,
      sundayHolidayRate,
    ),
  };
}

/**
 * Calculate hourly rate from monthly salary
 * Uses decimal.js for precise currency calculations
 */
export function calculateHourlyRate(
  monthlySalary: number,
  convention?: TLPayrollCalculationConfig['hourlyRate'],
): number {
  // Labour Law 4/2012 fixes the maximum at 44 hours/week but does not prescribe
  // a monthly conversion divisor. Keep the annualized default and allow the
  // contract/accounting convention to be selected explicitly.
  const monthlyHours = convention?.monthlyHoursDivisor
    ?? TL_WORKING_HOURS.standardWeeklyHours * (52 / 12);
  if (!Number.isFinite(monthlyHours) || monthlyHours <= 0) {
    throw new RangeError('Monthly hours divisor must be a positive finite number.');
  }
  return convention?.rounding === 'up'
    ? divideMoneyRoundUp(monthlySalary, monthlyHours)
    : divideMoney(monthlySalary, monthlyHours);
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
 * Returns both the withheld tax and the bracket base the rate was applied to.
 * The base feeds tax-filing reports and must NOT be reverse-derived from the
 * cent-rounded tax (tax / rate only lands on $0.10 multiples at a 10% rate).
 * Uses decimal.js for precise currency calculations
 */
export function calculateIncomeTaxWithBase(
  taxableIncome: number,
  isResident: boolean,
  payFrequency: TLPayFrequency,
  totalPeriodsInMonth?: number,
  configOverride?: {
    residentRate: number;
    nonResidentRate: number;
    residentThreshold: number;
  },
  /**
   * Month-to-date context for MONTHLY runs, so the resident $500/month exemption
   * is granted once per employee per calendar month — NOT once per run. Without
   * it, a regular monthly run plus a separate same-month run (e.g. a standalone
   * 13th-month run) would each subtract a fresh $500, under-withholding ~$50.
   * `priorTaxableIncome` is this employee's taxable income already assessed in
   * the month (pre-threshold); `priorTax` is the WIT already withheld. Ignored
   * for non-monthly frequencies, which keep the per-period prorated threshold.
   */
  monthToDate?: { priorTaxableIncome: number; priorTax: number }
): { tax: number; taxableBase: number } {
  if (taxableIncome <= 0) return { tax: 0, taxableBase: 0 };

  const rate = isResident
    ? configOverride?.residentRate ?? TL_INCOME_TAX.rate
    : configOverride?.nonResidentRate ?? TL_INCOME_TAX.rate;
  const residentThreshold = configOverride?.residentThreshold ?? TL_INCOME_TAX.residentThreshold;

  // Non-residents pay on all income (no threshold), so month-to-date is moot.
  if (!isResident) {
    return { tax: applyRate(taxableIncome, rate), taxableBase: roundMoney(taxableIncome) };
  }

  // Resident month-to-date path: apply the FULL monthly threshold once across
  // the calendar month's cumulative taxable income and charge only the increment
  // this run adds. Only engaged for monthly frequency with real prior amounts;
  // sub-monthly frequencies fall through to per-period proration below.
  if (
    payFrequency === 'monthly' &&
    monthToDate &&
    monthToDate.priorTaxableIncome > 0
  ) {
    const cumulativeAbove = Math.max(
      0,
      subtractMoney(
        addMoney(monthToDate.priorTaxableIncome, taxableIncome),
        residentThreshold,
      ),
    );
    const priorAbove = Math.max(
      0,
      subtractMoney(monthToDate.priorTaxableIncome, residentThreshold),
    );
    const thisBase = Math.max(0, subtractMoney(cumulativeAbove, priorAbove));
    const cumulativeTax = applyRate(cumulativeAbove, rate);
    const thisTax = Math.max(0, subtractMoney(cumulativeTax, monthToDate.priorTax));
    return { tax: thisTax, taxableBase: thisBase };
  }

  // Convert the monthly threshold to the current pay period.
  // For weekly/biweekly runs we prefer the actual number of periods in the month when provided
  // (prevents under/over-withholding in 4 vs 5-week months).
  const periods = TL_PAY_PERIODS[payFrequency];
  const effectivePeriodsPerMonth =
    (payFrequency === 'weekly' || payFrequency === 'biweekly') && totalPeriodsInMonth
      ? totalPeriodsInMonth
      : periods.periodsPerMonth;
  const periodThreshold = divideMoney(residentThreshold, effectivePeriodsPerMonth);

  // Only tax amount above threshold
  const taxableAmount = Math.max(0, subtractMoney(taxableIncome, periodThreshold));
  return { tax: applyRate(taxableAmount, rate), taxableBase: taxableAmount };
}

/**
 * Calculate Timor-Leste Withholding Income Tax (WIT) — tax amount only.
 * See calculateIncomeTaxWithBase for the taxable-base variant.
 */
export function calculateIncomeTax(
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
  return calculateIncomeTaxWithBase(
    taxableIncome,
    isResident,
    payFrequency,
    totalPeriodsInMonth,
    configOverride,
  ).tax;
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

interface PlainISODate {
  year: number;
  month: number;
  day: number;
}

function parsePlainISODate(value: string, fieldName: string): PlainISODate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`${fieldName} is not a valid calendar date.`);
  }

  return { year, month, day };
}

/**
 * Calculate the universal service compensation due on termination.
 *
 * Labour Law 4/2012, Art. 56 grants one monthly salary for each completed
 * five-year period, regardless of the cause of termination. This is distinct
 * from a court-awarded unlawful-dismissal indemnity under Art. 55.
 */
export function calculateServiceCompensation(
  monthlySalary: number,
  hireDate: string,
  terminationDate: string,
): number {
  return calculateServiceCompensationDetails(
    monthlySalary,
    hireDate,
    terminationDate,
  ).amount;
}

export interface TLServiceCompensationDetails {
  monthlySalary: number;
  hireDate: string;
  terminationDate: string;
  completedYears: number;
  completedFiveYearPeriods: number;
  salaryMonths: number;
  amount: number;
}

/** Return the auditable service facts behind the Article 56 amount. */
export function calculateServiceCompensationDetails(
  monthlySalary: number,
  hireDate: string,
  terminationDate: string,
): TLServiceCompensationDetails {
  if (!Number.isFinite(monthlySalary)) {
    throw new RangeError('Monthly salary must be a finite amount.');
  }
  if (monthlySalary < 0) {
    throw new RangeError('Monthly salary cannot be negative.');
  }

  const hire = parsePlainISODate(hireDate, 'Hire date');
  const termination = parsePlainISODate(terminationDate, 'Termination date');
  const hireKey = hire.year * 10_000 + hire.month * 100 + hire.day;
  const terminationKey = termination.year * 10_000 + termination.month * 100 + termination.day;
  if (terminationKey < hireKey) {
    throw new RangeError('Termination date cannot be before hire date.');
  }

  let completedYears = termination.year - hire.year;
  if (
    termination.month < hire.month ||
    (termination.month === hire.month && termination.day < hire.day)
  ) {
    completedYears -= 1;
  }

  const completedFiveYearPeriods = Math.floor(
    completedYears / TL_SERVICE_COMPENSATION.completedYearsPerSalaryMonth,
  );
  return {
    monthlySalary,
    hireDate,
    terminationDate,
    completedYears,
    completedFiveYearPeriods,
    salaryMonths: completedFiveYearPeriods,
    amount: multiplyMoney(monthlySalary, completedFiveYearPeriods),
  };
}

/**
 * Calculate Subsidio Anual (13th month salary), Labour Law 4/2012 Art. 44:
 * one month's salary, prorated by months worked in the calendar year.
 *
 * For a CONTINUING employee the proration presumes service through December,
 * so the amount is the same whether the tenant runs the subsidio in October
 * or December — an early run no longer shorts a full-year worker. Months are
 * counted on a whole-month convention (the hire month counts in full
 * regardless of day-of-month): deliberate, common TL practice, and slightly
 * employee-favourable — do not switch to day-level proration without an
 * accountant sign-off.
 *
 * Employment that ENDS inside the subsidio year (options.terminationDate)
 * caps the count at the termination month — the Art. 44 pro-rata owed to a
 * mid-year leaver.
 *
 * Uses decimal.js for precise currency calculations.
 */
export function calculateSubsidioAnual(
  monthlySalary: number,
  hireDate: string,
  asOfDate: Date = new Date(),
  options?: {
    proRataForNewEmployees?: boolean;
    terminationDate?: string | null;
  },
): number {
  const year = asOfDate.getFullYear();
  // Parse plain ISO dates calendar-safe. `new Date("YYYY-MM-DD")` is UTC
  // midnight but getFullYear()/getMonth() read local, so west of UTC a
  // first-of-month date slips to the previous month/year — the Art. 56 path
  // already avoids this with parsePlainISODate; the subsidio path must too.
  const hire = parsePlainISODate(hireDate, 'Hire date');
  if (hire.year > year) return 0;

  // Tenant may opt out of new-hire proration (full month for everyone).
  const proRataNewHires = options?.proRataForNewEmployees ?? true;
  const startMonth =
    proRataNewHires && hire.year === year ? hire.month - 1 : 0;

  let endMonth = 11; // presume service through December
  if (options?.terminationDate) {
    const term = parsePlainISODate(options.terminationDate, 'Termination date');
    if (term.year < year) return 0;
    if (term.year === year) endMonth = term.month - 1;
  }

  const effectiveMonths = Math.max(0, endMonth - startMonth + 1);
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
    : calculateHourlyRate(input.monthlySalary, config?.hourlyRate);

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

  // Deliberately a FULL 2× line on top of the salary, not a "top-up to 2×
  // total": Art. 31 makes the holiday itself paid rest (already inside a
  // monthly salary) and Art. 27(2) separately remunerates work done on it at
  // the normal hourly rate + 100%. Two distinct entitlements — a salaried
  // worker who works the holiday ends the day at salary + 2×, and that is the
  // statutory reading pinned by rl-holiday-restday.test.ts.
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
    if (!input.bonusINSSCategory) {
      throw new RangeError(
        'Bonus INSS category is required: individual performance, company profit, or extraordinary.',
      );
    }
    earnings.push({
      type: 'bonus',
      description: 'Bonus',
      descriptionTL: 'Bónus',
      amount: input.bonus,
      isTaxable: true,
      // DL 20/2017 Art. 8 includes individual performance/productivity pay;
      // Art. 9 excludes company-profit awards and extraordinary benefits.
      isINSSBase: input.bonusINSSCategory === 'individual_performance',
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
      // Commission is individual performance/productivity remuneration under
      // DL 20/2017 Art. 8, rather than an Art. 9 company-profit gratuity.
      isINSSBase: true,
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

  // Universal service compensation (Labour Law 4/2012, Art. 56). Tax Law
  // 8/2008 Art. 1 includes termination compensation in salary for WIT. This
  // Art. 56 payment is not the fixed-term unlawful-dismissal indemnity added to
  // the INSS base by DL 30/2021, so it is not contributable here.
  const serviceCompensation = Math.max(
    0,
    input.terminationDate
      ? calculateServiceCompensation(input.monthlySalary, input.hireDate, input.terminationDate)
      : 0,
  );
  if (serviceCompensation > 0) {
    earnings.push({
      type: 'service_compensation',
      description: 'Termination Service Compensation',
      descriptionTL: 'Kompensasaun Servisu Terminasaun',
      amount: serviceCompensation,
      isTaxable: true,
      isINSSBase: false,
    });
  }

  const nonCashBenefits = Math.max(0, input.nonCashBenefits);
  const nonCashThreshold =
    config?.nonCashBenefits?.monthlyTaxableThreshold ??
    TL_NON_CASH_BENEFITS.monthlyTaxableThreshold;
  if (nonCashBenefits > 0) {
    if (!input.nonCashBenefitINSSCategory) {
      throw new RangeError(
        'Non-cash benefit INSS category is required: regular remuneration, expense allowance, or extraordinary.',
      );
    }
    earnings.push({
      type: 'non_cash_benefit',
      description: 'Non-cash Benefits',
      descriptionTL: 'Benefísiu La-Os Osan',
      amount: nonCashBenefits,
      // Tax Law 8/2008 Art. 1 uses a strict "greater than $20" test. Once
      // crossed, the benefit is salary; the law does not state an excess-only rule.
      isTaxable: nonCashBenefits > nonCashThreshold,
      // Labour Law Art. 2(t) includes regular pay in cash or in kind;
      // DL 20/2017 Art. 9 excludes expense allowances and extraordinary benefits.
      isINSSBase: input.nonCashBenefitINSSCategory === 'regular_remuneration',
      isCash: false,
    });
  }

  // ========== CALCULATE TOTALS ==========
  // Use decimal.js for precise currency summation

  const totalCompensation = sumMoney(earnings.map(e => e.amount));
  const grossPay = sumMoney(earnings.filter(e => e.isCash !== false).map(e => e.amount));
  const cashGrossPay = grossPay;
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
  const wagesPaid = Math.max(0, subtractMoney(cashGrossPay, absenceDeduction, lateDeduction));
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

  // Withholding Income Tax (WIT). Report the actual bracket base alongside the
  // tax — deriving it back as tax / rate loses cents to the tax's own rounding.
  // Exempt employees withhold nothing and report a zero base.
  const { tax: incomeTax, taxableBase: witTaxableAmount } = input.taxInfo.hasTaxExemption
    ? { tax: 0, taxableBase: 0 }
    : calculateIncomeTaxWithBase(
        taxableIncome,
        input.taxInfo.isResident,
        input.payFrequency,
        input.totalPeriodsInMonth,
        config?.incomeTax,
        {
          priorTaxableIncome: input.mtdWitTaxableIncome ?? 0,
          priorTax: input.mtdIncomeTax ?? 0,
        },
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
  // WIT and INSS must be withheld at their statutory amounts. COURT ORDERS are
  // also outside the 30% ceiling: Art. 42(2) authorises deductions "determined
  // by law or by judicial decision", and the TL Código de Processo Civil
  // (Arts. 702/737) has the JUDGE fix the garnishable slice (1/6–1/3 of wages)
  // and the employer merely deposit it to the court — the employer has no power
  // to shave it to fit Art. 42(3). Voluntary/employer deductions still share
  // what remains of the ceiling. Unpaid absence/late time is a loss of
  // remuneration under Art. 33(5), not a retained amount, so it too sits outside.
  // See docs/MINED_SIGNOFF_ANSWERS_JUL2026.md §5.
  const DEDUCTION_CAP_RATIO = 0.30;
  const protectedDeductions = deductions.filter(
    d => d.type === 'income_tax' || d.type === 'inss_employee' || d.type === 'court_order',
  );
  const deductionsToCap = deductions.filter(
    d => !protectedDeductions.includes(d) && d.type !== 'absence' && d.type !== 'late_arrival',
  );
  const protectedTotal = sumMoney(protectedDeductions.map(d => d.amount));
  const cappedTotal = sumMoney(deductionsToCap.map(d => d.amount));
  const totalCap = multiplyMoney(wagesPaid, DEDUCTION_CAP_RATIO);
  const availableCap = maxMoney(0, subtractMoney(totalCap, protectedTotal));
  let finalDeductions = deductions;

  // A court order may on its own carry total withholding past the 30% guideline.
  // That is lawful (the tribunal fixed the amount) — surface it, don't reduce it.
  const courtOrderTotal = sumMoney(
    deductions.filter(d => d.type === 'court_order').map(d => d.amount),
  );
  if (courtOrderTotal > 0 && protectedTotal > totalCap) {
    warnings.push(
      'Court-ordered deductions bring total withholding above the Labour-Law ' +
        '30% guideline (Art. 42(3)). The tribunal-fixed amount stands — keep the ' +
        'court notification on file.',
    );
  }

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
  const netPay = subtractMoney(cashGrossPay, totalDeductions);
  const totalCompensationPaid = Math.max(
    0,
    subtractMoney(totalCompensation, absenceDeduction, lateDeduction),
  );
  const totalEmployerCost = addMoney(totalCompensationPaid, inss.employer);
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
    serviceCompensation,
    nonCashBenefits,

    // Totals
    grossPay,
    cashGrossPay,
    totalCompensation,
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

  if (input.nonCashBenefits < 0) {
    errors.push('Non-cash benefits cannot be negative.');
  }

  if (input.nonCashBenefits > 0 && !input.nonCashBenefitINSSCategory) {
    errors.push(
      'Non-cash benefit INSS category is required: regular remuneration, expense allowance, or extraordinary.',
    );
  }

  if (input.bonus > 0 && !input.bonusINSSCategory) {
    errors.push(
      'Bonus INSS category is required: individual performance, company profit, or extraordinary.',
    );
  }

  if (input.terminationDate) {
    try {
      calculateServiceCompensation(input.monthlySalary, input.hireDate, input.terminationDate);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Termination dates are invalid.');
    }
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
