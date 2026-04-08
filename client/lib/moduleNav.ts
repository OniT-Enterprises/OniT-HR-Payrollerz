/**
 * Module Navigation Configuration
 *
 * Central source of truth for all module section hierarchies.
 * Used by AppSidebar and ModuleSectionNav to render navigation.
 *
 * Restructured for child-simple sidebar:
 *  - Flat where possible (no sub-sections for <4 items)
 *  - Rarely-used pages grouped under section headers
 *  - Reports unified into one module
 *  - Accounting merged into Money
 *  - Duplicate pages eliminated (Balance Sheet, Reconciliation)
 */

import type { ComponentType } from "react";
import type { SectionId } from "./sectionTheme";
import {
  // People
  Users,
  Briefcase,
  Target,
  UserCheck,
  Calendar,
  UserPlus,
  UserMinus,
  Award,
  GraduationCap,
  Shield,
  Megaphone,
  MessageSquare,
  // Time & Leave
  Clock,
  CalendarDays,
  CalendarCheck,
  // Payroll
  Play,
  Settings,
  History,
  Banknote,
  FileSpreadsheet,
  Heart,
  MinusCircle,
  // Money
  FileText,
  Receipt,
  ShoppingCart,
  Store,
  CreditCard,
  // Accounting (now under Money)
  BookOpen,
  Landmark,
  Layers,
  CheckSquare,
  // Reports
  BarChart3,
  ClipboardList,
  PieChart,
  CalendarRange,
  ScrollText,
  TrendingUp,
  Scale,
  DollarSign,
  Building,
  Wrench,
} from "lucide-react";

/* ─── Types ─── */

