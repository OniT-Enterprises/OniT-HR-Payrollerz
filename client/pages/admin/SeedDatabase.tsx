import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Database, Users, Building, CheckCircle, Loader2, AlertCircle,
  Briefcase, UserCheck, Calendar, Clock, Target, GraduationCap,
  DollarSign, FileText, Star, Calculator, ClipboardCheck, Copy, Download,
  Wallet, Trash2
} from "lucide-react";
import { collection, doc, setDoc, serverTimestamp, Timestamp, getDocs, deleteDoc, type DocumentData } from "firebase/firestore";
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

// Money Module Data - Timorese businesses
const CUSTOMERS = [
  { name: "Hotel Timor", email: "finance@hoteltimor.tl", phone: "+670-331-2345", address: "Av. Presidente Nicolau Lobato, Dili", taxId: "TL-100234567", contactPerson: "João Amaral", paymentTerms: 30 },
  { name: "Kmanek Trading", email: "accounts@kmanek.tl", phone: "+670-331-3456", address: "Rua de Colmera, Dili", taxId: "TL-100345678", contactPerson: "Maria Soares", paymentTerms: 15 },
  { name: "Timor Plaza", email: "procurement@timorplaza.tl", phone: "+670-331-4567", address: "Comoro, Dili", taxId: "TL-100456789", contactPerson: "António Guterres", paymentTerms: 30 },
  { name: "Ministério das Finanças", email: "procurement@mof.gov.tl", phone: "+670-331-5678", address: "Palácio do Governo, Dili", taxId: "GOV-001", contactPerson: "Rosa Ximenes", paymentTerms: 45 },
  { name: "UNTL (Universidade Nacional)", email: "finance@untl.edu.tl", phone: "+670-331-6789", address: "Hera Campus, Dili", taxId: "EDU-001", contactPerson: "Dr. Manuel Tilman", paymentTerms: 30 },
  { name: "Cruz Vermelha Timor-Leste", email: "admin@redcross.tl", phone: "+670-331-7890", address: "Farol, Dili", taxId: "NGO-001", contactPerson: "Filomena Costa", paymentTerms: 30 },
  { name: "Banco Nacional Ultramarino", email: "operations@bnu.tl", phone: "+670-331-8901", address: "Av. Marginal, Dili", taxId: "TL-100567890", contactPerson: "Pedro Fernandes", paymentTerms: 15 },
  { name: "Dili Beach Hotel", email: "accounts@dilibeach.tl", phone: "+670-331-9012", address: "Areia Branca, Dili", taxId: "TL-100678901", contactPerson: "Lucia Correia", paymentTerms: 30 },
];

const VENDORS = [
  { name: "EDTL (Eletricidade de Timor-Leste)", email: "billing@edtl.tl", phone: "+670-331-1111", address: "Caicoli, Dili", taxId: "GOV-EDTL-001", contactPerson: "Billing Dept", paymentTerms: 15 },
  { name: "Timor Telecom", email: "corporate@timortelecom.tl", phone: "+670-331-2222", address: "Colmera, Dili", taxId: "TL-200123456", contactPerson: "Corporate Sales", paymentTerms: 30 },
  { name: "Lita Store Wholesale", email: "orders@litastore.tl", phone: "+670-331-3333", address: "Becora, Dili", taxId: "TL-200234567", contactPerson: "Domingos Lita", paymentTerms: 15 },
  { name: "Dili Office Supplies", email: "sales@dilisupplies.tl", phone: "+670-331-4444", address: "Audian, Dili", taxId: "TL-200345678", contactPerson: "Ana Martins", paymentTerms: 30 },
  { name: "Timor Fuels", email: "accounts@timorfuels.tl", phone: "+670-331-5555", address: "Comoro, Dili", taxId: "TL-200456789", contactPerson: "José Pereira", paymentTerms: 7 },
  { name: "Naroman IT Solutions", email: "invoices@naroman.tl", phone: "+670-331-6666", address: "Farol, Dili", taxId: "TL-200567890", contactPerson: "Tony Franklin", paymentTerms: 30 },
  { name: "Mega Cleaning Services", email: "billing@megaclean.tl", phone: "+670-331-7777", address: "Taibesi, Dili", taxId: "TL-200678901", contactPerson: "Rosa Soares", paymentTerms: 15 },
  { name: "Tiger Security TL", email: "accounts@tigersecurity.tl", phone: "+670-331-8888", address: "Bidau, Dili", taxId: "TL-200789012", contactPerson: "Carlos Mendes", paymentTerms: 30 },
];

const INVOICES = [
  { invoiceNumber: "INV-2026-001", customerIdx: 0, items: [{ description: "IT Consulting Services - January", quantity: 1, unitPrice: 5000 }], status: "paid", issueDate: "2026-01-05", dueDate: "2026-02-04", paidAmount: 5000 },
  { invoiceNumber: "INV-2026-002", customerIdx: 1, items: [{ description: "Software Development - Phase 1", quantity: 1, unitPrice: 12000 }, { description: "Project Management", quantity: 20, unitPrice: 150 }], status: "paid", issueDate: "2026-01-08", dueDate: "2026-01-23", paidAmount: 15000 },
  { invoiceNumber: "INV-2026-003", customerIdx: 2, items: [{ description: "POS System Installation", quantity: 5, unitPrice: 800 }, { description: "Training Sessions", quantity: 3, unitPrice: 500 }], status: "partial", issueDate: "2026-01-10", dueDate: "2026-02-09", paidAmount: 3000 },
  { invoiceNumber: "INV-2026-004", customerIdx: 3, items: [{ description: "Government Portal Development", quantity: 1, unitPrice: 45000 }], status: "sent", issueDate: "2026-01-12", dueDate: "2026-02-26", paidAmount: 0 },
  { invoiceNumber: "INV-2026-005", customerIdx: 4, items: [{ description: "Student Management System", quantity: 1, unitPrice: 25000 }, { description: "Annual Maintenance", quantity: 1, unitPrice: 5000 }], status: "sent", issueDate: "2026-01-14", dueDate: "2026-02-13", paidAmount: 0 },
  { invoiceNumber: "INV-2026-006", customerIdx: 5, items: [{ description: "Volunteer Management App", quantity: 1, unitPrice: 8000 }], status: "draft", issueDate: "2026-01-15", dueDate: "2026-02-14", paidAmount: 0 },
  { invoiceNumber: "INV-2026-007", customerIdx: 6, items: [{ description: "Security Audit Services", quantity: 1, unitPrice: 15000 }, { description: "Compliance Report", quantity: 1, unitPrice: 3000 }], status: "overdue", issueDate: "2025-12-01", dueDate: "2025-12-16", paidAmount: 0 },
  { invoiceNumber: "INV-2026-008", customerIdx: 7, items: [{ description: "Booking System Integration", quantity: 1, unitPrice: 7500 }], status: "sent", issueDate: "2026-01-16", dueDate: "2026-02-15", paidAmount: 0 },
];

