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
   * Pooled justified absence — Lei 4/2012 Art. 33(3): 3 paid days per calendar
   * year covering marriage, family death, and community/religious events.
   */
  specialLeave: LeaveTypeConfig;
  unpaidLeave: LeaveTypeConfig;
  customLeaveTypes: LeaveTypeConfig[];
  holidayCarryOver: boolean;
  maxCarryOverDays: number;
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
  maternityLeave: {
    id: 'maternity',
    name: 'Maternity Leave',
    code: 'ML',
    daysPerYear: 84, // 12 weeks
    isPaid: true,
    paidPercentage: 100,
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
    isPaid: true,
    paidPercentage: 100,
    requiresCertificate: true,
    certificateType: 'Birth Certificate',
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
  customLeaveTypes: [],
  holidayCarryOver: true,
  maxCarryOverDays: 6,
};

// Business sector presets for departments
export const SECTOR_DEPARTMENT_PRESETS: Record<BusinessSector, string[]> = {
  government: ['Administration', 'Finance', 'HR', 'IT', 'Legal', 'Public Relations'],
  ngo: ['Programs', 'Finance', 'HR', 'Operations', 'M&E', 'Communications'],
  trading: ['Sales', 'Purchasing', 'Warehouse', 'Finance', 'HR', 'Logistics'],
  hotel: ['Front Office', 'Housekeeping', 'F&B', 'Kitchen', 'Maintenance', 'HR', 'Finance', 'Security'],
  restaurant: ['Kitchen', 'Service', 'Bar', 'Management', 'Finance'],
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
