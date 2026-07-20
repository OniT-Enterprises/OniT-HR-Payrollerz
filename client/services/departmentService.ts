import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  getCountFromServer,
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
import { paths } from "@/lib/paths";

/** Thrown by deleteDepartment when employees are still assigned. */
export class DepartmentHasEmployeesError extends Error {
  constructor(public readonly employeeCount: number) {
    super(
      `Cannot delete department: ${employeeCount} employee(s) are still assigned. Reassign them first.`,
    );
    this.name = "DepartmentHasEmployeesError";
  }
}

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
    const departmentRef = doc(db, "departments", id);

    // `departments` is a top-level collection, so the doc id alone proves
    // nothing about ownership — the doc must carry the caller's tenantId.
    const deptSnap = await getDoc(departmentRef);
    if (!deptSnap.exists()) {
      return; // already gone — nothing to delete
    }
    if (deptSnap.data()?.tenantId !== tenantId) {
      throw new Error("Department does not belong to this tenant");
    }

    // Guard: employees reference their department by NAME (jobDetails.department).
    // Hard-deleting a department with staff still assigned strands them with a
    // dangling department, breaking roster/reporting filters. Block it and make
    // the caller reassign first. Only ACTIVE staff count — a department holding
    // nothing but terminated ex-staff must stay deletable.
    const departmentName = deptSnap.data()?.name as string | undefined;
    if (departmentName) {
      const assigned = await getCountFromServer(
        query(
          collection(db, paths.employees(tenantId)),
          where("jobDetails.department", "==", departmentName),
          where("status", "==", "active"),
        ),
      );
      const count = assigned.data().count;
      if (count > 0) {
        throw new DepartmentHasEmployeesError(count);
      }
    }

    await deleteDoc(departmentRef);
  }
}

export const departmentService = new DepartmentService();
