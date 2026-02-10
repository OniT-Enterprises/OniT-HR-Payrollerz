/**
 * Admin service for superadmin operations
 * Manages tenants, users, and audit logging
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { TenantConfig, TenantStatus, TenantPlan, PLAN_LIMITS } from '@/types/tenant';
import { UserProfile, AdminAuditEntry, AuditLogEntry } from '@/types/user';

export type { AuditLogEntry };

// Generate a URL-safe tenant ID from name
function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

// Generate unique tenant ID
function generateTenantId(name: string): string {
  const slug = generateTenantSlug(name);
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

class AdminService {
  // ============================================
  // TENANT MANAGEMENT
  // ============================================

  async getAllTenants(): Promise<TenantConfig[]> {
    if (!db) return [];

    try {
      const tenantsRef = collection(db, paths.tenants());
      const q = query(tenantsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TenantConfig[];
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  }

  async getTenantById(tenantId: string): Promise<TenantConfig | null> {
    if (!db) return null;

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const snapshot = await getDoc(tenantRef);

      if (!snapshot.exists()) return null;

      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as TenantConfig;
    } catch (error) {
      console.error('Error fetching tenant:', error);
      throw error;
    }
  }

  async createTenant(
    name: string,
    ownerEmail: string,
    ownerUid: string,
    plan: TenantPlan = 'free',
    createdBy: string
  ): Promise<string> {
    if (!db) throw new Error('Database not available');

    try {
      const tenantId = generateTenantId(name);
      const tenantRef = doc(db, paths.tenant(tenantId));

      const tenantConfig: Omit<TenantConfig, 'id'> = {
        name,
        slug: generateTenantSlug(name),
        status: 'active',
        plan,
        limits: PLAN_LIMITS[plan],
        billingEmail: ownerEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy,
        features: {
          hiring: true,
          timeleave: true,
          performance: true,
          payroll: plan !== 'free',
          reports: true,
        },
        settings: {
          timezone: 'Asia/Dili',
          currency: 'USD',
          dateFormat: 'DD/MM/YYYY',
        },
      };

      await setDoc(tenantRef, tenantConfig);

      // Create owner membership
      const memberRef = doc(db, paths.member(tenantId, ownerUid));
      await setDoc(memberRef, {
        uid: ownerUid,
        email: ownerEmail,
        role: 'owner',
        modules: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'reports'],
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      // Update user's tenantIds and tenantAccess (denormalized for faster loading)
      const userRef = doc(db, paths.user(ownerUid));
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const tenantIds = userData.tenantIds || [];
        const tenantAccess = userData.tenantAccess || {};

        if (!tenantIds.includes(tenantId)) {
          await updateDoc(userRef, {
            tenantIds: [...tenantIds, tenantId],
            tenantAccess: {
              ...tenantAccess,
              [tenantId]: { name, role: 'owner' },
            },
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Log the action
      await this.logAdminAction({
        action: 'tenant_created',
        actorUid: createdBy,
        actorEmail: ownerEmail,
        targetType: 'tenant',
        targetId: tenantId,
        targetName: name,
        details: { plan, ownerUid },
        timestamp: Timestamp.now(),
      });

      return tenantId;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async updateTenant(tenantId: string, updates: Partial<TenantConfig>): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      await updateDoc(tenantRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async suspendTenant(
    tenantId: string,
    reason: string,
    actorUid: string,
    actorEmail: string
  ): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        throw new Error('Tenant not found');
      }

      await updateDoc(tenantRef, {
        status: 'suspended' as TenantStatus,
        suspendedAt: serverTimestamp(),
        suspendedBy: actorUid,
        suspendedReason: reason,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: 'tenant_suspended',
        actorUid,
        actorEmail,
        targetType: 'tenant',
        targetId: tenantId,
        targetName: tenantSnap.data()?.name,
        details: { reason },
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error suspending tenant:', error);
      throw error;
    }
  }

  async reactivateTenant(
    tenantId: string,
    actorUid: string,
    actorEmail: string
  ): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        throw new Error('Tenant not found');
      }

      await updateDoc(tenantRef, {
        status: 'active' as TenantStatus,
        suspendedAt: null,
        suspendedBy: null,
        suspendedReason: null,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: 'tenant_reactivated',
        actorUid,
        actorEmail,
        targetType: 'tenant',
        targetId: tenantId,
        targetName: tenantSnap.data()?.name,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error reactivating tenant:', error);
      throw error;
    }
  }

  async getTenantStats(tenantId: string): Promise<{
    memberCount: number;
    employeeCount: number;
  }> {
    if (!db) return { memberCount: 0, employeeCount: 0 };

    try {
      const membersRef = collection(db, paths.members(tenantId));
      const employeesRef = collection(db, paths.employees(tenantId));

      const [membersSnap, employeesSnap] = await Promise.all([
        getDocs(membersRef),
        getDocs(employeesRef),
      ]);

      return {
        memberCount: membersSnap.size,
        employeeCount: employeesSnap.size,
      };
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      return { memberCount: 0, employeeCount: 0 };
    }
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async getAllUsers(maxResults = 100): Promise<UserProfile[]> {
    if (!db) return [];

    try {
      const usersRef = collection(db, paths.users());
      const q = query(usersRef, orderBy('createdAt', 'desc'), limit(maxResults));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as UserProfile[];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async getUserById(uid: string): Promise<UserProfile | null> {
    if (!db) return null;

    try {
      const userRef = doc(db, paths.user(uid));
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) return null;

      return {
        uid: snapshot.id,
        ...snapshot.data(),
      } as UserProfile;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  async setUserSuperadmin(
    targetUid: string,
    isSuperAdmin: boolean,
    actorUid: string,
    actorEmail: string
  ): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const userRef = doc(db, paths.user(targetUid));
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      await updateDoc(userRef, {
        isSuperAdmin,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: isSuperAdmin ? 'user_superadmin_granted' : 'user_superadmin_revoked',
        actorUid,
        actorEmail,
        targetType: 'user',
        targetId: targetUid,
        targetName: userSnap.data()?.email,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error setting user superadmin status:', error);
      throw error;
    }
  }

  // Alias for simpler API
  async setSuperadmin(targetUid: string, isSuperAdmin: boolean): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const userRef = doc(db, paths.user(targetUid));
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      await updateDoc(userRef, {
        isSuperAdmin,
        updatedAt: serverTimestamp(),
      });

      // Note: Audit logging should be done by calling code with proper actor info
    } catch (error) {
      console.error('Error setting superadmin status:', error);
      throw error;
    }
  }

  // ============================================
  // IMPERSONATION
  // ============================================

  async startImpersonation(
    actorUid: string,
    actorEmail: string,
    tenantId: string,
    tenantName: string
  ): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const userRef = doc(db, paths.user(actorUid));

      await updateDoc(userRef, {
        impersonating: {
          tenantId,
          tenantName,
          startedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: 'impersonation_started',
        actorUid,
        actorEmail,
        targetType: 'tenant',
        targetId: tenantId,
        targetName: tenantName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error starting impersonation:', error);
      throw error;
    }
  }

  async stopImpersonation(
    actorUid: string,
    actorEmail: string,
    tenantId: string,
    tenantName: string
  ): Promise<void> {
    if (!db) throw new Error('Database not available');

    try {
      const userRef = doc(db, paths.user(actorUid));

      await updateDoc(userRef, {
        impersonating: null,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: 'impersonation_ended',
        actorUid,
        actorEmail,
        targetType: 'tenant',
        targetId: tenantId,
        targetName: tenantName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      throw error;
    }
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  async logAdminAction(entry: AdminAuditEntry): Promise<void> {
    if (!db) return;

    try {
      const logRef = collection(db, paths.adminAuditLog());
      const docRef = doc(logRef);
      await setDoc(docRef, {
        ...entry,
        id: docRef.id,
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
      // Don't throw - audit logging should not break main operations
    }
  }

  async getAuditLog(maxResults = 50): Promise<AdminAuditEntry[]> {
    if (!db) return [];

    try {
      const logRef = collection(db, paths.adminAuditLog());
      const q = query(logRef, orderBy('timestamp', 'desc'), limit(maxResults));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => doc.data() as AdminAuditEntry);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
export default adminService;
