/**
 * Invoice Service
 * Firestore CRUD operations for invoices and payments
 * Refactored with server-side filtering and proper type safety
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
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { formatDateISO, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import { addMoney, subtractMoney, sumMoney, multiplyMoney, percentOf } from '@/lib/currency';
import type {
  Invoice,
  InvoiceFormData,
  InvoiceItem,
  InvoiceStatus,
  InvoiceSettings,
  PaymentReceived,
  PaymentFormData,
  MoneyStats,
} from '@/types/money';
import { customerService } from './customerService';
import { journalEntryService, accountService } from './accountingService';
import { firestoreInvoiceSchema } from '@/lib/validations';

// ============================================
// FILTER INTERFACES
// ============================================

export interface InvoiceFilters {
  // Server-side filters
  status?: InvoiceStatus | InvoiceStatus[];
  customerId?: string;
  dueBefore?: string; // YYYY-MM-DD

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

const PAYMENT_EPSILON = 0.00001;

// ============================================
// MAPPER FUNCTION
// ============================================

function mapInvoice(docSnap: DocumentSnapshot): Invoice {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  // Validate with Zod schema
  const validated = firestoreInvoiceSchema.safeParse(data);

  if (!validated.success) {
    console.warn(`Invoice validation warning (${docSnap.id}):`, validated.error.flatten().fieldErrors);
  }

  const parsed = validated.success ? validated.data : data;

  return {
    id: docSnap.id,
    ...parsed,
    // Handle additional date fields not in base schema
    sentAt: data.sentAt instanceof Timestamp
      ? data.sentAt.toDate()
      : data.sentAt || undefined,
    paidAt: data.paidAt instanceof Timestamp
      ? data.paidAt.toDate()
      : data.paidAt || undefined,
    viewedAt: data.viewedAt instanceof Timestamp
      ? data.viewedAt.toDate()
      : data.viewedAt || undefined,
  } as Invoice;
}

function mapPayment(docSnap: DocumentSnapshot): PaymentReceived {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
  } as PaymentReceived;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = parseDateISO(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateISO(date);
}

// ============================================
// INVOICE SERVICE
// ============================================

class InvoiceService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.invoices(tenantId));
  }

  private paymentsRef(tenantId: string) {
    return collection(db, paths.paymentsReceived(tenantId));
  }

  private settingsRef(tenantId: string) {
    return doc(db, paths.invoiceSettings(tenantId));
  }

  // ----------------------------------------
  // Invoice CRUD with Server-Side Filtering
  // ----------------------------------------

  /**
   * Get invoices with server-side filtering and pagination
   */
  async getInvoices(
    tenantId: string,
    filters: InvoiceFilters = {}
  ): Promise<PaginatedResult<Invoice>> {
    const {
      status,
      customerId,
      dueBefore,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      dateFrom,
      dateTo,
    } = filters;

    const constraints: QueryConstraint[] = [];

    // Server-side filters
    if (status) {
      if (Array.isArray(status)) {
        constraints.push(where('status', 'in', status));
      } else {
        constraints.push(where('status', '==', status));
      }
    }

    if (customerId) {
      constraints.push(where('customerId', '==', customerId));
    }

    if (dueBefore) {
      constraints.push(where('dueDate', '<', dueBefore));
    }

    // Ordering and pagination
    constraints.push(orderBy('issueDate', 'desc'));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef(tenantId), ...constraints);
    const querySnapshot = await getDocs(q);

    let invoices = querySnapshot.docs.map(mapInvoice);
    const hasMore = invoices.length > pageSize;

    if (hasMore) {
      invoices = invoices.slice(0, pageSize);
    }

    const lastDoc = invoices.length > 0
      ? querySnapshot.docs[invoices.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      invoices = invoices.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.customerName.toLowerCase().includes(term) ||
        inv.customerEmail?.toLowerCase().includes(term)
      );
    }

    if (dateFrom) {
      invoices = invoices.filter(inv => inv.issueDate >= dateFrom);
    }

    if (dateTo) {
      invoices = invoices.filter(inv => inv.issueDate <= dateTo);
    }

    return {
      data: invoices,
      lastDoc,
      hasMore,
      totalFetched: invoices.length,
    };
  }

  /**
   * Get all invoices (convenience method)
   * @deprecated Use getInvoices() with filters for better performance
   */
  async getAllInvoices(tenantId: string, maxResults: number = 500): Promise<Invoice[]> {
    const result = await this.getInvoices(tenantId, { pageSize: maxResults });
    return result.data;
  }

  /**
   * Get invoices by status (server-side filtered)
   */
  async getInvoicesByStatus(tenantId: string, status: InvoiceStatus): Promise<Invoice[]> {
    const result = await this.getInvoices(tenantId, { status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get invoices for a customer (server-side filtered)
   */
  async getInvoicesByCustomer(tenantId: string, customerId: string): Promise<Invoice[]> {
    const result = await this.getInvoices(tenantId, { customerId, pageSize: 500 });
    return result.data;
  }

  /**
   * Get overdue invoices (server-side filtered)
   */
  async getOverdueInvoices(tenantId: string): Promise<Invoice[]> {
    const today = getTodayTL();
    const result = await this.getInvoices(tenantId, {
      status: ['sent', 'viewed', 'partial'],
      dueBefore: today,
      pageSize: 500,
    });
    return result.data;
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoiceById(tenantId: string, id: string): Promise<Invoice | null> {
    const docRef = doc(db, paths.invoice(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapInvoice(docSnap);
  }

  /**
   * Get invoice by share token (for public viewing)
   */
  async getInvoiceByShareToken(tenantId: string, token: string): Promise<Invoice | null> {
    const q = query(
      this.collectionRef(tenantId),
      where('shareToken', '==', token),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    return mapInvoice(querySnapshot.docs[0]);
  }

  /**
   * Create a new invoice
   */
  async createInvoice(tenantId: string, data: InvoiceFormData): Promise<string> {
    // Get customer info
    const customer = await customerService.getCustomerById(tenantId, data.customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get next invoice number
    const invoiceNumber = await this.getNextInvoiceNumber(tenantId);

    // Calculate totals
    const items: InvoiceItem[] = data.items.map((item, index) => ({
      id: `item_${Date.now()}_${index}`,
      ...item,
      amount: multiplyMoney(item.quantity, item.unitPrice),
    }));

    const subtotal = sumMoney(items.map(item => item.amount));
    const taxAmount = percentOf(subtotal, data.taxRate);
    const total = addMoney(subtotal, taxAmount);

    // Generate share token
    const shareToken = this.generateShareToken();

    const invoice: Omit<Invoice, 'id'> = {
      invoiceNumber,
      customerId: data.customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      items,
      subtotal,
      taxRate: data.taxRate,
      taxAmount,
      total,
      status: 'draft',
      amountPaid: 0,
      balanceDue: total,
      notes: data.notes,
      terms: data.terms,
      currency: 'USD',
      shareToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...invoice,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing invoice (only if draft)
   */
  async updateInvoice(
    tenantId: string,
    id: string,
    data: Partial<InvoiceFormData>
  ): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error('Cannot edit invoice that has been sent');
    }

    // Build updates object
    const updates: Partial<Invoice> = {};

    // Copy simple fields
    if (data.issueDate) updates.issueDate = data.issueDate;
    if (data.dueDate) updates.dueDate = data.dueDate;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.terms !== undefined) updates.terms = data.terms;

    // If items are being updated, recalculate totals
    if (data.items) {
      const items: InvoiceItem[] = data.items.map((item, index) => ({
        id: `item_${Date.now()}_${index}`,
        ...item,
        amount: multiplyMoney(item.quantity, item.unitPrice),
      }));

      const subtotal = sumMoney(items.map(item => item.amount));
      const taxRate = data.taxRate ?? invoice.taxRate;
      const taxAmount = percentOf(subtotal, taxRate);
      const total = addMoney(subtotal, taxAmount);

      updates.items = items;
      updates.subtotal = subtotal;
      updates.taxRate = taxRate;
      updates.taxAmount = taxAmount;
      updates.total = total;
      updates.balanceDue = subtractMoney(total, invoice.amountPaid);

      if (updates.balanceDue < -PAYMENT_EPSILON) {
        throw new Error('Cannot reduce invoice total below amount already paid');
      }
    }

    // If customer changed, update customer info
    if (data.customerId && data.customerId !== invoice.customerId) {
      const customer = await customerService.getCustomerById(tenantId, data.customerId);
      if (customer) {
        updates.customerName = customer.name;
        updates.customerEmail = customer.email;
        updates.customerPhone = customer.phone;
        updates.customerAddress = customer.address;
      }
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Mark invoice as sent
   * Also creates a journal entry (Debit AR, Credit Revenue)
   * Uses transaction to ensure invoice status + journal entry are atomic
   */
  async markAsSent(tenantId: string, id: string, userId?: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot send a cancelled invoice');
    }

    // Check if chart of accounts is set up (read BEFORE transaction)
    const accounts = await accountService.getAllAccounts(tenantId);
    const shouldCreateJournal = accounts.length > 0;
    let needsJournal = false;
    let resolvedAccounts: Record<string, { id: string; name: string }> | undefined;

    if (shouldCreateJournal) {
      // Check for existing journal entry (query, not transaction-safe)
      const existing = await journalEntryService.getJournalEntryBySource(
        tenantId,
        'invoice',
        id
      );
      needsJournal = !existing;

      if (needsJournal) {
        // Pre-resolve account IDs outside transaction (getDocs not transaction-safe)
        const [arAccount, revenueAccount] = await Promise.all([
          accountService.getAccountByCode(tenantId, '1210'),
          accountService.getAccountByCode(tenantId, '4100'),
        ]);
        if (!arAccount?.id) throw new Error('Missing account for code 1210. Initialize chart of accounts first.');
        if (!revenueAccount?.id) throw new Error('Missing account for code 4100. Initialize chart of accounts first.');
        resolvedAccounts = {
          '1210': { id: arAccount.id, name: arAccount.name },
          '4100': { id: revenueAccount.id, name: revenueAccount.name },
        };
      }
    }

    // Atomic: journal entry + status update in one transaction
    if (invoice.status === 'draft' || needsJournal) {
      const invoiceRef = doc(db, paths.invoice(tenantId, id));
      await runTransaction(db, async (transaction) => {
        if (needsJournal) {
          await journalEntryService.createFromInvoice(
            tenantId,
            invoice,
            userId || 'system',
            transaction,
            resolvedAccounts
          );
        }
        if (invoice.status === 'draft') {
          transaction.update(invoiceRef, {
            status: 'sent',
            sentAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
    }

    return true;
  }

  /**
   * Mark invoice as viewed (when customer opens share link)
   */
  async markAsViewed(tenantId: string, id: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice || invoice.status === 'draft' || invoice.viewedAt) {
      return false;
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await updateDoc(docRef, {
      status: invoice.status === 'sent' ? 'viewed' : invoice.status,
      viewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(tenantId: string, id: string, reason?: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'paid') {
      throw new Error('Cannot void a fully paid invoice');
    }
    if ((invoice.amountPaid || 0) > PAYMENT_EPSILON) {
      throw new Error('Cannot cancel an invoice with recorded payments');
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await updateDoc(docRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelReason: reason || null,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete a draft invoice
   */
  async deleteInvoice(tenantId: string, id: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error('Cannot delete invoice that has been sent. Cancel it instead.');
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Send a payment reminder for an invoice
   * Updates reminder tracking fields
   */
  async sendReminder(tenantId: string, id: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)) {
      throw new Error('Cannot send reminder for this invoice status');
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await updateDoc(docRef, {
      lastReminderAt: serverTimestamp(),
      reminderCount: (invoice.reminderCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });

    // Queue reminder email via Firestore mail collection
    if (invoice.customerEmail) {
      const mailRef = collection(db, 'mail');
      await addDoc(mailRef, {
        tenantId,
        to: [invoice.customerEmail],
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Payment Reminder</h2>
            <p>Dear ${invoice.customerName},</p>
            <p>This is a friendly reminder that invoice <strong>${invoice.invoiceNumber}</strong> is outstanding.</p>
            <ul style="list-style: none; padding: 0;">
              <li>Invoice Number: ${invoice.invoiceNumber}</li>
              <li>Due Date: ${invoice.dueDate}</li>
              <li>Amount Due: $${(invoice.total - (invoice.amountPaid || 0)).toFixed(2)}</li>
            </ul>
            <p>Please arrange payment at your earliest convenience.</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This is an automated reminder. If you have already made payment, please disregard this message.
            </p>
          </div>
        `,
        text: `Payment Reminder: Invoice ${invoice.invoiceNumber}\n\nDear ${invoice.customerName},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} is outstanding.\nAmount Due: $${(invoice.total - (invoice.amountPaid || 0)).toFixed(2)}\nDue Date: ${invoice.dueDate}\n\nPlease arrange payment at your earliest convenience.`,
        status: 'pending',
        purpose: 'notification',
        relatedId: id,
        createdAt: serverTimestamp(),
      });
    }

    return true;
  }

  /**
   * Duplicate an invoice
   */
  async duplicateInvoice(tenantId: string, id: string): Promise<string> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const today = getTodayTL();
    const dueDate = addDaysISO(today, 30);

    const newInvoice: InvoiceFormData = {
      customerId: invoice.customerId,
      issueDate: today,
      dueDate,
      items: invoice.items.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
        amount: multiplyMoney(quantity, unitPrice),
      })),
      taxRate: invoice.taxRate,
      notes: invoice.notes,
      terms: invoice.terms,
    };

    return this.createInvoice(tenantId, newInvoice);
  }

  // ----------------------------------------
  // Payments
  // ----------------------------------------

  /**
   * Record a payment for an invoice
   * Uses transaction to ensure atomicity of payment + invoice update + journal entry
   */
  async recordPayment(
    tenantId: string,
    invoiceId: string,
    payment: PaymentFormData,
    userId?: string
  ): Promise<string> {
    const invoiceRef = doc(db, paths.invoice(tenantId, invoiceId));

    // Check if chart of accounts is set up (read BEFORE transaction)
    const accounts = await accountService.getAllAccounts(tenantId);
    const hasAccounts = accounts.length > 0;
    let resolvedAccounts: Record<string, { id: string; name: string }> | undefined;

    if (hasAccounts) {
      // Pre-resolve account IDs outside transaction (getDocs not transaction-safe)
      const cashCode = payment.method === 'cash' ? '1110' : '1120';
      const [cashAccount, arAccount] = await Promise.all([
        accountService.getAccountByCode(tenantId, cashCode),
        accountService.getAccountByCode(tenantId, '1210'),
      ]);
      if (cashAccount?.id && arAccount?.id) {
        resolvedAccounts = {
          [cashCode]: { id: cashAccount.id, name: cashAccount.name },
          '1210': { id: arAccount.id, name: arAccount.name },
        };
      }
    }

    // Atomic: payment + invoice update + journal entry in one transaction
    const paymentId = await runTransaction(db, async (transaction) => {
      // Read invoice within transaction
      const invoiceDoc = await transaction.get(invoiceRef);
      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }

      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot record payment for cancelled invoice');
      }
      if (invoice.status === 'paid') {
        throw new Error('Cannot record payment for a fully paid invoice');
      }
      if (payment.amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      if (payment.amount - invoice.balanceDue > PAYMENT_EPSILON) {
        throw new Error('Payment exceeds remaining invoice balance');
      }

      // Calculate new values using Decimal.js for precision
      const newAmountPaid = addMoney(invoice.amountPaid || 0, payment.amount);
      const newBalanceDue = subtractMoney(invoice.total || 0, newAmountPaid);

      if (newBalanceDue < 0) {
        throw new Error('Payment exceeds remaining invoice balance');
      }

      const newStatus: InvoiceStatus =
        newBalanceDue === 0 ? 'paid' : 'partial';

      // Create payment record within transaction
      const paymentDocRef = doc(this.paymentsRef(tenantId));
      transaction.set(paymentDocRef, {
        date: payment.date,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        createdAt: serverTimestamp(),
      });

      // Update invoice within same transaction
      transaction.update(invoiceRef, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === 'paid' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      // Create journal entry within same transaction
      if (resolvedAccounts) {
        await journalEntryService.createFromInvoicePayment(
          tenantId,
          {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            date: payment.date,
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
          },
          userId || 'system',
          transaction,
          resolvedAccounts
        );
      }

      return paymentDocRef.id;
    });

    return paymentId;
  }

  /**
   * Get payments for an invoice
   */
  async getPaymentsForInvoice(tenantId: string, invoiceId: string): Promise<PaymentReceived[]> {
    const q = query(
      this.paymentsRef(tenantId),
      where('invoiceId', '==', invoiceId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(mapPayment);
  }

  /**
   * Get all payments
   */
  async getAllPayments(tenantId: string, maxResults: number = 500): Promise<PaymentReceived[]> {
    const querySnapshot = await getDocs(
      query(this.paymentsRef(tenantId), orderBy('date', 'desc'), limit(maxResults))
    );

    return querySnapshot.docs.map(mapPayment);
  }

  // ----------------------------------------
  // Settings
  // ----------------------------------------

  /**
   * Get invoice settings
   */
  async getSettings(tenantId: string): Promise<InvoiceSettings> {
    const docSnap = await getDoc(this.settingsRef(tenantId));

    if (!docSnap.exists()) {
      // Return defaults
      return {
        prefix: 'INV',
        nextNumber: 1,
        defaultTaxRate: 0,
        defaultTerms: 'Payment due within 30 days',
        defaultNotes: 'Thank you for your business',
        defaultDueDays: 30,
        companyName: '',
        companyAddress: '',
      };
    }

    return docSnap.data() as InvoiceSettings;
  }

  /**
   * Update invoice settings
   */
  async updateSettings(tenantId: string, settings: Partial<InvoiceSettings>): Promise<boolean> {
    const settingsDocRef = this.settingsRef(tenantId);
    const docSnap = await getDoc(settingsDocRef);

    if (!docSnap.exists()) {
      // Create settings document
      await runTransaction(db, async (transaction) => {
        transaction.set(settingsDocRef, {
          prefix: 'INV',
          nextNumber: 1,
          defaultTaxRate: 0,
          defaultTerms: 'Payment due within 30 days',
          defaultNotes: 'Thank you for your business',
          defaultDueDays: 30,
          companyName: '',
          companyAddress: '',
          ...settings,
        });
      });
    } else {
      await updateDoc(settingsDocRef, settings);
    }

    return true;
  }

  // ----------------------------------------
  // Stats (Optimized)
  // ----------------------------------------

  /**
   * Get money stats for dashboard
   * Note: For very large datasets, consider using Firestore aggregation queries
   */
  async getStats(tenantId: string): Promise<MoneyStats> {
    const invoices = await this.getAllInvoices(tenantId);

    const now = new Date();
    const thisMonth = formatDateISO(now).slice(0, 7); // YYYY-MM
    const lastMonth = formatDateISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);

    // Calculate stats
    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const outstandingInvoices = invoices.filter((inv) =>
      ['sent', 'viewed', 'partial'].includes(inv.status)
    );

    const totalRevenue = sumMoney(paidInvoices.map(inv => inv.total));
    const revenueThisMonth = sumMoney(paidInvoices
      .filter((inv) => inv.paidAt && formatDateISO(inv.paidAt).startsWith(thisMonth))
      .map(inv => inv.total));
    const revenuePreviousMonth = sumMoney(paidInvoices
      .filter((inv) => inv.paidAt && formatDateISO(inv.paidAt).startsWith(lastMonth))
      .map(inv => inv.total));

    const totalOutstanding = sumMoney(outstandingInvoices.map(inv => inv.balanceDue));

    const today = getTodayTL();
    const todayDate = parseDateISO(today);
    const overdueInvoices = outstandingInvoices.filter((inv) => inv.dueDate < today);
    const overdueAmount = sumMoney(overdueInvoices.map(inv => inv.balanceDue));

    // Calculate AR Aging
    const aging = { current: 0, days30to60: 0, days60to90: 0, over90: 0 };
    outstandingInvoices.forEach((inv) => {
      const dueDate = parseDateISO(inv.dueDate);
      const daysPastDue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPastDue <= 0) {
        aging.current = addMoney(aging.current, inv.balanceDue);
      } else if (daysPastDue <= 30) {
        aging.current = addMoney(aging.current, inv.balanceDue);
      } else if (daysPastDue <= 60) {
        aging.days30to60 = addMoney(aging.days30to60, inv.balanceDue);
      } else if (daysPastDue <= 90) {
        aging.days60to90 = addMoney(aging.days60to90, inv.balanceDue);
      } else {
        aging.over90 = addMoney(aging.over90, inv.balanceDue);
      }
    });

    // Calculate cash flow for last 6 months
    const cashFlow: MoneyStats['cashFlow'] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = formatDateISO(monthDate).slice(0, 7);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Dili' });

      const received = sumMoney(paidInvoices
        .filter((inv) => inv.paidAt && formatDateISO(inv.paidAt).startsWith(monthKey))
        .map(inv => inv.total));

      cashFlow.push({
        month: monthName,
        received,
        spent: 0, // Will be filled from expense service
      });
    }

    // Top customers by outstanding balance
    const customerBalances = new Map<string, { id: string; name: string; outstanding: number; invoiceCount: number; oldestInvoiceDays: number }>();
    outstandingInvoices.forEach((inv) => {
      const invoiceDate = parseDateISO(inv.issueDate);
      const daysSinceIssue = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

      const existing = customerBalances.get(inv.customerId) || {
        id: inv.customerId,
        name: inv.customerName,
        outstanding: 0,
        invoiceCount: 0,
        oldestInvoiceDays: 0,
      };
      existing.outstanding = addMoney(existing.outstanding, inv.balanceDue);
      existing.invoiceCount += 1;
      existing.oldestInvoiceDays = Math.max(existing.oldestInvoiceDays, daysSinceIssue);
      customerBalances.set(inv.customerId, existing);
    });
    const topCustomers = Array.from(customerBalances.values())
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    // Recent activity (from invoice updates)
    const recentActivity: MoneyStats['recentActivity'] = invoices
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 10)
      .map((inv) => {
        let type: 'invoice_created' | 'invoice_sent' | 'invoice_viewed' | 'payment_received' | 'invoice_overdue' = 'invoice_created';
        let description = `Invoice ${inv.invoiceNumber} created`;

        if (inv.status === 'paid') {
          type = 'payment_received';
          description = `Payment received from ${inv.customerName}`;
        } else if (inv.status === 'viewed') {
          type = 'invoice_viewed';
          description = `${inv.customerName} viewed invoice`;
        } else if (inv.status === 'sent') {
          type = 'invoice_sent';
          description = `Invoice sent to ${inv.customerName}`;
        } else if (inv.dueDate < today && ['sent', 'viewed'].includes(inv.status)) {
          type = 'invoice_overdue';
          description = `Invoice to ${inv.customerName} is overdue`;
        }

        return {
          id: inv.id!,
          type,
          description,
          amount: inv.total,
          timestamp: new Date(inv.updatedAt || inv.createdAt),
          entityId: inv.id,
        };
      });

    return {
      totalRevenue,
      revenueThisMonth,
      revenuePreviousMonth,
      totalOutstanding,
      overdueAmount,
      invoicesDraft: invoices.filter((inv) => inv.status === 'draft').length,
      invoicesSent: invoices.filter((inv) =>
        ['sent', 'viewed'].includes(inv.status)
      ).length,
      invoicesOverdue: overdueInvoices.length,
      totalExpenses: 0, // From expense service
      expensesThisMonth: 0, // From expense service
      profitThisMonth: revenueThisMonth,
      profitPreviousMonth: revenuePreviousMonth,
      aging,
      cashFlow,
      topCustomers,
      recentActivity,
    };
  }

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  private async getNextInvoiceNumber(tenantId: string): Promise<string> {
    const settingsDocRef = this.settingsRef(tenantId);
    const year = parseInt(getTodayTL().slice(0, 4), 10);
    return runTransaction(db, async (transaction) => {
      const settingsDoc = await transaction.get(settingsDocRef);

      let prefix = 'INV';
      let number = 1;

      if (!settingsDoc.exists()) {
        transaction.set(settingsDocRef, {
          prefix: 'INV',
          nextNumber: 2,
          defaultTaxRate: 0,
          defaultTerms: 'Payment due within 30 days',
          defaultNotes: 'Thank you for your business',
          defaultDueDays: 30,
          companyName: '',
          companyAddress: '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        const data = settingsDoc.data() as Partial<InvoiceSettings>;
        prefix = data.prefix || 'INV';
        number = (typeof data.nextNumber === 'number' && data.nextNumber > 0)
          ? Math.floor(data.nextNumber)
          : 1;

        transaction.update(settingsDocRef, {
          nextNumber: number + 1,
          updatedAt: serverTimestamp(),
        });
      }

      return `${prefix}-${year}-${String(number).padStart(3, '0')}`;
    });
  }

  private generateShareToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

  /**
   * Get share URL for an invoice
   */
  getShareUrl(invoice: Invoice): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/money/invoices/${invoice.id}`;
  }

  /**
   * Update overdue status for all invoices
   * Call this periodically (e.g., daily) or on dashboard load
   */
  async updateOverdueStatuses(tenantId: string): Promise<number> {
    const today = getTodayTL();
    const invoices = await this.getAllInvoices(tenantId);

    let updated = 0;
    for (const invoice of invoices) {
      if (
        ['sent', 'viewed', 'partial'].includes(invoice.status) &&
        invoice.dueDate < today
      ) {
        const docRef = doc(db, paths.invoice(tenantId, invoice.id));
        await updateDoc(docRef, {
          status: 'overdue',
          updatedAt: serverTimestamp(),
        });
        updated++;
      }
    }

    return updated;
  }
}

export const invoiceService = new InvoiceService();
