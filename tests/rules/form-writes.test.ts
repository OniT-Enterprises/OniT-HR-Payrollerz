/**
 * Smoke-test that the WRITE each user-facing form performs is accepted by the
 * deployed security rules, for a normal tenant admin (owner). This catches the
 * "form submits but Firestore rejects it" class across every collection at once.
 *
 * Payloads mirror what the services actually write (tenant-scoped paths, and
 * the field shapes the rules require, e.g. tenantId on legacy collections).
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'test-form-writes';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TID = 'tenant-a';
const UID = 'owner-a';

describe('Form writes accepted by rules (tenant owner)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((m) => m.default),
        host: 'localhost',
        port: PORT,
      },
    });
  });
  afterAll(async () => env.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `tenants/${TID}`), { name: 'Tenant A', createdBy: UID });
      await setDoc(doc(db, `tenants/${TID}/members/${UID}`), {
        uid: UID, role: 'owner',
        modules: ['hiring','staff','timeleave','performance','payroll','money','accounting','reports'],
        employeeId: 'emp-1',
      });
    });
  });

  const db = () => env.authenticatedContext(UID).firestore();

  // Tenant-scoped create forms
  const tenantScoped: Array<[string, Record<string, unknown>]> = [
    ['employees',        { personalInfo: { firstName: 'A', lastName: 'B' }, status: 'active' }],
    ['departments',      { name: 'Ops' }],
    ['positions',        { title: 'Officer' }],
    ['jobs',             { title: 'Role', status: 'open' }],
    ['candidates',       { name: 'C' }],
    ['interviews',       { candidateName: 'C', status: 'scheduled' }],
    ['contracts',        { employeeId: 'emp-1' }],
    ['goals',            { createdById: UID, title: 'G' }],
    ['reviews',          { employeeId: 'emp-1', status: 'draft' }],
    ['trainings',        { employeeId: 'emp-1' }],
    ['discipline',       { employeeId: 'emp-1' }],
    ['customers',        { name: 'Cust' }],
    ['invoices',         {
      invoiceNumber: 'INV-2026-001', customerId: 'customer-1', customerName: 'Cust',
      issueDate: '2026-07-01', dueDate: '2026-07-31', items: [], subtotal: 100,
      taxRate: 0, taxAmount: 0, total: 100, status: 'draft', amountPaid: 0,
      creditedAmount: 0, balanceDue: 100, currency: 'USD', createdBy: UID,
      updatedBy: UID, updatedAt: new Date(),
    }],
    ['vendors',          { name: 'Vend' }],
    ['bills',            { vendorName: 'Vend', total: 50 }],
    ['supplierWithholdingPeriods', { period: '2026-06', totalLiability: 10, totalRemitted: 0 }],
    ['supplierWithholdingRemittances', { period: '2026-06', paymentDate: '2026-07-15', amount: 10 }],
    ['taxClearanceRequests', { purpose: 'commercial_3_months', requestedDate: '2026-07-17', status: 'requested' }],
    ['cashAdvances',     { employeeId: 'emp-1', amount: 50, outstanding: 50, status: 'open' }],
    ['cashAdvanceClearings', { advanceId: 'advance-1', type: 'expense', amount: 10 }],
    ['expenses',         { employeeId: 'emp-1', status: 'submitted', amount: 10 }],
    ['accounts',         { accountCode: '1000', accountName: 'Cash' }],
    ['announcements',    { title: 'Hi', body: 'x' }],
    ['holidays',         { name: 'Holiday', date: '2026-06-11' }],
    ['recurring_invoices', { customerName: 'Cust' }],
  ];

  for (const [coll, payload] of tenantScoped) {
    it(`create ${coll}`, async () => {
      await assertSucceeds(
        addDoc(collection(db(), `tenants/${TID}/${coll}`), { ...payload, createdAt: new Date() }),
      );
    });
  }

  it('requires shift creation to use the validated callable', async () => {
    await assertFails(addDoc(collection(db(), `tenants/${TID}/shifts`), {
      employeeId: 'emp-1',
      date: '2026-06-11',
      createdAt: new Date(),
    }));
  });

  // journalEntries: create must be draft or posted
  it('create journalEntries (draft)', async () => {
    await assertSucceeds(
      addDoc(collection(db(), `tenants/${TID}/journalEntries`), {
        status: 'draft', totalDebit: 100, totalCredit: 100, lines: [], createdAt: new Date(),
      }),
    );
  });

  // Top-level tenant records require tenantId on the document.
  const topLevel: Array<[string, Record<string, unknown>]> = [
    ['attendance',  { tenantId: TID, employeeId: 'emp-1', date: '2026-06-11', source: 'manual' }],
    ['onboarding',  { tenantId: TID, employeeId: 'emp-1' }],
    ['offboarding', { tenantId: TID, employeeId: 'emp-1', status: 'pending' }],
    ['payrollRuns', { tenantId: TID, createdBy: UID, status: 'draft' }],
  ];
  for (const [coll, payload] of topLevel) {
    it(`create top-level ${coll}`, async () => {
      await assertSucceeds(addDoc(collection(db(), coll), { ...payload, createdAt: new Date() }));
    });
  }

  it('requires canonical leave creation to use the validated callable', async () => {
    await assertFails(addDoc(collection(db(), 'leave_requests'), {
      tenantId: TID,
      employeeId: 'emp-1',
      departmentId: 'ops',
      status: 'pending',
      startDate: '2026-06-11',
      endDate: '2026-06-11',
      duration: 1,
      createdAt: new Date(),
    }));
  });

  it('blocks direct writes to retired and computed Time & Leave collections', async () => {
    await assertFails(addDoc(collection(db(), `tenants/${TID}/leaveRequests`), {
      employeeId: 'emp-1',
      status: 'pending',
    }));
    await assertFails(addDoc(collection(db(), `tenants/${TID}/timesheets`), {
      employeeId: 'emp-1',
    }));
    await assertFails(addDoc(collection(db(), 'leave_balances'), {
      tenantId: TID,
      employeeId: 'emp-1',
      year: 2026,
    }));
  });

  // Settings doc (CompanyDetails / payroll config save)
  it('write settings/config', async () => {
    await assertSucceeds(
      setDoc(doc(db(), `tenants/${TID}/settings/config`), { companyDetails: { legalName: 'X' } }),
    );
  });

  it('blocks direct tenant audit-log creation', async () => {
    await assertFails(
      addDoc(collection(db(), `tenants/${TID}/auditLogs`), {
        action: 'employee.update',
        userId: UID,
        timestamp: new Date(),
      }),
    );
  });
});
