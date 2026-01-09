const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK with emulator configuration
process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000';

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'payroll-dev',
  storageBucket: 'payroll-dev.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123def456',
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'payroll-dev',
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9100';

async function seedDatabase() {
  console.log('🌱 Seeding Payroll Database with Test Data...\n');

  try {
    // Test Departments
    console.log('📂 Creating departments...');
    const depts = [
      { id: 'dept_001', name: 'Human Resources', description: 'HR and recruitment team', manager: 'Jane Smith', headCount: 5 },
      { id: 'dept_002', name: 'Finance', description: 'Finance and accounting', manager: 'Robert Johnson', headCount: 4 },
      { id: 'dept_003', name: 'Operations', description: 'Operations management', manager: 'Maria Garcia', headCount: 6 },
      { id: 'dept_004', name: 'IT', description: 'Information Technology', manager: 'David Lee', headCount: 8 },
      { id: 'dept_005', name: 'Sales', description: 'Sales and business development', manager: 'Sarah Wilson', headCount: 10 },
    ];

    for (const dept of depts) {
      await db.collection('departments').doc(dept.id).set({
        name: dept.name,
        description: dept.description,
        manager: dept.manager,
        headCount: dept.headCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    console.log(`✅ Created ${depts.length} departments\n`);

    // Test Employees
    console.log('👥 Creating employees...');
    const employees = [
      {
        id: 'emp_001',
        firstName: 'Celestino',
        lastName: 'de Freitas',
        email: 'celestino@company.com',
        phone: '+1 (555) 123-4567',
        department: 'dept_002',
        position: 'HR Manager',
        employeeId: 'EMP-001',
        hireDate: '2023-01-15',
        employmentType: 'Full-time',
        workLocation: 'San Francisco, CA',
        monthlySalary: 6500,
        annualLeaveDays: 20,
      },
      {
        id: 'emp_002',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@company.com',
        phone: '+1 (555) 234-5678',
        department: 'dept_004',
        position: 'Senior Developer',
        employeeId: 'EMP-002',
        hireDate: '2022-06-01',
        employmentType: 'Full-time',
        workLocation: 'San Francisco, CA',
        monthlySalary: 8000,
        annualLeaveDays: 20,
      },
      {
        id: 'emp_003',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@company.com',
        phone: '+1 (555) 345-6789',
        department: 'dept_003',
        position: 'Operations Manager',
        employeeId: 'EMP-003',
        hireDate: '2023-03-20',
        employmentType: 'Full-time',
        workLocation: 'New York, NY',
        monthlySalary: 5500,
        annualLeaveDays: 20,
      },
      {
        id: 'emp_004',
        firstName: 'Diana',
        lastName: 'Martinez',
        email: 'diana@company.com',
        phone: '+1 (555) 456-7890',
        department: 'dept_002',
        position: 'Finance Analyst',
        employeeId: 'EMP-004',
        hireDate: '2023-02-10',
        employmentType: 'Full-time',
        workLocation: 'Boston, MA',
        monthlySalary: 5000,
        annualLeaveDays: 20,
      },
      {
        id: 'emp_005',
        firstName: 'Edward',
        lastName: 'Chen',
        email: 'edward@company.com',
        phone: '+1 (555) 567-8901',
        department: 'dept_005',
        position: 'Sales Manager',
        employeeId: 'EMP-005',
        hireDate: '2022-09-05',
        employmentType: 'Full-time',
        workLocation: 'Los Angeles, CA',
        monthlySalary: 6000,
        annualLeaveDays: 20,
      },
    ];

    for (const emp of employees) {
      await db.collection('employees').doc(emp.id).set({
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        department: emp.department,
        position: emp.position,
        employeeId: emp.employeeId,
        hireDate: emp.hireDate,
        employmentType: emp.employmentType,
        workLocation: emp.workLocation,
        monthlySalary: emp.monthlySalary,
        annualLeaveDays: emp.annualLeaveDays,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    console.log(`✅ Created ${employees.length} employees\n`);

    // Test Job Postings
    console.log('💼 Creating job postings...');
    const jobs = [
      {
        id: 'job_001',
        title: 'Senior Software Engineer',
        description: 'Looking for experienced software engineer to join our IT team',
        department: 'dept_004',
        location: 'San Francisco, CA',
        salaryMin: 120000,
        salaryMax: 160000,
        employmentType: 'Full-time',
        contractType: 'Permanent',
        probationPeriod: '3 months',
        status: 'open',
      },
      {
        id: 'job_002',
        title: 'HR Specialist',
        description: 'Join our HR team to manage recruitment and employee relations',
        department: 'dept_001',
        location: 'Remote',
        salaryMin: 60000,
        salaryMax: 90000,
        employmentType: 'Full-time',
        contractType: 'Permanent',
        probationPeriod: '3 months',
        status: 'open',
      },
      {
        id: 'job_003',
        title: 'Finance Manager',
        description: 'Manage financial operations and reporting',
        department: 'dept_002',
        location: 'Boston, MA',
        salaryMin: 80000,
        salaryMax: 120000,
        employmentType: 'Full-time',
        contractType: 'Permanent',
        probationPeriod: '3 months',
        status: 'open',
      },
    ];

    for (const job of jobs) {
      await db.collection('jobs').doc(job.id).set({
        title: job.title,
        description: job.description,
        department: job.department,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        employmentType: job.employmentType,
        contractType: job.contractType,
        probationPeriod: job.probationPeriod,
        status: job.status,
        postedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    console.log(`✅ Created ${jobs.length} job postings\n`);

    // Test Payroll Records
    console.log('💰 Creating payroll records...');
    const payroll = [
      {
        id: 'payroll_001',
        employeeId: 'emp_001',
        period: '2024-12',
        grossSalary: 6500,
        deductions: 650,
        netSalary: 5850,
      },
      {
        id: 'payroll_002',
        employeeId: 'emp_002',
        period: '2024-12',
        grossSalary: 8000,
        deductions: 800,
        netSalary: 7200,
      },
      {
        id: 'payroll_003',
        employeeId: 'emp_003',
        period: '2024-12',
        grossSalary: 5500,
        deductions: 550,
        netSalary: 4950,
      },
    ];

    for (const record of payroll) {
      await db.collection('payroll').doc(record.id).set({
        employeeId: record.employeeId,
        period: record.period,
        grossSalary: record.grossSalary,
        deductions: record.deductions,
        netSalary: record.netSalary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    console.log(`✅ Created ${payroll.length} payroll records\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database seeding completed successfully!\n');
    console.log('📊 Test Data Summary:');
    console.log(`   • Departments: ${depts.length}`);
    console.log(`   • Employees: ${employees.length}`);
    console.log(`   • Job Postings: ${jobs.length}`);
    console.log(`   • Payroll Records: ${payroll.length}\n`);
    console.log('🔗 Access Emulator UI: http://localhost:4001\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
