/**
 * Settings Service
 * Manages company/tenant settings in Firestore
 */

import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { omitUndefinedValues } from '@/lib/firestorePayload';
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

function buildDefaultTenantSettings(tenantId: string): Omit<TenantSettings, 'id' | 'createdAt' | 'updatedAt'> {
  return {
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
}

function toDateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date();
}

function normalizeTenantSettings(
  tenantId: string,
  raw: Partial<TenantSettings> | Record<string, unknown>,
): TenantSettings {
  const defaults = buildDefaultTenantSettings(tenantId);
  const data = raw as Partial<TenantSettings>;
  const rawRecord = raw as Record<string, unknown>;
  // Older writes used dotted keys with setDoc({ merge: true }), which stores
  // literal top-level fields instead of updating the nested map. Read those
  // values during migration so an in-progress setup can still resume.
  const legacySetupProgress = {
    companyDetails: rawRecord["setupProgress.companyDetails"] === true,
    companyStructure: rawRecord["setupProgress.companyStructure"] === true,
    paymentStructure: rawRecord["setupProgress.paymentStructure"] === true,
    timeOffPolicies: rawRecord["setupProgress.timeOffPolicies"] === true,
    payrollConfig: rawRecord["setupProgress.payrollConfig"] === true,
  };
  const legacyOvertimeRates = data.payrollConfig?.overtimeRates as
    | (Partial<PayrollConfig['overtimeRates']> & { first2Hours?: number })
    | undefined;

  return {
    id: tenantId,
    tenantId,
    companyDetails: {
      ...defaults.companyDetails,
      ...(data.companyDetails || {}),
    },
    companyStructure: {
      ...defaults.companyStructure,
      ...(data.companyStructure || {}),
      workLocations: data.companyStructure?.workLocations || defaults.companyStructure.workLocations,
      departments: data.companyStructure?.departments || defaults.companyStructure.departments,
      employeeGrades: data.companyStructure?.employeeGrades || defaults.companyStructure.employeeGrades,
    },
    paymentStructure: {
      ...defaults.paymentStructure,
      ...(data.paymentStructure || {}),
      paymentMethods: data.paymentStructure?.paymentMethods || defaults.paymentStructure.paymentMethods,
      bankAccounts: data.paymentStructure?.bankAccounts || defaults.paymentStructure.bankAccounts,
      employmentTypes: data.paymentStructure?.employmentTypes || defaults.paymentStructure.employmentTypes,
      payrollFrequencies: data.paymentStructure?.payrollFrequencies || defaults.paymentStructure.payrollFrequencies,
      payrollPeriods: data.paymentStructure?.payrollPeriods || defaults.paymentStructure.payrollPeriods,
    },
    timeOffPolicies: {
      ...defaults.timeOffPolicies,
      ...(data.timeOffPolicies || {}),
      annualLeave: {
        ...defaults.timeOffPolicies.annualLeave,
        ...(data.timeOffPolicies?.annualLeave || {}),
      },
      sickLeave: {
        ...defaults.timeOffPolicies.sickLeave,
        ...(data.timeOffPolicies?.sickLeave || {}),
      },
      maternityLeave: {
        ...defaults.timeOffPolicies.maternityLeave,
        ...(data.timeOffPolicies?.maternityLeave || {}),
      },
      paternityLeave: {
        ...defaults.timeOffPolicies.paternityLeave,
        ...(data.timeOffPolicies?.paternityLeave || {}),
      },
      specialLeave: {
        ...defaults.timeOffPolicies.specialLeave,
        ...(data.timeOffPolicies?.specialLeave || {}),
      },
      unpaidLeave: {
        ...defaults.timeOffPolicies.unpaidLeave,
        ...(data.timeOffPolicies?.unpaidLeave || {}),
      },
      customLeaveTypes: data.timeOffPolicies?.customLeaveTypes || defaults.timeOffPolicies.customLeaveTypes,
    },
    payrollConfig: {
      ...defaults.payrollConfig,
      ...(data.payrollConfig || {}),
      tax: {
        ...defaults.payrollConfig.tax,
        ...(data.payrollConfig?.tax || {}),
      },
      socialSecurity: {
        ...defaults.payrollConfig.socialSecurity,
        ...(data.payrollConfig?.socialSecurity || {}),
      },
      overtimeRates: {
        standard:
          legacyOvertimeRates?.standard ??
          legacyOvertimeRates?.first2Hours ??
          defaults.payrollConfig.overtimeRates.standard,
        sundayHoliday:
          legacyOvertimeRates?.sundayHoliday ??
          defaults.payrollConfig.overtimeRates.sundayHoliday,
        nightShiftPremium:
          legacyOvertimeRates?.nightShiftPremium ??
          defaults.payrollConfig.overtimeRates.nightShiftPremium,
      },
      subsidioAnual: {
        ...defaults.payrollConfig.subsidioAnual,
        ...(data.payrollConfig?.subsidioAnual || {}),
      },
    },
    hrAdminIds: data.hrAdminIds || defaults.hrAdminIds,
    openaiApiKey: data.openaiApiKey,
    setupComplete: data.setupComplete ?? defaults.setupComplete,
    setupProgress: {
      companyDetails:
        data.setupProgress?.companyDetails === true || legacySetupProgress.companyDetails,
      companyStructure:
        data.setupProgress?.companyStructure === true || legacySetupProgress.companyStructure,
      paymentStructure:
        data.setupProgress?.paymentStructure === true || legacySetupProgress.paymentStructure,
      timeOffPolicies:
        data.setupProgress?.timeOffPolicies === true || legacySetupProgress.timeOffPolicies,
      payrollConfig:
        data.setupProgress?.payrollConfig === true || legacySetupProgress.payrollConfig,
    },
    createdAt: toDateValue(data.createdAt),
    updatedAt: toDateValue(data.updatedAt),
  };
}

