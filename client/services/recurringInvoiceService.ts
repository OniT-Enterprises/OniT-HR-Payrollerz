/**
 * Recurring Invoice Service
 * Firestore CRUD operations for recurring invoice templates
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addDays, formatDateISO, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import type {
  RecurringInvoice,
  RecurringInvoiceFormData,
  RecurringStatus,
  RecurringFrequency,
  InvoiceItem,
} from '@/types/money';
import { customerService } from './customerService';
import { invoiceService } from './invoiceService';

/**
 * Maps Firestore document to RecurringInvoice
 */
function mapRecurringInvoice(docSnap: DocumentSnapshot): RecurringInvoice {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : data.updatedAt || new Date(),
    lastGeneratedAt: data.lastGeneratedAt instanceof Timestamp
      ? data.lastGeneratedAt.toDate()
      : data.lastGeneratedAt || undefined,
  } as RecurringInvoice;
}

/**
 * Calculate next run date based on frequency
 */
function calculateNextRunDate(currentDate: string, frequency: RecurringFrequency): string {
  const source = parseDateISO(currentDate);
  const sourceYear = source.getUTCFullYear();
  const sourceMonth = source.getUTCMonth();
  const sourceDay = source.getUTCDate();
  const sourceMonthLastDay = new Date(Date.UTC(sourceYear, sourceMonth + 1, 0)).getUTCDate();
  const keepEndOfMonth = sourceDay === sourceMonthLastDay;

  if (frequency === 'weekly') {
    return formatDateISO(addDays(source, 7));
  }

  const target = new Date(source.getTime());

  switch (frequency) {
    case 'monthly':
      target.setUTCMonth(target.getUTCMonth() + 1);
      break;
    case 'quarterly':
      target.setUTCMonth(target.getUTCMonth() + 3);
      break;
    case 'yearly':
      target.setUTCFullYear(target.getUTCFullYear() + 1);
      break;
  }

  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const targetMonthLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = keepEndOfMonth ? targetMonthLastDay : Math.min(sourceDay, targetMonthLastDay);

  const normalized = new Date(Date.UTC(targetYear, targetMonth, day, 12, 0, 0));
  return formatDateISO(normalized);
}

