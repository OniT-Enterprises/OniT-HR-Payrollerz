/**
 * Settings & Configuration Types for Timor-Leste HR/Payroll System
 */

// ============================================
// Section A2: Company Details
// ============================================

export type BusinessType = 'SA' | 'Lda' | 'Unipessoal' | 'ENIN' | 'NGO' | 'Government' | 'Other';

export interface CompanyDetails {
  legalName: string;
  tradingName?: string;
  registeredAddress: string;
  city: string;
  country: string;
  /**
   * Canonical Timor-Leste company identifier. Business Registration DL 16/2017
   * Art. 38 makes the SERVE Número Único da Empresa the same number as the NIF/TIN.
   * Do not introduce a second SERVE registration-number field.
   */
  tinNumber: string;
  /** Employer social-security registration number used on INSS submissions. */
  employerNiss?: string;
  /**
   * The instalment cadence this taxpayer's e-Tax account is registered for.
   * Leave unset (or 'auto') to follow Lei 8/2008 Sec. 64.1/64.2 from turnover.
   * Set 'monthly' when ATTL issues monthly "Domestic Installment Tax"
   * assessments despite prior-year turnover being at or under $1m — a real and
   * common setup that the statutory rule alone would file quarterly, leaving
   * the intervening months with no obligation to record.
   * See client/lib/tax/income-tax-installment-tl.ts.
   */
  incomeTaxInstallmentFrequency?: 'auto' | 'monthly';
  logoUrl?: string;
  businessType: BusinessType;
  businessTypeOther?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// ============================================
// Section A3: Company Structure
// ============================================

export type BusinessSector =
  | 'government'
  | 'ngo'
  | 'trading'
  | 'hotel'
  | 'restaurant'
  | 'telecommunications'
  | 'manufacturing'
  | 'security'
  | 'construction'
  | 'retail'
  | 'healthcare'
  | 'education'
  | 'finance'
  | 'technology'
  | 'agriculture'
  | 'transport'
  | 'beauty_salon'
  | 'other';

export interface WorkLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  isHeadquarters: boolean;
  isActive: boolean;
}

export interface DepartmentConfig {
  id: string;
  name: string;
  code?: string;
  parentId?: string; // For hierarchy
  managerId?: string;
  budget?: number;
  isActive: boolean;
}

export type EmployeeGrade =
  | 'director'
  | 'senior_management'
  | 'management'
  | 'supervisor'
  | 'general_staff'
  | 'level_a'
  | 'level_b'
  | 'level_c'
  | 'level_d';

export interface EmployeeGradeConfig {
  grade: EmployeeGrade;
  label: string;
  minSalary?: number;
  maxSalary?: number;
  isActive: boolean;
}

export interface CompanyStructure {
  businessSector: BusinessSector;
  businessSectorOther?: string;
  /**
   * Services-tax automation is safe only when every customer receipt belongs
   * to a designated hotel, restaurant/bar or telecommunications service.
   * Mixed businesses stay manual.
   */
  servicesTaxReceiptMode?: 'manual' | 'all_designated';
  workLocations: WorkLocation[];
  approximateEmployeeCount?: number;
  departments: DepartmentConfig[];
  employeeGrades: EmployeeGradeConfig[];
}

// ============================================
// Section A4: Payment Structure
// ============================================

export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'other';
export type EmploymentType = 'open_ended' | 'fixed_term' | 'agency' | 'contractor';
export type PayrollFrequency = 'hourly' | 'daily' | 'weekly' | 'bi_weekly' | 'monthly';

export interface BankAccountConfig {
  id: string;
  purpose: 'payroll' | 'tax' | 'social_security' | 'general';
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode?: string;
  swiftCode?: string;
  /** GL cash account credited when this real bank account makes a payment. */
  ledgerAccountCode?: '1120' | '1130';
  isActive: boolean;
}

export interface PayrollPeriodConfig {
  frequency: PayrollFrequency;
  startDay: number; // 1-31
  endDay: number; // 1-31
  payDay: number; // 1-31
  isActive: boolean;
}

export interface PaymentStructure {
  paymentMethods: PaymentMethod[];
  primaryPaymentMethod: PaymentMethod;
  bankAccounts: BankAccountConfig[];
  employmentTypes: EmploymentType[];
  payrollFrequencies: PayrollFrequency[];
  payrollPeriods: PayrollPeriodConfig[];
}

