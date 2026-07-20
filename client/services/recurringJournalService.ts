/**
 * Recurring journal templates — CRUD on tenants/{tid}/recurringJournals.
 * The daily scheduler (functions/src/accounting.ts, processRecurringJournals)
 * does the posting; this service only manages templates. Validation lives in
 * client/lib/accounting/recurring.ts (shared, pure).
 */
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
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { JournalEntry, RecurringJournalTemplate } from '@/types/accounting';
import {
  clampNextRunAfterLastPosting,
  firstRunDate,
  validateRecurringTemplate,
} from '@/lib/accounting/recurring';
import { getTodayTL } from '@/lib/dateUtils';

const colRef = (tenantId: string) => collection(db, `tenants/${tenantId}/recurringJournals`);

function mapTemplate(id: string, data: Record<string, unknown>): RecurringJournalTemplate {
  return {
    id,
    ...(data as Omit<RecurringJournalTemplate, 'id'>),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
  };
}

export const recurringJournalService = {
  async list(tenantId: string): Promise<RecurringJournalTemplate[]> {
    const snap = await getDocs(query(colRef(tenantId), orderBy('name')));
    return snap.docs.map((d) => mapTemplate(d.id, d.data()));
  },

  /**
   * Create a template from an existing journal entry ("Make recurring…").
   * Lines are copied verbatim (dimensions included); the entry's description
   * becomes the default name.
   */
  async createFromEntry(
    tenantId: string,
    entry: JournalEntry,
    options: { name: string; dayOfMonth: number; endDate?: string },
    createdBy: string,
  ): Promise<string> {
    const lines = entry.lines.map((line, index) => ({
      ...line,
      lineNumber: index + 1,
    }));
    const errors = validateRecurringTemplate({
      name: options.name,
      dayOfMonth: options.dayOfMonth,
      lines,
    });
    if (errors.length) {
      throw new Error(`Invalid recurring template: ${errors.join(', ')}`);
    }

    const ref = doc(colRef(tenantId));
    const template: Omit<RecurringJournalTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: options.name.trim(),
      lines,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      frequency: 'monthly',
      dayOfMonth: options.dayOfMonth,
      nextRunDate: firstRunDate(getTodayTL(), options.dayOfMonth),
      ...(options.endDate ? { endDate: options.endDate } : {}),
      active: true,
      postedCount: 0,
      createdBy,
    };
    await setDoc(ref, {
      ...template,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async setActive(tenantId: string, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(colRef(tenantId), id), {
      active,
      updatedAt: serverTimestamp(),
    });
  },

  async updateSchedule(
    tenantId: string,
    id: string,
    changes: { dayOfMonth: number; endDate?: string | null },
  ): Promise<void> {
    const ref = doc(colRef(tenantId), id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Recurring template not found.');
    // Recomputing nextRunDate from today can land back in a month the
    // scheduler already posted — clamp it forward past the last posting.
    // (The scheduler's per-(template, period) guard doc is the backstop.)
    const { lastRunDate } = snap.data() as Pick<RecurringJournalTemplate, 'lastRunDate'>;
    await updateDoc(ref, {
      dayOfMonth: changes.dayOfMonth,
      nextRunDate: clampNextRunAfterLastPosting(
        firstRunDate(getTodayTL(), changes.dayOfMonth),
        lastRunDate,
        changes.dayOfMonth,
      ),
      endDate: changes.endDate ?? null,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(colRef(tenantId), id));
  },
};
