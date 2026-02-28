/**
 * Admin Cloud Functions
 * Handles superadmin claims sync and admin-only operations
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";

/**
 * Sync isSuperAdmin field to Firebase Auth custom claims
 * Triggered when a user document is created or updated
 */
export const syncSuperadminClaims = onDocumentWritten(
  "users/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Check if this is a delete operation
    if (!afterData) {
      logger.info(`User ${uid} was deleted, removing custom claims`);
      try {
        const auth = getAuth();
        await auth.setCustomUserClaims(uid, {});
      } catch (error) {
        logger.error(`Failed to remove claims for deleted user ${uid}:`, error);
      }
      return;
    }

    const wasSuperAdmin = beforeData?.isSuperAdmin === true;
    const isSuperAdmin = afterData?.isSuperAdmin === true;

    // Only update claims if the superadmin status changed
    if (wasSuperAdmin === isSuperAdmin) {
      logger.debug(`No change in superadmin status for user ${uid}`);
      return;
    }

    try {
      const auth = getAuth();
      const user = await auth.getUser(uid);
      const existingClaims = user.customClaims || {};

      const newClaims = {
        ...existingClaims,
        superadmin: isSuperAdmin,
      };

      await auth.setCustomUserClaims(uid, newClaims);
      logger.info(`Updated superadmin claim for user ${uid} to ${isSuperAdmin}`);

      // Log this action to admin audit log
      const db = getFirestore();
      await db.collection("adminAuditLog").add({
        action: isSuperAdmin ? "superadmin_granted" : "superadmin_revoked",
        targetUserId: uid,
        targetEmail: afterData.email,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          previousValue: wasSuperAdmin,
          newValue: isSuperAdmin,
        },
        triggeredBy: "system",
      });

    } catch (error) {
      logger.error(`Failed to sync superadmin claims for user ${uid}:`, error);
      throw error;
    }
  }
);

/**
 * Set a user as superadmin (callable only by existing superadmins)
 */
export const setSuperadmin = onCall(async (request) => {
  // Validate caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const callerUid = request.auth.uid;
  const { targetUid, isSuperAdmin } = request.data as { targetUid: string; isSuperAdmin: boolean };

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Target user ID is required");
  }

  const db = getFirestore();
  const auth = getAuth();

  try {
    // Verify caller is a superadmin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();

    const callerToken = request.auth.token;
    const callerIsSuperAdmin =
      callerToken.superadmin === true ||
      callerData?.isSuperAdmin === true;

    if (!callerIsSuperAdmin) {
      throw new HttpsError("permission-denied", "Only superadmins can modify superadmin status");
    }

    // Prevent removing your own superadmin status
    if (callerUid === targetUid && !isSuperAdmin) {
      throw new HttpsError("invalid-argument", "Cannot remove your own superadmin status");
    }

    // Get target user info
    const targetUser = await auth.getUser(targetUid);
    const targetDoc = await db.collection("users").doc(targetUid).get();

    // Update the user document (this will trigger syncSuperadminClaims)
    await db.collection("users").doc(targetUid).set(
      {
        isSuperAdmin,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Log the action
    await db.collection("adminAuditLog").add({
      action: isSuperAdmin ? "superadmin_granted" : "superadmin_revoked",
      targetUserId: targetUid,
      targetEmail: targetUser.email,
      performedBy: callerUid,
      performedByEmail: callerData?.email || request.auth.token.email,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        previousValue: targetDoc.data()?.isSuperAdmin || false,
        newValue: isSuperAdmin,
      },
    });

    logger.info(`Superadmin ${callerUid} set ${targetUid} isSuperAdmin=${isSuperAdmin}`);

    return {
      success: true,
      message: isSuperAdmin
        ? `User ${targetUser.email} is now a superadmin`
        : `Superadmin status removed from ${targetUser.email}`,
    };

  } catch (error: any) {
    logger.error("Failed to set superadmin status:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", `Failed to update superadmin status: ${error.message}`);
  }
});

/**
 * Get all users with their profiles (superadmin only)
 */