// ============================================
// Time-off Policies (Part of A4)
// ============================================

export interface LeaveTypeConfig {
  id: string;
  name: string;
  code: string;
  daysPerYear: number;
  isPaid: boolean;
  paidPercentage: number; // 100 = full pay, 50 = half pay
  requiresCertificate: boolean;
  certificateType?: string; // e.g., "Medical Certificate"
  carryOverAllowed: boolean;
  maxCarryOverDays?: number;
  isActive: boolean;
}

export interface TimeOffPolicies {
  probationMonthsBeforeLeave: number; // How many months before leave is allowed
  annualLeave: LeaveTypeConfig;
  sickLeave: LeaveTypeConfig;
  maternityLeave: LeaveTypeConfig;
  paternityLeave: LeaveTypeConfig;
  /**
   * Lei 4/2012 Art. 59(4): "Em caso de interrupção da gravidez a trabalhadora
   * tem direito a uma licença com a duração de 4 semanas". Employer-unpaid by
   * default — same INSS parental-subsidy regime as maternity (DL 18/2017).
   */
  miscarriageLeave: LeaveTypeConfig;
  /**
   * Pooled justified absence — Lei 4/2012 Art. 33(3): 3 paid days per calendar
   * year covering marriage, family death, and community/religious events.
   */
  specialLeave: LeaveTypeConfig;
  unpaidLeave: LeaveTypeConfig;
  /**
   * Student-worker exam leave — Lei 4/2012 Art. 76(3): absence "sem perda da
   * remuneração ou de quaisquer direitos, para realização de provas de
   * avaliação" (paid, exams only; proof may be requested per Art. 76(5)).
   */
  studyLeave: LeaveTypeConfig;
  childcareLeave: LeaveTypeConfig;
  customLeaveTypes: LeaveTypeConfig[];
  holidayCarryOver: boolean;
  maxCarryOverDays: number;
  /**
   * How this company records attendance.
   *
   * `exceptions` (default) — record only what deviates: absences and overtime.
   * This is what Timor-Leste law actually asks for. Art. 20(f) requires a
   * personnel register carrying "férias e faltas justificadas e não
   * justificadas"; Art. 27(6) requires a per-worker register of "o início e o
   * termo das horas extraordinárias". NEITHER requires recording that somebody
   * turned up on a normal day.
   *
   * `daily` — record every person every day. Needed when pay depends on hours
   * (waged staff), or when lateness or night work must be evidenced.
   *
   * It lives on TimeOffPolicies because that is the Time & Leave policy blob
   * the settings page already saves in one write — the same place as
   * probationMonthsBeforeLeave and holidayCarryOver, which are likewise not
   * "types of time off".
   */
  attendanceMode: 'exceptions' | 'daily';
  /**
   * Which weekdays this company works. 0 = Sunday … 6 = Saturday.
   *
   * Defaults to Mon–Fri, which is what Xefe assumed for everyone before this
   * field existed — so no tenant's leave durations move without someone
   * choosing it. It is NOT the statutory norm: Art. 25 fixes the week at 44
   * hours, which is not 5 × 8, and Art. 30(2) makes Sunday only the DEFAULT
   * rest day, departable where the service cannot be interrupted (hotels,
   * restaurants, clinics, security). Most Timor-Leste businesses work six days.
   *
   * Leave duration is counted over these days, on the client AND in
   * functions/src/timeleave.ts, which recomputes it and is authoritative.
   *
   * Still to do: the Art. 27(2) 2x premium is paid for SUNDAY specifically
   * rather than following the worker's actual rest day — tracked as L2 in
   * docs/TL_LAW_GAP_MATRIX_JUL2026.md. See docs/NICO_OPEN_QUESTIONS.md A6.
   */
  workingDays: number[];
}

// ============================================
// Tax & Social Security (TL Specific)
// ============================================

export interface TaxConfig {
  // Wage Income Tax (WIT)
  residentThreshold: number; // $500 in TL
  residentRate: number; // 10%
  nonResidentRate: number; // 10% flat
  /**
   * @deprecated Never read — the WIT deadline is statutory (day 15 of the
   * following month, Law 8/2008 Art. 23) and lives in
   * client/lib/tax/compliance.ts. Kept only for stored-document compatibility.
   */
  paymentDueDay: number;
}

