/**
 * Client-side API service for SQLite backend
 * Makes HTTP calls to Express server endpoints
 * Replaces localStorage with real database
 */

const API_BASE = "/api";

// Types (matching server schema)
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  department?: string;
  position?: string;
  employeeId?: string;
  hireDate?: string;
  employmentType?: string;
  workLocation?: string;
  manager?: string;
  monthlySalary?: number;
  annualLeaveDays?: number;
  status: "active" | "inactive" | "terminated";
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  headCount?: number;
  manager?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  department: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  contractType?: string;
  contractDuration?: string;
  probationPeriod?: string;
  status: string;
  postedDate: string;
  closingDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobId: string;
  status: string;
  appliedDate: string;
  resumeUrl?: string;
  notes?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

// Helper to make API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

// ==================== EMPLOYEES ====================

export async function getEmployees(): Promise<Employee[]> {
  return apiCall<Employee[]>("/employees");
}

export async function getEmployee(id: string): Promise<Employee> {
  return apiCall<Employee>(`/employees/${id}`);
}

export async function createEmployee(
  data: Omit<Employee, "id" | "createdAt" | "updatedAt">
): Promise<{ id: string; message: string }> {
  return apiCall<{ id: string; message: string }>("/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/employees/${id}`, {
    method: "DELETE",
  });
}

// ==================== DEPARTMENTS ====================

export async function getDepartments(): Promise<Department[]> {
  return apiCall<Department[]>("/departments");
}

export async function getDepartment(id: string): Promise<Department> {
  return apiCall<Department>(`/departments/${id}`);
}

export async function createDepartment(
  data: Omit<Department, "id" | "createdAt" | "updatedAt">
): Promise<{ id: string; message: string }> {
  return apiCall<{ id: string; message: string }>("/departments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDepartment(
  id: string,
  data: Partial<Department>
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/departments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDepartment(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/departments/${id}`, {
    method: "DELETE",
  });
}

// ==================== JOBS ====================

export async function getJobs(): Promise<Job[]> {
  return apiCall<Job[]>("/jobs");
}

export async function getJob(id: string): Promise<Job> {
  return apiCall<Job>(`/jobs/${id}`);
}

export async function createJob(
  data: Omit<Job, "id" | "createdAt" | "updatedAt" | "postedDate">
): Promise<{ id: string; message: string }> {
  return apiCall<{ id: string; message: string }>("/jobs", {
    method: "POST",
    body: JSON.stringify({ ...data, postedDate: new Date().toISOString() }),
  });
}

export async function updateJob(
  id: string,
  data: Partial<Job>
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/jobs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteJob(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/jobs/${id}`, {
    method: "DELETE",
  });
}

// ==================== CANDIDATES ====================

export async function getCandidates(): Promise<Candidate[]> {
  return apiCall<Candidate[]>("/candidates");
}

export async function getCandidate(id: string): Promise<Candidate> {
  return apiCall<Candidate>(`/candidates/${id}`);
}

export async function getCandidatesByJob(jobId: string): Promise<Candidate[]> {
  return apiCall<Candidate[]>(`/candidates/job/${jobId}`);
}

export async function createCandidate(
  data: Omit<Candidate, "id" | "createdAt" | "updatedAt" | "appliedDate">
): Promise<{ id: string; message: string }> {
  return apiCall<{ id: string; message: string }>("/candidates", {
    method: "POST",
    body: JSON.stringify({ ...data, appliedDate: new Date().toISOString() }),
  });
}

export async function updateCandidate(
  id: string,
  data: Partial<Candidate>
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/candidates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCandidate(id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/candidates/${id}`, {
    method: "DELETE",
  });
}

// ==================== STATS ====================

export async function getStats() {
  try {
    const [employees, departments, jobs, candidates] = await Promise.all([
      getEmployees(),
      getDepartments(),
      getJobs(),
      getCandidates(),
    ]);

    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const openJobs = jobs.filter((j) => j.status === "open").length;

    return {
      employees: employees.length,
      activeEmployees,
      departments: departments.length,
      jobs: jobs.length,
      openJobs,
      candidates: candidates.length,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return {
      employees: 0,
      activeEmployees: 0,
      departments: 0,
      jobs: 0,
      openJobs: 0,
      candidates: 0,
    };
  }
}

// ==================== EXPORT/IMPORT ====================

export async function exportData() {
  try {
    const [employees, departments, jobs, candidates] = await Promise.all([
      getEmployees(),
      getDepartments(),
      getJobs(),
      getCandidates(),
    ]);

    return {
      employees,
      departments,
      jobs,
      candidates,
      exportDate: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error exporting data:", error);
    return {
      employees: [],
      departments: [],
      jobs: [],
      candidates: [],
      exportDate: new Date().toISOString(),
    };
  }
}
