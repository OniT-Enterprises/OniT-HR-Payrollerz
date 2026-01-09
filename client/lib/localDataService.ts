/**
 * Local Data Service - Simple CRUD operations using localStorage
 * No Firebase, no external dependencies, just clean local storage
 */

// Data interfaces for our HR system
export interface LocalDepartment {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  budget?: number;
  createdAt: string;
}

export interface LocalEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  hireDate: string;
  status: "active" | "inactive" | "terminated";
  managerId?: string;
  salary?: number;
  createdAt: string;
}

export interface LocalJob {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  hiringManagerId: string;
  approverMode: "department" | "name";
  approverDepartmentId?: string;
  approverId: string;
  status: "draft" | "open" | "closed";
  location?: string;
  employmentType?: "full-time" | "part-time" | "contract" | "intern";
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  requirements?: string[];
  benefits?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalCandidate {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone?: string;
  stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  resume?: {
    fileName: string;
    uploadDate: string;
  };
  notes?: string;
  appliedDate: string;
  createdAt: string;
}

// Storage keys
const STORAGE_KEYS = {
  departments: "hr_departments",
  employees: "hr_employees",
  jobs: "hr_jobs",
  candidates: "hr_candidates",
  initialized: "hr_data_initialized",
} as const;

class LocalDataService {
  constructor() {
    this.initializeData();
  }

  // Initialize with sample data if empty
  public initializeData() {
    if (localStorage.getItem(STORAGE_KEYS.initialized)) {
      return; // Already initialized
    }

    console.log("🚀 Initializing local HR data...");

    // Sample departments
    const departments: LocalDepartment[] = [
      {
        id: "dept_1",
        name: "Human Resources",
        description: "People operations, recruitment, and employee relations",
        createdAt: new Date().toISOString(),
      },
      {
        id: "dept_2",
        name: "Engineering",
        description: "Software development and technical operations",
        createdAt: new Date().toISOString(),
      },
      {
        id: "dept_3",
        name: "Sales",
        description: "Business development and customer acquisition",
        createdAt: new Date().toISOString(),
      },
      {
        id: "dept_4",
        name: "Marketing",
        description: "Brand management and digital marketing",
        createdAt: new Date().toISOString(),
      },
      {
        id: "dept_5",
        name: "Finance",
        description: "Financial planning and accounting",
        createdAt: new Date().toISOString(),
      },
    ];

    // Sample employees
    const employees: LocalEmployee[] = [
      {
        id: "emp_1",
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@company.com",
        phone: "+1 (555) 123-4567",
        departmentId: "dept_1",
        position: "HR Manager",
        hireDate: "2023-01-15",
        status: "active",
        salary: 75000,
        createdAt: new Date().toISOString(),
      },
      {
        id: "emp_2",
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@company.com",
        phone: "+1 (555) 234-5678",
        departmentId: "dept_2",
        position: "Senior Software Engineer",
        hireDate: "2022-09-01",
        status: "active",
        salary: 95000,
        createdAt: new Date().toISOString(),
      },
      {
        id: "emp_3",
        firstName: "Mike",
        lastName: "Davis",
        email: "mike.davis@company.com",
        phone: "+1 (555) 345-6789",
        departmentId: "dept_3",
        position: "Sales Director",
        hireDate: "2022-11-10",
        status: "active",
        salary: 85000,
        createdAt: new Date().toISOString(),
      },
      {
        id: "emp_4",
        firstName: "Lisa",
        lastName: "Wilson",
        email: "lisa.wilson@company.com",
        phone: "+1 (555) 456-7890",
        departmentId: "dept_1",
        position: "HR Coordinator",
        hireDate: "2023-03-20",
        status: "active",
        salary: 55000,
        createdAt: new Date().toISOString(),
      },
      {
        id: "emp_5",
        firstName: "Tom",
        lastName: "Brown",
        email: "tom.brown@company.com",
        phone: "+1 (555) 567-8901",
        departmentId: "dept_4",
        position: "Marketing Manager",
        hireDate: "2023-02-01",
        status: "active",
        salary: 70000,
        createdAt: new Date().toISOString(),
      },
    ];

    // Save initial data
    this.saveToStorage(STORAGE_KEYS.departments, departments);
    this.saveToStorage(STORAGE_KEYS.employees, employees);
    this.saveToStorage(STORAGE_KEYS.jobs, []);
    this.saveToStorage(STORAGE_KEYS.candidates, []);

    localStorage.setItem(STORAGE_KEYS.initialized, "true");
    console.log("✅ Local HR data initialized successfully");
  }

