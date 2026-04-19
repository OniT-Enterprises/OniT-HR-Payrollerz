import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface JobPrivateDetails {
  id?: string;
  tenantId: string;
  jobId: string;
  contractType: "Permanent" | "Fixed-Term";
  contractDuration?: string;
  contractDurationMonths?: number;
  permanentProbation?: "30_days" | "90_days";
  probationDays: number;
  probationPeriod: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION = "jobPrivateDetails";

function mapDoc(id: string, data: DocumentData): JobPrivateDetails {
  return {
    id,
    tenantId: data.tenantId,
    jobId: data.jobId,
    contractType: data.contractType,
    contractDuration: data.contractDuration,
    contractDurationMonths: data.contractDurationMonths,
    permanentProbation: data.permanentProbation,
    probationDays: data.probationDays,
    probationPeriod: data.probationPeriod,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  };
}

class JobPrivateDetailsService {
  async saveForJob(
    tenantId: string,
    jobId: string,
    details: Omit<JobPrivateDetails, "id" | "tenantId" | "jobId" | "createdAt" | "updatedAt">,
  ): Promise<void> {
    const docRef = doc(collection(db, COLLECTION), jobId);
    await setDoc(
      docRef,
      {
        ...details,
        tenantId,
        jobId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async getForJob(tenantId: string, jobId: string): Promise<JobPrivateDetails | null> {
    const snap = await getDoc(doc(db, COLLECTION, jobId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.tenantId !== tenantId) return null;
    return mapDoc(snap.id, data);
  }
}

export const jobPrivateDetailsService = new JobPrivateDetailsService();