const BILLS = [
  { billNumber: "EDTL-JAN-2026", vendorIdx: 0, items: [{ description: "Electricity - January 2026", quantity: 1, unitPrice: 2400 }], status: "paid", issueDate: "2026-01-02", dueDate: "2026-01-17", paidAmount: 2400 },
  { billNumber: "TT-2026-0015", vendorIdx: 1, items: [{ description: "Internet & Phone - January", quantity: 1, unitPrice: 850 }], status: "paid", issueDate: "2026-01-05", dueDate: "2026-02-04", paidAmount: 850 },
  { billNumber: "LITA-INV-4521", vendorIdx: 2, items: [{ description: "Office Supplies Q1", quantity: 1, unitPrice: 1200 }, { description: "Cleaning Supplies", quantity: 1, unitPrice: 350 }], status: "pending", issueDate: "2026-01-08", dueDate: "2026-01-23", paidAmount: 0 },
  { billNumber: "DOS-2026-089", vendorIdx: 3, items: [{ description: "Printer Cartridges", quantity: 10, unitPrice: 45 }, { description: "Paper A4 (boxes)", quantity: 20, unitPrice: 25 }], status: "pending", issueDate: "2026-01-10", dueDate: "2026-02-09", paidAmount: 0 },
  { billNumber: "TF-2026-0234", vendorIdx: 4, items: [{ description: "Vehicle Fuel - January", quantity: 500, unitPrice: 1.45 }], status: "paid", issueDate: "2026-01-15", dueDate: "2026-01-22", paidAmount: 725 },
  { billNumber: "NIT-2026-012", vendorIdx: 5, items: [{ description: "Cloud Hosting - Q1 2026", quantity: 3, unitPrice: 500 }, { description: "Domain Renewals", quantity: 5, unitPrice: 30 }], status: "pending", issueDate: "2026-01-12", dueDate: "2026-02-11", paidAmount: 0 },
  { billNumber: "MCS-JAN-2026", vendorIdx: 6, items: [{ description: "Office Cleaning - January", quantity: 1, unitPrice: 800 }], status: "pending", issueDate: "2026-01-31", dueDate: "2026-02-15", paidAmount: 0 },
  { billNumber: "TSG-2026-0089", vendorIdx: 7, items: [{ description: "Security Services - January", quantity: 1, unitPrice: 2500 }], status: "overdue", issueDate: "2025-12-31", dueDate: "2026-01-30", paidAmount: 0 },
];

const EXPENSES = [
  { date: "2026-01-05", category: "Travel", description: "Taxi to client meeting - Hotel Timor", amount: 15, paymentMethod: "Cash", reference: "EXP-001" },
  { date: "2026-01-08", category: "Meals", description: "Team lunch - project kickoff", amount: 85, paymentMethod: "Company Card", reference: "EXP-002" },
  { date: "2026-01-10", category: "Office Supplies", description: "Whiteboard markers and sticky notes", amount: 25, paymentMethod: "Petty Cash", reference: "EXP-003" },
  { date: "2026-01-12", category: "Travel", description: "Flight to Baucau - client site visit", amount: 120, paymentMethod: "Bank Transfer", reference: "EXP-004" },
  { date: "2026-01-12", category: "Accommodation", description: "Hotel in Baucau - 2 nights", amount: 180, paymentMethod: "Company Card", reference: "EXP-005" },
  { date: "2026-01-15", category: "Software", description: "Annual subscription - design tools", amount: 299, paymentMethod: "Company Card", reference: "EXP-006" },
  { date: "2026-01-16", category: "Training", description: "Online course - cloud certification", amount: 450, paymentMethod: "Bank Transfer", reference: "EXP-007" },
];

// ============================================
// COMPONENT
// ============================================

// Production safety check - NEVER allow seeding/clearing in production
const PRODUCTION_HOSTNAMES = ['payroll.naroman.tl', 'app.onithr.com', 'onithr.com'];
const PRODUCTION_PROJECT_IDS = ['onit-hr-payroll']; // Add production project IDs here

function isProductionEnvironment(): boolean {
  // Check hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (PRODUCTION_HOSTNAMES.some(h => hostname.includes(h))) {
      return true;
    }
  }
  // Check Firebase project ID from config
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (projectId && PRODUCTION_PROJECT_IDS.includes(projectId)) {
    return true;
  }
  return false;
}

