import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'test-ekipa-mobile-permissions';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const TENANT_ID = 'tenant-ekipa';

const EMPLOYEE_UID = 'employee-a';
const OTHER_UID = 'employee-b';
const MANAGER_UID = 'manager-a';

describe('Ekipa mobile permissions', () => {
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
      await setDoc(doc(db, `tenants/${TENANT_ID}`), { name: 'Ekipa Test' });
      await setDoc(doc(db, `tenants/${TENANT_ID}/members/${EMPLOYEE_UID}`), {
        uid: EMPLOYEE_UID,
        role: 'employee',
        employeeId: 'emp-a',
        modules: [],
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/members/${OTHER_UID}`), {
        uid: OTHER_UID,
        role: 'employee',
        employeeId: 'emp-b',
        modules: [],
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/members/${MANAGER_UID}`), {
        uid: MANAGER_UID,
        role: 'manager',
        employeeId: 'manager-emp',
        modules: ['timeleave'],
      });

      await setDoc(doc(db, `tenants/${TENANT_ID}/announcements/notice-a`), {
        title: 'Safety update',
        body: 'Wear PPE',
        readBy: {},
        createdAt: new Date(),
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/shifts/self-published`), {
        employeeId: 'emp-a',
        status: 'published',
        date: '2026-07-11',
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/shifts/self-draft`), {
        employeeId: 'emp-a',
        status: 'draft',
        date: '2026-07-12',
      });
      await setDoc(doc(db, `tenants/${TENANT_ID}/shifts/other-published`), {
        employeeId: 'emp-b',
        status: 'published',
        date: '2026-07-11',
      });
    });
  });

  const employeeDb = () => env.authenticatedContext(EMPLOYEE_UID).firestore();
  const managerDb = () => env.authenticatedContext(MANAGER_UID).firestore();

  it('lets an employee mark only their own announcement read receipt', async () => {
    const ref = doc(employeeDb(), `tenants/${TENANT_ID}/announcements/notice-a`);
    await assertSucceeds(updateDoc(ref, {
      [`readBy.${EMPLOYEE_UID}`]: serverTimestamp(),
    }));

    const snapshot = await assertSucceeds(getDoc(ref));
    expect(snapshot.data()?.readBy?.[EMPLOYEE_UID]).toBeTruthy();
  });

  it('blocks announcement content edits and forged read receipts', async () => {
    const ref = doc(employeeDb(), `tenants/${TENANT_ID}/announcements/notice-a`);
    await assertFails(updateDoc(ref, { body: 'Changed by employee' }));
    await assertFails(updateDoc(ref, {
      [`readBy.${OTHER_UID}`]: serverTimestamp(),
    }));
  });

  it('shows employees only their own published shifts', async () => {
    await assertSucceeds(getDoc(doc(
      employeeDb(),
      `tenants/${TENANT_ID}/shifts/self-published`,
    )));
    await assertFails(getDoc(doc(
      employeeDb(),
      `tenants/${TENANT_ID}/shifts/self-draft`,
    )));
    await assertFails(getDoc(doc(
      employeeDb(),
      `tenants/${TENANT_ID}/shifts/other-published`,
    )));
  });

  it('keeps full roster visibility for managers', async () => {
    await assertSucceeds(getDoc(doc(
      managerDb(),
      `tenants/${TENANT_ID}/shifts/self-draft`,
    )));
    await assertSucceeds(getDoc(doc(
      managerDb(),
      `tenants/${TENANT_ID}/shifts/other-published`,
    )));
  });

  it('lets a user register only their own push device', async () => {
    await assertSucceeds(setDoc(
      doc(employeeDb(), `users/${EMPLOYEE_UID}/devices/expo-token`),
      { token: 'ExpoPushToken[test]', provider: 'expo', enabled: true },
    ));
    await assertFails(setDoc(
      doc(employeeDb(), `users/${OTHER_UID}/devices/forged-token`),
      { token: 'ExpoPushToken[forged]', provider: 'expo', enabled: true },
    ));
  });
});
