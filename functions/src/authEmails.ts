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
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { requireAuth } from "./authz";

const APP_URL = "https://xefe.tl";
const BRAND = "#6A9C29";

/** Escape the small set of HTML-significant characters for interpolation. */
function esc(value: string | undefined | null): string {
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
function renderBrandedEmail(opts: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const button =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:24px 0;">
           <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${esc(
             opts.ctaLabel,
           )}</a>
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

interface WelcomeEmailResponse {
  sent: boolean;
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
export const sendWelcomeEmail = onCall(
  async (request): Promise<WelcomeEmailResponse> => {
    const { uid } = requireAuth(request);
    const { tenantName } = (request.data ?? {}) as { tenantName?: string };

    const db = getFirestore();
    const auth = getAuth();

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
      ? `<p style="margin:0 0 12px;">Your workspace <strong>${esc(
          tenantName,
        )}</strong> is ready.</p>`
      : "";

    let html: string;
    let text: string;
    const subject = "Welcome to Xefe";

    if (!userRecord.emailVerified) {
      // Password signup — generate a verification link and fold it in.
      let verifyLink: string;
      try {
        verifyLink = await auth.generateEmailVerificationLink(email);
      } catch (error) {
        logger.error("Failed to generate email verification link:", error);
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
    } else {
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
      createdAt: FieldValue.serverTimestamp(),
    });

    // Mark as sent so retries / second-org creation don't re-welcome.
    await userRef.set(
      { welcomeEmailSentAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return { sent: true };
  },
);

/** Per-email cool-down (ms) between branded reset emails to curb inbox spam. */
const RESET_THROTTLE_MS = 60_000;

/** Deterministic, path-safe doc id for the throttle record of an email. */
function throttleId(email: string): string {
  return Buffer.from(email.toLowerCase())
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "");
}

interface PasswordResetResponse {
  success: boolean;
}

/**
 * Queue a branded password-reset email. Unauthenticated by design (it powers
 * the "forgot password" screen). To avoid leaking which emails have accounts,
 * it always resolves with { success: true } regardless of whether the user
 * exists. A short per-email throttle limits how fast a single inbox can be
 * targeted.
 */
export const requestPasswordReset = onCall(
  async (request): Promise<PasswordResetResponse> => {
    const raw = (request.data ?? {}) as { email?: string };
    const email = (raw.email || "").trim().toLowerCase();

    // Basic shape check — real validation happens against the auth backend.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "A valid email is required");
    }

    const db = getFirestore();
    const throttleRef = db.collection("passwordResetThrottle").doc(throttleId(email));

    // Throttle: bail quietly if we sent to this address very recently.
    const throttleSnap = await throttleRef.get();
    const lastSent = throttleSnap.exists
      ? (throttleSnap.get("lastSentAt") as FirebaseFirestore.Timestamp | undefined)
      : undefined;
    if (lastSent && Date.now() - lastSent.toMillis() < RESET_THROTTLE_MS) {
      return { success: true };
    }

    let resetLink: string;
    try {
      resetLink = await getAuth().generatePasswordResetLink(email);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // Unknown/disabled account: succeed silently (no account enumeration).
      if (code === "auth/user-not-found" || code === "auth/email-not-found") {
        return { success: true };
      }
      logger.error("Failed to generate password reset link:", error);
      throw new HttpsError("internal", "Could not process the request");
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
      createdAt: FieldValue.serverTimestamp(),
    });

    await throttleRef.set(
      { lastSentAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return { success: true };
  },
);
