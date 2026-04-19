/**
 * Public Job Application Service
 * Candidates self-submit here via /apply/:jobId.
 * Admins then review + verify, which converts into a Candidate record.
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
  Timestamp,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type JobApplicationStatus = "pending" | "verified" | "rejected";

export interface JobApplicationVerificationChecklist {
  idVerified: boolean;
  contactVerified: boolean;
  eligibilityConfirmed: boolean;
}

export interface JobApplication {
  id?: string;
  tenantId: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  coverNote?: string;
  linkedInUrl?: string;
  referredBy?: string;
  resumePath?: string;
  idDocumentPath?: string;
  status: JobApplicationStatus;
  candidateId?: string;
  verificationChecklist?: JobApplicationVerificationChecklist;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION = "jobApplications";

function mapDoc(id: string, data: DocumentData): JobApplication {
  return {
    id,
    tenantId: data.tenantId,
    jobId: data.jobId,
    jobTitle: data.jobTitle,
    name: data.name,
    email: data.email,
    phone: data.phone,
    coverNote: data.coverNote,
    linkedInUrl: data.linkedInUrl,
    referredBy: data.referredBy,
    resumePath: data.resumePath || data.resumeUrl,
    idDocumentPath: data.idDocumentPath,
    status: data.status,
    candidateId: data.candidateId,
    verificationChecklist: data.verificationChecklist,
    reviewedBy: data.reviewedBy,
    reviewedAt:
      data.reviewedAt instanceof Timestamp ? data.reviewedAt.toDate() : data.reviewedAt,
    rejectionReason: data.rejectionReason,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
}

class JobApplicationService {
  async submitPublic(
    application: Omit<
      JobApplication,
      "id" | "status" | "reviewedBy" | "reviewedAt" | "rejectionReason" | "createdAt" | "updatedAt"
    >,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...application,
      status: "pending" as JobApplicationStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async getPending(tenantId: string): Promise<JobApplication[]> {
    const q = query(
      collection(db, COLLECTION),
      where("tenantId", "==", tenantId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  }

  async getAll(tenantId: string): Promise<JobApplication[]> {
    const q = query(
      collection(db, COLLECTION),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  }

  async getById(tenantId: string, id: string): Promise<JobApplication | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.tenantId !== tenantId) return null;
    return mapDoc(snap.id, data);
  }

  async verify(
    tenantId: string,
    id: string,
    reviewedBy: string,
    payload: {
      candidateId: string;
      verificationChecklist: JobApplicationVerificationChecklist;
    },
  ): Promise<void> {
    const app = await this.getById(tenantId, id);
    if (!app) throw new Error("Application not found");
    await updateDoc(doc(db, COLLECTION, id), {
      status: "verified" as JobApplicationStatus,
      candidateId: payload.candidateId,
      verificationChecklist: payload.verificationChecklist,
      reviewedBy,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async reject(
    tenantId: string,
    id: string,
    reviewedBy: string,
    rejectionReason: string,
  ): Promise<void> {
    const app = await this.getById(tenantId, id);
    if (!app) throw new Error("Application not found");
    await updateDoc(doc(db, COLLECTION, id), {
      status: "rejected" as JobApplicationStatus,
      reviewedBy,
      rejectionReason,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const app = await this.getById(tenantId, id);
    if (!app) throw new Error("Application not found");
    await deleteDoc(doc(db, COLLECTION, id));
  }
}

export const jobApplicationService = new JobApplicationService();
