import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  isSuperAdmin,
  requireAuth,
  requireTenantAdmin,
  requireTenantRoles,
} from "./authz";

type PartnerId = "primos-boot";
type ConnectionStatus =
  | "requested"
  | "accepted"
  | "connected"
  | "declined"
  | "cancelled"
  | "revoked";

interface PartnerDefinition {
  id: PartnerId;
  tenantId: string;
  name: string;
  accessEmail: string;
  connectionRequestsOpen: boolean;
}

const PARTNERS: Record<PartnerId, PartnerDefinition> = {
  "primos-boot": {
    id: "primos-boot",
    tenantId: "primos-boot",
    name: "Primos Bo'ot",
    accessEmail: "info@primosboot.com",
    connectionRequestsOpen: false,
  },
};

const ACCOUNTANT_MODULES = [
  "staff",
  "timeleave",
  "payroll",
  "money",
  "accounting",
  "reports",
] as const;

function getPartner(value: unknown): PartnerDefinition {
  if (typeof value !== "string" || !(value in PARTNERS)) {
    throw new HttpsError("invalid-argument", "Unknown accountant partner");
  }
  return PARTNERS[value as PartnerId];
}

function requireConnectionRequestsOpen(partner: PartnerDefinition): void {
  if (!partner.connectionRequestsOpen) {
    throw new HttpsError(
      "failed-precondition",
      `${partner.name} connections are not open yet. No request was sent.`,
    );
  }
}

function requestId(partnerId: PartnerId, tenantId: string): string {
  return `${partnerId}__${tenantId}`;
}

