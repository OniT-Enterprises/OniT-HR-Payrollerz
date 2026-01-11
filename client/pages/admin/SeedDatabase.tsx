import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MainNavigation from "@/components/layout/MainNavigation";
import { departmentService } from "@/services/departmentService";
import { employeeService } from "@/services/employeeService";
import { Database, Users, Building, CheckCircle, Loader2, AlertCircle } from "lucide-react";

const SEED_DEPARTMENTS = [
  { name: "Executive", director: "James Wilson", icon: "crown", shape: "diamond" as const, color: "#8B5CF6" },
  { name: "Engineering", director: "Sarah Chen", manager: "Michael Torres", icon: "code", shape: "hexagon" as const, color: "#3B82F6" },
  { name: "Human Resources", director: "Patricia Moore", manager: "David Kim", icon: "users", shape: "circle" as const, color: "#10B981" },
  { name: "Finance", director: "Robert Johnson", manager: "Emily Davis", icon: "dollar-sign", shape: "square" as const, color: "#F59E0B" },
  { name: "Marketing", director: "Jennifer Lee", manager: "Chris Anderson", icon: "megaphone", shape: "circle" as const, color: "#EC4899" },
  { name: "Operations", director: "William Brown", manager: "Lisa Martinez", icon: "settings", shape: "hexagon" as const, color: "#6366F1" },
  { name: "Sales", director: "Thomas Garcia", manager: "Amanda White", icon: "trending-up", shape: "square" as const, color: "#14B8A6" },
];

