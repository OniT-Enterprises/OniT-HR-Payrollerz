/**
 * Sitemap Page
 * A comprehensive overview of all pages in the Meza system
 * with descriptions and easy navigation
 */

import { Link } from 'react-router-dom';
import MainNavigation from '@/components/layout/MainNavigation';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { canUseDonorExport, canUseNgoReporting } from '@/lib/ngo/access';
import {
  Users,
  DollarSign,
  Calculator,
  BarChart3,
  Briefcase,
  Clock,
  Target,
  BookOpen,
  Shield,
  Home,
  Map,
  ChevronRight,
} from 'lucide-react';

interface SitemapSection {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  pages: {
    name: string;
    path: string;
    description: string;
    badge?: string;
  }[];
}

const sitemapData: SitemapSection[] = [
  {
    title: 'Dashboard',
    description: 'Your central command center for Meza',
    icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    pages: [
      {
        name: 'Main Dashboard',
        path: '/dashboard',
        description: 'Overview of your organization with key metrics, recent activity, and quick actions',
      },
      {
        name: 'Settings',
        path: '/settings',
        description: 'Configure your account preferences, notifications, and system settings',
      },
    ],
  },
  {
    title: 'People',
    description: 'Manage your workforce from hiring to retirement',
    icon: Users,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    pages: [
      {
        name: 'People Hub',
        path: '/people',
        description: 'Central dashboard for all people management activities',
      },
      {
        name: 'All Employees',
        path: '/people/employees',
        description: 'Complete employee directory with search, filters, and detailed profiles',
      },
      {
        name: 'Add Employee',
        path: '/people/add',
        description: 'Register new employees with personal details, employment info, and documents',
      },
      {
        name: 'Departments',
        path: '/people/departments',
        description: 'Manage organizational departments, teams, and reporting structures',
      },
      {
        name: 'Organization Chart',
        path: '/people/org-chart',
        description: 'Visual hierarchy showing reporting relationships across your organization',
      },
      {
        name: 'Document Alerts',
        path: '/admin/document-alerts',
        description: 'Track expiring documents (passports, work permits, licenses)',
        badge: 'Compliance',
      },
      {
        name: 'Foreign Workers',
        path: '/admin/foreign-workers',
        description: 'Manage work permits and visa compliance for foreign employees',
        badge: 'TL Compliance',
      },
      {
        name: 'Announcements',
        path: '/people/announcements',
        description: 'Broadcast company news, policy updates, and notices to all employees via Ekipa',
        badge: 'Ekipa',
      },
      {
        name: 'Grievance Inbox',
        path: '/people/grievances',
        description: 'Review anonymous employee concerns and complaints submitted via Ekipa',
        badge: 'Ekipa',
      },
    ],
  },
  {
    title: 'Hiring & Recruitment',
    description: 'Streamline your recruitment process from job posting to onboarding',
    icon: Briefcase,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100 dark:bg-violet-900',
    pages: [
      {
        name: 'Job Postings',
        path: '/people/jobs',
        description: 'Create and manage job openings, requirements, and posting status',
      },
      {
        name: 'Candidates',
        path: '/people/candidates',
        description: 'Track applicants through your hiring pipeline with status updates',
      },
      {
        name: 'Interviews',
        path: '/people/interviews',
        description: 'Schedule and manage interview rounds with feedback tracking',
      },
      {
        name: 'Onboarding',
        path: '/people/onboarding',
        description: 'Guide new hires through orientation with checklists and tasks',
      },
      {
        name: 'Offboarding',
        path: '/people/offboarding',
        description: 'Manage employee departures with exit checklists and knowledge transfer',
      },
    ],
  },
  {
    title: 'Time & Attendance',
    description: 'Track working hours, attendance, and leave requests',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    pages: [
      {
        name: 'Time Tracking',
        path: '/people/time-tracking',
        description: 'Clock in/out, track hours worked, and manage timesheets',
      },
      {
        name: 'Attendance',
        path: '/people/attendance',
        description: 'Daily attendance records with late arrivals and early departures',
      },
      {
        name: 'Leave Requests',
        path: '/people/leave',
        description: 'Submit, approve, and track vacation, sick leave, and other absences',
      },
      {
        name: 'Shift Scheduling',
        path: '/people/schedules',
        description: 'Create and manage work schedules, shifts, and rotations',
      },
    ],
  },
  {
    title: 'Performance',
    description: 'Develop your team with goals, reviews, and training',
    icon: Target,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100 dark:bg-pink-900',
    pages: [
      {
        name: 'Goals',
        path: '/people/goals',
        description: 'Set and track individual and team objectives with progress monitoring',
      },
      {
        name: 'Reviews',
        path: '/people/reviews',
        description: 'Conduct performance evaluations with customizable review cycles',
      },
      {
        name: 'Training & Certifications',
        path: '/people/training',
        description: 'Track employee skills, training programs, and certification renewals',
      },
      {
        name: 'Disciplinary',
        path: '/people/disciplinary',
        description: 'Document warnings, incidents, and corrective actions',
      },
    ],
  },
  {
    title: 'Payroll',
    description: 'Process payroll with Timor-Leste tax compliance (WIT, INSS)',
    icon: Calculator,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900',
    pages: [
      {
        name: 'Payroll Dashboard',
        path: '/payroll',
        description: 'Overview of payroll status, upcoming runs, and key metrics',
      },
      {
        name: 'Run Payroll',
        path: '/payroll/run',
        description: 'Process payroll with automatic WIT and INSS calculations for TL compliance',
        badge: 'TL Compliant',
      },
      {
        name: 'Payroll History',
        path: '/payroll/history',
        description: 'View past payroll runs with detailed breakdowns and pay slips',
      },
      {
        name: 'Bank Transfers',
        path: '/payroll/transfers',
        description: 'Generate bank transfer files for BNU, BNCTL, and other TL banks',
        badge: 'TL Banks',
      },
      {
        name: 'Tax Reports',
        path: '/payroll/taxes',
        description: 'Generate WIT and INSS reports for ATTL and government filings',
      },
      {
        name: 'Benefits',
        path: '/payroll/benefits',
        description: 'Manage employee benefits enrollment and deductions',
      },
      {
        name: 'Deductions & Advances',
        path: '/payroll/deductions',
        description: 'Configure loan repayments, salary advances, and custom deductions',
      },
    ],
  },
  {
    title: 'Money',
    description: 'Invoicing, expenses, and financial operations',
    icon: DollarSign,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900',
    pages: [
      {
        name: 'Money Dashboard',
        path: '/money',
        description: 'Financial overview with receivables, payables, and cash flow',
      },
      {
        name: 'Customers',
        path: '/money/customers',
        description: 'Manage customer contacts, billing info, and payment history',
      },
      {
        name: 'Invoices',
        path: '/money/invoices',
        description: 'Create, send, and track customer invoices with payment status',
      },
      {
        name: 'Recurring Invoices',
        path: '/money/invoices/recurring',
        description: 'Set up automatic recurring invoices for regular customers',
      },
      {
        name: 'Invoice Settings',
        path: '/money/invoices/settings',
        description: 'Configure company info, bank details, and invoice defaults',
      },
      {
        name: 'Payments Received',
        path: '/money/payments',
        description: 'Record and track customer payments against invoices',
      },
      {
        name: 'Vendors',
        path: '/money/vendors',
        description: 'Manage supplier contacts and payment terms',
      },
      {
        name: 'Bills',
        path: '/money/bills',
        description: 'Track vendor bills and accounts payable',
      },
      {
        name: 'Expenses',
        path: '/money/expenses',
        description: 'Record and categorize business expenses with receipts',
      },
      {
        name: 'Profit & Loss',
        path: '/money/profit-loss',
        description: 'Income statement showing revenue minus expenses',
      },
      {
        name: 'Balance Sheet',
        path: '/money/balance-sheet',
        description: 'Assets, liabilities, and equity snapshot',
      },
      {
        name: 'Cash Flow',
        path: '/money/cashflow',
        description: 'Track money coming in and going out over time',
      },
      {
        name: 'AR Aging Report',
        path: '/money/ar-aging',
        description: 'Accounts receivable by age (Current, 30, 60, 90+ days)',
      },
      {
        name: 'AP Aging Report',
        path: '/money/ap-aging',
        description: 'Accounts payable by age to manage vendor payments',
      },
      {
        name: 'Bank Reconciliation',
        path: '/money/bank-reconciliation',
        description: 'Match bank statements with recorded transactions',
      },
    ],
  },
  {
    title: 'Accounting',
    description: 'Double-entry bookkeeping and financial statements',
    icon: BookOpen,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900',
    pages: [
      {
        name: 'Accounting Dashboard',
        path: '/accounting',
        description: 'Overview of accounting status and quick access to key functions',
      },
      {
        name: 'Chart of Accounts',
        path: '/accounting/chart-of-accounts',
        description: 'Standard TL chart of accounts (Assets, Liabilities, Equity, Revenue, Expenses)',
        badge: 'TL Standard',
      },
      {
        name: 'Journal Entries',
        path: '/accounting/journal-entries',
        description: 'View and create double-entry journal entries with auto-posting',
      },
      {
        name: 'General Ledger',
        path: '/accounting/general-ledger',
        description: 'Complete transaction history by account with running balances',
      },
      {
        name: 'Trial Balance',
        path: '/accounting/trial-balance',
        description: 'Verify debits equal credits across all accounts',
      },
    ],
  },
  {
    title: 'Reports',
    description: 'Analytics, compliance reports, and data exports',
    icon: BarChart3,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100 dark:bg-rose-900',
    pages: [
      {
        name: 'Reports Dashboard',
        path: '/reports',
        description: 'Central hub for all reports with quick generation',
      },
      {
        name: 'Payroll Reports',
        path: '/reports/payroll',
        description: 'Payroll summaries, cost analysis, and tax breakdowns',
      },
      {
        name: 'Payroll Allocation Report',
        path: '/reports/payroll-allocation',
        description: 'NGO project/funding payroll allocation summary for donor reporting',
        badge: 'NGO',
      },
      {
        name: 'Donor Export Pack',
        path: '/reports/donor-export',
        description: 'Exports donor-ready payroll summary and journal lines (CSV)',
        badge: 'NGO',
      },
      {
        name: 'Employee Reports',
        path: '/reports/employees',
        description: 'Headcount, demographics, turnover, and roster exports',
      },
      {
        name: 'Attendance Reports',
        path: '/reports/attendance',
        description: 'Attendance patterns, overtime analysis, and leave usage',
      },
      {
        name: 'Department Reports',
        path: '/reports/departments',
        description: 'Department-level metrics and cost center analysis',
      },
      {
        name: 'ATTL Monthly WIT',
        path: '/reports/attl-monthly-wit',
        description: 'Monthly Withholding Income Tax report for ATTL filing',
        badge: 'Tax Filing',
      },
      {
        name: 'INSS Monthly',
        path: '/reports/inss-monthly',
        description: 'Monthly INSS contribution report for social security',
        badge: 'Tax Filing',
      },
      {
        name: 'Setup Reports',
        path: '/reports/setup',
        description: 'Configure report templates and scheduling',
      },
      {
        name: 'Custom Reports',
        path: '/reports/custom',
        description: 'Build custom reports with flexible filters and fields',
      },
    ],
  },
  {
    title: 'Administration',
    description: 'System configuration and superadmin tools',
    icon: Shield,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-900',
    pages: [
      {
        name: 'Initial Setup',
        path: '/admin/setup',
        description: 'First-time setup wizard for new organizations',
      },
      {
        name: 'Tenants',
        path: '/admin/tenants',
        description: 'Manage organizations in the system (Superadmin only)',
        badge: 'Superadmin',
      },
      {
        name: 'Users',
        path: '/admin/users',
        description: 'Manage user accounts and permissions (Superadmin only)',
        badge: 'Superadmin',
      },
      {
        name: 'Audit Log',
        path: '/admin/audit',
        description: 'Complete audit trail of system actions (Superadmin only)',
        badge: 'Superadmin',
      },
      {
        name: 'Seed Database',
        path: '/admin/seed',
        description: 'Generate test data for development (Superadmin only)',
        badge: 'Superadmin',
      },
    ],
  },
];

