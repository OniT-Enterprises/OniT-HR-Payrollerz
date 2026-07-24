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
  type QueryDocumentSnapshot,
  type DocumentData,
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

function mapOverride(docSnap: QueryDocumentSnapshot<DocumentData>): HolidayOverride {
  const data = docSnap.data();
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

/**
 * Every read pulls the tenant's whole (small) overrides collection and filters
 * by year in memory, so a deadline sweep that asks for three years used to cost
 * three identical reads. Cache the list per tenant for callers that opt in, and
 * bust it here on write — the previous cache lived in taxFilingService and was
 * never invalidated, so a holiday edited in Settings did not move a tax due
 * date until a full page reload.
 */
const overrideCache = new Map<string, Promise<HolidayOverride[]>>();

async function fetchOverrides(tenantId: string): Promise<HolidayOverride[]> {
  const col = collection(db, paths.tenantHolidays(tenantId));
  const snapshot = await getDocs(query(col, orderBy("date", "asc")));
  return snapshot.docs.map(mapOverride);
}

const inYear = (overrides: HolidayOverride[], year: number) => {
  const prefix = `${year}-`;
  return overrides.filter(
    (o) => typeof o.date === "string" && o.date.startsWith(prefix)
  );
};

export const holidayService = {
  /** Always hits Firestore — settings screens must see other admins' edits. */
  async listTenantHolidayOverrides(tenantId: string, year: number): Promise<HolidayOverride[]> {
    return inYear(await fetchOverrides(tenantId), year);
  },

  /**
   * Cached variant for read-heavy derivations (tax deadline sweeps). Local
   * writes bust it; a write from another session is picked up on reload.
   */
  async listTenantHolidayOverridesCached(
    tenantId: string,
    year: number
  ): Promise<HolidayOverride[]> {
    let load = overrideCache.get(tenantId);
    if (!load) {
      load = fetchOverrides(tenantId);
      overrideCache.set(tenantId, load);
      // Never leave a rejected promise cached — the next read must retry.
      load.catch(() => overrideCache.delete(tenantId));
    }
    return inYear(await load, year);
  },

  /** Drop the cached overrides (all tenants when none is given). */
  invalidateHolidayOverrideCache(tenantId?: string): void {
    if (tenantId) overrideCache.delete(tenantId);
    else overrideCache.clear();
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
      overrideCache.delete(tenantId);
      return;
    }

    await setDoc(docRef, base, { merge: true });
    overrideCache.delete(tenantId);
  },

  async deleteTenantHolidayOverride(tenantId: string, date: string): Promise<void> {
    await deleteDoc(doc(db, paths.tenantHoliday(tenantId, date)));
    overrideCache.delete(tenantId);
  },
};