function getPartnerByTenantId(tenantId: string): PartnerDefinition | null {
  return Object.values(PARTNERS).find((partner) => partner.tenantId === tenantId) ?? null;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timestampIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function claimMap(existingClaims: Record<string, unknown>): Record<string, string> {
  const existing = existingClaims.tenants || {};
  return Array.isArray(existing)
    ? Object.fromEntries(existing.map((tenantId: string) => [tenantId, "member"]))
    : { ...(existing as Record<string, string>) };
}

async function queueMail(input: {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  createdBy: string;
  replyTo?: string;
}): Promise<void> {
  const normalizedRecipient = input.to.trim().toLowerCase();
  const blockedPartner = Object.values(PARTNERS).find(
    (partner) =>
      !partner.connectionRequestsOpen &&
      partner.accessEmail.toLowerCase() === normalizedRecipient,
  );
  if (blockedPartner) {
    logger.warn("Blocked pre-launch accountant partner email", {
      partnerId: blockedPartner.id,
      purpose: "accountant-partner-connection",
    });
    return;
  }

  const bilingualFooter = `
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="font-size:12px;color:#6b7280">This message was sent by Xefe for an accountant-partner connection.<br>Mensajen ne'e Xefe haruka ba ligasaun ho parseiru kontabilidade.</p>`;
  await getFirestore().collection("mail").add({
    tenantId: input.tenantId,
    to: [input.to],
    subject: input.subject,
    html: `${input.html}${bilingualFooter}`,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.createdBy,
    purpose: "accountant-partner-connection",
  });
}

async function writePartnerAudit(input: {
  tenantId: string;
  actorUid: string;
  actorEmail?: unknown;
  action: string;
  description: string;
  partner: PartnerDefinition;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getFirestore().collection(`tenants/${input.tenantId}/auditLogs`).add({
      userId: input.actorUid,
      userEmail: typeof input.actorEmail === "string" ? input.actorEmail : "",
      action: input.action,
      module: "accounting",
      description: input.description,
      timestamp: FieldValue.serverTimestamp(),
      tenantId: input.tenantId,
      entityId: input.partner.id,
      entityType: "accountantPartner",
      severity: input.severity ?? "info",
      metadata: {
        partnerId: input.partner.id,
        partnerName: input.partner.name,
        ...(input.metadata ?? {}),
      },
    });
  } catch (error) {
    logger.warn("Failed to write accountant partner audit entry", error);
  }
}

async function requirePartnerTeamAccess(
  partner: PartnerDefinition,
  authContext: { uid: string; token: Record<string, unknown> },
): Promise<void> {
  if (await isSuperAdmin(authContext.uid, authContext.token)) return;
  await requireTenantRoles(
    partner.tenantId,
    authContext.uid,
    ["owner", "hr-admin", "accountant"],
    "Only the accounting partner team can view these requests",
  );
}

export const requestAccountantPartnerConnection = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { tenantId, partnerId } = (request.data ?? {}) as {
    tenantId?: string;
    partnerId?: PartnerId;
  };
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId is required");
  const partner = getPartner(partnerId);
  if (tenantId === partner.tenantId) {
    throw new HttpsError("invalid-argument", "A partner cannot request itself");
  }
  await requireTenantAdmin(tenantId, authContext.uid);
  requireConnectionRequestsOpen(partner);

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const partnerRequestRef = db
    .collection("accountantPartnerRequests")
    .doc(requestId(partner.id, tenantId));
  const [tenantSnap, existingRequest] = await Promise.all([
    tenantRef.get(),
    partnerRequestRef.get(),
  ]);
  if (!tenantSnap.exists) throw new HttpsError("not-found", "Tenant not found");

  const existingStatus = existingRequest.data()?.status as ConnectionStatus | undefined;
  if (["requested", "accepted", "connected"].includes(existingStatus ?? "")) {
    return { status: existingStatus };
  }

  const user = await getAuth().getUser(authContext.uid);
  const tenantName = String(tenantSnap.data()?.name || tenantId);
  const requesterEmail = user.email || "";
  const requesterName = user.displayName || requesterEmail || "Xefe customer";
  const now = FieldValue.serverTimestamp();

  await Promise.all([
    partnerRequestRef.set({
      partnerId: partner.id,
      partnerName: partner.name,
      partnerTenantId: partner.tenantId,
      tenantId,
      tenantName,
      requesterUid: authContext.uid,
      requesterName,
      requesterEmail,
      status: "requested",
      requestedAt: now,
      updatedAt: now,
    }),
    tenantRef.update({
      accountantPartner: {
        partnerId: partner.id,
        partnerName: partner.name,
        status: "requested",
        requestedBy: authContext.uid,
        requestedAt: now,
      },
      updatedAt: now,
    }),
  ]);

  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: "accountant.connection_requested",
    description: `${partner.name} consultation requested. No record access granted.`,
    partner,
  });

  try {
    await Promise.all([
      queueMail({
        tenantId,
        to: partner.accessEmail,
        replyTo: requesterEmail || undefined,
        subject: `Xefe client request — ${tenantName}`,
        createdBy: authContext.uid,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6">
            <h2>${esc(tenantName)} would like to work with ${esc(partner.name)}</h2>
            <p>${esc(requesterName)} selected ${esc(partner.name)} through Xefe.</p>
            <p>This is a consultation request only. No company, payroll or accounting records have been shared.</p>
            <p>Sign in to the ${esc(partner.name)} Xefe workspace to accept or decline the request.</p>
          </div>`,
      }),
      requesterEmail
        ? queueMail({
            tenantId,
            to: requesterEmail,
            subject: `Your request to ${partner.name}`,
            createdBy: authContext.uid,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6">
                <h2>Your request has been sent</h2>
                <p>${esc(partner.name)} will review the request and contact you about scope, fees and timing.</p>
                <p>They cannot see your Xefe records unless you later grant access explicitly.</p>
              </div>`,
          })
        : Promise.resolve(),
    ]);
  } catch (error) {
    logger.warn("Accountant partner request saved, but notification email failed", error);
  }

  return { status: "requested" as const };
});

export const cancelAccountantPartnerConnection = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { tenantId, partnerId } = (request.data ?? {}) as {
    tenantId?: string;
    partnerId?: PartnerId;
  };
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId is required");
  const partner = getPartner(partnerId);
  await requireTenantAdmin(tenantId, authContext.uid);

  const db = getFirestore();
  const ref = db.collection("accountantPartnerRequests").doc(requestId(partner.id, tenantId));
  const snap = await ref.get();
  const status = snap.data()?.status as ConnectionStatus | undefined;
  if (status === "connected") {
    throw new HttpsError("failed-precondition", "Revoke connected access instead");
  }

  const now = FieldValue.serverTimestamp();
  await Promise.all([
    ref.set({ status: "cancelled", updatedAt: now, cancelledBy: authContext.uid }, { merge: true }),
    db.collection("tenants").doc(tenantId).update({
      "accountantPartner.status": "cancelled",
      updatedAt: now,
    }),
  ]);
  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: "accountant.connection_cancelled",
    description: `${partner.name} consultation request cancelled.`,
    partner,
    severity: "warning",
  });
  return { status: "cancelled" as const };
});

