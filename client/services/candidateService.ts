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

export type CandidateStatus = "New" | "Under Review" | "Shortlisted" | "Rejected" | "Hired";

export interface Candidate {
  id?: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience: string;
  score: number;
  status: CandidateStatus;
  appliedDate: string;
  resume: string;
  avatar: string;
  cvQuality: number;
  coverLetter: number;
  technicalSkills: number;
  interviewScore: number | null;
  totalScore: number;
  notes?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

/**
 * Filter options for candidate queries
 */
export interface CandidateFilters {
  // Server-side filters
  status?: CandidateStatus;
  position?: string;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
  minScore?: number;
  maxScore?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Candidate
 */
function mapCandidate(docSnap: DocumentSnapshot): Candidate {
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
  } as Candidate;
}

class CandidateService {
  private get collectionRef() {
    return collection(db, "candidates");
  }

  /**
   * Get candidates with server-side filtering and pagination
   */
  async getCandidates(tenantId: string, filters: CandidateFilters = {}): Promise<PaginatedResult<Candidate>> {
    const {
      status,
      position,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      minScore,
      maxScore,
    } = filters;

    const constraints: QueryConstraint[] = [
      where("tenantId", "==", tenantId),
    ];

    // Server-side filters
    if (status) {
      constraints.push(where("status", "==", status));
    }
    if (position) {
      constraints.push(where("position", "==", position));
    }

    // Ordering and pagination
    constraints.push(orderBy("createdAt", "desc"));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    let candidates = querySnapshot.docs.map(mapCandidate);
    const hasMore = candidates.length > pageSize;

    if (hasMore) {
      candidates = candidates.slice(0, pageSize);
    }

    const lastDoc = candidates.length > 0
      ? querySnapshot.docs[candidates.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      candidates = candidates.filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(term) ||
          candidate.email.toLowerCase().includes(term) ||
          candidate.position.toLowerCase().includes(term)
      );
    }

    if (minScore !== undefined) {
      candidates = candidates.filter((candidate) => candidate.totalScore >= minScore);
    }

    if (maxScore !== undefined) {
      candidates = candidates.filter((candidate) => candidate.totalScore <= maxScore);
    }

    return {
      data: candidates,
      lastDoc,
      hasMore,
      totalFetched: candidates.length,
    };
  }

  /**
   * Get all candidates for a tenant
   */
  async getAllCandidates(tenantId: string): Promise<Candidate[]> {
    const result = await this.getCandidates(tenantId, { pageSize: 500 });
    return result.data;
  }

  async getCandidateById(tenantId: string, id: string): Promise<Candidate | null> {
    const docRef = doc(db, "candidates", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const candidate = mapCandidate(docSnap);

    // Verify tenant ownership
    if (candidate.tenantId !== tenantId) {
      return null;
    }

    return candidate;
  }

  async addCandidate(tenantId: string, candidate: Omit<Candidate, "id" | "tenantId">): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...candidate,
      tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateCandidate(
    tenantId: string,
    id: string,
    updates: Partial<Candidate>
  ): Promise<boolean> {
    // Verify ownership first
    const existing = await this.getCandidateById(tenantId, id);
    if (!existing) {
      throw new Error("Candidate not found or access denied");
    }

    const docRef = doc(db, "candidates", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteCandidate(tenantId: string, id: string): Promise<boolean> {
    // Verify ownership first
    const existing = await this.getCandidateById(tenantId, id);
    if (!existing) {
      throw new Error("Candidate not found or access denied");
    }

    const docRef = doc(db, "candidates", id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get candidates by status (server-side filtered)
   */
  async getCandidatesByStatus(tenantId: string, status: CandidateStatus): Promise<Candidate[]> {
    const result = await this.getCandidates(tenantId, { status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get candidates by position (server-side filtered)
   */
  async getCandidatesByPosition(tenantId: string, position: string): Promise<Candidate[]> {
    const result = await this.getCandidates(tenantId, { position, pageSize: 500 });
    return result.data;
  }

  /**
   * Search candidates by text (client-side filtering)
   */
  async searchCandidates(tenantId: string, searchTerm: string): Promise<Candidate[]> {
    const result = await this.getCandidates(tenantId, { searchTerm, pageSize: 500 });
    return result.data;
  }
}

export const candidateService = new CandidateService();
