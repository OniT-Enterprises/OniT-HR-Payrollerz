import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import type { ForeignWorkerData } from "@/types/tax-filing";
import { auditLogService } from "./auditLogService";
import { firestoreEmployeeSchema } from "@/lib/validations";

/**
 * Audit context for logging user actions
 * Pass this to methods that modify data to enable audit trail
 */
export interface AuditContext {
  userId: string;
  userEmail: string;
  userName?: string;
  tenantId: string; // Required for tenant-scoped audit logging
}

// Timor-Leste specific residency status
export type ResidencyStatus = 'timorese' | 'permanent_resident' | 'foreign_worker';

export interface Employee {
  id?: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneApp: string;
    appEligible: boolean;
    address: string;
    dateOfBirth: string;
    socialSecurityNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  jobDetails: {
    employeeId: string;
    department: string;
    position: string;
    hireDate: string;
    employmentType: string;
    contractEndDate?: string;  // For fixed-term contracts (YYYY-MM-DD)
    workLocation: string;
    manager: string;
    // TL-specific: SEFOPE registration for labor ministry compliance
    sefopeNumber?: string;
    sefopeRegistrationDate?: string;
    // NGO-specific: Funding source for donor reporting
    fundingSource?: string;
    // Project code for cost allocation
    projectCode?: string;
  };
  compensation: {
    monthlySalary: number;
    annualSalary?: number;       // Legacy: some records store annual instead of monthly
    annualLeaveDays: number;
    benefitsPackage: string;
    // TL-specific: Tax residency status affects WIT calculation
    isResident?: boolean;
  };
  documents: {
    // TL-specific: Bilhete de Identidade (National ID) - optional for non-TL nationals
    bilheteIdentidade?: {
      number: string;
      expiryDate: string;
      required: boolean;
    };
    // Legacy field - maps to bilheteIdentidade
    employeeIdCard: { number: string; expiryDate: string; required: boolean };
    // INSS Social Security Number
    socialSecurityNumber: {
      number: string;
      expiryDate: string;
      required: boolean;
    };
    // TL Electoral Card
    electoralCard: { number: string; expiryDate: string; required: boolean };
    // Generic ID Card (for non-TL nationals)
    idCard: { number: string; expiryDate: string; required: boolean };
    // Passport (required for non-TL nationals)
    passport: { number: string; expiryDate: string; required: boolean };
    // Employment contract
    workContract: { fileUrl: string; uploadDate: string };
    // Nationality/Citizenship
    nationality: string;
    // Residency status determines document requirements
    residencyStatus?: ResidencyStatus;
    // Working visa/residency permit (for foreign workers)
    workingVisaResidency: {
      number: string;
      expiryDate: string;
      fileUrl: string;
      // TL-specific: Work permit type
      permitType?: 'work_visa' | 'temporary_residence' | 'permanent_residence';
    };
  };
  // Bank details (optional — used for bank transfers)
  bankName?: string;
  bankAccountNumber?: string;
  bankDetails?: {
    accountNumber: string;
    bankName?: string;
    branch?: string;
  };
  status: "active" | "inactive" | "terminated";
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  // Foreign worker tracking (optional - only for non-resident employees)
  isForeignWorker?: boolean;
  foreignWorker?: ForeignWorkerData;
}

/**
 * Filter options for employee queries
 * Server-side filters are applied as Firestore where() clauses
 * Client-side filters are applied after fetching (for complex logic)
 */
