import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { compareMoney, maxMoney, roundMoney } from '@/lib/currency';
import {
  applyCashAdvanceClearing,
  validateCashAdvanceClearing,
  validateCashAdvanceInput,
  type CashAdvance,
  type CashAdvanceClearing,
  type CashAdvanceClearingInput,
  type CashAdvanceInput,
} from '@/lib/accounting/cash-advance';
import { EXPENSE_CATEGORY_TO_ACCOUNT } from '@/lib/accounting/chart-of-accounts';
import { employeeService } from './employeeService';
import { accountService, journalEntryService } from './accountingService';

export interface CashAdvanceWithClearings extends CashAdvance {
  clearings: CashAdvanceClearing[];
}

function dateValue(data: unknown): Date {
  return data instanceof Timestamp ? data.toDate() : data instanceof Date ? data : new Date(0);
}

function mapAdvance(id: string, data: Record<string, unknown>): CashAdvance {
  return {
    id,
    employeeId: String(data.employeeId || ''),
    employeeName: String(data.employeeName || ''),
    purpose: String(data.purpose || ''),
    issueDate: String(data.issueDate || ''),
    dueDate: String(data.dueDate || ''),
    amount: Number(data.amount),
    expenseCleared: Number(data.expenseCleared) || 0,
    cashReturned: Number(data.cashReturned) || 0,
    outstanding: Number(data.outstanding),
    status: data.status as CashAdvance['status'],
    fundingMethod: data.fundingMethod as CashAdvance['fundingMethod'],
    issueReference: String(data.issueReference || ''),
    issueProofUrl: String(data.issueProofUrl || ''),
    ...(typeof data.notes === 'string' && data.notes ? { notes: data.notes } : {}),
    journalEntryId: String(data.journalEntryId || ''),
    createdBy: String(data.createdBy || ''),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt),
  };
}

function mapClearing(id: string, data: Record<string, unknown>): CashAdvanceClearing {
  return {
    id,
    advanceId: String(data.advanceId || ''),
    type: data.type as CashAdvanceClearing['type'],
    date: String(data.date || ''),
    amount: Number(data.amount),
    description: String(data.description || ''),
    proofUrl: String(data.proofUrl || ''),
    ...(typeof data.expenseCategory === 'string'
      ? { expenseCategory: data.expenseCategory as CashAdvanceClearing['expenseCategory'] }
      : {}),
    ...(typeof data.returnMethod === 'string'
      ? { returnMethod: data.returnMethod as CashAdvanceClearing['returnMethod'] }
      : {}),
    ...(typeof data.reference === 'string' ? { reference: data.reference } : {}),
    journalEntryId: String(data.journalEntryId || ''),
    createdBy: String(data.createdBy || ''),
    createdAt: dateValue(data.createdAt),
  };
}

function matchesAdvanceInput(saved: CashAdvance, input: CashAdvanceInput): boolean {
  return Number.isFinite(input.amount)
    && saved.employeeId === input.employeeId
    && saved.purpose === input.purpose
    && saved.issueDate === input.issueDate
    && saved.dueDate === input.dueDate
    && compareMoney(saved.amount, input.amount) === 0
    && saved.fundingMethod === input.fundingMethod
    && saved.issueReference === input.issueReference
    && saved.issueProofUrl === input.issueProofUrl
    && (saved.notes || '') === (input.notes || '');
}

function matchesClearingInput(
  saved: CashAdvanceClearing,
  advanceId: string,
  input: CashAdvanceClearingInput,
): boolean {
  if (
    !Number.isFinite(input.amount)
    || saved.advanceId !== advanceId
    || saved.type !== input.type
    || compareMoney(saved.amount, input.amount) !== 0
    || saved.date !== input.date
    || saved.description !== String(input.description || '').trim()
    || saved.proofUrl !== String(input.proofUrl || '').trim()
  ) return false;
  return saved.type === 'expense'
    ? saved.expenseCategory === input.expenseCategory
    : saved.returnMethod === input.returnMethod
      && (saved.reference || '') === String(input.reference || '').trim();
}

