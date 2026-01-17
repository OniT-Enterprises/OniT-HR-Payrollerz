// HR Chatbot Service - OpenAI-powered AI assistant for Timor-Leste HR/Payroll
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  TL_TAX_RULES,
  TL_LABOR_LAW,
  TL_PUBLIC_HOLIDAYS_2025,
  TL_REGULATORY_BODIES,
  HR_NAVIGATION_ROUTES,
} from '../lib/chatbot/tl-knowledge';

// Types for chatbot actions
export interface HRChatAction {
  type: 'calculation' | 'navigation' | 'query' | 'clarification' | 'employee' | 'payroll';
  action: 'calculate' | 'navigate' | 'explain' | 'create' | 'update' | 'list';
  data: Record<string, unknown>;
  missingFields?: string[];
  confirmationMessage?: string;
  navigateTo?: string;
}

export interface HRChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: HRChatAction;
  pendingAction?: HRChatAction;
}

export interface HRChatContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userEmail: string;
  userRole: string;
  currentPage: string;
}

// Extended context with live tenant data
export interface TenantData {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    position: string;
    department: string;
    status: string;
    salary: number;
    hireDate: string;
  }>;
  departments: Array<{
    id: string;
    name: string;
    managerId?: string;
    employeeCount: number;
  }>;
  pendingLeaveRequests: Array<{
    id: string;
    employeeName: string;
    type: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  recentPayruns: Array<{
    id: string;
    period: string;
    status: string;
    totalAmount: number;
    employeeCount: number;
  }>;
  openJobs: Array<{
    id: string;
    title: string;
    department: string;
    applicants: number;
  }>;
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    totalDepartments: number;
    pendingLeaveCount: number;
    onLeaveToday: number;
    monthlyPayroll: number;
  };
}

// Complete navigation routes for ALL pages
const ALL_NAVIGATION_ROUTES: Record<string, string> = {
  // Dashboard
  'dashboard': '/dashboard',
  'home': '/dashboard',
  'main': '/dashboard',

  // People Hub
  'people': '/people',
  'people hub': '/people',
  'hr': '/people',

  // Staff Management
  'add employee': '/people/add',
  'new employee': '/people/add',
  'hire employee': '/people/add',
  'create employee': '/people/add',
  'employee list': '/people/employees',
  'all employees': '/people/employees',
  'employees': '/people/employees',
  'staff list': '/people/employees',
  'staff': '/people/employees',
  'workforce': '/people/employees',
  'departments': '/people/departments',
  'department list': '/people/departments',
  'teams': '/people/departments',
  'org chart': '/people/org-chart',
  'organization chart': '/people/org-chart',
  'company structure': '/people/org-chart',
  'hierarchy': '/people/org-chart',

  // Hiring & Recruitment
  'job postings': '/people/jobs',
  'jobs': '/people/jobs',
  'open positions': '/people/jobs',
  'vacancies': '/people/jobs',
  'create job': '/people/jobs',
  'post job': '/people/jobs',
  'candidates': '/people/candidates',
  'applicants': '/people/candidates',
  'applications': '/people/candidates',
  'candidate list': '/people/candidates',
  'interviews': '/people/interviews',
  'interview schedule': '/people/interviews',
  'onboarding': '/people/onboarding',
  'new hire onboarding': '/people/onboarding',
  'offboarding': '/people/offboarding',
  'employee exit': '/people/offboarding',
  'termination': '/people/offboarding',

  // Time & Leave
  'time tracking': '/people/time-tracking',
  'clock in': '/people/time-tracking',
  'clock out': '/people/time-tracking',
  'timesheets': '/people/time-tracking',
  'attendance': '/people/attendance',
  'attendance records': '/people/attendance',
  'leave requests': '/people/leave',
  'leave': '/people/leave',
  'time off': '/people/leave',
  'pto': '/people/leave',
  'vacation': '/people/leave',
  'sick leave': '/people/leave',
  'approve leave': '/people/leave',
  'schedules': '/people/schedules',
  'shift scheduling': '/people/schedules',
  'work schedules': '/people/schedules',
  'roster': '/people/schedules',

  // Performance
  'goals': '/people/goals',
  'okrs': '/people/goals',
  'objectives': '/people/goals',
  'kpis': '/people/goals',
  'performance reviews': '/people/reviews',
  'reviews': '/people/reviews',
  'evaluations': '/people/reviews',
  'appraisals': '/people/reviews',
  'training': '/people/training',
  'certifications': '/people/training',
  'learning': '/people/training',
  'courses': '/people/training',
  'disciplinary': '/people/disciplinary',
  'warnings': '/people/disciplinary',
  'employee issues': '/people/disciplinary',

  // Payroll
  'payroll': '/payroll',
  'payroll dashboard': '/payroll',
  'run payroll': '/payroll/run',
  'process payroll': '/payroll/run',
  'pay employees': '/payroll/run',
  'calculate payroll': '/payroll/run',
  'payroll history': '/payroll/history',
  'pay history': '/payroll/history',
  'past payrolls': '/payroll/history',
  'payslips': '/payroll/history',
  'bank transfers': '/payroll/transfers',
  'payments': '/payroll/transfers',
  'direct deposit': '/payroll/transfers',
  'tax reports': '/payroll/taxes',
  'taxes': '/payroll/taxes',
  'wit reports': '/payroll/taxes',
  'inss reports': '/payroll/taxes',
  'benefits': '/payroll/benefits',
  'benefits enrollment': '/payroll/benefits',
  'health insurance': '/payroll/benefits',
  'deductions': '/payroll/deductions',
  'advances': '/payroll/deductions',
  'salary advances': '/payroll/deductions',
  'loans': '/payroll/deductions',

  // Accounting
  'accounting': '/accounting',
  'finance': '/accounting',
  'chart of accounts': '/accounting/chart-of-accounts',
  'coa': '/accounting/chart-of-accounts',
  'accounts': '/accounting/chart-of-accounts',
  'journal entries': '/accounting/journal-entries',
  'journals': '/accounting/journal-entries',
  'entries': '/accounting/journal-entries',
  'general ledger': '/accounting/general-ledger',
  'ledger': '/accounting/general-ledger',
  'gl': '/accounting/general-ledger',
  'trial balance': '/accounting/trial-balance',

  // Reports
  'reports': '/reports',
  'analytics': '/reports',
  'payroll reports': '/reports/payroll',
  'salary reports': '/reports/payroll',
  'employee reports': '/reports/employees',
  'headcount reports': '/reports/employees',
  'attendance reports': '/reports/attendance',
  'department reports': '/reports/departments',
  'team reports': '/reports/departments',
  'custom reports': '/reports/custom',

  // Settings & Admin
  'settings': '/settings',
  'preferences': '/settings',
  'company settings': '/settings',
  'admin': '/admin/tenants',
  'administration': '/admin/tenants',
  'tenants': '/admin/tenants',
  'companies': '/admin/tenants',
  'users': '/admin/users',
  'user management': '/admin/users',
  'audit log': '/admin/audit',
  'audit': '/admin/audit',
  'activity log': '/admin/audit',
};