export interface SocialSecurityConfig {
  employeeRate: number; // 4%
  employerRate: number; // 6%
  /**
   * @deprecated Never read — INSS deadlines are statutory (statement day 10,
   * payment day 20 of the following month) and live in
   * client/services/taxFilingService.ts. Kept only for stored-document compatibility.
   */
  paymentDueDay: number;
  excludeFoodAllowance: boolean;
  excludePerDiem: boolean;
}

export interface PayrollConfig {
  tax: TaxConfig;
  socialSecurity: SocialSecurityConfig;
  minimumWage: number; // $115 in TL
  currency: string; // USD
  currencySymbol: string; // $
  maxWorkHoursPerWeek: number; // 44 in TL
  /** Workpaper method used for hourly-rate derivation and overtime rounding. */
  hourlyRateConvention: 'weekly_average' | 'fixed_190_round_up';
  overtimeRates: {
    standard: number; // 1.5 (normal hourly pay + 50%) — multiplier
    sundayHoliday: number; // 2.0 (100% extra) — multiplier
    /**
     * Additive premium for normal hours worked at night (21:00–06:00), as a
     * PERCENT (25 = +25% on top of base pay). Statutory minimum is 25%.
     * Optional because pre-existing tenant docs lack it; the settings mapper
     * fills the default.
     */
    nightShiftPremium?: number;
  };
  subsidioAnual: {
    enabled: boolean;
    /**
     * @deprecated Never read — the 13th-month deadline is statutory (by 20
     * December, Labour Law Art. 44). Kept only for stored-document compatibility.
     */
    payByDate: string;
    proRataForNewEmployees: boolean;
  };
  // Solo-operator mode: lets the creator of a payroll run approve it themselves.
  // Default false = safer two-person approval (creator != approver).
  allowSelfApproval?: boolean;
  /**
   * Small-employer INSS discount — DL 20/2017 Art. 86. Enable when the tenant
   * qualifies (≤10 workers, ≥60% Timorese nationals, contributions regularized);
   * INSS's portal auto-applies it, so this keeps Xefe's employer INSS in step
   * with the payment guide (5.4% instead of 6% through Dec 2026, then 6%). The
   * employee 4% is never reduced. Default false.
   */
  smallEmployerInssDiscount?: boolean;
  /**
   * This tenant is a petroleum Contractor — a party to a Petroleum Agreement
   * under Lei 8/2008 Sec. 68.1.
   *
   * If so, its employees are NOT taxed under Schedule V. Sec. 72.2 sends them
   * to SCHEDULE IX instead: resident with a TIN 10% to $550/mo then 30%,
   * non-resident 20% flat, anyone else 30% flat, plus a $10/month personal
   * credit. Depreciation likewise moves to Schedule X. It is a parallel regime,
   * not a rate tweak, and filing goes to ATTL's petroleum directorate.
   *
   * Xefe does not implement it, so when this is set the payroll run is REFUSED
   * rather than computed at domestic rates. Guessing would under-withhold — a
   * non-resident on $3,000/month is $300 under Schedule V against $600 under
   * Schedule IX — and Sec. 25.3 makes the shortfall the employer's liability.
   * `client/lib/tax/withholding-tl.ts` already refuses supplier withholding for
   * the same reason, and since 2026-08-13 so does the payroll ENGINE
   * (`UnsupportedTLPetroleumPayrollError`) — the wizard screen was previously the
   * only guard, so a non-wizard caller computed Schedule V silently.
   *
   * Verbatim rates, who is caught, and what implementing it would take:
   * docs/PETROLEUM_SCHEDULE_IX.md.
   */
  petroleumContractor?: boolean;
}

// ============================================
// Complete Tenant/Company Settings
// ============================================

export interface TenantSettings {
  id: string;
  tenantId: string;

  // Sections
  companyDetails: CompanyDetails;
  companyStructure: CompanyStructure;
  paymentStructure: PaymentStructure;
  timeOffPolicies: TimeOffPolicies;
  payrollConfig: PayrollConfig;

  // HR Admins are stored separately but linked
  hrAdminIds: string[];

  // AI Assistant configuration
  openaiApiKey?: string;

