"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRecurringJournals = void 0;
exports.templateIsDue = templateIsDue;
exports.evaluateRecurringTemplate = evaluateRecurringTemplate;
exports.runRecurringTemplateOnce = runRecurringTemplateOnce;
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
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const money_1 = require("./money");
// Lazy so importing this module (e.g. from unit tests) never needs an
// initialized Admin app. getFirestore() memoizes per app — no state needed.
const getDb = () => (0, firestore_1.getFirestore)();
const MAX_CATCH_UP = 3;
function daysInMonth(year, month1to12) {
    return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
/** One month after currentISO, day clamped — mirrors advanceMonthlyRunDate. */
function advanceMonthlyRunDate(currentISO, dayOfMonth) {
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
function templateIsDue(nextRunDate, todayISO, endDate) {
    if (!nextRunDate)
        return false;
    if (nextRunDate > todayISO)
        return false;
    if (endDate && nextRunDate > endDate)
        return false;
    return true;
}
/**
 * Pure per-run decision for one template. "ended" and "invalid" mean the
 * caller must deactivate the template; "due" carries everything needed to
 * post. Mirrors client/lib/accounting/recurring.ts validateRecurringTemplate:
 * ≥2 one-sided lines, cent-exact balance, positive total. A line with BOTH
 * debit > 0 and credit > 0 is rejected — it would inflate both totals
 * equally and fake a balanced entry.
 */
function evaluateRecurringTemplate(templateId, tpl, todayISO) {
    const nextRunDate = tpl.nextRunDate;
    if (!tpl.active)
        return { outcome: "inactive" };
    if (!nextRunDate || !templateIsDue(nextRunDate, todayISO)) {
        return { outcome: "not_due" };
    }
    if (!templateIsDue(nextRunDate, todayISO, tpl.endDate)) {
        return { outcome: "ended" };
    }
    const lines = (tpl.lines || []).filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
    const debitCents = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100);
    const creditCents = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100);
    const twoSidedLine = lines.some((l) => (Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0);
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
/**
 * One posting attempt for one template — the transaction body of
 * postDueTemplate, expressed against ports so tests run the same decision
 * flow (including the per-period guard) that production runs.
 */
async function runRecurringTemplateOnce(templateId, todayISO, ports) {
    const tpl = await ports.getTemplate();
    if (!tpl)
        return "missing";
    const evaluation = evaluateRecurringTemplate(templateId, tpl, todayISO);
    if (evaluation.outcome === "ended" || evaluation.outcome === "invalid") {
        // Never post a broken/finished template — park it for a human.
        ports.updateTemplate({ active: false });
        return evaluation.outcome;
    }
    if (evaluation.outcome !== "due")
        return evaluation.outcome;
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
function firestorePorts(txn, tenantId, templateId, todayTL) {
    const db = getDb();
    const templateRef = db.doc(`tenants/${tenantId}/recurringJournals/${templateId}`);
    return {
        async getTemplate() {
            const snap = await txn.get(templateRef);
            return snap.exists ? snap.data() : null;
        },
        async guardExists(guardId) {
            const snap = await txn.get(db.doc(`tenants/${tenantId}/recurringJournalPostings/${guardId}`));
            return snap.exists;
        },
        // Deliberately outside the txn (plain query), matching the previous
        // behavior and fiscalPeriodIsOpenOrMissing's signature.
        fiscalPeriodIsOpen: (dateISO) => (0, money_1.fiscalPeriodIsOpenOrMissing)(tenantId, dateISO),
        allocateEntryNumber: (fiscalYear) => (0, money_1.allocateNextJournalEntryNumber)(tenantId, txn, fiscalYear, todayTL),
        writePosting(posting) {
            const journalRef = db.collection(`tenants/${tenantId}/journalEntries`).doc();
            const guardRef = db.doc(`tenants/${tenantId}/recurringJournalPostings/${posting.guardId}`);
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
                postedAt: firestore_1.FieldValue.serverTimestamp(),
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
                postedAt: firestore_1.FieldValue.serverTimestamp(),
                postedBy: "system",
                fiscalYear: posting.fiscalYear,
                fiscalPeriod: posting.fiscalPeriod,
                createdBy: "system",
                createdAt: firestore_1.FieldValue.serverTimestamp(),
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
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
        },
        updateTemplate(fields) {
            txn.update(templateRef, Object.assign(Object.assign({}, fields), { updatedAt: firestore_1.FieldValue.serverTimestamp() }));
        },
    };
}
async function postDueTemplate(tenantId, templateId, todayTL) {
    let posted = 0;
    let deactivated = false;
    let errors = 0;
    for (let i = 0; i < MAX_CATCH_UP; i++) {
        try {
            const result = await getDb().runTransaction((txn) => runRecurringTemplateOnce(templateId, todayTL, firestorePorts(txn, tenantId, templateId, todayTL)));
            if (result === "posted") {
                posted++;
                continue;
            }
            if (result === "already_posted") {
                // Guard hit: the pointer moved past a period that already posted —
                // keep going so a genuinely due period can still post tonight.
                v2_1.logger.warn("Recurring journal period already posted — advanced nextRunDate", {
                    tenantId,
                    templateId,
                });
                continue;
            }
            if (result === "invalid") {
                v2_1.logger.warn("Recurring journal template invalid — deactivated", {
                    tenantId,
                    templateId,
                });
            }
            if (result === "period_locked") {
                v2_1.logger.warn("Recurring journal skipped locked fiscal period", {
                    tenantId,
                    templateId,
                });
            }
            if (result === "ended" || result === "invalid")
                deactivated = true;
            break;
        }
        catch (err) {
            errors++;
            v2_1.logger.error("Recurring journal posting failed", { tenantId, templateId, err });
            break;
        }
    }
    return { posted, deactivated, errors };
}
exports.processRecurringJournals = (0, scheduler_1.onSchedule)({
    schedule: "25 0 * * *", // 00:25 every day, after recurring invoices
    timeZone: money_1.TL_TIMEZONE,
    region: "asia-southeast1",
}, async () => {
    const todayTL = (0, money_1.getTodayTL)();
    v2_1.logger.info("Starting recurring journal processing", { todayTL });
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
                const next = tplDoc.data().nextRunDate;
                // endDate deliberately not passed: templates past their endDate must
                // still be visited so the txn can deactivate them.
                if (!templateIsDue(next, todayTL))
                    continue;
                templates++;
                const res = await postDueTemplate(tenantId, tplDoc.id, todayTL);
                posted += res.posted;
                errors += res.errors;
            }
        }
        catch (err) {
            errors++;
            v2_1.logger.error("Recurring journal tenant sweep failed", { tenantId, err });
        }
    }
    v2_1.logger.info("Recurring journal processing complete", { templates, posted, errors });
});
//# sourceMappingURL=accounting.js.map