export default function Sitemap() {
  const { session, hasModule, canManage } = useTenant();
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule('reports'));
  const donorExportEnabled = canUseDonorExport(
    session,
    hasModule('reports'),
    canManage()
  );

  const visibleSitemapData = sitemapData
    .map((section) => {
      if (section.title !== 'Reports') return section;
      return {
        ...section,
        pages: section.pages.filter((page) => {
          if (page.path === '/reports/payroll-allocation') return ngoReportingEnabled;
          if (page.path === '/reports/donor-export') return donorExportEnabled;
          return true;
        }),
      };
    })
    .filter((section) => section.pages.length > 0);
  const visiblePageCount = visibleSitemapData.reduce(
    (acc, section) => acc + section.pages.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Sitemap - Meza" description="Complete navigation guide for Meza system" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Map className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Sitemap</h1>
              <p className="text-muted-foreground">
                Complete navigation guide for Meza
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-muted/50 rounded-lg px-4 py-2">
              <span className="text-2xl font-bold text-primary">{visibleSitemapData.length}</span>
              <span className="text-sm text-muted-foreground ml-2">Modules</span>
            </div>
            <div className="bg-muted/50 rounded-lg px-4 py-2">
              <span className="text-2xl font-bold text-primary">{visiblePageCount}</span>
              <span className="text-sm text-muted-foreground ml-2">Pages</span>
            </div>
            <div className="bg-muted/50 rounded-lg px-4 py-2">
              <span className="text-2xl font-bold text-emerald-600">TL</span>
              <span className="text-sm text-muted-foreground ml-2">Timor-Leste Compliant</span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {visibleSitemapData.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {section.pages.map((page) => (
                      <Link
                        key={page.path}
                        to={page.path}
                        className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all"
                      >
                        <ChevronRight className={`h-4 w-4 mt-0.5 ${section.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium group-hover:text-primary transition-colors">
                              {page.name}
                            </span>
                            {page.badge && (
                              <Badge variant="secondary" className="text-xs">
                                {page.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {page.description}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                            {page.path}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Meza System - Built for Timor-Leste businesses
          </p>
          <p className="mt-1">
            Compliant with ATTL tax regulations, INSS social security, and TL labor law
          </p>
        </div>
      </div>
    </div>
  );
}
