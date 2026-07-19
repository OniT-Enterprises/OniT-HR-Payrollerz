"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRecurringJournals = void 0;
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
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const money_1 = require("./money");
const db = (0, firestore_1.getFirestore)();
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
async function postDueTemplate(tenantId, templateId, todayTL) {
    let posted = 0;
    let deactivated = false;
    let errors = 0;
    for (let i = 0; i < MAX_CATCH_UP; i++) {
        try {
            const result = await db.runTransaction(async (txn) => {
                const ref = db.doc(`tenants/${tenantId}/recurringJournals/${templateId}`);
                const snap = await txn.get(ref);
                if (!snap.exists)
                    return "missing";
                const tpl = snap.data();
                if (!tpl.active)
                    return "inactive";
                if (!tpl.nextRunDate || tpl.nextRunDate > todayTL)
                    return "not_due";
                if (tpl.endDate && tpl.nextRunDate > tpl.endDate) {
                    txn.update(ref, { active: false, updatedAt: firestore_1.FieldValue.serverTimestamp() });
                    return "ended";
                }
                const lines = (tpl.lines || []).filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
                const totalDebit = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
                const totalCredit = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
                if (lines.length < 2 || totalDebit !== totalCredit || totalDebit <= 0) {
                    // Never post a broken template — park it for a human.
                    txn.update(ref, { active: false, updatedAt: firestore_1.FieldValue.serverTimestamp() });
                    v2_1.logger.warn("Recurring journal template invalid — deactivated", { tenantId, templateId });
                    return "invalid";
                }
                const postDate = tpl.nextRunDate;
                const open = await (0, money_1.fiscalPeriodIsOpenOrMissing)(tenantId, postDate);
                if (!open) {
                    // Skip past the locked period rather than hammering it nightly.
                    txn.update(ref, {
                        nextRunDate: advanceMonthlyRunDate(postDate, tpl.dayOfMonth || 1),
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    v2_1.logger.warn("Recurring journal skipped locked fiscal period", { tenantId, templateId, postDate });
                    return "period_locked";
                }
                const [yearStr, monthStr] = postDate.split("-");
                const year = Number(yearStr);
                const month = Number(monthStr);
                const entryNumber = await (0, money_1.allocateNextJournalEntryNumber)(tenantId, txn, year, todayTL);
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
                    postedAt: firestore_1.FieldValue.serverTimestamp(),
                    postedBy: "system",
                    fiscalYear: year,
                    fiscalPeriod: month,
                    createdBy: "system",
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
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
                        createdAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                }
                txn.update(ref, {
                    nextRunDate: advanceMonthlyRunDate(postDate, tpl.dayOfMonth || 1),
                    lastRunDate: postDate,
                    lastEntryNumber: entryNumber,
                    postedCount: (tpl.postedCount || 0) + 1,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                return "posted";
            });
            if (result === "posted") {
                posted++;
                continue;
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
                const next = tplDoc.data().nextRunDate;
                if (!next || next > todayTL)
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