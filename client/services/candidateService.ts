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

export interface Candidate {
  id?: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience: string;
  score: number;
  status: "New" | "Under Review" | "Shortlisted" | "Rejected" | "Hired";
  appliedDate: string;
  resume: string;
  avatar: string;
  cvQuality: number;
  coverLetter: number;
  technicalSkills: number;
  interviewScore: number | null;
  totalScore: number;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

class CandidateService {
  private get collectionRef() {
    return collection(db, "candidates");
  }

  async getAllCandidates(): Promise<Candidate[]> {
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
      } as Candidate;
    });
  }

  async getCandidateById(id: string): Promise<Candidate | null> {
    const docRef = doc(db, "candidates", id);
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
    } as Candidate;
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

  async getCandidatesByStatus(status: string): Promise<Candidate[]> {
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
      } as Candidate;
    });
  }

  async getCandidatesByPosition(position: string): Promise<Candidate[]> {
    const q = query(
      this.collectionRef,
      where("position", "==", position),
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
      } as Candidate;
    });
  }
}

export const candidateService = new CandidateService();