export default function SeedDatabase() {
  const { session } = useTenant();
  const tenantId = session?.tid;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [results, setResults] = useState<Record<string, { success: number; failed: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Audit state
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [auditSummary, setAuditSummary] = useState<{
    passed: boolean;
    totalInvoiced: number;
    totalCollected: number;
    outstandingAR: number;
    totalBilled: number;
    totalPaidBills: number;
    outstandingAP: number;
    totalExpenses: number;
    issues: string[];
  } | null>(null);

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
    money: true,
  });

  const [clearing, setClearing] = useState(false);

  // CRITICAL: Block access in production environment
  if (isProductionEnvironment()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Access Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Seed Database feature is disabled in production environments
              for data safety. This page is only available in development.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const getCollectionPath = (collectionName: string) => {
    if (!tenantId) return collectionName; // Fallback to root collection
    return `tenants/${tenantId}/${collectionName}`;
  };

  // Clear all data function
  const clearAllData = async () => {
    if (!tenantId) return;
    if (!confirm("⚠️ This will DELETE ALL DATA for this tenant. Are you sure?")) return;

    setClearing(true);
    setLogs([]);
    addLog("🗑️ Starting data cleanup...");

    const tenantCollections = [
      "departments", "positions", "employees", "jobs", "candidates",
      "leaveRequests", "timesheets", "goals", "reviews", "trainings",
      "payruns", "customers", "vendors", "invoices", "bills", "expenses",
      "payments_received", "bill_payments"
    ];

    const rootCollections = ["accounts", "journalEntries", "generalLedger", "fiscalPeriods"];

    try {
      // Clear tenant-scoped collections
      for (const collName of tenantCollections) {
        const collRef = collection(db!, getCollectionPath(collName));
        const snapshot = await getDocs(collRef);
        let deleted = 0;
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db!, getCollectionPath(collName), docSnap.id));
          deleted++;
        }
        if (deleted > 0) addLog(`✓ Cleared ${collName}: ${deleted} docs`);
      }

      // Clear root collections (accounting)
      for (const collName of rootCollections) {
        const collRef = collection(db!, collName);
        const snapshot = await getDocs(collRef);
        let deleted = 0;
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db!, collName, docSnap.id));
          deleted++;
        }
        if (deleted > 0) addLog(`✓ Cleared ${collName}: ${deleted} docs`);
      }

      addLog("✅ All data cleared successfully!");
    } catch (err) {
      addLog(`❌ Error clearing data: ${err}`);
    } finally {
      setClearing(false);
    }
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
      } catch {
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
        } catch {
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
        } catch {
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
      } catch {
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
      } catch {
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
      } catch {
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

        const entryDate = entry.date.toISOString().split('T')[0];
        const fiscalYear = entry.date.getFullYear();
        const fiscalPeriod = entry.date.getMonth() + 1;

        await setDoc(docRef, {
          id: docRef.id,
          ...entry,
          date: entryDate,
          fiscalYear,
          fiscalPeriod,
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

        // Create general ledger entries for each line
        for (const line of entry.lines) {
          const glRef = doc(collection(db!, "generalLedger"));
          await setDoc(glRef, {
            id: glRef.id,
            accountId: line.accountCode, // Using code as ID for now
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: docRef.id,
            entryNumber: entry.reference,
            entryDate,
            description: entry.description,
            debit: line.debit,
            credit: line.credit,
            balance: 0,
            fiscalYear,
            fiscalPeriod,
            createdAt: serverTimestamp(),
          });
        }

        success++;
        addLog(`✓ Journal Entry: ${entry.reference} (${entry.lines.length} GL entries)`);
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
      } catch {
        failed++;
      }
    }
    addLog(`✓ Fiscal periods created for ${currentYear}`);

    return { success, failed };
  };

  const seedMoney = async () => {
    let success = 0, failed = 0;
    const customerIds: string[] = [];
    const vendorIds: string[] = [];

    // Seed Customers
    addLog("Creating Customers...");
    for (const cust of CUSTOMERS) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("customers")));
        await setDoc(docRef, {
          id: docRef.id,
          ...cust,
          isActive: true,
          totalInvoiced: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        customerIds.push(docRef.id);
        success++;
        addLog(`✓ Customer: ${cust.name}`);
      } catch (err) {
        failed++;
        customerIds.push(""); // placeholder
        addLog(`✗ Customer ${cust.name}: ${err}`);
      }
    }

    // Seed Vendors
    addLog("Creating Vendors...");
    for (const vendor of VENDORS) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("vendors")));
        await setDoc(docRef, {
          id: docRef.id,
          ...vendor,
          isActive: true,
          totalBilled: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        vendorIds.push(docRef.id);
        success++;
        addLog(`✓ Vendor: ${vendor.name}`);
      } catch (err) {
        failed++;
        vendorIds.push(""); // placeholder
        addLog(`✗ Vendor ${vendor.name}: ${err}`);
      }
    }

    // Seed Invoices
    addLog("Creating Invoices...");
    for (const inv of INVOICES) {
      try {
        const customer = CUSTOMERS[inv.customerIdx];
        const customerId = customerIds[inv.customerIdx];
        const subtotal = inv.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const total = subtotal; // No tax for simplicity

        const docRef = doc(collection(db!, getCollectionPath("invoices")));
        await setDoc(docRef, {
          id: docRef.id,
          invoiceNumber: inv.invoiceNumber,
          customerId,
          customerName: customer.name,
          customerEmail: customer.email,
          items: inv.items.map(item => ({
            ...item,
            amount: item.quantity * item.unitPrice,
          })),
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          total,
          amountPaid: inv.paidAmount,
          balanceDue: total - inv.paidAmount,
          status: inv.status,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Invoice: ${inv.invoiceNumber} - $${total}`);

        // Create payment record if paid
        if (inv.paidAmount > 0) {
          const payRef = doc(collection(db!, getCollectionPath("payments_received")));
          await setDoc(payRef, {
            id: payRef.id,
            invoiceId: docRef.id,
            invoiceNumber: inv.invoiceNumber,
            customerId,
            customerName: customer.name,
            amount: inv.paidAmount,
            paymentMethod: "Bank Transfer",
            date: inv.issueDate,
            reference: `PAY-${inv.invoiceNumber}`,
            notes: "",
            createdAt: serverTimestamp(),
          });
          success++;
        }
      } catch (err) {
        failed++;
        addLog(`✗ Invoice ${inv.invoiceNumber}: ${err}`);
      }
    }

    // Seed Bills
    addLog("Creating Bills...");
    for (const bill of BILLS) {
      try {
        const vendor = VENDORS[bill.vendorIdx];
        const vendorId = vendorIds[bill.vendorIdx];
        const subtotal = bill.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const total = subtotal;

        const docRef = doc(collection(db!, getCollectionPath("bills")));
        await setDoc(docRef, {
          id: docRef.id,
          billNumber: bill.billNumber,
          vendorId,
          vendorName: vendor.name,
          items: bill.items.map(item => ({
            ...item,
            amount: item.quantity * item.unitPrice,
          })),
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          total,
          amountPaid: bill.paidAmount,
          balanceDue: total - bill.paidAmount,
          status: bill.status,
          issueDate: bill.issueDate,
          dueDate: bill.dueDate,
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Bill: ${bill.billNumber} - $${total}`);

        // Create payment record if paid
        if (bill.paidAmount > 0) {
          const payRef = doc(collection(db!, getCollectionPath("bill_payments")));
          await setDoc(payRef, {
            id: payRef.id,
            billId: docRef.id,
            billNumber: bill.billNumber,
            vendorId,
            vendorName: vendor.name,
            amount: bill.paidAmount,
            paymentMethod: "Bank Transfer",
            date: bill.issueDate,
            reference: `BPAY-${bill.billNumber}`,
            notes: "",
            createdAt: serverTimestamp(),
          });
          success++;
        }
      } catch (err) {
        failed++;
        addLog(`✗ Bill ${bill.billNumber}: ${err}`);
      }
    }

    // Seed Expenses
    addLog("Creating Expenses...");
    for (const exp of EXPENSES) {
      try {
        const docRef = doc(collection(db!, getCollectionPath("expenses")));
        await setDoc(docRef, {
          id: docRef.id,
          ...exp,
          status: "approved",
          approvedBy: "System",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        success++;
        addLog(`✓ Expense: ${exp.reference} - $${exp.amount}`);
      } catch (err) {
        failed++;
        addLog(`✗ Expense ${exp.reference}: ${err}`);
      }
    }

    addLog(`✓ Money module seeded: ${CUSTOMERS.length} customers, ${VENDORS.length} vendors, ${INVOICES.length} invoices, ${BILLS.length} bills, ${EXPENSES.length} expenses`);
    return { success, failed };
  };

  // Data Audit Function
  const runDataAudit = async () => {
    if (!tenantId) return;

    setAuditLoading(true);
    setAuditReport(null);
    setAuditSummary(null);

    try {
      const fmt = (n: number) => `$${(n || 0).toFixed(2).padStart(12)}`;
      const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

      // Fetch all data
      const [invoicesSnap, paymentsSnap, billsSnap, billPaymentsSnap, expensesSnap, customersSnap, vendorsSnap, employeesSnap] = await Promise.all([
        getDocs(collection(db!, `tenants/${tenantId}/invoices`)),
        getDocs(collection(db!, `tenants/${tenantId}/payments_received`)),
        getDocs(collection(db!, `tenants/${tenantId}/bills`)),
        getDocs(collection(db!, `tenants/${tenantId}/bill_payments`)),
        getDocs(collection(db!, `tenants/${tenantId}/expenses`)),
        getDocs(collection(db!, `tenants/${tenantId}/customers`)),
        getDocs(collection(db!, `tenants/${tenantId}/vendors`)),
        getDocs(collection(db!, `tenants/${tenantId}/employees`)),
      ]);

      type DocWithId = DocumentData & { id: string };
      const invoices: DocWithId[] = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const paymentsReceived: DocWithId[] = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const bills: DocWithId[] = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const billPayments: DocWithId[] = billPaymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const expenses: DocWithId[] = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const customers: DocWithId[] = customersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const vendors: DocWithId[] = vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const employees: DocWithId[] = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let report = '';
      report += '═'.repeat(100) + '\n';
      report += '  ONIT HR/PAYROLL SYSTEM - COMPREHENSIVE DATA AUDIT REPORT\n';
      report += `  Generated: ${new Date().toISOString()}\n`;
      report += `  Tenant: ${tenantId}\n`;
      report += '═'.repeat(100) + '\n\n';

      // CALCULATION RULES
      report += '┌' + '─'.repeat(98) + '┐\n';
      report += '│  CALCULATION RULES & FORMULAS                                                                    │\n';
      report += '├' + '─'.repeat(98) + '┤\n';
      report += '│  INVOICE CALCULATIONS:                                                                           │\n';
      report += '│    • Subtotal = SUM(item.quantity × item.unitPrice) for all line items                           │\n';
      report += '│    • Tax Amount = Subtotal × Tax Rate (currently 0% for TL)                                      │\n';
      report += '│    • Total = Subtotal + Tax Amount                                                               │\n';
      report += '│    • Balance Due = Total - Amount Paid                                                           │\n';
      report += '│    • Status: draft→sent→partial(if paid<total)→paid(if paid=total)→overdue(if past due)         │\n';
      report += '├' + '─'.repeat(98) + '┤\n';
      report += '│  BILL CALCULATIONS:                                                                              │\n';
      report += '│    • Subtotal = SUM(item.quantity × item.unitPrice) for all line items                           │\n';
      report += '│    • Total = Subtotal (no tax on bills typically)                                                │\n';
      report += '│    • Balance Due = Total - Amount Paid                                                           │\n';
      report += '│    • Status: pending→partial(if paid<total)→paid(if paid=total)→overdue(if past due)            │\n';
      report += '├' + '─'.repeat(98) + '┤\n';
      report += '│  PAYROLL CALCULATIONS (Timor-Leste):                                                             │\n';
      report += '│    • IRPS Tax = (Gross - $500) × 10% if Gross > $500, else $0                                    │\n';
      report += '│    • INSS Employee = Gross × 4%                                                                  │\n';
      report += '│    • INSS Employer = Gross × 6%                                                                  │\n';
      report += '│    • Net Pay = Gross - IRPS - INSS Employee                                                      │\n';
      report += '│    • 13th Month (Subsidio Anual) = Monthly Salary (paid in December)                             │\n';
      report += '├' + '─'.repeat(98) + '┤\n';
      report += '│  VERIFICATION RULES:                                                                             │\n';
      report += '│    • Outstanding AR = Total Invoiced - Total Collected (excl. drafts, must match balances)       │\n';
      report += '│    • Outstanding AP = Total Billed - Total Paid (must match sum of bill balances)                │\n';
      report += '│    • Invoice amountPaid must equal sum of related payments_received                              │\n';
      report += '│    • Bill amountPaid must equal sum of related bill_payments                                     │\n';
      report += '└' + '─'.repeat(98) + '┘\n\n';

      // INVOICES SECTION
      let totalInvoiced = 0, totalPaidInvoices = 0, totalOutstandingAR = 0;
      const invoiceIssues: string[] = [];

      report += '═'.repeat(100) + '\n';
      report += '  SECTION 1: INVOICES (ACCOUNTS RECEIVABLE) - DETAILED BREAKDOWN\n';
      report += '═'.repeat(100) + '\n\n';

      invoices.sort((a, b) => (a.invoiceNumber || '').localeCompare(b.invoiceNumber || ''));

      for (const inv of invoices) {
        const items = inv.items || [];
        const calcSubtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const storedSubtotal = inv.subtotal || 0;
        const storedTotal = inv.total || 0;
        const storedPaid = inv.amountPaid || 0;
        const storedBalance = inv.balanceDue || 0;
        const calcBalance = storedTotal - storedPaid;

        // Get payments for this invoice
        const invPayments = paymentsReceived.filter((p: any) => p.invoiceId === inv.id);
        const sumPayments = invPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        report += `  ┌─ ${inv.invoiceNumber || 'NO NUMBER'} ─────────────────────────────────────────────────────────────────\n`;
        report += `  │ Customer:    ${inv.customerName || 'Unknown'}\n`;
        report += `  │ Issue Date:  ${inv.issueDate || 'N/A'}    Due Date: ${inv.dueDate || 'N/A'}    Status: ${inv.status || 'N/A'}\n`;
        report += `  │\n`;
        report += `  │ LINE ITEMS:\n`;

        for (const item of items) {
          const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
          report += `  │   • ${(item.description || 'Item').substring(0, 40).padEnd(42)} ${String(item.quantity || 0).padStart(4)} × $${(item.unitPrice || 0).toFixed(2).padStart(10)} = ${fmt(lineTotal)}\n`;
        }

        report += `  │\n`;
        report += `  │ CALCULATIONS:\n`;
        report += `  │   Calculated Subtotal (Σ qty×price):   ${fmt(calcSubtotal)}\n`;
        report += `  │   Stored Subtotal:                     ${fmt(storedSubtotal)} ${Math.abs(calcSubtotal - storedSubtotal) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  │   Tax (${fmtPct(inv.taxRate || 0)}):                            ${fmt(inv.taxAmount || 0)}\n`;
        report += `  │   Stored Total:                        ${fmt(storedTotal)}\n`;
        report += `  │   Amount Paid:                         ${fmt(storedPaid)}\n`;
        report += `  │   Stored Balance Due:                  ${fmt(storedBalance)}\n`;
        report += `  │   Calculated Balance (Total-Paid):     ${fmt(calcBalance)} ${Math.abs(storedBalance - calcBalance) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  │\n`;
        report += `  │ PAYMENT VERIFICATION:\n`;
        report += `  │   Payments recorded: ${invPayments.length}\n`;
        for (const pay of invPayments) {
          report += `  │     • ${pay.date || 'N/A'} - ${pay.paymentMethod || 'Unknown'} - ${fmt(pay.amount || 0)} (ref: ${pay.reference || 'N/A'})\n`;
        }
        report += `  │   Sum of payments:                     ${fmt(sumPayments)} ${Math.abs(sumPayments - storedPaid) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  └${'─'.repeat(95)}\n\n`;

        // Only count non-draft invoices in AR totals (drafts not yet sent to customer)
        if (inv.status !== 'draft') {
          totalInvoiced += storedTotal;
          totalPaidInvoices += storedPaid;
          totalOutstandingAR += storedBalance;
        }

        // Track issues
        if (Math.abs(calcSubtotal - storedSubtotal) > 0.01) invoiceIssues.push(`${inv.invoiceNumber}: subtotal mismatch`);
        if (Math.abs(storedBalance - calcBalance) > 0.01) invoiceIssues.push(`${inv.invoiceNumber}: balance mismatch`);
        if (Math.abs(sumPayments - storedPaid) > 0.01) invoiceIssues.push(`${inv.invoiceNumber}: payment sum mismatch`);
      }

      const draftCount = invoices.filter((i: any) => i.status === 'draft').length;
      const postedCount = invoices.length - draftCount;
      report += '  ╔' + '═'.repeat(98) + '╗\n';
      report += `  ║  AR SUMMARY (excludes ${draftCount} draft invoice${draftCount !== 1 ? 's' : ''})                                                                 ║\n`;
      report += '  ╠' + '═'.repeat(98) + '╣\n';
      report += `  ║  Posted Invoices:${String(postedCount).padEnd(5)}    Total Invoiced: ${fmt(totalInvoiced).padEnd(15)}                                       ║\n`;
      report += `  ║  Paid Invoices:  ${String(invoices.filter((i: any) => i.status === 'paid').length).padEnd(5)}    Total Collected: ${fmt(totalPaidInvoices).padEnd(15)}                                      ║\n`;
      report += `  ║  Outstanding:    ${String(invoices.filter((i: any) => (i.balanceDue || 0) > 0 && i.status !== 'draft').length).padEnd(5)}    Outstanding AR:  ${fmt(totalOutstandingAR).padEnd(15)}                                       ║\n`;
      report += `  ║  Overdue:        ${String(invoices.filter((i: any) => i.status === 'overdue').length).padEnd(5)}                                                                             ║\n`;
      report += '  ╚' + '═'.repeat(98) + '╝\n\n';

      // BILLS SECTION
      let totalBilled = 0, totalPaidBills = 0, totalOutstandingAP = 0;
      const billIssues: string[] = [];

      report += '═'.repeat(100) + '\n';
      report += '  SECTION 2: BILLS (ACCOUNTS PAYABLE) - DETAILED BREAKDOWN\n';
      report += '═'.repeat(100) + '\n\n';

      bills.sort((a, b) => (a.billNumber || '').localeCompare(b.billNumber || ''));

      for (const bill of bills) {
        const items = bill.items || [];
        const calcSubtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
        const storedSubtotal = bill.subtotal || 0;
        const storedTotal = bill.total || 0;
        const storedPaid = bill.amountPaid || 0;
        const storedBalance = bill.balanceDue || 0;
        const calcBalance = storedTotal - storedPaid;

        const billPays = billPayments.filter((p: any) => p.billId === bill.id);
        const sumPayments = billPays.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        report += `  ┌─ ${bill.billNumber || 'NO NUMBER'} ─────────────────────────────────────────────────────────────\n`;
        report += `  │ Vendor:      ${bill.vendorName || 'Unknown'}\n`;
        report += `  │ Issue Date:  ${bill.issueDate || 'N/A'}    Due Date: ${bill.dueDate || 'N/A'}    Status: ${bill.status || 'N/A'}\n`;
        report += `  │\n`;
        report += `  │ LINE ITEMS:\n`;

        for (const item of items) {
          const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
          report += `  │   • ${(item.description || 'Item').substring(0, 40).padEnd(42)} ${String(item.quantity || 0).padStart(4)} × $${(item.unitPrice || 0).toFixed(2).padStart(10)} = ${fmt(lineTotal)}\n`;
        }

        report += `  │\n`;
        report += `  │ CALCULATIONS:\n`;
        report += `  │   Calculated Subtotal:                 ${fmt(calcSubtotal)}\n`;
        report += `  │   Stored Subtotal:                     ${fmt(storedSubtotal)} ${Math.abs(calcSubtotal - storedSubtotal) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  │   Stored Total:                        ${fmt(storedTotal)}\n`;
        report += `  │   Amount Paid:                         ${fmt(storedPaid)}\n`;
        report += `  │   Stored Balance:                      ${fmt(storedBalance)}\n`;
        report += `  │   Calculated Balance:                  ${fmt(calcBalance)} ${Math.abs(storedBalance - calcBalance) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  │   Sum of payments:                     ${fmt(sumPayments)} ${Math.abs(sumPayments - storedPaid) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n`;
        report += `  └${'─'.repeat(95)}\n\n`;

        totalBilled += storedTotal;
        totalPaidBills += storedPaid;
        totalOutstandingAP += storedBalance;

        if (Math.abs(calcSubtotal - storedSubtotal) > 0.01) billIssues.push(`${bill.billNumber}: subtotal mismatch`);
        if (Math.abs(storedBalance - calcBalance) > 0.01) billIssues.push(`${bill.billNumber}: balance mismatch`);
        if (Math.abs(sumPayments - storedPaid) > 0.01) billIssues.push(`${bill.billNumber}: payment sum mismatch`);
      }

      report += '  ╔' + '═'.repeat(98) + '╗\n';
      report += `  ║  AP SUMMARY                                                                                      ║\n`;
      report += '  ╠' + '═'.repeat(98) + '╣\n';
      report += `  ║  Total Bills:    ${String(bills.length).padEnd(5)}    Total Billed:    ${fmt(totalBilled).padEnd(15)}                                       ║\n`;
      report += `  ║  Paid Bills:     ${String(bills.filter((b: any) => b.status === 'paid').length).padEnd(5)}    Total Paid:      ${fmt(totalPaidBills).padEnd(15)}                                       ║\n`;
      report += `  ║  Outstanding:    ${String(bills.filter((b: any) => ['pending', 'partial', 'overdue'].includes(b.status)).length).padEnd(5)}    Outstanding AP:  ${fmt(totalOutstandingAP).padEnd(15)}                                       ║\n`;
      report += `  ║  Overdue:        ${String(bills.filter((b: any) => b.status === 'overdue').length).padEnd(5)}                                                                             ║\n`;
      report += '  ╚' + '═'.repeat(98) + '╝\n\n';

      // EXPENSES
      let totalExpenses = 0;
      const expensesByCategory: Record<string, number> = {};

      report += '═'.repeat(100) + '\n';
      report += '  SECTION 3: EXPENSES\n';
      report += '═'.repeat(100) + '\n\n';

      for (const exp of expenses) {
        const amt = exp.amount || 0;
        totalExpenses += amt;
        expensesByCategory[exp.category || 'Uncategorized'] = (expensesByCategory[exp.category || 'Uncategorized'] || 0) + amt;
        report += `  ${(exp.date || '').padEnd(12)} ${(exp.category || '').padEnd(15)} ${(exp.description || '').substring(0, 40).padEnd(42)} ${fmt(amt)}\n`;
      }

      report += '\n  BY CATEGORY:\n';
      for (const [cat, amt] of Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])) {
        report += `    ${cat.padEnd(20)} ${fmt(amt)} (${fmtPct(amt / totalExpenses)})\n`;
      }
      report += `\n  TOTAL EXPENSES: ${fmt(totalExpenses)}\n\n`;

      // EMPLOYEE PAYROLL
      let totalMonthlySalary = 0, totalIRPS = 0, totalINSSEmp = 0, totalINSSEr = 0, totalNetPay = 0;

      report += '═'.repeat(100) + '\n';
      report += '  SECTION 4: EMPLOYEE PAYROLL CALCULATIONS\n';
      report += '═'.repeat(100) + '\n\n';

      report += `  ${'Employee'.padEnd(30)} ${'Gross'.padStart(12)} ${'IRPS'.padStart(12)} ${'INSS(4%)'.padStart(12)} ${'Net Pay'.padStart(12)} ${'INSS ER(6%)'.padStart(12)}\n`;
      report += '  ' + '-'.repeat(90) + '\n';

      for (const emp of employees) {
        const gross = emp.compensation?.monthlySalary || 0;
        const irps = gross > 500 ? (gross - 500) * 0.1 : 0;
        const inssEmp = gross * 0.04;
        const inssEr = gross * 0.06;
        const net = gross - irps - inssEmp;

        totalMonthlySalary += gross;
        totalIRPS += irps;
        totalINSSEmp += inssEmp;
        totalINSSEr += inssEr;
        totalNetPay += net;

        const name = `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim();
        report += `  ${name.padEnd(30)} ${fmt(gross)} ${fmt(irps)} ${fmt(inssEmp)} ${fmt(net)} ${fmt(inssEr)}\n`;
      }

      report += '  ' + '-'.repeat(90) + '\n';
      report += `  ${'MONTHLY TOTALS'.padEnd(30)} ${fmt(totalMonthlySalary)} ${fmt(totalIRPS)} ${fmt(totalINSSEmp)} ${fmt(totalNetPay)} ${fmt(totalINSSEr)}\n`;
      report += `  ${'ANNUAL (×12)'.padEnd(30)} ${fmt(totalMonthlySalary * 12)} ${fmt(totalIRPS * 12)} ${fmt(totalINSSEmp * 12)} ${fmt(totalNetPay * 12)} ${fmt(totalINSSEr * 12)}\n`;
      report += `  ${'ANNUAL (×13 w/ 13th month)'.padEnd(30)} ${fmt(totalMonthlySalary * 13)} ${fmt(totalIRPS * 13)} ${fmt(totalINSSEmp * 13)} ${fmt(totalNetPay * 13)} ${fmt(totalINSSEr * 13)}\n\n`;

      // ENTITY COUNTS
      report += '═'.repeat(100) + '\n';
      report += '  SECTION 5: ENTITY COUNTS & SUMMARY\n';
      report += '═'.repeat(100) + '\n\n';
      report += `  Customers:             ${String(customers.length).padStart(5)}\n`;
      report += `  Vendors:               ${String(vendors.length).padStart(5)}\n`;
      report += `  Employees:             ${String(employees.length).padStart(5)}\n`;
      report += `  Invoices:              ${String(invoices.length).padStart(5)}\n`;
      report += `  Bills:                 ${String(bills.length).padStart(5)}\n`;
      report += `  Expenses:              ${String(expenses.length).padStart(5)}\n`;
      report += `  Payments Received:     ${String(paymentsReceived.length).padStart(5)}\n`;
      report += `  Bill Payments:         ${String(billPayments.length).padStart(5)}\n\n`;

      // FINANCIAL SUMMARY
      report += '═'.repeat(100) + '\n';
      report += '  SECTION 6: FINANCIAL POSITION SUMMARY\n';
      report += '═'.repeat(100) + '\n\n';

      const calcOutstandingAR = totalInvoiced - totalPaidInvoices;
      const calcOutstandingAP = totalBilled - totalPaidBills;

      report += '  ACCOUNTS RECEIVABLE:\n';
      report += `    Total Invoiced:                      ${fmt(totalInvoiced)}\n`;
      report += `    Total Collected:                     ${fmt(totalPaidInvoices)}\n`;
      report += `    Outstanding AR (stored sum):         ${fmt(totalOutstandingAR)}\n`;
      report += `    Outstanding AR (calculated):         ${fmt(calcOutstandingAR)} ${Math.abs(totalOutstandingAR - calcOutstandingAR) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n\n`;

      report += '  ACCOUNTS PAYABLE:\n';
      report += `    Total Billed:                        ${fmt(totalBilled)}\n`;
      report += `    Total Paid:                          ${fmt(totalPaidBills)}\n`;
      report += `    Outstanding AP (stored sum):         ${fmt(totalOutstandingAP)}\n`;
      report += `    Outstanding AP (calculated):         ${fmt(calcOutstandingAP)} ${Math.abs(totalOutstandingAP - calcOutstandingAP) > 0.01 ? '⚠️ MISMATCH' : '✓'}\n\n`;

      report += '  NET POSITION:\n';
      report += `    Outstanding AR - Outstanding AP:     ${fmt(totalOutstandingAR - totalOutstandingAP)}\n`;
      report += `    Monthly Payroll Obligation:          ${fmt(totalMonthlySalary)}\n`;
      report += `    Monthly Net After Payroll:           ${fmt((totalOutstandingAR - totalOutstandingAP) - totalMonthlySalary)}\n\n`;

      // VERIFICATION RESULTS
      const issues: string[] = [...invoiceIssues, ...billIssues];

      if (Math.abs(totalOutstandingAR - calcOutstandingAR) > 0.01) {
        issues.push(`AR mismatch: stored ${totalOutstandingAR.toFixed(2)} vs calc ${calcOutstandingAR.toFixed(2)}`);
      }
      if (Math.abs(totalOutstandingAP - calcOutstandingAP) > 0.01) {
        issues.push(`AP mismatch: stored ${totalOutstandingAP.toFixed(2)} vs calc ${calcOutstandingAP.toFixed(2)}`);
      }

      report += '═'.repeat(100) + '\n';
      report += '  AUDIT VERIFICATION RESULTS\n';
      report += '═'.repeat(100) + '\n\n';

      if (issues.length === 0) {
        report += '  ╔' + '═'.repeat(98) + '╗\n';
        report += '  ║  ✅ ALL CHECKS PASSED                                                                           ║\n';
        report += '  ║                                                                                                  ║\n';
        report += '  ║  • All invoice subtotals match calculated values                                                 ║\n';
        report += '  ║  • All invoice balances match (total - paid)                                                     ║\n';
        report += '  ║  • All invoice payment sums match stored amounts                                                 ║\n';
        report += '  ║  • All bill calculations verified                                                                ║\n';
        report += '  ║  • AR/AP totals consistent                                                                       ║\n';
        report += '  ╚' + '═'.repeat(98) + '╝\n';
      } else {
        report += '  ╔' + '═'.repeat(98) + '╗\n';
        report += `  ║  ⚠️  ${String(issues.length).padEnd(3)} ISSUES FOUND                                                                          ║\n`;
        report += '  ╠' + '═'.repeat(98) + '╣\n';
        for (const issue of issues) {
          report += `  ║  • ${issue.padEnd(94)}║\n`;
        }
        report += '  ╚' + '═'.repeat(98) + '╝\n';
      }

      report += '\n' + '═'.repeat(100) + '\n';
      report += '  END OF AUDIT REPORT\n';
      report += '═'.repeat(100) + '\n';

      setAuditReport(report);
      setAuditSummary({
        passed: issues.length === 0,
        totalInvoiced,
        totalCollected: totalPaidInvoices,
        outstandingAR: totalOutstandingAR,
        totalBilled,
        totalPaidBills,
        outstandingAP: totalOutstandingAP,
        totalExpenses,
        issues,
      });

    } catch (err) {
      setAuditReport(`Error running audit: ${err}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const copyAuditReport = () => {
    if (auditReport) {
      navigator.clipboard.writeText(auditReport);
    }
  };

  const downloadAuditReport = () => {
    if (auditReport) {
      const blob = new Blob([auditReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
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

      if (options.money) {
        setCurrentTask("Seeding money module (customers, vendors, invoices, bills, expenses)...");
        newResults.money = await seedMoney();
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
    { key: "money" as const, label: "Money (AR/AP)", icon: Wallet, count: `${CUSTOMERS.length}+${VENDORS.length}+${INVOICES.length}+${BILLS.length}` },
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

        {/* DEV WARNING BANNER */}
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400">Development Tool Only</p>
              <p className="text-sm text-muted-foreground">
                This page is only available in development mode. It will not appear in production builds.
                Use with caution - clearing data is irreversible and seeding will add test data to the selected tenant.
              </p>
            </div>
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
              {(loading || clearing) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{clearing ? "Clearing data..." : currentTask}</span>
                    {!clearing && <span>{Math.round(progress)}%</span>}
                  </div>
                  {!clearing && <Progress value={progress} />}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={clearAllData}
                  disabled={loading || clearing || !tenantId}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear All Data
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSeedAll}
                  disabled={loading || clearing || !tenantId || !Object.values(options).some(Boolean)}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Seeding...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Seed Selected Data
                    </>
                  )}
                </Button>
              </div>

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

          {/* Data Audit */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Data Audit
                  </CardTitle>
                  <CardDescription>
                    Verify all financial numbers add up correctly
                  </CardDescription>
                </div>
                {auditReport && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyAuditReport}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadAuditReport}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={runDataAudit}
                disabled={auditLoading || !tenantId}
                variant="secondary"
              >
                {auditLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Audit...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Run Data Audit
                  </>
                )}
              </Button>

              {auditSummary && (
                <div className="space-y-4">
                  {/* Summary Badge */}
                  <div className={`p-4 rounded-lg border ${auditSummary.passed ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'}`}>
                    <div className="flex items-center gap-2">
                      {auditSummary.passed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-semibold">
                        {auditSummary.passed ? 'All Checks Passed' : `${auditSummary.issues.length} Issues Found`}
                      </span>
                    </div>
                    {auditSummary.issues.length > 0 && (
                      <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                        {auditSummary.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Total Invoiced</p>
                      <p className="text-xl font-bold text-blue-600">${auditSummary.totalInvoiced.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Collected (AR)</p>
                      <p className="text-xl font-bold text-green-600">${auditSummary.totalCollected.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Outstanding AR</p>
                      <p className="text-xl font-bold text-orange-600">${auditSummary.outstandingAR.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
                      <p className="text-xl font-bold text-purple-600">${auditSummary.totalExpenses.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Total Billed</p>
                      <p className="text-xl font-bold text-red-600">${auditSummary.totalBilled.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Paid (AP)</p>
                      <p className="text-xl font-bold text-teal-600">${auditSummary.totalPaidBills.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Outstanding AP</p>
                      <p className="text-xl font-bold text-amber-600">${auditSummary.outstandingAP.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Net Position</p>
                      <p className={`text-xl font-bold ${(auditSummary.outstandingAR - auditSummary.outstandingAP) >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                        ${(auditSummary.outstandingAR - auditSummary.outstandingAP).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Report */}
              {auditReport && (
                <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-auto whitespace-pre">
                  {auditReport}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