export const getAccountantPartnerPortfolio = onCall(async (request) => {
  const authContext = requireAuth(request);
  const partner = getPartner((request.data ?? {}).partnerId);
  await requirePartnerTeamAccess(partner, authContext);

  const snapshot = await getFirestore()
    .collection("accountantPartnerRequests")
    .where("partnerId", "==", partner.id)
    .limit(100)
    .get();

  const items = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        requestId: doc.id,
        tenantId: String(data.tenantId || ""),
        tenantName: String(data.tenantName || data.tenantId || ""),
        partnerId: partner.id,
        status: data.status as ConnectionStatus,
        requesterName: typeof data.requesterName === "string" ? data.requesterName : undefined,
        requesterEmail: typeof data.requesterEmail === "string" ? data.requesterEmail : undefined,
        requestedAt: timestampIso(data.requestedAt),
        updatedAt: timestampIso(data.updatedAt),
      };
    })
    .sort((a, b) => (b.updatedAt || b.requestedAt || "").localeCompare(a.updatedAt || a.requestedAt || ""));

  return { items };
});

export const respondToAccountantPartnerRequest = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { requestId: id, decision } = (request.data ?? {}) as {
    requestId?: string;
    decision?: "accept" | "decline";
  };
  if (!id || !["accept", "decline"].includes(decision ?? "")) {
    throw new HttpsError("invalid-argument", "A valid request and decision are required");
  }

  const db = getFirestore();
  const ref = db.collection("accountantPartnerRequests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Connection request not found");
  const data = snap.data() || {};
  const partner = getPartner(data.partnerId);
  await requirePartnerTeamAccess(partner, authContext);
  requireConnectionRequestsOpen(partner);
  if (data.status !== "requested") {
    throw new HttpsError("failed-precondition", "This request has already been answered");
  }

  const status: ConnectionStatus = decision === "accept" ? "accepted" : "declined";
  const now = FieldValue.serverTimestamp();
  const tenantId = String(data.tenantId);
  await Promise.all([
    ref.update({ status, respondedBy: authContext.uid, respondedAt: now, updatedAt: now }),
    db.collection("tenants").doc(tenantId).update({
      "accountantPartner.status": status,
      ...(status === "accepted" ? { "accountantPartner.acceptedAt": now } : {}),
      updatedAt: now,
    }),
  ]);

  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: decision === "accept"
      ? "accountant.connection_accepted"
      : "accountant.connection_declined",
    description: decision === "accept"
      ? `${partner.name} accepted the consultation request. Record access is still not granted.`
      : `${partner.name} declined the consultation request.`,
    partner,
    severity: decision === "accept" ? "info" : "warning",
  });

  if (typeof data.requesterEmail === "string" && data.requesterEmail) {
    try {
      await queueMail({
        tenantId,
        to: data.requesterEmail,
        subject: decision === "accept"
          ? `${partner.name} accepted your Xefe request`
          : `${partner.name} responded to your Xefe request`,
        createdBy: authContext.uid,
        html: decision === "accept"
          ? `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6"><h2>${esc(partner.name)} accepted your request</h2><p>Agree the service scope and fees directly with the firm. When ready, the owner of ${esc(data.tenantName)} can grant their accountant access from Xefe settings.</p></div>`
          : `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6"><h2>Update from ${esc(partner.name)}</h2><p>The firm cannot accept this request at the moment. No Xefe access was granted.</p></div>`,
      });
    } catch (error) {
      logger.warn("Partner response saved, but notification email failed", error);
    }
  }

  return { status };
});

/**
 * Gives an individual member of the partner firm their own restricted client
 * membership after the business has approved the firm. This avoids shared
 * credentials while keeping the client's single consent boundary: access is
 * impossible until the request status is connected.
 */
