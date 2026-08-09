import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-product-milestones';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TID = 'tenant-a';
const OWNER = 'owner-a';
const ACCOUNTANT = 'accountant-a';
const VIEWER = 'viewer-a';

describe('privacy-safe product milestone rules', () => {
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
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `tenants/${TID}`), { id: TID, createdBy: OWNER });
      await setDoc(doc(adminDb, `tenants/${TID}/members/${OWNER}`), {
        uid: OWNER,
        role: 'owner',
      });
      await setDoc(doc(adminDb, `tenants/${TID}/members/${ACCOUNTANT}`), {
        uid: ACCOUNTANT,
        role: 'accountant',
      });
      await setDoc(doc(adminDb, `tenants/${TID}/members/${VIEWER}`), {
        uid: VIEWER,
        role: 'viewer',
      });
    });
  });

  const asUser = (uid: string) => env.authenticatedContext(uid).firestore();
  const milestoneRef = (uid: string, milestone = 'first_invoice_created') =>
    doc(asUser(uid), `tenants/${TID}/productMilestones/${milestone}`);
  const validMilestone = (milestone = 'first_invoice_created') => ({
    milestone,
    schemaVersion: 1,
    reachedAt: serverTimestamp(),
  });

  it('allows an owner or finance admin to create an allowlisted milestone', async () => {
    await assertSucceeds(setDoc(milestoneRef(OWNER), validMilestone()));
    await assertSucceeds(
      setDoc(
        milestoneRef(ACCOUNTANT, 'first_bill_created'),
        validMilestone('first_bill_created'),
      ),
    );
  });

  it('rejects extra identifying data and unknown milestones', async () => {
    await assertFails(setDoc(milestoneRef(OWNER), {
      ...validMilestone(),
      userId: OWNER,
    }));
    await assertFails(
      setDoc(milestoneRef(OWNER, 'invoice_opened'), validMilestone('invoice_opened')),
    );
  });

  it('is create-only and unavailable to ordinary members', async () => {
    await assertFails(setDoc(milestoneRef(VIEWER), validMilestone()));
    await assertSucceeds(setDoc(milestoneRef(OWNER), validMilestone()));
    await assertFails(updateDoc(milestoneRef(OWNER), { schemaVersion: 2 }));
  });

  it('keeps milestone reads admin-only', async () => {
    await assertSucceeds(setDoc(milestoneRef(OWNER), validMilestone()));
    await assertSucceeds(getDoc(milestoneRef(OWNER)));
    await assertFails(getDoc(milestoneRef(VIEWER)));
  });
});
