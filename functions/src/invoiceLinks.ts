/**
 * Public invoice link triggers.
 *
 * The hosted invoice page (/i/:token) lets an unauthenticated customer stamp
 * `viewedAt` on invoice_links/{token} exactly once (enforced by rules). This
 * trigger propagates that stamp onto the tenant's real invoice so the owner
 * sees "viewed" in the app — clients can't write tenant invoices themselves.
 */
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const db = getFirestore();

export const onInvoiceLinkViewed = onDocumentUpdated("invoice_links/{token}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  // Only the null -> timestamp transition matters.
  if (before.viewedAt || !(after.viewedAt instanceof Timestamp)) return;

  const tenantId = after.tenantId;
  const invoiceId = after.invoiceId;
  if (typeof tenantId !== "string" || typeof invoiceId !== "string") return;

  const invoiceRef = db.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(invoiceRef);
      if (!snap.exists) return;
      const invoice = snap.data() as { status?: string; viewedAt?: unknown };
      if (invoice.viewedAt) return;

      tx.update(invoiceRef, {
        viewedAt: after.viewedAt,
        ...(invoice.status === "sent" ? { status: "viewed" } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    logger.error("Failed to propagate invoice link view", {
      tenantId,
      invoiceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