// System prompt for the AI assistant
const getSystemPrompt = (context: HRChatContext, tenantData?: TenantData) => {
  const dataSection = tenantData ? `
=== LIVE COMPANY DATA ===
Company: ${context.tenantName}
Current User: ${context.userEmail} (Role: ${context.userRole})
Current Page: ${context.currentPage}

WORKFORCE SUMMARY:
- Total Employees: ${tenantData.stats.totalEmployees}
- Active Employees: ${tenantData.stats.activeEmployees}
- Departments: ${tenantData.stats.totalDepartments}
- Monthly Payroll: $${tenantData.stats.monthlyPayroll.toLocaleString()}
- Pending Leave Requests: ${tenantData.stats.pendingLeaveCount}
- On Leave Today: ${tenantData.stats.onLeaveToday}

EMPLOYEES (${tenantData.employees.length} total):
${tenantData.employees.slice(0, 50).map(e =>
  `- ${e.name} | ${e.position} | ${e.department} | $${e.salary}/mo | ${e.status}`
).join('\n')}
${tenantData.employees.length > 50 ? `... and ${tenantData.employees.length - 50} more` : ''}

DEPARTMENTS (${tenantData.departments.length} total):
${tenantData.departments.map(d =>
  `- ${d.name}: ${d.employeeCount} employees`
).join('\n')}

PENDING LEAVE REQUESTS:
${tenantData.pendingLeaveRequests.length > 0
  ? tenantData.pendingLeaveRequests.map(l =>
      `- ${l.employeeName}: ${l.type} (${l.startDate} to ${l.endDate})`
    ).join('\n')
  : 'No pending leave requests'}

RECENT PAYROLL RUNS:
${tenantData.recentPayruns.length > 0
  ? tenantData.recentPayruns.map(p =>
      `- ${p.period}: ${p.status} | $${p.totalAmount.toLocaleString()} | ${p.employeeCount} employees`
    ).join('\n')
  : 'No recent payroll runs'}

OPEN JOB POSITIONS:
${tenantData.openJobs.length > 0
  ? tenantData.openJobs.map(j =>
      `- ${j.title} (${j.department}): ${j.applicants} applicants`
    ).join('\n')
  : 'No open positions'}
` : '';

  return `You are an intelligent HR/Payroll assistant for ${context.tenantName} in Timor-Leste. You have FULL ACCESS to company data and can help with anything HR-related.

${dataSection}

=== TIMOR-LESTE TAX RULES (Law 8/2008) ===
WITHHOLDING INCOME TAX (WIT - Impostu Retidu):
- Residents: 10% on income EXCEEDING $${TL_TAX_RULES.wit.residentThreshold}/month
  Example: $1,200 salary → ($1,200 - $500) × 10% = $70 tax
- Non-residents: 10% on ALL income (no threshold)
- Tax-free: Per diem, travel allowances

SOCIAL SECURITY (INSS - Decree-Law 19/2016):
- Employee contribution: ${TL_TAX_RULES.inss.employeeRate * 100}% of gross
- Employer contribution: ${TL_TAX_RULES.inss.employerRate * 100}% of gross
- Minimum wage: $${TL_TAX_RULES.minimumWage}/month

=== LABOR LAW (Law 4/2012) ===
13TH MONTH (Subsídiu Anual - Article 40):
- One full month's salary by December 20th
- Pro-rata for <12 months: (months_worked / 12) × monthly_salary

OVERTIME RATES:
- Standard (>44 hrs/week): ${TL_LABOR_LAW.overtimeRates.standard * 100}%
- Night shift (10pm-6am): ${TL_LABOR_LAW.overtimeRates.nightShift * 100}%
- Public holiday: ${TL_LABOR_LAW.overtimeRates.holiday * 100}%
- Rest day/Sunday: ${TL_LABOR_LAW.overtimeRates.restDay * 100}%

ANNUAL LEAVE (Article 38):
- 0-3 years: ${TL_LABOR_LAW.annualLeave.base} days
- 3-6 years: ${TL_LABOR_LAW.annualLeave.after3Years} days
- 6-9 years: ${TL_LABOR_LAW.annualLeave.after6Years} days
- 9+ years: ${TL_LABOR_LAW.annualLeave.after9Years} days

SICK LEAVE (Article 42):
- Max ${TL_LABOR_LAW.sickLeave.maxDaysPerYear} days/year with medical certificate
- First ${TL_LABOR_LAW.sickLeave.fullPayDays} days: 100% pay
- Next ${TL_LABOR_LAW.sickLeave.halfPayDays} days: 50% pay

MATERNITY LEAVE (Article 44):
- ${TL_LABOR_LAW.maternityLeave.totalDays} days total (${TL_LABOR_LAW.maternityLeave.prenatalDays} pre + ${TL_LABOR_LAW.maternityLeave.postnatalDays} post)
- 100% paid

SEVERANCE (Article 51):
- ${TL_LABOR_LAW.severance.daysPerYear} days salary per year of service
- Minimum ${TL_LABOR_LAW.severance.minimumService} months to qualify

=== YOUR CAPABILITIES ===
1. ANSWER QUESTIONS about employees, departments, payroll, leave, and company data
2. CALCULATE TAX - WIT and INSS calculations
3. CALCULATE NET PAY - Full breakdown with deductions
4. CALCULATE OVERTIME - Apply correct rates
5. CALCULATE LEAVE - Based on years of service
6. CALCULATE 13TH MONTH - Pro-rata calculations
7. CALCULATE SEVERANCE - Based on tenure
8. EXPLAIN LAW - Cite relevant Timor-Leste laws
9. NAVIGATE - Direct users to any page in the system
10. PROVIDE INSIGHTS - Analyze workforce data

=== ALL NAVIGATION ROUTES ===
${Object.entries(ALL_NAVIGATION_ROUTES).slice(0, 50).map(([key, path]) => `- "${key}": ${path}`).join('\n')}

=== REGULATORY CONTACTS ===
${Object.values(TL_REGULATORY_BODIES).map(body => `- ${body.name}: ${body.role}`).join('\n')}

RESPONSE FORMAT:
Always respond with valid JSON:
{
  "message": "Your response with data, calculations, or answers. Use markdown for formatting.",
  "action": {
    "type": "calculation|navigation|query|clarification",
    "action": "calculate|navigate|explain|list",
    "data": { ...relevant data... },
    "navigateTo": "/path/to/page"
  }
}

IMPORTANT RULES:
1. You have FULL ACCESS to company data - use it to give specific, helpful answers
2. When asked about employees, departments, payroll, etc., reference the actual data above
3. ALWAYS cite relevant law when discussing regulations
4. Show step-by-step calculations with actual numbers
5. Use both English and Tetun terms where appropriate
6. Offer to navigate to relevant pages after answering
7. Format currency as USD with $ symbol
8. Be proactive - if you see issues (pending leave, upcoming payroll), mention them
9. Be concise but thorough`;
};

