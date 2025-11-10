import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database file in project root (payroll.db)
const dbPath = path.join(__dirname, "..", "payroll.db");
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

/**
 * Initialize database schema
 * Designed to match Firestore structure for easy migration
 */
export function initializeDatabase() {
  // Departments collection
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      headCount INTEGER DEFAULT 0,
      manager TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Employees collection
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      dateOfBirth TEXT,
      emergencyContactName TEXT,
      emergencyContactPhone TEXT,
      department TEXT,
      position TEXT,
      employeeId TEXT UNIQUE,
      hireDate TEXT,
      employmentType TEXT,
      workLocation TEXT,
      manager TEXT,
      monthlySalary REAL,
      annualLeaveDays INTEGER,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (department) REFERENCES departments(id)
    )
  `);

  // Jobs collection
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      department TEXT NOT NULL,
      location TEXT,
      salaryMin REAL,
      salaryMax REAL,
      employmentType TEXT,
      contractType TEXT DEFAULT 'Permanent',
      contractDuration TEXT,
      probationPeriod TEXT,
      status TEXT DEFAULT 'open',
      postedDate TEXT NOT NULL,
      closingDate TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (department) REFERENCES departments(id)
    )
  `);

  // Add new columns if they don't exist (migration for existing database)
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN contractType TEXT DEFAULT 'Permanent'`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN contractDuration TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN probationPeriod TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Candidates collection
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      jobId TEXT NOT NULL,
      status TEXT DEFAULT 'applied',
      appliedDate TEXT NOT NULL,
      resumeUrl TEXT,
      notes TEXT,
      rating INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (jobId) REFERENCES jobs(id)
    )
  `);

  // Positions collection
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      isOpen INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (department) REFERENCES departments(id)
    )
  `);

  console.log("✅ Database schema initialized at", dbPath);
}

/**
 * Seed database with sample data
 */
export function seedDatabase() {
  // Check if data already exists
  const deptCount = db.prepare("SELECT COUNT(*) as count FROM departments").get() as { count: number };
  if (deptCount.count > 0) {
    console.log("📊 Database already has data, skipping seed");
    return;
  }

  console.log("🌱 Seeding database with sample data...");

  // Sample departments
  const depts = [
    {
      id: "dept_001",
      name: "Engineering",
      description: "Software development team",
      headCount: 5,
      manager: "John Doe",
    },
    {
      id: "dept_002",
      name: "Human Resources",
      description: "HR and recruitment",
      headCount: 3,
      manager: "Jane Smith",
    },
    {
      id: "dept_003",
      name: "Sales",
      description: "Sales and business development",
      headCount: 4,
      manager: "Bob Johnson",
    },
  ];

  const deptInsert = db.prepare(`
    INSERT INTO departments (id, name, description, headCount, manager, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const dept of depts) {
    deptInsert.run(dept.id, dept.name, dept.description, dept.headCount, dept.manager, now, now);
  }

  // Sample employees
  const employees = [
    {
      id: "emp_001",
      firstName: "Celestino",
      lastName: "de Freitas",
      email: "celestino@company.com",
      phone: "+1 (555) 123-4567",
      department: "dept_002",
      position: "HR Manager",
      employeeId: "EMP-001",
      hireDate: "2023-01-15",
      employmentType: "Full-time",
      workLocation: "San Francisco",
      monthlySalary: 6500,
      annualLeaveDays: 20,
      status: "active",
    },
    {
      id: "emp_002",
      firstName: "Alice",
      lastName: "Johnson",
      email: "alice@company.com",
      phone: "+1 (555) 987-6543",
      department: "dept_001",
      position: "Senior Engineer",
      employeeId: "EMP-002",
      hireDate: "2022-06-01",
      employmentType: "Full-time",
      workLocation: "San Francisco",
      monthlySalary: 8000,
      annualLeaveDays: 20,
      status: "active",
    },
  ];

  const empInsert = db.prepare(`
    INSERT INTO employees (
      id, firstName, lastName, email, phone, department, position, employeeId,
      hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays,
      status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const emp of employees) {
    empInsert.run(
      emp.id, emp.firstName, emp.lastName, emp.email, emp.phone,
      emp.department, emp.position, emp.employeeId, emp.hireDate,
      emp.employmentType, emp.workLocation, emp.monthlySalary,
      emp.annualLeaveDays, emp.status, now, now
    );
  }

  // Sample jobs
  const jobs = [
    {
      id: "job_001",
      title: "Frontend Developer",
      description: "Build amazing UIs",
      department: "dept_001",
      location: "San Francisco",
      salaryMin: 100000,
      salaryMax: 150000,
      employmentType: "Full-time",
      status: "open",
      postedDate: now,
    },
    {
      id: "job_002",
      title: "HR Specialist",
      description: "Join our HR team",
      department: "dept_002",
      location: "Remote",
      salaryMin: 60000,
      salaryMax: 90000,
      employmentType: "Full-time",
      status: "open",
      postedDate: now,
    },
  ];

  const jobInsert = db.prepare(`
    INSERT INTO jobs (
      id, title, description, department, location, salaryMin, salaryMax,
      employmentType, status, postedDate, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const job of jobs) {
    jobInsert.run(
      job.id, job.title, job.description, job.department, job.location,
      job.salaryMin, job.salaryMax, job.employmentType, job.status, job.postedDate, now, now
    );
  }

  console.log("✅ Database seeded with sample data");
}
