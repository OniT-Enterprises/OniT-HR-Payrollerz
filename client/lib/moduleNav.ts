/**
 * Module Navigation Configuration
 *
 * Central source of truth for all module section hierarchies.
 * Used by ModuleSectionNav to render consistent 2-level navigation.
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
  BarChart3,
  Store,
  CreditCard,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  Scale,
  // Accounting
  BookOpen,
  Landmark,
  Layers,
  CheckSquare,
  ClipboardList,
  PieChart,
  CalendarRange,
  ScrollText,
  // Reports
  BarChart,
  ClipboardCheck,
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
  path: string;          // overview/default page for this section
  matchPaths: string[];  // all URLs that belong to this section
  subPages: NavItem[];   // Level 2 sibling pages (empty = no Level 2)
}

export interface ModuleNavConfig {
  moduleId: SectionId;
  sections: ModuleSection[];
}

/* ─── People ─── */

export const peopleNavConfig: ModuleNavConfig = {
  moduleId: "people",
  sections: [
    {
      id: "staff",
      label: "Staff",
      icon: Users,
      path: "/people/staff",
      matchPaths: ["/people/staff", "/people/employees", "/people/add", "/people/announcements", "/people/grievances"],
      subPages: [
        { label: "Employees", path: "/people/employees", icon: Users },
        { label: "Announcements", path: "/people/announcements", icon: Megaphone },
        { label: "Grievances", path: "/people/grievances", icon: MessageSquare },
      ],
    },
    {
      id: "hiring",
      label: "Hiring",
      icon: Briefcase,
      path: "/people/hiring",
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
      path: "/people/performance",
      matchPaths: ["/people/performance", "/people/goals", "/people/reviews", "/people/training", "/people/disciplinary"],
      subPages: [
        { label: "Goals", path: "/people/goals", icon: Target },
        { label: "Reviews", path: "/people/reviews", icon: Award },
        { label: "Training", path: "/people/training", icon: GraduationCap },
        { label: "Disciplinary", path: "/people/disciplinary", icon: Shield },
      ],
    },
  ],
};

/* ─── Time & Leave ─── */

export const timeLeaveNavConfig: ModuleNavConfig = {
  moduleId: "scheduling",
  sections: [
    {
      id: "time-tracking",
      label: "Time Tracking",
      icon: Clock,
      path: "/time-leave/time-tracking",
      matchPaths: ["/time-leave/time-tracking"],
      subPages: [],
    },
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
      id: "shifts",
      label: "Shifts",
      icon: Calendar,
      path: "/time-leave/shifts",
      matchPaths: ["/time-leave/shifts"],
      subPages: [],
    },
  ],
};

/* ─── Payroll ─── */

export const payrollNavConfig: ModuleNavConfig = {
  moduleId: "payroll",
  sections: [
    {
      id: "run",
      label: "Run",
      icon: Play,
      path: "/payroll/run",
      matchPaths: ["/payroll/run"],
      subPages: [],
    },
    {
      id: "setup",
      label: "Setup",
      icon: Settings,
      path: "/payroll/setup/benefits",
      matchPaths: ["/payroll/setup/benefits", "/payroll/setup/deductions"],
      subPages: [
        { label: "Benefits", path: "/payroll/setup/benefits", icon: Heart },
        { label: "Deductions", path: "/payroll/setup/deductions", icon: MinusCircle },
      ],
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
      id: "reports",
      label: "Reports",
      icon: FileSpreadsheet,
      path: "/payroll/reports",
      matchPaths: ["/payroll/reports"],
      subPages: [],
    },
  ],
};

/* ─── Money ─── */

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
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      path: "/money/reports/profit-loss",
      matchPaths: [
        "/money/reports/profit-loss",
        "/money/reports/balance-sheet",
        "/money/reports/cashflow",
        "/money/reports/ar-aging",
        "/money/reports/ap-aging",
        "/money/reports/reconciliation",
        "/money/reports/vat-settings",
        "/money/reports/vat-returns",
      ],
      subPages: [
        { label: "Profit & Loss", path: "/money/reports/profit-loss", icon: TrendingUp },
        { label: "Balance Sheet", path: "/money/reports/balance-sheet", icon: Scale },
        { label: "Cashflow", path: "/money/reports/cashflow", icon: DollarSign },
        { label: "AR Aging", path: "/money/reports/ar-aging", icon: ArrowUpRight },
        { label: "AP Aging", path: "/money/reports/ap-aging", icon: ArrowDownRight },
        { label: "Reconciliation", path: "/money/reports/reconciliation", icon: CheckSquare },
        { label: "VAT Settings", path: "/money/reports/vat-settings", icon: Settings },
        { label: "VAT Returns", path: "/money/reports/vat-returns", icon: FileSpreadsheet },
      ],
    },
  ],
};

/* ─── Accounting ─── */

export const accountingNavConfig: ModuleNavConfig = {
  moduleId: "accounting",
  sections: [
    {
      id: "core",
      label: "Core",
      icon: BookOpen,
      path: "/accounting/core/chart",
      matchPaths: [
        "/accounting/core/chart",
        "/accounting/core/journal",
        "/accounting/core/ledger",
        "/accounting/core/reconciliation",
      ],
      subPages: [
        { label: "Chart of Accounts", path: "/accounting/core/chart", icon: Layers },
        { label: "Journal Entries", path: "/accounting/core/journal", icon: BookOpen },
        { label: "General Ledger", path: "/accounting/core/ledger", icon: Landmark },
        { label: "Reconciliation", path: "/accounting/core/reconciliation", icon: CheckSquare },
      ],
    },
    {
      id: "reports",
      label: "Reports",
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

/* ─── Reports ─── */

export const reportsNavConfig: ModuleNavConfig = {
  moduleId: "reports",
  sections: [
    {
      id: "standard",
      label: "Standard",
      icon: BarChart,
      path: "/reports/payroll",
      matchPaths: ["/reports/payroll", "/reports/employees", "/reports/attendance", "/reports/departments"],
      subPages: [
        { label: "Payroll", path: "/reports/payroll", icon: DollarSign },
        { label: "Employees", path: "/reports/employees", icon: Users },
        { label: "Attendance", path: "/reports/attendance", icon: CalendarCheck },
        { label: "Departments", path: "/reports/departments", icon: Building },
      ],
    },
    {
      id: "compliance",
      label: "Compliance",
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
