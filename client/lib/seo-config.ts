// Pre-configured SEO metadata for public/common pages.
// Kept free of react/helmet imports so build scripts (scripts/generate-static-heads.ts)
// can import it under plain Node.
export const seoConfig = {
  // Landing & Auth
  landing: {
    title: 'HR, Payroll & Accounting for Timor-Leste',
    description: 'HR, payroll and accounting software built for Timor-Leste — WIT, INSS, subsídio anual, bank files and double-entry books. In Tetun, English and Portuguese.',
    keywords: 'HR software Timor-Leste, payroll software Timor-Leste, sistema folha de pagamento, INSS, WIT, subsidio anual, Lei Trabalho, accounting software Timor-Leste, Tetun payroll',
    url: '/',
    alternates: {
      tet: {
        title: 'RH, Folha Pagamentu no Kontabilidade ba Timor-Leste',
        description: 'Software RH, folha pagamentu no kontabilidade ba Timor-Leste — WIT, INSS, subsídiu anuál no ficheiru banku. Iha Tetun, Inglés no Portugés.',
      },
      pt: {
        title: 'RH, Folha de Pagamento e Contabilidade para Timor-Leste',
        description: 'Software de RH, folha de pagamento e contabilidade para Timor-Leste — WIT, INSS, subsídio anual e ficheiros bancários. Em tétum, inglês e português.',
      },
    },
  },
  howItWorks: {
    title: 'How Xefe Works for Businesses and Accountants',
    description: 'See how Xefe connects people, Timor-Leste payroll, bank files, WIT and INSS reporting, and balanced accounting — simple for everyday users and reviewable by accountants.',
    keywords: 'how Xefe works, Timor-Leste payroll workflow, payroll accounting Timor-Leste, INSS reporting, WIT reporting, accounting software for accountants',
    url: '/how-it-works',
    alternates: {
      tet: {
        title: 'Oinsá Xefe Funsiona ba Empreza no Kontabilista',
        description: "Haree oinsá Xefe liga ema, folha pagamentu Timor-Leste, ficheiru banku, relatóriu WIT no INSS, no kontabilidade balansadu — simples ba uza-na'in no bele revee husi kontabilista.",
      },
      pt: {
        title: 'Como o Xefe Funciona para Empresas e Contabilistas',
        description: 'Veja como o Xefe liga pessoas, folha de pagamento de Timor-Leste, ficheiros bancários, relatórios de WIT e INSS e contabilidade equilibrada — simples no dia a dia e revisível por contabilistas.',
      },
    },
  },
  pricing: {
    title: 'Pricing — One Flat Price Per Employee',
    description: 'Xefe pricing for Timor-Leste businesses: one flat price per employee per month with every feature included. Set up free — subscribe only when you finalize a real payroll run.',
    keywords: 'Xefe pricing, payroll software price Timor-Leste, HR software cost, per employee pricing, presu Xefe',
    url: '/pricing',
    alternates: {
      tet: {
        title: "Presu — Presu Ida De'it ba Trabalhador Ida-idak",
        description: "Presu Xefe ba empreza Timor-Leste: presu ida de'it ba trabalhador ida-idak kada fulan ho funsaun hotu inkluidu. Konfigura grátis — subskreve de'it bainhira finaliza folha pagamentu reál.",
      },
      pt: {
        title: 'Preços — Um Preço Único por Trabalhador',
        description: 'Preços do Xefe para empresas de Timor-Leste: um preço único por trabalhador por mês, com todas as funcionalidades incluídas. Configure grátis — subscreva só quando finalizar uma folha real.',
      },
    },
  },
  accountantPartners: {
    title: 'Accountant Partners for Timor-Leste Businesses',
    description: "Choose a Xefe accounting partner, request a consultation, and grant secure accountant access only when you are ready. Partner announcement coming soon.",
    keywords: "accountant Timor-Leste, accounting firm Dili, bookkeeping Timor-Leste, payroll accountant, Xefe accountant access",
    url: '/accountants',
    alternates: {
      tet: {
        title: 'Parseiru Kontabilista ba Empreza Timor-Leste',
        description: 'Hili parseiru kontabilidade Xefe nian, husu konsulta, no fó asesu kontabilista seguru bainhira Ita prontu de\'it.',
      },
      pt: {
        title: 'Parceiros Contabilistas para Empresas de Timor-Leste',
        description: 'Escolha um parceiro de contabilidade Xefe, peça uma consulta e conceda acesso seguro de contabilista apenas quando estiver pronto.',
      },
    },
  },
  security: {
    title: 'Security — How Xefe Protects Your Business',
    description: "Server-enforced tenant isolation, two-person payroll approval, tamper-protected billing, daily backups with point-in-time recovery, and a rules test suite that runs before every deploy.",
    keywords: 'Xefe security, payroll data security, Timor-Leste payroll privacy, data protection',
    url: '/security',
    alternates: {
      tet: {
        title: 'Seguransa — Oinsá Xefe Proteje Ita-nia Negósiu',
        description: "Izolamentu tenant iha servidor, aprovasaun folha ho ema rua, kobransa protejidu, backup loron-loron ho rekuperasaun point-in-time, no teste regra-seguransa molok kada deploy.",
      },
      pt: {
        title: 'Segurança — Como o Xefe Protege o Seu Negócio',
        description: "Isolamento por empresa imposto no servidor, aprovação de folha a duas pessoas, faturação protegida, backups diários com recuperação pontual e uma suite de regras testada antes de cada deploy.",
      },
    },
  },
  engine: {
    title: 'Verified Timor-Leste Payroll & Accounting Engine',
    description: "Inside Xefe's payroll and accounting engine: Timor-Leste labour, tax and INSS law implemented rule by rule, checked against real-world practice and official tax-authority assessments to the cent.",
    keywords: 'Timor-Leste payroll engine, WIT calculation, INSS calculation, payroll compliance Timor-Leste, double-entry payroll accounting, withholding tax Timor-Leste, Xefe engine',
    url: '/engine',
    alternates: {
      tet: {
        title: 'Motór Xefe — Folha Pagamentu no Kontabilidade Verifikadu',
        description: "Iha motór Xefe nia laran: lei laboral, impostu no INSS Timor-Leste nian implementadu regra ida-idak, verifikadu ho pratika reál no avaliasaun ofisiál autoridade tributária nian to'o sentavu.",
      },
      pt: {
        title: 'O Motor Xefe — Folha e Contabilidade Verificadas',
        description: 'Dentro do motor de folha e contabilidade do Xefe: a lei laboral, fiscal e de INSS de Timor-Leste implementada regra a regra, verificada contra a prática real e avaliações oficiais da autoridade tributária, ao cêntimo.',
      },
    },
  },
  docsIndex: {
    title: 'Xefe Documentation — How Timor-Leste Payroll Really Works',
    description: 'Plain-language documentation of Xefe: what happens to your payroll money, when statutory deadlines fall, and which guarantees the system itself enforces.',
    keywords: 'Timor-Leste payroll documentation, payroll process Timor-Leste, INSS deadlines, WIT deadlines, payroll approval workflow, Xefe docs',
    url: '/docs',
    alternates: {
      tet: {
        title: 'Dokumentasaun Xefe — Oinsá Folha Pagamentu Timor-Leste Serbisu',
        description: 'Dokumentasaun ho lian simples kona-ba Xefe: saida mak akontese ho ita-nia osan folha, bainhira prazu legál sira monu, no garantia sira-ne\'ebé sistema rasik impoin.',
      },
      pt: {
        title: 'Documentação Xefe — Como Funciona a Folha em Timor-Leste',
        description: 'Documentação em linguagem simples do Xefe: o que acontece ao dinheiro da folha, quando caem os prazos legais e que garantias o próprio sistema impõe.',
      },
    },
  },
  docsMoneyChain: {
    title: 'The Payroll Money Chain — Xefe Documentation',
    description: 'From a draft payroll run to closed books: approval steps, the three journals that move the money, every Timor-Leste statutory deadline, and seven system-enforced guarantees.',
    keywords: 'payroll journal Timor-Leste, payroll approval, INSS payment deadline, WIT payment deadline, payroll accounting Timor-Leste, salary settlement journal',
    url: '/docs/payroll-money-chain',
    alternates: {
      tet: {
        title: 'Kadeia Osan Folha Pagamentu nian — Dokumentasaun Xefe',
        description: 'Husi prosesamentu rascunho to\'o livru taka: pasu aprovasaun, lansamentu tolu ne\'ebé book osan, prazu legál Timor-Leste hotu, no garantia hitu ne\'ebé sistema impoin.',
      },
      pt: {
        title: 'A Cadeia do Dinheiro da Folha — Documentação Xefe',
        description: 'De um processamento em rascunho a livros fechados: passos de aprovação, os três lançamentos que movem o dinheiro, todos os prazos legais de Timor-Leste e sete garantias impostas pelo sistema.',
      },
    },
  },
  accountantPortfolio: {
    title: 'Accountant Client Review',
    description: 'Review Xefe client connection requests and open approved client workspaces.',
    url: '/accountant/clients',
    noIndex: true,
  },
  login: {
    title: 'Login',
    description: 'Sign in to your Xefe account to manage your workforce.',
    url: '/auth/login',
    noIndex: true,
  },
  signup: {
    title: 'Sign Up',
    description: 'Create your Xefe account and start managing your workforce today.',
    url: '/auth/signup',
  },
  unauthorized: {
    title: 'Access Denied',
    description: 'You do not have permission to access this page.',
    url: '/unauthorized',
    noIndex: true,
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your HR command center. View key metrics, pending tasks, and quick actions all in one place.',
    url: '/dashboard',
    noIndex: true,
  },

  // People Hub
  people: {
    title: 'People Dashboard',
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
    url: '/settings/departments',
  },
  orgChart: {
    title: 'Organization Chart',
    description: 'Visualize your company structure with an interactive organization chart.',
    keywords: 'org chart, organizational chart, company structure, hierarchy',
    url: '/settings/org-chart',
  },

  // Hiring
  jobs: {
    title: 'Jobs & Applicants',
    description: 'Post jobs, review applicants, and schedule interviews in one simple workspace.',
    keywords: 'job postings, applicants, interviews, recruitment, hiring',
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
    title: 'Onboarding Checklist',
    description: 'Prepare a new employee for their first day with one focused checklist.',
    keywords: 'onboarding, new hire, employee orientation, onboarding checklist',
    url: '/people/onboarding',
  },
  offboarding: {
    title: 'Offboarding',
    description: 'Manage employee departures with structured offboarding workflows.',
    keywords: 'offboarding, employee exit, termination, resignation',
    url: '/people/offboarding',
  },

  // Scheduling & Attendance
  schedulingDashboard: {
    title: 'Time & Leave Dashboard',
    description: 'Manage attendance, leave requests, and shift schedules in one calm workspace.',
    keywords: 'scheduling, attendance, leave management, shift scheduling',
    url: '/time-leave',
  },
  attendance: {
    title: 'Attendance',
    description: 'Monitor employee attendance patterns and manage absences.',
    keywords: 'attendance, absence management, employee attendance, attendance tracking',
    url: '/time-leave/attendance',
  },
  leave: {
    title: 'Leave Requests',
    description: 'Manage employee leave requests, approvals, and PTO balances.',
    keywords: 'leave management, PTO, vacation, sick leave, time off',
    url: '/time-leave/leave',
  },
  schedules: {
    title: 'Shift Scheduling',
    description: 'Create and manage employee work schedules and shifts.',
    keywords: 'shift scheduling, work schedules, roster, shift management',
    url: '/time-leave/shifts',
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
    url: '/payroll/payments',
    noIndex: true,
  },
  taxes: {
    title: 'Payroll Tax & INSS',
    description: 'Prepare payroll wage-tax and INSS filings.',
    keywords: 'payroll tax, WIT, INSS, wage tax filings',
    url: '/payroll/tax',
  },
  benefits: {
    title: 'Benefits Enrollment',
    description: 'Manage employee benefits enrollment and administration.',
    keywords: 'benefits, health insurance, INSS, WIT, employee benefits',
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
    url: '/accounting/chart',
  },
  journalEntries: {
    title: 'Journal Entries',
    description: 'Create and manage journal entries for financial transactions.',
    keywords: 'journal entries, accounting entries, bookkeeping',
    url: '/accounting/journal',
  },
  fixedAssets: {
    title: 'Fixed Assets',
    description: 'Fixed-asset register with straight-line depreciation schedules, monthly posting and disposals.',
    keywords: 'fixed assets, depreciation, asset register',
    url: '/accounting/fixed-assets',
  },
  generalLedger: {
    title: 'General Ledger',
    description: 'View your complete general ledger with all financial transactions.',
    keywords: 'general ledger, GL, financial records, accounting ledger',
    url: '/accounting/ledger',
  },
  trialBalance: {
    title: 'Trial Balance',
    description: 'Generate trial balance reports to verify account balances.',
    keywords: 'trial balance, accounting reports, financial statements',
    url: '/accounting/statements/trial-balance',
  },
  incomeStatement: {
    title: 'Income Statement',
    description: 'View profit and loss for any period with revenue and expense breakdown.',
    keywords: 'income statement, profit and loss, P&L, financial statements',
    url: '/accounting/statements/income-statement',
  },
  balanceSheet: {
    title: 'Balance Sheet',
    description: 'View assets, liabilities, and equity as of any date.',
    keywords: 'balance sheet, assets, liabilities, equity, financial statements',
    url: '/accounting/statements/balance-sheet',
  },

  // Reports
  reports: {
    title: 'Workforce Reports',
    description: 'Access payroll, people, attendance, NGO, and custom reports.',
    keywords: 'HR reports, payroll reports, workforce analytics, reporting',
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
    description: 'Configure your Xefe preferences and account settings.',
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
