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
  setDoc,
  runTransaction,
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
import type { Candidate } from "@/services/candidateService";

export type JobApplicationStatus =
  | "pending"
  | "shortlisted"
  | "verified" // legacy value
  | "hired"
  | "rejected";

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
  hiredEmployeeId?: string;
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
    hiredEmployeeId: data.hiredEmployeeId,
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
  createApplicationId(): string {
    return doc(collection(db, COLLECTION)).id;
  }

  async submitPublic(
    application: Omit<
      JobApplication,
      "id" | "status" | "reviewedBy" | "reviewedAt" | "rejectionReason" | "createdAt" | "updatedAt"
    >,
    applicationId = this.createApplicationId(),
  ): Promise<string> {
    const docRef = doc(db, COLLECTION, applicationId);
    await setDoc(docRef, {
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

  async shortlist(
    tenantId: string,
    id: string,
    reviewedBy: string,
    candidate: Omit<Candidate, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const applicationRef = doc(db, COLLECTION, id);
    const candidateRef = doc(collection(db, "candidates"));
    return runTransaction(db, async (transaction) => {
      const applicationDoc = await transaction.get(applicationRef);
      if (!applicationDoc.exists() || applicationDoc.data().tenantId !== tenantId) {
        throw new Error("Application not found");
      }
      const data = applicationDoc.data();
      if (data.status === "rejected") {
        throw new Error("A rejected application cannot be shortlisted.");
      }
      if (data.status === "hired") {
        throw new Error("This application has already been hired.");
      }
      if (typeof data.candidateId === "string" && data.candidateId) {
        return data.candidateId;
      }

      transaction.set(candidateRef, {
        ...candidate,
        tenantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(applicationRef, {
        status: "shortlisted" as JobApplicationStatus,
        candidateId: candidateRef.id,
        reviewedBy,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return candidateRef.id;
    });
  }

  async reject(
    tenantId: string,
    id: string,
    reviewedBy: string,
    rejectionReason: string,
    linked?: { candidateId?: string; interviewId?: string },
  ): Promise<void> {
    const applicationRef = doc(db, COLLECTION, id);
    await runTransaction(db, async (transaction) => {
      const applicationDoc = await transaction.get(applicationRef);
      if (!applicationDoc.exists() || applicationDoc.data().tenantId !== tenantId) {
        throw new Error("Application not found");
      }
      if (applicationDoc.data().status === "hired") {
        throw new Error("A hired application cannot be rejected.");
      }
      const application = applicationDoc.data();
      if (linked?.candidateId && linked.candidateId !== application.candidateId) {
        throw new Error("The candidate no longer matches this application.");
      }
      const candidateRef = application.candidateId
        ? doc(db, "candidates", application.candidateId)
        : null;
      const interviewRef = linked?.interviewId
        ? doc(db, "interviews", linked.interviewId)
        : null;
      const candidateDoc = candidateRef ? await transaction.get(candidateRef) : null;
      const interviewDoc = interviewRef ? await transaction.get(interviewRef) : null;
      if (
        candidateDoc?.exists() &&
        candidateDoc.data().tenantId !== tenantId
      ) {
        throw new Error("The linked candidate belongs to another tenant.");
      }
      if (interviewDoc?.exists()) {
        const interview = interviewDoc.data();
        if (
          interview.tenantId !== tenantId ||
          interview.jobId !== application.jobId ||
          (application.candidateId && interview.candidateId !== application.candidateId)
        ) {
          throw new Error("The interview no longer matches this application.");
        }
      }
      transaction.update(applicationRef, {
        status: "rejected" as JobApplicationStatus,
        reviewedBy,
        rejectionReason,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (candidateRef && candidateDoc?.exists()) {
        transaction.update(candidateRef, {
          status: "Rejected",
          updatedAt: serverTimestamp(),
        });
      }
      if (interviewRef && interviewDoc?.exists()) {
        transaction.update(interviewRef, {
          status: "completed",
          decision: "reject",
          decisionNotes: rejectionReason,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const app = await this.getById(tenantId, id);
    if (!app) throw new Error("Application not found");
    await deleteDoc(doc(db, COLLECTION, id));
  }
}

export const jobApplicationService = new JobApplicationService();
