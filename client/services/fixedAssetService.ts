/**
 * Fixed assets — register CRUD + depreciation/disposal posting.
 *
 * The register (tenants/{tid}/fixedAssets) is the depreciation subledger.
 * Posting writes ONE aggregate journal per period (source 'depreciation',
 * Dr 5800 / Cr 1590), guarded by a per-period posting doc
 * (tenants/{tid}/fixedAssetPostings/{YYYY-MM}) so a retried click can never
 * double-charge. Schedule math lives in client/lib/accounting/depreciation.ts.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FixedAsset, FixedAssetPosting, JournalEntryLine } from '@/types/accounting';
import {
  ACCUMULATED_DEPRECIATION_CODE,
  CASH_BANK_CODE,
  DEPRECIATION_EXPENSE_CODE,
  DISPOSAL_GAIN_CODE,
  DISPOSAL_LOSS_CODE,
  chargeDueThroughPeriod,
  disposalResult,
  periodOf,
} from '@/lib/accounting/depreciation';
import { accountService, journalEntryService } from '@/services/accountingService';
import { getTodayTL } from '@/lib/dateUtils';

const assetsRef = (tenantId: string) => collection(db, `tenants/${tenantId}/fixedAssets`);
const postingsRef = (tenantId: string) => collection(db, `tenants/${tenantId}/fixedAssetPostings`);

const round2 = (n: number) => Math.round(n * 100) / 100;

function mapAsset(id: string, data: Record<string, unknown>): FixedAsset {
  return {
    id,
    ...(data as Omit<FixedAsset, 'id'>),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
  };
}

async function resolveAccount(tenantId: string, code: string) {
  const account = await accountService.getAccountByCode(tenantId, code);
  if (!account?.id) {
    throw new Error(`Chart of accounts is missing account ${code}.`);
  }
  return { id: account.id, code, name: account.name };
}

export interface DepreciationPreviewLine {
  asset: FixedAsset;
  charge: number;
}

export const fixedAssetService = {
  async list(tenantId: string): Promise<FixedAsset[]> {
    const snap = await getDocs(query(assetsRef(tenantId), orderBy('acquisitionDate', 'desc')));
    return snap.docs.map((d) => mapAsset(d.id, d.data()));
  },

  async create(
    tenantId: string,
    asset: Omit<
      FixedAsset,
      'id' | 'accumulatedDepreciation' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<string> {
    if (asset.acquisitionCost <= 0) throw new Error('Acquisition cost must be positive.');
    if ((asset.residualValue || 0) < 0 || asset.residualValue >= asset.acquisitionCost) {
      throw new Error('Residual value must be ≥ 0 and below cost.');
    }
    const ref = doc(assetsRef(tenantId));
    await setDoc(ref, {
      ...asset,
      residualValue: asset.residualValue || 0,
      accumulatedDepreciation: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(
    tenantId: string,
    id: string,
    changes: Partial<Pick<FixedAsset, 'name' | 'reference' | 'description' | 'residualValue' | 'usefulLifeMonths'>>,
  ): Promise<void> {
    await updateDoc(doc(assetsRef(tenantId), id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  },

  /** Only assets that never depreciated can be deleted; others must be disposed. */
  async remove(tenantId: string, asset: FixedAsset): Promise<void> {
    if (!asset.id) return;
    if ((asset.accumulatedDepreciation || 0) > 0 || asset.status === 'disposed') {
      throw new Error('Assets with posted depreciation must be disposed, not deleted.');
    }
    await deleteDoc(doc(assetsRef(tenantId), asset.id));
  },

  async listPostings(tenantId: string): Promise<FixedAssetPosting[]> {
    const snap = await getDocs(query(postingsRef(tenantId), orderBy('period', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FixedAssetPosting, 'id'>) }));
  },

  /** What `postDepreciationForPeriod` would charge — shown before confirming. */
  previewPeriod(assets: FixedAsset[], period: string): DepreciationPreviewLine[] {
    return assets
      .map((asset) => ({ asset, charge: chargeDueThroughPeriod(asset, period).charge }))
      .filter((line) => line.charge > 0);
  },

  /**
   * Post the aggregate depreciation journal for `period` (YYYY-MM), including
   * catch-up for assets behind schedule. Throws if the period was already
   * posted (delete/void is deliberately not offered — post the next period
   * or dispose the asset instead).
   */
  async postDepreciationForPeriod(
    tenantId: string,
    period: string,
    postedBy: string,
  ): Promise<{ journalEntryId: string; totalAmount: number; assetCount: number }> {
    const guardRef = doc(postingsRef(tenantId), period);
    const existing = await getDoc(guardRef);
    if (existing.exists()) {
      throw new Error(`Depreciation for ${period} is already posted.`);
    }

    const assets = await this.list(tenantId);
    const due = this.previewPeriod(assets, period);
    if (!due.length) throw new Error('Nothing to depreciate for this period.');

    const totalAmount = round2(due.reduce((sum, line) => sum + line.charge, 0));
    const expense = await resolveAccount(tenantId, DEPRECIATION_EXPENSE_CODE);
    const accumulated = await resolveAccount(tenantId, ACCUMULATED_DEPRECIATION_CODE);

    const [yearStr, monthStr] = period.split('-');
    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: expense.id,
        accountCode: expense.code,
        accountName: expense.name,
        debit: totalAmount,
        credit: 0,
        description: `Depreciation ${period} — ${due.length} asset(s)`,
      },
      {
        lineNumber: 2,
        accountId: accumulated.id,
        accountCode: accumulated.code,
        accountName: accumulated.name,
        debit: 0,
        credit: totalAmount,
        description: `Accumulated depreciation ${period}`,
      },
    ];

    const journalEntryId = await journalEntryService.createJournalEntry(tenantId, {
      date: `${period}-28` <= getTodayTL() ? `${period}-28` : getTodayTL(),
      description: `Depreciation for ${period}`,
      source: 'depreciation',
      sourceId: period,
      sourceRef: `DEP-${period}`,
      lines,
      totalDebit: totalAmount,
      totalCredit: totalAmount,
      status: 'posted',
      fiscalYear: Number(yearStr),
      fiscalPeriod: Number(monthStr),
      createdBy: postedBy,
      postedBy,
    });

    // Guard doc first, then per-asset state (idempotency anchor is the guard).
    await setDoc(guardRef, {
      period,
      journalEntryId,
      entryNumber: '',
      totalAmount,
      assetCount: due.length,
      postedBy,
      postedAt: serverTimestamp(),
    });

    for (const { asset, charge } of due) {
      if (!asset.id) continue;
      const newAccumulated = round2((asset.accumulatedDepreciation || 0) + charge);
      const fullyDepreciated =
        newAccumulated >= round2(asset.acquisitionCost - (asset.residualValue || 0));
      await updateDoc(doc(assetsRef(tenantId), asset.id), {
        accumulatedDepreciation: newAccumulated,
        depreciatedThroughPeriod: period,
        status: fullyDepreciated ? 'fully_depreciated' : 'active',
        updatedAt: serverTimestamp(),
      });
    }

    return { journalEntryId, totalAmount, assetCount: due.length };
  },

  /**
   * Dispose an asset: removes cost and accumulated depreciation from the
   * books, books proceeds to cash, and posts the gain/loss.
   */
  async dispose(
    tenantId: string,
    asset: FixedAsset,
    options: { date: string; proceeds: number },
    postedBy: string,
  ): Promise<{ journalEntryId: string; gainOrLoss: number }> {
    if (!asset.id) throw new Error('Asset id missing.');
    if (asset.status === 'disposed') throw new Error('Asset is already disposed.');

    const proceeds = round2(options.proceeds || 0);
    const { gainOrLoss } = disposalResult(asset, proceeds);

    const assetAccount = await resolveAccount(tenantId, asset.assetAccountCode);
    const accumulated = await resolveAccount(tenantId, ACCUMULATED_DEPRECIATION_CODE);

    const lines: JournalEntryLine[] = [];
    let lineNumber = 1;
    if (proceeds > 0) {
      const cash = await resolveAccount(tenantId, CASH_BANK_CODE);
      lines.push({
        lineNumber: lineNumber++,
        accountId: cash.id, accountCode: cash.code, accountName: cash.name,
        debit: proceeds, credit: 0,
        description: `Disposal proceeds — ${asset.name}`,
      });
    }
    if ((asset.accumulatedDepreciation || 0) > 0) {
      lines.push({
        lineNumber: lineNumber++,
        accountId: accumulated.id, accountCode: accumulated.code, accountName: accumulated.name,
        debit: round2(asset.accumulatedDepreciation), credit: 0,
        description: `Reverse accumulated depreciation — ${asset.name}`,
      });
    }
    if (gainOrLoss < 0) {
      const loss = await resolveAccount(tenantId, DISPOSAL_LOSS_CODE);
      lines.push({
        lineNumber: lineNumber++,
        accountId: loss.id, accountCode: loss.code, accountName: loss.name,
        debit: round2(-gainOrLoss), credit: 0,
        description: `Loss on disposal — ${asset.name}`,
      });
    }
    lines.push({
      lineNumber: lineNumber++,
      accountId: assetAccount.id, accountCode: assetAccount.code, accountName: assetAccount.name,
      debit: 0, credit: round2(asset.acquisitionCost),
      description: `Derecognize asset — ${asset.name}`,
    });
    if (gainOrLoss > 0) {
      const gain = await resolveAccount(tenantId, DISPOSAL_GAIN_CODE);
      lines.push({
        lineNumber: lineNumber++,
        accountId: gain.id, accountCode: gain.code, accountName: gain.name,
        debit: 0, credit: round2(gainOrLoss),
        description: `Gain on disposal — ${asset.name}`,
      });
    }

    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));

    const [yearStr, monthStr] = options.date.split('-');
    const journalEntryId = await journalEntryService.createJournalEntry(tenantId, {
      date: options.date,
      description: `Disposal of ${asset.name}`,
      source: 'depreciation',
      sourceId: asset.id,
      sourceRef: asset.reference || asset.name,
      lines,
      totalDebit,
      totalCredit,
      status: 'posted',
      fiscalYear: Number(yearStr),
      fiscalPeriod: Number(monthStr),
      createdBy: postedBy,
      postedBy,
    });

    await updateDoc(doc(assetsRef(tenantId), asset.id), {
      status: 'disposed',
      disposalDate: options.date,
      disposalProceeds: proceeds,
      disposalJournalEntryId: journalEntryId,
      updatedAt: serverTimestamp(),
    });

    return { journalEntryId, gainOrLoss };
  },

  /** Default posting period: the month of today (TL). */
  currentPeriod(): string {
    return periodOf(getTodayTL());
  },
};
