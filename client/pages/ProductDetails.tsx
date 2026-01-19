/**
 * ProductDetails - Comprehensive product information page
 * Full details on all features, modules, TL-specific capabilities
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import {
  Users,
  Calculator,
  Clock,
  BarChart3,
  Shield,
  CheckCircle2,
  ArrowRight,
  Building2,
  Globe,
  ChevronRight,
  FileText,
  Calendar,
  Scale,
  Landmark,
  Banknote,
  Languages,
  MapPin,
  GraduationCap,
  Briefcase,
  Target,
  UserPlus,
  ClipboardList,
  CreditCard,
  Receipt,
  TrendingUp,
  BookOpen,
  Home,
  Wallet,
  PiggyBank,
  AlertCircle,
  Phone,
  Mail,
  MessageCircle,
  Wifi,
  WifiOff,
  Lock,
  Database,
  Cloud,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
  Settings,
  Bell,
  Search,
  Filter,
  Download,
  Upload,
  Printer,
  Send,
  Eye,
  Edit,
  Trash2,
  Plus,
  Check,
  X,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

// Module data
const modules = [
  {
    id: "people",
    name: "People Management",
    icon: Users,
    color: "emerald",
    description: "Complete workforce management from hiring to retirement",
    features: [
      {
        title: "Staff Directory",
        items: [
          "Complete employee profiles with photos",
          "Personal details, employment history, documents",
          "Emergency contacts and custom fields",
          "Advanced search and filtering",
          "Bulk CSV import with column mapping",
        ],
      },
      {
        title: "Department Management",
        items: [
          "Hierarchical department structure",
          "Department heads and reporting lines",
          "Budget allocation per department",
          "Visual organization chart",
          "Drag-and-drop org editing",
        ],
      },
      {
        title: "Document Tracking",
        items: [
          "Digital storage for all documents",
          "Automatic expiry alerts for passports",
          "Work permit and visa tracking",
          "Electoral card (Kartaun Eleitoral) management",
          "Professional license monitoring",
        ],
      },
    ],
  },
  {
    id: "hiring",
    name: "Hiring & Recruitment",
    icon: Briefcase,
    color: "violet",
    description: "Streamline recruitment from job posting to onboarding",
    features: [
      {
        title: "Job Management",
        items: [
          "Create and manage job postings",
          "Define requirements and salary ranges",
          "Track posting status",
          "Job templates for common positions",
        ],
      },
      {
        title: "Candidate Pipeline",
        items: [
          "Applicant tracking system (ATS)",
          "Resume storage and parsing",
          "Interview scheduling",
          "Candidate scoring and comparison",
          "Email templates for communication",
        ],
      },
      {
        title: "Onboarding & Offboarding",
        items: [
          "Customizable onboarding checklists",
          "Task assignment to HR, IT, managers",
          "Progress tracking dashboard",
          "Exit interview management",
          "Asset return and knowledge transfer",
        ],
      },
    ],
  },
  {
    id: "time",
    name: "Time & Attendance",
    icon: Clock,
    color: "orange",
    description: "Track working hours, attendance, and leave requests",
    features: [
      {
        title: "Time Tracking",
        items: [
          "Clock in/out via web interface",
          "GPS location capture (optional)",
          "Break time tracking",
          "Automatic overtime calculation",
          "Timesheet approval workflow",
        ],
      },
      {
        title: "Attendance",
        items: [
          "Daily attendance dashboard",
          "Late arrival tracking",
          "Early departure logging",
          "Absence recording with reasons",
          "Attendance patterns analytics",
        ],
      },
      {
        title: "Leave Management",
        items: [
          "Leave request and approval",
          "Annual, sick, maternity leave types",
          "TL public holidays built-in",
          "Leave balance tracking",
          "Team calendar view",
        ],
      },
      {
        title: "Shift Scheduling",
        items: [
          "Visual shift planner",
          "Drag-and-drop scheduling",
          "Shift templates and rotations",
          "Availability management",
          "Coverage alerts",
        ],
      },
    ],
  },
  {
    id: "performance",
    name: "Performance Management",
    icon: Target,
    color: "pink",
    description: "Develop your team with goals, reviews, and training",
    features: [
      {
        title: "Goals & OKRs",
        items: [
          "Individual and team goals",
          "Goal alignment with company objectives",
          "Progress tracking and updates",
          "Goal completion analytics",
        ],
      },
      {
        title: "Performance Reviews",
        items: [
          "Configurable review cycles",
          "360-degree feedback support",
          "Self-assessment forms",
          "Competency-based assessments",
          "Review history and trends",
        ],
      },
      {
        title: "Training & Development",
        items: [
          "Training program management",
          "Course assignment and tracking",
          "Certification tracking with expiry",
          "Training budget management",
          "Compliance training requirements",
        ],
      },
    ],
  },
  {
    id: "payroll",
    name: "Payroll",
    icon: Calculator,
    color: "blue",
    description: "Fully compliant payroll processing for Timor-Leste",
    features: [
      {
        title: "Payroll Processing",
        items: [
          "Monthly and bi-weekly cycles",
          "Automatic INSS calculation (4% + 6%)",
          "Withholding tax (10% above $500 threshold)",
          "Overtime (1.5x and 2x per TL law)",
          "Allowances, bonuses, commissions",
          "Payroll preview and approval",
        ],
      },
      {
        title: "Payslips & Distribution",
        items: [
          "PDF payslips with branding",
          "Email distribution to employees",
          "Employee self-service portal",
          "Historical payslip archive",
          "Bilingual payslips (EN/PT/TET)",
        ],
      },
      {
        title: "Bank Transfers",
        items: [
          "BNU file format generation",
          "BNCTL payment files",
          "Mandiri and ANZ support",
          "Bulk transfer processing",
          "Mobile money ready (Telkomcel/Telemor)",
        ],
      },
      {
        title: "Tax Filing",
        items: [
          "ATTL Monthly Withholding Tax Report",
          "INSS Monthly Contribution Report",
          "Annual tax summaries per employee",
          "Government-compatible export formats",
        ],
      },
    ],
  },
  {
    id: "money",
    name: "Money (Invoicing)",
    icon: Wallet,
    color: "indigo",
    description: "Complete accounts receivable and payable",
    features: [
      {
        title: "Invoicing",
        items: [
          "Professional invoice creation",
          "Customizable templates",
          "10% TL sales tax calculation",
          "Status tracking (Draft → Paid)",
          "Partial payments support",
          "Recurring invoices",
          "PDF generation and email",
        ],
      },
      {
        title: "Customer Management",
        items: [
          "Customer database",
          "Credit terms per customer",
          "Transaction history",
          "Outstanding balance tracking",
        ],
      },
      {
        title: "Bills & Expenses",
        items: [
          "Bill entry from vendors",
          "Expense recording by category",
          "Bill payment tracking",
          "Receipt attachment",
          "AP aging reports",
        ],
      },
      {
        title: "Financial Reports",
        items: [
          "Profit & Loss statement",
          "Cash flow report",
          "AR/AP Aging reports",
          "Bank reconciliation",
        ],
      },
    ],
  },
  {
    id: "accounting",
    name: "Accounting",
    icon: Landmark,
    color: "slate",
    description: "Double-entry accounting for formal financial management",
    features: [
      {
        title: "Chart of Accounts",
        items: [
          "Pre-configured for TL businesses",
          "Assets, Liabilities, Equity, Revenue, Expenses",
          "Custom account creation",
          "Account hierarchies",
        ],
      },
      {
        title: "Journal Entries",
        items: [
          "Manual journal entry creation",
          "Automatic entries from invoices/bills",
          "Entry approval workflow",
          "Reversing entries",
        ],
      },
      {
        title: "Reporting",
        items: [
          "General Ledger",
          "Trial Balance",
          "Financial statements",
          "Period comparison",
        ],
      },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    icon: BarChart3,
    color: "cyan",
    description: "Comprehensive reporting across all modules",
    features: [
      {
        title: "Payroll Reports",
        items: [
          "Payroll summary by department",
          "INSS contribution reports",
          "Tax withholding summaries",
          "Year-to-date earnings",
        ],
      },
      {
        title: "HR Reports",
        items: [
          "Headcount and turnover",
          "Demographics analysis",
          "New hire and termination reports",
          "Attendance summaries",
        ],
      },
      {
        title: "Custom Reports",
        items: [
          "Flexible report builder",
          "Export to Excel, PDF, CSV",
          "Scheduled report delivery",
          "Report templates",
        ],
      },
    ],
  },
];

// TL-specific features
const tlFeatures = [
  {
    icon: Calculator,
    title: "INSS (Social Security)",
    description: "Automatic calculation of contributions",
    details: [
      "Employee contribution: 4% of gross salary",
      "Employer contribution: 6% of gross salary",
      "Monthly INSS report generation",
      "INSS number tracking per employee",
    ],
  },
  {
    icon: FileText,
    title: "Wage Income Tax (WIT)",
    description: "10% above $500 threshold for residents",
    details: [
      "Residents: $0-$500 = No tax",
      "Residents: Above $500 = 10% of excess",
      "Non-residents: 10% on all income",
      "Monthly filing due by 15th",
      "ATTL monthly report generation",
    ],
  },
  {
    icon: Landmark,
    title: "Local Bank Integration",
    description: "Direct payment file generation",
    details: [
      "BNU (Banco Nacional Ultramarino)",
      "BNCTL (Banco Central de Timor-Leste)",
      "Bank Mandiri Timor-Leste",
      "ANZ Bank",
    ],
  },
  {
    icon: Smartphone,
    title: "Mobile Money Ready",
    description: "Pay employees without bank accounts",
    details: [
      "Telkomcel mobile money integration",
      "Telemor mobile money integration",
      "Direct wallet disbursement",
      "Transaction tracking",
    ],
  },
  {
    icon: Languages,
    title: "Trilingual Interface",
    description: "Full support for local languages",
    details: [
      "English - Complete translation",
      "Portuguese - Complete translation",
      "Tetum - First HR system with Tetum!",
      "Instant language switching",
    ],
  },
  {
    icon: Globe,
    title: "Foreign Worker Compliance",
    description: "Track permits and visas",
    details: [
      "Work permit expiry tracking",
      "Visa type recording",
      "SEPFOPE reporting support",
      "Automatic expiry alerts",
    ],
  },
];

// Public holidays
const publicHolidays = [
  { date: "Jan 1", name: "New Year's Day" },
  { date: "Mar 3", name: "Veterans Day" },
  { date: "Variable", name: "Good Friday" },
  { date: "May 20", name: "Restoration of Independence" },
  { date: "Variable", name: "Corpus Christi" },
  { date: "Aug 30", name: "Popular Consultation Day" },
  { date: "Nov 28", name: "Independence Day" },
  { date: "Dec 7", name: "National Heroes Day" },
  { date: "Dec 8", name: "Immaculate Conception" },
  { date: "Dec 25", name: "Christmas Day" },
];

// Benefits by stakeholder
const benefits = [
  {
    stakeholder: "For Businesses",
    icon: Building2,
    items: [
      { benefit: "Time Savings", desc: "Automate payroll from days to minutes" },
      { benefit: "Error Reduction", desc: "Eliminate manual calculation errors" },
      { benefit: "Compliance", desc: "Never miss a tax filing or permit expiry" },
      { benefit: "Cost Reduction", desc: "Replace multiple systems with one" },
      { benefit: "Visibility", desc: "Real-time dashboards and reports" },
      { benefit: "Scalability", desc: "Grows with your business" },
    ],
  },
  {
    stakeholder: "For Employees",
    icon: Users,
    items: [
      { benefit: "Self-Service", desc: "View payslips, request leave anytime" },
      { benefit: "Transparency", desc: "Clear breakdown of pay" },
      { benefit: "Tetum Interface", desc: "Use in their language" },
      { benefit: "Mobile Access", desc: "Check from phone" },
      { benefit: "Accurate Pay", desc: "Correct calculations always" },
    ],
  },
  {
    stakeholder: "For Government",
    icon: Landmark,
    items: [
      { benefit: "Tax Compliance", desc: "Easier INSS and tax collection" },
      { benefit: "Labor Law", desc: "Businesses follow overtime rules" },
      { benefit: "Foreign Workers", desc: "Better permit visibility" },
      { benefit: "Economic Data", desc: "Employment statistics" },
    ],
  },
  {
    stakeholder: "For Accounting Firms",
    icon: Calculator,
    items: [
      { benefit: "New Revenue", desc: "Offer HR/Payroll as service" },
      { benefit: "Client Stickiness", desc: "Deeper engagement" },
      { benefit: "Efficiency", desc: "Reduce manual data entry" },
      { benefit: "Standardization", desc: "All clients on same system" },
    ],
  },
];


// Expandable module section component
function ModuleSection({ module, index }: { module: typeof modules[0]; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const Icon = module.icon;

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
    pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
    slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  };

  const colors = colorClasses[module.color] || colorClasses.emerald;

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white/[0.02] overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`h-6 w-6 ${colors.text}`} />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-white">{module.name}</h3>
            <p className="text-sm text-zinc-500">{module.description}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-zinc-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {module.features.map((feature, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <h4 className={`font-semibold ${colors.text} mb-3`}>{feature.title}</h4>
                <ul className="space-y-2">
                  {feature.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-400">
                      <CheckCircle2 className={`h-4 w-4 ${colors.text} flex-shrink-0 mt-0.5`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductDetails() {
  const [activeTab, setActiveTab] = useState<"modules" | "tl" | "benefits">("modules");

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <SEO
        title="OniT HR/Payroll - Complete Platform Overview"
        description="Comprehensive HR and Payroll system built for Timor-Leste. Full details on features, modules, and TL-specific capabilities."
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/landing" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 via-amber-500 to-black flex items-center justify-center border border-amber-500/20">
                <span className="text-white text-sm font-black">TL</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-none">
                  Oni<span className="text-red-500">T</span>
                </span>
                <span className="text-[10px] text-zinc-500 tracking-wider">TIMOR-LESTE</span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/landing" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Back to Home
              </Link>
              <Button asChild className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
                <Link to="/auth/signup">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
            <FileText className="h-4 w-4 text-red-400" />
            <span className="text-sm text-zinc-300">Complete Platform Documentation</span>
          </div>

          <h1 className="text-4xl lg:text-6xl font-black mb-6">
            Everything You Need to Know
            <span className="block bg-gradient-to-r from-red-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              About OniT HR/Payroll
            </span>
          </h1>

          <p className="text-xl text-zinc-400 max-w-3xl mx-auto mb-10">
            The most comprehensive HR and Payroll system built specifically for Timor-Leste.
            Explore all 9 modules, 65+ features, and TL-specific capabilities.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            {[
              { value: "9", label: "Modules" },
              { value: "65+", label: "Features" },
              { value: "3", label: "Languages" },
              { value: "4", label: "Banks Supported" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-black text-white">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="sticky top-16 z-40 bg-[#0a0a0b]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {[
              { id: "modules", label: "All Modules", icon: Settings },
              { id: "tl", label: "TL-Specific", icon: MapPin },
              { id: "benefits", label: "Benefits", icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">

        {/* Modules Section */}
        {activeTab === "modules" && (
          <div className="space-y-4">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Platform Modules</h2>
              <p className="text-zinc-400">Click each module to explore its features in detail</p>
            </div>
            {modules.map((module, i) => (
              <ModuleSection key={module.id} module={module} index={i} />
            ))}
          </div>
        )}

        {/* TL-Specific Section */}
        {activeTab === "tl" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Built for Timor-Leste</h2>
              <p className="text-zinc-400 mb-8">Features designed specifically for TL compliance and operations</p>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tlFeatures.map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-red-500/20 transition-colors">
                      <div className="p-3 rounded-xl bg-red-500/10 inline-flex mb-4">
                        <Icon className="h-6 w-6 text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
                      <p className="text-sm text-zinc-500 mb-4">{feature.description}</p>
                      <ul className="space-y-2">
                        {feature.details.map((detail, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-zinc-400">
                            <CheckCircle2 className="h-3 w-3 text-red-400 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Public Holidays */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">TL Public Holidays (Pre-configured)</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {publicHolidays.map((holiday, i) => (
                  <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="text-xs text-amber-400 font-mono mb-1">{holiday.date}</div>
                    <div className="text-sm text-zinc-300">{holiday.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Reference */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Wage Income Tax (WIT)</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Residents (Monthly)</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-white/[0.03]">
                        <span className="text-zinc-400">$0 - $500</span>
                        <span className="font-mono text-emerald-400">0%</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <span className="text-zinc-300">Above $500</span>
                        <span className="font-mono text-blue-400 font-medium">10% of excess</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Non-Residents (Monthly)</p>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-zinc-300">All income</span>
                      <span className="font-mono text-amber-400 font-medium">10%</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">Due by 15th of following month via e-Tax</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">INSS Contributions</h3>
                <div className="space-y-2">
                  {[
                    { label: "Employee Contribution", rate: "4%" },
                    { label: "Employer Contribution", rate: "6%" },
                    { label: "Total Contribution", rate: "10%", highlight: true },
                  ].map((item, i) => (
                    <div key={i} className={`flex justify-between items-center p-3 rounded-lg ${item.highlight ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.03]'}`}>
                      <span className={item.highlight ? 'text-emerald-300 font-medium' : 'text-zinc-400'}>{item.label}</span>
                      <span className={`font-mono ${item.highlight ? 'text-emerald-400 font-bold' : 'text-emerald-400'}`}>{item.rate}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        {activeTab === "benefits" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Benefits by Stakeholder</h2>
              <p className="text-zinc-400 mb-8">How OniT helps everyone in your organization</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((group, i) => {
                const Icon = group.icon;
                return (
                  <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Icon className="h-5 w-5 text-amber-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">{group.stakeholder}</h3>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((item, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-1" />
                          <div>
                            <span className="text-white font-medium">{item.benefit}</span>
                            <span className="text-zinc-500"> — {item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Technical highlights */}
            <div className="mt-12">
              <h3 className="text-xl font-bold text-white mb-6">Technical Highlights</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { icon: Cloud, label: "Cloud Hosted", desc: "99.9% uptime SLA" },
                  { icon: WifiOff, label: "Offline Capable", desc: "Works without internet" },
                  { icon: Lock, label: "Secure", desc: "End-to-end encryption" },
                  { icon: Smartphone, label: "Mobile Ready", desc: "Responsive design" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                      <Icon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <div className="font-medium text-white">{item.label}</div>
                      <div className="text-xs text-zinc-500">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* CTA Section */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-zinc-400 mb-8">
            Join businesses across Timor-Leste using OniT for compliant HR and Payroll.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
              <Link to="/auth/signup">
                Start 30-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/10 hover:bg-white/5">
              <a href="https://wa.me/6707701234">
                <MessageCircle className="mr-2 h-5 w-5" />
                WhatsApp Us
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
              <span className="text-white text-xs font-black">TL</span>
            </div>
            <span className="font-bold">OniT</span>
            <span className="text-zinc-600 text-sm">Dili, Timor-Leste</span>
          </div>
          <div className="text-sm text-zinc-600">
            © 2026 OniT Enterprises. Built for Timor-Leste.
          </div>
        </div>
      </footer>
    </div>
  );
}