export const activateAccountantPartnerClientAccess = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { requestId: id } = (request.data ?? {}) as { requestId?: string };
  if (!id) throw new HttpsError("invalid-argument", "requestId is required");

  const db = getFirestore();
  const ref = db.collection("accountantPartnerRequests").doc(id);
  const requestSnap = await ref.get();
  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Connection request not found");
  }
  const requestData = requestSnap.data() || {};
  const partner = getPartner(requestData.partnerId);
  await requirePartnerTeamAccess(partner, authContext);
  requireConnectionRequestsOpen(partner);
  if (requestData.status !== "connected") {
    throw new HttpsError(
      "failed-precondition",
      "The client has not granted accountant access",
    );
  }

  const tenantId = String(requestData.tenantId || "");
  const tenantName = String(requestData.tenantName || tenantId);
  if (!tenantId) throw new HttpsError("failed-precondition", "Client tenant is missing");

  const user = await getAuth().getUser(authContext.uid);
  const memberRef = db.collection(`tenants/${tenantId}/members`).doc(authContext.uid);
  const existingMember = await memberRef.get();
  if (
    existingMember.exists &&
    (existingMember.data()?.role !== "accountant" ||
      existingMember.data()?.partnerId !== partner.id)
  ) {
    throw new HttpsError(
      "already-exists",
      "This account already has different access to the client",
    );
  }

  const now = FieldValue.serverTimestamp();
  await Promise.all([
    memberRef.set({
      uid: authContext.uid,
      role: "accountant",
      modules: [...ACCOUNTANT_MODULES],
      email: user.email || null,
      displayName: user.displayName || user.email || partner.name,
      joinedAt: existingMember.exists
        ? existingMember.data()?.joinedAt || now
        : now,
      lastActiveAt: now,
      partnerId: partner.id,
      partnerTenantId: partner.tenantId,
    }, { merge: true }),
    db.collection("users").doc(authContext.uid).set({
      uid: authContext.uid,
      email: user.email || null,
      displayName: user.displayName || user.email || partner.name,
      tenantIds: FieldValue.arrayUnion(tenantId),
      tenantAccess: { [tenantId]: { name: tenantName, role: "accountant" } },
      updatedAt: now,
    }, { merge: true }),
    ref.update({
      accessUids: FieldValue.arrayUnion(authContext.uid),
      updatedAt: now,
    }),
  ]);

  const existingClaims = user.customClaims || {};
  const tenants = claimMap(existingClaims);
  tenants[tenantId] = "accountant";
  await getAuth().setCustomUserClaims(authContext.uid, {
    ...existingClaims,
    tenants,
  });

  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: "accountant.team_access_activated",
    description: `${partner.name} team member activated their restricted accountant access.`,
    partner,
    metadata: { accessUid: authContext.uid },
  });

  return { tenantId, tenantName, role: "accountant" as const };
});

