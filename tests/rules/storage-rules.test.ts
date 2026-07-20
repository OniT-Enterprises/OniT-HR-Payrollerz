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
// A member with no staff/hiring/payroll access and no linked employee — the
// case the pre-fix rules leaked colleagues' IDs/medical/payslips to.
const OUTSIDER_A = 'outsider-a';
// A member linked to emp-1, used to prove self-access to own docs/payslips.
const SELF_A = 'self-a';

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
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${OUTSIDER_A}`), {
        uid: OUTSIDER_A,
        role: 'viewer',
        modules: ['timeleave'],
      });
      await setDoc(doc(adminDb, `tenants/tenant-a/members/${SELF_A}`), {
        uid: SELF_A,
        role: 'viewer',
        modules: ['timeleave'],
        employeeId: 'emp-1',
      });
      await setDoc(doc(adminDb, 'tenants/tenant-b'), { id: 'tenant-b', name: 'Tenant B' });
      await setDoc(doc(adminDb, `tenants/tenant-b/members/${OWNER_B}`), {
        uid: OWNER_B,
        role: 'owner',
      });
      await setDoc(doc(adminDb, 'jobs/open-job'), {
        tenantId: 'tenant-a',
        title: 'Office Assistant',
        status: 'open',
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
        ref(adminStorage, 'tenants/tenant-a/payslips/run-1/emp-1_1700000000000.pdf'),
        'payslip-bytes',
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
    const contract = 'tenants/tenant-a/employees/emp-1/documents/contract.pdf';

    it('staff/admin can read employee documents', async () => {
      await assertSucceeds(getBytes(ref(storageAs(OWNER_A), contract))); // owner
      await assertSucceeds(getBytes(ref(storageAs(VIEWER_A), contract))); // staff module
    });

    it('the employee can read their own documents', async () => {
      await assertSucceeds(getBytes(ref(storageAs(SELF_A), contract)));
    });

    it('a member without staff/hiring access and not the employee cannot read them', async () => {
      // Pre-fix this leaked IDs/medical certs to any signed-in colleague.
      await assertFails(getBytes(ref(storageAs(OUTSIDER_A), contract)));
    });

    it('another tenant cannot read them', async () => {
      await assertFails(getBytes(ref(storageAs(OWNER_B), contract)));
    });

    it('unauthenticated users cannot read them', async () => {
      await assertFails(getBytes(ref(anonStorage(), contract)));
    });
  });

  describe('payslip PDF access', () => {
    const payslip = 'tenants/tenant-a/payslips/run-1/emp-1_1700000000000.pdf';

    it('the payroll set can read payslips', async () => {
      await assertSucceeds(getBytes(ref(storageAs(OWNER_A), payslip))); // owner
    });

    it('the employee can read their own payslip (filename prefix)', async () => {
      await assertSucceeds(getBytes(ref(storageAs(SELF_A), payslip)));
    });

    it('a member without payroll access and not the employee cannot read payslips', async () => {
      // Pre-fix any tenant member could read every colleague's salary.
      await assertFails(getBytes(ref(storageAs(OUTSIDER_A), payslip)));
      await assertFails(getBytes(ref(storageAs(VIEWER_A), payslip))); // staff, not payroll
    });

    it('another tenant cannot read payslips', async () => {
      await assertFails(getBytes(ref(storageAs(OWNER_B), payslip)));
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

  describe('public job application uploads', () => {
    const resumePath = 'public/jobApplications/tenant-a/open-job/application-1/resume.pdf';

    it('allows an anonymous CV upload for an open job and only hiring staff can read it', async () => {
      await assertSucceeds(
        uploadString(ref(anonStorage(), resumePath), 'pdf-bytes', undefined, {
          contentType: 'application/pdf',
        }),
      );
      await assertSucceeds(getBytes(ref(storageAs(OWNER_A), resumePath)));
      await assertFails(getBytes(ref(anonStorage(), resumePath)));
    });

    it('rejects identity-document and non-CV uploads on the public path', async () => {
      await assertFails(
        uploadString(
          ref(anonStorage(), 'public/jobApplications/tenant-a/open-job/application-1/id_document.pdf'),
          'pdf-bytes',
          undefined,
          { contentType: 'application/pdf' },
        ),
      );
      await assertFails(
        uploadString(
          ref(anonStorage(), 'public/jobApplications/tenant-a/open-job/application-1/resume.png'),
          'image-bytes',
          undefined,
          { contentType: 'image/png' },
        ),
      );
    });

    it('rejects an image content-type even under the resume.pdf filename', async () => {
      // Pre-fix isAllowedDocType permitted image/* so a 10MB image named
      // resume.pdf slipped through; isResumeDocType now blocks it.
      await assertFails(
        uploadString(ref(anonStorage(), resumePath), 'image-bytes', undefined, {
          contentType: 'image/png',
        }),
      );
    });

    it('rejects an anonymous upload over the 4 MB public cap', async () => {
      const big = 'x'.repeat(4 * 1024 * 1024 + 1);
      await assertFails(
        uploadString(ref(anonStorage(), resumePath), big, undefined, {
          contentType: 'application/pdf',
        }),
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
