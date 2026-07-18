/**
 * Storage rules tests (Storage emulator + cross-service Firestore lookups).
 *
 * Pins:
 * - Tenant isolation on employee documents (member reads own tenant only).
 * - Admin-only writes with type/size constraints.
 * - The removed legacy pre-tenant-isolation paths (/employees/**, /expenses/**)
 *   are DENIED — they used to allow cross-tenant reads to any signed-in user.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cross-service firestore.get()/exists() lookups inside the Storage emulator
// are wired to the project the emulator suite was started with — an arbitrary
// per-file project id (the pattern the Firestore rules tests use) silently
// resolves to an empty namespace and every membership check denies. GCLOUD_PROJECT
// is set by `firebase emulators:exec`.
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'onit-hr-payroll';
const FIRESTORE_EMULATOR_PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081);
const STORAGE_EMULATOR_PORT = Number(process.env.STORAGE_EMULATOR_PORT || 9199);

const OWNER_A = 'owner-a';
const VIEWER_A = 'viewer-a';
const OWNER_B = 'owner-b';

describe('Storage rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then(m => m.default),
        host: 'localhost',
        port: FIRESTORE_EMULATOR_PORT,
      },
      storage: {
        rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
        host: 'localhost',
        port: STORAGE_EMULATOR_PORT,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'tenants/tenant-a'), { id: 'tenant-a', name: 'Tenant A' });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${OWNER_A}`), {
        uid: OWNER_A,
        role: 'owner',
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${VIEWER_A}`), {
        uid: VIEWER_A,
        role: 'viewer',
        modules: ['staff'],
      });
      await setDoc(doc(adminDb, 'tenants/tenant-b'), { id: 'tenant-b', name: 'Tenant B' });
      await setDoc(doc(adminDb, `tenants/tenant-b/members/${OWNER_B}`), {
        uid: OWNER_B,
        role: 'owner',
      });

      // Seed files: one tenant-scoped employee document, one on each legacy path
      const adminStorage = context.storage();
      await uploadString(
        ref(adminStorage, 'tenants/tenant-a/employees/emp-1/documents/contract.pdf'),
        'pdf-bytes',
        undefined,
        { contentType: 'application/pdf' },
      );
      await uploadString(
        ref(adminStorage, 'employees/emp-1/documents/legacy-cv.pdf'),
        'legacy-bytes',
        undefined,
        { contentType: 'application/pdf' },
      );
      await uploadString(
        ref(adminStorage, 'expenses/exp-1/legacy-receipt.pdf'),
        'legacy-bytes',
        undefined,
        { contentType: 'application/pdf' },
      );
    });
  });

  const storageAs = (uid: string) => testEnv.authenticatedContext(uid).storage();
  const anonStorage = () => testEnv.unauthenticatedContext().storage();

  describe('tenant isolation on employee documents', () => {
    it('tenant member can read own tenant files', async () => {
      await assertSucceeds(
        getBytes(ref(storageAs(OWNER_A), 'tenants/tenant-a/employees/emp-1/documents/contract.pdf')),
      );
    });

    it('another tenant cannot read them', async () => {
      await assertFails(
        getBytes(ref(storageAs(OWNER_B), 'tenants/tenant-a/employees/emp-1/documents/contract.pdf')),
      );
    });

    it('unauthenticated users cannot read them', async () => {
      await assertFails(
        getBytes(ref(anonStorage(), 'tenants/tenant-a/employees/emp-1/documents/contract.pdf')),
      );
    });
  });

  describe('employee document writes', () => {
    it('tenant admin can upload an allowed document type', async () => {
      await assertSucceeds(
        uploadString(
          ref(storageAs(OWNER_A), 'tenants/tenant-a/employees/emp-1/documents/visa.pdf'),
          'pdf-bytes',
          undefined,
          { contentType: 'application/pdf' },
        ),
      );
    });

    it('non-admin member cannot upload', async () => {
      await assertFails(
        uploadString(
          ref(storageAs(VIEWER_A), 'tenants/tenant-a/employees/emp-1/documents/visa.pdf'),
          'pdf-bytes',
          undefined,
          { contentType: 'application/pdf' },
        ),
      );
    });

    it('disallowed content types are rejected even for admins', async () => {
      await assertFails(
        uploadString(
          ref(storageAs(OWNER_A), 'tenants/tenant-a/employees/emp-1/documents/script.html'),
          '<script>alert(1)</script>',
          undefined,
          { contentType: 'text/html' },
        ),
      );
    });
  });

  describe('legacy pre-tenant-isolation paths stay dead', () => {
    it('authenticated users cannot read /employees/**', async () => {
      await assertFails(
        getBytes(ref(storageAs(OWNER_A), 'employees/emp-1/documents/legacy-cv.pdf')),
      );
    });

    it('authenticated users cannot read /expenses/**', async () => {
      await assertFails(
        getBytes(ref(storageAs(OWNER_A), 'expenses/exp-1/legacy-receipt.pdf')),
      );
    });

    it('writes to legacy paths stay denied', async () => {
      await assertFails(
        uploadString(
          ref(storageAs(OWNER_A), 'employees/emp-9/documents/new.pdf'),
          'pdf-bytes',
          undefined,
          { contentType: 'application/pdf' },
        ),
      );
    });
  });

  describe('catch-all', () => {
    it('unknown paths are denied even for tenant owners', async () => {
      await assertFails(
        getBytes(ref(storageAs(OWNER_A), 'random/other/path.txt')),
      );
    });
  });
});
