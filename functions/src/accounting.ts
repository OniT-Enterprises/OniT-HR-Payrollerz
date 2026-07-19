/**
 * Accounting schedulers.
 *
 * processRecurringJournals — daily 00:25 Dili: posts every ACTIVE recurring
 * journal template whose nextRunDate has arrived. Mirrors the client's
 * journal shape exactly (journalEntries + generalLedger, entry numbers from
 * the shared per-year counter in settings/accounting) and the date policy in
 * client/lib/accounting/recurring.ts: dayOfMonth is sticky, clamped per month.
 *
 * Safety: transactional per template (re-reads inside the txn), respects
 * fiscal-period locks, caps catch-up at 3 postings per template per night,
 * and deactivates templates whose endDate has passed.
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

const db = getFirestore();

const MAX_CATCH_UP = 3;

interface TemplateLine {
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

interface RecurringJournalDoc {
  name?: string;
  lines?: TemplateLine[];
  totalDebit?: number;
  totalCredit?: number;
  dayOfMonth?: number;
  nextRunDate?: string;
  endDate?: string;
  active?: boolean;
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
      const result = await db.runTransaction(async (txn) => {
        const ref = db.doc(`tenants/${tenantId}/recurringJournals/${templateId}`);
        const snap = await txn.get(ref);
        if (!snap.exists) return "missing" as const;
        const tpl = snap.data() as RecurringJournalDoc;

        if (!tpl.active) return "inactive" as const;
        if (!tpl.nextRunDate || tpl.nextRunDate > todayTL) return "not_due" as const;
        if (tpl.endDate && tpl.nextRunDate > tpl.endDate) {
          txn.update(ref, { active: false, updatedAt: FieldValue.serverTimestamp() });
          return "ended" as const;
        }

        const lines = (tpl.lines || []).filter(
          (l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0,
        );
        const totalDebit = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
        const totalCredit = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
        if (lines.length < 2 || totalDebit !== totalCredit || totalDebit <= 0) {
          // Never post a broken template — park it for a human.
          txn.update(ref, { active: false, updatedAt: FieldValue.serverTimestamp() });
          logger.warn("Recurring journal template invalid — deactivated", { tenantId, templateId });
          return "invalid" as const;
        }

        const postDate = tpl.nextRunDate;
        const open = await fiscalPeriodIsOpenOrMissing(tenantId, postDate);
        if (!open) {
          // Skip past the locked period rather than hammering it nightly.
          txn.update(ref, {
            nextRunDate: advanceMonthlyRunDate(postDate, tpl.dayOfMonth || 1),
            updatedAt: FieldValue.serverTimestamp(),
          });
          logger.warn("Recurring journal skipped locked fiscal period", { tenantId, templateId, postDate });
          return "period_locked" as const;
        }

        const [yearStr, monthStr] = postDate.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        const entryNumber = await allocateNextJournalEntryNumber(tenantId, txn, year, todayTL);
        const journalRef = db.collection(`tenants/${tenantId}/journalEntries`).doc();

        txn.set(journalRef, {
          entryNumber,
          date: postDate,
          description: tpl.name || "Recurring journal",
          source: "recurring",
          sourceId: templateId,
          sourceRef: tpl.name || templateId,
          lines,
          totalDebit,
          totalCredit,
          status: "posted",
          postedAt: FieldValue.serverTimestamp(),
          postedBy: "system",
          fiscalYear: year,
          fiscalPeriod: month,
          createdBy: "system",
          createdAt: FieldValue.serverTimestamp(),
        });

        for (const line of lines) {
          const glRef = db.collection(`tenants/${tenantId}/generalLedger`).doc();
          txn.set(glRef, {
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: journalRef.id,
            entryNumber,
            entryDate: postDate,
            description: line.description || tpl.name || "Recurring journal",
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            balance: 0,
            fiscalYear: year,
            fiscalPeriod: month,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        txn.update(ref, {
          nextRunDate: advanceMonthlyRunDate(postDate, tpl.dayOfMonth || 1),
          lastRunDate: postDate,
          lastEntryNumber: entryNumber,
          postedCount: (tpl.postedCount || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return "posted" as const;
      });

      if (result === "posted") { posted++; continue; }
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

    const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();
    let templates = 0;
    let posted = 0;
    let errors = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      try {
        const dueSnap = await db
          .collection(`tenants/${tenantId}/recurringJournals`)
          .where("active", "==", true)
          .get();
        for (const tplDoc of dueSnap.docs) {
          const next = (tplDoc.data() as RecurringJournalDoc).nextRunDate;
          if (!next || next > todayTL) continue;
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
