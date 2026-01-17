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

// ============================================
// MAPPER FUNCTION
// ============================================

function mapInvoice(docSnap: DocumentSnapshot): Invoice {
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

// ============================================
// INVOICE SERVICE
// ============================================

class InvoiceService {
  private get collectionRef() {
    return collection(db, 'invoices');
  }

  private get paymentsRef() {
    return collection(db, 'payments_received');
  }

  private get settingsRef() {
    return doc(db, 'settings', 'invoice_settings');
  }

  // ----------------------------------------
  // Invoice CRUD with Server-Side Filtering
  // ----------------------------------------

  /**
   * Get invoices with server-side filtering and pagination
   */
  async getInvoices(filters: InvoiceFilters = {}): Promise<PaginatedResult<Invoice>> {
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

    const q = query(this.collectionRef, ...constraints);
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
  async getAllInvoices(maxResults: number = 500): Promise<Invoice[]> {
    const result = await this.getInvoices({ pageSize: maxResults });
    return result.data;
  }

  /**
   * Get invoices by status (server-side filtered)
   */
  async getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    const result = await this.getInvoices({ status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get invoices for a customer (server-side filtered)
   */
  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    const result = await this.getInvoices({ customerId, pageSize: 500 });
    return result.data;
  }

  /**
   * Get overdue invoices (server-side filtered)
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.getInvoices({
      status: ['sent', 'viewed', 'partial'],
      dueBefore: today,
      pageSize: 500,
    });
    return result.data;
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoiceById(id: string): Promise<Invoice | null> {
    const docRef = doc(db, 'invoices', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapInvoice(docSnap);
  }

  /**
   * Get invoice by share token (for public viewing)
   */
  async getInvoiceByShareToken(token: string): Promise<Invoice | null> {
    const q = query(
      this.collectionRef,
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
  async createInvoice(data: InvoiceFormData): Promise<string> {
    // Get customer info
    const customer = await customerService.getCustomerById(data.customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get next invoice number
    const invoiceNumber = await this.getNextInvoiceNumber();

    // Calculate totals
    const items: InvoiceItem[] = data.items.map((item, index) => ({
      id: `item_${Date.now()}_${index}`,
      ...item,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * (data.taxRate / 100);
    const total = subtotal + taxAmount;

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

    const docRef = await addDoc(this.collectionRef, {
      ...invoice,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing invoice (only if draft)
   */
  async updateInvoice(id: string, data: Partial<InvoiceFormData>): Promise<boolean> {
    const invoice = await this.getInvoiceById(id);
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
        amount: item.quantity * item.unitPrice,
      }));

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const taxRate = data.taxRate ?? invoice.taxRate;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      updates.items = items;
      updates.subtotal = subtotal;
      updates.taxRate = taxRate;
      updates.taxAmount = taxAmount;
      updates.total = total;
      updates.balanceDue = total - invoice.amountPaid;
    }

    // If customer changed, update customer info
    if (data.customerId && data.customerId !== invoice.customerId) {
      const customer = await customerService.getCustomerById(data.customerId);
      if (customer) {
        updates.customerName = customer.name;
        updates.customerEmail = customer.email;
        updates.customerPhone = customer.phone;
        updates.customerAddress = customer.address;
      }
    }

    const docRef = doc(db, 'invoices', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(id: string): Promise<boolean> {
    const docRef = doc(db, 'invoices', id);
    await updateDoc(docRef, {
      status: 'sent',
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Mark invoice as viewed (when customer opens share link)
   */
  async markAsViewed(id: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(id);
    if (!invoice || invoice.status === 'draft' || invoice.viewedAt) {
      return false;
    }

    const docRef = doc(db, 'invoices', id);
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
  async cancelInvoice(id: string): Promise<boolean> {
    const docRef = doc(db, 'invoices', id);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete a draft invoice
   */
  async deleteInvoice(id: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error('Cannot delete invoice that has been sent. Cancel it instead.');
    }

    const docRef = doc(db, 'invoices', id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Duplicate an invoice
   */
  async duplicateInvoice(id: string): Promise<string> {
    const invoice = await this.getInvoiceById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const newInvoice: InvoiceFormData = {
      customerId: invoice.customerId,
      issueDate: today,
      dueDate: dueDate.toISOString().split('T')[0],
      items: invoice.items.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      })),
      taxRate: invoice.taxRate,
      notes: invoice.notes,
      terms: invoice.terms,
    };

    return this.createInvoice(newInvoice);
  }

  // ----------------------------------------
  // Payments
  // ----------------------------------------

  /**
   * Record a payment for an invoice
   */
  async recordPayment(invoiceId: string, payment: PaymentFormData): Promise<string> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot record payment for cancelled invoice');
    }

    // Create payment record
    const paymentRecord: Omit<PaymentReceived, 'id'> = {
      date: payment.date,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: new Date(),
    };

    const paymentRef = await addDoc(this.paymentsRef, {
      ...paymentRecord,
      createdAt: serverTimestamp(),
    });

    // Update invoice
    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newBalanceDue = invoice.total - newAmountPaid;
    const newStatus: InvoiceStatus =
      newBalanceDue <= 0 ? 'paid' : newBalanceDue < invoice.total ? 'partial' : invoice.status;

    const invoiceRef = doc(db, 'invoices', invoiceId);
    await updateDoc(invoiceRef, {
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      status: newStatus,
      paidAt: newStatus === 'paid' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    return paymentRef.id;
  }

  /**
   * Get payments for an invoice
   */
  async getPaymentsForInvoice(invoiceId: string): Promise<PaymentReceived[]> {
    const q = query(
      this.paymentsRef,
      where('invoiceId', '==', invoiceId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(mapPayment);
  }

  /**
   * Get all payments
   */
  async getAllPayments(maxResults: number = 500): Promise<PaymentReceived[]> {
    const querySnapshot = await getDocs(
      query(this.paymentsRef, orderBy('date', 'desc'), limit(maxResults))
    );

    return querySnapshot.docs.map(mapPayment);
  }

  // ----------------------------------------
  // Settings
  // ----------------------------------------

  /**
   * Get invoice settings
   */
  async getSettings(): Promise<InvoiceSettings> {
    const docSnap = await getDoc(this.settingsRef);

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
  async updateSettings(settings: Partial<InvoiceSettings>): Promise<boolean> {
    const docSnap = await getDoc(this.settingsRef);

    if (!docSnap.exists()) {
      // Create settings document
      await runTransaction(db, async (transaction) => {
        transaction.set(this.settingsRef, {
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
      await updateDoc(this.settingsRef, settings);
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
  async getStats(): Promise<MoneyStats> {
    const invoices = await this.getAllInvoices();

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);

    // Calculate stats
    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const outstandingInvoices = invoices.filter((inv) =>
      ['sent', 'viewed', 'partial'].includes(inv.status)
    );

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const revenueThisMonth = paidInvoices
      .filter((inv) => inv.paidAt && inv.paidAt.toISOString().startsWith(thisMonth))
      .reduce((sum, inv) => sum + inv.total, 0);
    const revenuePreviousMonth = paidInvoices
      .filter((inv) => inv.paidAt && inv.paidAt.toISOString().startsWith(lastMonth))
      .reduce((sum, inv) => sum + inv.total, 0);

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.balanceDue,
      0
    );

    const today = now.toISOString().split('T')[0];
    const overdueInvoices = outstandingInvoices.filter((inv) => inv.dueDate < today);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

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
    };
  }

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  private async getNextInvoiceNumber(): Promise<string> {
    const settings = await this.getSettings();
    const number = settings.nextNumber || 1;
    const year = new Date().getFullYear();

    // Increment for next time
    await this.updateSettings({ nextNumber: number + 1 });

    // Format: INV-2026-001
    return `${settings.prefix || 'INV'}-${year}-${String(number).padStart(3, '0')}`;
  }

  private generateShareToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Get share URL for an invoice
   */
  getShareUrl(invoice: Invoice): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invoice/${invoice.shareToken}`;
  }

  /**
   * Update overdue status for all invoices
   * Call this periodically (e.g., daily) or on dashboard load
   */
  async updateOverdueStatuses(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const invoices = await this.getAllInvoices();

    let updated = 0;
    for (const invoice of invoices) {
      if (
        ['sent', 'viewed', 'partial'].includes(invoice.status) &&
        invoice.dueDate < today
      ) {
        const docRef = doc(db, 'invoices', invoice.id);
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
export default invoiceService;