// Main chat function that calls the secure Cloud Function
export const sendHRChatMessage = async (
  message: string,
  context: HRChatContext,
  conversationHistory: HRChatMessage[],
  _apiKey?: string | null, // Deprecated - API key is now stored securely on server
  tenantData?: TenantData
): Promise<{ message: string; action?: HRChatAction }> => {
  try {
    // Build conversation history (last 10 messages for context)
    const history = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.role === 'assistant' && msg.action
        ? JSON.stringify({ message: msg.content, action: msg.action })
        : msg.content,
    }));

    const messages = [
      { role: "system" as const, content: getSystemPrompt(context, tenantData) },
      ...history,
      { role: "user" as const, content: message },
    ];

    // Call the secure Cloud Function instead of OpenAI directly
    // This keeps the API key on the server, never exposing it to the client
    const functions = getFunctions();
    const hrChatFunction = httpsCallable<
      { tenantId: string; messages: typeof messages },
      { success: boolean; message: string; action?: HRChatAction }
    >(functions, 'hrChat');

    const result = await hrChatFunction({
      tenantId: context.tenantId,
      messages,
    });

    if (!result.data.success) {
      throw new Error(result.data.message || 'Chat request failed');
    }

    return {
      message: result.data.message,
      action: result.data.action,
    };
  } catch (error: unknown) {
    console.error('HR Chat error:', error);

    // Handle Firebase function errors
    const errorCode = (error as { code?: string })?.code;
    const errorMessage = (error as { message?: string })?.message || 'Unknown error';

    if (errorCode === 'functions/failed-precondition') {
      return {
        message: "AI assistant is not configured. Please ask an administrator to configure the OpenAI API key in Settings.",
      };
    }

    if (errorCode === 'functions/resource-exhausted') {
      return {
        message: "Rate limit exceeded. Please try again in a moment.",
      };
    }

    return {
      message: `I'm having trouble connecting right now. ${errorMessage}`,
    };
  }
};

