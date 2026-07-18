/**
 * Shift Service - Firebase Operations
 * Handles shift scheduling CRUD for the ShiftScheduling page
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctionsLazy } from '@/lib/firebase';

// Pure calculations/slot config live in a Firebase-free module so they can be
// unit-tested without loading the Firestore client. Re-exported here so existing
// importers of `@/services/shiftService` keep working unchanged.
import { DEFAULT_SHIFT_SLOTS, type ShiftSlot } from '@/lib/shiftCalculations';
export { calcShiftHours, DEFAULT_SHIFT_SLOTS } from '@/lib/shiftCalculations';
export type { ShiftSlot } from '@/lib/shiftCalculations';

// ============================================
// TYPES
// ============================================

export type ShiftStatus = 'draft' | 'published' | 'confirmed' | 'cancelled';

export interface ShiftRecord {
  id?: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId?: string;
  position: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  hours: number;
  status: ShiftStatus;
  location: string;
  /** Which configured shift slot this shift was created from (e.g. "morning") */
  slotId?: string;
  notes: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ShiftWrite = Omit<ShiftRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

async function saveValidatedShift(
  tenantId: string,
  shiftData: ShiftWrite,
  shiftId?: string,
): Promise<string> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import('firebase/functions'),
    getFunctionsLazy(),
  ]);
  const callable = httpsCallable<
    { tenantId: string; shiftData: ShiftWrite; shiftId?: string },
    { success: true; shiftId: string; hours: number }
  >(functions, 'createOrUpdateShift');
  const result = await callable({ tenantId, shiftData, ...(shiftId ? { shiftId } : {}) });
  return result.data.shiftId;
}

// ============================================
// SERVICE
// ============================================

class ShiftService {
  private shiftsRef(tenantId: string) {
    return collection(db, `tenants/${tenantId}/shifts`);
  }

  private slotConfigRef(tenantId: string) {
    return doc(db, `tenants/${tenantId}/settings/shift_config`);
  }

  /**
   * Get shifts for a date range
   */
  async getShiftsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    departmentId?: string,
  ): Promise<ShiftRecord[]> {
    const q = departmentId
      ? query(
          this.shiftsRef(tenantId),
          where('departmentId', '==', departmentId),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc'),
        )
      : query(
          this.shiftsRef(tenantId),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc'),
        );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
      updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
    })) as ShiftRecord[];
  }

  /**
   * Create a new shift
   */
  async createShift(
    tenantId: string,
    data: ShiftWrite,
  ): Promise<string> {
    return saveValidatedShift(tenantId, data);
  }

  /**
   * Update an existing shift
   */
  async updateShift(
    tenantId: string,
    shiftId: string,
    data: ShiftWrite,
  ): Promise<void> {
    await saveValidatedShift(tenantId, data, shiftId);
  }

  /**
   * Delete a shift
   */
  async deleteShift(tenantId: string, shiftId: string): Promise<void> {
    const docRef = doc(this.shiftsRef(tenantId), shiftId);
    await deleteDoc(docRef);
  }

  /**
   * Publish all draft shifts for a date range (bulk status update)
   */
  async publishDraftShifts(
    tenantId: string,
    startDate: string,
    endDate: string,
    departmentId?: string,
  ): Promise<number> {
    const shifts = await this.getShiftsByDateRange(tenantId, startDate, endDate, departmentId);
    const drafts = shifts.filter((s) => s.status === 'draft');

    if (drafts.length === 0) return 0;

    let batch = writeBatch(db);
    let writes = 0;
    for (const shift of drafts) {
      const docRef = doc(this.shiftsRef(tenantId), shift.id!);
      batch.update(docRef, { status: 'published', updatedAt: serverTimestamp() });
      writes += 1;
      if (writes === 450) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();
    return drafts.length;
  }

  /**
   * Copy all shifts in a week to the following week as drafts.
   *
   * Runs entirely server-side in one batched Cloud Function call — cloning a
   * full guard-company rotation is ~1,800 shifts, which the old per-shift
   * callable loop turned into minutes of latency. The function skips targets
   * that already exist (idempotent re-copy) and employees on approved leave.
   * Returns { created, skipped }.
   */
  async copyWeekToNext(
    tenantId: string,
    startDate: string,
    endDate: string,
    _createdBy: string,
    departmentId?: string,
  ): Promise<{ created: number; skipped: number }> {
    const [{ httpsCallable }, functions] = await Promise.all([
      import('firebase/functions'),
      getFunctionsLazy(),
    ]);
    const callable = httpsCallable<
      { tenantId: string; startDate: string; endDate: string; departmentId?: string },
      { created: number; skipped: number }
    >(functions, 'copyWeekShifts');
    const result = await callable({
      tenantId,
      startDate,
      endDate,
      ...(departmentId ? { departmentId } : {}),
    });
    return result.data;
  }

  /**
   * Get the tenant's shift slot configuration (Morning/Afternoon/Night times).
   * Falls back to TL defaults when nothing has been saved yet.
   */
  async getShiftSlots(tenantId: string): Promise<ShiftSlot[]> {
    const snap = await getDoc(this.slotConfigRef(tenantId));
    const saved = snap.exists() ? (snap.data().slots as ShiftSlot[] | undefined) : undefined;
    if (!saved || saved.length === 0) return DEFAULT_SHIFT_SLOTS;
    // Merge over defaults so new default slots appear for older configs
    return DEFAULT_SHIFT_SLOTS.map(
      (def) => saved.find((s) => s.id === def.id) ?? def,
    );
  }

  /**
   * Persist the tenant's shift slot configuration
   */
  async saveShiftSlots(tenantId: string, slots: ShiftSlot[]): Promise<void> {
    await setDoc(
      this.slotConfigRef(tenantId),
      { slots, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

export const shiftService = new ShiftService();
