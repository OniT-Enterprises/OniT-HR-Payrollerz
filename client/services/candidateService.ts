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
  async getCandidates(filters: CandidateFilters = {}): Promise<PaginatedResult<Candidate>> {
    const {
      status,
      position,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      minScore,
      maxScore,
    } = filters;

    const constraints: QueryConstraint[] = [];

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
   * Get all candidates
   * @deprecated Use getCandidates() with filters for better performance
   */
  async getAllCandidates(): Promise<Candidate[]> {
    const result = await this.getCandidates({ pageSize: 500 });
    return result.data;
  }

  async getCandidateById(id: string): Promise<Candidate | null> {
    const docRef = doc(db, "candidates", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapCandidate(docSnap);
  }

  async addCandidate(candidate: Omit<Candidate, "id">): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...candidate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateCandidate(
    id: string,
    updates: Partial<Candidate>
  ): Promise<boolean> {
    const docRef = doc(db, "candidates", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    const docRef = doc(db, "candidates", id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get candidates by status (server-side filtered)
   */
  async getCandidatesByStatus(status: CandidateStatus): Promise<Candidate[]> {
    const result = await this.getCandidates({ status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get candidates by position (server-side filtered)
   */
  async getCandidatesByPosition(position: string): Promise<Candidate[]> {
    const result = await this.getCandidates({ position, pageSize: 500 });
    return result.data;
  }

  /**
   * Search candidates by text (client-side filtering)
   */
  async searchCandidates(searchTerm: string): Promise<Candidate[]> {
    const result = await this.getCandidates({ searchTerm, pageSize: 500 });
    return result.data;
  }
}

export const candidateService = new CandidateService();
