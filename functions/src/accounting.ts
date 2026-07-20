/**
 * Accounting schedulers.
 *
 * processRecurringJournals — daily 00:25 Dili: posts every ACTIVE recurring
 * journal template whose nextRunDate has arrived. Mirrors the client's
 * journal shape exactly (journalEntries + generalLedger, entry numbers from
 * the shared per-year counter in settings/accounting) and the date policy in
 * client/lib/accounting/recurring.ts: dayOfMonth is sticky, clamped per month.
 *
 * Safety:
 * - Transactional per template (re-reads inside the txn).
 * - Per-(template, fiscal period) idempotency guard: each posting txn.create()s
 *   tenants/{tid}/recurringJournalPostings/{templateId}_{YYYY-MM}, so a given
 *   template can post AT MOST ONCE per period even if nextRunDate is rewound
 *   (e.g. by a schedule edit). A guard hit advances nextRunDate past the
 *   period instead of posting again.
 * - Respects fiscal-period locks, caps catch-up at 3 postings per template
 *   per night, and deactivates templates whose endDate has passed or whose
 *   lines no longer form a valid balanced entry.
 *
 * The decision flow is in evaluateRecurringTemplate/runRecurringTemplateOnce,
 * written against RecurringPostingPorts so that
 * tests/client/recurring-journals.test.ts exercises the exact code the
 * scheduler runs (with in-memory ports standing in for Firestore).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  allocateNextJournalEntryNumber,
  fiscalPeriodIsOpenOrMissing,
  getTodayTL,
  TL_TIMEZONE,
} from "./money";

// Lazy so importing this module (e.g. from unit tests) never needs an
// initialized Admin app. getFirestore() memoizes per app — no state needed.
const getDb = () => getFirestore();

const MAX_CATCH_UP = 3;

export interface TemplateLine {
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  departmentId?: string;
  employeeId?: string;
  projectId?: string;
}

export interface RecurringJournalDoc {
  name?: string;
  lines?: TemplateLine[];
  totalDebit?: number;
  totalCredit?: number;
  dayOfMonth?: number;
  nextRunDate?: string;
  endDate?: string;
  active?: boolean;
  lastRunDate?: string;
  lastEntryNumber?: string;
  postedCount?: number;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** One month after currentISO, day clamped — mirrors advanceMonthlyRunDate. */
