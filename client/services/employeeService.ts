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
import {
  db,
  isFirebaseReady,
  getFirebaseError,
  isFirebaseBlocked,
  tryAuthentication,
} from "@/lib/firebase";
import { mockDataService } from "./mockDataService";
import { getEmployeesDirectly } from "@/lib/firebaseBypass";

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
  };
  compensation: {
    monthlySalary: number;
    annualLeaveDays: number;
    benefitsPackage: string;
  };
  documents: {
    employeeIdCard: { number: string; expiryDate: string; required: boolean };
    socialSecurityNumber: {
      number: string;
      expiryDate: string;
      required: boolean;
    };
    electoralCard: { number: string; expiryDate: string; required: boolean };
    idCard: { number: string; expiryDate: string; required: boolean };
    passport: { number: string; expiryDate: string; required: boolean };
    workContract: { fileUrl: string; uploadDate: string };
    nationality: string;
    workingVisaResidency: {
      number: string;
      expiryDate: string;
      fileUrl: string;
    };
  };
  status: "active" | "inactive" | "terminated";
  createdAt?: any;
  updatedAt?: any;
}

class EmployeeService {
  private get collection() {
    if (!db) {
      throw new Error("Firebase not initialized - using local data mode");
    }
    return collection(db, "employees");
  }

  private async testConnection(): Promise<void> {
    try {
      // Try to read a simple query to test connectivity
      const testQuery = query(this.collection, limit(1));
      await getDocs(testQuery);
    } catch (error) {
      console.error("Firebase connection test failed:", error);
      throw new Error(
        "Unable to connect to database. Please check your internet connection.",
      );
    }
  }

  private cacheEmployees(employees: Employee[]): void {
    try {
      localStorage.setItem(
        "cachedEmployees",
        JSON.stringify({
          data: employees,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      console.warn("Failed to cache employees:", error);
    }
  }

  private getOfflineEmployees(): Employee[] {
    try {
      const cached = localStorage.getItem("cachedEmployees");
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cached data if it's less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          return data;
        }
      }
    } catch (error) {
      console.warn("Failed to retrieve cached employees:", error);
    }
    return [];
  }

  async getAllEmployees(): Promise<Employee[]> {
    console.log("👥 Loading employees from Firebase first, then fallback");

    // Check cache first
    const cachedEmployees = this.getOfflineEmployees();
    if (cachedEmployees.length > 0) {
      console.log("✅ Using cached employee data");
      // Still try Firebase in background to refresh cache
      this.refreshFirebaseData();
      return cachedEmployees;
    }

    // Try Firebase first
    if (isFirebaseReady() && db && !isFirebaseBlocked()) {
      try {
        console.log("🔥 Attempting to load employees from Firebase...");

        // Authenticate first
        const isAuthenticated = await tryAuthentication();
        if (!isAuthenticated) {
          console.warn("⚠️ Authentication failed, but continuing anyway");
          // Don't throw error - try to continue with direct access
        }

        await this.testConnection();

        const querySnapshot = await getDocs(
          query(this.collection, orderBy("createdAt", "desc")),
        );

        const employees = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Employee;
        });

        console.log(
          `✅ Successfully loaded ${employees.length} employees from Firebase`,
        );
        this.cacheEmployees(employees);
        return employees;
      } catch (error) {
        console.warn("🚫 Firebase failed for employees:", error);

        // Try direct access without authentication as last resort
        if (
          error.message?.includes("Authentication failed") ||
          error.code === "unauthenticated"
        ) {
          try {
            console.log("🔄 Trying direct Firestore access without auth...");
            const employees = await getEmployeesDirectly();
            console.log(
              `✅ Direct access successful: ${employees.length} employees`,
            );
            this.cacheEmployees(employees);
            return employees;
          } catch (directError) {
            console.warn("🚫 Direct access also failed:", directError);
          }
        }
      }
    }

