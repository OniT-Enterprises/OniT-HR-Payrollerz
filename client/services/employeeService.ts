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
  serverTimestamp,
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
  createdAt?: any;
  updatedAt?: any;
}

class EmployeeService {
  private get collectionRef() {
    return collection(db, "employees");
  }

  async getAllEmployees(maxResults: number = 500): Promise<Employee[]> {
    // Limit query to prevent excessive reads - default 500, max for HR system
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy("createdAt", "desc"), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Employee;
    });
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Employee;
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

  async getEmployeesByDepartment(department: string): Promise<Employee[]> {
    const q = query(
      this.collectionRef,
      where("jobDetails.department", "==", department)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Employee;
    });
  }

  async searchEmployees(searchTerm: string): Promise<Employee[]> {
    // Firestore doesn't support full-text search, so we fetch all and filter
    const employees = await this.getAllEmployees();
    const term = searchTerm.toLowerCase();

    return employees.filter(
      (emp) =>
        emp.personalInfo.firstName.toLowerCase().includes(term) ||
        emp.personalInfo.lastName.toLowerCase().includes(term) ||
        emp.personalInfo.email.toLowerCase().includes(term) ||
        emp.jobDetails.employeeId.toLowerCase().includes(term)
    );
  }
}

export const employeeService = new EmployeeService();