export const getAllUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();

  try {
    // Verify caller is a superadmin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();

    const callerToken = request.auth.token;
    const callerIsSuperAdmin =
      callerToken.superadmin === true ||
      callerData?.isSuperAdmin === true;

    if (!callerIsSuperAdmin) {
      throw new HttpsError("permission-denied", "Only superadmins can view all users");
    }

    // Get all user documents
    const usersSnapshot = await db.collection("users").get();
    const auth = getAuth();

    const users = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        let authUser = null;

        try {
          authUser = await auth.getUser(doc.id);
        } catch (error) {
          logger.warn(`Could not find auth user for ${doc.id}`);
        }

        return {
          uid: doc.id,
          ...userData,
          email: authUser?.email || userData.email,
          displayName: authUser?.displayName || userData.displayName,
          photoURL: authUser?.photoURL || userData.photoURL,
          emailVerified: authUser?.emailVerified,
          disabled: authUser?.disabled,
          lastSignInTime: authUser?.metadata?.lastSignInTime,
          creationTime: authUser?.metadata?.creationTime,
        };
      })
    );

    return { users };

  } catch (error: any) {
    logger.error("Failed to get all users:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", `Failed to get users: ${error.message}`);
  }
});

/**
 * Suspend a tenant (superadmin only)
 */
export const suspendTenantFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const callerUid = request.auth.uid;
  const { tenantId, reason } = request.data as { tenantId: string; reason: string };

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Tenant ID is required");
  }

  const db = getFirestore();

  try {
    // Verify caller is a superadmin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();

    const callerToken = request.auth.token;
    const callerIsSuperAdmin =
      callerToken.superadmin === true ||
      callerData?.isSuperAdmin === true;

    if (!callerIsSuperAdmin) {
      throw new HttpsError("permission-denied", "Only superadmins can suspend tenants");
    }

    // Get tenant
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new HttpsError("not-found", "Tenant not found");
    }

    // Update tenant status
    await db.collection("tenants").doc(tenantId).update({
      status: "suspended",
      suspendedAt: FieldValue.serverTimestamp(),
      suspendedBy: callerUid,
      suspendedReason: reason || "No reason provided",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Log the action
    await db.collection("adminAuditLog").add({
      action: "tenant_suspended",
      tenantId,
      tenantName: tenantDoc.data()?.name,
      performedBy: callerUid,
      performedByEmail: callerData?.email,
      timestamp: FieldValue.serverTimestamp(),
      details: { reason },
    });

    logger.info(`Tenant ${tenantId} suspended by ${callerUid}`);

    return {
      success: true,
      message: `Tenant ${tenantDoc.data()?.name} has been suspended`,
    };

  } catch (error: any) {
    logger.error("Failed to suspend tenant:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", `Failed to suspend tenant: ${error.message}`);
  }
});

/**
 * Reactivate a suspended tenant (superadmin only)
 */
export const reactivateTenantFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const callerUid = request.auth.uid;
  const { tenantId } = request.data as { tenantId: string };

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Tenant ID is required");
  }

  const db = getFirestore();

  try {
    // Verify caller is a superadmin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();

    const callerToken = request.auth.token;
    const callerIsSuperAdmin =
      callerToken.superadmin === true ||
      callerData?.isSuperAdmin === true;

    if (!callerIsSuperAdmin) {
      throw new HttpsError("permission-denied", "Only superadmins can reactivate tenants");
    }

    // Get tenant
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new HttpsError("not-found", "Tenant not found");
    }

    // Update tenant status
    await db.collection("tenants").doc(tenantId).update({
      status: "active",
      suspendedAt: FieldValue.delete(),
      suspendedBy: FieldValue.delete(),
      suspendedReason: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Log the action
    await db.collection("adminAuditLog").add({
      action: "tenant_reactivated",
      tenantId,
      tenantName: tenantDoc.data()?.name,
      performedBy: callerUid,
      performedByEmail: callerData?.email,
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`Tenant ${tenantId} reactivated by ${callerUid}`);

    return {
      success: true,
      message: `Tenant ${tenantDoc.data()?.name} has been reactivated`,
    };

  } catch (error: any) {
    logger.error("Failed to reactivate tenant:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", `Failed to reactivate tenant: ${error.message}`);
  }
});

