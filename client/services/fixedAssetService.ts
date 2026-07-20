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
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addMoney, roundMoney, subtractMoney } from "@/lib/currency";
import type {
  FixedAsset,
  FixedAssetPosting,
  JournalEntryLine,
} from "@/types/accounting";
import {
  ACCUMULATED_DEPRECIATION_CODE,
  CASH_BANK_CODE,
  DEPRECIATION_EXPENSE_CODE,
  DISPOSAL_GAIN_CODE,
  DISPOSAL_LOSS_CODE,
  chargeDueThroughPeriod,
  disposalResult,
  periodOf,
} from "@/lib/accounting/depreciation";
import {
  accountService,
  journalEntryService,
} from "@/services/accountingService";
import { getTodayTL } from "@/lib/dateUtils";

const assetsRef = (tenantId: string) =>
  collection(db, `tenants/${tenantId}/fixedAssets`);
const postingsRef = (tenantId: string) =>
  collection(db, `tenants/${tenantId}/fixedAssetPostings`);

function mapAsset(id: string, data: Record<string, unknown>): FixedAsset {
  return {
    id,
    ...(data as Omit<FixedAsset, "id">),
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
    const snap = await getDocs(
      query(assetsRef(tenantId), orderBy("acquisitionDate", "desc")),
    );
    return snap.docs.map((d) => mapAsset(d.id, d.data()));
  },

  async create(
    tenantId: string,
    asset: Omit<
      FixedAsset,
      "id" | "accumulatedDepreciation" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<string> {
    if (asset.acquisitionCost <= 0)
      throw new Error("Acquisition cost must be positive.");
    if (
      (asset.residualValue || 0) < 0 ||
      asset.residualValue >= asset.acquisitionCost
    ) {
      throw new Error("Residual value must be ≥ 0 and below cost.");
    }
    const ref = doc(assetsRef(tenantId));
    await setDoc(ref, {
      ...asset,
      residualValue: asset.residualValue || 0,
      accumulatedDepreciation: 0,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(
    tenantId: string,
    id: string,
    changes: Partial<
      Pick<
        FixedAsset,
        | "name"
        | "reference"
        | "description"
        | "residualValue"
        | "usefulLifeMonths"
      >
    >,
  ): Promise<void> {
    await updateDoc(doc(assetsRef(tenantId), id), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  },

  /** Only assets that never depreciated can be deleted; others must be disposed. */
  async remove(tenantId: string, asset: FixedAsset): Promise<void> {
    if (!asset.id) return;
    if (
      (asset.accumulatedDepreciation || 0) > 0 ||
      asset.status === "disposed"
    ) {
      throw new Error(
        "Assets with posted depreciation must be disposed, not deleted.",
      );
    }
    await deleteDoc(doc(assetsRef(tenantId), asset.id));
  },

  async listPostings(tenantId: string): Promise<FixedAssetPosting[]> {
    const snap = await getDocs(
      query(postingsRef(tenantId), orderBy("period", "desc")),
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<FixedAssetPosting, "id">),
    }));
  },

  /** What `postDepreciationForPeriod` would charge — shown before confirming. */
  previewPeriod(
    assets: FixedAsset[],
    period: string,
  ): DepreciationPreviewLine[] {
    return assets
      .map((asset) => ({
        asset,
        charge: chargeDueThroughPeriod(asset, period).charge,
      }))
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
  ): Promise<{
    journalEntryId: string;
    totalAmount: number;
    assetCount: number;
  }> {
    // Never recognize depreciation for a future month (the native month picker
    // caps this, but a typed value must be rejected here too).
    if (period > periodOf(getTodayTL())) {
      throw new Error("Cannot post depreciation for a future period.");
    }

    const guardRef = doc(postingsRef(tenantId), period);

    // Resolve accounts up front (non-transactional reads).
    const expense = await resolveAccount(tenantId, DEPRECIATION_EXPENSE_CODE);
    const accumulated = await resolveAccount(
      tenantId,
      ACCUMULATED_DEPRECIATION_CODE,
    );

    // Candidate assets (those with a charge due). This only bounds which docs
    // the transaction re-reads; the authoritative charge is recomputed from
    // fresh state inside the transaction.
    const candidates = (await this.list(tenantId)).filter(
      (a) => a.id && chargeDueThroughPeriod(a, period).charge > 0,
    );
    if (!candidates.length)
      throw new Error("Nothing to depreciate for this period.");

    const [yearStr, monthStr] = period.split("-");
    const journalDate =
      `${period}-28` <= getTodayTL() ? `${period}-28` : getTodayTL();

    // Everything atomic: claiming the period guard, posting the journal, and
    // advancing every asset's subledger happen in ONE transaction. So two
    // concurrent posts cannot both proceed (guard read+create is transactional),
    // and a crash can never leave the guard/journal posted with assets only
    // partially advanced (which would double-charge via next-period catch-up).
    const result = await runTransaction(db, async (tx) => {
      const g = await tx.get(guardRef);
      if (g.exists())
        throw new Error(`Depreciation for ${period} is already posted.`);

      // Re-read each candidate inside the transaction for fresh accumulated
      // state (reads MUST precede writes — done before createJournalEntry).
      const fresh: Array<{ asset: FixedAsset; charge: number }> = [];
      for (const c of candidates) {
        const snap = await tx.get(doc(assetsRef(tenantId), c.id!));
        if (!snap.exists()) continue;
        const asset = mapAsset(snap.id, snap.data());
        const dueNow = chargeDueThroughPeriod(asset, period);
        if (dueNow.charge > 0) fresh.push({ asset, charge: dueNow.charge });
      }
      if (!fresh.length)
        throw new Error("Nothing to depreciate for this period.");

      const totalAmount = roundMoney(
        fresh.reduce((sum, line) => addMoney(sum, line.charge), 0),
      );
      const lines: JournalEntryLine[] = [
        {
          lineNumber: 1,
          accountId: expense.id,
          accountCode: expense.code,
          accountName: expense.name,
          debit: totalAmount,
          credit: 0,
          description: `Depreciation ${period} — ${fresh.length} asset(s)`,
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

      const journalEntryId = await journalEntryService.createJournalEntry(
        tenantId,
        {
          date: journalDate,
          description: `Depreciation for ${period}`,
          source: "depreciation",
          sourceId: period,
          sourceRef: `DEP-${period}`,
          lines,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          status: "posted",
          fiscalYear: Number(yearStr),
          fiscalPeriod: Number(monthStr),
          createdBy: postedBy,
          postedBy,
        },
        tx,
      );

      tx.set(guardRef, {
        period,
        journalEntryId,
        entryNumber: "",
        totalAmount,
        assetCount: fresh.length,
        postedBy,
        postedAt: serverTimestamp(),
      });

      for (const { asset, charge } of fresh) {
        const newAccumulated = addMoney(
          asset.accumulatedDepreciation || 0,
          charge,
        );
        const fullyDepreciated =
          newAccumulated >=
          subtractMoney(asset.acquisitionCost, asset.residualValue || 0);
        tx.update(doc(assetsRef(tenantId), asset.id!), {
          accumulatedDepreciation: newAccumulated,
          depreciatedThroughPeriod: period,
          status: fullyDepreciated ? "fully_depreciated" : "active",
          updatedAt: serverTimestamp(),
        });
      }

      return { journalEntryId, totalAmount, assetCount: fresh.length };
    });

    // Backfill the guard's entryNumber (allocated inside createJournalEntry,
    // which returns only the id). Non-fatal presentation detail.
    try {
      const posted = await journalEntryService.getJournalEntryBySource(
        tenantId,
        "depreciation",
        period,
      );
      if (posted?.entryNumber)
        await updateDoc(guardRef, { entryNumber: posted.entryNumber });
    } catch {
      /* entryNumber is cosmetic on the guard; ignore */
    }

    return result;
  },

  /**
   * Dispose an asset: removes cost and accumulated depreciation from the
   * books, books proceeds to cash, and posts the gain/loss.
   *
   * Policy (v1, deliberate): no catch-up depreciation is posted for the
   * disposal month — NBV is taken as-posted, so any undepreciated remainder
   * lands in the gain/loss line. The journal still balances exactly; run
   * "Post depreciation" first if the charge-to-disposal-date treatment is
   * wanted.
   */
  async dispose(
    tenantId: string,
    asset: FixedAsset,
    options: { date: string; proceeds: number },
    postedBy: string,
  ): Promise<{ journalEntryId: string; gainOrLoss: number }> {
    if (!asset.id) throw new Error("Asset id missing.");
    if (asset.status === "disposed")
      throw new Error("Asset is already disposed.");

    const assetRef = doc(assetsRef(tenantId), asset.id);
    const proceeds = roundMoney(options.proceeds || 0);

    // Resolve every possibly-needed account up front (non-transactional reads).
    const assetAccount = await resolveAccount(tenantId, asset.assetAccountCode);
    const accumulatedAcct = await resolveAccount(
      tenantId,
      ACCUMULATED_DEPRECIATION_CODE,
    );
    const cashAcct =
      proceeds > 0 ? await resolveAccount(tenantId, CASH_BANK_CODE) : null;
    const lossAcct = await resolveAccount(tenantId, DISPOSAL_LOSS_CODE);
    const gainAcct = await resolveAccount(tenantId, DISPOSAL_GAIN_CODE);

    const [yearStr, monthStr] = options.date.split("-");

    // Journal post + asset derecognition are atomic: a retry after a partial
    // failure can't re-derecognize (a committed disposal flips status; the
    // in-transaction status check then rejects the retry), and transaction
    // contention on the asset doc serializes concurrent disposals.
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(assetRef);
      if (!snap.exists()) throw new Error("Asset not found.");
      const fresh = mapAsset(snap.id, snap.data());
      if (fresh.status === "disposed")
        throw new Error("Asset is already disposed.");

      const { gainOrLoss } = disposalResult(fresh, proceeds);
      const lines: JournalEntryLine[] = [];
      let lineNumber = 1;
      if (proceeds > 0 && cashAcct) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: cashAcct.id,
          accountCode: cashAcct.code,
          accountName: cashAcct.name,
          debit: proceeds,
          credit: 0,
          description: `Disposal proceeds — ${fresh.name}`,
        });
      }
      if ((fresh.accumulatedDepreciation || 0) > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: accumulatedAcct.id,
          accountCode: accumulatedAcct.code,
          accountName: accumulatedAcct.name,
          debit: roundMoney(fresh.accumulatedDepreciation || 0),
          credit: 0,
          description: `Reverse accumulated depreciation — ${fresh.name}`,
        });
      }
      if (gainOrLoss < 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: lossAcct.id,
          accountCode: lossAcct.code,
          accountName: lossAcct.name,
          debit: roundMoney(-gainOrLoss),
          credit: 0,
          description: `Loss on disposal — ${fresh.name}`,
        });
      }
      lines.push({
        lineNumber: lineNumber++,
        accountId: assetAccount.id,
        accountCode: assetAccount.code,
        accountName: assetAccount.name,
        debit: 0,
        credit: roundMoney(fresh.acquisitionCost),
        description: `Derecognize asset — ${fresh.name}`,
      });
      if (gainOrLoss > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: gainAcct.id,
          accountCode: gainAcct.code,
          accountName: gainAcct.name,
          debit: 0,
          credit: roundMoney(gainOrLoss),
          description: `Gain on disposal — ${fresh.name}`,
        });
      }

      const totalDebit = roundMoney(
        lines.reduce((s, l) => addMoney(s, l.debit), 0),
      );
      const totalCredit = roundMoney(
        lines.reduce((s, l) => addMoney(s, l.credit), 0),
      );

      const journalEntryId = await journalEntryService.createJournalEntry(
        tenantId,
        {
          date: options.date,
          description: `Disposal of ${fresh.name}`,
          source: "depreciation",
          sourceId: asset.id,
          sourceRef: fresh.reference || fresh.name,
          lines,
          totalDebit,
          totalCredit,
          status: "posted",
          fiscalYear: Number(yearStr),
          fiscalPeriod: Number(monthStr),
          createdBy: postedBy,
          postedBy,
        },
        tx,
      );

      tx.update(assetRef, {
        status: "disposed",
        disposalDate: options.date,
        disposalProceeds: proceeds,
        disposalJournalEntryId: journalEntryId,
        updatedAt: serverTimestamp(),
      });

      return { journalEntryId, gainOrLoss };
    });
  },

  /** Default posting period: the month of today (TL). */
  currentPeriod(): string {
    return periodOf(getTodayTL());
  },
};
