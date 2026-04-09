/**
 * Settings Service
 * Manages company/tenant settings in Firestore
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { auditLogService } from './auditLogService';
import type { AuditContext } from './employeeService';
import {
  TenantSettings,
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
  TL_DEFAULT_PAYROLL_CONFIG,
  TL_DEFAULT_LEAVE_POLICIES,
} from '@/types/settings';

const LEGACY_SETTINGS_COLLECTION = 'tenant_settings';

// ============================================
// Tenant Settings
// ============================================

export const settingsService = {
  /**
   * Get tenant settings by tenant ID
   */
  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          id: tenantId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as TenantSettings;
      }

      // Legacy fallback (single-tenant -> multi-tenant migration)
      const legacyRef = doc(db, LEGACY_SETTINGS_COLLECTION, tenantId);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const legacy = legacySnap.data();

        // Best-effort migration: copy legacy settings into tenant-scoped path.
        await setDoc(docRef, {
          ...legacy,
          tenantId,
          migratedFromLegacy: true,
          migratedAt: serverTimestamp(),
        }, { merge: true });

        return {
          ...legacy,
          id: tenantId,
          createdAt: legacy.createdAt?.toDate?.() || new Date(),
          updatedAt: legacy.updatedAt?.toDate?.() || new Date(),
        } as TenantSettings;
      }

      return null;
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },

  /**
   * Create initial settings for a new tenant
   */
  async createSettings(tenantId: string): Promise<TenantSettings> {
    const defaultSettings: Omit<TenantSettings, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId,
      companyDetails: {
        legalName: '',
        registeredAddress: '',
        city: '',
        country: 'Timor-Leste',
        tinNumber: '',
        businessType: 'Lda',
      },
      companyStructure: {
        businessSector: 'other',
        workLocations: [],
        departments: [],
        employeeGrades: [
          { grade: 'director', label: 'Director', isActive: true },
          { grade: 'senior_management', label: 'Senior Management', isActive: true },
          { grade: 'management', label: 'Management', isActive: true },
          { grade: 'supervisor', label: 'Supervisor', isActive: true },
          { grade: 'general_staff', label: 'General Staff', isActive: true },
        ],
      },
      paymentStructure: {
        paymentMethods: ['bank_transfer'],
        primaryPaymentMethod: 'bank_transfer',
        bankAccounts: [],
        employmentTypes: ['open_ended', 'fixed_term'],
        payrollFrequencies: ['monthly'],
        payrollPeriods: [
          {
            frequency: 'monthly',
            startDay: 1,
            endDay: 31,
            payDay: 25,
            isActive: true,
          },
        ],
      },
      timeOffPolicies: TL_DEFAULT_LEAVE_POLICIES,
      payrollConfig: TL_DEFAULT_PAYROLL_CONFIG,
      hrAdminIds: [],
      setupComplete: false,
      setupProgress: {
        companyDetails: false,
        companyStructure: false,
        paymentStructure: false,
        timeOffPolicies: false,
        payrollConfig: false,
      },
    };

    try {
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        ...defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        ...defaultSettings,
        id: tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error creating settings:', error);
      throw error;
    }
  },

  /**
   * Update company details
   */
  async updateCompanyDetails(
    tenantId: string,
    companyDetails: CompanyDetails,
    audit?: AuditContext
  ): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        companyDetails,
        'setupProgress.companyDetails': true,
        updatedAt: serverTimestamp(),
      });

      // Log to audit trail if context provided
      if (audit) {
        await auditLogService.log({
          ...audit,
          tenantId,
          action: 'settings.company_update',
          entityId: tenantId,
          entityType: 'tenant_settings',
          description: `Updated company details: ${companyDetails.legalName || 'Company'}`,
          newValue: companyDetails as unknown as Record<string, unknown>,
        }).catch(err => console.error('Audit log failed:', err));
      }
    } catch (error) {
      console.error('Error updating company details:', error);
      throw error;
    }
  },

  /**
   * Update company structure
   */
  async updateCompanyStructure(
    tenantId: string,
    companyStructure: CompanyStructure
  ): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        companyStructure,
        'setupProgress.companyStructure': true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating company structure:', error);
      throw error;
    }
  },

  /**
   * Update payment structure
   */
  async updatePaymentStructure(
    tenantId: string,
    paymentStructure: Partial<PaymentStructure> | Record<string, unknown>
  ): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        paymentStructure,
        'setupProgress.paymentStructure': true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating payment structure:', error);
      throw error;
    }
  },

  /**
   * Update time-off policies
   */
  async updateTimeOffPolicies(
    tenantId: string,
    timeOffPolicies: Partial<TimeOffPolicies> | Record<string, unknown>
  ): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        timeOffPolicies,
        'setupProgress.timeOffPolicies': true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating time-off policies:', error);
      throw error;
    }
  },

  /**
   * Update payroll config
   */
  async updatePayrollConfig(
    tenantId: string,
    payrollConfig: Partial<PayrollConfig> | Record<string, unknown>,
    audit?: AuditContext
  ): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        payrollConfig,
        'setupProgress.payrollConfig': true,
        updatedAt: serverTimestamp(),
      });

      // Log to audit trail if context provided
      if (audit) {
        await auditLogService.log({
          ...audit,
          tenantId,
          action: 'settings.update',
          entityId: tenantId,
          entityType: 'tenant_settings',
          description: 'Updated payroll configuration',
          newValue: payrollConfig as unknown as Record<string, unknown>,
        }).catch(err => console.error('Audit log failed:', err));
      }
    } catch (error) {
      console.error('Error updating payroll config:', error);
      throw error;
    }
  },

  /**
   * Mark setup as complete
   */
  async completeSetup(tenantId: string): Promise<void> {
    try {
      const docRef = doc(db, paths.settings(tenantId));
      await updateDoc(docRef, {
        setupComplete: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error completing setup:', error);
      throw error;
    }
  },

  /**
   * Check setup progress
   */
  async getSetupProgress(tenantId: string): Promise<{
    isComplete: boolean;
    progress: Record<string, boolean>;
    percentComplete: number;
  }> {
    const settings = await this.getSettings(tenantId);

    if (!settings) {
      return {
        isComplete: false,
        progress: {
          companyDetails: false,
          companyStructure: false,
          paymentStructure: false,
          timeOffPolicies: false,
          payrollConfig: false,
        },
        percentComplete: 0,
      };
    }

    const progress = settings.setupProgress;
    const steps = Object.values(progress);
    const completed = steps.filter(Boolean).length;
    const percentComplete = Math.round((completed / steps.length) * 100);

    return {
      isComplete: settings.setupComplete,
      progress,
      percentComplete,
    };
  },
};

