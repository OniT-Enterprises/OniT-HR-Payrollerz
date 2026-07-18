import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addMoney, compareMoney, maxMoney, roundMoney } from '@/lib/currency';
import {
  calculateSupplierWithholdingPosition,
  totalSupplierWithholdingLiability,
  validateSupplierWithholdingRemittance,
  type SupplierWithholdingPeriodPosition,
  type SupplierWithholdingRemittance,
  type SupplierWithholdingRemittanceInput,
} from '@/lib/tax/supplier-withholding-remittance';
import { billService } from './billService';
import { accountService, journalEntryService } from './accountingService';

function periodBounds(period: string): { start: string; end: string } {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, '0')}`,
  };
}

function mapRemittance(id: string, data: Record<string, unknown>): SupplierWithholdingRemittance {
  const createdAt = data.createdAt instanceof Timestamp
    ? data.createdAt.toDate()
    : data.createdAt instanceof Date
      ? data.createdAt
      : new Date(0);
  return {
    id,
    period: String(data.period || ''),
    paymentDate: String(data.paymentDate || ''),
    amount: Number(data.amount),
    method: data.method as SupplierWithholdingRemittance['method'],
    paymentReference: String(data.paymentReference || ''),
    proofUrl: String(data.proofUrl || ''),
    ...(typeof data.notes === 'string' && data.notes.trim() ? { notes: data.notes } : {}),
    journalEntryId: String(data.journalEntryId || ''),
    createdBy: String(data.createdBy || ''),
    createdAt,
  };
}

function readPeriodControlAmount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Supplier withholding period has an invalid ${field}.`);
  }
  return roundMoney(value);
}

class SupplierWithholdingRemittanceService {
  createId(tenantId: string): string {
    return doc(collection(db, paths.supplierWithholdingRemittances(tenantId))).id;
  }