class CashAdvanceService {
  createAdvanceId(tenantId: string): string {
    return doc(collection(db, paths.cashAdvances(tenantId))).id;
  }

  createClearingId(tenantId: string): string {
    return doc(collection(db, paths.cashAdvanceClearings(tenantId))).id;
  }

  async getAll(tenantId: string): Promise<CashAdvanceWithClearings[]> {
    const [advanceSnapshot, clearingSnapshot] = await Promise.all([
      getDocs(query(collection(db, paths.cashAdvances(tenantId)), orderBy('issueDate', 'desc'))),
      getDocs(query(collection(db, paths.cashAdvanceClearings(tenantId)), orderBy('date', 'desc'))),
    ]);
    const byAdvance = new Map<string, CashAdvanceClearing[]>();
    for (const item of clearingSnapshot.docs) {
      const clearing = mapClearing(item.id, item.data());
      const existing = byAdvance.get(clearing.advanceId) || [];
      existing.push(clearing);
      byAdvance.set(clearing.advanceId, existing);
    }
    return advanceSnapshot.docs.map((item) => ({
      ...mapAdvance(item.id, item.data()),
      clearings: byAdvance.get(item.id) || [],
    }));
  }

  async getById(tenantId: string, advanceId: string): Promise<CashAdvance | null> {
    const snapshot = await getDoc(doc(db, paths.cashAdvance(tenantId, advanceId)));
    return snapshot.exists() ? mapAdvance(snapshot.id, snapshot.data()) : null;
  }

  async create(
    tenantId: string,
    advanceId: string,
    input: CashAdvanceInput,
    userId: string,
  ): Promise<string> {
    if (!advanceId.trim()) throw new Error('A cash advance id is required.');
    if (!userId.trim()) throw new Error('A signed-in user is required to issue a cash advance.');
    const normalized = validateCashAdvanceInput(input);
    const advanceRef = doc(db, paths.cashAdvance(tenantId, advanceId));
    const existingAdvance = await getDoc(advanceRef);
    if (existingAdvance.exists()) {
      const saved = mapAdvance(existingAdvance.id, existingAdvance.data());
      if (!matchesAdvanceInput(saved, normalized)) {
        throw new Error('This advance id is already used by a different record.');
      }
      return existingAdvance.id;
    }
    const employee = await employeeService.getEmployeeById(tenantId, normalized.employeeId);
    if (!employee || employee.status !== 'active') {
      throw new Error('Select an active employee who received the advance.');
    }
    const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.trim();
    if (!employeeName) throw new Error('Employee name is incomplete.');

    const cashCode = normalized.fundingMethod === 'cash' ? '1110' : '1120';
    const [advanceAccount, cashAccount] = await Promise.all([
      accountService.ensureSystemAccountByCode(tenantId, '1230'),
      accountService.getAccountByCode(tenantId, cashCode),
    ]);
    if (!advanceAccount.id || !cashAccount?.id) {
      throw new Error(`Cash advance requires accounts 1230 and ${cashCode}. Set up the chart of accounts first.`);
    }
    const resolvedAccounts = {
      '1230': { id: advanceAccount.id, name: advanceAccount.name },
      [cashCode]: { id: cashAccount.id, name: cashAccount.name },
    };
    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(advanceRef);
      if (existing.exists()) {
        const saved = mapAdvance(existing.id, existing.data());
        if (!matchesAdvanceInput(saved, normalized)) {
          throw new Error('This advance id is already used by a different record.');
        }
        return existing.id;
      }

      const journalEntryId = await journalEntryService.createFromCashAdvanceIssue(
        tenantId,
        { id: advanceId, employeeName, ...normalized },
        userId,
        transaction,
        resolvedAccounts,
      );
      transaction.set(advanceRef, {
        ...normalized,
        employeeName,
        expenseCleared: 0,
        cashReturned: 0,
        outstanding: normalized.amount,
        status: 'open',
        journalEntryId,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return advanceId;
    });
  }

