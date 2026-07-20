import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-member-self-update';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);

// isSelfEmployee() resolves a user's employee identity from their member doc's
// employeeId. If a member could rewrite that field on their own record they
// could impersonate a colleague and unlock their payslips/PII, so member
// self-updates are allowlisted to harmless profile fields only.
describe('Member self-update allowlist (identity-field escalation)', () => {
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
        modules: ['staff'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-a/members/viewer-a'), {
        uid: 'viewer-a',
        role: 'viewer',
        email: 'viewer@tenant-a.com',
        displayName: 'Viewer A',
        modules: ['staff'],
        employeeId: 'emp-self',
        departmentId: 'dept-1',
      });
    });
  });

  const viewerDb = () => testEnv.authenticatedContext('viewer-a').firestore();
  const ownerDb = () => testEnv.authenticatedContext('owner-a').firestore();
  const selfRef = (db: ReturnType<typeof viewerDb>) =>
    doc(db, 'tenants/tenant-a/members/viewer-a');

  it('allows a member to update their own displayName and lastActiveAt', async () => {
    await assertSucceeds(
      updateDoc(selfRef(viewerDb()), {
        displayName: 'New Name',
        lastActiveAt: new Date(),
      }),
    );
  });

  it('blocks a member from reassigning their own employeeId to a colleague', async () => {
    await assertFails(updateDoc(selfRef(viewerDb()), { employeeId: 'emp-colleague' }));
  });

  it('blocks a member from clearing or adding identity fields (uid, email, departmentId)', async () => {
    await assertFails(updateDoc(selfRef(viewerDb()), { uid: 'someone-else' }));
    await assertFails(updateDoc(selfRef(viewerDb()), { email: 'attacker@evil.com' }));
    await assertFails(updateDoc(selfRef(viewerDb()), { departmentId: 'dept-2' }));
  });

  it('still blocks role/modules/permissions self-escalation', async () => {
    await assertFails(updateDoc(selfRef(viewerDb()), { role: 'owner' }));
    await assertFails(updateDoc(selfRef(viewerDb()), { modules: ['payroll'] }));
    await assertFails(updateDoc(selfRef(viewerDb()), { permissions: { all: true } }));
  });

  it('blocks self-granting accounting-partner links', async () => {
    await assertFails(updateDoc(selfRef(viewerDb()), { partnerId: 'firm-1' }));
    await assertFails(
      updateDoc(selfRef(viewerDb()), { partnerTenantId: 'firm-tenant' }),
    );
  });

  it('blocks a mixed write that hides employeeId behind an allowed field', async () => {
    await assertFails(
      updateDoc(selfRef(viewerDb()), {
        displayName: 'Innocent',
        employeeId: 'emp-colleague',
      }),
    );
  });

  it('still lets a tenant admin manage another member’s employeeId', async () => {
    await assertSucceeds(
      updateDoc(doc(ownerDb(), 'tenants/tenant-a/members/viewer-a'), {
        employeeId: 'emp-reassigned',
      }),
    );
  });
});
