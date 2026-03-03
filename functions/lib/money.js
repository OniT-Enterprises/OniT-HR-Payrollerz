"use strict";
/**
 * Money Module Cloud Functions
 *
 * Scheduled processor for recurring invoices:
 * - Finds due recurring invoice templates per tenant
 * - Generates invoices (draft by default)
 * - Optionally auto-marks as sent
 *
 * Note: This runs with Admin SDK privileges (bypasses Firestore rules).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRecurringInvoices = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const crypto_1 = __importDefault(require("crypto"));
const db = (0, firestore_1.getFirestore)();
// ────────────────────────────────────────────
// Date helpers (Timor-Leste, UTC+9)
// ────────────────────────────────────────────
const TL_TIMEZONE = "Asia/Dili";
function formatDateISO_TL(date) {
    return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: TL_TIMEZONE,
    }).format(date);
}
function getTodayTL() {
    return formatDateISO_TL(new Date());
}
function parseDateISO(dateString) {
    // Anchor at noon UTC to keep the calendar day stable across timezones.
    // This matches the client-side approach in packages/shared/src/lib/dateUtils.ts.
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
function addDaysISO(dateString, days) {
    const dt = parseDateISO(dateString);
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().split("T")[0];
}
// ────────────────────────────────────────────
// Money helpers (2dp rounding)
// ────────────────────────────────────────────
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function multiplyMoney(a, b) {
    return round2(a * b);
}
function sumMoney(values) {
    return round2(values.reduce((sum, v) => sum + v, 0));
}
function percentOf(value, percent) {
    return round2((value * percent) / 100);
}
function addMoney(a, b) {
    return round2(a + b);
}
function calculateNextRunDate(currentDate, frequency) {
    const source = parseDateISO(currentDate);
    const sourceYear = source.getUTCFullYear();
    const sourceMonth = source.getUTCMonth();
    const sourceDay = source.getUTCDate();
    const sourceMonthLastDay = new Date(Date.UTC(sourceYear, sourceMonth + 1, 0)).getUTCDate();
    const keepEndOfMonth = sourceDay === sourceMonthLastDay;
    if (frequency === "weekly") {
        return addDaysISO(currentDate, 7);
    }
    const target = new Date(source.getTime());
    switch (frequency) {
        case "monthly":
            target.setUTCMonth(target.getUTCMonth() + 1);
            break;
        case "quarterly":
            target.setUTCMonth(target.getUTCMonth() + 3);
            break;
        case "yearly":
            target.setUTCFullYear(target.getUTCFullYear() + 1);
            break;
    }
    const targetYear = target.getUTCFullYear();
    const targetMonth = target.getUTCMonth();
    const targetMonthLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const day = keepEndOfMonth ? targetMonthLastDay : Math.min(sourceDay, targetMonthLastDay);
    const normalized = new Date(Date.UTC(targetYear, targetMonth, day, 12, 0, 0));
    return normalized.toISOString().split("T")[0];
}
function genShareToken() {
    const bytes = crypto_1.default.randomBytes(24);
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (const b of bytes)
        out += chars[b % chars.length];
    return out;
}
function pad3(n) {
    return String(n).padStart(3, "0");
}
function pad4(n) {
    return String(n).padStart(4, "0");
}
// ────────────────────────────────────────────
// Firestore helpers
// ────────────────────────────────────────────
async function tenantHasAnyAccounts(tenantId) {
    const snap = await db.collection(`tenants/${tenantId}/accounts`).limit(1).get();
    return !snap.empty;
}
async function getAccountByCode(tenantId, code) {
    const snap = await db
        .collection(`tenants/${tenantId}/accounts`)
        .where("code", "==", code)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    const data = doc.data();
    return { id: doc.id, name: data.name || code };
}
async function fiscalPeriodIsOpenOrMissing(tenantId, dateISO) {
    const dt = parseDateISO(dateISO);
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth() + 1;
    const snap = await db
        .collection(`tenants/${tenantId}/fiscalPeriods`)
        .where("year", "==", year)
        .where("period", "==", month)
        .limit(1)
        .get();
    if (snap.empty)
        return true; // Backwards compatible: periods not configured
    const period = snap.docs[0].data();
    return period.status === "open";
}
/**
 * Allocate the next invoice number (mirrors client invoiceService.getNextInvoiceNumber()).
 */
