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
  const date = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + recurring.dueDays);

    // Create the invoice
    const invoiceId = await invoiceService.createInvoice(tenantId, {
      customerId: recurring.customerId,
      issueDate,
      dueDate: dueDate.toISOString().split('T')[0],
      items: recurring.items.map(({ id, ...item }) => item),
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
    const errors: string[] = [];
    let generated = 0;

    for (const recurring of due) {
      try {
        await this.generateInvoice(tenantId, recurring.id);
        generated++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${recurring.id}: ${message}`);
      }
    }

    return { generated, errors };
  }
}

export const recurringInvoiceService = new RecurringInvoiceService();
export default recurringInvoiceService;
