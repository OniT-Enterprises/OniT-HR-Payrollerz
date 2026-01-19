/**
 * Bill Service
 * Firestore CRUD operations for bills (accounts payable)
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
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import type {
  Bill,
  BillFormData,
  BillStatus,
  BillPayment,
  BillPaymentFormData,
  ExpenseCategory,
} from '@/types/money';
import { vendorService } from './vendorService';

/**
 * Filter options for bill queries
 */
export interface BillFilters {
  // Server-side filters
  status?: BillStatus;
  vendorId?: string;
  category?: ExpenseCategory;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Bill
 */
function mapBill(docSnap: DocumentSnapshot): Bill {
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
    paidAt: data.paidAt instanceof Timestamp
      ? data.paidAt.toDate()
      : data.paidAt || undefined,
  } as Bill;
}

class BillService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.bills(tenantId));
  }

  private paymentsRef(tenantId: string) {
    return collection(db, paths.billPayments(tenantId));
  }

  // ----------------------------------------
  // Bill CRUD
  // ----------------------------------------

  /**
   * Get bills with server-side filtering and pagination
   */
  async getBills(
    tenantId: string,
    filters: BillFilters = {}
  ): Promise<PaginatedResult<Bill>> {
    const {
      status,
      vendorId,
      category,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      minAmount,
      maxAmount,
    } = filters;

    const constraints: QueryConstraint[] = [];

    // Server-side filters
    if (status && status !== 'all' as unknown as BillStatus) {
      constraints.push(where('status', '==', status));
    }
    if (vendorId) {
      constraints.push(where('vendorId', '==', vendorId));
    }
    if (category) {
      constraints.push(where('category', '==', category));
    }

    // Ordering and pagination
    constraints.push(orderBy('billDate', 'desc'));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef(tenantId), ...constraints);
    const querySnapshot = await getDocs(q);

    let bills = querySnapshot.docs.map(mapBill);
    const hasMore = bills.length > pageSize;

    if (hasMore) {
      bills = bills.slice(0, pageSize);
    }

    const lastDoc = bills.length > 0
      ? querySnapshot.docs[bills.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      bills = bills.filter(
        (bill) =>
          bill.billNumber?.toLowerCase().includes(term) ||
          bill.vendorName?.toLowerCase().includes(term) ||
          bill.description?.toLowerCase().includes(term)
      );
    }

    if (minAmount !== undefined) {
      bills = bills.filter((bill) => bill.total >= minAmount);
    }

    if (maxAmount !== undefined) {
      bills = bills.filter((bill) => bill.total <= maxAmount);
    }

    return {
      data: bills,
      lastDoc,
      hasMore,
      totalFetched: bills.length,
    };
  }

  /**
   * Get all bills
   * @deprecated Use getBills() with filters for better performance
   */
  async getAllBills(tenantId: string, maxResults: number = 500): Promise<Bill[]> {
    const result = await this.getBills(tenantId, { pageSize: maxResults });
    return result.data;
  }

  /**
   * Get bills by status (server-side filtered)
   */
  async getBillsByStatus(tenantId: string, status: BillStatus): Promise<Bill[]> {
    const result = await this.getBills(tenantId, { status, pageSize: 500 });
    return result.data;
  }

  /**
   * Get bills by vendor (server-side filtered)
   */
  async getBillsByVendor(tenantId: string, vendorId: string): Promise<Bill[]> {
    const result = await this.getBills(tenantId, { vendorId, pageSize: 500 });
    return result.data;
  }

  /**
   * Get overdue bills
   */
  async getOverdueBills(tenantId: string): Promise<Bill[]> {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      this.collectionRef(tenantId),
      where('status', 'in', ['pending', 'partial']),
      where('dueDate', '<', today)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => mapBill(doc));
  }

  /**
   * Get unpaid bills (pending + partial)
   */
  async getUnpaidBills(tenantId: string): Promise<Bill[]> {
    const q = query(
      this.collectionRef(tenantId),
      where('status', 'in', ['pending', 'partial', 'overdue']),
      orderBy('dueDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => mapBill(doc));
  }

  /**
   * Get a single bill by ID
   */
  async getBillById(tenantId: string, id: string): Promise<Bill | null> {
    const docRef = doc(db, paths.bill(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapBill(docSnap);
  }

  /**
   * Create a new bill
   */
  async createBill(tenantId: string, data: BillFormData): Promise<string> {
    // Get vendor info
    const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Calculate totals
    const taxAmount = data.amount * (data.taxRate / 100);
    const total = data.amount + taxAmount;

    const bill: Omit<Bill, 'id'> = {
      billNumber: data.billNumber,
      vendorId: data.vendorId,
      vendorName: vendor.name,
      billDate: data.billDate,
      dueDate: data.dueDate,
      description: data.description,
      amount: data.amount,
      taxAmount,
      total,
      status: 'pending',
      amountPaid: 0,
      balanceDue: total,
      category: data.category,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...bill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing bill (only if pending)
   */
  async updateBill(tenantId: string, id: string, data: Partial<BillFormData>): Promise<boolean> {
    const bill = await this.getBillById(tenantId, id);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== 'pending') {
      throw new Error('Cannot edit bill that has payments');
    }

    const updates: Partial<Bill> = {};

    // Copy simple fields
    if (data.billNumber !== undefined) updates.billNumber = data.billNumber;
    if (data.billDate) updates.billDate = data.billDate;
    if (data.dueDate) updates.dueDate = data.dueDate;
    if (data.description) updates.description = data.description;
    if (data.category) updates.category = data.category;
    if (data.notes !== undefined) updates.notes = data.notes;

    // Recalculate totals if amount or tax changed
    if (data.amount !== undefined || data.taxRate !== undefined) {
      const amount = data.amount ?? bill.amount;
      const taxRate = data.taxRate ?? 0;
      const taxAmount = amount * (taxRate / 100);
      const total = amount + taxAmount;

      updates.amount = amount;
      updates.taxAmount = taxAmount;
      updates.total = total;
      updates.balanceDue = total - bill.amountPaid;
    }

    // Update vendor if changed
    if (data.vendorId && data.vendorId !== bill.vendorId) {
      const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
      if (vendor) {
        updates.vendorId = data.vendorId;
        updates.vendorName = vendor.name;
      }
    }

    const docRef = doc(db, paths.bill(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Cancel a bill
   */
  async cancelBill(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.bill(tenantId, id));
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete a pending bill
   */
  async deleteBill(tenantId: string, id: string): Promise<boolean> {
    const bill = await this.getBillById(tenantId, id);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== 'pending') {
      throw new Error('Cannot delete bill that has payments. Cancel it instead.');
    }

    const docRef = doc(db, paths.bill(tenantId, id));
    await deleteDoc(docRef);
    return true;
  }

  // ----------------------------------------
  // Payments
  // ----------------------------------------

  /**
   * Record a payment for a bill
   */
  async recordPayment(
    tenantId: string,
    billId: string,
    payment: BillPaymentFormData
  ): Promise<string> {
    const bill = await this.getBillById(tenantId, billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === 'cancelled') {
      throw new Error('Cannot record payment for cancelled bill');
    }

    // Create payment record
    const paymentRecord: Omit<BillPayment, 'id'> = {
      date: payment.date,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: new Date(),
    };

    const paymentRef = await addDoc(this.paymentsRef(tenantId), {
      ...paymentRecord,
      billId,
      createdAt: serverTimestamp(),
    });

    // Update bill
    const newAmountPaid = bill.amountPaid + payment.amount;
    const newBalanceDue = bill.total - newAmountPaid;
    const newStatus: BillStatus =
      newBalanceDue <= 0 ? 'paid' : newBalanceDue < bill.total ? 'partial' : bill.status;

    const billRef = doc(db, paths.bill(tenantId, billId));
    await updateDoc(billRef, {
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      status: newStatus,
      paidAt: newStatus === 'paid' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    return paymentRef.id;
  }

  /**
   * Get payments for a bill
   */
  async getPaymentsForBill(tenantId: string, billId: string): Promise<BillPayment[]> {
    const q = query(
      this.paymentsRef(tenantId),
      where('billId', '==', billId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as BillPayment;
    });
  }

  /**
   * Get all bill payments
   */
  async getAllPayments(
    tenantId: string,
    maxResults: number = 500
  ): Promise<(BillPayment & { billId: string })[]> {
    const querySnapshot = await getDocs(
      query(this.paymentsRef(tenantId), orderBy('date', 'desc'), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        billId: data.billId,
        date: data.date,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
  }

  // ----------------------------------------
  // Stats
  // ----------------------------------------

  /**
   * Get total payables
   */
  async getTotalPayables(tenantId: string): Promise<number> {
    const bills = await this.getUnpaidBills(tenantId);
    return bills.reduce((sum, bill) => sum + bill.balanceDue, 0);
  }

  /**
   * Get bills due soon (next 7 days)
   */
  async getBillsDueSoon(tenantId: string): Promise<Bill[]> {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const q = query(
      this.collectionRef(tenantId),
      where('status', 'in', ['pending', 'partial']),
      where('dueDate', '>=', todayStr),
      where('dueDate', '<=', nextWeekStr),
      orderBy('dueDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => mapBill(doc));
  }

  /**
   * Update overdue status for all bills
   */
  async updateOverdueStatuses(tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const bills = await this.getAllBills(tenantId);

    let updated = 0;
    for (const bill of bills) {
      if (
        ['pending', 'partial'].includes(bill.status) &&
        bill.dueDate < today
      ) {
        const docRef = doc(db, paths.bill(tenantId, bill.id));
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

export const billService = new BillService();
export default billService;
