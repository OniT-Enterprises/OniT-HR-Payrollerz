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
import type { ModulePermission, TenantRole } from "@/types/tenant";
import {
  Package,
  LayoutDashboard,
  // People
  Users,
  Briefcase,
  Target,
  Calendar,
  UserMinus,
  Award,
  GraduationCap,
  Shield,
  Megaphone,
  MessageSquare,
  // Time & Leave
  CalendarDays,
  CalendarCheck,
  // Payroll
  Play,
  Settings,
  History,
  Banknote,
  FileSpreadsheet,
  ClipboardCheck,
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

interface NavItem {
  id?: string;
  label: string;
  labelKey?: string;     // i18n key — sidebar uses t(labelKey) when available
  path: string;
  matchPaths?: string[];
  icon: ComponentType<{ className?: string }>;
  requiredModule?: ModulePermission;
  requiredAnyModules?: ModulePermission[];
  requiredAllModules?: ModulePermission[];
  manageOnly?: boolean;
  managerOnly?: boolean;
  peopleManagerOnly?: boolean;
  hrAdminOnly?: boolean;
  /** Hidden unless the user has accountant-grade tax controls (useAdvancedTax). */
  advancedTaxOnly?: boolean;
}

export interface ModuleSection {
  id: string;
  label: string;
  labelKey?: string;     // i18n key — sidebar uses t(labelKey) when available
  icon: ComponentType<{ className?: string }>;
  path: string;          // default page for this section
  matchPaths: string[];  // all URLs that belong to this section
  subPages: NavItem[];   // Level 2 sibling pages (empty = direct link, no expand)
  requiredModule?: ModulePermission;
  requiredAnyModules?: ModulePermission[];
  requiredAllModules?: ModulePermission[];
  manageOnly?: boolean;
  managerOnly?: boolean;
  peopleManagerOnly?: boolean;
  hrAdminOnly?: boolean;
  /** Hidden unless the user has accountant-grade tax controls (useAdvancedTax). */
  advancedTaxOnly?: boolean;
}

export interface ModuleNavConfig {
  moduleId: SectionId;
  overview?: NavItem;
  sections: ModuleSection[];
}

/* ─── People ───
 * Flat primary items: Employees, Jobs, Reviews
 * Secondary items grouped under "More": Announcements, Grievances, Training, etc.
 */

export const peopleNavConfig: ModuleNavConfig = {
  moduleId: "people",
  overview: {
    label: "Dashboard",
    path: "/people",
    icon: LayoutDashboard,
    requiredAnyModules: ["staff", "hiring", "performance"],
  },
  sections: [
    {
      id: "hiring",
      label: "Hiring",
      labelKey: "hiring",
      icon: Briefcase,
      path: "/people/jobs",
      matchPaths: ["/people/hiring", "/people/jobs", "/people/candidates", "/people/applications", "/people/interviews"],
      subPages: [],
      requiredModule: "hiring",
    },
    {
      id: "employees",
      label: "Employees",
      labelKey: "employees",
      icon: Users,
      path: "/people/employees",
      matchPaths: ["/people/employees", "/people/add", "/people/staff", "/people/onboarding", "/people/offboarding"],
      subPages: [
        { label: "Directory", path: "/people/employees", icon: Users },
        { label: "Offboarding", labelKey: "offboarding", path: "/people/offboarding", icon: UserMinus, manageOnly: true },
      ],
      requiredModule: "staff",
    },
    {
      id: "announcements",
      label: "Announcements",
      labelKey: "announcements",
      icon: Megaphone,
      path: "/people/announcements",
      matchPaths: ["/people/announcements"],
      subPages: [],
      requiredModule: "staff",
    },
    {
      id: "grievances",
      label: "Grievances",
      labelKey: "grievances",
      icon: MessageSquare,
      path: "/people/grievances",
      matchPaths: ["/people/grievances"],
      subPages: [],
      requiredModule: "staff",
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
      requiredModule: "performance",
    },
  ],
};

/* ─── Time & Leave ───
 * Three task-first destinations. Leave Settings is NOT in the module tree —
 * all configuration lives in the Settings area (/settings hub → module
 * settings pages), keeping module navs task-only.
 */

export const timeLeaveNavConfig: ModuleNavConfig = {
  moduleId: "scheduling",
  overview: {
    label: "Dashboard",
    path: "/time-leave",
    icon: LayoutDashboard,
  },
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
      id: "shifts",
      label: "Shifts",
      labelKey: "shifts",
      icon: Calendar,
      path: "/time-leave/shifts",
      matchPaths: ["/time-leave/shifts"],
      subPages: [],
      peopleManagerOnly: true,
    },
  ],
};

