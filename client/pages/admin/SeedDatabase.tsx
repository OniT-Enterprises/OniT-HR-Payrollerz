import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Database, Users, Building, CheckCircle, Loader2, AlertCircle,
  Briefcase, UserCheck, Calendar, Clock, Target, GraduationCap,
  DollarSign, FileText, Star, Calculator
} from "lucide-react";
import { collection, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTenant } from "@/contexts/TenantContext";

// ============================================
// SEED DATA DEFINITIONS
// ============================================

const DEPARTMENTS = [
  { name: "Executive", director: "James Wilson", icon: "crown", shape: "diamond" as const, color: "#8B5CF6", budget: 500000 },
  { name: "Engineering", director: "Sarah Chen", manager: "Michael Torres", icon: "code", shape: "hexagon" as const, color: "#3B82F6", budget: 850000 },
  { name: "Human Resources", director: "Patricia Moore", manager: "David Kim", icon: "users", shape: "circle" as const, color: "#10B981", budget: 320000 },
  { name: "Finance", director: "Robert Johnson", manager: "Emily Davis", icon: "dollar-sign", shape: "square" as const, color: "#F59E0B", budget: 420000 },
  { name: "Marketing", director: "Jennifer Lee", manager: "Chris Anderson", icon: "megaphone", shape: "circle" as const, color: "#EC4899", budget: 380000 },
  { name: "Operations", director: "William Brown", manager: "Lisa Martinez", icon: "settings", shape: "hexagon" as const, color: "#6366F1", budget: 620000 },
  { name: "Sales", director: "Thomas Garcia", manager: "Amanda White", icon: "trending-up", shape: "square" as const, color: "#14B8A6", budget: 550000 },
  { name: "Security", director: "Carlos Santos", manager: "Maria Silva", icon: "shield", shape: "circle" as const, color: "#EF4444", budget: 280000 },
];

const POSITIONS = [
  { title: "Chief Executive Officer", grade: "E1", minSalary: 40000, maxSalary: 60000, department: "Executive" },
  { title: "Chief Financial Officer", grade: "E1", minSalary: 35000, maxSalary: 50000, department: "Executive" },
  { title: "VP of Engineering", grade: "E2", minSalary: 25000, maxSalary: 35000, department: "Engineering" },
  { title: "Engineering Manager", grade: "M1", minSalary: 15000, maxSalary: 22000, department: "Engineering" },
  { title: "Senior Software Engineer", grade: "P3", minSalary: 12000, maxSalary: 18000, department: "Engineering" },
  { title: "Software Engineer", grade: "P2", minSalary: 8000, maxSalary: 14000, department: "Engineering" },
  { title: "Junior Developer", grade: "P1", minSalary: 5000, maxSalary: 8000, department: "Engineering" },
  { title: "Director of HR", grade: "E2", minSalary: 20000, maxSalary: 28000, department: "Human Resources" },
  { title: "HR Manager", grade: "M1", minSalary: 10000, maxSalary: 15000, department: "Human Resources" },
  { title: "HR Specialist", grade: "P2", minSalary: 6000, maxSalary: 10000, department: "Human Resources" },
  { title: "Director of Finance", grade: "E2", minSalary: 22000, maxSalary: 32000, department: "Finance" },
  { title: "Finance Manager", grade: "M1", minSalary: 12000, maxSalary: 18000, department: "Finance" },
  { title: "Accountant", grade: "P2", minSalary: 7000, maxSalary: 12000, department: "Finance" },
  { title: "Security Manager", grade: "M1", minSalary: 8000, maxSalary: 12000, department: "Security" },
  { title: "Security Officer", grade: "P1", minSalary: 3000, maxSalary: 5000, department: "Security" },
];

