/**
 * Saved custom report configs — CRUD on tenants/{tid}/customReports.
 * These are report DEFINITIONS only (name, data source, column keys, filters);
 * running a report fetches live data through the existing employee/attendance/
 * department services on the Custom Reports page. The built-in templates stay
 * hardcoded on the page and are never written here.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CustomReportDataSource =
  | "employees"
  | "attendance"
  | "departments";

export interface CustomReportFilters {
  department?: string;
  status?: string;
  dateRange?: string;
}

export interface CustomReportInput {
  name: string;
  description: string;
  dataSource: CustomReportDataSource;
  columns: string[];
  filters: CustomReportFilters;
}

export interface SavedCustomReport extends CustomReportInput {
  id: string;
  createdBy: string;
  createdAt: Date;
  lastRunAt?: Date;
}

const colRef = (tenantId: string) =>
  collection(db, `tenants/${tenantId}/customReports`);

function mapReport(
  id: string,
  data: Record<string, unknown>,
): SavedCustomReport {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
    dataSource: data.dataSource as CustomReportDataSource,
    columns: Array.isArray(data.columns) ? (data.columns as string[]) : [],
    filters: (data.filters ?? {}) as CustomReportFilters,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
    lastRunAt:
      data.lastRunAt instanceof Timestamp ? data.lastRunAt.toDate() : undefined,
  };
}

export const customReportService = {
  async list(tenantId: string): Promise<SavedCustomReport[]> {
    const snap = await getDocs(
      query(colRef(tenantId), orderBy("createdAt", "desc")),
    );
    return snap.docs.map((d) => mapReport(d.id, d.data()));
  },

  /** Persist a report built in the builder. Returns the new doc id. */
  async create(
    tenantId: string,
    config: CustomReportInput,
    createdBy: string,
  ): Promise<string> {
    const ref = doc(colRef(tenantId));
    await setDoc(ref, {
      name: config.name.trim(),
      description: (config.description ?? "").trim(),
      dataSource: config.dataSource,
      columns: config.columns,
      filters: {
        department: config.filters.department ?? "",
        status: config.filters.status ?? "",
        dateRange: config.filters.dateRange ?? "",
      },
      createdBy,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * Stamp lastRunAt after a successful run. Non-critical bookkeeping —
   * callers fire-and-forget so a failure never breaks the run itself.
   */
  async touchLastRun(tenantId: string, id: string): Promise<void> {
    await updateDoc(doc(colRef(tenantId), id), {
      lastRunAt: serverTimestamp(),
    });
  },

  async remove(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(colRef(tenantId), id));
  },
};
