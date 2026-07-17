"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onInvoiceLinkViewed = void 0;
/**
 * Public invoice link triggers.
 *
 * The hosted invoice page (/i/:token) lets an unauthenticated customer stamp
 * `viewedAt` on invoice_links/{token} exactly once (enforced by rules). This
 * trigger propagates that stamp onto the tenant's real invoice so the owner
 * sees "viewed" in the app — clients can't write tenant invoices themselves.
 */
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const db = (0, firestore_2.getFirestore)();
exports.onInvoiceLinkViewed = (0, firestore_1.onDocumentUpdated)("invoice_links/{token}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only the null -> timestamp transition matters.
    if (before.viewedAt || !(after.viewedAt instanceof firestore_2.Timestamp))
        return;
    const tenantId = after.tenantId;
    const invoiceId = after.invoiceId;
    if (typeof tenantId !== "string" || typeof invoiceId !== "string")
        return;
    const invoiceRef = db.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(invoiceRef);
            if (!snap.exists)
                return;
            const invoice = snap.data();
            if (invoice.viewedAt)
                return;
            tx.update(invoiceRef, Object.assign(Object.assign({ viewedAt: after.viewedAt }, (invoice.status === "sent" ? { status: "viewed" } : {})), { updatedAt: firestore_2.FieldValue.serverTimestamp() }));
        });
    }
    catch (error) {
        logger.error("Failed to propagate invoice link view", {
            tenantId,
            invoiceId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
//# sourceMappingURL=invoiceLinks.js.map