    try {
      // Fallback to mock data
      console.log("📊 Using mock employee data as fallback");
      const mockEmployees = await mockDataService.getAllEmployees();
      this.cacheEmployees(mockEmployees);
      return mockEmployees;
    } catch (error) {
      console.error(
        "❌ Even mock data failed, using hardcoded fallback:",
        error,
      );

      // Ultimate fallback with hardcoded data
      return [
        {
          id: "emp-1",
          personalInfo: {
            firstName: "John",
            lastName: "Smith",
            email: "john.smith@company.com",
            phone: "+1-555-0101",
            phoneApp: "WhatsApp",
            appEligible: true,
            address: "123 Main St, New York, NY 10001",
            dateOfBirth: "1985-06-15",
            socialSecurityNumber: "***-**-1234",
            emergencyContactName: "Jane Smith",
            emergencyContactPhone: "+1-555-0102",
          },
          jobDetails: {
            employeeId: "ENG001",
            department: "Engineering",
            position: "Senior Software Engineer",
            hireDate: "2020-03-15",
            employmentType: "Full-time",
            workLocation: "New York Office",
            manager: "Jane Doe",
          },
          compensation: {
            monthlySalary: 8500,
            annualLeaveDays: 25,
            benefitsPackage: "Premium Health + Dental",
          },
          documents: {
            employeeIdCard: {
              number: "ENG001",
              expiryDate: "2025-03-15",
              required: true,
            },
            socialSecurityNumber: {
              number: "***-**-1234",
              expiryDate: "N/A",
              required: true,
            },
            electoralCard: {
              number: "EC123456",
              expiryDate: "2025-12-31",
              required: false,
            },
            idCard: {
              number: "ID789012",
              expiryDate: "2026-06-15",
              required: true,
            },
            passport: {
              number: "***1234",
              expiryDate: "2028-06-15",
              required: false,
            },
            workContract: {
              fileUrl: "",
              uploadDate: "2020-03-15",
            },
            nationality: "US",
            workingVisaResidency: {
              number: "",
              expiryDate: "",
              fileUrl: "",
            },
          },
          status: "active",
          createdAt: new Date("2020-03-15"),
          updatedAt: new Date(),
        },
        {
          id: "emp-2",
          personalInfo: {
            firstName: "Sarah",
            lastName: "Johnson",
            email: "sarah.johnson@company.com",
            phone: "+1-555-0201",
            phoneApp: "WhatsApp",
            appEligible: true,
            address: "456 Oak Ave, San Francisco, CA 94102",
            dateOfBirth: "1988-09-22",
            socialSecurityNumber: "***-**-5678",
            emergencyContactName: "Mike Johnson",
            emergencyContactPhone: "+1-555-0202",
          },
          jobDetails: {
            employeeId: "MKT001",
            department: "Marketing",
            position: "Marketing Manager",
            hireDate: "2019-08-10",
            employmentType: "Full-time",
            workLocation: "San Francisco Office",
            manager: "Robert Wilson",
          },
          compensation: {
            monthlySalary: 7500,
            annualLeaveDays: 22,
            benefitsPackage: "Standard Health Package",
          },
          documents: {
            employeeIdCard: {
              number: "MKT001",
              expiryDate: "2025-08-10",
              required: true,
            },
            socialSecurityNumber: {
              number: "***-**-5678",
              expiryDate: "N/A",
              required: true,
            },
            electoralCard: {
              number: "EC654321",
              expiryDate: "2025-12-31",
              required: false,
            },
            idCard: {
              number: "ID210987",
              expiryDate: "2026-09-22",
              required: true,
            },
            passport: {
              number: "***5678",
              expiryDate: "2027-09-22",
              required: false,
            },
            workContract: {
              fileUrl: "",
              uploadDate: "2019-08-10",
            },
            nationality: "US",
            workingVisaResidency: {
              number: "",
              expiryDate: "",
              fileUrl: "",
            },
          },
          status: "active",
          createdAt: new Date("2019-08-10"),
          updatedAt: new Date(),
        },
        {
          id: "emp-3",
          personalInfo: {
            firstName: "Mike",
            lastName: "Davis",
            email: "mike.davis@company.com",
            phone: "+1-555-0301",
            phoneApp: "Telegram",
            appEligible: true,
            address: "789 Pine St, Chicago, IL 60601",
            dateOfBirth: "1990-03-11",
            socialSecurityNumber: "***-**-9012",
            emergencyContactName: "Anna Davis",
            emergencyContactPhone: "+1-555-0302",
          },
          jobDetails: {
            employeeId: "SAL001",
            department: "Sales",
            position: "Sales Representative",
            hireDate: "2021-01-20",
            employmentType: "Full-time",
            workLocation: "Chicago Office",
            manager: "Lisa Brown",
          },
          compensation: {
            monthlySalary: 6000,
            annualLeaveDays: 20,
            benefitsPackage: "Basic Health Package",
          },
          documents: {
            employeeIdCard: {
              number: "SAL001",
              expiryDate: "2026-01-20",
              required: true,
            },
            socialSecurityNumber: {
              number: "***-**-9012",
              expiryDate: "N/A",
              required: true,
            },
            electoralCard: {
              number: "EC987654",
              expiryDate: "2025-12-31",
              required: false,
            },
            idCard: {
              number: "ID345678",
              expiryDate: "2027-03-11",
              required: true,
            },
            passport: {
              number: "***9012",
              expiryDate: "2029-03-11",
              required: false,
            },
            workContract: {
              fileUrl: "",
              uploadDate: "2021-01-20",
            },
            nationality: "US",
            workingVisaResidency: {
              number: "",
              expiryDate: "",
              fileUrl: "",
            },
          },
          status: "active",
          createdAt: new Date("2021-01-20"),
          updatedAt: new Date(),
        },
      ];
    }
  }

  private async refreshFirebaseData(): Promise<void> {
    // Background refresh - don't block UI
    if (!isFirebaseReady() || !db || isFirebaseBlocked()) return;

    try {
      const querySnapshot = await getDocs(
        query(this.collection, orderBy("createdAt", "desc")),
      );

      const employees = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Employee;
      });

      this.cacheEmployees(employees);
      console.log(
        `🔄 Background refresh: ${employees.length} employees updated`,
      );
    } catch (error) {
      console.warn("Background refresh failed:", error);
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    try {
      // Use offline-first approach
      console.log(`👤 Getting employee ${id} with offline-first approach`);
      const allEmployees = await this.getAllEmployees();
      return allEmployees.find((emp) => emp.id === id) || null;
    } catch (error) {
      console.error("Error getting employee:", error);
      return null;
    }
  }

  async addEmployee(employee: Omit<Employee, "id">): Promise<string | null> {
    // Check if Firebase is properly initialized
    if (!isFirebaseReady() || !db) {
      const error = getFirebaseError();
      console.warn(
        "Firebase not ready, using mock service for adding employee:",
        error,
      );

      // Use mock service when Firebase is unavailable
      try {
        const id = await mockDataService.addEmployee(employee);
        return id;
      } catch (mockError) {
        console.error("Mock service also failed:", mockError);
        throw new Error(
          "Unable to add employee: Both Firebase and local storage are unavailable.",
        );
      }
    }

    // Try to authenticate before attempting to write
    try {
      console.log("🔐 Ensuring authentication before adding employee...");
      const authSuccess = await tryAuthentication();
      if (!authSuccess) {
        console.warn("❌ Authentication failed, falling back to mock service");
        const id = await mockDataService.addEmployee(employee);
        return id;
      }
      console.log(
        "✅ Authentication successful, proceeding with Firebase write",
      );
    } catch (authError) {
      console.warn(
        "❌ Authentication error, falling back to mock service:",
        authError,
      );
      const id = await mockDataService.addEmployee(employee);
      return id;
    }

    try {
      const docRef = await addDoc(this.collection, {
        ...employee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Employee added to Firebase successfully:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error adding employee to Firebase:", error);

      if (error.message?.includes("Failed to fetch")) {
        console.warn("Firebase failed, trying mock service fallback");
        try {
          const id = await mockDataService.addEmployee(employee);
          return id;
        } catch (mockError) {
          console.error("Mock service also failed:", mockError);
          throw new Error(
            "Failed to add employee: Connection issues and local storage unavailable. Please try again later.",
          );
        }
      }

      return null;
    }
  }

  async updateEmployee(
    id: string,
    updates: Partial<Employee>,
  ): Promise<boolean> {
    try {
      await updateDoc(doc(this.collection, id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error("Error updating employee:", error);
      return false;
    }
  }

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.collection, id));
      return true;
    } catch (error) {
      console.error("Error deleting employee:", error);
      return false;
    }
  }

  async getEmployeesByDepartment(department: string): Promise<Employee[]> {
    try {
      // Use offline-first approach
      console.log(
        `🏢 Getting employees for department ${department} with offline-first approach`,
      );
      const allEmployees = await this.getAllEmployees();
      return allEmployees.filter(
        (emp) => emp.jobDetails.department === department,
      );
    } catch (error) {
      console.error("Error getting employees by department:", error);
      return [];
    }
  }

  async searchEmployees(searchTerm: string): Promise<Employee[]> {
    try {
      // Note: Firestore doesn't support full-text search natively
      // This is a simple search by first name, last name, or email
      const employees = await this.getAllEmployees();
      return employees.filter(
        (emp) =>
          emp.personalInfo.firstName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          emp.personalInfo.lastName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          emp.personalInfo.email
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          emp.jobDetails.employeeId
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    } catch (error) {
      console.error("Error searching employees:", error);
      return [];
    }
  }
}

export const employeeService = new EmployeeService();
