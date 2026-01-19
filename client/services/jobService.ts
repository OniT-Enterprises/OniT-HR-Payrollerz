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
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type JobStatus = "draft" | "open" | "closed" | "filled";

export interface Job {
  id?: string;
  tenantId: string;
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
  status: JobStatus;
  postedDate?: string;
  closingDate?: string;
  createdBy?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

/**
 * Filter options for job queries
 */
export interface JobFilters {
  // Server-side filters
  status?: JobStatus;
  department?: string;
  employmentType?: string;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
  location?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Job
 */
function mapJob(docSnap: DocumentSnapshot): Job {
  const data = docSnap.data();
  if (!data) throw new Error("Document data is undefined");

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : data.updatedAt || new Date(),
  } as Job;
}

class JobService {
  private get collectionRef() {
    return collection(db, "jobs");
  }

  /**
   * Get jobs with server-side filtering and pagination
   */
  async getJobs(tenantId: string, filters: JobFilters = {}): Promise<PaginatedResult<Job>> {
    const {
      status,
      department,
      employmentType,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      location,
    } = filters;

    const constraints: QueryConstraint[] = [
      where("tenantId", "==", tenantId),
    ];

    // Server-side filters
    if (status) {
      constraints.push(where("status", "==", status));
    }
    if (department) {
      constraints.push(where("department", "==", department));
    }
    if (employmentType) {
      constraints.push(where("employmentType", "==", employmentType));
    }

    // Ordering and pagination
    constraints.push(orderBy("createdAt", "desc"));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    let jobs = querySnapshot.docs.map(mapJob);
    const hasMore = jobs.length > pageSize;

    if (hasMore) {
      jobs = jobs.slice(0, pageSize);
    }

    const lastDoc = jobs.length > 0
      ? querySnapshot.docs[jobs.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          job.title.toLowerCase().includes(term) ||
          job.description?.toLowerCase().includes(term) ||
          job.department.toLowerCase().includes(term)
      );
    }

    if (location) {
      jobs = jobs.filter((job) => job.location === location);
    }

    return {
      data: jobs,
      lastDoc,
      hasMore,
      totalFetched: jobs.length,
    };
  }

  /**
   * Get all jobs for a tenant
   */
  async getAllJobs(tenantId: string): Promise<Job[]> {
    const result = await this.getJobs(tenantId, { pageSize: 500 });
    return result.data;
  }

  async getJobById(tenantId: string, id: string): Promise<Job | null> {
    const docRef = doc(db, "jobs", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const job = mapJob(docSnap);

    // Verify tenant ownership
    if (job.tenantId !== tenantId) {
      return null;
    }

    return job;
  }

  async createJob(tenantId: string, job: Omit<Job, "id" | "tenantId">): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...job,
      tenantId,
      postedDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateJob(tenantId: string, id: string, updates: Partial<Job>): Promise<boolean> {
    // Verify ownership first
    const existing = await this.getJobById(tenantId, id);
    if (!existing) {
      throw new Error("Job not found or access denied");
    }

    const docRef = doc(db, "jobs", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteJob(tenantId: string, id: string): Promise<boolean> {
    // Verify ownership first
    const existing = await this.getJobById(tenantId, id);
    if (!existing) {
      throw new Error("Job not found or access denied");
    }

    const docRef = doc(db, "jobs", id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get jobs by status (server-side filtered)
   */
  async getJobsByStatus(tenantId: string, status: JobStatus): Promise<Job[]> {
    const result = await this.getJobs(tenantId, { status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get open jobs only (server-side filtered)
   */
  async getOpenJobs(tenantId: string): Promise<Job[]> {
    return this.getJobsByStatus(tenantId, "open");
  }

  /**
   * Search jobs by text (client-side filtering)
   */
  async searchJobs(tenantId: string, searchTerm: string): Promise<Job[]> {
    const result = await this.getJobs(tenantId, { searchTerm, pageSize: 500 });
    return result.data;
  }
}

export const jobService = new JobService();
