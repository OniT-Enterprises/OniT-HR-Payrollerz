import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";

export interface HolidayOverride {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  name?: string;
  nameTetun?: string;
  isHoliday: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

function mapOverride(docSnap: any): HolidayOverride {
  const data = docSnap.data?.() ?? docSnap.data;
  const createdAt = data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
  const updatedAt = data?.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

  return {
    id: docSnap.id,
    date: data.date ?? docSnap.id,
    name: data.name,
    nameTetun: data.nameTetun,
    isHoliday: Boolean(data.isHoliday),
    notes: data.notes,
    createdAt,
    updatedAt,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}

export const holidayService = {
  async listTenantHolidayOverrides(tenantId: string, year: number): Promise<HolidayOverride[]> {
    const col = collection(db, paths.tenantHolidays(tenantId));
    const snapshot = await getDocs(query(col, orderBy("date", "asc")));

    const prefix = `${year}-`;
    return snapshot.docs
      .map(mapOverride)
      .filter((o) => typeof o.date === "string" && o.date.startsWith(prefix));
  },

  async upsertTenantHolidayOverride(
    tenantId: string,
    override: Omit<HolidayOverride, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">,
    userId?: string
  ): Promise<void> {
    const docRef = doc(db, paths.tenantHoliday(tenantId, override.date));
    const existing = await getDoc(docRef);

    const base = {
      date: override.date,
      name: override.name ?? "",
      nameTetun: override.nameTetun ?? "",
      isHoliday: override.isHoliday,
      notes: override.notes ?? "",
      updatedAt: serverTimestamp(),
      updatedBy: userId ?? null,
    };

    if (!existing.exists()) {
      await setDoc(docRef, {
        ...base,
        createdAt: serverTimestamp(),
        createdBy: userId ?? null,
      });
      return;
    }

    await setDoc(docRef, base, { merge: true });
  },

  async deleteTenantHolidayOverride(tenantId: string, date: string): Promise<void> {
    await deleteDoc(doc(db, paths.tenantHoliday(tenantId, date)));
  },
};

export default holidayService;