export interface NavItem {
  label: string;
  labelKey?: string;     // i18n key — sidebar uses t(labelKey) when available
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export interface ModuleSection {
  id: string;
  label: string;
  labelKey?: string;     // i18n key — sidebar uses t(labelKey) when available
  icon: ComponentType<{ className?: string }>;
  path: string;          // default page for this section
  matchPaths: string[];  // all URLs that belong to this section
  subPages: NavItem[];   // Level 2 sibling pages (empty = direct link, no expand)
}

export interface ModuleNavConfig {
  moduleId: SectionId;
  sections: ModuleSection[];
}

/* ─── People ───
 * Flat primary items: Employees, Jobs, Reviews
 * Secondary items grouped under "More": Announcements, Grievances, Training, etc.
 */

export const peopleNavConfig: ModuleNavConfig = {
  moduleId: "people",
  sections: [
    {
      id: "employees",
      label: "Employees",
      labelKey: "employees",
      icon: Users,
      path: "/people/employees",
      matchPaths: ["/people/employees", "/people/add", "/people/staff"],
      subPages: [],
    },
    {
      id: "announcements",
      label: "Announcements",
      labelKey: "announcements",
      icon: Megaphone,
      path: "/people/announcements",
      matchPaths: ["/people/announcements"],
      subPages: [],
    },
    {
      id: "grievances",
      label: "Grievances",
      labelKey: "grievances",
      icon: MessageSquare,
      path: "/people/grievances",
      matchPaths: ["/people/grievances"],
      subPages: [],
    },
    {
      id: "hiring",
      label: "Hiring",
      labelKey: "hiring",
      icon: Briefcase,
      path: "/people/jobs",
      matchPaths: ["/people/hiring", "/people/jobs", "/people/candidates", "/people/interviews", "/people/onboarding", "/people/offboarding"],
      subPages: [
        { label: "Jobs", labelKey: "jobs", path: "/people/jobs", icon: Briefcase },
        { label: "Candidates", labelKey: "candidates", path: "/people/candidates", icon: UserCheck },
        { label: "Interviews", labelKey: "interviews", path: "/people/interviews", icon: Calendar },
        { label: "Onboarding", labelKey: "onboarding", path: "/people/onboarding", icon: UserPlus },
        { label: "Offboarding", labelKey: "offboarding", path: "/people/offboarding", icon: UserMinus },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      labelKey: "performance",
      icon: Target,
      path: "/people/reviews",
      matchPaths: ["/people/performance", "/people/goals", "/people/reviews", "/people/training", "/people/disciplinary"],
      subPages: [
        { label: "Reviews", labelKey: "reviews", path: "/people/reviews", icon: Award },
        { label: "Goals", labelKey: "goals", path: "/people/goals", icon: Target },
        { label: "Training", labelKey: "training", path: "/people/training", icon: GraduationCap },
        { label: "Disciplinary", labelKey: "disciplinary", path: "/people/disciplinary", icon: Shield },
      ],
    },
  ],
};

/* ─── Time & Leave ───
 * Already flat — 4 direct links, no sub-sections needed
 */

export const timeLeaveNavConfig: ModuleNavConfig = {
  moduleId: "scheduling",
  sections: [
    {
      id: "attendance",
      label: "Attendance",
      labelKey: "attendance",
      icon: CalendarCheck,
      path: "/time-leave/attendance",
      matchPaths: ["/time-leave/attendance"],
      subPages: [],
    },
    {
      id: "leave",
      label: "Leave",
      labelKey: "leave",
      icon: CalendarDays,
      path: "/time-leave/leave",
      matchPaths: ["/time-leave/leave"],
      subPages: [],
    },
    {
      id: "time-tracking",
      label: "Time Tracking",
      labelKey: "timeTracking",
      icon: Clock,
      path: "/time-leave/time-tracking",
      matchPaths: ["/time-leave/time-tracking"],
      subPages: [],
    },
    {
      id: "shifts",
      label: "Shifts",
      labelKey: "shifts",
      icon: Calendar,
      path: "/time-leave/shifts",
      matchPaths: ["/time-leave/shifts"],
      subPages: [],
    },
    {
      id: "settings",
      label: "Leave Settings",
      labelKey: "leaveSettings",
      icon: Settings,
      path: "/time-leave/settings",
      matchPaths: ["/time-leave/settings"],
      subPages: [],
    },
  ],
};

/* ─── Payroll ───
 * Flat: Run, History, Payments are primary actions
 * Setup (Benefits/Deductions) and Reports are secondary
 */

export const payrollNavConfig: ModuleNavConfig = {
  moduleId: "payroll",
  sections: [
    {
      id: "run",
      label: "Run Payroll",
      labelKey: "runPayroll",
      icon: Play,
      path: "/payroll/run",
      matchPaths: ["/payroll/run"],
      subPages: [],
    },
    {
      id: "history",
      label: "History",
      labelKey: "history",
      icon: History,
      path: "/payroll/history",
      matchPaths: ["/payroll/history"],
      subPages: [],
    },
    {
      id: "payments",
      label: "Payments",
      labelKey: "payments",
      icon: Banknote,
      path: "/payroll/payments",
      matchPaths: ["/payroll/payments"],
      subPages: [],
    },
    {
      id: "tax",
      label: "Tax & INSS",
      labelKey: "taxInss",
      icon: FileSpreadsheet,
      path: "/payroll/tax",
      matchPaths: ["/payroll/tax", "/payroll/tax/monthly-wit", "/payroll/tax/inss-monthly", "/payroll/tax/inss-annual"],
      subPages: [
        { label: "Overview", labelKey: "taxInss", path: "/payroll/tax", icon: FileSpreadsheet },
        { label: "Monthly WIT", labelKey: "monthlyWit", path: "/payroll/tax/monthly-wit", icon: FileSpreadsheet },
        { label: "Monthly INSS", labelKey: "monthlyInss", path: "/payroll/tax/inss-monthly", icon: FileText },
        { label: "Annual INSS", labelKey: "annualInss", path: "/payroll/tax/inss-annual", icon: CalendarRange },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      labelKey: "payrollSettings",
      icon: Settings,
      path: "/payroll/settings",
      matchPaths: ["/payroll/settings", "/payroll/settings/benefits", "/payroll/settings/deductions"],
      subPages: [
        { label: "Tax & Rates", labelKey: "taxRates", path: "/payroll/settings", icon: DollarSign },
        { label: "Benefits", labelKey: "benefits", path: "/payroll/settings/benefits", icon: Heart },
        { label: "Deductions", labelKey: "deductions", path: "/payroll/settings/deductions", icon: MinusCircle },
      ],
    },
  ],
};

/* ─── Money & Accounting ───
 * Merged: Money handles day-to-day (invoices, bills, expenses)
 * Accounting section handles books (chart of accounts, journal, ledger)
 * Financial reports consolidated here (no duplicate in Reports module)
 */

export const moneyNavConfig: ModuleNavConfig = {
  moduleId: "money",
  sections: [
    {
      id: "invoices",
      label: "Invoices",
      labelKey: "invoices",
      icon: FileText,
      path: "/money/invoices",
      matchPaths: ["/money/invoices", "/money/customers", "/money/payments"],
      subPages: [
        { label: "Invoices", labelKey: "invoices", path: "/money/invoices", icon: FileText },
        { label: "Customers", labelKey: "customers", path: "/money/customers", icon: Users },
        { label: "Payments", labelKey: "payments", path: "/money/payments", icon: CreditCard },
      ],
    },
    {
      id: "bills",
      label: "Bills",
      labelKey: "bills",
      icon: Receipt,
      path: "/money/bills",
      matchPaths: ["/money/bills", "/money/vendors"],
      subPages: [
        { label: "Bills", labelKey: "bills", path: "/money/bills", icon: Receipt },
        { label: "Vendors", labelKey: "vendors", path: "/money/vendors", icon: Store },
      ],
    },
    {
      id: "expenses",
      label: "Expenses",
      labelKey: "expenses",
      icon: ShoppingCart,
      path: "/money/expenses",
      matchPaths: ["/money/expenses"],
      subPages: [],
    },
    {
      id: "financial-reports",
      label: "Financial Reports",
      labelKey: "financialReports",
      icon: BarChart3,
      path: "/money/financials/profit-loss",
      matchPaths: [
        "/money/financials/profit-loss",
        "/money/financials/balance-sheet",
        "/money/financials/cashflow",
        "/money/financials/ar-aging",
        "/money/financials/ap-aging",
        "/money/financials/reconciliation",
        "/money/financials/vat-returns",
      ],
      subPages: [
        { label: "Profit & Loss", labelKey: "profitLoss", path: "/money/financials/profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", labelKey: "balanceSheet", path: "/money/financials/balance-sheet", icon: Scale },
        { label: "Cashflow", labelKey: "cashflow", path: "/money/financials/cashflow", icon: DollarSign },
        { label: "AR Aging", labelKey: "arAging", path: "/money/financials/ar-aging", icon: ClipboardList },
        { label: "AP Aging", labelKey: "apAging", path: "/money/financials/ap-aging", icon: ClipboardList },
        { label: "Reconciliation", labelKey: "reconciliation", path: "/money/financials/reconciliation", icon: CheckSquare },
        { label: "VAT Returns", labelKey: "vatReturns", path: "/money/financials/vat-returns", icon: FileSpreadsheet },
      ],
    },
  ],
};

/* ─── Accounting ───
 * Books & ledger — separate module for accountants
 * Balance Sheet and Reconciliation only here (removed from Money reports)
 * VAT Settings moved to /settings
 */

export const accountingNavConfig: ModuleNavConfig = {
  moduleId: "accounting",
  sections: [
    {
      id: "chart",
      label: "Chart of Accounts",
      labelKey: "chartOfAccounts",
      icon: Layers,
      path: "/accounting/chart",
      matchPaths: ["/accounting/chart"],
      subPages: [],
    },
    {
      id: "journal",
      label: "Journal Entries",
      labelKey: "journalEntries",
      icon: BookOpen,
      path: "/accounting/journal",
      matchPaths: ["/accounting/journal"],
      subPages: [],
    },
    {
      id: "ledger",
      label: "General Ledger",
      labelKey: "generalLedger",
      icon: Landmark,
      path: "/accounting/ledger",
      matchPaths: ["/accounting/ledger"],
      subPages: [],
    },
    {
      id: "reconciliation",
      label: "Reconciliation",
      labelKey: "reconciliation",
      icon: CheckSquare,
      path: "/accounting/reconciliation",
      matchPaths: ["/accounting/reconciliation"],
      subPages: [],
    },
    {
      id: "statements",
      label: "Statements",
      labelKey: "statements",
      icon: BarChart3,
      path: "/accounting/statements/trial-balance",
      matchPaths: [
        "/accounting/statements/trial-balance",
        "/accounting/statements/income-statement",
        "/accounting/statements/balance-sheet",
        "/accounting/statements/fiscal-periods",
        "/accounting/statements/audit-trail",
      ],
      subPages: [
        { label: "Trial Balance", labelKey: "trialBalance", path: "/accounting/statements/trial-balance", icon: ClipboardList },
        { label: "Income Statement", labelKey: "incomeStatement", path: "/accounting/statements/income-statement", icon: PieChart },
        { label: "Balance Sheet", labelKey: "balanceSheet", path: "/accounting/statements/balance-sheet", icon: Scale },
        { label: "Fiscal Periods", labelKey: "fiscalPeriods", path: "/accounting/statements/fiscal-periods", icon: CalendarRange },
        { label: "Audit Trail", labelKey: "auditTrail", path: "/accounting/statements/audit-trail", icon: ScrollText },
      ],
    },
  ],
};

/* ─── Reports ───
 * Unified: all report types in one place
 * HR reports, compliance filings, custom reports
 * Financial reports live under Money (not duplicated here)
 */

export const reportsNavConfig: ModuleNavConfig = {
  moduleId: "reports",
  sections: [
    {
      id: "payroll-reports",
      label: "Payroll",
      labelKey: "payrollReports",
      icon: DollarSign,
      path: "/reports/payroll",
      matchPaths: ["/reports/payroll"],
      subPages: [],
    },
    {
      id: "employee-reports",
      label: "Employees",
      labelKey: "employeeReports",
      icon: Users,
      path: "/reports/employees",
      matchPaths: ["/reports/employees"],
      subPages: [],
    },
    {
      id: "attendance-reports",
      label: "Attendance",
      labelKey: "attendanceReports",
      icon: CalendarCheck,
      path: "/reports/attendance",
      matchPaths: ["/reports/attendance"],
      subPages: [],
    },
    {
      id: "department-reports",
      label: "Departments",
      labelKey: "departmentReports",
      icon: Building,
      path: "/reports/departments",
      matchPaths: ["/reports/departments"],
      subPages: [],
    },
    // Tax & Compliance moved to Payroll > Tax & INSS
    {
      id: "custom",
      label: "Custom",
      labelKey: "custom",
      icon: Wrench,
      path: "/reports/custom",
      matchPaths: ["/reports/custom", "/reports/setup"],
      subPages: [
        { label: "Custom Reports", labelKey: "customReports", path: "/reports/custom", icon: Wrench },
        { label: "Report Setup", labelKey: "reportSetup", path: "/reports/setup", icon: Settings },
      ],
    },
  ],
};

/* ─── Lookup helper ─── */

const allConfigs: Record<string, ModuleNavConfig> = {
  people: peopleNavConfig,
  scheduling: timeLeaveNavConfig,
  payroll: payrollNavConfig,
  money: moneyNavConfig,
  accounting: accountingNavConfig,
  reports: reportsNavConfig,
};

export function getModuleNavConfig(moduleId: SectionId): ModuleNavConfig | undefined {
  return allConfigs[moduleId];
}
