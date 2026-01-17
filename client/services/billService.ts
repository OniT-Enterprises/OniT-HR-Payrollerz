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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Bill,
  BillFormData,
  BillStatus,
  BillPayment,
  BillPaymentFormData,
  ExpenseCategory,
} from '@/types/money';
import { vendorService } from './vendorService';

class BillService {
  private get collectionRef() {
    return collection(db, 'bills');
  }

  private get paymentsRef() {
    return collection(db, 'bill_payments');
  }

  // ----------------------------------------
  // Bill CRUD
  // ----------------------------------------

  /**
   * Get all bills
   */
  async getAllBills(maxResults: number = 500): Promise<Bill[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy('billDate', 'desc'), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Get bills by status
   */
  async getBillsByStatus(status: BillStatus): Promise<Bill[]> {
    const q = query(
      this.collectionRef,
      where('status', '==', status),
      orderBy('billDate', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Get bills by vendor
   */
  async getBillsByVendor(vendorId: string): Promise<Bill[]> {
    const q = query(
      this.collectionRef,
      where('vendorId', '==', vendorId),
      orderBy('billDate', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Get overdue bills
   */
  async getOverdueBills(): Promise<Bill[]> {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      this.collectionRef,
      where('status', 'in', ['pending', 'partial']),
      where('dueDate', '<', today)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Get unpaid bills (pending + partial)
   */
  async getUnpaidBills(): Promise<Bill[]> {
    const q = query(
      this.collectionRef,
      where('status', 'in', ['pending', 'partial', 'overdue']),
      orderBy('dueDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Get a single bill by ID
   */
  async getBillById(id: string): Promise<Bill | null> {
    const docRef = doc(db, 'bills', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapBill(docSnap);
  }

  /**
   * Create a new bill
   */
  async createBill(data: BillFormData): Promise<string> {
    // Get vendor info
    const vendor = await vendorService.getVendorById(data.vendorId);
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

    const docRef = await addDoc(this.collectionRef, {
      ...bill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing bill (only if pending)
   */
  async updateBill(id: string, data: Partial<BillFormData>): Promise<boolean> {
    const bill = await this.getBillById(id);
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
      const vendor = await vendorService.getVendorById(data.vendorId);
      if (vendor) {
        updates.vendorId = data.vendorId;
        updates.vendorName = vendor.name;
      }
    }

    const docRef = doc(db, 'bills', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  }

  /**
   * Cancel a bill
   */
  async cancelBill(id: string): Promise<boolean> {
    const docRef = doc(db, 'bills', id);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete a pending bill
   */
  async deleteBill(id: string): Promise<boolean> {
    const bill = await this.getBillById(id);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== 'pending') {
      throw new Error('Cannot delete bill that has payments. Cancel it instead.');
    }

    const docRef = doc(db, 'bills', id);
    await deleteDoc(docRef);
    return true;
  }

  // ----------------------------------------
  // Payments
  // ----------------------------------------

  /**
   * Record a payment for a bill
   */
  async recordPayment(billId: string, payment: BillPaymentFormData): Promise<string> {
    const bill = await this.getBillById(billId);
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

    const paymentRef = await addDoc(this.paymentsRef, {
      ...paymentRecord,
      billId,
      createdAt: serverTimestamp(),
    });

    // Update bill
    const newAmountPaid = bill.amountPaid + payment.amount;
    const newBalanceDue = bill.total - newAmountPaid;
    const newStatus: BillStatus =
      newBalanceDue <= 0 ? 'paid' : newBalanceDue < bill.total ? 'partial' : bill.status;

    const billRef = doc(db, 'bills', billId);
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
  async getPaymentsForBill(billId: string): Promise<BillPayment[]> {
    const q = query(
      this.paymentsRef,
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
  async getAllPayments(maxResults: number = 500): Promise<(BillPayment & { billId: string })[]> {
    const querySnapshot = await getDocs(
      query(this.paymentsRef, orderBy('date', 'desc'), limit(maxResults))
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
  async getTotalPayables(): Promise<number> {
    const bills = await this.getUnpaidBills();
    return bills.reduce((sum, bill) => sum + bill.balanceDue, 0);
  }

  /**
   * Get bills due soon (next 7 days)
   */
  async getBillsDueSoon(): Promise<Bill[]> {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const q = query(
      this.collectionRef,
      where('status', 'in', ['pending', 'partial']),
      where('dueDate', '>=', todayStr),
      where('dueDate', '<=', nextWeekStr),
      orderBy('dueDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapBill(doc));
  }

  /**
   * Update overdue status for all bills
   */
  async updateOverdueStatuses(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const bills = await this.getAllBills();

    let updated = 0;
    for (const bill of bills) {
      if (
        ['pending', 'partial'].includes(bill.status) &&
        bill.dueDate < today
      ) {
        const docRef = doc(db, 'bills', bill.id);
        await updateDoc(docRef, {
          status: 'overdue',
          updatedAt: serverTimestamp(),
        });
        updated++;
      }
    }

    return updated;
  }

  private mapBill(doc: any): Bill {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      paidAt: data.paidAt?.toDate() || undefined,
    } as Bill;
  }
}

export const billService = new BillService();
export default billService;
