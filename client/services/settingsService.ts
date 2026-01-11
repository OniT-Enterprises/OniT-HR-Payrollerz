/**
 * Settings Service
 * Manages company/tenant settings in Firestore
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  TenantSettings,
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
  HRAdmin,
  TL_DEFAULT_PAYROLL_CONFIG,
  TL_DEFAULT_LEAVE_POLICIES,
} from '@/types/settings';

const SETTINGS_COLLECTION = 'tenant_settings';
const HR_ADMINS_COLLECTION = 'hr_admins';

// ============================================
// Tenant Settings
// ============================================

export const settingsService = {
  /**
   * Get tenant settings by tenant ID
   */
  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
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
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
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
    companyDetails: CompanyDetails
  ): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
      await updateDoc(docRef, {
        companyDetails,
        'setupProgress.companyDetails': true,
        updatedAt: serverTimestamp(),
      });
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
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
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
    paymentStructure: PaymentStructure
  ): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
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
    timeOffPolicies: TimeOffPolicies
  ): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
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
    payrollConfig: PayrollConfig
  ): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
      await updateDoc(docRef, {
        payrollConfig,
        'setupProgress.payrollConfig': true,
        updatedAt: serverTimestamp(),
      });
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
      const docRef = doc(db, SETTINGS_COLLECTION, tenantId);
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

// ============================================
// HR Admin Management
// ============================================

export const hrAdminService = {
  /**
   * Get all HR admins for a tenant
   */
  async getAdmins(tenantId: string): Promise<HRAdmin[]> {
    // For now, return from tenant settings
    // In production, this would query a separate collection
    const settings = await settingsService.getSettings(tenantId);
    if (!settings) return [];

    // TODO: Implement proper HR admin collection query
    return [];
  },

  /**
   * Add HR admin
   */
  async addAdmin(tenantId: string, admin: Omit<HRAdmin, 'id' | 'createdAt' | 'updatedAt'>): Promise<HRAdmin> {
    try {
      const adminId = `admin_${Date.now()}`;
      const newAdmin: HRAdmin = {
        ...admin,
        id: adminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = doc(db, HR_ADMINS_COLLECTION, adminId);
      await setDoc(docRef, {
        ...newAdmin,
        tenantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add to tenant settings
      const settingsRef = doc(db, SETTINGS_COLLECTION, tenantId);
      const settings = await settingsService.getSettings(tenantId);
      if (settings) {
        await updateDoc(settingsRef, {
          hrAdminIds: [...settings.hrAdminIds, adminId],
          updatedAt: serverTimestamp(),
        });
      }

      return newAdmin;
    } catch (error) {
      console.error('Error adding HR admin:', error);
      throw error;
    }
  },

  /**
   * Update HR admin
   */
  async updateAdmin(adminId: string, updates: Partial<HRAdmin>): Promise<void> {
    try {
      const docRef = doc(db, HR_ADMINS_COLLECTION, adminId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating HR admin:', error);
      throw error;
    }
  },

  /**
   * Remove HR admin
   */
  async removeAdmin(tenantId: string, adminId: string): Promise<void> {
    try {
      // Update tenant settings to remove admin
      const settings = await settingsService.getSettings(tenantId);
      if (settings) {
        const settingsRef = doc(db, SETTINGS_COLLECTION, tenantId);
        await updateDoc(settingsRef, {
          hrAdminIds: settings.hrAdminIds.filter((id) => id !== adminId),
          updatedAt: serverTimestamp(),
        });
      }

      // Mark admin as inactive (soft delete)
      const adminRef = doc(db, HR_ADMINS_COLLECTION, adminId);
      await updateDoc(adminRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error removing HR admin:', error);
      throw error;
    }
  },
};

export default settingsService;
