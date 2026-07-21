/**
 * Onboarding Service — persists onboarding case data so offboarding can pull it.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  deleteField,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";

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

export interface OnboardingChecklist {
  employeeRecordConfirmed: boolean;
  contractReady: boolean;
  policiesExplained: boolean;
  firstDayReady: boolean;
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

  equipment: EquipmentAsset[];
  benefits: OnboardingBenefits;
  checklist?: OnboardingChecklist;

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

const DEFAULT_CHECKLIST: OnboardingChecklist = {
  employeeRecordConfirmed: false,
  contractReady: false,
  policiesExplained: false,
  firstDayReady: false,
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
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    benefits: { ...DEFAULT_BENEFITS, ...(data.benefits || {}) },
    checklist: { ...DEFAULT_CHECKLIST, ...(data.checklist || {}) },
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
    return this.saveCase(tenantId, caseData);
  }

  /**
   * Upsert the one onboarding record for an employee and keep the employee /
   * candidate handoff in the same atomic batch.
   */
  async saveCase(
    tenantId: string,
    caseData: Omit<OnboardingCase, "id" | "tenantId" | "createdAt" | "updatedAt">,
    existingCaseId?: string,
  ): Promise<string> {
    if (!caseData.employeeId) throw new Error("Onboarding requires an employee record.");
    const discovered = existingCaseId
      ? null
      : await this.getCaseByEmployee(tenantId, caseData.employeeId);
    const caseId = existingCaseId || discovered?.id || `${tenantId}__${caseData.employeeId}`;
    const caseRef = doc(db, COLLECTION, caseId);
    const batch = writeBatch(db);
    batch.set(
      caseRef,
      {
        ...caseData,
        tenantId,
        tempPassword: deleteField(),
        ...(existingCaseId || discovered?.id ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    batch.update(doc(db, paths.employee(tenantId, caseData.employeeId)), {
      "jobDetails.manager": caseData.managerName || deleteField(),
      updatedAt: serverTimestamp(),
    });
    if (caseData.candidateId) {
      batch.update(doc(db, "candidates", caseData.candidateId), {
        status: "Hired",
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return caseId;
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
    await updateDoc(docRef, {
      ...updates,
      // Older onboarding records may contain this legacy secret. Remove it
      // whenever the record is next touched; new writes are blocked by rules.
      tempPassword: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteCase(tenantId: string, caseId: string): Promise<void> {
    const existing = await this.getCase(tenantId, caseId);
    if (!existing) throw new Error("Onboarding case not found");
    await deleteDoc(doc(db, COLLECTION, caseId));
  }
}

export const onboardingService = new OnboardingService();
