import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Department {
  id: string;
  tenantId: string;
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

  async getAllDepartments(tenantId: string, maxResults: number = 1000): Promise<Department[]> {
    const querySnapshot = await getDocs(
      query(
        this.getCollection(),
        where("tenantId", "==", tenantId),
        orderBy("name", "asc"),
        limit(maxResults)
      )
    );

    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Department;
    });

    if (results.length === maxResults) {
      console.warn(`[departmentService] Results truncated at ${maxResults}. Consider pagination.`);
    }

    return results;
  }

  async addDepartment(tenantId: string, departmentData: DepartmentInput): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(this.getCollection(), {
      ...departmentData,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  async updateDepartment(
    tenantId: string,
    id: string,
    updates: Partial<DepartmentInput>
  ): Promise<void> {
    // Note: In production, verify tenant ownership before update
    const departmentRef = doc(db, "departments", id);
    await updateDoc(departmentRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteDepartment(tenantId: string, id: string): Promise<void> {
    // Note: In production, verify tenant ownership before delete
    const departmentRef = doc(db, "departments", id);
    await deleteDoc(departmentRef);
  }
}

export const departmentService = new DepartmentService();
