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
  setDoc,
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
  documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addDays, formatDateISO, getTodayTL, parseDateISO } from '@/lib/dateUtils';
import { addMoney, maxMoney, subtractMoney, sumMoney } from '@/lib/currency';
import {
  calculateBillPaymentState,
  calculateTaxedTotal,
  getFiscalDateParts,
} from '@/lib/accounting/calculations';
import type {
  Bill,
  BillFormData,
  BillStatus,
  BillPayment,
  BillPaymentFormData,
  ExpenseCategory,
} from '@/types/money';
import type { JournalEntry } from '@/types/accounting';
import { vendorService } from './vendorService';
import { journalEntryService, accountService, fiscalPeriodService } from './accountingService';
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
  dateFrom?: string;
  dateTo?: string;

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
const UNPAID_BILL_STATUSES: BillStatus[] = ['pending', 'partial', 'overdue'];

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
    cancelledAt: data.cancelledAt instanceof Timestamp
      ? data.cancelledAt.toDate()
      : data.cancelledAt || undefined,
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
      dateFrom,
      dateTo,
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
    if (dateFrom) {
      constraints.push(where('billDate', '>=', dateFrom));
    }
    if (dateTo) {
      constraints.push(where('billDate', '<=', dateTo));
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
   * Get all bills (fetches every page via getBills pagination loop)
   */
  async getAllBills(tenantId: string): Promise<Bill[]> {
    const MAX_PAGES = 100;
    const all: Bill[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getAllBills: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getBills(tenantId, { pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  async getBillsByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
    extraFilters: Omit<BillFilters, 'pageSize' | 'startAfterDoc' | 'dateFrom' | 'dateTo'> = {}
  ): Promise<Bill[]> {
    const MAX_PAGES = 100;
    const all: Bill[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getBillsByDateRange: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getBills(tenantId, {
        ...extraFilters,
        dateFrom: startDate,
        dateTo: endDate,
        pageSize: 500,
        startAfterDoc: lastDoc,
      });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }

    return all;
  }

  async getOutstandingPayablesTotalAsOf(tenantId: string, asOfDate: string): Promise<number> {
    const [billSnapshot, paymentSnapshot] = await Promise.all([
      getDocs(query(this.collectionRef(tenantId), where('billDate', '<=', asOfDate))),
      getDocs(query(this.paymentsRef(tenantId), where('date', '<=', asOfDate))),
    ]);

    const paidByBill = new Map<string, number>();
    for (const paymentDoc of paymentSnapshot.docs) {
      const data = paymentDoc.data();
      if (typeof data.billId !== 'string') continue;
      paidByBill.set(
        data.billId,
        addMoney(paidByBill.get(data.billId) || 0, Number(data.amount) || 0),
      );
    }

    const cutoff = new Date(`${asOfDate}T23:59:59.999+09:00`).getTime();
    let total = 0;
    for (const billDoc of billSnapshot.docs) {
      const data = billDoc.data();
      const cancelledAt = data.cancelledAt instanceof Timestamp ? data.cancelledAt.toMillis() : null;
      if (data.status === 'cancelled' && (cancelledAt === null || cancelledAt <= cutoff)) continue;

      const historicalBalance = maxMoney(
        0,
        subtractMoney(
          Number(data.total) || 0,
          paidByBill.get(billDoc.id) || 0,
        ),
      );
      total = addMoney(total, historicalBalance);
    }
    return total;
  }

  async getPaidBillAmountByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const snapshot = await getDocs(query(
      this.paymentsRef(tenantId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    ));
    return snapshot.docs.reduce(
      (total, paymentDoc) => addMoney(total, Number(paymentDoc.data().amount) || 0),
      0,
    );
  }

  async getPaidBillAmountAsOf(tenantId: string, asOfDate: string): Promise<number> {
    const snapshot = await getDocs(query(
      this.paymentsRef(tenantId),
      where('date', '<=', asOfDate),
    ));
    return snapshot.docs.reduce(
      (total, paymentDoc) => addMoney(total, Number(paymentDoc.data().amount) || 0),
      0,
    );
  }

  async getVATSummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{ inputVAT: number; expenseCount: number }> {
    const bills = await this.getBillsByDateRange(tenantId, startDate, endDate);

    let inputVAT = 0;
    let expenseCount = 0;

    for (const bill of bills) {
      if (bill.status === 'cancelled') continue;
      const vatAmount = Number(bill.vatAmount ?? bill.taxAmount) || 0;
      if (vatAmount > 0 && bill.hasValidVATInvoice !== false) {
        inputVAT = addMoney(inputVAT, vatAmount);
        expenseCount += 1;
      }
    }

    return { inputVAT, expenseCount };
  }

  /** Accrual-basis net bill expenses, grouped for the P&L. */
  async getExpenseSummaryByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ totalExpenses: number; expensesByCategory: Record<string, number> }> {
    const bills = await this.getBillsByDateRange(tenantId, startDate, endDate);
    const expensesByCategory: Record<string, number> = {};

    for (const bill of bills) {
      if (bill.status === 'cancelled') continue;
      const netExpense = bill.netAmount ?? bill.amount;
      expensesByCategory[bill.category] = addMoney(
        expensesByCategory[bill.category] || 0,
        netExpense,
      );
    }

    return {
      totalExpenses: sumMoney(Object.values(expensesByCategory)),
      expensesByCategory,
    };
  }

  /**
   * Get bills by status (server-side filtered, paginated)
   */
  async getBillsByStatus(tenantId: string, status: BillStatus): Promise<Bill[]> {
    const MAX_PAGES = 100;
    const all: Bill[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getBillsByStatus: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getBills(tenantId, { status, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get bills by vendor (server-side filtered, paginated)
   */
  async getBillsByVendor(tenantId: string, vendorId: string): Promise<Bill[]> {
    const MAX_PAGES = 100;
    const all: Bill[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getBillsByVendor: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getBills(tenantId, { vendorId, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
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
  async createBill(
    tenantId: string,
    data: BillFormData,
    userId?: string,
    /** Pre-generated Firestore document ID (used when attachments were uploaded before save) */
    preGeneratedId?: string
  ): Promise<string> {
    // Get vendor info
    const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Calculate totals
    const { netAmount, taxAmount, total } = calculateTaxedTotal(data.amount, data.taxRate);

    const bill: Omit<Bill, 'id'> = {
      billNumber: data.billNumber,
      vendorId: data.vendorId,
      vendorName: vendor.name,
      billDate: data.billDate,
      dueDate: data.dueDate,
      description: data.description,
      amount: netAmount,
      taxAmount,
      total,
      vatRate: data.taxRate,
      vatAmount: taxAmount,
      netAmount,
      status: 'pending',
      amountPaid: 0,
      balanceDue: total,
      category: data.category,
      notes: data.notes,
      attachmentUrls: data.attachmentUrls ?? [],
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
      const billDocRef = preGeneratedId
        ? doc(this.collectionRef(tenantId), preGeneratedId)
        : doc(this.collectionRef(tenantId));
      await runTransaction(db, async (transaction) => {
        // Journal entry (only transaction.get for entry number, writes journal + GL)
        const journalEntryId = await journalEntryService.createFromBill(
          tenantId,
          { ...bill, id: billDocRef.id },
          userId || 'system',
          transaction,
          resolvedAccounts
        );
        // Write bill in same transaction
        transaction.set(billDocRef, {
          ...bill,
          journalEntryId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      return billDocRef.id;
    }

    // No accounting setup — just create bill
    if (preGeneratedId) {
      const docRef = doc(this.collectionRef(tenantId), preGeneratedId);
      await setDoc(docRef, {
        ...bill,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return preGeneratedId;
    }
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
    if (data.attachmentUrls !== undefined) updates.attachmentUrls = data.attachmentUrls;

    // Recalculate totals if amount or tax changed
    if (data.amount !== undefined || data.taxRate !== undefined) {
      const amount = data.amount ?? bill.amount;
      const existingTaxRate = bill.amount > 0 ? (bill.taxAmount / bill.amount) * 100 : 0;
      const taxRate = data.taxRate ?? existingTaxRate;
      const calculated = calculateTaxedTotal(amount, taxRate);

      updates.amount = calculated.netAmount;
      updates.taxAmount = calculated.taxAmount;
      updates.total = calculated.total;
      updates.vatRate = taxRate;
      updates.vatAmount = calculated.taxAmount;
      updates.netAmount = calculated.netAmount;
      updates.balanceDue = subtractMoney(calculated.total, bill.amountPaid);

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

    const updatedBill: Bill = { ...bill, ...updates };
    const journalEntry = bill.journalEntryId
      ? await journalEntryService.getJournalEntry(tenantId, bill.journalEntryId)
      : await journalEntryService.getJournalEntryBySource(tenantId, 'bill', id);

    if (journalEntry?.status === 'posted') {
      const period = await fiscalPeriodService.getPeriodByYearAndPeriod(
        tenantId,
        journalEntry.fiscalYear,
        journalEntry.fiscalPeriod,
      );
      if (period && period.status !== 'open') {
        throw new Error(
          `Cannot edit bill ${bill.billNumber || id}: its journal is in a ${period.status} fiscal period. `
          + 'Reopen the period or cancel the bill with a current-period adjustment.',
        );
      }
    }

    const accounts = await accountService.getAllAccounts(tenantId);
    const shouldPostJournal = accounts.length > 0;
    let resolvedAccounts: Record<string, { id: string; name: string }> | undefined;

    if (shouldPostJournal) {
      const expenseMapping = EXPENSE_CATEGORY_TO_ACCOUNT[updatedBill.category]
        || EXPENSE_CATEGORY_TO_ACCOUNT.other;
      const [expenseAccount, apAccount] = await Promise.all([
        accountService.getAccountByCode(tenantId, expenseMapping.code),
        accountService.getAccountByCode(tenantId, '2110'),
      ]);
      if (!expenseAccount?.id) throw new Error(`Missing account for code ${expenseMapping.code}`);
      if (!apAccount?.id) throw new Error('Missing account for code 2110');
      resolvedAccounts = {
        [expenseMapping.code]: { id: expenseAccount.id, name: expenseAccount.name },
        '2110': { id: apAccount.id, name: apAccount.name },
      };
    }

    const billRef = doc(db, paths.bill(tenantId, id));
    await runTransaction(db, async (transaction) => {
      const currentBillDoc = await transaction.get(billRef);
      if (!currentBillDoc.exists()) throw new Error('Bill not found');
      const currentBill = { id: currentBillDoc.id, ...currentBillDoc.data() } as Bill;
      if (currentBill.status !== 'pending') {
        throw new Error('Cannot edit bill that has payments or is cancelled');
      }

      let activeJournal: JournalEntry | null = journalEntry;
      if (currentBill.journalEntryId) {
        const currentJournalDoc = await transaction.get(
          doc(db, paths.journalEntry(tenantId, currentBill.journalEntryId)),
        );
        activeJournal = currentJournalDoc.exists()
          ? { id: currentJournalDoc.id, ...currentJournalDoc.data() } as JournalEntry
          : null;
      }

      const replacementBill: Bill = { ...currentBill, ...updates };
      // Allocate/post the replacement before queuing reversal writes so the
      // transaction performs its counter read before all writes.
      let replacementJournalId: string | undefined;
      if (shouldPostJournal) {
        replacementJournalId = await journalEntryService.createFromBill(
          tenantId,
          replacementBill,
          'system',
          transaction,
          resolvedAccounts,
        );
      }
      if (activeJournal?.id && activeJournal.status === 'posted') {
        journalEntryService.voidJournalEntryInTransaction(
          tenantId,
          activeJournal.id,
          activeJournal,
          transaction,
          'system',
          `Bill ${bill.billNumber || id} edited`,
        );
      }
      transaction.update(billRef, {
        ...updates,
        ...(replacementJournalId ? { journalEntryId: replacementJournalId } : {}),
        updatedAt: serverTimestamp(),
      });
    });

    return true;
  }

  /**
   * Cancel a bill
   * Also voids the associated journal entry and creates reversing GL entries
   */
  async cancelBill(tenantId: string, id: string, userId?: string): Promise<boolean> {
    const bill = await this.getBillById(tenantId, id);
    if (!bill) {
      throw new Error('Bill not found');
    }
    if (bill.status === 'cancelled') {
      throw new Error('Bill is already cancelled');
    }
    if (bill.status === 'paid') {
      throw new Error('Cannot cancel a fully paid bill');
    }
    if ((bill.amountPaid || 0) > PAYMENT_EPSILON) {
      throw new Error('Cannot cancel a bill with recorded payments');
    }

    // Look up the associated journal entry BEFORE the transaction (query not transaction-safe)
    const journalEntry = bill.journalEntryId
      ? await journalEntryService.getJournalEntry(tenantId, bill.journalEntryId)
      : await journalEntryService.getJournalEntryBySource(tenantId, 'bill', id);

    // Post-close correction flow:
    // - If the original journal entry is in a closed/locked period, do NOT void it.
    // - Instead, create a reversing adjustment entry in the current open period.
    const journalPeriod = journalEntry?.status === 'posted'
      ? await fiscalPeriodService.getPeriodByYearAndPeriod(tenantId, journalEntry.fiscalYear, journalEntry.fiscalPeriod)
      : null;

    const needsAdjustment = !!journalPeriod && journalPeriod.status !== 'open';
    const adjustmentDate = needsAdjustment ? getTodayTL() : null;

    if (needsAdjustment && adjustmentDate) {
      const { year: adjYear, period: adjMonth } = getFiscalDateParts(adjustmentDate);
      const adjPeriod = await fiscalPeriodService.getPeriodByYearAndPeriod(tenantId, adjYear, adjMonth);
      if (adjPeriod && adjPeriod.status !== 'open') {
        throw new Error(
          `Cannot cancel bill: adjustment period ${adjYear}-${String(adjMonth).padStart(2, '0')} is ${adjPeriod.status}. ` +
          'Reopen the period (or choose an open adjustment date) to post the reversal entry.'
        );
      }
    }

    const billDocRef = doc(db, paths.bill(tenantId, id));

    await runTransaction(db, async (transaction) => {
      const currentBillDoc = await transaction.get(billDocRef);
      if (!currentBillDoc.exists()) throw new Error('Bill not found');
      const currentBill = { id: currentBillDoc.id, ...currentBillDoc.data() } as Bill;
      if (currentBill.status === 'cancelled') {
        throw new Error('Bill is already cancelled');
      }
      if (currentBill.status === 'paid' || (currentBill.amountPaid || 0) > PAYMENT_EPSILON) {
        throw new Error('Cannot cancel a bill with recorded payments');
      }

      let activeJournal: JournalEntry | null = journalEntry;
      if (currentBill.journalEntryId) {
        const currentJournalDoc = await transaction.get(
          doc(db, paths.journalEntry(tenantId, currentBill.journalEntryId)),
        );
        activeJournal = currentJournalDoc.exists()
          ? { id: currentJournalDoc.id, ...currentJournalDoc.data() } as JournalEntry
          : null;
      }

      let adjustmentEntryId: string | undefined;
      if (activeJournal?.id && needsAdjustment && adjustmentDate) {
        adjustmentEntryId = await journalEntryService.createReversingJournalEntry(
          tenantId,
          activeJournal,
          {
            date: adjustmentDate,
            createdBy: userId || 'system',
            reason: `Bill ${bill.billNumber || id} cancelled`,
            txn: transaction,
          }
        );
      }

      transaction.update(billDocRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(adjustmentEntryId ? { cancellationAdjustmentEntryId: adjustmentEntryId } : {}),
      });

      if (activeJournal?.id) {
        if (!needsAdjustment) {
          journalEntryService.voidJournalEntryInTransaction(
            tenantId,
            activeJournal.id,
            activeJournal,
            transaction,
            userId || 'system',
            `Bill ${bill.billNumber || id} cancelled`
          );
        }
      }
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

    const journalEntry = bill.journalEntryId
      ? await journalEntryService.getJournalEntry(tenantId, bill.journalEntryId)
      : await journalEntryService.getJournalEntryBySource(tenantId, 'bill', id);
    if (journalEntry?.status === 'posted') {
      const period = await fiscalPeriodService.getPeriodByYearAndPeriod(
        tenantId,
        journalEntry.fiscalYear,
        journalEntry.fiscalPeriod,
      );
      if (period && period.status !== 'open') {
        throw new Error(
          `Cannot delete bill ${bill.billNumber || id}: its journal is in a ${period.status} fiscal period. `
          + 'Cancel it so Xefe can post a current-period adjustment instead.',
        );
      }
    }

    const billRef = doc(db, paths.bill(tenantId, id));
    await runTransaction(db, async (transaction) => {
      const currentBillDoc = await transaction.get(billRef);
      if (!currentBillDoc.exists()) throw new Error('Bill not found');
      const currentBill = { id: currentBillDoc.id, ...currentBillDoc.data() } as Bill;
      if (currentBill.status !== 'pending') {
        throw new Error('Cannot delete bill that has payments or is cancelled');
      }

      let activeJournal: JournalEntry | null = journalEntry;
      if (currentBill.journalEntryId) {
        const currentJournalDoc = await transaction.get(
          doc(db, paths.journalEntry(tenantId, currentBill.journalEntryId)),
        );
        activeJournal = currentJournalDoc.exists()
          ? { id: currentJournalDoc.id, ...currentJournalDoc.data() } as JournalEntry
          : null;
      }

      if (activeJournal?.id && activeJournal.status === 'posted') {
        journalEntryService.voidJournalEntryInTransaction(
          tenantId,
          activeJournal.id,
          activeJournal,
          transaction,
          'system',
          `Bill ${bill.billNumber || id} deleted`,
        );
      }
      transaction.delete(billRef);
    });
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
      if (payment.date < bill.billDate) {
        throw new Error('Payment date cannot be before the bill date');
      }
      const nextPayment = calculateBillPaymentState(
        bill.total || 0,
        bill.amountPaid || 0,
        payment.amount,
      );

      // Create payment record within transaction
      const paymentDocRef = doc(this.paymentsRef(tenantId));
      transaction.set(paymentDocRef, {
        date: payment.date,
        amount: nextPayment.amount,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        billId,
        createdAt: serverTimestamp(),
      });

      // Update bill within same transaction
      transaction.update(billRef, {
        amountPaid: nextPayment.amountPaid,
        balanceDue: nextPayment.balanceDue,
        status: nextPayment.status,
        paidAt: nextPayment.status === 'paid' ? serverTimestamp() : null,
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
            amount: nextPayment.amount,
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

  async getPaymentCandidates(
    tenantId: string,
    startDate: string,
    endDate: string,
    maxResults: number = 50,
  ): Promise<Array<BillPayment & {
    billId: string;
    billNumber?: string;
    billDescription?: string;
    vendorName?: string;
  }>> {
    const paymentsQuery = query(
      this.paymentsRef(tenantId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
      limit(maxResults),
    );
    const querySnapshot = await getDocs(paymentsQuery);

    const payments = querySnapshot.docs.map((doc) => {
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
      } as BillPayment & { billId: string };
    });

    const uniqueBillIds = Array.from(new Set(payments.map((payment) => payment.billId).filter(Boolean)));
    const billsById = new Map<string, Bill>();

    for (let index = 0; index < uniqueBillIds.length; index += 10) {
      const chunk = uniqueBillIds.slice(index, index + 10);
      const billsQuery = query(
        this.collectionRef(tenantId),
        where(documentId(), 'in', chunk),
      );
      const billSnapshot = await getDocs(billsQuery);
      billSnapshot.docs.forEach((billDoc) => {
        billsById.set(billDoc.id, mapBill(billDoc));
      });
    }

    return payments.map((payment) => {
      const bill = billsById.get(payment.billId);
      return {
        ...payment,
        billNumber: bill?.billNumber,
        billDescription: bill?.description,
        vendorName: bill?.vendorName,
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
    const snapshot = await getDocs(
      query(this.collectionRef(tenantId), where('status', 'in', UNPAID_BILL_STATUSES)),
    );
    return snapshot.docs.reduce((total, doc) => addMoney(total, Number(doc.data().balanceDue) || 0), 0);
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
    const todayStr = getTodayTL();
    const nextWeekStr = formatDateISO(addDays(parseDateISO(todayStr), 7));

    const snapshot = await getDocs(query(
      this.collectionRef(tenantId),
      where('status', 'in', UNPAID_BILL_STATUSES),
    ));

    let overdue = 0, overdueCount = 0;
    let dueThisWeek = 0, dueThisWeekCount = 0;
    let dueLater = 0, dueLaterCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const dueDate = data.dueDate;
      const balanceDue = Number(data.balanceDue) || 0;
      const status = data.status;

      if (!dueDate) continue;

      if (dueDate < todayStr) {
        overdue = addMoney(overdue, balanceDue);
        overdueCount++;
      } else if (dueDate <= nextWeekStr && (status === 'pending' || status === 'partial')) {
        dueThisWeek = addMoney(dueThisWeek, balanceDue);
        dueThisWeekCount++;
      } else if (dueDate > nextWeekStr) {
        dueLater = addMoney(dueLater, balanceDue);
        dueLaterCount++;
      }
    }

    return {
      overdue,
      overdueCount,
      dueThisWeek,
      dueThisWeekCount,
      dueLater,
      dueLaterCount,
    };
  }

  /**
   * Update overdue status for all bills
   */
  async updateOverdueStatuses(tenantId: string): Promise<number> {
    const overdue = await this.getOverdueBills(tenantId);

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
