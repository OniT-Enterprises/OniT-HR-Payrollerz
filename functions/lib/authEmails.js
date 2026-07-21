"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = exports.sendWelcomeEmail = void 0;
/**
 * Branded account emails (welcome + verification, password reset).
 *
 * These queue documents on the `mail` collection, which `sendQueuedEmail`
 * (see ./email.ts) delivers via Resend. They deliberately do NOT set a `from`
 * address, so they inherit the DEFAULT_FROM sender and re-brand automatically
 * when that flips to noreply@xefe.tl.
 *
 * Firebase's own action links (verify email / reset password) are generated
 * server-side with the Admin SDK so the customer never sees an unbranded
 * firebaseapp.com email — mirrors the invited-member flow in ./tenant.ts.
 */
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const firebase_functions_1 = require("firebase-functions");
const authz_1 = require("./authz");
// Host split 2026-07-21: the authenticated app lives on app.xefe.tl
// (app.xefe.tl must be in Firebase authorized domains).
const APP_URL = "https://app.xefe.tl";
const BRAND = "#6A9C29";
// Where Firebase's hosted action handler sends the user after they verify their
// email / finish a password reset. xefe.tl is in Firebase's authorized domains.
const ACTION_CONTINUE = { url: `${APP_URL}/auth/login`, handleCodeInApp: false };
/** Escape the small set of HTML-significant characters for interpolation. */
function esc(value) {
    return (value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}
/**
 * Wrap body content in the shared Xefe email shell: green header wordmark,
 * white card, optional primary button. Kept inline + table-free-ish so it
 * survives the usual email clients.
 */
function renderBrandedEmail(opts) {
    const button = opts.ctaLabel && opts.ctaUrl
        ? `<p style="margin:24px 0;">
           <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${esc(opts.ctaLabel)}</a>
         </p>`
        : "";
    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;">
      <div style="background:${BRAND};border-radius:8px 8px 0 0;padding:20px 28px;">
        <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Xefe</span>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(opts.heading)}</h1>
        ${opts.bodyHtml}
        ${button}
        <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">
          If you were not expecting this email, you can safely ignore it.
        </p>
      </div>
    </div>`;
}
/**
 * Send a branded "welcome to Xefe" email to the freshly-signed-up owner.
 * Called by the client right after provisioning succeeds (email signup and
 * Google onboarding both flow through provisionOrganization). If the account
 * is not yet email-verified (password signups), a verification link is folded
 * into the same email so we never send two messages.
 *
 * Idempotent per user: a `welcomeEmailSentAt` marker on the user profile stops
 * a repeat send if the client retries or the owner creates a second org.
 */
exports.sendWelcomeEmail = (0, https_1.onCall)(async (request) => {
    var _a;
    const { uid } = (0, authz_1.requireAuth)(request);
    const { tenantName } = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;
    if (!email) {
        // Phone-only or otherwise email-less accounts have nothing to send to.
        return { sent: false };
    }
    // Idempotency guard — skip if we've already welcomed this user.
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.get("welcomeEmailSentAt")) {
        return { sent: false };
    }
    const displayName = userRecord.displayName || "";
    const greeting = displayName ? `Hi ${esc(displayName.split(" ")[0])},` : "Hi,";
    const orgLine = tenantName
        ? `<p style="margin:0 0 12px;">Your workspace <strong>${esc(tenantName)}</strong> is ready.</p>`
        : "";
    let html;
    let text;
    const subject = "Welcome to Xefe";
    if (!userRecord.emailVerified) {
        // Password signup — generate a verification link and fold it in.
        let verifyLink;
        try {
            verifyLink = await auth.generateEmailVerificationLink(email, ACTION_CONTINUE);
        }
        catch (error) {
            firebase_functions_1.logger.error("Failed to generate email verification link:", error);
            // Still send a plain welcome rather than nothing.
            verifyLink = "";
        }
        const verifyBlock = verifyLink
            ? `<p style="margin:0 0 4px;">Please confirm your email address to secure your account:</p>`
            : "";
        html = renderBrandedEmail({
            heading: "Welcome to Xefe 👋",
            bodyHtml: `
          <p style="margin:0 0 12px;">${greeting}</p>
          ${orgLine}
          <p style="margin:0 0 12px;">Xefe helps you run HR, payroll, and invoicing for your business in Timor-Leste — all in one place.</p>
          ${verifyBlock}
        `,
            ctaLabel: verifyLink ? "Verify my email" : "Open Xefe",
            ctaUrl: verifyLink || APP_URL,
        });
        text = [
            greeting,
            "",
            tenantName ? `Your workspace ${tenantName} is ready.` : "",
            "Welcome to Xefe — HR, payroll, and invoicing for your business in Timor-Leste.",
            "",
            verifyLink ? `Verify your email: ${verifyLink}` : `Open Xefe: ${APP_URL}`,
        ]
            .filter(Boolean)
            .join("\n");
    }
    else {
        // Already verified (e.g. Google) — welcome only.
        html = renderBrandedEmail({
            heading: "Welcome to Xefe 👋",
            bodyHtml: `
          <p style="margin:0 0 12px;">${greeting}</p>
          ${orgLine}
          <p style="margin:0 0 12px;">Xefe helps you run HR, payroll, and invoicing for your business in Timor-Leste — all in one place.</p>
          <p style="margin:0 0 12px;">You're all set. Jump in whenever you're ready.</p>
        `,
            ctaLabel: "Open Xefe",
            ctaUrl: APP_URL,
        });
        text = [
            greeting,
            "",
            tenantName ? `Your workspace ${tenantName} is ready.` : "",
            "Welcome to Xefe — HR, payroll, and invoicing for your business in Timor-Leste.",
            "",
            `Open Xefe: ${APP_URL}`,
        ]
            .filter(Boolean)
            .join("\n");
    }
    await db.collection("mail").add({
        tenantId: "platform",
        to: [email],
        subject,
        html,
        text,
        status: "pending",
        purpose: "welcome",
        createdBy: uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Mark as sent so retries / second-org creation don't re-welcome.
    await userRef.set({ welcomeEmailSentAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return { sent: true };
});
/** Per-email cool-down (ms) between branded reset emails to curb inbox spam. */
const RESET_THROTTLE_MS = 60000;
/** Per-IP burst limit: at most N reset requests per source IP per window. The
 *  per-email throttle alone does nothing against an attacker rotating target
 *  addresses from one host to mass-send reset mail. */
const RESET_IP_WINDOW_MS = 10 * 60000;
// TL mobile carriers put many subscribers behind one CGNAT address, so this
// cap must leave headroom for legitimate neighbours sharing an IP (the
// callable always reports success, so a starved user gets no signal). The
// per-email throttle stays the abuse backstop for any single inbox.
const RESET_IP_MAX = 20;
/** Deterministic, path-safe doc id for the throttle record of an email. */
function throttleId(email) {
    return Buffer.from(email.toLowerCase())
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "");
}
/** Best-effort client IP from the onCall raw request. Every x-forwarded-for
 *  entry is attacker-suppliable EXCEPT the one Google's front end APPENDS from
 *  the actual connection, so only the LAST hop can key a rate limit — the
 *  first hop would hand a spoofed header a fresh bucket per request. Falls
 *  back to the socket ip when the header is absent. */
function clientIp(request) {
    var _a, _b, _c;
    const fwd = (_b = (_a = request.rawRequest) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b["x-forwarded-for"];
    const header = Array.isArray(fwd)
        ? fwd.join(",")
        : typeof fwd === "string"
            ? fwd
            : "";
    const hops = header
        .split(",")
        .map((hop) => hop.trim())
        .filter(Boolean);
    return hops[hops.length - 1] || ((_c = request.rawRequest) === null || _c === void 0 ? void 0 : _c.ip) || "unknown";
}
function ipThrottleId(ip) {
    return Buffer.from(ip).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
}
/**
 * Fixed-window per-IP limiter. Returns true if this request is WITHIN the limit
 * (allowed), false if the IP has exceeded RESET_IP_MAX in the current window.
 * Atomic so concurrent bursts can't all slip through.
 */
async function ipWithinResetLimit(db, ip) {
    const ref = db.collection("passwordResetIpThrottle").doc(ipThrottleId(ip));
    return db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(ref);
        const now = Date.now();
        // expiresAt drives the Firestore TTL policy that garbage-collects stale
        // throttle docs (windowStart is a plain number, which TTL can't target).
        // Kept well past the window so TTL deletion never races a live window.
        const expiresAt = firestore_1.Timestamp.fromMillis(now + 24 * 60 * 60000);
        const windowStart = (_a = snap.get("windowStart")) !== null && _a !== void 0 ? _a : 0;
        const count = (_b = snap.get("count")) !== null && _b !== void 0 ? _b : 0;
        if (now - windowStart > RESET_IP_WINDOW_MS) {
            tx.set(ref, { windowStart: now, count: 1, expiresAt });
            return true;
        }
        if (count >= RESET_IP_MAX) {
            return false;
        }
        tx.set(ref, { count: count + 1, expiresAt }, { merge: true });
        return true;
    });
}
/**
 * Queue a branded password-reset email. Unauthenticated by design (it powers
 * the "forgot password" screen). To avoid leaking which emails have accounts,
 * it always resolves with { success: true } regardless of whether the user
 * exists. A short per-email throttle limits how fast a single inbox can be
 * targeted.
 */
exports.requestPasswordReset = (0, https_1.onCall)(async (request) => {
    var _a;
    const raw = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    const email = (raw.email || "").trim().toLowerCase();
    // Basic shape check — real validation happens against the auth backend.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "A valid email is required");
    }
    const db = (0, firestore_1.getFirestore)();
    // Per-IP burst limit first (curbs email-bombing across rotating addresses).
    // Over the limit → succeed silently, same as every other guard here, so we
    // never leak rate-limit state or account existence.
    if (!(await ipWithinResetLimit(db, clientIp(request)))) {
        return { success: true };
    }
    const throttleRef = db.collection("passwordResetThrottle").doc(throttleId(email));
    // Throttle: bail quietly if we sent to this address very recently.
    const throttleSnap = await throttleRef.get();
    const lastSent = throttleSnap.exists
        ? throttleSnap.get("lastSentAt")
        : undefined;
    if (lastSent && Date.now() - lastSent.toMillis() < RESET_THROTTLE_MS) {
        return { success: true };
    }
    let resetLink;
    try {
        resetLink = await (0, auth_1.getAuth)().generatePasswordResetLink(email, ACTION_CONTINUE);
    }
    catch (error) {
        const code = error === null || error === void 0 ? void 0 : error.code;
        // Unknown/disabled account: succeed silently (no account enumeration).
        if (code === "auth/user-not-found" || code === "auth/email-not-found") {
            return { success: true };
        }
        firebase_functions_1.logger.error("Failed to generate password reset link:", error);
        throw new https_1.HttpsError("internal", "Could not process the request");
    }
    await db.collection("mail").add({
        tenantId: "platform",
        to: [email],
        subject: "Reset your Xefe password",
        html: renderBrandedEmail({
            heading: "Reset your password",
            bodyHtml: `
          <p style="margin:0 0 12px;">We received a request to reset the password for your Xefe account.</p>
          <p style="margin:0 0 4px;">Click the button below to choose a new password. This link expires shortly.</p>
        `,
            ctaLabel: "Reset password",
            ctaUrl: resetLink,
        }),
        text: [
            "Reset your Xefe password",
            "",
            "We received a request to reset the password for your Xefe account.",
            `Reset your password: ${resetLink}`,
            "",
            "If you did not request this, you can safely ignore this email.",
        ].join("\n"),
        status: "pending",
        purpose: "password-reset",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await throttleRef.set({ lastSentAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return { success: true };
});
//# sourceMappingURL=authEmails.js.map