// Detect navigation intent from user message
export const detectNavigationIntent = (message: string): string | null => {
  const lowerMessage = message.toLowerCase().trim();

  // Check for navigation keywords
  const navKeywords = ['go to', 'take me to', 'open', 'show me', 'navigate to', 'where is', 'find', 'show'];
  const hasNavIntent = navKeywords.some(keyword => lowerMessage.includes(keyword));

  if (!hasNavIntent) return null;

  // Check against all known routes
  for (const [intent, route] of Object.entries(ALL_NAVIGATION_ROUTES)) {
    if (lowerMessage.includes(intent)) {
      return route;
    }
  }

  return null;
};

// Generate a unique message ID
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Quick calculation helpers for inline responses
export const quickCalculations = {
  wit: (salary: number, isResident = true): string => {
    if (isResident) {
      const taxable = Math.max(0, salary - 500);
      const tax = taxable * 0.10;
      return `WIT on $${salary}: ($${salary} - $500) × 10% = **$${tax.toFixed(2)}**`;
    }
    const tax = salary * 0.10;
    return `WIT on $${salary} (non-resident): $${salary} × 10% = **$${tax.toFixed(2)}**`;
  },

  inss: (salary: number): string => {
    const employee = salary * 0.04;
    const employer = salary * 0.06;
    return `INSS on $${salary}:\n- Employee (4%): **$${employee.toFixed(2)}**\n- Employer (6%): **$${employer.toFixed(2)}**`;
  },

  netPay: (salary: number, isResident = true): string => {
    const taxable = isResident ? Math.max(0, salary - 500) : salary;
    const wit = taxable * 0.10;
    const inss = salary * 0.04;
    const net = salary - wit - inss;
    return `Net pay for $${salary}:\n- Gross: $${salary}\n- WIT: -$${wit.toFixed(2)}\n- INSS: -$${inss.toFixed(2)}\n- **Net: $${net.toFixed(2)}**`;
  },
};

// Export for use in context
export { ALL_NAVIGATION_ROUTES };
