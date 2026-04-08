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
  ClipboardCheck,
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
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export interface ModuleSection {
  id: string;
  label: string;
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
      icon: Users,
      path: "/people/employees",
      matchPaths: ["/people/employees", "/people/add", "/people/staff"],
      subPages: [],
    },
    {
      id: "announcements",
      label: "Announcements",
      icon: Megaphone,
      path: "/people/announcements",
      matchPaths: ["/people/announcements"],
      subPages: [],
    },
    {
      id: "grievances",
      label: "Grievances",
      icon: MessageSquare,
      path: "/people/grievances",
      matchPaths: ["/people/grievances"],
      subPages: [],
    },
    {
      id: "hiring",
      label: "Hiring",
      icon: Briefcase,
      path: "/people/jobs",
      matchPaths: ["/people/hiring", "/people/jobs", "/people/candidates", "/people/interviews", "/people/onboarding", "/people/offboarding"],
      subPages: [
        { label: "Jobs", path: "/people/jobs", icon: Briefcase },
        { label: "Candidates", path: "/people/candidates", icon: UserCheck },
        { label: "Interviews", path: "/people/interviews", icon: Calendar },
        { label: "Onboarding", path: "/people/onboarding", icon: UserPlus },
        { label: "Offboarding", path: "/people/offboarding", icon: UserMinus },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      icon: Target,
      path: "/people/reviews",
      matchPaths: ["/people/performance", "/people/goals", "/people/reviews", "/people/training", "/people/disciplinary"],
      subPages: [
        { label: "Reviews", path: "/people/reviews", icon: Award },
        { label: "Goals", path: "/people/goals", icon: Target },
        { label: "Training", path: "/people/training", icon: GraduationCap },
        { label: "Disciplinary", path: "/people/disciplinary", icon: Shield },
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
      icon: CalendarCheck,
      path: "/time-leave/attendance",
      matchPaths: ["/time-leave/attendance"],
      subPages: [],
    },
    {
      id: "leave",
      label: "Leave",
      icon: CalendarDays,
      path: "/time-leave/leave",
      matchPaths: ["/time-leave/leave"],
      subPages: [],
    },
    {
      id: "time-tracking",
      label: "Time Tracking",
      icon: Clock,
      path: "/time-leave/time-tracking",
      matchPaths: ["/time-leave/time-tracking"],
      subPages: [],
    },
    {
      id: "shifts",
      label: "Shifts",
      icon: Calendar,
      path: "/time-leave/shifts",
      matchPaths: ["/time-leave/shifts"],
      subPages: [],
    },
    {
      id: "settings",
      label: "Leave Settings",
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
      icon: Play,
      path: "/payroll/run",
      matchPaths: ["/payroll/run"],
      subPages: [],
    },
    {
      id: "history",
      label: "History",
      icon: History,
      path: "/payroll/history",
      matchPaths: ["/payroll/history"],
      subPages: [],
    },
    {
      id: "payments",
      label: "Payments",
      icon: Banknote,
      path: "/payroll/payments",
      matchPaths: ["/payroll/payments"],
      subPages: [],
    },
    {
      id: "tax",
      label: "Tax & INSS",
      icon: FileSpreadsheet,
      path: "/payroll/reports",
      matchPaths: ["/payroll/reports"],
      subPages: [],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/payroll/settings",
      matchPaths: ["/payroll/settings", "/payroll/setup/benefits", "/payroll/setup/deductions"],
      subPages: [
        { label: "Tax & Rates", path: "/payroll/settings", icon: DollarSign },
        { label: "Benefits", path: "/payroll/setup/benefits", icon: Heart },
        { label: "Deductions", path: "/payroll/setup/deductions", icon: MinusCircle },
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
      icon: FileText,
      path: "/money/invoices",
      matchPaths: ["/money/invoices", "/money/customers", "/money/payments"],
      subPages: [
        { label: "Invoices", path: "/money/invoices", icon: FileText },
        { label: "Customers", path: "/money/customers", icon: Users },
        { label: "Payments", path: "/money/payments", icon: CreditCard },
      ],
    },
    {
      id: "bills",
      label: "Bills",
      icon: Receipt,
      path: "/money/bills",
      matchPaths: ["/money/bills", "/money/vendors"],
      subPages: [
        { label: "Bills", path: "/money/bills", icon: Receipt },
        { label: "Vendors", path: "/money/vendors", icon: Store },
      ],
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: ShoppingCart,
      path: "/money/expenses",
      matchPaths: ["/money/expenses"],
      subPages: [],
    },
    {
      id: "financial-reports",
      label: "Financial Reports",
      icon: BarChart3,
      path: "/money/reports/profit-loss",
      matchPaths: [
        "/money/reports/profit-loss",
        "/money/reports/balance-sheet",
        "/money/reports/cashflow",
        "/money/reports/ar-aging",
        "/money/reports/ap-aging",
        "/money/reports/reconciliation",
        "/money/reports/vat-returns",
      ],
      subPages: [
        { label: "Profit & Loss", path: "/money/reports/profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", path: "/money/reports/balance-sheet", icon: Scale },
        { label: "Cashflow", path: "/money/reports/cashflow", icon: DollarSign },
        { label: "AR Aging", path: "/money/reports/ar-aging", icon: ClipboardList },
        { label: "AP Aging", path: "/money/reports/ap-aging", icon: ClipboardList },
        { label: "Reconciliation", path: "/money/reports/reconciliation", icon: CheckSquare },
        { label: "VAT Returns", path: "/money/reports/vat-returns", icon: FileSpreadsheet },
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
      icon: Layers,
      path: "/accounting/core/chart",
      matchPaths: ["/accounting/core/chart"],
      subPages: [],
    },
    {
      id: "journal",
      label: "Journal Entries",
      icon: BookOpen,
      path: "/accounting/core/journal",
      matchPaths: ["/accounting/core/journal"],
      subPages: [],
    },
    {
      id: "ledger",
      label: "General Ledger",
      icon: Landmark,
      path: "/accounting/core/ledger",
      matchPaths: ["/accounting/core/ledger"],
      subPages: [],
    },
    {
      id: "reconciliation",
      label: "Reconciliation",
      icon: CheckSquare,
      path: "/accounting/core/reconciliation",
      matchPaths: ["/accounting/core/reconciliation"],
      subPages: [],
    },
    {
      id: "statements",
      label: "Statements",
      icon: BarChart3,
      path: "/accounting/reports/trial-balance",
      matchPaths: [
        "/accounting/reports/trial-balance",
        "/accounting/reports/income-statement",
        "/accounting/reports/balance-sheet",
        "/accounting/reports/fiscal-periods",
        "/accounting/reports/audit-trail",
      ],
      subPages: [
        { label: "Trial Balance", path: "/accounting/reports/trial-balance", icon: ClipboardList },
        { label: "Income Statement", path: "/accounting/reports/income-statement", icon: PieChart },
        { label: "Balance Sheet", path: "/accounting/reports/balance-sheet", icon: Scale },
        { label: "Fiscal Periods", path: "/accounting/reports/fiscal-periods", icon: CalendarRange },
        { label: "Audit Trail", path: "/accounting/reports/audit-trail", icon: ScrollText },
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
      icon: DollarSign,
      path: "/reports/payroll",
      matchPaths: ["/reports/payroll"],
      subPages: [],
    },
    {
      id: "employee-reports",
      label: "Employees",
      icon: Users,
      path: "/reports/employees",
      matchPaths: ["/reports/employees"],
      subPages: [],
    },
    {
      id: "attendance-reports",
      label: "Attendance",
      icon: CalendarCheck,
      path: "/reports/attendance",
      matchPaths: ["/reports/attendance"],
      subPages: [],
    },
    {
      id: "department-reports",
      label: "Departments",
      icon: Building,
      path: "/reports/departments",
      matchPaths: ["/reports/departments"],
      subPages: [],
    },
    {
      id: "compliance",
      label: "Tax & Compliance",
      icon: ClipboardCheck,
      path: "/reports/attl-monthly-wit",
      matchPaths: ["/reports/attl-monthly-wit", "/reports/inss-monthly", "/reports/inss-annual"],
      subPages: [
        { label: "Monthly WIT", path: "/reports/attl-monthly-wit", icon: FileSpreadsheet },
        { label: "Monthly INSS", path: "/reports/inss-monthly", icon: FileText },
        { label: "Annual INSS", path: "/reports/inss-annual", icon: CalendarRange },
      ],
    },
    {
      id: "custom",
      label: "Custom",
      icon: Wrench,
      path: "/reports/custom",
      matchPaths: ["/reports/custom", "/reports/setup"],
      subPages: [
        { label: "Custom Reports", path: "/reports/custom", icon: Wrench },
        { label: "Report Setup", path: "/reports/setup", icon: Settings },
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