  private saveToStorage<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  private loadFromStorage<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Department operations
  getDepartments(): LocalDepartment[] {
    return this.loadFromStorage<LocalDepartment>(STORAGE_KEYS.departments);
  }

  getDepartment(id: string): LocalDepartment | null {
    const departments = this.getDepartments();
    return departments.find((dept) => dept.id === id) || null;
  }

  createDepartment(
    data: Omit<LocalDepartment, "id" | "createdAt">,
  ): LocalDepartment {
    const newDepartment: LocalDepartment = {
      ...data,
      id: this.generateId("dept"),
      createdAt: new Date().toISOString(),
    };

    const departments = this.getDepartments();
    departments.push(newDepartment);
    this.saveToStorage(STORAGE_KEYS.departments, departments);

    console.log("✅ Created department:", newDepartment.name);
    return newDepartment;
  }

  // Employee operations
  getEmployees(filters?: {
    departmentId?: string;
    status?: LocalEmployee["status"];
  }): LocalEmployee[] {
    let employees = this.loadFromStorage<LocalEmployee>(STORAGE_KEYS.employees);

    if (filters?.departmentId) {
      employees = employees.filter(
        (emp) => emp.departmentId === filters.departmentId,
      );
    }

    if (filters?.status) {
      employees = employees.filter((emp) => emp.status === filters.status);
    }

    return employees;
  }

  getEmployee(id: string): LocalEmployee | null {
    const employees = this.getEmployees();
    return employees.find((emp) => emp.id === id) || null;
  }

  createEmployee(data: Omit<LocalEmployee, "id" | "createdAt">): LocalEmployee {
    const newEmployee: LocalEmployee = {
      ...data,
      id: this.generateId("emp"),
      createdAt: new Date().toISOString(),
    };

    const employees = this.getEmployees();
    employees.push(newEmployee);
    this.saveToStorage(STORAGE_KEYS.employees, employees);

    console.log(
      "✅ Created employee:",
      `${newEmployee.firstName} ${newEmployee.lastName}`,
    );
    return newEmployee;
  }

  updateEmployee(
    id: string,
    data: Partial<LocalEmployee>,
  ): LocalEmployee | null {
    const employees = this.getEmployees();
    const index = employees.findIndex((emp) => emp.id === id);

    if (index === -1) return null;

    employees[index] = { ...employees[index], ...data };
    this.saveToStorage(STORAGE_KEYS.employees, employees);

    console.log("✅ Updated employee:", id);
    return employees[index];
  }

  // Job operations
  getJobs(filters?: {
    departmentId?: string;
    status?: LocalJob["status"];
  }): LocalJob[] {
    let jobs = this.loadFromStorage<LocalJob>(STORAGE_KEYS.jobs);

    if (filters?.departmentId) {
      jobs = jobs.filter((job) => job.departmentId === filters.departmentId);
    }

    if (filters?.status) {
      jobs = jobs.filter((job) => job.status === filters.status);
    }

    return jobs;
  }

  getJob(id: string): LocalJob | null {
    const jobs = this.getJobs();
    return jobs.find((job) => job.id === id) || null;
  }

  createJob(data: Omit<LocalJob, "id" | "createdAt" | "updatedAt">): LocalJob {
    const now = new Date().toISOString();
    const newJob: LocalJob = {
      ...data,
      id: this.generateId("job"),
      createdAt: now,
      updatedAt: now,
    };

    const jobs = this.getJobs();
    jobs.push(newJob);
    this.saveToStorage(STORAGE_KEYS.jobs, jobs);

    console.log("✅ Created job:", newJob.title);
    return newJob;
  }

