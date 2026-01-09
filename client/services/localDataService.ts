/**
 * Local data service - replaces Firebase with localStorage
 * Provides all CRUD operations for HR data
 */

export interface Employee {
  id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    dateOfBirth: string;
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
  };
  status: "active" | "inactive" | "terminated";
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  headCount: number;
  manager?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string[];
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class LocalDataService {
  private employees: Employee[] = [];
  private departments: Department[] = [];
  private positions: Position[] = [];

  private employeesKey = "hr_employees";
  private departmentsKey = "hr_departments";
  private positionsKey = "hr_positions";

  constructor() {
    this.loadData();
    this.initializeSampleData();
  }

  // Employee CRUD operations
  async getAllEmployees(): Promise<Employee[]> {
    return Promise.resolve([...this.employees]);
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const employee = this.employees.find((e) => e.id === id);
    return Promise.resolve(employee || null);
  }

  async addEmployee(
    employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const employee: Employee = {
      ...employeeData,
      id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.employees.push(employee);
    this.saveEmployees();

    console.log(
      "✅ Employee added:",
      employee.personalInfo.firstName,
      employee.personalInfo.lastName,
    );
    return Promise.resolve(employee.id);
  }

  async updateEmployee(
    id: string,
    updates: Partial<Employee>,
  ): Promise<boolean> {
    const index = this.employees.findIndex((e) => e.id === id);
    if (index === -1) return Promise.resolve(false);

    this.employees[index] = {
      ...this.employees[index],
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.saveEmployees();
    console.log("✅ Employee updated:", id);
    return Promise.resolve(true);
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const index = this.employees.findIndex((e) => e.id === id);
    if (index === -1) return Promise.resolve(false);

    this.employees.splice(index, 1);
    this.saveEmployees();
    console.log("✅ Employee deleted:", id);
    return Promise.resolve(true);
  }

  // Department CRUD operations
  async getAllDepartments(): Promise<Department[]> {
    return Promise.resolve([...this.departments]);
  }

  async addDepartment(
    departmentData: Omit<Department, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const department: Department = {
      ...departmentData,
      id: `dept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.departments.push(department);
    this.saveDepartments();

    console.log("✅ Department added:", department.name);
    return Promise.resolve(department.id);
  }

  async updateDepartment(
    id: string,
    updates: Partial<Department>,
  ): Promise<boolean> {
    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) return Promise.resolve(false);

    this.departments[index] = {
      ...this.departments[index],
      ...updates,
      id,
      updatedAt: new Date(),
    };

    this.saveDepartments();
    console.log("✅ Department updated:", id);
    return Promise.resolve(true);
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) return Promise.resolve(false);

    this.departments.splice(index, 1);
    this.saveDepartments();
    console.log("✅ Department deleted:", id);
    return Promise.resolve(true);
  }

  // Position CRUD operations
  async getAllPositions(): Promise<Position[]> {
    return Promise.resolve([...this.positions]);
  }

  async addPosition(
    positionData: Omit<Position, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const position: Position = {
      ...positionData,
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.positions.push(position);
    this.savePositions();

    console.log("✅ Position added:", position.title);
    return Promise.resolve(position.id);
  }

  // Data persistence
  private saveEmployees(): void {
    localStorage.setItem(this.employeesKey, JSON.stringify(this.employees));
  }

  private saveDepartments(): void {
    localStorage.setItem(this.departmentsKey, JSON.stringify(this.departments));
  }

  private savePositions(): void {
    localStorage.setItem(this.positionsKey, JSON.stringify(this.positions));
  }

  private loadData(): void {
    try {
      // Load employees
      const employeesData = localStorage.getItem(this.employeesKey);
      if (employeesData) {
        this.employees = JSON.parse(employeesData).map((emp: any) => ({
          ...emp,
          createdAt: new Date(emp.createdAt),
          updatedAt: new Date(emp.updatedAt),
        }));
      }

      // Load departments
      const departmentsData = localStorage.getItem(this.departmentsKey);
      if (departmentsData) {
        this.departments = JSON.parse(departmentsData).map((dept: any) => ({
          ...dept,
          createdAt: new Date(dept.createdAt),
          updatedAt: new Date(dept.updatedAt),
        }));
      }

      // Load positions
      const positionsData = localStorage.getItem(this.positionsKey);
      if (positionsData) {
        this.positions = JSON.parse(positionsData).map((pos: any) => ({
          ...pos,
          createdAt: new Date(pos.createdAt),
          updatedAt: new Date(pos.updatedAt),
        }));
      }

      console.log("📊 Data loaded:", {
        employees: this.employees.length,
        departments: this.departments.length,
        positions: this.positions.length,
      });
    } catch (error) {
      console.warn("Failed to load data from localStorage:", error);
    }
  }

  private initializeSampleData(): void {
    // Only initialize if no data exists
    if (this.departments.length === 0) {
      console.log("🚀 Initializing sample data...");

      // Create sample departments
      const sampleDepartments = [
        {
          name: "Engineering",
          description: "Software development and technical operations",
          headCount: 12,
        },
        {
          name: "Human Resources",
          description: "People operations and talent management",
          headCount: 3,
        },
        {
          name: "Marketing",
          description: "Brand, marketing, and communications",
          headCount: 5,
        },
        {
          name: "Sales",
          description: "Business development and customer relations",
          headCount: 8,
        },
        {
          name: "Finance",
          description: "Accounting, finance, and business operations",
          headCount: 4,
        },
      ];

      sampleDepartments.forEach((dept) => {
        this.addDepartment(dept);
      });

      // Create sample positions
      const samplePositions = [
        {
          title: "Senior Software Engineer",
          department: "Engineering",
          description: "Full-stack development",
          requirements: ["React", "Node.js", "5+ years exp"],
          isOpen: true,
        },
        {
          title: "Product Manager",
          department: "Engineering",
          description: "Product strategy and roadmap",
          requirements: ["Product management", "Technical background"],
          isOpen: true,
        },
        {
          title: "HR Coordinator",
          department: "Human Resources",
          description: "Recruitment and employee relations",
          requirements: ["HR experience", "Communication skills"],
          isOpen: false,
        },
        {
          title: "Marketing Specialist",
          department: "Marketing",
          description: "Digital marketing and content creation",
          requirements: ["Marketing degree", "Social media experience"],
          isOpen: true,
        },
      ];

      samplePositions.forEach((pos) => {
        this.addPosition(pos);
      });

      console.log("✅ Sample data initialized");
    }
  }

  // Statistics and analytics
  getStats() {
    return {
      totalEmployees: this.employees.length,
      totalDepartments: this.departments.length,
      openPositions: this.positions.filter((p) => p.isOpen).length,
      activeEmployees: this.employees.filter((e) => e.status === "active")
        .length,
    };
  }
}

// Create singleton instance
export const localDataService = new LocalDataService();

console.log("🔧 Local data service initialized");
