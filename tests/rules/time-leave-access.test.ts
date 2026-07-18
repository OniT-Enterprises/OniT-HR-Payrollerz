import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-time-leave-access';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TID = 'tenant-time-leave';

const OWNER = 'owner-a';
const ACCOUNTANT = 'accountant-a';
const MANAGER = 'manager-a';
const EMPLOYEE_A = 'employee-a';
const EMPLOYEE_B = 'employee-b';

describe('canonical Time & Leave access', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((module) => module.default),
        host: 'localhost',
        port: PORT,
      },
    });
  });

  afterAll(async () => env.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `tenants/${TID}`), { name: 'Time Leave Ltd' });

      const members = [
        [OWNER, 'owner', 'owner-emp', 'dept-a'],
        [ACCOUNTANT, 'accountant', 'accountant-emp', 'finance'],
        [MANAGER, 'manager', 'manager-emp', 'dept-a'],
        [EMPLOYEE_A, 'viewer', 'emp-a', 'dept-a'],
        [EMPLOYEE_B, 'viewer', 'emp-b', 'dept-b'],
      ] as const;
      for (const [uid, role, employeeId, departmentId] of members) {
        await setDoc(doc(db, `tenants/${TID}/members/${uid}`), {
          uid,
          role,
          employeeId,
          departmentId,
          modules: ['timeleave'],
        });
      }

      for (const [employeeId, departmentId] of [
        ['emp-a', 'dept-a'],
        ['emp-b', 'dept-b'],
        ['manager-emp', 'dept-a'],
      ] as const) {
        await setDoc(doc(db, `tenants/${TID}/employees/${employeeId}`), {
          status: 'active',
          jobDetails: { departmentId },
        });
      }

      const requestBase = {
        tenantId: TID,
        status: 'pending',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
        duration: 1,
      };
      await setDoc(doc(db, 'leave_requests/team-a'), {
        ...requestBase,
        employeeId: 'emp-a',
        departmentId: 'dept-a',
      });
      await setDoc(doc(db, 'leave_requests/team-b'), {
        ...requestBase,
        employeeId: 'emp-b',
        departmentId: 'dept-b',
      });

      await setDoc(doc(db, 'leave_balances/balance-a'), {
        tenantId: TID,
        employeeId: 'emp-a',
        departmentId: 'dept-a',
        year: 2026,
      });
      await setDoc(doc(db, 'leave_balances/balance-b'), {
        tenantId: TID,
        employeeId: 'emp-b',
        departmentId: 'dept-b',
        year: 2026,
      });

      await setDoc(doc(db, 'attendance/attendance-a'), {
        tenantId: TID,
        employeeId: 'emp-a',
        departmentId: 'dept-a',
        date: '2026-07-18',
        source: 'manual',
      });
      await setDoc(doc(db, 'attendance/attendance-b'), {
        tenantId: TID,
        employeeId: 'emp-b',
        departmentId: 'dept-b',
        date: '2026-07-18',
        source: 'manual',
      });
    });
  });

  const asUser = (uid: string) => env.authenticatedContext(uid).firestore();

  it('gives owners and accountants tenant-wide read access without accountant writes', async () => {
    await assertSucceeds(getDoc(doc(asUser(OWNER), 'leave_requests/team-b')));
    await assertSucceeds(getDoc(doc(asUser(ACCOUNTANT), 'leave_requests/team-b')));
    await assertSucceeds(getDoc(doc(asUser(ACCOUNTANT), 'attendance/attendance-b')));
    await assertFails(updateDoc(doc(asUser(ACCOUNTANT), 'leave_requests/team-a'), {
      status: 'approved',
      approverId: ACCOUNTANT,
      approverName: 'Accountant',
      approvedDate: '2026-07-18',
      updatedAt: new Date(),
    }));
  });

  it('limits managers to records in their department', async () => {
    await assertSucceeds(getDoc(doc(asUser(MANAGER), 'leave_requests/team-a')));
    await assertFails(getDoc(doc(asUser(MANAGER), 'leave_requests/team-b')));
    await assertSucceeds(getDoc(doc(asUser(MANAGER), 'attendance/attendance-a')));
    await assertFails(getDoc(doc(asUser(MANAGER), 'attendance/attendance-b')));
    await assertSucceeds(getDoc(doc(asUser(MANAGER), 'leave_balances/balance-a')));
    await assertFails(getDoc(doc(asUser(MANAGER), 'leave_balances/balance-b')));
  });

  it('requires managers to use the validated decision callable', async () => {
    await assertFails(updateDoc(doc(asUser(MANAGER), 'leave_requests/team-a'), {
      status: 'approved',
      approverId: MANAGER,
      approverName: 'Manager',
      approvedDate: '2026-07-18',
      updatedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(asUser(MANAGER), 'leave_requests/team-b'), {
      status: 'approved',
      approverId: MANAGER,
      approverName: 'Manager',
      approvedDate: '2026-07-18',
      updatedAt: new Date(),
    }));
  });

  it('lets employees read and cancel only their own leave while creation uses the callable', async () => {
    await assertSucceeds(getDoc(doc(asUser(EMPLOYEE_A), 'leave_requests/team-a')));
    await assertFails(getDoc(doc(asUser(EMPLOYEE_A), 'leave_requests/team-b')));
    await assertFails(setDoc(doc(asUser(EMPLOYEE_A), 'leave_requests/self-new'), {
      tenantId: TID,
      employeeId: 'emp-a',
      departmentId: 'dept-a',
      status: 'pending',
      startDate: '2026-07-21',
      endDate: '2026-07-21',
      duration: 1,
    }));
    await assertFails(setDoc(doc(asUser(EMPLOYEE_A), 'leave_requests/forged-team'), {
      tenantId: TID,
      employeeId: 'emp-a',
      departmentId: 'dept-b',
      status: 'pending',
      startDate: '2026-07-21',
      endDate: '2026-07-21',
      duration: 1,
    }));
    await assertSucceeds(updateDoc(doc(asUser(EMPLOYEE_A), 'leave_requests/team-a'), {
      status: 'cancelled',
      updatedAt: new Date(),
    }));
  });

  it('keeps balance projections read-only for every tenant role', async () => {
    await assertSucceeds(getDoc(doc(asUser(EMPLOYEE_A), 'leave_balances/balance-a')));
    await assertFails(getDoc(doc(asUser(EMPLOYEE_A), 'leave_balances/balance-b')));
    await assertFails(updateDoc(doc(asUser(OWNER), 'leave_balances/balance-a'), {
      year: 2027,
    }));
  });

  it('allows manager attendance writes only for employees in their department', async () => {
    await assertSucceeds(setDoc(doc(asUser(MANAGER), 'attendance/manager-a'), {
      tenantId: TID,
      employeeId: 'emp-a',
      departmentId: 'dept-a',
      date: '2026-07-19',
      source: 'manual',
    }));
    await assertFails(setDoc(doc(asUser(MANAGER), 'attendance/manager-b'), {
      tenantId: TID,
      employeeId: 'emp-b',
      departmentId: 'dept-b',
      date: '2026-07-19',
      source: 'manual',
    }));
    await assertFails(setDoc(doc(asUser(EMPLOYEE_A), 'attendance/self-write'), {
      tenantId: TID,
      employeeId: 'emp-a',
      departmentId: 'dept-a',
      date: '2026-07-19',
      source: 'manual',
    }));
  });

  it('requires validated shift creation to use the callable', async () => {
    await assertFails(setDoc(doc(asUser(MANAGER), `tenants/${TID}/shifts/shift-a`), {
      employeeId: 'emp-a',
      departmentId: 'dept-a',
      date: '2026-07-20',
      status: 'draft',
    }));
    await assertFails(setDoc(doc(asUser(MANAGER), `tenants/${TID}/shifts/shift-b`), {
      employeeId: 'emp-b',
      departmentId: 'dept-b',
      date: '2026-07-20',
      status: 'draft',
    }));
  });
});
