"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendQueuedEmail = void 0;
/**
 * Transactional email sender.
 *
 * Fires on new docs in the `mail` collection (the existing queue written by
 * adminService, invoiceService, etc.) and sends them via Resend, then writes
 * the delivery status back onto the doc.
 *
 * Mail doc shape (Trigger-Email compatible):
 *   { to: string | string[], subject, html?, text?, from?, replyTo?, status }
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
        from: data.from || DEFAULT_FROM,
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
//# sourceMappingURL=email.js.map