export const grantAccountantPartnerAccess = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { tenantId, partnerId } = (request.data ?? {}) as {
    tenantId?: string;
    partnerId?: PartnerId;
  };
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId is required");
  const partner = getPartner(partnerId);
  await requireTenantRoles(
    tenantId,
    authContext.uid,
    ["owner"],
    "Only the business owner can grant accountant access",
  );
  requireConnectionRequestsOpen(partner);

  const db = getFirestore();
  const auth = getAuth();
  const ref = db.collection("accountantPartnerRequests").doc(requestId(partner.id, tenantId));
  const [requestSnap, tenantSnap] = await Promise.all([
    ref.get(),
    db.collection("tenants").doc(tenantId).get(),
  ]);
  if (!requestSnap.exists || requestSnap.data()?.status !== "accepted") {
    throw new HttpsError("failed-precondition", "The accounting firm must accept the request first");
  }
  if (!tenantSnap.exists) throw new HttpsError("not-found", "Tenant not found");

  let partnerUser;
  let isNewUser = false;
  try {
    partnerUser = await auth.getUserByEmail(partner.accessEmail);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    partnerUser = await auth.createUser({ email: partner.accessEmail, emailVerified: false });
    isNewUser = true;
  }

  const memberRef = db.collection(`tenants/${tenantId}/members`).doc(partnerUser.uid);
  const existingMember = await memberRef.get();
  if (existingMember.exists && existingMember.data()?.role !== "accountant") {
    throw new HttpsError("already-exists", "The partner account already has different tenant access");
  }

  const tenantName = String(tenantSnap.data()?.name || tenantId);
  const now = FieldValue.serverTimestamp();
  await Promise.all([
    memberRef.set({
      uid: partnerUser.uid,
      role: "accountant",
      modules: [...ACCOUNTANT_MODULES],
      email: partner.accessEmail,
      displayName: partner.name,
      joinedAt: now,
      lastActiveAt: now,
      partnerId: partner.id,
    }, { merge: true }),
    db.collection("users").doc(partnerUser.uid).set({
      uid: partnerUser.uid,
      email: partner.accessEmail,
      displayName: partner.name,
      tenantIds: FieldValue.arrayUnion(tenantId),
      tenantAccess: { [tenantId]: { name: tenantName, role: "accountant" } },
      updatedAt: now,
      ...(isNewUser ? { createdAt: now } : {}),
    }, { merge: true }),
  ]);

  const existingClaims = partnerUser.customClaims || {};
  const tenants = claimMap(existingClaims);
  tenants[tenantId] = "accountant";
  await auth.setCustomUserClaims(partnerUser.uid, { ...existingClaims, tenants });

  await Promise.all([
    ref.update({
      status: "connected",
      accessUid: partnerUser.uid,
      accessUids: FieldValue.arrayUnion(partnerUser.uid),
      connectedBy: authContext.uid,
      connectedAt: now,
      updatedAt: now,
    }),
    db.collection("tenants").doc(tenantId).update({
      "accountantPartner.status": "connected",
      "accountantPartner.accessUid": partnerUser.uid,
      "accountantPartner.connectedAt": now,
      updatedAt: now,
    }),
  ]);

  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: "accountant.access_granted",
    description: `${partner.name} was granted restricted accountant access.`,
    partner,
    severity: "warning",
    metadata: { accessUid: partnerUser.uid },
  });

  try {
    const resetLink = isNewUser
      ? await auth.generatePasswordResetLink(partner.accessEmail)
      : null;
    await queueMail({
      tenantId,
      to: partner.accessEmail,
      subject: `${tenantName} granted ${partner.name} access in Xefe`,
      createdBy: authContext.uid,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.6"><h2>Client access granted</h2><p>${esc(tenantName)} has granted ${esc(partner.name)} accountant access in Xefe.</p>${resetLink ? `<p><a href="${esc(resetLink)}">Set your Xefe password</a></p>` : "<p>Sign in to Xefe with the partner account to open the client workspace.</p>"}<p>The business can revoke access at any time.</p></div>`,
    });
  } catch (error) {
    logger.warn("Partner access granted, but notification email failed", error);
  }

  return { status: "connected" as const };
});