  // Setup wizard progress
  setupComplete: boolean;
  setupProgress: {
    companyDetails: boolean;
    companyStructure: boolean;
    paymentStructure: boolean;
    timeOffPolicies: boolean;
    payrollConfig: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Default Values for Timor-Leste
// ============================================

const TL_DEFAULT_TAX_CONFIG: TaxConfig = {
  residentThreshold: 500,
  residentRate: 10,
  nonResidentRate: 10,
  paymentDueDay: 15,
};

const TL_DEFAULT_SS_CONFIG: SocialSecurityConfig = {
  employeeRate: 4,
  employerRate: 6,
  paymentDueDay: 20,
  excludeFoodAllowance: true,
  excludePerDiem: true,
};

export const TL_DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  tax: TL_DEFAULT_TAX_CONFIG,
  socialSecurity: TL_DEFAULT_SS_CONFIG,
  minimumWage: 115,
  currency: 'USD',
  currencySymbol: '$',
  maxWorkHoursPerWeek: 44,
  hourlyRateConvention: 'weekly_average',
  overtimeRates: {
    standard: 1.5,
    sundayHoliday: 2.0,
    nightShiftPremium: 25,
  },
  subsidioAnual: {
    enabled: true,
    payByDate: '12-20',
    proRataForNewEmployees: true,
  },
  allowSelfApproval: false,
};

export const TL_DEFAULT_LEAVE_POLICIES: TimeOffPolicies = {
  probationMonthsBeforeLeave: 3,
  annualLeave: {
    id: 'annual',
    name: 'Annual Leave',
    code: 'AL',
    daysPerYear: 12,
    isPaid: true,
    paidPercentage: 100,
    requiresCertificate: false,
    carryOverAllowed: true,
    maxCarryOverDays: 6,
    isActive: true,
  },
  sickLeave: {
    id: 'sick',
    name: 'Sick Leave',
    code: 'SL',
    daysPerYear: 12,
    isPaid: true,
    paidPercentage: 100,
    requiresCertificate: true,
    certificateType: 'Medical Certificate',
    carryOverAllowed: false,
    isActive: true,
  },
  // Maternity/paternity are EMPLOYER-UNPAID by default: since DL 18/2017 the
  // INSS parental subsidy (100% of the reference wage, paid directly to the
  // worker who has 6-in-12-months contributions) replaced the employer's
  // Art. 61 salary duty, and Art. 21(3) voids the subsidy for any day the
  // worker receives salary. A tenant that explicitly sets isPaid/paidPercentage
  // chooses employer-paid leave INSTEAD of the subsidy — that stays honored.
  maternityLeave: {
    id: 'maternity',
    name: 'Maternity Leave',
    code: 'ML',
    daysPerYear: 84, // 12 weeks
    isPaid: false, // INSS subsidy, not employer salary (DL 18/2017)
    paidPercentage: 0,
    requiresCertificate: true,
    certificateType: 'Medical Certificate',
    carryOverAllowed: false,
    isActive: true,
  },
  paternityLeave: {
    id: 'paternity',
    name: 'Paternity Leave',
    code: 'PL',
    daysPerYear: 5,
    isPaid: false, // INSS subsidy, not employer salary (DL 18/2017)
    paidPercentage: 0,
    requiresCertificate: true,
    certificateType: 'Birth Certificate',
    carryOverAllowed: false,
    isActive: true,
  },
  miscarriageLeave: {
    // Lei 4/2012 Art. 59(4): "licença com a duração de 4 semanas" after a
    // pregnancy interruption — 4 calendar weeks ≈ 20 working days in the
    // working-day balance math. Employer-UNPAID by default, mirroring
    // maternity: the INSS parental subsidy (DL 18/2017) covers it, and
    // Art. 21(3) voids the subsidy for days the worker receives salary. A
    // tenant that explicitly sets a paid percentage chooses employer-paid
    // leave INSTEAD of the subsidy — that stays honored.
    id: 'miscarriage',
    name: 'Miscarriage Leave (Art. 59.4)',
    code: 'MCL',
    daysPerYear: 20, // 4 weeks (Art. 59(4)) as working days
    isPaid: false, // INSS subsidy, not employer salary (DL 18/2017)
    paidPercentage: 0,
    requiresCertificate: true,
    certificateType: 'Medical Certificate',
    carryOverAllowed: false,
    isActive: true,
  },
  specialLeave: {
    // Lei 4/2012 Art. 33(3): one pooled allotment covering marriage, family
    // death, and community/religious events. Employer may request proof
    // (Art. 33(7)); overflow is taken as annual leave, then unpaid.
    id: 'special',
    name: 'Special leave (Art. 33.3)',
    code: 'SPL',
    daysPerYear: 3,
    isPaid: true,
    paidPercentage: 100,
    requiresCertificate: false,
    carryOverAllowed: false,
    isActive: true,
  },
  unpaidLeave: {
    id: 'unpaid',
    name: 'Unpaid Leave',
    code: 'UL',
    daysPerYear: 30,
    isPaid: false,
    paidPercentage: 0,
    requiresCertificate: false,
    carryOverAllowed: false,
    isActive: true,
  },
  studyLeave: {
    // Lei 4/2012 Art. 76(3): the worker-student may be absent "sem perda da
    // remuneração ou de quaisquer direitos, para realização de provas de
    // avaliação" — PAID, exams only. 3 working days/year is Xefe's
    // configurable default (the statute sets no annual cap). Art. 76(5):
    // proof of student status may be requested.
    id: 'study',
    name: 'Study Leave (Art. 76.3)',
    code: 'STL',
    daysPerYear: 3,
    isPaid: true,
    paidPercentage: 100,
    requiresCertificate: false,
    carryOverAllowed: false,
    isActive: true,
  },
  childcareLeave: {
    // Lei 4/2012 Art. 64(1): a worker with a child under 10 may be absent up
    // to 5 days a year to give "assistência, inadiável e imprescindível" when
    // that child is ill or has had an accident, "devendo apresentar
    // justificação". The 5 days are the STATUTORY MAXIMUM, not a default an
    // employer is free to raise — the settings row says so.
    // Art. 64(2): the absence "determina apenas a perda de remuneração
    // relativa aos dias em causa" — unpaid, and that is the whole cost. It
    // does not come out of annual leave and is never an unjustified absence.
    id: 'childcare',
    name: 'Childcare Leave (Art. 64)',
    code: 'CCL',
    daysPerYear: 5,
    isPaid: false,
    paidPercentage: 0,
    requiresCertificate: true,
    carryOverAllowed: false,
    isActive: true,
  },
  customLeaveTypes: [],
  holidayCarryOver: true,
  maxCarryOverDays: 6,
  // Matches the statutory duty, and matches what payroll already does when
  // nobody presses "Sync from Attendance": everyone is paid in full.
  attendanceMode: 'exceptions',
  // Mon–Fri: what Xefe did before the field existed. Deliberately not the
  // statutory six-day week — changing it is the owner's call, not a migration.
  workingDays: [1, 2, 3, 4, 5],
};

// Business sector presets for departments
export const SECTOR_DEPARTMENT_PRESETS: Record<BusinessSector, string[]> = {
  government: ['Administration', 'Finance', 'HR', 'IT', 'Legal', 'Public Relations'],
  ngo: ['Programs', 'Finance', 'HR', 'Operations', 'M&E', 'Communications'],
  trading: ['Sales', 'Purchasing', 'Warehouse', 'Finance', 'HR', 'Logistics'],
  hotel: ['Front Office', 'Housekeeping', 'F&B', 'Kitchen', 'Maintenance', 'HR', 'Finance', 'Security'],
  restaurant: ['Kitchen', 'Service', 'Bar', 'Management', 'Finance'],
  telecommunications: ['Network Operations', 'Customer Service', 'Sales', 'IT', 'Finance', 'HR'],
  manufacturing: ['Production', 'Quality', 'Warehouse', 'Maintenance', 'HR', 'Finance', 'Logistics'],
  security: ['Operations', 'Field Supervisors', 'Guards', 'HR', 'Finance', 'Training', 'Control Room'],
  construction: ['Site Operations', 'Engineering', 'Procurement', 'Safety', 'HR', 'Finance'],
  retail: ['Sales', 'Stock', 'Customer Service', 'Finance', 'HR'],
  healthcare: ['Medical', 'Nursing', 'Pharmacy', 'Lab', 'Admin', 'HR', 'Finance'],
  education: ['Academic', 'Administration', 'Student Services', 'Finance', 'HR', 'Facilities'],
  finance: ['Operations', 'Compliance', 'Risk', 'IT', 'HR', 'Customer Service'],
  technology: ['Engineering', 'Product', 'Design', 'QA', 'DevOps', 'HR', 'Finance'],
  agriculture: ['Farm Operations', 'Processing', 'Quality', 'Logistics', 'Finance', 'HR'],
  transport: ['Operations', 'Drivers', 'Maintenance', 'Dispatch', 'HR', 'Finance'],
  beauty_salon: ['Stylists', 'Reception', 'Management'],
  other: ['Management', 'Operations', 'HR', 'Finance'],
};
