/**
 * Firestore Security Rules Tests for Tenant Isolation
 * 
 * These tests verify that:
 * 1. Users can only access data within their authorized tenants
 * 2. Cross-tenant data access is properly blocked
 * 3. Unauthenticated users cannot access tenant data
 * 4. Role-based permissions work correctly within tenants
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { 
  initializeTestEnvironment, 
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-tenant-isolation';

interface TestUser {
  uid: string;
  email: string;
  tenants: string[];
  role?: string;
}

const testUsers: Record<string, TestUser> = {
  tenantAOwner: {
    uid: 'owner-a',
    email: 'owner@company-a.com',
    tenants: ['tenant-a'],
    role: 'owner',
  },
  tenantAHrAdmin: {
    uid: 'hr-admin-a', 
    email: 'hr@company-a.com',
    tenants: ['tenant-a'],
    role: 'hr-admin',
  },
  tenantBOwner: {
    uid: 'owner-b',
    email: 'owner@company-b.com', 
    tenants: ['tenant-b'],
    role: 'owner',
  },
  multiTenantUser: {
    uid: 'multi-user',
    email: 'consultant@example.com',
    tenants: ['tenant-a', 'tenant-b'],
    role: 'viewer',
  },
  unauthorizedUser: {
    uid: 'unauthorized',
    email: 'unauthorized@example.com',
    tenants: [],
  },
};

describe('Tenant Isolation Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: await import('../../firestore.rules?raw').then(m => m.default),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    
    // Set up test data
    await setupTestData();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  async function setupTestData() {
    const adminDb = testEnv.authenticatedContext('admin', {
      admin: true,
    }).firestore();

    // Create tenant documents
    await setDoc(doc(adminDb, 'tenants/tenant-a'), {
      name: 'Company A',
      createdAt: new Date(),
    });

    await setDoc(doc(adminDb, 'tenants/tenant-b'), {
      name: 'Company B', 
      createdAt: new Date(),
    });

    // Create tenant member documents
    await setDoc(doc(adminDb, 'tenants/tenant-a/members/owner-a'), {
      uid: 'owner-a',
      role: 'owner',
      modules: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'reports'],
    });

    await setDoc(doc(adminDb, 'tenants/tenant-a/members/hr-admin-a'), {
      uid: 'hr-admin-a',
      role: 'hr-admin', 
      modules: ['hiring', 'staff', 'timeleave', 'payroll'],
    });

    await setDoc(doc(adminDb, 'tenants/tenant-b/members/owner-b'), {
      uid: 'owner-b',
      role: 'owner',
      modules: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'reports'],
    });

    await setDoc(doc(adminDb, 'tenants/tenant-a/members/multi-user'), {
      uid: 'multi-user',
      role: 'viewer',
      modules: ['staff'],
    });

    await setDoc(doc(adminDb, 'tenants/tenant-b/members/multi-user'), {
      uid: 'multi-user', 
      role: 'viewer',
      modules: ['staff'],
    });

    // Create some test business data
    await setDoc(doc(adminDb, 'tenants/tenant-a/departments/dept-a-1'), {
      name: 'Engineering',
      createdAt: new Date(),
    });

    await setDoc(doc(adminDb, 'tenants/tenant-a/employees/emp-a-1'), {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@company-a.com',
      },
      departmentId: 'dept-a-1',
      status: 'active',
    });

    await setDoc(doc(adminDb, 'tenants/tenant-b/departments/dept-b-1'), {
      name: 'Sales',
      createdAt: new Date(),
    });

    await setDoc(doc(adminDb, 'tenants/tenant-b/employees/emp-b-1'), {
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Smith', 
        email: 'jane@company-b.com',
      },
      departmentId: 'dept-b-1',
      status: 'active',
    });
  }

  describe('Tenant Document Access', () => {
    it('should allow tenant members to read their tenant document', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a'))
      );
    });

    it('should deny access to tenant documents for non-members', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantBOwner.uid, {
        tenants: testUsers.tenantBOwner.tenants,
      }).firestore();

      await assertFails(
        getDoc(doc(db, 'tenants/tenant-a'))
      );
    });

    it('should deny unauthenticated access to tenant documents', async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      await assertFails(
        getDoc(doc(db, 'tenants/tenant-a'))
      );
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    it('should allow access to own tenant data', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      // Should be able to read own tenant's departments
      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/departments/dept-a-1'))
      );

      // Should be able to read own tenant's employees
      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/employees/emp-a-1'))
      );
    });

    it('should deny access to other tenant data', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      // Should NOT be able to read other tenant's departments
      await assertFails(
        getDoc(doc(db, 'tenants/tenant-b/departments/dept-b-1'))
      );

      // Should NOT be able to read other tenant's employees
      await assertFails(
        getDoc(doc(db, 'tenants/tenant-b/employees/emp-b-1'))
      );
    });

    it('should allow multi-tenant users to access all their tenants', async () => {
      const db = testEnv.authenticatedContext(testUsers.multiTenantUser.uid, {
        tenants: testUsers.multiTenantUser.tenants,
      }).firestore();

      // Should be able to access tenant A data
      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/employees/emp-a-1'))
      );

      // Should be able to access tenant B data
      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-b/employees/emp-b-1'))
      );
    });

    it('should deny access to collections without tenant claims', async () => {
      const db = testEnv.authenticatedContext(testUsers.unauthorizedUser.uid, {
        tenants: [],
      }).firestore();

      await assertFails(
        getDoc(doc(db, 'tenants/tenant-a/departments/dept-a-1'))
      );

      await assertFails(
        getDoc(doc(db, 'tenants/tenant-b/employees/emp-b-1'))
      );
    });
  });

  describe('Write Operations and Permissions', () => {
    it('should allow owners to create documents', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        setDoc(doc(db, 'tenants/tenant-a/departments/new-dept'), {
          name: 'New Department',
          createdAt: new Date(),
        })
      );
    });

    it('should allow hr-admins to create documents', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAHrAdmin.uid, {
        tenants: testUsers.tenantAHrAdmin.tenants,
      }).firestore();

      await assertSucceeds(
        setDoc(doc(db, 'tenants/tenant-a/employees/new-emp'), {
          personalInfo: {
            firstName: 'New',
            lastName: 'Employee',
            email: 'new@company-a.com',
          },
          departmentId: 'dept-a-1',
          status: 'active',
        })
      );
    });

    it('should deny write operations for viewers', async () => {
      const db = testEnv.authenticatedContext(testUsers.multiTenantUser.uid, {
        tenants: testUsers.multiTenantUser.tenants,
      }).firestore();

      // Viewers should not be able to create documents
      await assertFails(
        setDoc(doc(db, 'tenants/tenant-a/departments/viewer-dept'), {
          name: 'Viewer Department',
          createdAt: new Date(),
        })
      );
    });

    it('should deny cross-tenant write operations', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      // Should not be able to write to other tenant's data
      await assertFails(
        setDoc(doc(db, 'tenants/tenant-b/departments/malicious-dept'), {
          name: 'Malicious Department',
          createdAt: new Date(),
        })
      );
    });
  });

  describe('Collection Queries', () => {
    it('should allow querying own tenant collections', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        getDocs(collection(db, 'tenants/tenant-a/departments'))
      );

      await assertSucceeds(
        getDocs(collection(db, 'tenants/tenant-a/employees'))
      );
    });

    it('should deny querying other tenant collections', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertFails(
        getDocs(collection(db, 'tenants/tenant-b/departments'))
      );

      await assertFails(
        getDocs(collection(db, 'tenants/tenant-b/employees'))
      );
    });
  });

  describe('Member Management', () => {
    it('should allow owners to read member documents', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/members/hr-admin-a'))
      );
    });

    it('should allow hr-admins to read member documents', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAHrAdmin.uid, {
        tenants: testUsers.tenantAHrAdmin.tenants,
      }).firestore();

      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/members/owner-a'))
      );
    });

    it('should allow owners to write member documents', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        setDoc(doc(db, 'tenants/tenant-a/members/new-member'), {
          uid: 'new-member',
          role: 'viewer',
          modules: ['staff'],
        })
      );
    });

    it('should deny cross-tenant member access', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertFails(
        getDoc(doc(db, 'tenants/tenant-b/members/owner-b'))
      );

      await assertFails(
        setDoc(doc(db, 'tenants/tenant-b/members/malicious-member'), {
          uid: 'malicious',
          role: 'owner',
        })
      );
    });
  });

  describe('Reference Data Access', () => {
    it('should allow all users to read reference data', async () => {
      // Set up reference data
      const adminDb = testEnv.authenticatedContext('admin', {
        admin: true,
      }).firestore();

      await setDoc(doc(adminDb, 'reference/holidays/2024-01-01'), {
        name: 'New Year Day',
        type: 'public',
      });

      // Test authenticated user
      const userDb = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        getDoc(doc(userDb, 'reference/holidays/2024-01-01'))
      );

      // Test unauthenticated user
      const anonDb = testEnv.unauthenticatedContext().firestore();
      
      await assertSucceeds(
        getDoc(doc(anonDb, 'reference/holidays/2024-01-01'))
      );
    });

    it('should deny writes to reference data', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertFails(
        setDoc(doc(db, 'reference/holidays/2024-12-25'), {
          name: 'Christmas',
          type: 'public',
        })
      );
    });
  });

  describe('Settings and Configuration', () => {
    it('should allow tenant members to read settings', async () => {
      // Set up settings data
      const adminDb = testEnv.authenticatedContext('admin', {
        admin: true,
      }).firestore();

      await setDoc(doc(adminDb, 'tenants/tenant-a/settings/config'), {
        name: 'Company A',
        timezone: 'UTC',
        currency: 'USD',
      });

      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        getDoc(doc(db, 'tenants/tenant-a/settings/config'))
      );
    });

    it('should allow only owners and hr-admins to write settings', async () => {
      // Owner should be able to write
      const ownerDb = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      await assertSucceeds(
        setDoc(doc(ownerDb, 'tenants/tenant-a/settings/config'), {
          name: 'Updated Company A',
          timezone: 'America/New_York',
        })
      );

      // Viewer should not be able to write
      const viewerDb = testEnv.authenticatedContext(testUsers.multiTenantUser.uid, {
        tenants: testUsers.multiTenantUser.tenants,
      }).firestore();

      await assertFails(
        updateDoc(doc(viewerDb, 'tenants/tenant-a/settings/config'), {
          name: 'Malicious Update',
        })
      );
    });
  });

  describe('Root Collection Denial', () => {
    it('should deny access to any root collections', async () => {
      const db = testEnv.authenticatedContext(testUsers.tenantAOwner.uid, {
        tenants: testUsers.tenantAOwner.tenants,
      }).firestore();

      // Should not be able to access old root collections
      await assertFails(
        getDoc(doc(db, 'departments/old-dept'))
      );

      await assertFails(
        getDoc(doc(db, 'employees/old-emp'))
      );

      await assertFails(
        setDoc(doc(db, 'malicious-collection/doc'), {
          data: 'malicious',
        })
      );
    });
  });
});