function toFirestoreSettingsPayload(
  settings: TenantSettings,
): Omit<TenantSettings, 'id' | 'createdAt' | 'updatedAt'> {
  const payload: Omit<TenantSettings, 'id' | 'createdAt' | 'updatedAt'> = {
    tenantId: settings.tenantId,
    companyDetails: settings.companyDetails,
    companyStructure: settings.companyStructure,
    paymentStructure: settings.paymentStructure,
    timeOffPolicies: settings.timeOffPolicies,
    payrollConfig: settings.payrollConfig,
    hrAdminIds: settings.hrAdminIds,
    setupComplete: settings.setupComplete,
    setupProgress: settings.setupProgress,
  };

  if (settings.openaiApiKey) payload.openaiApiKey = settings.openaiApiKey;
  return payload;
}

/**
 * Persist legacy settings only as part of an authorized settings write. This
 * keeps ordinary reads safe for viewers while preventing a first partial edit
 * from replacing untouched legacy sections with defaults.
 */
async function ensureScopedSettingsForWrite(tenantId: string): Promise<void> {
  const scopedRef = doc(db, paths.settings(tenantId));
  const legacyRef = doc(db, LEGACY_SETTINGS_COLLECTION, tenantId);

  await runTransaction(db, async (transaction) => {
    const scopedSnap = await transaction.get(scopedRef);
    if (scopedSnap.exists()) return;

    const legacySnap = await transaction.get(legacyRef);
    if (!legacySnap.exists()) return;

    const normalized = normalizeTenantSettings(tenantId, legacySnap.data());
    transaction.set(scopedRef, {
      ...toFirestoreSettingsPayload(normalized),
      migratedFromLegacy: true,
      migratedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

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
        return normalizeTenantSettings(tenantId, data);
      }

      // Legacy fallback (single-tenant -> multi-tenant migration)
      const legacyRef = doc(db, LEGACY_SETTINGS_COLLECTION, tenantId);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const legacy = legacySnap.data();
        return normalizeTenantSettings(tenantId, legacy);
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
    const defaultSettings = buildDefaultTenantSettings(tenantId);

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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        companyDetails: omitUndefinedValues(companyDetails),
        setupProgress: { companyDetails: true },
        updatedAt: serverTimestamp(),
      }, { merge: true });

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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        companyStructure: omitUndefinedValues(companyStructure),
        setupProgress: { companyStructure: true },
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        paymentStructure: omitUndefinedValues(paymentStructure),
        setupProgress: { paymentStructure: true },
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        timeOffPolicies: omitUndefinedValues(timeOffPolicies),
        setupProgress: { timeOffPolicies: true },
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        payrollConfig: omitUndefinedValues(payrollConfig),
        setupProgress: { payrollConfig: true },
        updatedAt: serverTimestamp(),
      }, { merge: true });

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
      await ensureScopedSettingsForWrite(tenantId);
      const docRef = doc(db, paths.settings(tenantId));
      await setDoc(docRef, {
        tenantId,
        setupComplete: true,
        setupProgress: {
          companyDetails: true,
          companyStructure: true,
          paymentStructure: true,
          timeOffPolicies: true,
          payrollConfig: true,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
