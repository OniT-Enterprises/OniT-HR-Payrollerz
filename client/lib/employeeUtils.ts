import type { Employee } from "@/services/employeeService";

export interface ProfileCompletenessResult {
  completionPercentage: number;
  isComplete: boolean;
  missingFields: string[];
  requiredDocuments: {
    field: string;
    missing: boolean;
    required: boolean;
  }[];
}

export function getProfileCompleteness(employee: Employee): ProfileCompletenessResult {
  const missingFields: string[] = [];
  let completed = 0;
  let total = 0;

  // Check personal info
  const personalFields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'dateOfBirth', label: 'Date of Birth' },
  ];

  personalFields.forEach(({ key, label }) => {
    total++;
    if (employee.personalInfo?.[key as keyof typeof employee.personalInfo]) {
      completed++;
    } else {
      missingFields.push(label);
    }
  });

  // Check job details
  const jobFields = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'hireDate', label: 'Hire Date' },
  ];

  jobFields.forEach(({ key, label }) => {
    total++;
    if (employee.jobDetails?.[key as keyof typeof employee.jobDetails]) {
      completed++;
    } else {
      missingFields.push(label);
    }
  });

  // Check compensation
  total++;
  if (employee.compensation?.monthlySalary) {
    completed++;
  } else {
    missingFields.push('Monthly Salary');
  }

  // Check required documents
  const requiredDocuments = [
    {
      field: 'ID Card',
      missing: !employee.documents?.idCard?.number,
      required: employee.documents?.idCard?.required ?? true,
    },
    {
      field: 'Social Security',
      missing: !employee.documents?.socialSecurityNumber?.number,
      required: employee.documents?.socialSecurityNumber?.required ?? true,
    },
    {
      field: 'Employee ID Card',
      missing: !employee.documents?.employeeIdCard?.number,
      required: employee.documents?.employeeIdCard?.required ?? true,
    },
    {
      field: 'Passport',
      missing: !employee.documents?.passport?.number,
      required: employee.documents?.passport?.required ?? false,
    },
    {
      field: 'Electoral Card',
      missing: !employee.documents?.electoralCard?.number,
      required: employee.documents?.electoralCard?.required ?? false,
    },
  ];

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completionPercentage,
    isComplete: completionPercentage >= 100,
    missingFields,
    requiredDocuments,
  };
}

export function getIncompleteEmployees(employees: Employee[]): Employee[] {
  return employees.filter(emp => getProfileCompleteness(emp).completionPercentage < 100);
}

export function getCompletionStatusIcon(completeness: number): string {
  if (completeness >= 100) return "check-circle";
  if (completeness >= 75) return "alert-circle";
  return "x-circle";
}

export function getCompletionStatusColor(completeness: number): string {
  if (completeness >= 100) return "text-green-600";
  if (completeness >= 75) return "text-yellow-600";
  if (completeness >= 50) return "text-orange-600";
  return "text-red-600";
}
