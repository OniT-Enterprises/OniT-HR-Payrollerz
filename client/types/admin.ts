import { FirestoreTimestamp } from "./firebase";

export type BillableModuleId =
  | "people"
  | "timeleave"
  | "payroll"
  | "money"
  | "accounting"
  | "reports";

export interface ModulePrice {
  id: BillableModuleId;
  label: string;
  monthlyPrice: number;
}

export interface EmployeePricingTier {
  id: string;
  minEmployees: number;
  maxEmployees: number | null;
  pricePerEmployee: number;
}

export interface PackagesConfig {
  modulePrices: ModulePrice[];
  employeePricingTiers: EmployeePricingTier[];
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
