/**
 * Bank Reconciliation Service
 * Handles CSV import and transaction matching
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDateISO } from '@/lib/dateUtils';
import type {
  BankTransaction,
  ReconciliationStatus,
} from '@/types/money';
export type { BankTransaction };

// Get tenant-scoped collection
const getCollection = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'bankTransactions');

class BankReconciliationService {
  private tenantId: string | null = null;

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  private ensureTenant() {
    if (!this.tenantId) {
      throw new Error('Tenant ID not set');
    }
    return this.tenantId;
  }

  /**
   * Parse CSV file and return bank transactions
   * Uses papaparse for robust handling of edge cases like:
   * - Quoted fields containing commas
   * - Escaped quotes within quoted fields
   * - Different line endings (CRLF vs LF)
   * - Newlines within quoted fields
   */
  async parseCSV(csvContent: string): Promise<Omit<BankTransaction, 'id' | 'createdAt' | 'status'>[]> {
    const { default: Papa } = await import('papaparse');
    // Use papaparse for robust CSV parsing
    const result = Papa.parse<string[]>(csvContent, {
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for custom parsing
      header: false, // We'll detect headers ourselves
    });

    if (result.errors.length > 0) {
      console.warn('CSV parsing warnings:', result.errors);
    }

    const rows = result.data;
    if (rows.length < 2) return [];

    // Try to detect header row
    const firstRow = rows[0];
    const headerText = firstRow.join(' ').toLowerCase();
    const hasHeader = headerText.includes('date') ||
                      headerText.includes('amount') ||
                      headerText.includes('description');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const transactions: Omit<BankTransaction, 'id' | 'createdAt' | 'status'>[] = [];

    for (const values of dataRows) {
      if (!values || values.length < 3) continue;

      // Try common CSV formats:
      // Format 1: Date, Description, Amount
      // Format 2: Date, Description, Debit, Credit
      // Format 3: Date, Reference, Description, Amount, Balance

      let date = '';
      let description = '';
      let amount = 0;
      let reference = '';
      let balance: number | undefined;

      if (values.length === 3) {
        // Format 1: Date, Description, Amount
        date = this.parseDate(values[0]);
        description = (values[1] || '').trim();
        amount = this.parseAmount(values[2]);
      } else if (values.length === 4) {
        // Format 2: Date, Description, Debit, Credit
        date = this.parseDate(values[0]);
        description = (values[1] || '').trim();
        const debit = this.parseAmount(values[2]);
        const credit = this.parseAmount(values[3]);
        amount = credit > 0 ? credit : -debit;
      } else if (values.length >= 5) {
        // Format 3: Date, Reference, Description, Amount, Balance
        date = this.parseDate(values[0]);
        reference = (values[1] || '').trim();
        description = (values[2] || '').trim();
        amount = this.parseAmount(values[3]);
        balance = this.parseAmount(values[4]) || undefined;
      }

      if (date && (amount !== 0 || description)) {
        transactions.push({
          date,
          description,
          amount,
          type: amount >= 0 ? 'deposit' : 'withdrawal',
          reference: reference || undefined,
          balance,
        });
      }
    }

    return transactions;
  }

  private parseDate(value: string): string {
    const cleaned = value.trim().replace(/['"]/g, '');

    const toISODate = (year: number, month: number, day: number): string => {
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
      if (month < 1 || month > 12 || day < 1) return '';
      const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day > maxDay) return '';
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const toMonthDay = (first: number, second: number): { month: number; day: number } => {
      // Most TL banking statements use DD/MM/YYYY; use that as default when ambiguous.
      if (first > 12 && second <= 12) return { month: second, day: first };
      if (second > 12 && first <= 12) return { month: first, day: second };
      return { month: second, day: first };
    };

    // YYYY-MM-DD
    const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      return toISODate(
        parseInt(iso[1], 10),
        parseInt(iso[2], 10),
        parseInt(iso[3], 10)
      );
    }

    // DD/MM/YYYY or MM/DD/YYYY (and dash variants)
    const fourDigitYear = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (fourDigitYear) {
      const first = parseInt(fourDigitYear[1], 10);
      const second = parseInt(fourDigitYear[2], 10);
      const year = parseInt(fourDigitYear[3], 10);
      const { month, day } = toMonthDay(first, second);
      return toISODate(year, month, day);
    }

    // DD/MM/YY or MM/DD/YY (slash variants)
    const twoDigitYear = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (twoDigitYear) {
      const first = parseInt(twoDigitYear[1], 10);
      const second = parseInt(twoDigitYear[2], 10);
      const year2 = parseInt(twoDigitYear[3], 10);
      const year = year2 > 50 ? 1900 + year2 : 2000 + year2;
      const { month, day } = toMonthDay(first, second);
      return toISODate(year, month, day);
    }

    // Fallback: try Date.parse
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return formatDateISO(parsed);
    }

    return '';
  }

  private parseAmount(value: string): number {
    const cleaned = value.trim().replace(/['"$,]/g, '').replace(/\(([^)]+)\)/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Import transactions from CSV
   */
  async importTransactions(
    csvContent: string
  ): Promise<{ imported: number; errors: string[] }> {
    const tenantId = this.ensureTenant();
    const parsed = await this.parseCSV(csvContent);
    const errors: string[] = [];
    let imported = 0;

    // Batch all writes (max 499 per batch)
    for (let i = 0; i < parsed.length; i += 499) {
      const batch = writeBatch(db);
      const chunk = parsed.slice(i, i + 499);
      for (const tx of chunk) {
        const docRef = doc(getCollection(tenantId));
        batch.set(docRef, {
          ...tx,
          status: 'unmatched' as ReconciliationStatus,
          createdAt: Timestamp.now(),
        });
        imported++;
      }
      try {
        await batch.commit();
      } catch {
        errors.push(`Failed to import batch starting at row ${i + 1}`);
        imported -= chunk.length;
      }
    }

    return { imported, errors };
  }

  /**
   * Get all unreconciled transactions
   */
  async getUnreconciledTransactions(): Promise<BankTransaction[]> {
    const tenantId = this.ensureTenant();
    const q = query(
      getCollection(tenantId),
      where('status', 'in', ['unmatched', 'matched']),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      reconciledAt: doc.data().reconciledAt?.toDate(),
    })) as BankTransaction[];
  }

  /**
   * Get all transactions
   */
  async getAllTransactions(limit?: number): Promise<BankTransaction[]> {
    const tenantId = this.ensureTenant();
    const q = query(
      getCollection(tenantId),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    let transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      reconciledAt: doc.data().reconciledAt?.toDate(),
    })) as BankTransaction[];

    if (limit) {
      transactions = transactions.slice(0, limit);
    }

    return transactions;
  }

  /**
   * Match a transaction to a payment/expense
   */
  async matchTransaction(
    transactionId: string,
    matchedTo: BankTransaction['matchedTo']
  ): Promise<boolean> {
    const tenantId = this.ensureTenant();
    const docRef = doc(getCollection(tenantId), transactionId);

    await updateDoc(docRef, {
      status: 'matched',
      matchedTo,
    });

    return true;
  }

  /**
   * Unmatch a transaction
   */
  async unmatchTransaction(transactionId: string): Promise<boolean> {
    const tenantId = this.ensureTenant();
    const docRef = doc(getCollection(tenantId), transactionId);

    await updateDoc(docRef, {
      status: 'unmatched',
      matchedTo: null,
    });

    return true;
  }

  /**
   * Mark transactions as reconciled
   */
  async reconcileTransactions(transactionIds: string[]): Promise<boolean> {
    const tenantId = this.ensureTenant();

    // Batch all updates (max 499 per batch)
    for (let i = 0; i < transactionIds.length; i += 499) {
      const batch = writeBatch(db);
      for (const id of transactionIds.slice(i, i + 499)) {
        batch.update(doc(getCollection(tenantId), id), {
          status: 'reconciled',
          reconciledAt: Timestamp.now(),
        });
      }
      await batch.commit();
    }

    return true;
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string): Promise<boolean> {
    const tenantId = this.ensureTenant();
    const docRef = doc(getCollection(tenantId), transactionId);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get reconciliation summary
   */
  async getReconciliationSummary(): Promise<{
    unmatchedCount: number;
    matchedCount: number;
    reconciledCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
  }> {
    const tenantId = this.ensureTenant();
    const snapshot = await getDocs(getCollection(tenantId));

    let unmatchedCount = 0;
    let matchedCount = 0;
    let reconciledCount = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'unmatched') unmatchedCount++;
      else if (data.status === 'matched') matchedCount++;
      else if (data.status === 'reconciled') reconciledCount++;

      if (data.amount > 0) totalDeposits += data.amount;
      else totalWithdrawals += Math.abs(data.amount);
    });

    return {
      unmatchedCount,
      matchedCount,
      reconciledCount,
      totalDeposits,
      totalWithdrawals,
    };
  }
}

export const bankReconciliationService = new BankReconciliationService();
