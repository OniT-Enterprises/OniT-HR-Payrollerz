import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Department {
  id: string;
  name: string;
  director?: string;
  manager?: string;
  icon?: string;
  shape?: "circle" | "square" | "hexagon" | "diamond";
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentInput {
  name: string;
  director?: string;
  manager?: string;
  icon?: string;
  shape?: "circle" | "square" | "hexagon" | "diamond";
  color?: string;
}

class DepartmentService {
  private getCollection() {
    return collection(db, "departments");
  }

  async getAllDepartments(maxResults: number = 100): Promise<Department[]> {
    // Limit query to prevent excessive reads
    const querySnapshot = await getDocs(
      query(this.getCollection(), orderBy("name", "asc"), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Department;
    });
  }

  async addDepartment(departmentData: DepartmentInput): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(this.getCollection(), {
      ...departmentData,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  async updateDepartment(
    id: string,
    updates: Partial<DepartmentInput>
  ): Promise<void> {
    const departmentRef = doc(db, "departments", id);
    await updateDoc(departmentRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteDepartment(id: string): Promise<void> {
    const departmentRef = doc(db, "departments", id);
    await deleteDoc(departmentRef);
  }
}

export const departmentService = new DepartmentService();