  async getRemittances(
    tenantId: string,
    period: string,
  ): Promise<SupplierWithholdingRemittance[]> {
    // Sort client-side to avoid requiring a composite index for a small,
    // period-scoped history list.
    const snapshot = await getDocs(query(
      collection(db, paths.supplierWithholdingRemittances(tenantId)),
      where('period', '==', period),
    ));
    return snapshot.docs
      .map((item) => mapRemittance(item.id, item.data()))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id));
  }

  async getPosition(
    tenantId: string,
    period: string,
  ): Promise<{
    position: SupplierWithholdingPeriodPosition;
    remittances: SupplierWithholdingRemittance[];
  }> {
    const { start, end } = periodBounds(period);
    const [totals, remittances] = await Promise.all([
      billService.getWithholdingSummary(tenantId, start, end),
      this.getRemittances(tenantId, period),
    ]);
    return {
      position: calculateSupplierWithholdingPosition(
        period,
        totalSupplierWithholdingLiability(totals),
        remittances,
      ),
      remittances,
    };
  }

  async recordRemittance(
    tenantId: string,
    remittanceId: string,
    input: SupplierWithholdingRemittanceInput,
    userId: string,
  ): Promise<string> {
    if (!remittanceId.trim()) throw new Error('A payment id is required.');
    if (!userId.trim()) throw new Error('A signed-in user is required to record payment.');

    const remittanceRef = doc(db, paths.supplierWithholdingRemittance(tenantId, remittanceId));
    const existingDoc = await getDoc(remittanceRef);
    if (existingDoc.exists()) {
      const existing = mapRemittance(existingDoc.id, existingDoc.data());
      const retry = validateSupplierWithholdingRemittance(
        input,
        maxMoney(existing.amount, roundMoney(input.amount)),
      );
      if (
        existing.period !== retry.period
        || existing.paymentDate !== retry.paymentDate
        || compareMoney(existing.amount, retry.amount) !== 0
        || existing.method !== retry.method
        || existing.paymentReference !== retry.paymentReference
        || existing.proofUrl !== retry.proofUrl
        || (existing.notes || '') !== (retry.notes || '')
      ) {
        throw new Error('This payment id is already used by a different remittance.');
      }
      return existingDoc.id;
    }

    const initial = await this.getPosition(tenantId, input.period);
    // Validate files/references before account lookups and the transaction. The
    // transaction below remains the authority for the current outstanding
    // balance; allowing this amount here also makes a committed request safe to
    // retry with the same id after the period has become fully paid.
    const normalized = validateSupplierWithholdingRemittance(
      input,
      maxMoney(initial.position.outstanding, roundMoney(input.amount)),
    );

    const cashCode = normalized.method === 'cash_at_bnu' ? '1110' : '1120';
    const [withholdingAccount, cashAccount] = await Promise.all([
      accountService.ensureSystemAccountByCode(tenantId, '2320'),
      accountService.getAccountByCode(tenantId, cashCode),
    ]);
    if (!withholdingAccount.id) throw new Error('Missing account for code 2320.');
    if (!cashAccount?.id) {
      throw new Error(`Missing account for code ${cashCode}. Set up the chart of accounts first.`);
    }
    const resolvedAccounts = {
      '2320': { id: withholdingAccount.id, name: withholdingAccount.name },
      [cashCode]: { id: cashAccount.id, name: cashAccount.name },
    };

    const periodRef = doc(db, paths.supplierWithholdingPeriod(tenantId, normalized.period));

    return runTransaction(db, async (transaction) => {
      const [existingPayment, periodDoc] = await Promise.all([
        transaction.get(remittanceRef),
        transaction.get(periodRef),
      ]);
      if (existingPayment.exists()) {
        const existing = mapRemittance(existingPayment.id, existingPayment.data());
        if (
          existing.period !== normalized.period
          || existing.paymentDate !== normalized.paymentDate
          || compareMoney(existing.amount, normalized.amount) !== 0
          || existing.method !== normalized.method
          || existing.paymentReference !== normalized.paymentReference
          || existing.proofUrl !== normalized.proofUrl
          || (existing.notes || '') !== (normalized.notes || '')
        ) {
          throw new Error('This payment id is already used by a different remittance.');
        }
        return existingPayment.id;
      }

      const stored = periodDoc.exists() ? periodDoc.data() : {};
      const storedLiability = periodDoc.exists()
        ? readPeriodControlAmount(stored.totalLiability, 'liability')
        : 0;
      const storedRemitted = periodDoc.exists()
        ? readPeriodControlAmount(stored.totalRemitted, 'remitted amount')
        : 0;
      const liability = maxMoney(
        initial.position.liability,
        storedLiability,
      );
      const remittedBefore = maxMoney(
        initial.position.remitted,
        storedRemitted,
      );
      const currentPosition = calculateSupplierWithholdingPosition(
        normalized.period,
        liability,
        remittedBefore > 0
          ? [{ period: normalized.period, amount: remittedBefore }]
          : [],
      );
      validateSupplierWithholdingRemittance(normalized, currentPosition.outstanding);

      // Allocate the journal before queuing any writes. The journal service
      // reads the annual entry counter inside this same transaction.
      const journalEntryId = await journalEntryService.createFromSupplierWithholdingRemittance(
        tenantId,
        { id: remittanceId, ...normalized },
        userId,
        transaction,
        resolvedAccounts,
      );
      const totalRemitted = addMoney(remittedBefore, normalized.amount);

      transaction.set(remittanceRef, {
        ...normalized,
        journalEntryId,
        createdBy: userId,
        createdAt: serverTimestamp(),
      });
      transaction.set(periodRef, {
        period: normalized.period,
        totalLiability: liability,
        totalRemitted,
        updatedAt: serverTimestamp(),
      });
      return remittanceId;
    });
  }
}

export const supplierWithholdingRemittanceService = new SupplierWithholdingRemittanceService();
