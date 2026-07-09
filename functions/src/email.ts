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
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// reply.rezerva.tl is the verified Resend domain (until xefe.tl is set up).
const DEFAULT_FROM = "Xefe <noreply@reply.rezerva.tl>";

export const sendQueuedEmail = onDocumentCreated(
  { document: "mail/{mailId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as Record<string, unknown>;

    // Only process freshly-queued docs; ignore anything already handled.
    if (data.status && data.status !== "pending") return;

    const to = Array.isArray(data.to)
      ? (data.to as string[]).filter(Boolean)
      : data.to
        ? [data.to as string]
        : [];
    if (to.length === 0) {
      await snap.ref.update({ status: "ERROR", error: "No recipient", attemptedAt: FieldValue.serverTimestamp() });
      return;
    }

    const html = typeof data.html === "string" ? data.html : undefined;
    const text = typeof data.text === "string" ? data.text : undefined;
    if (!html && !text) {
      await snap.ref.update({ status: "ERROR", error: "No html or text body", attemptedAt: FieldValue.serverTimestamp() });
      return;
    }

    const payload: Record<string, unknown> = {
      from: (data.from as string) || DEFAULT_FROM,
      to,
      subject: (data.subject as string) || "(no subject)",
    };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (typeof data.replyTo === "string") payload.reply_to = data.replyTo;
    if (typeof data.cc !== "undefined") payload.cc = data.cc;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

      if (!res.ok) {
        console.error("Resend send failed:", res.status, body);
        await snap.ref.update({
          status: "ERROR",
          error: (body.message || `HTTP ${res.status}`).slice(0, 500),
          attemptedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      await snap.ref.update({
        status: "SENT",
        providerId: body.id ?? null,
        sentAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Resend send threw:", error);
      await snap.ref.update({
        status: "ERROR",
        error: (error as Error).message.slice(0, 500),
        attemptedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);
