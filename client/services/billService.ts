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
  writeBatch,
  runTransaction,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addDays, formatDateISO, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import { addMoney, subtractMoney, percentOf, sumMoney } from '@/lib/currency';
import type {
  Bill,
  BillFormData,
  BillStatus,
  BillPayment,
  BillPaymentFormData,
  ExpenseCategory,
} from '@/types/money';
import { vendorService } from './vendorService';
import { journalEntryService, accountService } from './accountingService';
import { EXPENSE_CATEGORY_TO_ACCOUNT } from '@/lib/accounting/chart-of-accounts';
import { firestoreBillSchema } from '@/lib/validations';

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

const PAYMENT_EPSILON = 0.00001;

/**
 * Maps Firestore document to Bill with Zod validation
 */
function mapBill(docSnap: DocumentSnapshot): Bill {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  // Validate with Zod schema
  const validated = firestoreBillSchema.safeParse(data);

  if (!validated.success) {
    console.warn(`Bill validation warning (${docSnap.id}):`, validated.error.flatten().fieldErrors);
  }

  const parsed = validated.success ? validated.data : data;

  return {
    id: docSnap.id,
    ...parsed,
    // Handle additional date field not in base schema
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
    const today = getTodayTL();
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
   * Also creates a journal entry (Debit Expense, Credit AP)
   */
  async createBill(tenantId: string, data: BillFormData, userId?: string): Promise<string> {
    // Get vendor info
    const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Calculate totals
    const taxAmount = percentOf(data.amount, data.taxRate);
    const total = addMoney(data.amount, taxAmount);

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

    // Check if chart of accounts is set up (read before transaction)
    const accounts = await accountService.getAllAccounts(tenantId);
    const hasAccounts = accounts.length > 0;

    if (hasAccounts) {
      // Pre-resolve account IDs BEFORE the transaction (getDocs queries are not transaction-safe)
      const expenseMapping = EXPENSE_CATEGORY_TO_ACCOUNT[data.category] || EXPENSE_CATEGORY_TO_ACCOUNT.other;
      const [expenseAccount, apAccount] = await Promise.all([
        accountService.getAccountByCode(tenantId, expenseMapping.code),
        accountService.getAccountByCode(tenantId, '2110'),
      ]);
      if (!expenseAccount?.id) throw new Error(`Missing account for code ${expenseMapping.code}`);
      if (!apAccount?.id) throw new Error(`Missing account for code 2110`);
      const resolvedAccounts: Record<string, { id: string; name: string }> = {
        [expenseMapping.code]: { id: expenseAccount.id, name: expenseAccount.name },
        '2110': { id: apAccount.id, name: apAccount.name },
      };

      // ATOMIC: Create bill + journal entry in a single transaction.
      const billDocRef = doc(this.collectionRef(tenantId));
      await runTransaction(db, async (transaction) => {
        // Journal entry (only transaction.get for entry number, writes journal + GL)
        await journalEntryService.createFromBill(
          tenantId,
          { ...bill, id: billDocRef.id },
          userId || 'system',
          transaction,
          resolvedAccounts
        );
        // Write bill in same transaction
        transaction.set(billDocRef, {
          ...bill,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      return billDocRef.id;
    }

    // No accounting setup — just create bill
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
      const existingTaxRate = bill.amount > 0 ? (bill.taxAmount / bill.amount) * 100 : 0;
      const taxRate = data.taxRate ?? existingTaxRate;
      const taxAmount = percentOf(amount, taxRate);
      const total = addMoney(amount, taxAmount);

      updates.amount = amount;
      updates.taxAmount = taxAmount;
      updates.total = total;
      updates.balanceDue = subtractMoney(total, bill.amountPaid);

      if (updates.balanceDue < -PAYMENT_EPSILON) {
        throw new Error('Cannot reduce bill total below amount already paid');
      }
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
    const bill = await this.getBillById(tenantId, id);
    if (!bill) {
      throw new Error('Bill not found');
    }
    if (bill.status === 'paid') {
      throw new Error('Cannot cancel a fully paid bill');
    }
    if ((bill.amountPaid || 0) > PAYMENT_EPSILON) {
      throw new Error('Cannot cancel a bill with recorded payments');
    }

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
   * Uses transaction to ensure atomicity of payment + bill update + journal entry
   */
  async recordPayment(
    tenantId: string,
    billId: string,
    payment: BillPaymentFormData,
    userId?: string
  ): Promise<string> {
    const billRef = doc(db, paths.bill(tenantId, billId));

    // Check if chart of accounts is set up (read BEFORE transaction)
    const accounts = await accountService.getAllAccounts(tenantId);
    const hasAccounts = accounts.length > 0;
    let resolvedAccounts: Record<string, { id: string; name: string }> | undefined;

    if (hasAccounts) {
      // Pre-resolve account IDs outside transaction (getDocs not transaction-safe)
      const cashCode = payment.method === 'cash' ? '1110' : '1120';
      const [apAccount, cashAccount] = await Promise.all([
        accountService.getAccountByCode(tenantId, '2110'),
        accountService.getAccountByCode(tenantId, cashCode),
      ]);
      if (apAccount?.id && cashAccount?.id) {
        resolvedAccounts = {
          '2110': { id: apAccount.id, name: apAccount.name },
          [cashCode]: { id: cashAccount.id, name: cashAccount.name },
        };
      }
    }

    // Atomic: payment + bill update + journal entry in one transaction
    const paymentId = await runTransaction(db, async (transaction) => {
      // Read bill within transaction
      const billDoc = await transaction.get(billRef);
      if (!billDoc.exists()) {
        throw new Error('Bill not found');
      }

      const bill = { id: billDoc.id, ...billDoc.data() } as Bill;

      if (bill.status === 'cancelled') {
        throw new Error('Cannot record payment for cancelled bill');
      }
      if (bill.status === 'paid') {
        throw new Error('Cannot record payment for a fully paid bill');
      }
      if (payment.amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      if (payment.amount - bill.balanceDue > PAYMENT_EPSILON) {
        throw new Error('Payment exceeds remaining bill balance');
      }

      // Calculate new values using Decimal.js for precision
      const newAmountPaid = addMoney(bill.amountPaid || 0, payment.amount);
      const newBalanceDue = subtractMoney(bill.total || 0, newAmountPaid);

      if (newBalanceDue < 0) {
        throw new Error('Payment exceeds remaining bill balance');
      }

      const newStatus: BillStatus =
        newBalanceDue === 0 ? 'paid' : 'partial';

      // Create payment record within transaction
      const paymentDocRef = doc(this.paymentsRef(tenantId));
      transaction.set(paymentDocRef, {
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        billId,
        createdAt: serverTimestamp(),
      });

      // Update bill within same transaction
      transaction.update(billRef, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === 'paid' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });

      // Create journal entry within same transaction
      if (resolvedAccounts) {
        await journalEntryService.createFromBillPayment(
          tenantId,
          {
            billId: bill.id,
            billNumber: bill.billNumber,
            vendorName: bill.vendorName,
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
    return sumMoney(bills.map(bill => bill.balanceDue));
  }

  /**
   * Get bills due soon (next 7 days)
   */
  async getBillsDueSoon(tenantId: string): Promise<Bill[]> {
    const todayStr = getTodayTL();
    const nextWeekStr = formatDateISO(addDays(parseDateISO(todayStr), 7));

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
   * Get payables summary for dashboard widget
   */
  async getPayablesSummary(tenantId: string): Promise<{
    overdue: number;
    overdueCount: number;
    dueThisWeek: number;
    dueThisWeekCount: number;
    dueLater: number;
    dueLaterCount: number;
  }> {
    const unpaidBills = await this.getUnpaidBills(tenantId);
    const todayStr = getTodayTL();
    const nextWeekStr = formatDateISO(addDays(parseDateISO(todayStr), 7));

    const result = {
      overdue: 0,
      overdueCount: 0,
      dueThisWeek: 0,
      dueThisWeekCount: 0,
      dueLater: 0,
      dueLaterCount: 0,
    };

    for (const bill of unpaidBills) {
      if (bill.dueDate < todayStr) {
        result.overdue = addMoney(result.overdue, bill.balanceDue);
        result.overdueCount++;
      } else if (bill.dueDate <= nextWeekStr) {
        result.dueThisWeek = addMoney(result.dueThisWeek, bill.balanceDue);
        result.dueThisWeekCount++;
      } else {
        result.dueLater = addMoney(result.dueLater, bill.balanceDue);
        result.dueLaterCount++;
      }
    }

    return result;
  }

  /**
   * Update overdue status for all bills
   */
  async updateOverdueStatuses(tenantId: string): Promise<number> {
    const today = getTodayTL();
    const bills = await this.getAllBills(tenantId);

    const overdue = bills.filter(
      b => ['pending', 'partial'].includes(b.status) && b.dueDate < today
    );

    // Batch all updates (max 500 per batch)
    for (let i = 0; i < overdue.length; i += 499) {
      const batch = writeBatch(db);
      for (const bill of overdue.slice(i, i + 499)) {
        batch.update(doc(db, paths.bill(tenantId, bill.id)), {
          status: 'overdue',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return overdue.length;
  }

}

export const billService = new BillService();
