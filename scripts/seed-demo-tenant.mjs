/**
 * Seed a clean, realistic DEMO tenant for sales demos + QA login.
 * Idempotent: wipes and recreates the demo tenant each run.
 *
 *   node scripts/seed-demo-tenant.mjs
 *
 * Creates an owner auth login you can sign in with (printed at the end).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const TENANT_ID = 'demo-kafe-aroma';
const COMPANY = 'Kafé Aroma Dili';
const OWNER_EMAIL = 'demo@xefe.tl';
const OWNER_PASSWORD = 'XefeDemo2026!';
const OWNER_NAME = 'Aderito Soares';
const ALL_MODULES = ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'];

const departments = [
  { id: 'dept-front', name: 'Front of House' },
  { id: 'dept-kitchen', name: 'Kitchen' },
  { id: 'dept-admin', name: 'Administration' },
];

// Realistic Timorese café staff. Salaries in USD (TL min wage = $115/mo).
const employees = [
  ['Aderito',  'Soares',    'Administration', 'dept-admin',   'Manajer Jerál',      550, '2021-02-01', 'Manager'],
  ['Filomena', 'da Costa',  'Front of House', 'dept-front',   'Supervisora Sala',   320, '2021-06-15', 'Supervisor'],
  ['Joaquim',  'Ximenes',   'Front of House', 'dept-front',   'Barista',            190, '2022-03-10', 'Barista'],
  ['Lucia',    'Pereira',   'Front of House', 'dept-front',   'Barista',            180, '2023-01-20', 'Barista'],
  ['Mateus',   'Guterres',  'Front of House', 'dept-front',   'Kaixa',              165, '2023-08-05', 'Cashier'],
  ['Esperança','Belo',      'Kitchen',        'dept-kitchen', 'Kuziñeiru Xefe',     280, '2021-09-01', 'Head Cook'],
  ['Domingos', 'Amaral',    'Kitchen',        'dept-kitchen', 'Asistente Kuziña',   150, '2023-05-12', 'Kitchen Hand'],
  ['Rosa',     'Sarmento',  'Administration', 'dept-admin',   'Limpeza',            130, '2022-11-01', 'Cleaner'],
];

async function deleteCollection(path) {
  const snap = await db.collection(path).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.size) await batch.commit();
  return snap.size;
}

async function run() {
  console.log(`\nSeeding demo tenant "${COMPANY}" (${TENANT_ID})...\n`);

  // 1. Owner auth user (create or reset password)
  let ownerUid;
  try {
    const existing = await auth.getUserByEmail(OWNER_EMAIL);
    ownerUid = existing.uid;
    await auth.updateUser(ownerUid, { password: OWNER_PASSWORD, displayName: OWNER_NAME });
    console.log(`  ✓ Owner auth user exists, password reset (${ownerUid})`);
  } catch {
    const created = await auth.createUser({ email: OWNER_EMAIL, password: OWNER_PASSWORD, displayName: OWNER_NAME, emailVerified: true });
    ownerUid = created.uid;
    console.log(`  ✓ Created owner auth user (${ownerUid})`);
  }

  // 2. Wipe existing tenant data (idempotent)
  for (const c of ['employees', 'departments', 'customers', 'invoices', 'vendors', 'bills', 'expenses', 'shifts', 'members']) {
    await deleteCollection(`tenants/${TENANT_ID}/${c}`);
  }

  // 3. User profile
  await db.doc(`users/${ownerUid}`).set({
    uid: ownerUid,
    email: OWNER_EMAIL,
    displayName: OWNER_NAME,
    isSuperAdmin: false,
    tenantIds: [TENANT_ID],
    tenantAccess: { [TENANT_ID]: { name: COMPANY, role: 'owner' } },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // 4. Tenant doc
  await db.doc(`tenants/${TENANT_ID}`).set({
    id: TENANT_ID,
    name: COMPANY,
    slug: TENANT_ID,
    status: 'active',
    plan: 'professional',
    createdBy: ownerUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    features: { hiring: true, timeleave: true, performance: true, payroll: true, money: true, accounting: true, reports: true },
    settings: { timezone: 'Asia/Dili', currency: 'USD', dateFormat: 'DD/MM/YYYY' },
  }, { merge: true });

  // 5. Owner membership
  await db.doc(`tenants/${TENANT_ID}/members/${ownerUid}`).set({
    uid: ownerUid,
    email: OWNER_EMAIL,
    displayName: OWNER_NAME,
    role: 'owner',
    modules: ALL_MODULES,
    employeeId: 'EMP001',
    joinedAt: FieldValue.serverTimestamp(),
    lastActiveAt: FieldValue.serverTimestamp(),
    permissions: { admin: true, write: true, read: true },
  });

  // 6. Settings/config
  await db.doc(`tenants/${TENANT_ID}/settings/config`).set({
    companyDetails: {
      legalName: COMPANY, tradingName: 'Kafé Aroma', tinNumber: '1009876-5',
      registeredAddress: 'Rua de Lecidere, Dili', city: 'Dili', country: 'Timor-Leste',
      phone: '+670 7700 1234', email: OWNER_EMAIL,
    },
    features: { hiring: true, timeleave: true, performance: true, payroll: true, money: true, accounting: true, reports: true },
    settings: { timezone: 'Asia/Dili', currency: 'USD', dateFormat: 'DD/MM/YYYY' },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // 7. Departments
  for (const d of departments) {
    await db.doc(`tenants/${TENANT_ID}/departments/${d.id}`).set({
      name: d.name, tenantId: TENANT_ID, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // 8. Employees
  let i = 0;
  for (const [first, last, dept, deptId, position, salary, hire, type] of employees) {
    i++;
    const empId = `EMP${String(i).padStart(3, '0')}`;
    await db.doc(`tenants/${TENANT_ID}/employees/${empId}`).set({
      personalInfo: {
        firstName: first, lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@kafearoma.tl`,
        phone: `+670 77${10 + i} ${1000 + i * 7}`,
        address: 'Dili, Timor-Leste',
        nationality: 'Timorese',
      },
      jobDetails: {
        employeeId: empId, department: dept, position, hireDate: hire,
        employmentType: 'Full-time', workLocation: 'Kafé Aroma, Lecidere', manager: i === 1 ? '' : 'EMP001',
      },
      compensation: { monthlySalary: salary, annualLeaveDays: 12, benefitsPackage: 'standard' },
      status: 'active',
      departmentId: deptId,
      isForeignWorker: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(`  ✓ ${departments.length} departments, ${employees.length} employees`);
  console.log(`\n✅ Demo tenant ready.\n`);
  console.log(`   URL:      https://xefe.tl/auth/login`);
  console.log(`   Email:    ${OWNER_EMAIL}`);
  console.log(`   Password: ${OWNER_PASSWORD}`);
  console.log(`   Tenant:   ${TENANT_ID}\n`);
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