export interface EmployeeFilters {
  // Server-side filters (Firestore queries)
  department?: string;
  status?: "active" | "inactive" | "terminated";
  employmentType?: string;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters (applied after fetch)
  searchTerm?: string;
  minSalary?: number;
  maxSalary?: number;
  workLocation?: string;
  position?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Employee with Zod validation
 * Validates data structure and converts timestamps to Dates
 */
function mapEmployee(doc: DocumentSnapshot): Employee {
  const data = doc.data();
  if (!data) throw new Error("Document data is undefined");

  // Validate and transform with Zod schema
  const validated = firestoreEmployeeSchema.safeParse(data);

  if (!validated.success) {
    // Log validation issues but continue with best-effort parsing
    console.warn(`Employee validation warning (${doc.id}):`, validated.error.flatten().fieldErrors);
  }

  const parsed = validated.success ? validated.data : firestoreEmployeeSchema.parse(data);

  return {
    id: doc.id,
    ...parsed,
  } as Employee;
}

class EmployeeService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.employees(tenantId));
  }

  /**
   * Get employees with server-side filtering and pagination
   * Filters like department, status, employmentType are applied server-side
   * Filters like searchTerm, salary range are applied client-side
   */
  async getEmployees(tenantId: string, filters: EmployeeFilters = {}): Promise<PaginatedResult<Employee>> {
    const {
      department,
      status,
      employmentType,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      minSalary,
      maxSalary,
      workLocation,
      position,
    } = filters;

    // Build query constraints for server-side filtering
    const constraints: QueryConstraint[] = [];

    // Server-side filters (Firestore where clauses)
    if (department && department !== "all") {
      constraints.push(where("jobDetails.department", "==", department));
    }
    if (status) {
      constraints.push(where("status", "==", status));
    }
    if (employmentType && employmentType !== "all") {
      constraints.push(where("jobDetails.employmentType", "==", employmentType));
    }

    // Ordering and pagination
    constraints.push(orderBy("createdAt", "desc"));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    // Fetch one extra to check if there's more
    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef(tenantId), ...constraints);
    const querySnapshot = await getDocs(q);

    let employees = querySnapshot.docs.map(mapEmployee);
    const hasMore = employees.length > pageSize;

    if (hasMore) {
      employees = employees.slice(0, pageSize);
    }

    const lastDoc = employees.length > 0
      ? querySnapshot.docs[employees.length - 1]
      : null;

    // Client-side filters (for features Firestore doesn't support well)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      employees = employees.filter(emp =>
        emp.personalInfo.firstName.toLowerCase().includes(term) ||
        emp.personalInfo.lastName.toLowerCase().includes(term) ||
        emp.personalInfo.email.toLowerCase().includes(term) ||
        emp.jobDetails.employeeId.toLowerCase().includes(term) ||
        emp.jobDetails.department.toLowerCase().includes(term) ||
        emp.jobDetails.position.toLowerCase().includes(term)
      );
    }

    if (minSalary !== undefined) {
      employees = employees.filter(emp =>
        (emp.compensation.monthlySalary || 0) >= minSalary
      );
    }

    if (maxSalary !== undefined) {
      employees = employees.filter(emp =>
        (emp.compensation.monthlySalary || 0) <= maxSalary
      );
    }

    if (workLocation && workLocation !== "all") {
      employees = employees.filter(emp =>
        emp.jobDetails.workLocation === workLocation
      );
    }

    if (position && position !== "all") {
      employees = employees.filter(emp =>
        emp.jobDetails.position === position
      );
    }

    return {
      data: employees,
      lastDoc,
      hasMore,
      totalFetched: employees.length,
    };
  }

  /**
   * Get all employees (convenience method, uses getEmployees internally)
   * @deprecated Use getEmployees() with filters for better performance
   */
  async getAllEmployees(tenantId: string, maxResults: number = 500): Promise<Employee[]> {
    const result = await this.getEmployees(tenantId, { pageSize: maxResults });
    return result.data;
  }

  async getEmployeeById(tenantId: string, id: string): Promise<Employee | null> {
    const docRef = doc(db, paths.employee(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapEmployee(docSnap);
  }

  /**
   * Find employees by their employeeId field (e.g., National ID / BI number).
   * Searches across ALL statuses including terminated.
   */
  async findByEmployeeId(tenantId: string, employeeId: string): Promise<Employee[]> {
    const q = query(
      this.collectionRef(tenantId),
      where("jobDetails.employeeId", "==", employeeId),
      limit(5)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapEmployee);
  }

  async addEmployee(
    tenantId: string,
    employee: Omit<Employee, "id">,
    audit?: AuditContext
  ): Promise<string> {
    // Uniqueness check: prevent duplicate employeeId (National ID / BI number)
    const empId = employee.jobDetails?.employeeId;
    if (empId && !empId.startsWith("TEMP")) {
      const existing = await this.findByEmployeeId(tenantId, empId);
      if (existing.length > 0) {
        const terminated = existing.find(e => e.status === "terminated");
        const active = existing.find(e => e.status === "active" || e.status === "inactive");
        if (active) {
          throw new Error(`Employee ID "${empId}" is already assigned to ${active.personalInfo.firstName} ${active.personalInfo.lastName}. Please use a different ID.`);
        }
        if (terminated) {
          throw new Error(`Employee ID "${empId}" belongs to terminated employee ${terminated.personalInfo.firstName} ${terminated.personalInfo.lastName}. Reactivate them instead of creating a new record.`);
        }
      }
    }

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...employee,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log to audit trail if context provided
    if (audit) {
      const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
      await auditLogService.logEmployeeAction({
        ...audit,
        tenantId,
        action: "employee.create",
        employeeId: docRef.id,
        employeeName,
      }).catch(err => console.error("Audit log failed:", err));
    }

    return docRef.id;
  }

  async updateEmployee(
    tenantId: string,
    id: string,
    updates: Partial<Employee>,
    audit?: AuditContext & { changes?: { field: string; from: unknown; to: unknown }[] }
  ): Promise<boolean> {
    // Get current employee for audit trail
    let oldEmployee: Employee | null = null;
    if (audit) {
      oldEmployee = await this.getEmployeeById(tenantId, id);
    }

    const docRef = doc(db, paths.employee(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Log to audit trail if context provided
    if (audit && oldEmployee) {
      const employeeName = `${oldEmployee.personalInfo.firstName} ${oldEmployee.personalInfo.lastName}`;

      // Determine action type based on status change
      let action: "employee.update" | "employee.terminate" | "employee.reactivate" = "employee.update";
      if (updates.status === "terminated" && oldEmployee.status !== "terminated") {
        action = "employee.terminate";
      } else if (updates.status === "active" && oldEmployee.status === "terminated") {
        action = "employee.reactivate";
      }

      await auditLogService.logEmployeeAction({
        ...audit,
        tenantId,
        action,
        employeeId: id,
        employeeName,
        changes: audit.changes,
      }).catch(err => console.error("Audit log failed:", err));
    }

    return true;
  }

  async deleteEmployee(tenantId: string, id: string, audit?: AuditContext): Promise<boolean> {
    // Soft delete: set status to terminated instead of destroying the document.
    // Hard deletes break historical payroll records, journal entries, and tax reports.
    const employee = await this.getEmployeeById(tenantId, id);
    if (!employee) throw new Error("Employee not found");

    const docRef = doc(db, paths.employee(tenantId, id));
    await updateDoc(docRef, {
      status: "terminated",
      terminatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log to audit trail if context provided
    if (audit) {
      const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
      await auditLogService.logEmployeeAction({
        ...audit,
        tenantId,
        action: "employee.terminate",
        employeeId: id,
        employeeName,
      }).catch(err => console.error("Audit log failed:", err));
    }

    return true;
  }

  /**
   * Get employees by department (server-side filtered)
   */
  async getEmployeesByDepartment(tenantId: string, department: string): Promise<Employee[]> {
    const result = await this.getEmployees(tenantId, { department, pageSize: 500 });
    return result.data;
  }

  /**
   * Get active employees only (server-side filtered)
   */
  async getActiveEmployees(tenantId: string): Promise<Employee[]> {
    const result = await this.getEmployees(tenantId, { status: "active", pageSize: 500 });
    return result.data;
  }

  /**
   * Search employees by text (client-side filtering)
   * Note: For large datasets, consider implementing Algolia or similar
   */
  async searchEmployees(tenantId: string, searchTerm: string): Promise<Employee[]> {
    const result = await this.getEmployees(tenantId, { searchTerm, pageSize: 500 });
    return result.data;
  }

  /**
   * Get count of employees by status (useful for dashboards)
   */
  async getEmployeeCounts(tenantId: string): Promise<{ active: number; inactive: number; terminated: number; total: number }> {
    const all = await this.getAllEmployees(tenantId);
    return {
      active: all.filter(e => e.status === "active").length,
      inactive: all.filter(e => e.status === "inactive").length,
      terminated: all.filter(e => e.status === "terminated").length,
      total: all.length,
    };
  }
}

export const employeeService = new EmployeeService();