  updateJob(id: string, data: Partial<LocalJob>): LocalJob | null {
    const jobs = this.getJobs();
    const index = jobs.findIndex((job) => job.id === id);

    if (index === -1) return null;

    jobs[index] = {
      ...jobs[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.saveToStorage(STORAGE_KEYS.jobs, jobs);

    console.log("✅ Updated job:", id);
    return jobs[index];
  }

  deleteJob(id: string): boolean {
    const jobs = this.getJobs();
    const filteredJobs = jobs.filter((job) => job.id !== id);

    if (filteredJobs.length === jobs.length) return false;

    this.saveToStorage(STORAGE_KEYS.jobs, filteredJobs);
    console.log("✅ Deleted job:", id);
    return true;
  }

  // Candidate operations
  getCandidates(jobId?: string): LocalCandidate[] {
    let candidates = this.loadFromStorage<LocalCandidate>(
      STORAGE_KEYS.candidates,
    );

    if (jobId) {
      candidates = candidates.filter((candidate) => candidate.jobId === jobId);
    }

    return candidates;
  }

  createCandidate(
    data: Omit<LocalCandidate, "id" | "createdAt">,
  ): LocalCandidate {
    const newCandidate: LocalCandidate = {
      ...data,
      id: this.generateId("cand"),
      createdAt: new Date().toISOString(),
    };

    const candidates = this.getCandidates();
    candidates.push(newCandidate);
    this.saveToStorage(STORAGE_KEYS.candidates, candidates);

    console.log("✅ Created candidate:", newCandidate.name);
    return newCandidate;
  }

  // Utility methods
  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    console.log("🗑️ Cleared all local HR data");
  }

  exportData(): object {
    return {
      departments: this.getDepartments(),
      employees: this.getEmployees(),
      jobs: this.getJobs(),
      candidates: this.getCandidates(),
      exportedAt: new Date().toISOString(),
    };
  }

  importData(data: any): void {
    if (data.departments)
      this.saveToStorage(STORAGE_KEYS.departments, data.departments);
    if (data.employees)
      this.saveToStorage(STORAGE_KEYS.employees, data.employees);
    if (data.jobs) this.saveToStorage(STORAGE_KEYS.jobs, data.jobs);
    if (data.candidates)
      this.saveToStorage(STORAGE_KEYS.candidates, data.candidates);

    console.log("📥 Imported HR data successfully");
  }

  // Get statistics
  getStats() {
    return {
      departments: this.getDepartments().length,
      employees: this.getEmployees().length,
      activeEmployees: this.getEmployees({ status: "active" }).length,
      jobs: this.getJobs().length,
      openJobs: this.getJobs({ status: "open" }).length,
      candidates: this.getCandidates().length,
    };
  }
}

// Create singleton instance
export const localDataService = new LocalDataService();

// Export helper functions for easy use with proper binding
export const getDepartments = () => localDataService.getDepartments();
export const getDepartment = (id: string) => localDataService.getDepartment(id);
export const createDepartment = (
  data: Omit<LocalDepartment, "id" | "createdAt">,
) => localDataService.createDepartment(data);

export const getEmployees = (filters?: {
  departmentId?: string;
  status?: LocalEmployee["status"];
}) => localDataService.getEmployees(filters);
export const getEmployee = (id: string) => localDataService.getEmployee(id);
export const createEmployee = (data: Omit<LocalEmployee, "id" | "createdAt">) =>
  localDataService.createEmployee(data);
export const updateEmployee = (id: string, data: Partial<LocalEmployee>) =>
  localDataService.updateEmployee(id, data);

export const getJobs = (filters?: {
  departmentId?: string;
  status?: LocalJob["status"];
}) => localDataService.getJobs(filters);
export const getJob = (id: string) => localDataService.getJob(id);
export const createJob = (
  data: Omit<LocalJob, "id" | "createdAt" | "updatedAt">,
) => localDataService.createJob(data);
export const updateJob = (id: string, data: Partial<LocalJob>) =>
  localDataService.updateJob(id, data);
export const deleteJob = (id: string) => localDataService.deleteJob(id);

export const getCandidates = (jobId?: string) =>
  localDataService.getCandidates(jobId);
export const createCandidate = (
  data: Omit<LocalCandidate, "id" | "createdAt">,
) => localDataService.createCandidate(data);

export const clearAllData = () => localDataService.clearAllData();
export const exportData = () => localDataService.exportData();
export const importData = (data: any) => localDataService.importData(data);
export const getStats = () => localDataService.getStats();
export const initializeData = () => localDataService.initializeData();

console.log("🚀 Local Data Service initialized");
