import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-legacy-module-permissions';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

describe('Legacy Root Collection Permissions', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then((m) => m.default),
        host: 'localhost',
        port: FIRESTORE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      await setDoc(doc(adminDb, 'tenants/tenant-a'), { name: 'Tenant A' });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
        uid: 'owner-a',
        role: 'owner',
        modules: ['hiring', 'staff', 'timeleave', 'performance', 'reports'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/hiring-viewer'), {
        uid: 'hiring-viewer',
        role: 'viewer',
        modules: ['hiring'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/perf-viewer'), {
        uid: 'perf-viewer',
        role: 'viewer',
        modules: ['performance'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/basic-user'), {
        uid: 'basic-user',
        role: 'viewer',
        modules: [],
        employeeId: 'emp-basic',
      });

      await setDoc(doc(adminDb, 'jobs/job-a-1'), {
        tenantId: 'tenant-a',
        title: 'Engineer',
        status: 'open',
        createdAt: new Date(),
      });
      await setDoc(doc(adminDb, 'interviews/interview-a-1'), {
        tenantId: 'tenant-a',
        candidateName: 'Alice',
        interviewDate: '2026-03-10',
        interviewTime: '09:00',
        status: 'scheduled',
        createdAt: new Date(),
      });
      await setDoc(doc(adminDb, 'reviews/review-a-1'), {
        tenantId: 'tenant-a',
        employeeId: 'emp-basic',
        reviewerId: 'owner-a',
        status: 'draft',
        createdAt: new Date(),
      });
      await setDoc(doc(adminDb, 'okrs/okr-a-1'), {
        tenantId: 'tenant-a',
        ownerId: 'perf-viewer',
        title: 'Raise QA coverage',
        status: 'active',
        progress: 25,
        createdAt: new Date(),
      });
      await setDoc(doc(adminDb, 'disciplinary/discipline-a-1'), {
        tenantId: 'tenant-a',
        employeeId: 'emp-basic',
        status: 'open',
        severity: 'medium',
        createdAt: new Date(),
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/employees/emp-basic'), {
        firstName: 'Legacy',
        lastName: 'User',
        phone: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        updatedAt: new Date(),
      });
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows hiring module users to read legacy jobs and interviews', async () => {
    const hiringDb = testEnv.authenticatedContext('hiring-viewer').firestore();

    await assertSucceeds(getDoc(doc(hiringDb, 'jobs/job-a-1')));
    await assertSucceeds(getDoc(doc(hiringDb, 'interviews/interview-a-1')));
  });

  it('blocks non-hiring users from reading legacy hiring data', async () => {
    const basicDb = testEnv.authenticatedContext('basic-user').firestore();

    await assertFails(getDoc(doc(basicDb, 'jobs/job-a-1')));
    await assertFails(getDoc(doc(basicDb, 'interviews/interview-a-1')));
  });

  it('allows performance module users to read performance records while blocking unrelated members', async () => {
    const perfDb = testEnv.authenticatedContext('perf-viewer').firestore();
    const basicDb = testEnv.authenticatedContext('basic-user').firestore();

    await assertSucceeds(getDoc(doc(perfDb, 'okrs/okr-a-1')));
    await assertSucceeds(getDoc(doc(perfDb, 'disciplinary/discipline-a-1')));
    await assertFails(getDoc(doc(basicDb, 'disciplinary/discipline-a-1')));
  });

  it('allows employees to read their own review without the performance module', async () => {
    const basicDb = testEnv.authenticatedContext('basic-user').firestore();

    await assertSucceeds(getDoc(doc(basicDb, 'reviews/review-a-1')));
  });

  it('allows self-service profile edits on legacy flat employee docs', async () => {
    const basicDb = testEnv.authenticatedContext('basic-user').firestore();

    await assertSucceeds(updateDoc(doc(basicDb, 'tenants/tenant-a/employees/emp-basic'), {
      'personalInfo.phone': '+67077778888',
      'personalInfo.address': 'Dili',
      phone: '+67077778888',
      address: 'Dili',
      emergencyContactName: 'Ana',
      emergencyContactPhone: '+67070000000',
      updatedAt: new Date(),
    }));
  });
});
