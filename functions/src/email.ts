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
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// xefe.tl is verified in Resend (account-level), so all queued mail sends from
// the branded Xefe address. Per-message `from` overrides still win when set.
const DEFAULT_FROM = "Xefe <noreply@xefe.tl>";
// Customer-facing business mail (invoices, reminders, receipts) sends as
// "{Business} via Xefe" from this address.
const BUSINESS_FROM_ADDRESS = "invoices@xefe.tl";

/** "Lele Café" -> "Lele Café via Xefe <invoices@xefe.tl>" (header-safe). */
function businessFrom(fromName: unknown): string | null {
  if (typeof fromName !== "string") return null;
  const name = fromName.replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
  if (!name) return null;
  return `${name} via Xefe <${BUSINESS_FROM_ADDRESS}>`;
}

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

    // The sender is ALWAYS derived server-side. A client-supplied `from` is
    // ignored: honoring it let any tenant manager send DKIM-signed mail from an
    // arbitrary @xefe.tl address (spoofing/phishing). Branding still works via
    // the sanitized fromName ("{Business} via Xefe <invoices@xefe.tl>").
    const payload: Record<string, unknown> = {
      from: businessFrom(data.fromName) || DEFAULT_FROM,
      to,
      subject: (data.subject as string) || "(no subject)",
    };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (typeof data.replyTo === "string") payload.reply_to = data.replyTo;
    // `cc` is intentionally not forwarded from the doc — no sanctioned caller
    // sets it, and honoring it added an unbounded extra recipient list.

    // Attachments: {filename, url|content} → Resend {filename, path|content}.
    // (Previously ignored — payslip PDFs never actually rode along.)
    if (Array.isArray(data.attachments)) {
      const attachments = (data.attachments as Array<Record<string, unknown>>)
        .map((a) => {
          if (typeof a?.filename !== "string") return null;
          if (typeof a.url === "string" && a.url) return { filename: a.filename, path: a.url };
          if (typeof a.content === "string" && a.content) return { filename: a.filename, content: a.content };
          return null;
        })
        .filter(Boolean);
      if (attachments.length > 0) payload.attachments = attachments;
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

/**
 * Mirror the provider result onto the invoice so the app distinguishes
 * "queued" from actually sent and exposes a useful retry when delivery fails.
 */
export const syncInvoiceDeliveryStatus = onDocumentUpdated(
  "mail/{mailId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || after.purpose !== "invoice") return;
    if (before.status === after.status) return;
    if (after.status !== "SENT" && after.status !== "ERROR") return;

    const tenantId =
      typeof after.tenantId === "string" ? after.tenantId : "";
    const invoiceId =
      typeof after.relatedId === "string" ? after.relatedId : "";
    const deliveryAttemptId =
      typeof after.deliveryAttemptId === "string"
        ? after.deliveryAttemptId
        : "";
    if (!tenantId || !invoiceId || !deliveryAttemptId) return;

    const update =
      after.status === "SENT"
        ? {
            deliveryStatus: "sent",
            deliveryError: FieldValue.delete(),
            emailSentAt: after.sentAt || FieldValue.serverTimestamp(),
            deliveryUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }
        : {
            deliveryStatus: "failed",
            deliveryError:
              typeof after.error === "string"
                ? after.error.slice(0, 500)
                : "Email delivery failed",
            deliveryUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

    const invoiceRef = getFirestore().doc(
      `tenants/${tenantId}/invoices/${invoiceId}`,
    );
    await getFirestore().runTransaction(async (transaction) => {
      const invoice = await transaction.get(invoiceRef);
      if (!invoice.exists) return;
      if (invoice.data()?.deliveryAttemptId !== deliveryAttemptId) return;
      transaction.update(invoiceRef, update);
    });
  },
);