/**
 * Bootstrap the first superadmin account
 * Can only be called once — checks _bootstrap/initialized
 * Uses Admin SDK to bypass Firestore rules
 */
export const bootstrapFirstAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const callerUid = request.auth.uid;
  const callerEmail = request.auth.token.email;
  const { companyName, companySlug } = request.data as {
    companyName?: string;
    companySlug?: string;
  };

  if (!companyName || !companySlug) {
    throw new HttpsError("invalid-argument", "Company name and slug are required");
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(companySlug) || companySlug.length > 50) {
    throw new HttpsError("invalid-argument", "Invalid company slug format");
  }

  const db = getFirestore();
  const auth = getAuth();

  // Check if bootstrap has already occurred
  const bootstrapDoc = await db.doc("_bootstrap/initialized").get();
  if (bootstrapDoc.exists) {
    throw new HttpsError("already-exists", "System has already been bootstrapped");
  }

  try {
    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // Double-check inside transaction
      const bootstrapRef = db.doc("_bootstrap/initialized");
      const bootstrapSnap = await transaction.get(bootstrapRef);
      if (bootstrapSnap.exists) {
        throw new HttpsError("already-exists", "System has already been bootstrapped");
      }

      const userRef = db.doc(`users/${callerUid}`);
      const tenantRef = db.doc(`tenants/${companySlug}`);
      const memberRef = db.doc(`tenants/${companySlug}/members/${callerUid}`);

      // 1. Create/update user profile as superadmin
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists) {
        transaction.update(userRef, {
          isSuperAdmin: true,
          tenantIds: [...(userSnap.data()?.tenantIds || []), companySlug].filter(
            (v: string, i: number, a: string[]) => a.indexOf(v) === i
          ),
          tenantAccess: {
            ...(userSnap.data()?.tenantAccess || {}),
            [companySlug]: { name: companyName, role: "owner" },
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(userRef, {
          uid: callerUid,
          email: callerEmail,
          displayName: callerEmail?.split("@")[0] || "Admin",
          isSuperAdmin: true,
          tenantIds: [companySlug],
          tenantAccess: {
            [companySlug]: { name: companyName, role: "owner" },
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 2. Create tenant
      transaction.set(tenantRef, {
        id: companySlug,
        name: companyName,
        slug: companySlug,
        status: "active",
        plan: "professional",
        limits: { employees: 100, members: 20, storage: 10 },
        createdBy: callerUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        billingEmail: callerEmail,
        features: {
          hiring: true,
          timeleave: true,
          performance: true,
          payroll: true,
          money: true,
          accounting: true,
          reports: true,
        },
        settings: {
          timezone: "Asia/Dili",
          currency: "USD",
          dateFormat: "DD/MM/YYYY",
        },
      });

      // 3. Create owner membership
      transaction.set(memberRef, {
        uid: callerUid,
        email: callerEmail,
        displayName: callerEmail?.split("@")[0] || "Admin",
        role: "owner",
        modules: ["hiring", "staff", "timeleave", "performance", "payroll", "money", "accounting", "reports"],
        joinedAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
        permissions: { admin: true, write: true, read: true },
      });

      // 4. Mark bootstrap as complete
      transaction.set(bootstrapRef, {
        initializedAt: FieldValue.serverTimestamp(),
        initializedBy: callerUid,
        initializedEmail: callerEmail,
      });
    });

    // Set custom claims (outside transaction — Auth API is not transactional)
    const existingUser = await auth.getUser(callerUid);
    const existingClaims = existingUser.customClaims || {};
    await auth.setCustomUserClaims(callerUid, {
      ...existingClaims,
      superadmin: true,
      tenants: { ...(existingClaims.tenants || {}), [companySlug]: "owner" },
    });

    logger.info(`Bootstrap complete: ${callerEmail} is now superadmin of ${companyName}`);

    return {
      success: true,
      message: `Bootstrap complete. You are now superadmin of ${companyName}.`,
    };
  } catch (error: any) {
    logger.error("Bootstrap failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Bootstrap failed: ${error.message}`);
  }
});
