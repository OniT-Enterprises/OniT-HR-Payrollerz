import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Job {
  id?: string;
  title: string;
  description?: string;
  department: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  contractType?: string;
  contractDuration?: string;
  probationPeriod?: string;
  status: "draft" | "open" | "closed" | "filled";
  postedDate?: string;
  closingDate?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

class JobService {
  private get collectionRef() {
    return collection(db, "jobs");
  }

  async getAllJobs(): Promise<Job[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy("createdAt", "desc"))
    );

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Job;
    });
  }

  async getJobById(id: string): Promise<Job | null> {
    const docRef = doc(db, "jobs", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Job;
  }

  async createJob(job: Omit<Job, "id">): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...job,
      postedDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<boolean> {
    const docRef = doc(db, "jobs", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteJob(id: string): Promise<boolean> {
    const docRef = doc(db, "jobs", id);
    await deleteDoc(docRef);
    return true;
  }

  async getJobsByStatus(status: Job["status"]): Promise<Job[]> {
    const q = query(
      this.collectionRef,
      where("status", "==", status),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Job;
    });
  }

  async getOpenJobs(): Promise<Job[]> {
    return this.getJobsByStatus("open");
  }
}

export const jobService = new JobService();
