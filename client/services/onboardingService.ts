/**
 * Onboarding Service — persists onboarding case data so offboarding can pull it.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type EquipmentAssetType =
  | "laptop"
  | "phone"
  | "access_card"
  | "office_keys"
  | "sim_card"
  | "uniform"
  | "other";

export interface EquipmentAsset {
  id: string;
  type: EquipmentAssetType;
  label?: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  assetTag?: string;
  notes?: string;
  returned?: boolean;
  returnedAt?: string;
}

export interface OnboardingBenefits {
  healthCardNumber?: string;
  retirementPlanNumber?: string;
  lifeInsurancePolicy?: string;
  leaveEntitlementDays?: number;
  notes?: string;
}

export interface OnboardingAcknowledgements {
  dressCode: boolean;
  codeOfConduct: boolean;
  leavePolicy: boolean;
  safetyGuidelines: boolean;
  dataProtection: boolean;
  handbookRead: boolean;
}

export type OnboardingStatus = "in_progress" | "completed" | "cancelled";

export interface OnboardingCase {
  id?: string;
  tenantId: string;
  candidateId?: string;
  employeeId?: string;
  jobId?: string;

  fullName: string;
  dateOfBirth?: string;
  address?: string;
  mobilePhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankAccountNumber?: string;
  taxId?: string;
  idDocumentUrl?: string;

  managerEmployeeId?: string;
  managerName?: string;

  companyEmail?: string;
  tempPassword?: string;

  equipment: EquipmentAsset[];
  benefits: OnboardingBenefits;

  acknowledgements: OnboardingAcknowledgements;
  handbookSignatureDate?: string;
  handbookContent?: string;
  feedbackNotes?: string;

  status: OnboardingStatus;
  completedAt?: Date;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION = "onboarding";

const DEFAULT_BENEFITS: OnboardingBenefits = {
  healthCardNumber: "",
  retirementPlanNumber: "",
  lifeInsurancePolicy: "",
  leaveEntitlementDays: undefined,
  notes: "",
};

const DEFAULT_ACKNOWLEDGEMENTS: OnboardingAcknowledgements = {
  dressCode: false,
  codeOfConduct: false,
  leavePolicy: false,
  safetyGuidelines: false,
  dataProtection: false,
  handbookRead: false,
};

function mapDoc(id: string, data: DocumentData): OnboardingCase {
  return {
    id,
    tenantId: data.tenantId,
    candidateId: data.candidateId,
    employeeId: data.employeeId,
    jobId: data.jobId,
    fullName: data.fullName || "",
    dateOfBirth: data.dateOfBirth,
    address: data.address,
    mobilePhone: data.mobilePhone,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    bankAccountNumber: data.bankAccountNumber,
    taxId: data.taxId,
    idDocumentUrl: data.idDocumentUrl,
    managerEmployeeId: data.managerEmployeeId,
    managerName: data.managerName,
    companyEmail: data.companyEmail,
    tempPassword: data.tempPassword,
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    benefits: { ...DEFAULT_BENEFITS, ...(data.benefits || {}) },
    acknowledgements: { ...DEFAULT_ACKNOWLEDGEMENTS, ...(data.acknowledgements || {}) },
    handbookSignatureDate: data.handbookSignatureDate,
    handbookContent: data.handbookContent,
    feedbackNotes: data.feedbackNotes,
    status: data.status || "in_progress",
    completedAt:
      data.completedAt instanceof Timestamp ? data.completedAt.toDate() : data.completedAt,
    createdBy: data.createdBy,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
}

class OnboardingService {
  async createCase(
    tenantId: string,
    caseData: Omit<OnboardingCase, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...caseData,
      tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async getCase(tenantId: string, caseId: string): Promise<OnboardingCase | null> {
    const docRef = doc(db, COLLECTION, caseId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.tenantId !== tenantId) return null;
    return mapDoc(snap.id, data);
  }

  async getCaseByEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<OnboardingCase | null> {
    const q = query(
      collection(db, COLLECTION),
      where("tenantId", "==", tenantId),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    if (!first) return null;
    return mapDoc(first.id, first.data());
  }

  async getCases(tenantId: string, status?: OnboardingStatus): Promise<OnboardingCase[]> {
    const constraints = [where("tenantId", "==", tenantId)];
    if (status) constraints.push(where("status", "==", status));
    const q = query(collection(db, COLLECTION), ...constraints, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  }

  async updateCase(
    tenantId: string,
    caseId: string,
    updates: Partial<Omit<OnboardingCase, "id" | "tenantId" | "createdAt">>,
  ): Promise<void> {
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) throw new Error("Onboarding case not found");
    const docRef = doc(db, COLLECTION, caseId);
    await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  }

  async deleteCase(tenantId: string, caseId: string): Promise<void> {
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) throw new Error("Onboarding case not found");
    await deleteDoc(doc(db, COLLECTION, caseId));
  }
}

export const onboardingService = new OnboardingService();