/* ─── Payroll ───
 * Flat: Run, History, Payments are primary actions; Benefits and
 * Deductions & Advances are per-employee registers (module pages).
 * Tenant configuration (rates/tax/overtime) is NOT in the module tree —
 * it lives in the Settings area (/settings hub → /payroll/settings).
 */

export const payrollNavConfig: ModuleNavConfig = {
  moduleId: "payroll",
  overview: {
    label: "Dashboard",
    path: "/payroll",
    icon: LayoutDashboard,
  },
  sections: [
    {
      id: "run",
      label: "Run Payroll",
      labelKey: "runPayroll",
      icon: Play,
      path: "/payroll/run",
      matchPaths: ["/payroll/run"],
      subPages: [],
      manageOnly: true,
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
    // Benefits and Deductions & Advances are per-employee payroll REGISTERS
    // (working data used while running payroll), not settings — they live in
    // the module nav, not the Settings area.
    {
      id: "benefits",
      label: "Benefits",
      labelKey: "benefits",
      icon: Heart,
      path: "/payroll/benefits",
      matchPaths: ["/payroll/benefits"],
      subPages: [],
      manageOnly: true,
    },
    {
      id: "deductions",
      label: "Deductions & Advances",
      labelKey: "deductions",
      icon: MinusCircle,
      path: "/payroll/deductions",
      matchPaths: ["/payroll/deductions"],
      subPages: [],
      manageOnly: true,
    },
    {
      id: "tax",
      label: "Tax & INSS",
      labelKey: "taxInss",
      icon: FileSpreadsheet,
      path: "/payroll/tax",
      matchPaths: ["/payroll/tax", "/payroll/tax/monthly-wit", "/payroll/tax/inss-monthly", "/payroll/tax/inss-annual", "/payroll/tax/clearance"],
      subPages: [
        { label: "Dashboard", labelKey: "taxInss", path: "/payroll/tax", icon: FileSpreadsheet },
        { label: "Monthly WIT", labelKey: "monthlyWit", path: "/payroll/tax/monthly-wit", icon: FileSpreadsheet, advancedTaxOnly: true },
        { label: "Monthly INSS", labelKey: "monthlyInss", path: "/payroll/tax/inss-monthly", icon: FileText },
        { label: "Annual INSS", labelKey: "annualInss", path: "/payroll/tax/inss-annual", icon: CalendarRange },
        { label: "Tax Clearance", labelKey: "taxClearance", path: "/payroll/tax/clearance", icon: ClipboardCheck, advancedTaxOnly: true },
      ],
      manageOnly: true,
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
  overview: {
    label: "Dashboard",
    path: "/money",
    icon: LayoutDashboard,
  },
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
      matchPaths: ["/money/expenses", "/money/cash-advances"],
      subPages: [
        { label: "Expenses", labelKey: "expenses", path: "/money/expenses", icon: ShoppingCart, managerOnly: true },
        { label: "Cash Advances", labelKey: "cashAdvances", path: "/money/cash-advances", icon: Banknote, manageOnly: true },
      ],
      managerOnly: true,
    },
    {
      id: "financial-reports",
      label: "Financial Reports",
      labelKey: "financialReports",
      icon: BarChart3,
      path: "/money/financials/ar-aging",
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
        { label: "Profit & Loss", labelKey: "profitLoss", path: "/money/financials/profit-loss", icon: TrendingUp, managerOnly: true },
        { label: "Balance Sheet", labelKey: "balanceSheet", path: "/money/financials/balance-sheet", icon: Scale, managerOnly: true },
        { label: "Cashflow", labelKey: "cashflow", path: "/money/financials/cashflow", icon: DollarSign, managerOnly: true },
        { label: "AR Aging", labelKey: "arAging", path: "/money/financials/ar-aging", icon: ClipboardList },
        { label: "AP Aging", labelKey: "apAging", path: "/money/financials/ap-aging", icon: ClipboardList },
        { label: "Reconciliation", labelKey: "reconciliation", path: "/money/financials/reconciliation", icon: CheckSquare, manageOnly: true },
        { label: "VAT Returns", labelKey: "vatReturns", path: "/money/financials/vat-returns", icon: FileSpreadsheet, manageOnly: true, advancedTaxOnly: true },
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
  overview: {
    label: "Dashboard",
    path: "/accounting",
    icon: LayoutDashboard,
  },
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
      id: "fixed-assets",
      label: "Fixed Assets",
      labelKey: "fixedAssets",
      icon: Package,
      path: "/accounting/fixed-assets",
      matchPaths: ["/accounting/fixed-assets"],
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
      manageOnly: true,
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
        { label: "Fiscal Periods", labelKey: "fiscalPeriods", path: "/accounting/statements/fiscal-periods", icon: CalendarRange, manageOnly: true },
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
  overview: {
    label: "Dashboard",
    path: "/reports",
    icon: LayoutDashboard,
  },
  sections: [
    {
      id: "payroll-reports",
      label: "Payroll",
      labelKey: "payrollReports",
      icon: DollarSign,
      path: "/reports/payroll",
      matchPaths: ["/reports/payroll"],
      subPages: [],
      requiredModule: "payroll",
    },
    {
      id: "employee-reports",
      label: "Employees",
      labelKey: "employeeReports",
      icon: Users,
      path: "/reports/employees",
      matchPaths: ["/reports/employees"],
      subPages: [],
      requiredModule: "staff",
    },
    {
      id: "attendance-reports",
      label: "Attendance",
      labelKey: "attendanceReports",
      icon: CalendarCheck,
      path: "/reports/attendance",
      matchPaths: ["/reports/attendance"],
      subPages: [],
      requiredModule: "timeleave",
    },
    {
      id: "department-reports",
      label: "Departments",
      labelKey: "departmentReports",
      icon: Building,
      path: "/reports/departments",
      matchPaths: ["/reports/departments"],
      subPages: [],
      requiredModule: "staff",
    },
    // Tax & Compliance moved to Payroll > Tax & INSS
    {
      id: "ngo",
      label: "NGO & Donor",
      labelKey: "ngoDonor",
      icon: Building,
      path: "/reports/payroll-allocation",
      matchPaths: ["/reports/payroll-allocation", "/reports/donor-export"],
      subPages: [
        {
          label: "Payroll Allocation",
          labelKey: "payrollAllocation",
          path: "/reports/payroll-allocation",
          icon: DollarSign,
          requiredAllModules: ["payroll", "staff"],
        },
        { label: "Donor Export", labelKey: "donorExport", path: "/reports/donor-export", icon: FileSpreadsheet },
      ],
      requiredAllModules: ["payroll", "staff"],
    },
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

function canViewNavEntry(
  entry: {
    requiredModule?: ModulePermission;
    requiredAnyModules?: ModulePermission[];
    requiredAllModules?: ModulePermission[];
    manageOnly?: boolean;
    managerOnly?: boolean;
    peopleManagerOnly?: boolean;
    hrAdminOnly?: boolean;
    advancedTaxOnly?: boolean;
  },
  hasModule: (module: ModulePermission) => boolean,
  canManageTenant: boolean,
  canManageTeam: boolean,
  showAdvancedTax: boolean,
  tenantRole?: TenantRole,
) {
  if (entry.advancedTaxOnly && !showAdvancedTax) {
    return false;
  }
  if (entry.manageOnly && !canManageTenant) {
    return false;
  }
  if (entry.managerOnly && !canManageTeam) {
    return false;
  }
  if (entry.peopleManagerOnly && !tenantRole) {
    return false;
  }
  if (entry.peopleManagerOnly && tenantRole && !["owner", "hr-admin", "manager"].includes(tenantRole)) {
    return false;
  }
  if (entry.hrAdminOnly && !tenantRole) {
    return false;
  }
  if (entry.hrAdminOnly && tenantRole && !["owner", "hr-admin"].includes(tenantRole)) {
    return false;
  }
  if (entry.requiredModule && !hasModule(entry.requiredModule)) {
    return false;
  }
  if (entry.requiredAllModules?.some((module) => !hasModule(module))) {
    return false;
  }

  if (entry.requiredAnyModules?.length) {
    return entry.requiredAnyModules.some((module) => hasModule(module));
  }

  return true;
}

export function filterModuleNavConfigByPermissions(
  config: ModuleNavConfig,
  hasModule: (module: ModulePermission) => boolean,
  canManageTenant: boolean = true,
  canManageTeam: boolean = canManageTenant,
  showAdvancedTax: boolean = false,
  tenantRole?: TenantRole,
): ModuleNavConfig {
  return {
    ...config,
    overview:
      config.overview && canViewNavEntry(config.overview, hasModule, canManageTenant, canManageTeam, showAdvancedTax, tenantRole)
        ? config.overview
        : undefined,
    sections: config.sections
      .filter((section) => canViewNavEntry(section, hasModule, canManageTenant, canManageTeam, showAdvancedTax, tenantRole))
      .map((section) => ({
        ...section,
        subPages: section.subPages.filter((page) =>
          canViewNavEntry(page, hasModule, canManageTenant, canManageTeam, showAdvancedTax, tenantRole)
        ),
      })),
  };
}
