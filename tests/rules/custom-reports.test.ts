/**
 * Firestore Rules Tests: saved custom report configs
 * (tenants/{tid}/customReports — report DEFINITIONS built on the Custom
 * Reports page: name, data source, column keys, filters. No employee data.
 * Managed by anyone who can use the Reports module — module members,
 * managers, admins — strictly tenant-scoped, createdBy pinned to the caller.)
 */

import { describe, it, beforeEach, afterAll, beforeAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'test-custom-reports';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

const OWNER = 'owner-a';
const REPORTS_MEMBER = 'reports-member-a'; // viewer role + reports module
const MANAGER = 'manager-a'; // manager role, NO reports module
const NO_REPORTS = 'viewer-a'; // viewer role, NO reports module
const OUTSIDER = 'owner-b'; // owner of tenant-b only

const REPORT = {
  name: 'Active staff contact list',
  description: 'Contact details for active employees',
  dataSource: 'employees',
  columns: ['personalInfo.firstName', 'personalInfo.lastName', 'personalInfo.email'],
  filters: { department: '', status: 'active', dateRange: '' },
  createdBy: REPORTS_MEMBER,
  createdAt: new Date('2026-07-01'),
};

describe('Custom report config rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then(m => m.default),
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
      await setDoc(doc(adminDb, 'tenants/tenant-a'), { id: 'tenant-a', name: 'Tenant A', createdBy: OWNER });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${OWNER}`), { uid: OWNER, role: 'owner' });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${REPORTS_MEMBER}`), {
        uid: REPORTS_MEMBER,
        role: 'viewer',
        modules: ['staff', 'timeleave', 'reports'],
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${MANAGER}`), {
        uid: MANAGER,
        role: 'manager',
        modules: ['staff', 'timeleave'],
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${NO_REPORTS}`), {
        uid: NO_REPORTS,
        role: 'viewer',
        modules: ['staff'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/customReports/existing'), REPORT);

      await setDoc(doc(adminDb, 'tenants/tenant-b'), { id: 'tenant-b', name: 'Tenant B', createdBy: OUTSIDER });
      await setDoc(doc(adminDb, `tenants/tenant-b/members/${OUTSIDER}`), { uid: OUTSIDER, role: 'owner' });
      await setDoc(doc(adminDb, 'tenants/tenant-b/customReports/theirs'), {
        ...REPORT,
        createdBy: OUTSIDER,
      });
    });
  });

  const asUser = (uid: string) => testEnv.authenticatedContext(uid).firestore();

  it('a member with the reports module can create a report they own', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/r1'), REPORT),
    );
  });

  it('a member with the reports module can read and list saved reports', async () => {
    await assertSucceeds(
      getDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/existing')),
    );
    await assertSucceeds(
      getDocs(collection(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports')),
    );
  });

  it('owner and manager can read and create without an explicit reports module', async () => {
    await assertSucceeds(
      getDoc(doc(asUser(OWNER), 'tenants/tenant-a/customReports/existing')),
    );
    await assertSucceeds(
      setDoc(doc(asUser(OWNER), 'tenants/tenant-a/customReports/r2'), {
        ...REPORT,
        createdBy: OWNER,
      }),
    );
    await assertSucceeds(
      getDoc(doc(asUser(MANAGER), 'tenants/tenant-a/customReports/existing')),
    );
    await assertSucceeds(
      setDoc(doc(asUser(MANAGER), 'tenants/tenant-a/customReports/r3'), {
        ...REPORT,
        createdBy: MANAGER,
      }),
    );
  });

  it('a member without the reports module cannot read or write', async () => {
    await assertFails(
      getDoc(doc(asUser(NO_REPORTS), 'tenants/tenant-a/customReports/existing')),
    );
    await assertFails(
      getDocs(collection(asUser(NO_REPORTS), 'tenants/tenant-a/customReports')),
    );
    await assertFails(
      setDoc(doc(asUser(NO_REPORTS), 'tenants/tenant-a/customReports/r4'), {
        ...REPORT,
        createdBy: NO_REPORTS,
      }),
    );
    await assertFails(
      deleteDoc(doc(asUser(NO_REPORTS), 'tenants/tenant-a/customReports/existing')),
    );
  });

  it('createdBy spoofing is blocked on create', async () => {
    await assertFails(
      setDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/spoof'), {
        ...REPORT,
        createdBy: OWNER,
      }),
    );
  });

  it('createdBy is immutable on update, but lastRunAt stamping works', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/existing'), {
        lastRunAt: new Date(),
      }),
    );
    await assertFails(
      updateDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/existing'), {
        createdBy: OWNER,
      }),
    );
  });

  it('a user from another tenant cannot read, list, write, or delete', async () => {
    await assertFails(
      getDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/customReports/existing')),
    );
    await assertFails(
      getDocs(collection(asUser(OUTSIDER), 'tenants/tenant-a/customReports')),
    );
    await assertFails(
      setDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/customReports/intruder'), {
        ...REPORT,
        createdBy: OUTSIDER,
      }),
    );
    await assertFails(
      deleteDoc(doc(asUser(OUTSIDER), 'tenants/tenant-a/customReports/existing')),
    );
  });

  it('a tenant-a member cannot write into another tenant\'s collection', async () => {
    await assertFails(
      setDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-b/customReports/crosswrite'), REPORT),
    );
    await assertFails(
      getDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-b/customReports/theirs')),
    );
  });

  it('a member with the reports module can delete a saved report', async () => {
    await assertSucceeds(
      deleteDoc(doc(asUser(REPORTS_MEMBER), 'tenants/tenant-a/customReports/existing')),
    );
  });

  it('unauthenticated users are denied', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'tenants/tenant-a/customReports/existing')));
    await assertFails(setDoc(doc(anon, 'tenants/tenant-a/customReports/anon'), REPORT));
  });
});
