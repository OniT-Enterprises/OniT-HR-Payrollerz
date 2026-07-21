"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncInvoiceDeliveryStatus = exports.sendQueuedEmail = void 0;
/**
 * Transactional email sender.
 *
 * Fires on new docs in the `mail` collection (the existing queue written by
 * adminService, invoiceService, etc.) and sends them via Resend, then writes
 * the delivery status back onto the doc.
 *
 * Mail doc shape (Trigger-Email compatible):
 *   { to: string | string[], subject, html?, text?, from?, replyTo?, status,
 *     fromName?, attachments?: [{ filename, url? | content?, contentType? }] }
 *
 * `fromName` renders as "{fromName} via Xefe <invoices@xefe.tl>" — the
 * address itself is fixed here so tenants can brand but never spoof.
 *
 * Secret (set with `firebase functions:secrets:set`):
 *   RESEND_API_KEY — Resend API key (re_...)
 */
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-admin/firestore");
const RESEND_API_KEY = (0, params_1.defineSecret)("RESEND_API_KEY");
// xefe.tl is verified in Resend (account-level), so all queued mail sends from
// the branded Xefe address. Per-message `from` overrides still win when set.
const DEFAULT_FROM = "Xefe <noreply@xefe.tl>";
// Customer-facing business mail (invoices, reminders, receipts) sends as
// "{Business} via Xefe" from this address.
const BUSINESS_FROM_ADDRESS = "invoices@xefe.tl";
/** "Lele Café" -> "Lele Café via Xefe <invoices@xefe.tl>" (header-safe). */
function businessFrom(fromName) {
    if (typeof fromName !== "string")
        return null;
    const name = fromName.replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
    if (!name)
        return null;
    return `${name} via Xefe <${BUSINESS_FROM_ADDRESS}>`;
}
exports.sendQueuedEmail = (0, firestore_1.onDocumentCreated)({ document: "mail/{mailId}", secrets: [RESEND_API_KEY] }, async (event) => {
    var _a;
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    // Only process freshly-queued docs; ignore anything already handled.
    if (data.status && data.status !== "pending")
        return;
    const to = Array.isArray(data.to)
        ? data.to.filter(Boolean)
        : data.to
            ? [data.to]
            : [];
    if (to.length === 0) {
        await snap.ref.update({ status: "ERROR", error: "No recipient", attemptedAt: firestore_2.FieldValue.serverTimestamp() });
        return;
    }
    const html = typeof data.html === "string" ? data.html : undefined;
    const text = typeof data.text === "string" ? data.text : undefined;
    if (!html && !text) {
        await snap.ref.update({ status: "ERROR", error: "No html or text body", attemptedAt: firestore_2.FieldValue.serverTimestamp() });
        return;
    }
    const payload = {
        from: data.from || businessFrom(data.fromName) || DEFAULT_FROM,
        to,
        subject: data.subject || "(no subject)",
    };
    if (html)
        payload.html = html;
    if (text)
        payload.text = text;
    if (typeof data.replyTo === "string")
        payload.reply_to = data.replyTo;
    if (typeof data.cc !== "undefined")
        payload.cc = data.cc;
    // Attachments: {filename, url|content} → Resend {filename, path|content}.
    // (Previously ignored — payslip PDFs never actually rode along.)
    if (Array.isArray(data.attachments)) {
        const attachments = data.attachments
            .map((a) => {
            if (typeof (a === null || a === void 0 ? void 0 : a.filename) !== "string")
                return null;
            if (typeof a.url === "string" && a.url)
                return { filename: a.filename, path: a.url };
            if (typeof a.content === "string" && a.content)
                return { filename: a.filename, content: a.content };
            return null;
        })
            .filter(Boolean);
        if (attachments.length > 0)
            payload.attachments = attachments;
    }
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY.value()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({})));
        if (!res.ok) {
            console.error("Resend send failed:", res.status, body);
            await snap.ref.update({
                status: "ERROR",
                error: (body.message || `HTTP ${res.status}`).slice(0, 500),
                attemptedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            return;
        }
        await snap.ref.update({
            status: "SENT",
            providerId: (_a = body.id) !== null && _a !== void 0 ? _a : null,
            sentAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error("Resend send threw:", error);
        await snap.ref.update({
            status: "ERROR",
            error: error.message.slice(0, 500),
            attemptedAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
});
/**
 * Mirror the provider result onto the invoice so the app distinguishes
 * "queued" from actually sent and exposes a useful retry when delivery fails.
 */
exports.syncInvoiceDeliveryStatus = (0, firestore_1.onDocumentUpdated)("mail/{mailId}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after || after.purpose !== "invoice")
        return;
    if (before.status === after.status)
        return;
    if (after.status !== "SENT" && after.status !== "ERROR")
        return;
    const tenantId = typeof after.tenantId === "string" ? after.tenantId : "";
    const invoiceId = typeof after.relatedId === "string" ? after.relatedId : "";
    const deliveryAttemptId = typeof after.deliveryAttemptId === "string"
        ? after.deliveryAttemptId
        : "";
    if (!tenantId || !invoiceId || !deliveryAttemptId)
        return;
    const update = after.status === "SENT"
        ? {
            deliveryStatus: "sent",
            deliveryError: firestore_2.FieldValue.delete(),
            emailSentAt: after.sentAt || firestore_2.FieldValue.serverTimestamp(),
            deliveryUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }
        : {
            deliveryStatus: "failed",
            deliveryError: typeof after.error === "string"
                ? after.error.slice(0, 500)
                : "Email delivery failed",
            deliveryUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
    const invoiceRef = (0, firestore_2.getFirestore)().doc(`tenants/${tenantId}/invoices/${invoiceId}`);
    await (0, firestore_2.getFirestore)().runTransaction(async (transaction) => {
        var _a;
        const invoice = await transaction.get(invoiceRef);
        if (!invoice.exists)
            return;
        if (((_a = invoice.data()) === null || _a === void 0 ? void 0 : _a.deliveryAttemptId) !== deliveryAttemptId)
            return;
        transaction.update(invoiceRef, update);
    });
});
//# sourceMappingURL=email.js.map