async function allocateNextInvoiceNumber(tenantId, transaction, todayTL) {
    const settingsRef = db.doc(`tenants/${tenantId}/settings/invoice_settings`);
    const settingsSnap = await transaction.get(settingsRef);
    const year = parseInt(todayTL.slice(0, 4), 10);
    let prefix = "INV";
    let number = 1;
    if (!settingsSnap.exists) {
        transaction.set(settingsRef, {
            prefix: "INV",
            nextNumber: 2,
            defaultTaxRate: 0,
            defaultTerms: "Payment due within 30 days",
            defaultNotes: "Thank you for your business",
            defaultDueDays: 30,
            companyName: "",
            companyAddress: "",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    else {
        const data = settingsSnap.data();
        prefix = data.prefix || "INV";
        number = typeof data.nextNumber === "number" && data.nextNumber > 0 ? Math.floor(data.nextNumber) : 1;
        transaction.update(settingsRef, {
            nextNumber: number + 1,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return `${prefix}-${year}-${pad3(number)}`;
}
/**
 * Allocate the next journal entry number (mirrors client journalEntryService.getNextEntryNumber()).
 */
async function allocateNextJournalEntryNumber(tenantId, transaction, journalYear, todayTL) {
    const settingsRef = db.doc(`tenants/${tenantId}/settings/accounting`);
    const settingsSnap = await transaction.get(settingsRef);
    const currentYear = parseInt(todayTL.slice(0, 4), 10);
    let prefix = "JE";
    let nextNum = 1;
    if (settingsSnap.exists) {
        const data = settingsSnap.data();
        prefix = data.journalEntryPrefix || "JE";
        const byYear = data.nextJournalNumberByYear || {};
        const yearKey = String(journalYear);
        const fromYearCounter = byYear[yearKey];
        if (typeof fromYearCounter === "number" && fromYearCounter > 0) {
            nextNum = Math.floor(fromYearCounter);
        }
        else if (journalYear === currentYear &&
            typeof data.nextJournalNumber === "number" &&
            data.nextJournalNumber > 0) {
            nextNum = Math.floor(data.nextJournalNumber);
        }
        transaction.set(settingsRef, {
            journalEntryPrefix: prefix,
            nextJournalNumber: journalYear === currentYear ? nextNum + 1 : data.nextJournalNumber || 1,
            nextJournalNumberByYear: Object.assign(Object.assign({}, byYear), { [yearKey]: nextNum + 1 }),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    else {
        transaction.set(settingsRef, {
            journalEntryPrefix: "JE",
            nextJournalNumber: journalYear === currentYear ? 2 : 1,
            nextJournalNumberByYear: {
                [String(journalYear)]: 2,
            },
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return `${prefix}-${journalYear}-${pad4(nextNum)}`;
}
async function processRecurringInvoiceDoc(tenantId, recurringId, todayTL, resolvedAccounts) {
    const maxCatchUp = 6; // prevent runaway generation if nextRunDate is far in the past
    let generated = 0;
    let sent = 0;
    let journalPosted = 0;
    let skippedJournal = 0;
    let autoSendErrors = 0;
    for (let i = 0; i < maxCatchUp; i++) {
        const res = await db.runTransaction(async (transaction) => {
            const recurringRef = db.doc(`tenants/${tenantId}/recurring_invoices/${recurringId}`);
            const recurringSnap = await transaction.get(recurringRef);
            if (!recurringSnap.exists) {
                return { action: "missing" };
            }
            const recurring = recurringSnap.data();
            if (recurring.status !== "active")
                return { action: "skip" };
            if (!recurring.nextRunDate || recurring.nextRunDate > todayTL)
                return { action: "not_due" };
            // End conditions (same as client)
            if (recurring.endDate && recurring.nextRunDate > recurring.endDate) {
                transaction.update(recurringRef, { status: "completed", updatedAt: firestore_1.FieldValue.serverTimestamp() });
                return { action: "completed" };
            }
            const generatedCount = typeof recurring.generatedCount === "number" ? recurring.generatedCount : 0;
            if (recurring.endAfterOccurrences && generatedCount >= recurring.endAfterOccurrences) {
                transaction.update(recurringRef, { status: "completed", updatedAt: firestore_1.FieldValue.serverTimestamp() });
                return { action: "completed" };
            }
            const issueDate = recurring.nextRunDate;
            const dueDays = typeof recurring.dueDays === "number" && recurring.dueDays > 0 ? recurring.dueDays : 30;
            const dueDate = addDaysISO(issueDate, dueDays);
            // Fetch customer (best-effort)
            let customerName = recurring.customerName || "";
            let customerEmail = recurring.customerEmail || undefined;
            let customerPhone;
            let customerAddress;
            if (typeof recurring.customerId === "string" && recurring.customerId) {
                const customerRef = db.doc(`tenants/${tenantId}/customers/${recurring.customerId}`);
                const customerSnap = await transaction.get(customerRef);
                if (customerSnap.exists) {
                    const c = customerSnap.data();
                    if (c.name)
                        customerName = c.name;
                    if (c.email)
                        customerEmail = c.email;
                    customerPhone = c.phone;
                    customerAddress = c.address;
                }
            }
            const invoiceNumber = await allocateNextInvoiceNumber(tenantId, transaction, todayTL);
            const shareToken = genShareToken();
            const itemsIn = Array.isArray(recurring.items) ? recurring.items : [];
            const items = itemsIn.map((item, idx) => {
                const qty = typeof item.quantity === "number" ? item.quantity : 0;
                const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : 0;
                return {
                    id: `item_${Date.now()}_${idx}`,
                    description: String(item.description || "").trim(),
                    quantity: qty,
                    unitPrice: unitPrice,
                    amount: multiplyMoney(qty, unitPrice),
                };
            });
            const subtotal = sumMoney(items.map((it) => it.amount));
            const taxRate = typeof recurring.taxRate === "number" ? recurring.taxRate : 0;
            const taxAmount = percentOf(subtotal, taxRate);
            const total = addMoney(subtotal, taxAmount);
            const autoSendRequested = recurring.autoSend === true;
            const invoiceRef = db.collection(`tenants/${tenantId}/invoices`).doc();
            const invoicePayload = {
                invoiceNumber,
                customerId: recurring.customerId || null,
                customerName,
                customerEmail: customerEmail || null,
                customerPhone: customerPhone || null,
                customerAddress: customerAddress || null,
                issueDate,
                dueDate,
                items,
                subtotal,
                taxRate,
                taxAmount,
                total,
                status: "draft",
                amountPaid: 0,
                balanceDue: total,
                notes: recurring.notes || null,
                terms: recurring.terms || null,
                currency: "USD",
                shareToken,
                recurringInvoiceId: recurringId,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            transaction.set(invoiceRef, invoicePayload);
            // Update recurring template
            const nextRunDate = calculateNextRunDate(issueDate, recurring.frequency);
            const newCount = generatedCount + 1;
            const shouldComplete = (recurring.endAfterOccurrences && newCount >= recurring.endAfterOccurrences) ||
                (recurring.endDate && nextRunDate > recurring.endDate);
            transaction.update(recurringRef, {
                nextRunDate,
                generatedCount: newCount,
                lastGeneratedAt: firestore_1.FieldValue.serverTimestamp(),
                lastInvoiceId: invoiceRef.id,
                status: shouldComplete ? "completed" : "active",
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return {
                action: "generated",
                invoiceId: invoiceRef.id,
                autoSendRequested,
            };
        });
        if (res.action !== "generated") {
            break;
        }
        generated += 1;
        if (res.autoSendRequested) {
            try {
                const sendRes = await attemptAutoSendInvoice(tenantId, res.invoiceId, todayTL, resolvedAccounts);
                if (sendRes.sent)
                    sent += 1;
                if (sendRes.journalCreated)
                    journalPosted += 1;
                if (sendRes.journalSkipped)
                    skippedJournal += 1;
            }
            catch (err) {
                autoSendErrors += 1;
                v2_1.logger.error("Auto-send failed for recurring invoice", {
                    tenantId,
                    recurringId,
                    invoiceId: res.invoiceId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }
    return { generated, sent, journalPosted, skippedJournal, autoSendErrors };
}
async function attemptAutoSendInvoice(tenantId, invoiceId, todayTL, resolvedAccounts) {
    return db.runTransaction(async (transaction) => {
        const invoiceRef = db.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
        const invoiceSnap = await transaction.get(invoiceRef);
        if (!invoiceSnap.exists) {
            throw new Error("Invoice not found");
        }
        const invoice = invoiceSnap.data();
        if (invoice.status === "cancelled" || invoice.cancelledAt) {
            return { sent: false, journalCreated: false, journalSkipped: false };
        }
        // Already handled (manual send, retry, etc.)
        if (invoice.status && invoice.status !== "draft") {
            return { sent: true, journalCreated: false, journalSkipped: false };
        }
        // If accounting isn't set up, still mark as sent (matches client markAsSent behavior).
        if (!resolvedAccounts.hasAccounts) {
            transaction.update(invoiceRef, {
                status: "sent",
                sentAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { sent: true, journalCreated: false, journalSkipped: true };
        }
        const ar = resolvedAccounts.ar;
        const revenue = resolvedAccounts.revenue;
        if (!(ar === null || ar === void 0 ? void 0 : ar.id) || !(revenue === null || revenue === void 0 ? void 0 : revenue.id)) {
            throw new Error("Chart of accounts missing required accounts (1210/4100)");
        }
        const issueDate = typeof invoice.issueDate === "string" ? invoice.issueDate : null;
        if (!issueDate) {
            throw new Error("Invoice is missing issueDate");
        }
        const isOpen = await fiscalPeriodIsOpenOrMissing(tenantId, issueDate);
        if (!isOpen) {
            throw new Error(`Fiscal period is not open for ${issueDate}`);
        }
        const total = typeof invoice.total === "number" ? invoice.total : 0;
        const invoiceNumber = invoice.invoiceNumber || invoiceId;
        const customerName = invoice.customerName || "";
        const year = parseDateISO(issueDate).getUTCFullYear();
        const month = parseDateISO(issueDate).getUTCMonth() + 1;
        const entryNumber = await allocateNextJournalEntryNumber(tenantId, transaction, year, todayTL);
        const journalRef = db.collection(`tenants/${tenantId}/journalEntries`).doc();
        const lines = [
            {
                lineNumber: 1,
                accountId: ar.id,
                accountCode: "1210",
                accountName: ar.name,
                debit: total,
                credit: 0,
                description: `AR - ${invoiceNumber}`,
            },
            {
                lineNumber: 2,
                accountId: revenue.id,
                accountCode: "4100",
                accountName: revenue.name,
                debit: 0,
                credit: total,
                description: `Revenue - ${invoiceNumber}`,
            },
        ];
        transaction.set(journalRef, {
            entryNumber,
            date: issueDate,
            description: `Invoice ${invoiceNumber} - ${customerName}`,
            source: "invoice",
            sourceId: invoiceId,
            sourceRef: invoiceNumber,
            lines,
            totalDebit: total,
            totalCredit: total,
            status: "posted",
            postedAt: firestore_1.FieldValue.serverTimestamp(),
            postedBy: "system",
            fiscalYear: year,
            fiscalPeriod: month,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        for (const line of lines) {
            const glRef = db.collection(`tenants/${tenantId}/generalLedger`).doc();
            transaction.set(glRef, {
                accountId: line.accountId,
                accountCode: line.accountCode,
                accountName: line.accountName,
                journalEntryId: journalRef.id,
                entryNumber,
                entryDate: issueDate,
                description: line.description,
                debit: line.debit,
                credit: line.credit,
                balance: 0,
                fiscalYear: year,
                fiscalPeriod: month,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        transaction.update(invoiceRef, {
            status: "sent",
            sentAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            journalEntryId: journalRef.id,
        });
        return { sent: true, journalCreated: true, journalSkipped: false };
    });
}
// =====================================================================
// Scheduled Function: Process recurring invoices
// =====================================================================
/**
 * Runs daily in TL timezone.
 * Generates invoices from active recurring templates whose nextRunDate <= today (TL).
 */
exports.processRecurringInvoices = (0, scheduler_1.onSchedule)({
    schedule: "15 0 * * *", // 00:15 every day
    timeZone: TL_TIMEZONE,
    region: "asia-southeast1",
}, async () => {
    const todayTL = getTodayTL();
    v2_1.logger.info("Starting recurring invoice processing", { todayTL });
    const tenantsSnap = await db.collection("tenants").get();
    if (tenantsSnap.empty) {
        v2_1.logger.info("No tenants found; skipping recurring invoice processing");
        return;
    }
    let tenantsProcessed = 0;
    let templatesProcessed = 0;
    let invoicesGenerated = 0;
    let invoicesSent = 0;
    let journalsPosted = 0;
    let journalsSkipped = 0;
    let autoSendErrors = 0;
    let errors = 0;
    for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data();
        if (tenantData.status && tenantData.status !== "active") {
            continue;
        }
        try {
            // Resolve accounting accounts once per tenant
            const hasAccounts = await tenantHasAnyAccounts(tenantId);
            const [ar, revenue] = hasAccounts
                ? await Promise.all([
                    getAccountByCode(tenantId, "1210"),
                    getAccountByCode(tenantId, "4100"),
                ])
                : [null, null];
            const recurringSnap = await db
                .collection(`tenants/${tenantId}/recurring_invoices`)
                .where("status", "==", "active")
                .get();
            if (recurringSnap.empty)
                continue;
            tenantsProcessed += 1;
            for (const recurringDoc of recurringSnap.docs) {
                const recurring = recurringDoc.data();
                if (!recurring.nextRunDate || recurring.nextRunDate > todayTL)
                    continue;
                templatesProcessed += 1;
                const out = await processRecurringInvoiceDoc(tenantId, recurringDoc.id, todayTL, { hasAccounts, ar, revenue });
                invoicesGenerated += out.generated;
                invoicesSent += out.sent;
                journalsPosted += out.journalPosted;
                journalsSkipped += out.skippedJournal;
                autoSendErrors += out.autoSendErrors;
            }
        }
        catch (err) {
            errors += 1;
            v2_1.logger.error("Recurring invoice processing failed for tenant", {
                tenantId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    v2_1.logger.info("Recurring invoice processing finished", {
        todayTL,
        tenantsProcessed,
        templatesProcessed,
        invoicesGenerated,
        invoicesSent,
        journalsPosted,
        journalsSkipped,
        autoSendErrors,
        errors,
    });
});
//# sourceMappingURL=money.js.map