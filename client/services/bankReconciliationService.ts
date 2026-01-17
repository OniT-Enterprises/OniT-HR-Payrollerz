/**
 * Bank Reconciliation Service
 * Handles CSV import and transaction matching
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
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  BankTransaction,
  BankReconciliation,
  BankTransactionType,
  ReconciliationStatus,
} from '@/types/money';

// Get tenant-scoped collection
const getCollection = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'bankTransactions');

const getReconciliationsCollection = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'bankReconciliations');

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
   */
  parseCSV(csvContent: string): Omit<BankTransaction, 'id' | 'createdAt' | 'status'>[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    // Try to detect header row
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('date') || header.includes('amount') || header.includes('description');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const transactions: Omit<BankTransaction, 'id' | 'createdAt' | 'status'>[] = [];

    for (const line of dataLines) {
      if (!line.trim()) continue;

      // Parse CSV line (handle quoted values)
      const values = this.parseCSVLine(line);
      if (values.length < 3) continue;

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
        description = values[1].trim();
        amount = this.parseAmount(values[2]);
      } else if (values.length === 4) {
        // Format 2: Date, Description, Debit, Credit
        date = this.parseDate(values[0]);
        description = values[1].trim();
        const debit = this.parseAmount(values[2]);
        const credit = this.parseAmount(values[3]);
        amount = credit > 0 ? credit : -debit;
      } else if (values.length >= 5) {
        // Format 3: Date, Reference, Description, Amount, Balance
        date = this.parseDate(values[0]);
        reference = values[1].trim();
        description = values[2].trim();
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

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  private parseDate(value: string): string {
    const cleaned = value.trim().replace(/['"]/g, '');

    // Try various date formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/,         // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/,           // MM-DD-YYYY
      /^(\d{2})\/(\d{2})\/(\d{2})$/,         // MM/DD/YY
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        if (format === formats[0]) {
          return cleaned; // Already YYYY-MM-DD
        } else if (format === formats[1] || format === formats[2]) {
          return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        } else if (format === formats[3]) {
          const year = parseInt(match[3]) > 50 ? `19${match[3]}` : `20${match[3]}`;
          return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        }
      }
    }

    // Fallback: try Date.parse
    const parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
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
    const parsed = this.parseCSV(csvContent);
    const errors: string[] = [];
    let imported = 0;

    for (const tx of parsed) {
      try {
        await addDoc(getCollection(tenantId), {
          ...tx,
          status: 'unmatched' as ReconciliationStatus,
          createdAt: Timestamp.now(),
        });
        imported++;
      } catch (error) {
        errors.push(`Failed to import: ${tx.description}`);
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

    for (const id of transactionIds) {
      const docRef = doc(getCollection(tenantId), id);
      await updateDoc(docRef, {
        status: 'reconciled',
        reconciledAt: Timestamp.now(),
      });
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