function advanceMonthlyRunDate(currentISO: string, dayOfMonth: number): string {
  const [y, m] = currentISO.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const day = Math.min(Math.max(1, Math.trunc(dayOfMonth)), daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Due-check shared by the nightly sweep and the in-transaction re-check
 * (moved here from client/lib/accounting/recurring.ts, which had no
 * production caller — this is now the single source of truth).
 */
export function templateIsDue(
  nextRunDate: string | undefined,
  todayISO: string,
  endDate?: string,
): boolean {
  if (!nextRunDate) return false;
  if (nextRunDate > todayISO) return false;
  if (endDate && nextRunDate > endDate) return false;
  return true;
}

export type RecurringTemplateEvaluation =
  | { outcome: "inactive" | "not_due" | "ended" | "invalid" }
  | {
      outcome: "due";
      postDate: string;
      /** YYYY-MM — the fiscal bucket, and half of the guard doc id. */
      period: string;
      /** Doc id in tenants/{tid}/recurringJournalPostings. */
      guardId: string;
      /** Amount-bearing lines only (zero lines dropped, as posted). */
      lines: TemplateLine[];
      totalDebit: number;
      totalCredit: number;
      fiscalYear: number;
      fiscalPeriod: number;
      /** Where nextRunDate moves after this run (posted, skipped or guarded). */
      nextRunDate: string;
    };

/**
 * Pure per-run decision for one template. "ended" and "invalid" mean the
 * caller must deactivate the template; "due" carries everything needed to
 * post. Mirrors client/lib/accounting/recurring.ts validateRecurringTemplate:
 * ≥2 one-sided lines, cent-exact balance, positive total. A line with BOTH
 * debit > 0 and credit > 0 is rejected — it would inflate both totals
 * equally and fake a balanced entry.
 */
export function evaluateRecurringTemplate(
  templateId: string,
  tpl: RecurringJournalDoc,
  todayISO: string,
): RecurringTemplateEvaluation {
  const nextRunDate = tpl.nextRunDate;
  if (!tpl.active) return { outcome: "inactive" };
  if (!nextRunDate || !templateIsDue(nextRunDate, todayISO)) {
    return { outcome: "not_due" };
  }
  if (!templateIsDue(nextRunDate, todayISO, tpl.endDate)) {
    return { outcome: "ended" };
  }

  const lines = (tpl.lines || []).filter(
    (l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0,
  );
  const debitCents = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100);
  const creditCents = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100);
  const twoSidedLine = lines.some(
    (l) => (Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0,
  );
  if (lines.length < 2 || twoSidedLine || debitCents !== creditCents || debitCents <= 0) {
    return { outcome: "invalid" };
  }

  const postDate = nextRunDate;
  const [yearStr, monthStr] = postDate.split("-");
  const period = `${yearStr}-${monthStr}`;
  return {
    outcome: "due",
    postDate,
    period,
    guardId: `${templateId}_${period}`,
    lines,
    totalDebit: debitCents / 100,
    totalCredit: creditCents / 100,
    fiscalYear: Number(yearStr),
    fiscalPeriod: Number(monthStr),
    nextRunDate: advanceMonthlyRunDate(postDate, tpl.dayOfMonth || 1),
  };
}

export interface RecurringPostingWrite {
  guardId: string;
  period: string;
  postDate: string;
  entryNumber: string;
  description: string;
  sourceRef: string;
  lines: TemplateLine[];
  totalDebit: number;
  totalCredit: number;
  fiscalYear: number;
  fiscalPeriod: number;
}

/**
 * The I/O surface runRecurringTemplateOnce needs. The production adapter
 * (firestorePorts) maps these onto one Firestore transaction; tests use an
 * in-memory store. Read/write ordering matters for Firestore transactions:
 * getTemplate and guardExists (txn reads) are always called before any write.
 */
export interface RecurringPostingPorts {
  getTemplate(): Promise<RecurringJournalDoc | null>;
  guardExists(guardId: string): Promise<boolean>;
  fiscalPeriodIsOpen(dateISO: string): Promise<boolean>;
  allocateEntryNumber(fiscalYear: number): Promise<string>;
  /** Guard doc + journal entry + GL rows, atomically with updateTemplate. */
  writePosting(posting: RecurringPostingWrite): void;
  updateTemplate(
    fields: Partial<
      Pick<
        RecurringJournalDoc,
        "active" | "nextRunDate" | "lastRunDate" | "lastEntryNumber" | "postedCount"
      >
    >,
  ): void;
}

export type RecurringRunOutcome =
  | "missing"
  | "inactive"
  | "not_due"
  | "ended"
  | "invalid"
  | "already_posted"
  | "period_locked"
  | "posted";

/**
 * One posting attempt for one template — the transaction body of
 * postDueTemplate, expressed against ports so tests run the same decision
 * flow (including the per-period guard) that production runs.
 */
export async function runRecurringTemplateOnce(
  templateId: string,
  todayISO: string,
  ports: RecurringPostingPorts,
): Promise<RecurringRunOutcome> {
  const tpl = await ports.getTemplate();
  if (!tpl) return "missing";

  const evaluation = evaluateRecurringTemplate(templateId, tpl, todayISO);
  if (evaluation.outcome === "ended" || evaluation.outcome === "invalid") {
    // Never post a broken/finished template — park it for a human.
    ports.updateTemplate({ active: false });
    return evaluation.outcome;
  }
  if (evaluation.outcome !== "due") return evaluation.outcome;

  // Per-(template, period) idempotency guard: even a nextRunDate rewound by
  // a schedule edit can never double-post an already-posted fiscal period —
  // skip forward instead of posting again.
  if (await ports.guardExists(evaluation.guardId)) {
    ports.updateTemplate({ nextRunDate: evaluation.nextRunDate });
    return "already_posted";
  }

  if (!(await ports.fiscalPeriodIsOpen(evaluation.postDate))) {
    // Skip past the locked period rather than hammering it nightly.
    ports.updateTemplate({ nextRunDate: evaluation.nextRunDate });
    return "period_locked";
  }

  const entryNumber = await ports.allocateEntryNumber(evaluation.fiscalYear);
  ports.writePosting({
    guardId: evaluation.guardId,
    period: evaluation.period,
    postDate: evaluation.postDate,
    entryNumber,
    description: tpl.name || "Recurring journal",
    sourceRef: tpl.name || templateId,
    lines: evaluation.lines,
    totalDebit: evaluation.totalDebit,
    totalCredit: evaluation.totalCredit,
    fiscalYear: evaluation.fiscalYear,
    fiscalPeriod: evaluation.fiscalPeriod,
  });
  ports.updateTemplate({
    nextRunDate: evaluation.nextRunDate,
    lastRunDate: evaluation.postDate,
    lastEntryNumber: entryNumber,
    postedCount: (tpl.postedCount || 0) + 1,
  });
  return "posted";
}

/** Production ports: everything inside the caller's Firestore transaction. */
function firestorePorts(
  txn: FirebaseFirestore.Transaction,
  tenantId: string,
  templateId: string,
  todayTL: string,
): RecurringPostingPorts {
  const db = getDb();
  const templateRef = db.doc(`tenants/${tenantId}/recurringJournals/${templateId}`);
  return {
    async getTemplate() {
      const snap = await txn.get(templateRef);
      return snap.exists ? (snap.data() as RecurringJournalDoc) : null;
    },
    async guardExists(guardId) {
      const snap = await txn.get(
        db.doc(`tenants/${tenantId}/recurringJournalPostings/${guardId}`),
      );
      return snap.exists;
    },
    // Deliberately outside the txn (plain query), matching the previous
    // behavior and fiscalPeriodIsOpenOrMissing's signature.
    fiscalPeriodIsOpen: (dateISO) => fiscalPeriodIsOpenOrMissing(tenantId, dateISO),
    allocateEntryNumber: (fiscalYear) =>
      allocateNextJournalEntryNumber(tenantId, txn, fiscalYear, todayTL),
    writePosting(posting) {
      const journalRef = db.collection(`tenants/${tenantId}/journalEntries`).doc();
      const guardRef = db.doc(
        `tenants/${tenantId}/recurringJournalPostings/${posting.guardId}`,
      );

      // create(): if a concurrent run claimed this (template, period) first,
      // the whole transaction aborts — on retry guardExists sees the winner
      // and resolves as "already_posted".
      txn.create(guardRef, {
        templateId,
        period: posting.period,
        postDate: posting.postDate,
        journalEntryId: journalRef.id,
        entryNumber: posting.entryNumber,
        totalAmount: posting.totalDebit,
        postedBy: "system",
        postedAt: FieldValue.serverTimestamp(),
      });

      txn.set(journalRef, {
        entryNumber: posting.entryNumber,
        date: posting.postDate,
        description: posting.description,
        source: "recurring",
        sourceId: templateId,
        sourceRef: posting.sourceRef,
        lines: posting.lines,
        totalDebit: posting.totalDebit,
        totalCredit: posting.totalCredit,
        status: "posted",
        postedAt: FieldValue.serverTimestamp(),
        postedBy: "system",
        fiscalYear: posting.fiscalYear,
        fiscalPeriod: posting.fiscalPeriod,
        createdBy: "system",
        createdAt: FieldValue.serverTimestamp(),
      });

      for (const line of posting.lines) {
        const glRef = db.collection(`tenants/${tenantId}/generalLedger`).doc();
        txn.set(glRef, {
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: journalRef.id,
          entryNumber: posting.entryNumber,
          entryDate: posting.postDate,
          description: line.description || posting.description,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          balance: 0,
          fiscalYear: posting.fiscalYear,
          fiscalPeriod: posting.fiscalPeriod,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    },
    updateTemplate(fields) {
      txn.update(templateRef, { ...fields, updatedAt: FieldValue.serverTimestamp() });
    },
  };
}

async function postDueTemplate(
  tenantId: string,
  templateId: string,
  todayTL: string,
): Promise<{ posted: number; deactivated: boolean; errors: number }> {
  let posted = 0;
  let deactivated = false;
  let errors = 0;

  for (let i = 0; i < MAX_CATCH_UP; i++) {
    try {
      const result = await getDb().runTransaction((txn) =>
        runRecurringTemplateOnce(
          templateId,
          todayTL,
          firestorePorts(txn, tenantId, templateId, todayTL),
        ),
      );

      if (result === "posted") {
        posted++;
        continue;
      }
      if (result === "already_posted") {
        // Guard hit: the pointer moved past a period that already posted —
        // keep going so a genuinely due period can still post tonight.
        logger.warn("Recurring journal period already posted — advanced nextRunDate", {
          tenantId,
          templateId,
        });
        continue;
      }
      if (result === "invalid") {
        logger.warn("Recurring journal template invalid — deactivated", {
          tenantId,
          templateId,
        });
      }
      if (result === "period_locked") {
        logger.warn("Recurring journal skipped locked fiscal period", {
          tenantId,
          templateId,
        });
      }
      if (result === "ended" || result === "invalid") deactivated = true;
      break;
    } catch (err) {
      errors++;
      logger.error("Recurring journal posting failed", { tenantId, templateId, err });
      break;
    }
  }

  return { posted, deactivated, errors };
}

export const processRecurringJournals = onSchedule(
  {
    schedule: "25 0 * * *", // 00:25 every day, after recurring invoices
    timeZone: TL_TIMEZONE,
    region: "asia-southeast1",
  },
  async () => {
    const todayTL = getTodayTL();
    logger.info("Starting recurring journal processing", { todayTL });

    const tenantsSnap = await getDb().collection("tenants").where("status", "==", "active").get();
    let templates = 0;
    let posted = 0;
    let errors = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      try {
        const dueSnap = await getDb()
          .collection(`tenants/${tenantId}/recurringJournals`)
          .where("active", "==", true)
          .get();
        for (const tplDoc of dueSnap.docs) {
          const next = (tplDoc.data() as RecurringJournalDoc).nextRunDate;
          // endDate deliberately not passed: templates past their endDate must
          // still be visited so the txn can deactivate them.
          if (!templateIsDue(next, todayTL)) continue;
          templates++;
          const res = await postDueTemplate(tenantId, tplDoc.id, todayTL);
          posted += res.posted;
          errors += res.errors;
        }
      } catch (err) {
        errors++;
        logger.error("Recurring journal tenant sweep failed", { tenantId, err });
      }
    }

    logger.info("Recurring journal processing complete", { templates, posted, errors });
  },
);
