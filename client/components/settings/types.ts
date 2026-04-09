/**
 * Shared types for Settings tab components
 */
export type {
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
  BusinessSector,
  PaymentMethod,
  PayrollFrequency,
  WorkLocation,
  DepartmentConfig,
  BankAccountConfig,
} from '@/types/settings';

export {
  SECTOR_DEPARTMENT_PRESETS,
} from '@/types/settings';

export type {
  CompanyDetailsFormData,
  HolidayOverrideFormData,
} from '@/lib/validations';

export {
  companyDetailsFormSchema,
  holidayOverrideFormSchema,
} from '@/lib/validations';

export interface SettingsTabProps {
  tenantId: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onReload: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}
