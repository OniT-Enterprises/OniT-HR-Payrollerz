/**
 * Shift Service - Firebase Operations
 * Handles shift scheduling CRUD for the ShiftScheduling page
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  notes: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShiftTemplate {
  id?: string;
  tenantId: string;
  name: string;
  department: string;
  shifts: {
    department: string;
    position: string;
    startTime: string;
    endTime: string;
    hours: number;
    location: string;
    notes: string;
  }[];
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

  private templatesRef(tenantId: string) {
    return collection(db, `tenants/${tenantId}/shiftTemplates`);
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
   * Get shift templates
   */
  async getTemplates(tenantId: string): Promise<ShiftTemplate[]> {
    const q = query(this.templatesRef(tenantId), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
      updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
    })) as ShiftTemplate[];
  }

  /**
   * Apply a template — creates shifts for each template entry on the given dates
   */
  async applyTemplate(
    tenantId: string,
    template: ShiftTemplate,
    startDate: string,
    createdBy: string,
  ): Promise<number> {
    const batch = writeBatch(db);
    let count = 0;

    for (const shiftDef of template.shifts) {
      const ref = doc(this.shiftsRef(tenantId));
      batch.set(ref, {
        tenantId,
        employeeId: '',
        employeeName: '',
        department: shiftDef.department,
        position: shiftDef.position,
        date: startDate,
        startTime: shiftDef.startTime,
        endTime: shiftDef.endTime,
        hours: shiftDef.hours,
        status: 'draft',
        location: shiftDef.location,
        notes: shiftDef.notes,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    await batch.commit();
    return count;
  }
}

export const shiftService = new ShiftService();
export default shiftService;