export const revokeAccountantPartnerAccess = onCall(async (request) => {
  const authContext = requireAuth(request);
  const { tenantId, partnerId } = (request.data ?? {}) as {
    tenantId?: string;
    partnerId?: PartnerId;
  };
  if (!tenantId) throw new HttpsError("invalid-argument", "tenantId is required");
  const partner = getPartner(partnerId);
  await requireTenantRoles(
    tenantId,
    authContext.uid,
    ["owner"],
    "Only the business owner can revoke accountant access",
  );

  const db = getFirestore();
  const auth = getAuth();
  const ref = db.collection("accountantPartnerRequests").doc(requestId(partner.id, tenantId));
  const requestSnap = await ref.get();
  if (!requestSnap.exists) throw new HttpsError("not-found", "Connection request not found");

  let accessUid = requestSnap.data()?.accessUid as string | undefined;
  if (!accessUid) {
    try {
      accessUid = (await auth.getUserByEmail(partner.accessEmail)).uid;
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
  }

  const linkedMembers = await db
    .collection(`tenants/${tenantId}/members`)
    .where("partnerId", "==", partner.id)
    .get();
  const removableUids = new Set(
    linkedMembers.docs
      .filter((doc) => doc.data().role === "accountant")
      .map((doc) => doc.id),
  );
  const recordedUids = requestSnap.data()?.accessUids;
  if (Array.isArray(recordedUids)) {
    for (const uid of recordedUids) {
      if (typeof uid === "string") removableUids.add(uid);
    }
  }
  if (accessUid) removableUids.add(accessUid);

  await Promise.all([...removableUids].map(async (uid) => {
    const memberRef = db.collection(`tenants/${tenantId}/members`).doc(uid);
    const memberSnap = await memberRef.get();
    if (
      memberSnap.exists &&
      (memberSnap.data()?.role !== "accountant" ||
        memberSnap.data()?.partnerId !== partner.id)
    ) {
      logger.warn("Skipping partner access removal for changed membership", {
        tenantId,
        uid,
        partnerId: partner.id,
      });
      return;
    }
    if (memberSnap.exists) await memberRef.delete();

    try {
      const user = await auth.getUser(uid);
      const existingClaims = user.customClaims || {};
      const tenants = claimMap(existingClaims);
      delete tenants[tenantId];
      await auth.setCustomUserClaims(uid, { ...existingClaims, tenants });
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }

    try {
      await db.collection("users").doc(uid).update({
        [`tenantAccess.${tenantId}`]: FieldValue.delete(),
        tenantIds: FieldValue.arrayRemove(tenantId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== 5) throw error;
    }
  }));

  const now = FieldValue.serverTimestamp();
  await Promise.all([
    ref.update({ status: "revoked", revokedBy: authContext.uid, revokedAt: now, updatedAt: now }),
    db.collection("tenants").doc(tenantId).update({
      "accountantPartner.status": "revoked",
      "accountantPartner.accessUid": FieldValue.delete(),
      updatedAt: now,
    }),
  ]);

  await writePartnerAudit({
    tenantId,
    actorUid: authContext.uid,
    actorEmail: authContext.token.email,
    action: "accountant.access_revoked",
    description: `${partner.name} accountant access was revoked.`,
    partner,
    severity: "critical",
    metadata: { removedUsers: removableUids.size },
  });

  return { status: "revoked" as const };
});

/**
 * If a person leaves the Primos Bo'ot tenant, remove every client membership
 * they obtained through that firm. Client consent is to the firm and its
 * current team, not a permanent personal entitlement.
 */
export const removeDepartedAccountantPartnerAccess = onDocumentDeleted(
  "tenants/{tenantId}/members/{uid}",
  async (event) => {
    const partnerTenantId = String(event.params.tenantId || "");
    const uid = String(event.params.uid || "");
    const partner = getPartnerByTenantId(partnerTenantId);
    if (!partner || !uid) return;

    const db = getFirestore();
    const requests = await db
      .collection("accountantPartnerRequests")
      .where("partnerId", "==", partner.id)
      .limit(100)
      .get();
    const connected = requests.docs.filter(
      (doc) => doc.data().status === "connected" && doc.data().tenantId,
    );

    const removedTenantIds: string[] = [];
    for (const requestDoc of connected) {
      const clientTenantId = String(requestDoc.data().tenantId);
      const clientMemberRef = db
        .collection(`tenants/${clientTenantId}/members`)
        .doc(uid);
      const clientMember = await clientMemberRef.get();
      if (
        !clientMember.exists ||
        clientMember.data()?.role !== "accountant" ||
        clientMember.data()?.partnerId !== partner.id
      ) {
        continue;
      }

      await Promise.all([
        clientMemberRef.delete(),
        requestDoc.ref.update({
          accessUids: FieldValue.arrayRemove(uid),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
      removedTenantIds.push(clientTenantId);
      await writePartnerAudit({
        tenantId: clientTenantId,
        actorUid: "system",
        action: "accountant.team_access_removed",
        description: `${partner.name} team access was removed after a member left the firm workspace.`,
        partner,
        severity: "critical",
        metadata: { accessUid: uid },
      });
    }

    if (removedTenantIds.length === 0) return;

    try {
      const user = await getAuth().getUser(uid);
      const existingClaims = user.customClaims || {};
      const tenants = claimMap(existingClaims);
      for (const tenantId of removedTenantIds) delete tenants[tenantId];
      await getAuth().setCustomUserClaims(uid, { ...existingClaims, tenants });
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }

    try {
      const profileUpdates: Record<string, unknown> = {
        tenantIds: FieldValue.arrayRemove(...removedTenantIds),
        updatedAt: FieldValue.serverTimestamp(),
      };
      for (const tenantId of removedTenantIds) {
        profileUpdates[`tenantAccess.${tenantId}`] = FieldValue.delete();
      }
      await db.collection("users").doc(uid).update(profileUpdates);
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== 5) throw error;
    }
  },
);