const EMPLOYEES = [
  // Executive
  {
    personalInfo: { firstName: "James", lastName: "Wilson", email: "james.wilson@company.com", phone: "+670-7701-0101", dateOfBirth: "1970-03-15", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-001", department: "Executive", position: "Chief Executive Officer", hireDate: "2015-01-15", employmentType: "Full-time", workLocation: "Dili Head Office" },
    compensation: { monthlySalary: 45000, annualLeaveDays: 30, benefitsPackage: "Executive" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Margaret", lastName: "Chen", email: "margaret.chen@company.com", phone: "+670-7701-0102", dateOfBirth: "1975-07-22", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-002", department: "Executive", position: "Chief Financial Officer", hireDate: "2016-03-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 38000, annualLeaveDays: 28, benefitsPackage: "Executive" },
    status: "active" as const,
  },
  // Engineering
  {
    personalInfo: { firstName: "Sarah", lastName: "Chen", email: "sarah.chen@company.com", phone: "+670-7701-0103", dateOfBirth: "1985-11-08", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-003", department: "Engineering", position: "VP of Engineering", hireDate: "2018-06-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 28000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Michael", lastName: "Torres", email: "michael.torres@company.com", phone: "+670-7701-0104", dateOfBirth: "1988-04-12", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-004", department: "Engineering", position: "Engineering Manager", hireDate: "2019-02-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Sarah Chen" },
    compensation: { monthlySalary: 18000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Emily", lastName: "Rodriguez", email: "emily.rodriguez@company.com", phone: "+670-7701-0105", dateOfBirth: "1992-09-25", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-005", department: "Engineering", position: "Senior Software Engineer", hireDate: "2020-08-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Michael Torres" },
    compensation: { monthlySalary: 14000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "David", lastName: "Park", email: "david.park@company.com", phone: "+670-7701-0106", dateOfBirth: "1994-02-18", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-006", department: "Engineering", position: "Software Engineer", hireDate: "2022-01-10", employmentType: "Full-time", workLocation: "Remote", manager: "Michael Torres" },
    compensation: { monthlySalary: 11000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Ana", lastName: "Costa", email: "ana.costa@company.com", phone: "+670-7701-0107", dateOfBirth: "1996-06-30", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-007", department: "Engineering", position: "Junior Developer", hireDate: "2024-03-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Michael Torres" },
    compensation: { monthlySalary: 6000, annualLeaveDays: 18, benefitsPackage: "Basic" },
    status: "active" as const,
  },
  // Human Resources
  {
    personalInfo: { firstName: "Patricia", lastName: "Moore", email: "patricia.moore@company.com", phone: "+670-7701-0108", dateOfBirth: "1978-06-30", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-008", department: "Human Resources", position: "Director of HR", hireDate: "2017-04-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 22000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "David", lastName: "Kim", email: "david.kim@company.com", phone: "+670-7701-0109", dateOfBirth: "1986-12-05", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-009", department: "Human Resources", position: "HR Manager", hireDate: "2019-07-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Patricia Moore" },
    compensation: { monthlySalary: 12000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  // Finance
  {
    personalInfo: { firstName: "Robert", lastName: "Johnson", email: "robert.johnson@company.com", phone: "+670-7701-0110", dateOfBirth: "1972-08-20", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-010", department: "Finance", position: "Director of Finance", hireDate: "2016-09-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Margaret Chen" },
    compensation: { monthlySalary: 24000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Emily", lastName: "Davis", email: "emily.davis@company.com", phone: "+670-7701-0111", dateOfBirth: "1990-01-14", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-011", department: "Finance", position: "Finance Manager", hireDate: "2020-03-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Robert Johnson" },
    compensation: { monthlySalary: 13000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "João", lastName: "Pereira", email: "joao.pereira@company.com", phone: "+670-7701-0112", dateOfBirth: "1993-05-22", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-012", department: "Finance", position: "Accountant", hireDate: "2021-06-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Emily Davis" },
    compensation: { monthlySalary: 8000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  // Security
  {
    personalInfo: { firstName: "Carlos", lastName: "Santos", email: "carlos.santos@company.com", phone: "+670-7701-0113", dateOfBirth: "1980-03-10", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-013", department: "Security", position: "Security Manager", hireDate: "2018-01-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "William Brown" },
    compensation: { monthlySalary: 10000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "Maria", lastName: "Silva", email: "maria.silva@company.com", phone: "+670-7701-0114", dateOfBirth: "1985-09-18", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-014", department: "Security", position: "Security Officer", hireDate: "2019-04-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Carlos Santos" },
    compensation: { monthlySalary: 4000, annualLeaveDays: 18, benefitsPackage: "Basic" },
    status: "active" as const,
  },
  {
    personalInfo: { firstName: "José", lastName: "Oliveira", email: "jose.oliveira@company.com", phone: "+670-7701-0115", dateOfBirth: "1990-11-25", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-015", department: "Security", position: "Security Officer", hireDate: "2020-02-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "Carlos Santos" },
    compensation: { monthlySalary: 4000, annualLeaveDays: 18, benefitsPackage: "Basic" },
    status: "active" as const,
  },
  // Marketing
  {
    personalInfo: { firstName: "Jennifer", lastName: "Lee", email: "jennifer.lee@company.com", phone: "+670-7701-0116", dateOfBirth: "1983-05-28", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-016", department: "Marketing", position: "Director of Marketing", hireDate: "2018-01-15", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 21000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
  // Operations
  {
    personalInfo: { firstName: "William", lastName: "Brown", email: "william.brown@company.com", phone: "+670-7701-0117", dateOfBirth: "1976-03-17", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-017", department: "Operations", position: "Director of Operations", hireDate: "2017-08-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 23000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
  // Sales
  {
    personalInfo: { firstName: "Thomas", lastName: "Garcia", email: "thomas.garcia@company.com", phone: "+670-7701-0118", dateOfBirth: "1980-11-22", nationality: "Timorese" },
    jobDetails: { employeeId: "EMP-018", department: "Sales", position: "Director of Sales", hireDate: "2018-10-01", employmentType: "Full-time", workLocation: "Dili Head Office", manager: "James Wilson" },
    compensation: { monthlySalary: 22000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    status: "active" as const,
  },
];

const JOBS = [
  { title: "Senior Software Engineer", department: "Engineering", status: "open", salaryMin: 12000, salaryMax: 18000, description: "We're looking for an experienced software engineer to join our team.", requirements: ["5+ years experience", "React/TypeScript", "Node.js"], location: "Dili" },
  { title: "HR Specialist", department: "Human Resources", status: "open", salaryMin: 6000, salaryMax: 10000, description: "Join our HR team to help manage employee relations.", requirements: ["3+ years HR experience", "HRIS systems", "Labor law knowledge"], location: "Dili" },
  { title: "Accountant", department: "Finance", status: "open", salaryMin: 7000, salaryMax: 12000, description: "Looking for a detail-oriented accountant.", requirements: ["Accounting degree", "QuickBooks experience", "IRPS knowledge"], location: "Dili" },
  { title: "Security Officer", department: "Security", status: "open", salaryMin: 3000, salaryMax: 5000, description: "Security officer for day shift.", requirements: ["Security training", "First aid certified"], location: "Dili" },
  { title: "Junior Developer", department: "Engineering", status: "closed", salaryMin: 5000, salaryMax: 8000, description: "Entry-level developer position.", requirements: ["Computer science degree", "Basic programming skills"], location: "Dili" },
];

const CANDIDATES = [
  { firstName: "António", lastName: "Soares", email: "antonio.soares@email.com", phone: "+670-7755-0001", jobTitle: "Senior Software Engineer", stage: "interview", rating: 4, source: "LinkedIn" },
  { firstName: "Filomena", lastName: "Guterres", email: "filomena.g@email.com", phone: "+670-7755-0002", jobTitle: "HR Specialist", stage: "screening", rating: 3, source: "Referral" },
  { firstName: "Manuel", lastName: "Ximenes", email: "manuel.x@email.com", phone: "+670-7755-0003", jobTitle: "Accountant", stage: "offer", rating: 5, source: "Job Fair" },
  { firstName: "Rosa", lastName: "Amaral", email: "rosa.amaral@email.com", phone: "+670-7755-0004", jobTitle: "Security Officer", stage: "applied", rating: 3, source: "Walk-in" },
  { firstName: "Pedro", lastName: "Fernandes", email: "pedro.f@email.com", phone: "+670-7755-0005", jobTitle: "Senior Software Engineer", stage: "rejected", rating: 2, source: "LinkedIn" },
  { firstName: "Lucia", lastName: "Correia", email: "lucia.c@email.com", phone: "+670-7755-0006", jobTitle: "HR Specialist", stage: "interview", rating: 4, source: "Indeed" },
];

const LEAVE_TYPES = ["Annual Leave", "Sick Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Bereavement Leave"];

const TRAINING_COURSES = [
  { name: "Lei Trabalho Timor-Leste", category: "Compliance", duration: 8, provider: "SEFOPE", mandatory: true },
  { name: "Workplace Safety", category: "Safety", duration: 4, provider: "Internal", mandatory: true },
  { name: "Leadership Development", category: "Leadership", duration: 16, provider: "External", mandatory: false },
  { name: "IRPS Tax Calculations", category: "Finance", duration: 4, provider: "Internal", mandatory: true },
  { name: "Customer Service Excellence", category: "Skills", duration: 8, provider: "External", mandatory: false },
  { name: "First Aid & CPR", category: "Safety", duration: 8, provider: "Red Cross", mandatory: true },
  { name: "Project Management Basics", category: "Skills", duration: 12, provider: "External", mandatory: false },
  { name: "Tetun Business Communication", category: "Language", duration: 20, provider: "Internal", mandatory: false },
];

// Chart of Accounts for Timor-Leste businesses
const CHART_OF_ACCOUNTS = [
  // Assets (1xxx)
  { code: "1000", name: "Assets", nameTL: "Ativu", type: "asset", subType: "other_asset", level: 1, isSystem: true },
  { code: "1100", name: "Cash on Hand", nameTL: "Osan iha Liman", type: "asset", subType: "cash", level: 2, isSystem: true },
  { code: "1110", name: "Petty Cash", nameTL: "Osan Ki'ik", type: "asset", subType: "cash", level: 3, isSystem: false },
  { code: "1200", name: "Bank Accounts", nameTL: "Konta Banku", type: "asset", subType: "bank", level: 2, isSystem: true },
  { code: "1210", name: "BNU Operating Account", type: "asset", subType: "bank", level: 3, isSystem: false },
  { code: "1220", name: "BNU Payroll Account", type: "asset", subType: "bank", level: 3, isSystem: false },
  { code: "1230", name: "ANZ Savings Account", type: "asset", subType: "bank", level: 3, isSystem: false },
  { code: "1300", name: "Accounts Receivable", nameTL: "Simu Atu Mai", type: "asset", subType: "accounts_receivable", level: 2, isSystem: true },
  { code: "1400", name: "Prepaid Expenses", nameTL: "Kustu Selu Uluk", type: "asset", subType: "prepaid_expense", level: 2, isSystem: false },
  { code: "1500", name: "Fixed Assets", nameTL: "Ativu Fixu", type: "asset", subType: "fixed_asset", level: 2, isSystem: true },
  { code: "1510", name: "Office Equipment", nameTL: "Ekipamentu Eskritóriu", type: "asset", subType: "fixed_asset", level: 3, isSystem: false },
  { code: "1520", name: "Vehicles", nameTL: "Kareta", type: "asset", subType: "fixed_asset", level: 3, isSystem: false },
  { code: "1530", name: "Furniture & Fixtures", type: "asset", subType: "fixed_asset", level: 3, isSystem: false },
  { code: "1600", name: "Accumulated Depreciation", type: "asset", subType: "accumulated_depreciation", level: 2, isSystem: true },

  // Liabilities (2xxx)
  { code: "2000", name: "Liabilities", nameTL: "Obrigasaun", type: "liability", subType: "other_liability", level: 1, isSystem: true },
  { code: "2100", name: "Accounts Payable", nameTL: "Atu Selu", type: "liability", subType: "accounts_payable", level: 2, isSystem: true },
  { code: "2200", name: "Salaries Payable", nameTL: "Saláriu Atu Selu", type: "liability", subType: "salaries_payable", level: 2, isSystem: true },
  { code: "2300", name: "IRPS Payable", nameTL: "IRPS Atu Selu", type: "liability", subType: "tax_payable", level: 2, isSystem: true },
  { code: "2400", name: "INSS Payable", nameTL: "INSS Atu Selu", type: "liability", subType: "inss_payable", level: 2, isSystem: true },
  { code: "2410", name: "INSS Employee Payable", type: "liability", subType: "inss_payable", level: 3, isSystem: true },
  { code: "2420", name: "INSS Employer Payable", type: "liability", subType: "inss_payable", level: 3, isSystem: true },
  { code: "2500", name: "Accrued Expenses", nameTL: "Kustu Akumuladu", type: "liability", subType: "accrued_expense", level: 2, isSystem: false },
  { code: "2600", name: "Loans Payable", nameTL: "Empréstimu Atu Selu", type: "liability", subType: "loans_payable", level: 2, isSystem: false },

  // Equity (3xxx)
  { code: "3000", name: "Equity", nameTL: "Kapital", type: "equity", subType: "owner_equity", level: 1, isSystem: true },
  { code: "3100", name: "Share Capital", nameTL: "Kapital Aksaun", type: "equity", subType: "share_capital", level: 2, isSystem: true },
  { code: "3200", name: "Retained Earnings", nameTL: "Lukru Retidu", type: "equity", subType: "retained_earnings", level: 2, isSystem: true },
  { code: "3300", name: "Owner's Equity", nameTL: "Kapital Na'in", type: "equity", subType: "owner_equity", level: 2, isSystem: false },

  // Revenue (4xxx)
  { code: "4000", name: "Revenue", nameTL: "Rendimentu", type: "revenue", subType: "service_revenue", level: 1, isSystem: true },
  { code: "4100", name: "Service Revenue", nameTL: "Rendimentu Servisu", type: "revenue", subType: "service_revenue", level: 2, isSystem: true },
  { code: "4200", name: "Sales Revenue", nameTL: "Rendimentu Vendas", type: "revenue", subType: "sales_revenue", level: 2, isSystem: false },
  { code: "4300", name: "Interest Income", nameTL: "Rendimentu Juros", type: "revenue", subType: "interest_income", level: 2, isSystem: false },
  { code: "4900", name: "Other Income", nameTL: "Rendimentu Seluk", type: "revenue", subType: "other_income", level: 2, isSystem: false },

  // Expenses (5xxx)
  { code: "5000", name: "Expenses", nameTL: "Kustu", type: "expense", subType: "other_expense", level: 1, isSystem: true },
  { code: "5100", name: "Salary Expense", nameTL: "Kustu Saláriu", type: "expense", subType: "salary_expense", level: 2, isSystem: true },
  { code: "5110", name: "Wages & Salaries", type: "expense", subType: "salary_expense", level: 3, isSystem: true },
  { code: "5120", name: "Overtime Pay", nameTL: "Pagamentu Oras Extra", type: "expense", subType: "salary_expense", level: 3, isSystem: false },
  { code: "5130", name: "Subsidio Anual (13th Month)", type: "expense", subType: "salary_expense", level: 3, isSystem: true },
  { code: "5140", name: "Bonuses & Commissions", type: "expense", subType: "salary_expense", level: 3, isSystem: false },
  { code: "5200", name: "INSS Employer Expense", nameTL: "Kustu INSS Empreza", type: "expense", subType: "inss_expense", level: 2, isSystem: true },
  { code: "5300", name: "Rent Expense", nameTL: "Kustu Aluga", type: "expense", subType: "rent_expense", level: 2, isSystem: false },
  { code: "5400", name: "Utilities", nameTL: "Kustu Utilidade", type: "expense", subType: "utilities_expense", level: 2, isSystem: false },
  { code: "5410", name: "Electricity (EDTL)", type: "expense", subType: "utilities_expense", level: 3, isSystem: false },
  { code: "5420", name: "Water", type: "expense", subType: "utilities_expense", level: 3, isSystem: false },
  { code: "5430", name: "Internet & Phone", type: "expense", subType: "utilities_expense", level: 3, isSystem: false },
  { code: "5500", name: "Office Supplies", nameTL: "Fornese Eskritóriu", type: "expense", subType: "office_supplies", level: 2, isSystem: false },
  { code: "5600", name: "Depreciation Expense", nameTL: "Kustu Depreciasaun", type: "expense", subType: "depreciation_expense", level: 2, isSystem: true },
  { code: "5700", name: "Professional Services", type: "expense", subType: "other_expense", level: 2, isSystem: false },
  { code: "5800", name: "Travel & Transportation", nameTL: "Kustu Viagem", type: "expense", subType: "other_expense", level: 2, isSystem: false },
  { code: "5900", name: "Other Expenses", nameTL: "Kustu Seluk", type: "expense", subType: "other_expense", level: 2, isSystem: false },
];

// ============================================
// COMPONENT
// ============================================

export default function SeedDatabase() {
  const { session } = useTenant();
  const tenantId = session?.tid;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [results, setResults] = useState<Record<string, { success: number; failed: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Seeding options
  const [options, setOptions] = useState({
    departments: true,
    positions: true,
    employees: true,
    jobs: true,
    candidates: true,
    leaveRequests: true,
    attendance: true,
    goals: true,
    reviews: true,
    training: true,
    payroll: true,
    accounting: true,
  });

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const getCollectionPath = (collectionName: string) => {
    if (!tenantId) return collectionName; // Fallback to root collection
    return `tenants/${tenantId}/${collectionName}`;
  };

  // Seed functions
  const seedDepartments = async () => {
    let success = 0, failed = 0;
    for (const dept of DEPARTMENTS) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("departments")));
        await setDoc(docRef, { ...dept, id: docRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        success++;
        addLog(`✓ Department: ${dept.name}`);
      } catch (err) {
        failed++;
        addLog(`✗ Department ${dept.name}: ${err}`);
      }
    }
    return { success, failed };
  };

  const seedPositions = async () => {
    let success = 0, failed = 0;
    for (const pos of POSITIONS) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("positions")));
        await setDoc(docRef, { ...pos, id: docRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        success++;
        addLog(`✓ Position: ${pos.title}`);
      } catch (err) {
        failed++;
        addLog(`✗ Position ${pos.title}: ${err}`);
      }
    }
    return { success, failed };
  };

  const seedEmployees = async () => {
    let success = 0, failed = 0;
    for (const emp of EMPLOYEES) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("employees")));
        await setDoc(docRef, {
          ...emp,
          id: docRef.id,
          documents: {
            employeeIdCard: { number: `ID-${emp.jobDetails.employeeId}`, expiryDate: "2027-12-31", required: true },
            socialSecurityNumber: { number: `SSN-${emp.jobDetails.employeeId}`, expiryDate: "", required: true },
            nationality: emp.personalInfo.nationality,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Employee: ${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`);
      } catch (err) {
        failed++;
        addLog(`✗ Employee ${emp.personalInfo.firstName}: ${err}`);
      }
    }
    return { success, failed };
  };

  const seedJobs = async () => {
    let success = 0, failed = 0;
    for (const job of JOBS) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("jobs")));
        await setDoc(docRef, {
          ...job,
          id: docRef.id,
          postedDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Job: ${job.title}`);
      } catch (err) {
        failed++;
        addLog(`✗ Job ${job.title}: ${err}`);
      }
    }
    return { success, failed };
  };

  const seedCandidates = async () => {
    let success = 0, failed = 0;
    for (const candidate of CANDIDATES) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("candidates")));
        await setDoc(docRef, {
          ...candidate,
          id: docRef.id,
          appliedDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Candidate: ${candidate.firstName} ${candidate.lastName}`);
      } catch (err) {
        failed++;
        addLog(`✗ Candidate ${candidate.firstName}: ${err}`);
      }
    }
    return { success, failed };
  };

  const seedLeaveRequests = async () => {
    let success = 0, failed = 0;
    const statuses = ["pending", "approved", "rejected"];

    for (let i = 0; i < 20; i++) {
      try {
        const emp = EMPLOYEES[Math.floor(Math.random() * EMPLOYEES.length)];
        const leaveType = LEAVE_TYPES[Math.floor(Math.random() * LEAVE_TYPES.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60) - 30);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

        const docRef = doc(collection(db!, getCollectionPath("leaveRequests")));
        await setDoc(docRef, {
          id: docRef.id,
          employeeId: emp.jobDetails.employeeId,
          employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
          leaveType,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          reason: `${leaveType} request`,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
      } catch (err) {
        failed++;
      }
    }
    addLog(`✓ Leave requests: ${success} created`);
    return { success, failed };
  };

  const seedAttendance = async () => {
    let success = 0, failed = 0;
    const today = new Date();

    // Create attendance for last 30 days for all employees
    for (const emp of EMPLOYEES) {
      for (let day = 0; day < 30; day++) {
        try {
          const date = new Date(today);
          date.setDate(date.getDate() - day);

          // Skip weekends
          if (date.getDay() === 0 || date.getDay() === 6) continue;

          const checkIn = new Date(date);
          checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0);
          const checkOut = new Date(date);
          checkOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0);

          const docRef = doc(collection(db!, getCollectionPath("timesheets")));
          await setDoc(docRef, {
            id: docRef.id,
            employeeId: emp.jobDetails.employeeId,
            employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
            date: Timestamp.fromDate(date),
            checkIn: Timestamp.fromDate(checkIn),
            checkOut: Timestamp.fromDate(checkOut),
            hoursWorked: ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2),
            status: Math.random() > 0.1 ? "present" : "late",
            createdAt: serverTimestamp(),
          });
          success++;
        } catch (err) {
          failed++;
        }
      }
    }
    addLog(`✓ Attendance records: ${success} created`);
    return { success, failed };
  };

  const seedGoals = async () => {
    let success = 0, failed = 0;
    const goalTypes = ["performance", "development", "project"];
    const goalTemplates = [
      "Complete Q1 objectives",
      "Improve team productivity by 15%",
      "Complete professional certification",
      "Lead cross-functional project",
      "Mentor junior team members",
      "Reduce operational costs by 10%",
      "Implement new process improvement",
      "Achieve customer satisfaction score of 95%",
    ];

    for (const emp of EMPLOYEES) {
      for (let g = 0; g < 3; g++) {
        try {
          const docRef = doc(collection(db!, getCollectionPath("goals")));
          const progress = Math.floor(Math.random() * 100);
          await setDoc(docRef, {
            id: docRef.id,
            employeeId: emp.jobDetails.employeeId,
            employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
            title: goalTemplates[Math.floor(Math.random() * goalTemplates.length)],
            type: goalTypes[Math.floor(Math.random() * goalTypes.length)],
            progress,
            status: progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started",
            dueDate: Timestamp.fromDate(new Date(2026, 11, 31)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          success++;
        } catch (err) {
          failed++;
        }
      }
    }
    addLog(`✓ Goals: ${success} created`);
    return { success, failed };
  };

  const seedReviews = async () => {
    let success = 0, failed = 0;

    for (const emp of EMPLOYEES) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("reviews")));
        const rating = 3 + Math.floor(Math.random() * 2);
        await setDoc(docRef, {
          id: docRef.id,
          employeeId: emp.jobDetails.employeeId,
          employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
          reviewerId: "EMP-008", // HR Manager
          reviewerName: "Patricia Moore",
          period: "2025 Annual Review",
          rating,
          status: Math.random() > 0.3 ? "completed" : "pending",
          ratings: {
            performance: rating,
            teamwork: rating + (Math.random() > 0.5 ? 0 : -1),
            communication: rating,
            initiative: rating + (Math.random() > 0.5 ? 1 : 0),
          },
          comments: "Employee demonstrates strong commitment to their role.",
          completedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
      } catch (err) {
        failed++;
      }
    }
    addLog(`✓ Reviews: ${success} created`);
    return { success, failed };
  };

  const seedTraining = async () => {
    let success = 0, failed = 0;

    // Create training records
    for (const course of TRAINING_COURSES) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("trainings")));
        await setDoc(docRef, {
          id: docRef.id,
          ...course,
          enrolledCount: Math.floor(Math.random() * 15) + 5,
          completedCount: Math.floor(Math.random() * 10),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Training: ${course.name}`);
      } catch (err) {
        failed++;
      }
    }
    return { success, failed };
  };

  const seedPayroll = async () => {
    let success = 0, failed = 0;

    // Create payroll run for last month
    try {
      const thisMonth = new Date();
      thisMonth.setMonth(thisMonth.getMonth() - 1);
      const payrunRef = doc(collection(db!, getCollectionPath("payruns")));

      let totalGross = 0;
      let totalNet = 0;
      let totalIRPS = 0;
      let totalINSS = 0;

      // Calculate totals
      for (const emp of EMPLOYEES) {
        const gross = emp.compensation.monthlySalary;
        const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
        const inssEmployee = gross * 0.04;
        const net = gross - irps - inssEmployee;

        totalGross += gross;
        totalNet += net;
        totalIRPS += irps;
        totalINSS += inssEmployee;
      }

      await setDoc(payrunRef, {
        id: payrunRef.id,
        period: `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`,
        periodLabel: thisMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        status: "completed",
        employeeCount: EMPLOYEES.length,
        totalGross,
        totalNet,
        totalIRPS,
        totalINSS,
        totalINSSEmployer: totalGross * 0.06,
        processedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create payslips for each employee
      for (const emp of EMPLOYEES) {
        const gross = emp.compensation.monthlySalary;
        const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
        const inssEmployee = gross * 0.04;
        const inssEmployer = gross * 0.06;
        const net = gross - irps - inssEmployee;

        const payslipRef = doc(collection(db!, `${getCollectionPath("payruns")}/${payrunRef.id}/payslips`));
        await setDoc(payslipRef, {
          id: payslipRef.id,
          payrunId: payrunRef.id,
          employeeId: emp.jobDetails.employeeId,
          employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
          department: emp.jobDetails.department,
          position: emp.jobDetails.position,
          basicSalary: gross,
          grossPay: gross,
          irps,
          inssEmployee,
          inssEmployer,
          totalDeductions: irps + inssEmployee,
          netPay: net,
          bankName: "BNU",
          bankAccount: `TL-${emp.jobDetails.employeeId}`,
          createdAt: serverTimestamp(),
        });
        success++;
      }
      addLog(`✓ Payroll run created with ${EMPLOYEES.length} payslips`);
    } catch (err) {
      failed++;
      addLog(`✗ Payroll: ${err}`);
    }
    return { success, failed };
  };

  const seedAccounting = async () => {
    let success = 0, failed = 0;

    // Seed Chart of Accounts (root level - not tenant-scoped)
    addLog("Creating Chart of Accounts...");
    for (const account of CHART_OF_ACCOUNTS) {
      try {
        const docRef = doc(collection(db!, "accounts"));
        await setDoc(docRef, {
          id: docRef.id,
          ...account,
          balance: 0,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
      } catch (err) {
        failed++;
      }
    }
    addLog(`✓ Chart of Accounts: ${success} accounts created`);

    // Create sample journal entries
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const thisMonth = new Date(currentYear, currentMonth, 1);

    const journalEntries = [
      // Opening balance entry
      {
        date: new Date(currentYear, 0, 1),
        reference: `OB-${currentYear}-001`,
        description: `Opening Balances for ${currentYear}`,
        source: "opening",
        lines: [
          { accountCode: "1210", accountName: "BNU Operating Account", debit: 500000, credit: 0 },
          { accountCode: "1220", accountName: "BNU Payroll Account", debit: 100000, credit: 0 },
          { accountCode: "1510", accountName: "Office Equipment", debit: 85000, credit: 0 },
          { accountCode: "1520", accountName: "Vehicles", debit: 150000, credit: 0 },
          { accountCode: "3100", accountName: "Share Capital", debit: 0, credit: 500000 },
          { accountCode: "3200", accountName: "Retained Earnings", debit: 0, credit: 335000 },
        ],
      },
      // Payroll expense entry
      {
        date: thisMonth,
        reference: `PAY-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`,
        description: `Payroll for ${thisMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        source: "payroll",
        lines: [
          { accountCode: "5110", accountName: "Wages & Salaries", debit: 293000, credit: 0 },
          { accountCode: "5200", accountName: "INSS Employer Expense", debit: 17580, credit: 0 },
          { accountCode: "2200", accountName: "Salaries Payable", debit: 0, credit: 264540 },
          { accountCode: "2300", accountName: "IRPS Payable", debit: 0, credit: 28750 },
          { accountCode: "2410", accountName: "INSS Employee Payable", debit: 0, credit: 11720 },
          { accountCode: "2420", accountName: "INSS Employer Payable", debit: 0, credit: 17580 },
        ],
      },
      // Rent expense
      {
        date: thisMonth,
        reference: `EXP-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-001`,
        description: "Monthly Office Rent - Dili Head Office",
        source: "expense",
        lines: [
          { accountCode: "5300", accountName: "Rent Expense", debit: 8500, credit: 0 },
          { accountCode: "1210", accountName: "BNU Operating Account", debit: 0, credit: 8500 },
        ],
      },
      // Utilities
      {
        date: thisMonth,
        reference: `EXP-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-002`,
        description: "EDTL Electricity Bill",
        source: "expense",
        lines: [
          { accountCode: "5410", accountName: "Electricity (EDTL)", debit: 2400, credit: 0 },
          { accountCode: "1210", accountName: "BNU Operating Account", debit: 0, credit: 2400 },
        ],
      },
      // Internet
      {
        date: thisMonth,
        reference: `EXP-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-003`,
        description: "Telkomcel Internet Service",
        source: "expense",
        lines: [
          { accountCode: "5430", accountName: "Internet & Phone", debit: 850, credit: 0 },
          { accountCode: "1210", accountName: "BNU Operating Account", debit: 0, credit: 850 },
        ],
      },
      // Service revenue
      {
        date: thisMonth,
        reference: `REV-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-001`,
        description: "Consulting Services - December 2025",
        source: "revenue",
        lines: [
          { accountCode: "1300", accountName: "Accounts Receivable", debit: 75000, credit: 0 },
          { accountCode: "4100", accountName: "Service Revenue", debit: 0, credit: 75000 },
        ],
      },
      // Payment from client
      {
        date: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 15),
        reference: `REC-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-001`,
        description: "Payment received from Client - INV-2025-042",
        source: "receipt",
        lines: [
          { accountCode: "1210", accountName: "BNU Operating Account", debit: 45000, credit: 0 },
          { accountCode: "1300", accountName: "Accounts Receivable", debit: 0, credit: 45000 },
        ],
      },
      // Payroll disbursement
      {
        date: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 25),
        reference: `PMT-${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-001`,
        description: `Salary payment for ${thisMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        source: "payment",
        lines: [
          { accountCode: "2200", accountName: "Salaries Payable", debit: 264540, credit: 0 },
          { accountCode: "1220", accountName: "BNU Payroll Account", debit: 0, credit: 264540 },
        ],
      },
    ];

    addLog("Creating Journal Entries...");
    for (const entry of journalEntries) {
      try {
        const docRef = doc(collection(db!, "journalEntries"));
        const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);

        await setDoc(docRef, {
          id: docRef.id,
          ...entry,
          date: entry.date.toISOString().split('T')[0],
          fiscalYear: entry.date.getFullYear(),
          fiscalPeriod: entry.date.getMonth() + 1,
          entryNumber: entry.reference,
          totalDebit,
          totalCredit,
          isBalanced: totalDebit === totalCredit,
          status: "posted",
          postedAt: serverTimestamp(),
          postedBy: "System",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Journal Entry: ${entry.reference}`);
      } catch (err) {
        failed++;
        addLog(`✗ Journal Entry ${entry.reference}: ${err}`);
      }
    }

    // Create fiscal periods (root level - not tenant-scoped)
    addLog("Creating Fiscal Periods...");
    for (let month = 0; month < 12; month++) {
      try {
        const startDate = new Date(currentYear, month, 1);
        const endDate = new Date(currentYear, month + 1, 0);
        const periodKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;

        const docRef = doc(db!, "fiscalPeriods", periodKey);
        await setDoc(docRef, {
          id: periodKey,
          year: currentYear,
          month: month + 1,
          name: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          status: month < new Date().getMonth() ? "closed" : (month === new Date().getMonth() ? "open" : "future"),
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err) {
        failed++;
      }
    }
    addLog(`✓ Fiscal periods created for ${currentYear}`);

    return { success, failed };
  };

  // Main seed function
  const handleSeedAll = async () => {
    if (!tenantId) {
      setError("No tenant selected. Please complete admin setup first.");
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);
    setResults(null);
    setProgress(0);

    const totalSteps = Object.values(options).filter(Boolean).length;
    let completedSteps = 0;

    const newResults: Record<string, { success: number; failed: number }> = {};

    try {
      addLog("🚀 Starting database seeding...");
      addLog(`Tenant: ${tenantId}`);

      if (options.departments) {
        setCurrentTask("Seeding departments...");
        newResults.departments = await seedDepartments();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.positions) {
        setCurrentTask("Seeding positions...");
        newResults.positions = await seedPositions();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.employees) {
        setCurrentTask("Seeding employees...");
        newResults.employees = await seedEmployees();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.jobs) {
        setCurrentTask("Seeding jobs...");
        newResults.jobs = await seedJobs();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.candidates) {
        setCurrentTask("Seeding candidates...");
        newResults.candidates = await seedCandidates();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.leaveRequests) {
        setCurrentTask("Seeding leave requests...");
        newResults.leaveRequests = await seedLeaveRequests();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.attendance) {
        setCurrentTask("Seeding attendance...");
        newResults.attendance = await seedAttendance();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.goals) {
        setCurrentTask("Seeding goals...");
        newResults.goals = await seedGoals();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.reviews) {
        setCurrentTask("Seeding reviews...");
        newResults.reviews = await seedReviews();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.training) {
        setCurrentTask("Seeding training...");
        newResults.training = await seedTraining();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.payroll) {
        setCurrentTask("Seeding payroll...");
        newResults.payroll = await seedPayroll();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      if (options.accounting) {
        setCurrentTask("Seeding accounting...");
        newResults.accounting = await seedAccounting();
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }

      setResults(newResults);
      setCurrentTask("");
      addLog("✅ Database seeding complete!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      addLog(`❌ Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    setOptions(Object.fromEntries(Object.keys(options).map((k) => [k, true])) as typeof options);
  };

  const selectNone = () => {
    setOptions(Object.fromEntries(Object.keys(options).map((k) => [k, false])) as typeof options);
  };

  const optionConfig = [
    { key: "departments" as const, label: "Departments", icon: Building, count: DEPARTMENTS.length },
    { key: "positions" as const, label: "Positions", icon: Briefcase, count: POSITIONS.length },
    { key: "employees" as const, label: "Employees", icon: Users, count: EMPLOYEES.length },
    { key: "jobs" as const, label: "Jobs", icon: FileText, count: JOBS.length },
    { key: "candidates" as const, label: "Candidates", icon: UserCheck, count: CANDIDATES.length },
    { key: "leaveRequests" as const, label: "Leave Requests", icon: Calendar, count: 20 },
    { key: "attendance" as const, label: "Attendance", icon: Clock, count: "~500" },
    { key: "goals" as const, label: "Goals & OKRs", icon: Target, count: EMPLOYEES.length * 3 },
    { key: "reviews" as const, label: "Reviews", icon: Star, count: EMPLOYEES.length },
    { key: "training" as const, label: "Training Courses", icon: GraduationCap, count: TRAINING_COURSES.length },
    { key: "payroll" as const, label: "Payroll Run", icon: DollarSign, count: EMPLOYEES.length },
    { key: "accounting" as const, label: "Accounting", icon: Calculator, count: `${CHART_OF_ACCOUNTS.length} + 8 + 12` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Seed Database</h1>
            <p className="text-muted-foreground">
              Populate Firestore with comprehensive sample data for Timor-Leste
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Options Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select Data to Seed</CardTitle>
                  <CardDescription>Choose which types of data to populate</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>Clear All</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {optionConfig.map(({ key, label, icon: Icon, count }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      options[key] ? "bg-primary/5 border-primary" : "bg-muted/30 border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={options[key]}
                      onCheckedChange={() => toggleOption(key)}
                    />
                    <Icon className={`h-5 w-5 ${options[key] ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{count} records</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action */}
          <Card>
            <CardHeader>
              <CardTitle>Execute Seeding</CardTitle>
              <CardDescription>
                {tenantId ? `Data will be created in tenant: ${tenantId}` : "⚠️ No tenant selected"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{currentTask}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button
                onClick={handleSeedAll}
                disabled={loading || !tenantId || !Object.values(options).some(Boolean)}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Seeding Database...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Seed Selected Data
                  </>
                )}
              </Button>

              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Seeding Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(results).map(([key, { success, failed }]) => (
                    <div key={key} className="p-4 bg-muted/30 rounded-lg">
                      <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-green-600">{success} added</p>
                      {failed > 0 && <p className="text-red-600">{failed} failed</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm max-h-80 overflow-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="py-0.5">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
