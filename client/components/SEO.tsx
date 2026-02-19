import { Helmet } from 'react-helmet-async';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
}

const BASE_URL = 'https://onit-hr-payroll.web.app';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = 'Meza';

const DEFAULT_DESCRIPTION = 'Streamline your HR operations with Meza. Comprehensive HR management including hiring, employee management, time tracking, performance reviews, payroll processing, and reporting.';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Modern HR Management System`;
  const canonicalUrl = url ? `${BASE_URL}${url}` : BASE_URL;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

// Pre-configured SEO for common pages
// eslint-disable-next-line react-refresh/only-export-components
export const seoConfig = {
  // Landing & Auth
  landing: {
    title: 'Modern HR Management System',
    description: 'Transform your HR operations with Meza. All-in-one solution for hiring, employee management, time tracking, payroll, and more.',
    keywords: 'HR software, payroll system, human resources, employee management, HRIS, HR platform',
    url: '/',
  },
  login: {
    title: 'Login',
    description: 'Sign in to your Meza account to manage your workforce.',
    url: '/auth/login',
    noIndex: true,
  },
  signup: {
    title: 'Sign Up',
    description: 'Create your Meza account and start managing your workforce today.',
    url: '/auth/signup',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your HR command center. View key metrics, pending tasks, and quick actions all in one place.',
    url: '/dashboard',
    noIndex: true,
  },

  // People Hub
  people: {
    title: 'People Hub',
    description: 'Manage all aspects of your workforce from hiring to performance reviews.',
    keywords: 'employee management, HR hub, workforce management, people operations',
    url: '/people',
  },
  employees: {
    title: 'All Employees',
    description: 'View and manage your complete employee directory with detailed profiles and quick actions.',
    keywords: 'employee directory, staff list, workforce, employee database',
    url: '/people/employees',
  },
  addEmployee: {
    title: 'Add Employee',
    description: 'Add new employees to your organization with comprehensive profile setup.',
    url: '/people/add',
    noIndex: true,
  },
  departments: {
    title: 'Departments',
    description: 'Organize your workforce into departments and manage team structures.',
    keywords: 'departments, teams, organizational structure, team management',
    url: '/people/departments',
  },
  orgChart: {
    title: 'Organization Chart',
    description: 'Visualize your company structure with an interactive organization chart.',
    keywords: 'org chart, organizational chart, company structure, hierarchy',
    url: '/people/org-chart',
  },

  // Hiring
  jobs: {
    title: 'Job Postings',
    description: 'Create and manage job postings to attract top talent to your organization.',
    keywords: 'job postings, recruitment, hiring, job listings, careers',
    url: '/people/jobs',
  },
  candidates: {
    title: 'Candidates',
    description: 'Track and manage candidates through your hiring pipeline.',
    keywords: 'candidates, applicants, recruitment pipeline, hiring process',
    url: '/people/candidates',
  },
  interviews: {
    title: 'Interviews',
    description: 'Schedule and manage candidate interviews with your hiring team.',
    keywords: 'interviews, interview scheduling, hiring, recruitment',
    url: '/people/interviews',
  },
  onboarding: {
    title: 'Onboarding',
    description: 'Streamline new employee onboarding with checklists and task management.',
    keywords: 'onboarding, new hire, employee orientation, onboarding checklist',
    url: '/people/onboarding',
  },
  offboarding: {
    title: 'Offboarding',
    description: 'Manage employee departures with structured offboarding workflows.',
    keywords: 'offboarding, employee exit, termination, resignation',
    url: '/people/offboarding',
  },

  // Time & Leave
  timeTracking: {
    title: 'Time Tracking',
    description: 'Track employee work hours with clock in/out and timesheet management.',
    keywords: 'time tracking, timesheets, work hours, clock in, clock out',
    url: '/people/time-tracking',
  },
  attendance: {
    title: 'Attendance',
    description: 'Monitor employee attendance patterns and manage absences.',
    keywords: 'attendance, absence management, employee attendance, attendance tracking',
    url: '/people/attendance',
  },
  leave: {
    title: 'Leave Requests',
    description: 'Manage employee leave requests, approvals, and PTO balances.',
    keywords: 'leave management, PTO, vacation, sick leave, time off',
    url: '/people/leave',
  },
  schedules: {
    title: 'Shift Scheduling',
    description: 'Create and manage employee work schedules and shifts.',
    keywords: 'shift scheduling, work schedules, roster, shift management',
    url: '/people/schedules',
  },

  // Performance
  goals: {
    title: 'Goals & OKRs',
    description: 'Set and track employee goals and objectives to drive performance.',
    keywords: 'goals, OKRs, objectives, key results, performance goals',
    url: '/people/goals',
  },
  reviews: {
    title: 'Performance Reviews',
    description: 'Conduct comprehensive performance reviews and feedback sessions.',
    keywords: 'performance reviews, evaluations, feedback, appraisals',
    url: '/people/reviews',
  },
  training: {
    title: 'Training & Certifications',
    description: 'Track employee training programs and professional certifications.',
    keywords: 'training, certifications, learning, professional development',
    url: '/people/training',
  },
  disciplinary: {
    title: 'Disciplinary Actions',
    description: 'Document and manage employee disciplinary actions and warnings.',
    keywords: 'disciplinary, warnings, employee relations, HR compliance',
    url: '/people/disciplinary',
    noIndex: true,
  },

  // Payroll
  payroll: {
    title: 'Payroll Dashboard',
    description: 'Overview of your payroll operations, upcoming runs, and key metrics.',
    keywords: 'payroll, payroll dashboard, salary, compensation',
    url: '/payroll',
  },
  runPayroll: {
    title: 'Run Payroll',
    description: 'Process payroll for your employees with automated calculations.',
    keywords: 'run payroll, process payroll, salary processing, pay employees',
    url: '/payroll/run',
    noIndex: true,
  },
  payrollHistory: {
    title: 'Payroll History',
    description: 'View historical payroll runs and access past payslips.',
    keywords: 'payroll history, past payroll, payroll records',
    url: '/payroll/history',
  },
  bankTransfers: {
    title: 'Bank Transfers',
    description: 'Manage payroll bank transfers and direct deposits.',
    keywords: 'bank transfers, direct deposit, payroll payments',
    url: '/payroll/transfers',
    noIndex: true,
  },
  taxes: {
    title: 'Tax Reports',
    description: 'Generate tax reports and manage payroll tax compliance.',
    keywords: 'tax reports, payroll taxes, tax compliance, tax filings',
    url: '/payroll/taxes',
  },
  benefits: {
    title: 'Benefits Enrollment',
    description: 'Manage employee benefits enrollment and administration.',
    keywords: 'benefits, health insurance, 401k, employee benefits',
    url: '/payroll/benefits',
  },
  deductions: {
    title: 'Deductions & Advances',
    description: 'Configure payroll deductions and manage salary advances.',
    keywords: 'deductions, salary advances, payroll deductions',
    url: '/payroll/deductions',
    noIndex: true,
  },

  // Accounting
  accounting: {
    title: 'Accounting Dashboard',
    description: 'Financial overview and accounting operations for your organization.',
    keywords: 'accounting, finance, financial management, bookkeeping',
    url: '/accounting',
  },
  chartOfAccounts: {
    title: 'Chart of Accounts',
    description: 'Manage your chart of accounts and financial account structure.',
    keywords: 'chart of accounts, COA, general ledger accounts, accounting',
    url: '/accounting/chart-of-accounts',
  },
  journalEntries: {
    title: 'Journal Entries',
    description: 'Create and manage journal entries for financial transactions.',
    keywords: 'journal entries, accounting entries, bookkeeping',
    url: '/accounting/journal-entries',
  },
  generalLedger: {
    title: 'General Ledger',
    description: 'View your complete general ledger with all financial transactions.',
    keywords: 'general ledger, GL, financial records, accounting ledger',
    url: '/accounting/general-ledger',
  },
  trialBalance: {
    title: 'Trial Balance',
    description: 'Generate trial balance reports to verify account balances.',
    keywords: 'trial balance, accounting reports, financial statements',
    url: '/accounting/trial-balance',
  },

  // Reports
  reports: {
    title: 'Reports Hub',
    description: 'Access comprehensive HR, payroll, and analytics reports.',
    keywords: 'HR reports, analytics, workforce analytics, reporting',
    url: '/reports',
  },
  payrollReports: {
    title: 'Payroll Reports',
    description: 'Generate detailed payroll reports and analytics.',
    keywords: 'payroll reports, salary reports, compensation analytics',
    url: '/reports/payroll',
  },
  employeeReports: {
    title: 'Employee Reports',
    description: 'Analyze employee data with comprehensive workforce reports.',
    keywords: 'employee reports, workforce analytics, HR analytics',
    url: '/reports/employees',
  },
  attendanceReports: {
    title: 'Attendance Reports',
    description: 'Track attendance patterns with detailed attendance reports.',
    keywords: 'attendance reports, time tracking reports, absence reports',
    url: '/reports/attendance',
  },
  customReports: {
    title: 'Custom Reports',
    description: 'Build custom reports tailored to your specific needs.',
    keywords: 'custom reports, report builder, analytics',
    url: '/reports/custom',
  },
  departmentReports: {
    title: 'Department Reports',
    description: 'Analyze department performance and workforce distribution.',
    keywords: 'department reports, team analytics, organizational reports',
    url: '/reports/departments',
  },

  // Settings
  settings: {
    title: 'Settings',
    description: 'Configure your Meza preferences and account settings.',
    url: '/settings',
    noIndex: true,
  },

  // 404
  notFound: {
    title: 'Page Not Found',
    description: 'The page you are looking for could not be found.',
    noIndex: true,
  },
} as const;

export default SEO;