  async clear(
    tenantId: string,
    advanceId: string,
    clearingId: string,
    input: CashAdvanceClearingInput,
    userId: string,
  ): Promise<string> {
    if (!advanceId.trim()) throw new Error('A cash advance id is required.');
    if (!clearingId.trim()) throw new Error('A clearing id is required.');
    if (!userId.trim()) throw new Error('A signed-in user is required to clear a cash advance.');
    const advanceRef = doc(db, paths.cashAdvance(tenantId, advanceId));
    const clearingRef = doc(db, paths.cashAdvanceClearing(tenantId, clearingId));
    const existingClearing = await getDoc(clearingRef);
    if (existingClearing.exists()) {
      const saved = mapClearing(existingClearing.id, existingClearing.data());
      if (!matchesClearingInput(saved, advanceId, input)) {
        throw new Error('This clearing id is already used by a different record.');
      }
      return existingClearing.id;
    }
    const prefetched = await this.getById(tenantId, advanceId);
    if (!prefetched) throw new Error('Cash advance not found.');
    // Normalize static fields up front, but leave the authoritative open/
    // outstanding check to the transaction. This preserves idempotent retries
    // after a prior attempt committed and fully cleared the advance.
    const normalized = validateCashAdvanceClearing({
      ...prefetched,
      status: 'open',
      outstanding: maxMoney(prefetched.outstanding, roundMoney(input.amount)),
    }, input);
    const advanceAccount = await accountService.ensureSystemAccountByCode(tenantId, '1230');
    if (!advanceAccount.id) throw new Error('Missing account for code 1230.');
    let debitCode: string;
    if (normalized.type === 'expense') {
      const expenseAccount = normalized.expenseCategory
        ? EXPENSE_CATEGORY_TO_ACCOUNT[normalized.expenseCategory]
        : undefined;
      if (!expenseAccount) {
        throw new Error('The selected expense category has no configured ledger account.');
      }
      debitCode = expenseAccount.code;
    } else {
      debitCode = normalized.returnMethod === 'cash' ? '1110' : '1120';
    }
    const debitAccount = await accountService.getAccountByCode(tenantId, debitCode);
    if (!debitAccount?.id) {
      throw new Error(`Missing account for code ${debitCode}. Set up the chart of accounts first.`);
    }
    const resolvedAccounts = {
      '1230': { id: advanceAccount.id, name: advanceAccount.name },
      [debitCode]: { id: debitAccount.id, name: debitAccount.name },
    };
    return runTransaction(db, async (transaction) => {
      const [advanceDoc, clearingDoc] = await Promise.all([
        transaction.get(advanceRef),
        transaction.get(clearingRef),
      ]);
      if (clearingDoc.exists()) {
        const saved = mapClearing(clearingDoc.id, clearingDoc.data());
        if (!matchesClearingInput(saved, advanceId, normalized)) {
          throw new Error('This clearing id is already used by a different record.');
        }
        return clearingDoc.id;
      }
      if (!advanceDoc.exists()) throw new Error('Cash advance not found.');
      const advance = mapAdvance(advanceDoc.id, advanceDoc.data());
      const currentInput = validateCashAdvanceClearing(advance, normalized);
      const position = applyCashAdvanceClearing(advance, currentInput);
      const journalEntryId = await journalEntryService.createFromCashAdvanceClearing(
        tenantId,
        {
          id: clearingId,
          advanceId,
          employeeName: advance.employeeName,
          ...currentInput,
          expenseAccountCode: currentInput.type === 'expense' ? debitCode : undefined,
        },
        userId,
        transaction,
        resolvedAccounts,
      );
      transaction.set(clearingRef, {
        ...currentInput,
        advanceId,
        journalEntryId,
        createdBy: userId,
        createdAt: serverTimestamp(),
      });
      transaction.update(advanceRef, {
        expenseCleared: position.expenseCleared,
        cashReturned: position.cashReturned,
        outstanding: position.outstanding,
        status: position.status,
        updatedAt: serverTimestamp(),
      });
      return clearingId;
    });
  }
}

export const cashAdvanceService = new CashAdvanceService();