const SEED_EMPLOYEES = [
  // Executive
  {
    personalInfo: {
      firstName: "James",
      lastName: "Wilson",
      email: "james.wilson@company.com",
      phone: "+1-555-0101",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "123 Executive Drive, Suite 100, New York, NY 10001",
      dateOfBirth: "1970-03-15",
      socialSecurityNumber: "XXX-XX-1001",
      emergencyContactName: "Mary Wilson",
      emergencyContactPhone: "+1-555-0102",
    },
    jobDetails: {
      employeeId: "EMP-001",
      department: "Executive",
      position: "Chief Executive Officer",
      hireDate: "2015-01-15",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "",
    },
    compensation: { monthlySalary: 45000, annualLeaveDays: 30, benefitsPackage: "Executive" },
    documents: {
      employeeIdCard: { number: "ID-001", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-001", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-001", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-001", expiryDate: "2030-03-20", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Margaret",
      lastName: "Chen",
      email: "margaret.chen@company.com",
      phone: "+1-555-0103",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "456 Finance Blvd, New York, NY 10002",
      dateOfBirth: "1975-07-22",
      socialSecurityNumber: "XXX-XX-1002",
      emergencyContactName: "David Chen",
      emergencyContactPhone: "+1-555-0104",
    },
    jobDetails: {
      employeeId: "EMP-002",
      department: "Executive",
      position: "Chief Financial Officer",
      hireDate: "2016-03-01",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 38000, annualLeaveDays: 28, benefitsPackage: "Executive" },
    documents: {
      employeeIdCard: { number: "ID-002", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-002", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-002", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-002", expiryDate: "2029-08-10", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Engineering
  {
    personalInfo: {
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah.chen@company.com",
      phone: "+1-555-0105",
      phoneApp: "Telegram",
      appEligible: true,
      address: "789 Tech Lane, San Francisco, CA 94102",
      dateOfBirth: "1985-11-08",
      socialSecurityNumber: "XXX-XX-1003",
      emergencyContactName: "John Chen",
      emergencyContactPhone: "+1-555-0106",
    },
    jobDetails: {
      employeeId: "EMP-003",
      department: "Engineering",
      position: "VP of Engineering",
      hireDate: "2018-06-15",
      employmentType: "Full-time",
      workLocation: "San Francisco Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 28000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-003", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-003", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-003", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-003", expiryDate: "2031-01-20", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Michael",
      lastName: "Torres",
      email: "michael.torres@company.com",
      phone: "+1-555-0107",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "321 Developer Ave, San Francisco, CA 94103",
      dateOfBirth: "1988-04-12",
      socialSecurityNumber: "XXX-XX-1004",
      emergencyContactName: "Ana Torres",
      emergencyContactPhone: "+1-555-0108",
    },
    jobDetails: {
      employeeId: "EMP-004",
      department: "Engineering",
      position: "Engineering Manager",
      hireDate: "2019-02-01",
      employmentType: "Full-time",
      workLocation: "San Francisco Office",
      manager: "Sarah Chen",
    },
    compensation: { monthlySalary: 18000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-004", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-004", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-004", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Emily",
      lastName: "Rodriguez",
      email: "emily.rodriguez@company.com",
      phone: "+1-555-0109",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "654 Code Street, San Francisco, CA 94104",
      dateOfBirth: "1992-09-25",
      socialSecurityNumber: "XXX-XX-1005",
      emergencyContactName: "Carlos Rodriguez",
      emergencyContactPhone: "+1-555-0110",
    },
    jobDetails: {
      employeeId: "EMP-005",
      department: "Engineering",
      position: "Senior Software Engineer",
      hireDate: "2020-08-15",
      employmentType: "Full-time",
      workLocation: "San Francisco Office",
      manager: "Michael Torres",
    },
    compensation: { monthlySalary: 14000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-005", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-005", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-005", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "David",
      lastName: "Park",
      email: "david.park@company.com",
      phone: "+1-555-0111",
      phoneApp: "Telegram",
      appEligible: true,
      address: "987 Algorithm Way, San Francisco, CA 94105",
      dateOfBirth: "1994-02-18",
      socialSecurityNumber: "XXX-XX-1006",
      emergencyContactName: "Susan Park",
      emergencyContactPhone: "+1-555-0112",
    },
    jobDetails: {
      employeeId: "EMP-006",
      department: "Engineering",
      position: "Software Engineer",
      hireDate: "2022-01-10",
      employmentType: "Full-time",
      workLocation: "Remote",
      manager: "Michael Torres",
    },
    compensation: { monthlySalary: 11000, annualLeaveDays: 20, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-006", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-006", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-006", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Human Resources
  {
    personalInfo: {
      firstName: "Patricia",
      lastName: "Moore",
      email: "patricia.moore@company.com",
      phone: "+1-555-0113",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "147 HR Boulevard, New York, NY 10003",
      dateOfBirth: "1978-06-30",
      socialSecurityNumber: "XXX-XX-1007",
      emergencyContactName: "Robert Moore",
      emergencyContactPhone: "+1-555-0114",
    },
    jobDetails: {
      employeeId: "EMP-007",
      department: "Human Resources",
      position: "Director of Human Resources",
      hireDate: "2017-04-01",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 22000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-007", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-007", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-007", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-007", expiryDate: "2029-11-05", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "David",
      lastName: "Kim",
      email: "david.kim@company.com",
      phone: "+1-555-0115",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "258 People Street, New York, NY 10004",
      dateOfBirth: "1986-12-05",
      socialSecurityNumber: "XXX-XX-1008",
      emergencyContactName: "Jennifer Kim",
      emergencyContactPhone: "+1-555-0116",
    },
    jobDetails: {
      employeeId: "EMP-008",
      department: "Human Resources",
      position: "HR Manager",
      hireDate: "2019-07-15",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "Patricia Moore",
    },
    compensation: { monthlySalary: 12000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-008", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-008", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-008", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Finance
  {
    personalInfo: {
      firstName: "Robert",
      lastName: "Johnson",
      email: "robert.johnson@company.com",
      phone: "+1-555-0117",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "369 Money Lane, New York, NY 10005",
      dateOfBirth: "1972-08-20",
      socialSecurityNumber: "XXX-XX-1009",
      emergencyContactName: "Linda Johnson",
      emergencyContactPhone: "+1-555-0118",
    },
    jobDetails: {
      employeeId: "EMP-009",
      department: "Finance",
      position: "Director of Finance",
      hireDate: "2016-09-01",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "Margaret Chen",
    },
    compensation: { monthlySalary: 24000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-009", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-009", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-009", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-009", expiryDate: "2028-04-15", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Emily",
      lastName: "Davis",
      email: "emily.davis@company.com",
      phone: "+1-555-0119",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "741 Accounting Ave, New York, NY 10006",
      dateOfBirth: "1990-01-14",
      socialSecurityNumber: "XXX-XX-1010",
      emergencyContactName: "Mark Davis",
      emergencyContactPhone: "+1-555-0120",
    },
    jobDetails: {
      employeeId: "EMP-010",
      department: "Finance",
      position: "Finance Manager",
      hireDate: "2020-03-01",
      employmentType: "Full-time",
      workLocation: "Head Office",
      manager: "Robert Johnson",
    },
    compensation: { monthlySalary: 13000, annualLeaveDays: 22, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-010", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-010", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-010", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Marketing
  {
    personalInfo: {
      firstName: "Jennifer",
      lastName: "Lee",
      email: "jennifer.lee@company.com",
      phone: "+1-555-0121",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "852 Brand Street, Los Angeles, CA 90001",
      dateOfBirth: "1983-05-28",
      socialSecurityNumber: "XXX-XX-1011",
      emergencyContactName: "Kevin Lee",
      emergencyContactPhone: "+1-555-0122",
    },
    jobDetails: {
      employeeId: "EMP-011",
      department: "Marketing",
      position: "Director of Marketing",
      hireDate: "2018-01-15",
      employmentType: "Full-time",
      workLocation: "Los Angeles Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 21000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-011", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-011", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-011", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-011", expiryDate: "2030-07-22", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Chris",
      lastName: "Anderson",
      email: "chris.anderson@company.com",
      phone: "+1-555-0123",
      phoneApp: "Telegram",
      appEligible: true,
      address: "963 Campaign Road, Los Angeles, CA 90002",
      dateOfBirth: "1991-10-03",
      socialSecurityNumber: "XXX-XX-1012",
      emergencyContactName: "Sarah Anderson",
      emergencyContactPhone: "+1-555-0124",
    },
    jobDetails: {
      employeeId: "EMP-012",
      department: "Marketing",
      position: "Marketing Manager",
      hireDate: "2021-05-01",
      employmentType: "Full-time",
      workLocation: "Los Angeles Office",
      manager: "Jennifer Lee",
    },
    compensation: { monthlySalary: 11500, annualLeaveDays: 22, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-012", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-012", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-012", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Operations
  {
    personalInfo: {
      firstName: "William",
      lastName: "Brown",
      email: "william.brown@company.com",
      phone: "+1-555-0125",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "159 Process Drive, Chicago, IL 60601",
      dateOfBirth: "1976-03-17",
      socialSecurityNumber: "XXX-XX-1013",
      emergencyContactName: "Nancy Brown",
      emergencyContactPhone: "+1-555-0126",
    },
    jobDetails: {
      employeeId: "EMP-013",
      department: "Operations",
      position: "Director of Operations",
      hireDate: "2017-08-01",
      employmentType: "Full-time",
      workLocation: "Chicago Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 23000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-013", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-013", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-013", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-013", expiryDate: "2029-02-28", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  // Sales
  {
    personalInfo: {
      firstName: "Thomas",
      lastName: "Garcia",
      email: "thomas.garcia@company.com",
      phone: "+1-555-0127",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "753 Revenue Road, Miami, FL 33101",
      dateOfBirth: "1980-11-22",
      socialSecurityNumber: "XXX-XX-1014",
      emergencyContactName: "Maria Garcia",
      emergencyContactPhone: "+1-555-0128",
    },
    jobDetails: {
      employeeId: "EMP-014",
      department: "Sales",
      position: "Director of Sales",
      hireDate: "2018-10-01",
      employmentType: "Full-time",
      workLocation: "Miami Office",
      manager: "James Wilson",
    },
    compensation: { monthlySalary: 22000, annualLeaveDays: 25, benefitsPackage: "Premium" },
    documents: {
      employeeIdCard: { number: "ID-014", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-014", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-014", expiryDate: "2028-06-15", required: true },
      passport: { number: "P-014", expiryDate: "2031-05-10", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
  {
    personalInfo: {
      firstName: "Amanda",
      lastName: "White",
      email: "amanda.white@company.com",
      phone: "+1-555-0129",
      phoneApp: "WhatsApp",
      appEligible: true,
      address: "951 Deal Avenue, Miami, FL 33102",
      dateOfBirth: "1989-07-08",
      socialSecurityNumber: "XXX-XX-1015",
      emergencyContactName: "James White",
      emergencyContactPhone: "+1-555-0130",
    },
    jobDetails: {
      employeeId: "EMP-015",
      department: "Sales",
      position: "Sales Manager",
      hireDate: "2020-11-15",
      employmentType: "Full-time",
      workLocation: "Miami Office",
      manager: "Thomas Garcia",
    },
    compensation: { monthlySalary: 12500, annualLeaveDays: 22, benefitsPackage: "Standard" },
    documents: {
      employeeIdCard: { number: "ID-015", expiryDate: "2027-12-31", required: true },
      socialSecurityNumber: { number: "SSN-015", expiryDate: "", required: true },
      electoralCard: { number: "", expiryDate: "", required: false },
      idCard: { number: "GOV-015", expiryDate: "2028-06-15", required: true },
      passport: { number: "", expiryDate: "", required: false },
      workContract: { fileUrl: "", uploadDate: "" },
      nationality: "American",
      workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
    },
    status: "active" as const,
  },
];

export default function SeedDatabase() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    departments: { success: number; failed: number };
    employees: { success: number; failed: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const seedDepartments = async () => {
    let success = 0;
    let failed = 0;

    for (const dept of SEED_DEPARTMENTS) {
      try {
        await departmentService.addDepartment(dept);
        success++;
        addLog(`Added department: ${dept.name}`);
      } catch (err) {
        failed++;
        addLog(`Failed to add department ${dept.name}: ${err}`);
      }
    }

    return { success, failed };
  };

  const seedEmployees = async () => {
    let success = 0;
    let failed = 0;

    for (const emp of SEED_EMPLOYEES) {
      try {
        await employeeService.addEmployee(emp);
        success++;
        addLog(`Added employee: ${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`);
      } catch (err) {
        failed++;
        addLog(`Failed to add employee ${emp.personalInfo.firstName}: ${err}`);
      }
    }

    return { success, failed };
  };

  const handleSeedAll = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);
    setResults(null);

    try {
      addLog("Starting database seeding...");

      addLog("Seeding departments...");
      const deptResults = await seedDepartments();

      addLog("Seeding employees...");
      const empResults = await seedEmployees();

      setResults({
        departments: deptResults,
        employees: empResults,
      });

      addLog("Database seeding complete!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      addLog(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAndSeed = async () => {
    if (!confirm("This will add new data. Existing data will NOT be deleted. Continue?")) {
      return;
    }
    await handleSeedAll();
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">Seed Database</h1>
            <p className="text-muted-foreground">
              Populate Firebase with sample departments and employees
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Seed Data Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Seed Data Summary</CardTitle>
              <CardDescription>
                The following data will be added to Firebase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Building className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-900">{SEED_DEPARTMENTS.length}</p>
                    <p className="text-sm text-blue-700">Departments</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-900">{SEED_EMPLOYEES.length}</p>
                    <p className="text-sm text-green-700">Employees</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2">Departments:</h4>
                <div className="flex flex-wrap gap-2">
                  {SEED_DEPARTMENTS.map((dept) => (
                    <Badge key={dept.name} variant="outline">
                      {dept.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleClearAndSeed}
                disabled={loading}
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
                    Seed Database
                  </>
                )}
              </Button>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-800">{error}</p>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium">Departments</p>
                    <p className="text-green-600">{results.departments.success} added</p>
                    {results.departments.failed > 0 && (
                      <p className="text-red-600">{results.departments.failed} failed</p>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium">Employees</p>
                    <p className="text-green-600">{results.employees.success} added</p>
                    {results.employees.failed > 0 && (
                      <p className="text-red-600">{results.employees.failed} failed</p>
                    )}
                  </div>
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
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm max-h-64 overflow-auto">
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
