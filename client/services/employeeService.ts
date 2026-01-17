import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
  status: "active" | "inactive" | "terminated";
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
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
 * Maps Firestore document to Employee, converting timestamps to Dates
 */
function mapEmployee(doc: DocumentSnapshot): Employee {
  const data = doc.data();
  if (!data) throw new Error("Document data is undefined");

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : data.updatedAt || new Date(),
  } as Employee;
}

class EmployeeService {
  private get collectionRef() {
    return collection(db, "employees");
  }

  /**
   * Get employees with server-side filtering and pagination
   * Filters like department, status, employmentType are applied server-side
   * Filters like searchTerm, salary range are applied client-side
   */
  async getEmployees(filters: EmployeeFilters = {}): Promise<PaginatedResult<Employee>> {
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

    const q = query(this.collectionRef, ...constraints);
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
  async getAllEmployees(maxResults: number = 500): Promise<Employee[]> {
    const result = await this.getEmployees({ pageSize: maxResults });
    return result.data;
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapEmployee(docSnap);
  }

  async addEmployee(employee: Omit<Employee, "id">): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...employee,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateEmployee(
    id: string,
    updates: Partial<Employee>
  ): Promise<boolean> {
    const docRef = doc(db, "employees", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const docRef = doc(db, "employees", id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get employees by department (server-side filtered)
   */
  async getEmployeesByDepartment(department: string): Promise<Employee[]> {
    const result = await this.getEmployees({ department, pageSize: 500 });
    return result.data;
  }

  /**
   * Get active employees only (server-side filtered)
   */
  async getActiveEmployees(): Promise<Employee[]> {
    const result = await this.getEmployees({ status: "active", pageSize: 500 });
    return result.data;
  }

  /**
   * Search employees by text (client-side filtering)
   * Note: For large datasets, consider implementing Algolia or similar
   */
  async searchEmployees(searchTerm: string): Promise<Employee[]> {
    const result = await this.getEmployees({ searchTerm, pageSize: 500 });
    return result.data;
  }

  /**
   * Get count of employees by status (useful for dashboards)
   */
  async getEmployeeCounts(): Promise<{ active: number; inactive: number; terminated: number; total: number }> {
    const all = await this.getAllEmployees();
    return {
      active: all.filter(e => e.status === "active").length,
      inactive: all.filter(e => e.status === "inactive").length,
      terminated: all.filter(e => e.status === "terminated").length,
      total: all.length,
    };
  }
}

export const employeeService = new EmployeeService();
