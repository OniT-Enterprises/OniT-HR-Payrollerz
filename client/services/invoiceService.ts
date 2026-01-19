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
    const today = new Date().toISOString().split('T')[0];
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
   */
  async markAsSent(tenantId: string, id: string, userId?: string): Promise<boolean> {
    const invoice = await this.getInvoiceById(tenantId, id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const docRef = doc(db, paths.invoice(tenantId, id));
    await updateDoc(docRef, {
      status: 'sent',
      sentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create accounting journal entry (if chart of accounts is set up)
    try {
      const accounts = await accountService.getAllAccounts(tenantId);
      if (accounts.length > 0) {
        await journalEntryService.createFromInvoice(
          tenantId,
          invoice,
          userId || 'system'
        );
      }
    } catch (error) {
      // Log but don't fail - accounting integration is optional
      console.warn('Could not create journal entry for invoice:', error);
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

    // TODO: Integrate with email service to send actual reminder
    // For now, just track that a reminder was sent

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

    return this.createInvoice(tenantId, newInvoice);
  }

  // ----------------------------------------
  // Payments
  // ----------------------------------------

  /**
   * Record a payment for an invoice
   * Also creates a journal entry (Debit Cash, Credit AR)
   */
  async recordPayment(
    tenantId: string,
    invoiceId: string,
    payment: PaymentFormData,
    userId?: string
  ): Promise<string> {
    const invoice = await this.getInvoiceById(tenantId, invoiceId);
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

    const paymentRef = await addDoc(this.paymentsRef(tenantId), {
      ...paymentRecord,
      createdAt: serverTimestamp(),
    });

    // Update invoice
    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newBalanceDue = invoice.total - newAmountPaid;
    const newStatus: InvoiceStatus =
      newBalanceDue <= 0 ? 'paid' : newBalanceDue < invoice.total ? 'partial' : invoice.status;

    const invoiceRef = doc(db, paths.invoice(tenantId, invoiceId));
    await updateDoc(invoiceRef, {
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      status: newStatus,
      paidAt: newStatus === 'paid' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    // Create accounting journal entry (if chart of accounts is set up)
    try {
      const accounts = await accountService.getAllAccounts(tenantId);
      if (accounts.length > 0) {
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
          userId || 'system'
        );
      }
    } catch (error) {
      // Log but don't fail - accounting integration is optional
      console.warn('Could not create journal entry for payment:', error);
    }

    return paymentRef.id;
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
    const todayDate = new Date(today);
    const overdueInvoices = outstandingInvoices.filter((inv) => inv.dueDate < today);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

    // Calculate AR Aging
    const aging = { current: 0, days30to60: 0, days60to90: 0, over90: 0 };
    outstandingInvoices.forEach((inv) => {
      const dueDate = new Date(inv.dueDate);
      const daysPastDue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPastDue <= 0) {
        aging.current += inv.balanceDue;
      } else if (daysPastDue <= 30) {
        aging.current += inv.balanceDue; // 0-30 days = current
      } else if (daysPastDue <= 60) {
        aging.days30to60 += inv.balanceDue;
      } else if (daysPastDue <= 90) {
        aging.days60to90 += inv.balanceDue;
      } else {
        aging.over90 += inv.balanceDue;
      }
    });

    // Calculate cash flow for last 6 months
    const cashFlow: MoneyStats['cashFlow'] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });

      const received = paidInvoices
        .filter((inv) => inv.paidAt && inv.paidAt.toISOString().startsWith(monthKey))
        .reduce((sum, inv) => sum + inv.total, 0);

      cashFlow.push({
        month: monthName,
        received,
        spent: 0, // Will be filled from expense service
      });
    }

    // Top customers by outstanding balance
    const customerBalances = new Map<string, { id: string; name: string; outstanding: number; invoiceCount: number }>();
    outstandingInvoices.forEach((inv) => {
      const existing = customerBalances.get(inv.customerId) || {
        id: inv.customerId,
        name: inv.customerName,
        outstanding: 0,
        invoiceCount: 0,
      };
      existing.outstanding += inv.balanceDue;
      existing.invoiceCount += 1;
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
    const settings = await this.getSettings(tenantId);
    const number = settings.nextNumber || 1;
    const year = new Date().getFullYear();

    // Increment for next time
    await this.updateSettings(tenantId, { nextNumber: number + 1 });

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
    return `${baseUrl}/money/invoices/${invoice.id}`;
  }

  /**
   * Update overdue status for all invoices
   * Call this periodically (e.g., daily) or on dashboard load
   */
  async updateOverdueStatuses(tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
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
export default invoiceService;
