/**
 * Shift Service - Firebase Operations
 * Handles shift scheduling CRUD for the ShiftScheduling page
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addDaysISO } from '@/lib/dateUtils';

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
  ): Promise<ShiftRecord[]> {
    const q = query(
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
    data: Omit<ShiftRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const docRef = await addDoc(this.shiftsRef(tenantId), {
      ...data,
      tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Update an existing shift
   */
  async updateShift(
    tenantId: string,
    shiftId: string,
    data: Partial<Omit<ShiftRecord, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void> {
    const docRef = doc(this.shiftsRef(tenantId), shiftId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
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
  ): Promise<number> {
    const shifts = await this.getShiftsByDateRange(tenantId, startDate, endDate);
    const drafts = shifts.filter((s) => s.status === 'draft');

    if (drafts.length === 0) return 0;

    const batch = writeBatch(db);
    for (const shift of drafts) {
      const docRef = doc(this.shiftsRef(tenantId), shift.id!);
      batch.update(docRef, { status: 'published', updatedAt: serverTimestamp() });
    }
    await batch.commit();
    return drafts.length;
  }

  /**
   * Copy all shifts in a week to the following week as drafts.
   * Returns the number of shifts created.
   */
  async copyWeekToNext(
    tenantId: string,
    startDate: string,
    endDate: string,
    createdBy: string,
  ): Promise<number> {
    const shifts = await this.getShiftsByDateRange(tenantId, startDate, endDate);
    const toCopy = shifts.filter((s) => s.status !== 'cancelled');
    if (toCopy.length === 0) return 0;

    const batch = writeBatch(db);
    for (const shift of toCopy) {
      const ref = doc(this.shiftsRef(tenantId));
      batch.set(ref, {
        tenantId,
        employeeId: shift.employeeId,
        employeeName: shift.employeeName,
        department: shift.department,
        position: shift.position,
        date: addDaysISO(shift.date, 7),
        startTime: shift.startTime,
        endTime: shift.endTime,
        hours: shift.hours,
        status: 'draft',
        location: shift.location,
        ...(shift.slotId ? { slotId: shift.slotId } : {}),
        notes: shift.notes,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return toCopy.length;
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
