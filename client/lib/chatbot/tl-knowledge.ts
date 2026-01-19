// Timor-Leste HR/Payroll Knowledge Base
// All tax rates, labor laws, and regulations for the AI chatbot

import { getTLPublicHolidays } from "@/lib/payroll/tl-holidays";

export const TL_TAX_RULES = {
  wit: {
    name: 'Withholding Income Tax (Impostu Retidu)',
    legalBasis: 'Law 8/2008',
    residentThreshold: 500, // Monthly threshold in USD
    rate: 0.10, // 10%
    nonResidentThreshold: 0, // No threshold for non-residents
    taxFreeItems: [],
  },
  inss: {
    name: 'Social Security (Instituto Nacional de Segurança Social)',
    legalBasis: 'Decree-Law 19/2016',
    employeeRate: 0.04, // 4%
    employerRate: 0.06, // 6%
    totalRate: 0.10, // 10% combined
    excludedFromBase: [
      'overtime',
      'bonuses / gratuities / profit-sharing',
      'food subsidy',
      'subsistence subsidies (transport/board/lodging/travel)',
      'representation expenses',
      'other extraordinary allowances',
    ],
  },
  minimumWage: 115, // USD per month (2023)
  currency: 'USD',
};

export const TL_LABOR_LAW = {
  legalBasis: 'Law 4/2012 (Labor Code)',

  workingHours: {
    standardWeek: 44,
    standardDay: 8,
    maxOvertimePerDay: 4,
    maxOvertimePerWeek: 16,
  },

  overtimeRates: {
    standard: 1.5,      // 150% - over 44 hrs/week
    nightShift: 1.25,   // 125% - 10pm to 6am
    holiday: 2.0,       // 200% - public holidays
    restDay: 2.0,       // 200% - Sundays
    nightOvertime: 1.75, // 175% - night + overtime
  },

  annualLeave: {
    article: 'Article 38',
    base: 12,           // 0-3 years
    after3Years: 15,    // 3-6 years
    after6Years: 18,    // 6-9 years
    after9Years: 22,    // 9+ years
    probationRequired: 6, // months
  },

  sickLeave: {
    article: 'Article 42',
    maxDaysPerYear: 12,
    fullPayDays: 6,     // First 6 days at 100%
    halfPayDays: 6,     // Next 6 days at 50%
    requiresCertificate: true,
  },

  maternityLeave: {
    article: 'Article 44',
    totalDays: 90,
    prenatalDays: 30,
    postnatalDays: 60,
    payRate: 1.0,       // 100% paid
  },

  severance: {
    article: 'Article 51',
    daysPerYear: 30,    // 30 days salary per year
    minimumService: 3,  // months
    noticePeriod: 30,   // days
  },

  subsidioAnual: {
    name: '13th Month Salary (Subsídiu Anual)',
    article: 'Article 40',
    amount: 1,          // 1 full month salary
    dueDate: 'December 20',
    proRataForNewHires: true,
  },

  contractTypes: [
    { code: 'prazo_indeterminado', name: 'Open-ended (Prazo Indeterminado)', maxDuration: null },
    { code: 'prazo_certo', name: 'Fixed-term (Prazo Certo)', maxDuration: 24, maxRenewals: 2 },
    { code: 'agencia', name: 'Agency/Temporary (Agência)', maxDuration: null },
    { code: 'prestacao_servicos', name: 'Service Provider (Prestação de Serviços)', maxDuration: null },
  ],
};

export const TL_PUBLIC_HOLIDAYS_2025 = [
  // Note: Variable holidays (e.g., Eid) are not included here and should be handled via admin overrides.
  ...getTLPublicHolidays(2025).map(h => ({
    date: h.date,
    name: h.name,
    tetun: h.nameTetun ?? '',
  })),
];

export const TL_REGULATORY_BODIES = {
  dnre: {
    name: 'DNRE (Direcção Nacional de Receitas do Estado)',
    role: 'Tax Authority',
    handles: ['Income tax', 'WIT filings', 'Tax declarations'],
  },
  inss: {
    name: 'INSS (Instituto Nacional de Segurança Social)',
    role: 'Social Security',
    handles: ['Social security contributions', 'Benefits claims'],
  },
  sefope: {
    name: 'SEFOPE (Secretaria de Estado da Formação Profissional e Emprego)',
    role: 'Employment Authority',
    handles: ['Work registration', 'Work permits', 'Employment disputes'],
  },
};

