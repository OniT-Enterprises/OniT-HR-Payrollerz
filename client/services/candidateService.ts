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
import { db, isFirebaseReady, isFirebaseBlocked } from "@/lib/firebase";

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
  private get collection() {
    if (!db) {
      throw new Error("Firebase not initialized - using local data mode");
    }
    return collection(db, "candidates");
  }

  // Mock data for when Firebase is not available
  private mockCandidates: Candidate[] = [
    {
      id: "1",
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phone: "+1 (555) 123-4567",
      position: "Senior Software Engineer",
      experience: "5+ years",
      score: 92,
      status: "Under Review",
      appliedDate: "2024-01-15",
      resume: "sarah_johnson_resume.pdf",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1e0?w=150",
      cvQuality: 95,
      coverLetter: 88,
      technicalSkills: 93,
      interviewScore: null,
      totalScore: 92,
      notes: "Strong technical background, excellent communication skills",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    },
    {
      id: "2",
      name: "Michael Chen",
      email: "michael.chen@email.com",
      phone: "+1 (555) 987-6543",
      position: "Product Manager",
      experience: "3+ years",
      score: 87,
      status: "Shortlisted",
      appliedDate: "2024-01-14",
      resume: "michael_chen_resume.pdf",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      cvQuality: 85,
      coverLetter: 90,
      technicalSkills: 86,
      interviewScore: 88,
      totalScore: 87,
      notes: "Great product vision, needs technical growth",
      createdAt: new Date("2024-01-14"),
      updatedAt: new Date("2024-01-14"),
    },
    {
      id: "3",
      name: "Emily Rodriguez",
      email: "emily.rodriguez@email.com",
      phone: "+1 (555) 456-7890",
      position: "UX Designer",
      experience: "4+ years",
      score: 89,
      status: "New",
      appliedDate: "2024-01-16",
      resume: "emily_rodriguez_resume.pdf",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      cvQuality: 92,
      coverLetter: 87,
      technicalSkills: 88,
      interviewScore: null,
      totalScore: 89,
      notes: "Impressive portfolio, strong design thinking",
      createdAt: new Date("2024-01-16"),
      updatedAt: new Date("2024-01-16"),
    }
  ];

  private isFirebaseAvailable(): boolean {
    return !!(db && this.collection && isFirebaseReady() && !isFirebaseBlocked());
  }

  async getAllCandidates(): Promise<Candidate[]> {
    // First try Firebase if available
    if (this.isFirebaseAvailable()) {
      try {
        console.log("🔥 Attempting to get candidates from Firebase...");
        const querySnapshot = await getDocs(
          query(this.collection!, orderBy("createdAt", "desc")),
        );
        const candidates = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Candidate[];
        console.log(`✅ Successfully got ${candidates.length} candidates from Firebase`);
        return candidates;
      } catch (error) {
        console.warn("🚫 Firebase failed, falling back to mock data:", error);
      }
    } else {
      console.log("🚫 Firebase not available, using mock data");
    }

    // Fallback to mock data
    console.log(`📋 Returning ${this.mockCandidates.length} mock candidates`);
    return [...this.mockCandidates];
  }

  async getCandidateById(id: string): Promise<Candidate | null> {
    // Try Firebase first
    if (this.isFirebaseAvailable()) {
      try {
        const docSnap = await getDoc(doc(this.collection!, id));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Candidate;
        }
      } catch (error) {
        console.warn("Firebase failed for getCandidateById, checking mock data:", error);
      }
    }

    // Fallback to mock data
    return this.mockCandidates.find(candidate => candidate.id === id) || null;
  }

  async addCandidate(candidate: Omit<Candidate, "id">): Promise<string | null> {
    // Try Firebase first
    if (this.isFirebaseAvailable()) {
      try {
        const docRef = await addDoc(this.collection!, {
          ...candidate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docRef.id;
      } catch (error) {
        console.warn("Firebase failed for addCandidate, adding to mock data:", error);
      }
    }

    // Fallback to mock data
    const newId = (this.mockCandidates.length + 1).toString();
    const newCandidate: Candidate = {
      ...candidate,
      id: newId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockCandidates.unshift(newCandidate);
    console.log("Added candidate to mock data:", newCandidate.name);
    return newId;
  }

  async updateCandidate(
    id: string,
    updates: Partial<Candidate>,
  ): Promise<boolean> {
    try {
      if (!(await this.checkFirebaseReady())) {
        console.warn("Firebase not ready, cannot update candidate");
        return false;
      }

      await updateDoc(doc(this.collection, id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error("Error updating candidate:", error);
      if (error instanceof Error && error.message.includes("permissions")) {
        console.error("Permission denied - check Firestore rules and authentication");
      }
      return false;
    }
  }

  async deleteCandidate(id: string): Promise<boolean> {
    try {
      if (!(await this.checkFirebaseReady())) {
        console.warn("Firebase not ready, cannot delete candidate");
        return false;
      }

      await deleteDoc(doc(this.collection, id));
      return true;
    } catch (error) {
      console.error("Error deleting candidate:", error);
      if (error instanceof Error && error.message.includes("permissions")) {
        console.error("Permission denied - check Firestore rules and authentication");
      }
      return false;
    }
  }

  async getCandidatesByStatus(status: string): Promise<Candidate[]> {
    // Try Firebase first
    if (this.isFirebaseAvailable()) {
      try {
        const q = query(
          this.collection!,
          where("status", "==", status),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Candidate[];
      } catch (error) {
        console.warn("Firebase failed for getCandidatesByStatus, using mock data:", error);
      }
    }

    // Fallback to mock data
    return this.mockCandidates.filter(candidate => candidate.status === status);
  }

  async getCandidatesByPosition(position: string): Promise<Candidate[]> {
    try {
      if (!(await this.checkFirebaseReady())) {
        console.warn("Firebase not ready, returning empty candidates list by position");
        return [];
      }

      const q = query(
        this.collection,
        where("position", "==", position),
        orderBy("createdAt", "desc"),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Candidate[];
    } catch (error) {
      console.error("Error getting candidates by position:", error);
      if (error instanceof Error && error.message.includes("permissions")) {
        console.error("Permission denied - check Firestore rules and authentication");
      }
      return [];
    }
  }
}

export const candidateService = new CandidateService();
