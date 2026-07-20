/**
 * Bank Reconciliation Service
 * Handles CSV import and transaction matching
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  Timestamp,
  limit as firestoreLimit,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDateISO } from '@/lib/dateUtils';
import { paths } from '@/lib/paths';
import { addMoney, roundMoney } from '@/lib/currency';
import { parseBankAmount } from '@/lib/accounting/calculations';
import { invoiceService } from './invoiceService';
import { billService } from './billService';
import type {
  BankTransaction,
  ReconciliationStatus,
} from '@/types/money';
export type { BankTransaction };

// Get tenant-scoped collection
const getCollection = (tenantId: string) =>
  collection(db, paths.bankTransactions(tenantId));

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
   * Stable doc id derived from a statement line's own content, so re-importing
   * the same CSV is a no-op instead of duplicating every row. The running
   * balance (when the bank provides it) makes each line unique within a
   * statement; date/amount/type/reference/description disambiguate otherwise.
   * 64-bit FNV-1a → hex keeps it a short, id-safe string: across a tenant's
   * lifetime of imports (~10k rows), 32 bits carried ~1% birthday-collision
   * odds — a collision silently drops a real transaction — while 64 bits
   * makes that negligible.
   */
  private static importKey(
    tx: Omit<BankTransaction, 'id' | 'createdAt' | 'status'>,
  ): string {
    const raw = [
      tx.date,
      tx.amount,
      tx.type,
      tx.reference ?? '',
      tx.balance ?? '',
      tx.description,
    ].join('|');
    let hash = 0xcbf29ce484222325n;
    for (let i = 0; i < raw.length; i++) {
      hash ^= BigInt(raw.charCodeAt(i));
      hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return `csv_${hash.toString(16).padStart(16, '0')}`;
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
        amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
      } else if (values.length >= 5) {
        // Format 3: Date, Reference, Description, Amount, Balance
        date = this.parseDate(values[0]);
        reference = (values[1] || '').trim();
        description = (values[2] || '').trim();
        amount = this.parseAmount(values[3]);
        balance = values[4]?.trim() ? this.parseAmount(values[4]) : undefined;
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
    return parseBankAmount(value);
  }

  /**
   * Import transactions from CSV
   */
  async importTransactions(
    csvContent: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const tenantId = this.ensureTenant();
    const parsed = await this.parseCSV(csvContent);
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Deterministic ids make re-importing the same statement idempotent, while
    // an occurrence ordinal keeps genuinely identical rows within ONE file
    // distinct (same day, same amount, no bank reference — e.g. two equal cash
    // deposits): the first occurrence gets suffix 0, the second 1, and so on,
    // so re-importing the same file maps back onto the same ids. Guard the
    // write with a create-if-absent read so a re-import doesn't clobber a line
    // already matched/reconciled.
    const occurrences = new Map<string, number>();
    const ids = parsed.map((tx) => {
      const base = BankReconciliationService.importKey(tx);
      const ordinal = occurrences.get(base) ?? 0;
      occurrences.set(base, ordinal + 1);
      return `${base}_${ordinal}`;
    });

    // Batch all writes (max 499 per batch)
    for (let i = 0; i < parsed.length; i += 499) {
      const chunk = parsed.slice(i, i + 499);
      const chunkRefs = ids
        .slice(i, i + 499)
        .map((id) => doc(getCollection(tenantId), id));
      const existing = await Promise.all(chunkRefs.map((ref) => getDoc(ref)));

      const batch = writeBatch(db);
      let batchCount = 0;
      chunk.forEach((tx, j) => {
        if (existing[j].exists()) {
          skipped++; // already imported by a previous run of this statement
          return;
        }
        batch.set(chunkRefs[j], {
          ...tx,
          status: 'unmatched' as ReconciliationStatus,
          createdAt: Timestamp.now(),
        });
        batchCount++;
      });

      if (batchCount === 0) continue;
      try {
        await batch.commit();
        imported += batchCount;
      } catch {
        errors.push(`Failed to import batch starting at row ${i + 1}`);
      }
    }

    return { imported, skipped, errors };
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
    const constraints: QueryConstraint[] = [
      orderBy('date', 'desc'),
    ];
    if (limit) {
      constraints.push(firestoreLimit(limit));
    }
    const q = query(
      getCollection(tenantId),
      ...constraints,
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      reconciledAt: doc.data().reconciledAt?.toDate(),
    })) as BankTransaction[];

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
   * Settle-matching records money, so it must start from an unmatched line —
   * settling an already-matched line again would double-record the payment.
   */
  private async assertUnmatched(transactionId: string): Promise<void> {
    const tenantId = this.ensureTenant();
    const snapshot = await getDoc(doc(getCollection(tenantId), transactionId));
    if (!snapshot.exists()) {
      throw new Error('Bank transaction not found');
    }
    if (snapshot.data().status !== 'unmatched') {
      throw new Error('This bank line is already matched');
    }
  }

  /**
   * Match a bank deposit to an OUTSTANDING invoice by first recording a real
   * payment on it — the exact path the Invoices page uses (payment doc,
   * invoice paid/partial status, receipt email on full settlement, GL journal
   * when a chart of accounts exists) — then linking the bank line to it.
   *
   * Ordering is deliberate: payment first, link second. If the link write
   * fails after the payment committed, the books are still honest (the
   * invoice IS paid); the line just stays unmatched, and re-settling a fully
   * paid invoice is rejected by recordPayment's own balance check.
   *
   * The caller validates amount-vs-outstanding with decideSettlement();
   * recordPayment re-validates inside its transaction as the backstop.
   */
  async settleInvoiceMatch(params: {
    transactionId: string;
    invoiceId: string;
    /** Positive payment amount (full or partial, never above balance due). */
    amount: number;
    /** Bank line date (YYYY-MM-DD) — the day the money actually moved. */
    date: string;
    /** Bank line description, kept as the payment reference. */
    reference: string;
    matchDescription: string;
  }): Promise<{ paymentId: string }> {
    const tenantId = this.ensureTenant();
    await this.assertUnmatched(params.transactionId);

    const paymentId = await invoiceService.recordPayment(
      tenantId,
      params.invoiceId,
      {
        date: params.date,
        amount: params.amount,
        method: 'bank_transfer',
        reference: params.reference,
        notes: 'Recorded from bank reconciliation',
      },
    );

    await updateDoc(doc(getCollection(tenantId), params.transactionId), {
      status: 'matched',
      matchedTo: {
        type: 'invoice_payment',
        id: params.invoiceId,
        description: params.matchDescription,
        paymentId,
        paymentRecorded: true,
      },
    });

    return { paymentId };
  }

  /**
   * Match a bank withdrawal to an UNPAID bill by recording a real payment
   * through billService.recordPayment (payment doc, bill paid/partial status,
   * GL journal when a chart of accounts exists), then linking the bank line.
   * Bills with payer withholding are never offered for settle-on-match (see
   * canSettleBillFromBank) because the bank line shows cash, not gross AP.
   * Same payment-first ordering rationale as settleInvoiceMatch.
   */
  async settleBillMatch(params: {
    transactionId: string;
    billId: string;
    amount: number;
    date: string;
    reference: string;
    matchDescription: string;
  }): Promise<{ paymentId: string }> {
    const tenantId = this.ensureTenant();
    await this.assertUnmatched(params.transactionId);

    const paymentId = await billService.recordPayment(
      tenantId,
      params.billId,
      {
        date: params.date,
        amount: params.amount,
        method: 'bank_transfer',
        reference: params.reference,
        notes: 'Recorded from bank reconciliation',
      },
    );

    await updateDoc(doc(getCollection(tenantId), params.transactionId), {
      status: 'matched',
      matchedTo: {
        type: 'bill_payment',
        id: params.billId,
        description: params.matchDescription,
        paymentId,
        paymentRecorded: true,
      },
    });

    return { paymentId };
  }

  /**
   * Unmatch a transaction.
   *
   * Refused when the match itself recorded a payment: silently unlinking
   * would leave the payment (and its GL posting) behind while the line goes
   * back to "unmatched", inviting a second settlement of the same money.
   * There is no client-side payment reversal path, so the honest route is
   * managing the payment from the invoice/bill page.
   */
  async unmatchTransaction(transactionId: string): Promise<boolean> {
    const tenantId = this.ensureTenant();
    const docRef = doc(getCollection(tenantId), transactionId);

    const snapshot = await getDoc(docRef);
    if (snapshot.exists() && snapshot.data().matchedTo?.paymentRecorded) {
      throw new Error(
        'A payment was recorded when this line was matched. Manage the payment from the invoice or bill page.',
      );
    }

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

    const transactionDocs = await Promise.all(
      transactionIds.map((id) => getDoc(doc(getCollection(tenantId), id))),
    );
    if (transactionDocs.some((transactionDoc) => (
      !transactionDoc.exists() || transactionDoc.data().status !== 'matched'
    ))) {
      throw new Error('Only matched bank transactions can be reconciled');
    }

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
    const collectionRef = getCollection(tenantId);
    const snapshot = await getDocs(query(collectionRef));

    let unmatchedCount = 0;
    let matchedCount = 0;
    let reconciledCount = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const status = data.status;
      const amount = Number(data.amount) || 0;

      if (status === 'unmatched') unmatchedCount++;
      else if (status === 'matched') matchedCount++;
      else if (status === 'reconciled') reconciledCount++;

      if (amount > 0) totalDeposits = addMoney(totalDeposits, amount);
      else if (amount < 0) totalWithdrawals = addMoney(totalWithdrawals, amount);
    }

    return {
      unmatchedCount,
      matchedCount,
      reconciledCount,
      totalDeposits,
      totalWithdrawals: roundMoney(Math.abs(totalWithdrawals)),
    };
  }
}

export const bankReconciliationService = new BankReconciliationService();