export const HR_NAVIGATION_ROUTES = {
  // People/Staff
  'add employee': '/people/add',
  'new employee': '/people/add',
  'hire employee': '/people/add',
  'employee list': '/people/employees',
  'all employees': '/people/employees',
  'staff list': '/people/employees',
  'departments': '/people/departments',
  'org chart': '/people/org-chart',
  'organization chart': '/people/org-chart',

  // Hiring
  'job postings': '/people/jobs',
  'jobs': '/people/jobs',
  'candidates': '/people/candidates',
  'interviews': '/people/interviews',
  'onboarding': '/people/onboarding',
  'offboarding': '/people/offboarding',

  // Time & Leave
  'time tracking': '/people/time-tracking',
  'attendance': '/people/attendance',
  'leave requests': '/people/leave',
  'leave': '/people/leave',
  'schedules': '/people/schedules',
  'shift scheduling': '/people/schedules',

  // Performance
  'goals': '/people/goals',
  'performance reviews': '/people/reviews',
  'reviews': '/people/reviews',
  'training': '/people/training',
  'certifications': '/people/training',
  'disciplinary': '/people/disciplinary',

  // Payroll
  'run payroll': '/payroll/run',
  'payroll': '/payroll',
  'payroll history': '/payroll/history',
  'pay history': '/payroll/history',
  'bank transfers': '/payroll/transfers',
  'tax reports': '/payroll/taxes',
  'taxes': '/payroll/taxes',
  'benefits': '/payroll/benefits',
  'deductions': '/payroll/deductions',
  'advances': '/payroll/deductions',

  // Accounting
  'accounting': '/accounting',
  'chart of accounts': '/accounting/chart-of-accounts',
  'journal entries': '/accounting/journal-entries',
  'general ledger': '/accounting/general-ledger',
  'trial balance': '/accounting/trial-balance',

  // Reports
  'reports': '/reports',
  'payroll reports': '/reports/payroll',
  'employee reports': '/reports/employees',
  'attendance reports': '/reports/attendance',
  'department reports': '/reports/departments',

  // Admin
  'settings': '/settings',
  'admin': '/admin/setup',
  'tenants': '/admin/tenants',
  'users': '/admin/users',
  'audit log': '/admin/audit',
};

// Helper functions for calculations
export function calculateWIT(grossSalary: number, isResident: boolean): number {
  if (isResident) {
    const taxableAmount = Math.max(0, grossSalary - TL_TAX_RULES.wit.residentThreshold);
    return taxableAmount * TL_TAX_RULES.wit.rate;
  }
  return grossSalary * TL_TAX_RULES.wit.rate;
}

export function calculateINSS(grossSalary: number): { employee: number; employer: number; total: number } {
  const base = grossSalary; // Use contributable remuneration when available
  const employee = base * TL_TAX_RULES.inss.employeeRate;
  const employer = base * TL_TAX_RULES.inss.employerRate;
  return { employee, employer, total: employee + employer };
}

export function calculateNetPay(grossSalary: number, isResident: boolean): {
  gross: number;
  wit: number;
  inssEmployee: number;
  totalDeductions: number;
  net: number;
} {
  const wit = calculateWIT(grossSalary, isResident);
  const inss = calculateINSS(grossSalary);
  const totalDeductions = wit + inss.employee;
  return {
    gross: grossSalary,
    wit,
    inssEmployee: inss.employee,
    totalDeductions,
    net: grossSalary - totalDeductions,
  };
}

export function calculateOvertime(hourlyRate: number, hours: number, type: 'standard' | 'night' | 'holiday' | 'restDay'): number {
  const rate = TL_LABOR_LAW.overtimeRates[type] || TL_LABOR_LAW.overtimeRates.standard;
  return hourlyRate * hours * rate;
}

export function calculateAnnualLeave(yearsOfService: number): number {
  if (yearsOfService >= 9) return TL_LABOR_LAW.annualLeave.after9Years;
  if (yearsOfService >= 6) return TL_LABOR_LAW.annualLeave.after6Years;
  if (yearsOfService >= 3) return TL_LABOR_LAW.annualLeave.after3Years;
  return TL_LABOR_LAW.annualLeave.base;
}

export function calculate13thMonth(monthlySalary: number, monthsWorked: number): number {
  const proRata = Math.min(monthsWorked, 12) / 12;
  return monthlySalary * proRata;
}

export function calculateSeverance(monthlySalary: number, yearsOfService: number): number {
  const daysPerYear = TL_LABOR_LAW.severance.daysPerYear;
  const dailyRate = monthlySalary / 30;
  return dailyRate * daysPerYear * yearsOfService;
}
