import { FirestoreTimestamp } from "./firebase";
import { TenantPlan } from "./tenant";

export type BillableModuleId =
  | "people"
  | "timeleave"
  | "payroll"
  | "money"
  | "accounting"
  | "reports";

export interface PackagePlanDefinition {
  id: TenantPlan;
  label: string;
  description: string;
  /** Pricing is purely per-employee: monthly bill = employees * pricePerEmployee. */
  pricePerEmployee: number;
  /** Features this plan unlocks — used for marketing/feature display, not billing. */
  includedModules: BillableModuleId[];
  maxAdmins: number | null;
  staffAppIncluded: boolean;
  trainingVideoUrl?: string;
  highlights: string[];
  complianceNotes: {
    sickDays: boolean;
    maternityLeave: boolean;
  };
}

export interface PackagesConfig {
  planDefinitions: PackagePlanDefinition[];
  updatedAt?: FirestoreTimestamp;
  updatedBy?: string;
  updatedByEmail?: string;
}

export type SuperAdminRequestType = "grant" | "revoke";
export type SuperAdminRequestStatus =
  | "awaiting_confirmation"
  | "awaiting_user"
  | "approved"
  | "rejected";

export interface SuperAdminRequest {
  id: string;
  type: SuperAdminRequestType;
  status: SuperAdminRequestStatus;
  targetEmail: string;
  targetUid?: string;
  targetDisplayName?: string;
  requestedByUid: string;
  requestedByEmail: string;
  requestedByName?: string;
  requestedAt?: FirestoreTimestamp;
  approvedByUid?: string;
  approvedByEmail?: string;
  approvedAt?: FirestoreTimestamp;
  note?: string;
}
