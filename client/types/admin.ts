import { FirestoreTimestamp } from "./firebase";

/**
 * One product, one price. Every account has every feature; a single flat
 * per-employee rate is charged once a tenant subscribes (which is what unlocks
 * finalizing payroll). No tiers, no per-module pricing.
 */
export interface PackagesConfig {
  pricePerEmployee: number;
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