class RecurringInvoiceService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.recurringInvoices(tenantId));
  }

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Get all recurring invoices
   */
  async getAll(tenantId: string): Promise<RecurringInvoice[]> {
    const q = query(
      this.collectionRef(tenantId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapRecurringInvoice);
  }

  /**
   * Get recurring invoices by status
   */
  async getByStatus(tenantId: string, status: RecurringStatus): Promise<RecurringInvoice[]> {
    const q = query(
      this.collectionRef(tenantId),
      where('status', '==', status),
      orderBy('nextRunDate', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapRecurringInvoice);
  }

  /**
   * Get recurring invoices due to run
   */
  async getDueForGeneration(tenantId: string): Promise<RecurringInvoice[]> {
    const today = getTodayTL();
    const q = query(
      this.collectionRef(tenantId),
      where('status', '==', 'active'),
      where('nextRunDate', '<=', today)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapRecurringInvoice);
  }

  /**
   * Get a single recurring invoice by ID
   */
  async getById(tenantId: string, id: string): Promise<RecurringInvoice | null> {
    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapRecurringInvoice(docSnap);
  }

  /**
   * Create a new recurring invoice
   */
  async create(tenantId: string, data: RecurringInvoiceFormData): Promise<string> {
    // Get customer info
    const customer = await customerService.getCustomerById(tenantId, data.customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Add IDs to items
    const items: InvoiceItem[] = data.items.map((item, index) => ({
      ...item,
      id: `item-${Date.now()}-${index}`,
    }));

    const recurring: Omit<RecurringInvoice, 'id'> = {
      customerId: data.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      endAfterOccurrences: data.endAfterOccurrences,
      nextRunDate: data.startDate, // First run on start date
      items,
      taxRate: data.taxRate,
      notes: data.notes,
      terms: data.terms,
      dueDays: data.dueDays,
      autoSend: data.autoSend,
      status: 'active',
      generatedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...recurring,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update a recurring invoice
   */
  async update(tenantId: string, id: string, data: Partial<RecurringInvoiceFormData>): Promise<boolean> {
    const existing = await this.getById(tenantId, id);
    if (!existing) {
      throw new Error('Recurring invoice not found');
    }

    const updates: Partial<RecurringInvoice> = {};

    // Copy updatable fields
    if (data.frequency !== undefined) updates.frequency = data.frequency;
    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;
    if (data.endAfterOccurrences !== undefined) updates.endAfterOccurrences = data.endAfterOccurrences;
    if (data.taxRate !== undefined) updates.taxRate = data.taxRate;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.terms !== undefined) updates.terms = data.terms;
    if (data.dueDays !== undefined) updates.dueDays = data.dueDays;
    if (data.autoSend !== undefined) updates.autoSend = data.autoSend;

    // Update items if provided
    if (data.items) {
      updates.items = data.items.map((item, index) => ({
        ...item,
        id: `item-${Date.now()}-${index}`,
      }));
    }

    // Update customer if changed
    if (data.customerId && data.customerId !== existing.customerId) {
      const customer = await customerService.getCustomerById(tenantId, data.customerId);
      if (customer) {
        updates.customerId = data.customerId;
        updates.customerName = customer.name;
        updates.customerEmail = customer.email;
      }
    }

    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Pause a recurring invoice
   */
  async pause(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    await updateDoc(docRef, {
      status: 'paused',
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Resume a paused recurring invoice
   */
  async resume(tenantId: string, id: string): Promise<boolean> {
    const recurring = await this.getById(tenantId, id);
    if (!recurring) {
      throw new Error('Recurring invoice not found');
    }

    // If next run date is in the past, set it to today
    const today = getTodayTL();
    const nextRunDate = recurring.nextRunDate < today ? today : recurring.nextRunDate;

    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    await updateDoc(docRef, {
      status: 'active',
      nextRunDate,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete a recurring invoice
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    await deleteDoc(docRef);
    return true;
  }

  // ----------------------------------------
  // Invoice Generation
  // ----------------------------------------

  /**
   * Generate an invoice from a recurring template
   */
  async generateInvoice(tenantId: string, recurringId: string): Promise<string> {
    const recurring = await this.getById(tenantId, recurringId);
    if (!recurring) {
      throw new Error('Recurring invoice not found');
    }

    if (recurring.status !== 'active') {
      throw new Error('Cannot generate invoice from paused/completed recurring');
    }

    // Check if we've reached the end conditions
    if (recurring.endDate && recurring.nextRunDate > recurring.endDate) {
      await this.markCompleted(tenantId, recurringId);
      throw new Error('Recurring invoice has reached its end date');
    }

    if (recurring.endAfterOccurrences && recurring.generatedCount >= recurring.endAfterOccurrences) {
      await this.markCompleted(tenantId, recurringId);
      throw new Error('Recurring invoice has reached maximum occurrences');
    }

    // Calculate due date
    const issueDate = recurring.nextRunDate;
    const dueDate = formatDateISO(addDays(parseDateISO(issueDate), recurring.dueDays));

    // Create the invoice
    const invoiceId = await invoiceService.createInvoice(tenantId, {
      customerId: recurring.customerId,
      issueDate,
      dueDate,
      items: recurring.items.map(({ id: _id, ...item }) => item),
      taxRate: recurring.taxRate,
      notes: recurring.notes,
      terms: recurring.terms,
    });

    // Update recurring invoice
    const nextRunDate = calculateNextRunDate(recurring.nextRunDate, recurring.frequency);
    const newCount = recurring.generatedCount + 1;

    // Check if this was the last one
    const shouldComplete =
      (recurring.endAfterOccurrences && newCount >= recurring.endAfterOccurrences) ||
      (recurring.endDate && nextRunDate > recurring.endDate);

    const docRef = doc(db, paths.recurringInvoice(tenantId, recurringId));
    await updateDoc(docRef, {
      nextRunDate,
      generatedCount: newCount,
      lastGeneratedAt: serverTimestamp(),
      lastInvoiceId: invoiceId,
      status: shouldComplete ? 'completed' : 'active',
      updatedAt: serverTimestamp(),
    });

    // Auto-send if enabled
    if (recurring.autoSend) {
      try {
        await invoiceService.markAsSent(tenantId, invoiceId);
      } catch (error) {
        console.error('Failed to auto-send invoice:', error);
      }
    }

    return invoiceId;
  }

  /**
   * Mark a recurring invoice as completed
   */
  private async markCompleted(tenantId: string, id: string): Promise<void> {
    const docRef = doc(db, paths.recurringInvoice(tenantId, id));
    await updateDoc(docRef, {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Process all due recurring invoices
   * This should be called by a scheduled job
   */
  async processAllDue(tenantId: string): Promise<{ generated: number; errors: string[] }> {
    const due = await this.getDueForGeneration(tenantId);

    const results = await Promise.allSettled(
      due.map(recurring => this.generateInvoice(tenantId, recurring.id))
    );

    const errors: string[] = [];
    let generated = 0;
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        generated++;
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`${due[i].id}: ${message}`);
      }
    });

    return { generated, errors };
  }
}

export const recurringInvoiceService = new RecurringInvoiceService();
