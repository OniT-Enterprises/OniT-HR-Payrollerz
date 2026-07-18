import { FirestoreTimestamp } from "./firebase";

/**
 * One product, one pricing formula. Every account has every feature; a flat
 * per-employee rate with a minimum and annual discount is charged once a tenant
 * subscribes. No tiers and no per-module pricing.
 */
export interface PackagesConfig {
  pricePerEmployee: number;
  /** Minimum number of seats billed each cycle (five = $20 at the default rate). */
  minimumEmployees: number;
  /** Number of monthly payments charged for twelve months of annual access. */
  annualMonthsCharged: number;
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
