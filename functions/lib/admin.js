"use strict";
/**
 * Admin Cloud Functions
 * Handles superadmin claims sync and admin-only operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapFirstAdmin = exports.reactivateTenantFunction = exports.suspendTenantFunction = exports.getAllUsers = exports.setSuperadmin = exports.syncSuperadminClaims = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const firebase_functions_1 = require("firebase-functions");
/**
 * Sync isSuperAdmin field to Firebase Auth custom claims
 * Triggered when a user document is created or updated
 */
exports.syncSuperadminClaims = (0, firestore_1.onDocumentWritten)("users/{uid}", async (event) => {
    var _a, _b;
    const uid = event.params.uid;
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    // Check if this is a delete operation
    if (!afterData) {
        firebase_functions_1.logger.info(`User ${uid} was deleted, removing custom claims`);
        try {
            const auth = (0, auth_1.getAuth)();
            await auth.setCustomUserClaims(uid, {});
        }
        catch (error) {
            firebase_functions_1.logger.error(`Failed to remove claims for deleted user ${uid}:`, error);
        }
        return;
    }
    const wasSuperAdmin = (beforeData === null || beforeData === void 0 ? void 0 : beforeData.isSuperAdmin) === true;
    const isSuperAdmin = (afterData === null || afterData === void 0 ? void 0 : afterData.isSuperAdmin) === true;
    // Only update claims if the superadmin status changed
    if (wasSuperAdmin === isSuperAdmin) {
        firebase_functions_1.logger.debug(`No change in superadmin status for user ${uid}`);
        return;
    }
    try {
        const auth = (0, auth_1.getAuth)();
        const user = await auth.getUser(uid);
        const existingClaims = user.customClaims || {};
        const newClaims = Object.assign(Object.assign({}, existingClaims), { superadmin: isSuperAdmin });
        await auth.setCustomUserClaims(uid, newClaims);
        firebase_functions_1.logger.info(`Updated superadmin claim for user ${uid} to ${isSuperAdmin}`);
        // Log this action to admin audit log
        const db = (0, firestore_2.getFirestore)();
        await db.collection("adminAuditLog").add({
            action: isSuperAdmin ? "superadmin_granted" : "superadmin_revoked",
            targetUserId: uid,
            targetEmail: afterData.email,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
            details: {
                previousValue: wasSuperAdmin,
                newValue: isSuperAdmin,
            },
            triggeredBy: "system",
        });
    }
    catch (error) {
        firebase_functions_1.logger.error(`Failed to sync superadmin claims for user ${uid}:`, error);
        throw error;
    }
});
/**
 * Set a user as superadmin (callable only by existing superadmins)
 */
exports.setSuperadmin = (0, https_1.onCall)(async (request) => {
    var _a;
    // Validate caller is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const { targetUid, isSuperAdmin } = request.data;
    if (!targetUid) {
        throw new https_1.HttpsError("invalid-argument", "Target user ID is required");
    }
    const db = (0, firestore_2.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    try {
        // Verify caller is a superadmin
        const callerDoc = await db.collection("users").doc(callerUid).get();
        const callerData = callerDoc.data();
        const callerToken = request.auth.token;
        const callerIsSuperAdmin = callerToken.superadmin === true ||
            (callerData === null || callerData === void 0 ? void 0 : callerData.isSuperAdmin) === true;
        if (!callerIsSuperAdmin) {
            throw new https_1.HttpsError("permission-denied", "Only superadmins can modify superadmin status");
        }
        // Prevent removing your own superadmin status
        if (callerUid === targetUid && !isSuperAdmin) {
            throw new https_1.HttpsError("invalid-argument", "Cannot remove your own superadmin status");
        }
        // Get target user info
        const targetUser = await auth.getUser(targetUid);
        const targetDoc = await db.collection("users").doc(targetUid).get();
        // Update the user document (this will trigger syncSuperadminClaims)
        await db.collection("users").doc(targetUid).set({
            isSuperAdmin,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        // Log the action
        await db.collection("adminAuditLog").add({
            action: isSuperAdmin ? "superadmin_granted" : "superadmin_revoked",
            targetUserId: targetUid,
            targetEmail: targetUser.email,
            performedBy: callerUid,
            performedByEmail: (callerData === null || callerData === void 0 ? void 0 : callerData.email) || request.auth.token.email,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
            details: {
                previousValue: ((_a = targetDoc.data()) === null || _a === void 0 ? void 0 : _a.isSuperAdmin) || false,
                newValue: isSuperAdmin,
            },
        });
        firebase_functions_1.logger.info(`Superadmin ${callerUid} set ${targetUid} isSuperAdmin=${isSuperAdmin}`);
        return {
            success: true,
            message: isSuperAdmin
                ? `User ${targetUser.email} is now a superadmin`
                : `Superadmin status removed from ${targetUser.email}`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to set superadmin status:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to update superadmin status: ${error.message}`);
    }
});
/**
 * Get all users with their profiles (superadmin only)
 */
exports.getAllUsers = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const db = (0, firestore_2.getFirestore)();
    try {
        // Verify caller is a superadmin
        const callerDoc = await db.collection("users").doc(callerUid).get();
        const callerData = callerDoc.data();
        const callerToken = request.auth.token;
        const callerIsSuperAdmin = callerToken.superadmin === true ||
            (callerData === null || callerData === void 0 ? void 0 : callerData.isSuperAdmin) === true;
        if (!callerIsSuperAdmin) {
            throw new https_1.HttpsError("permission-denied", "Only superadmins can view all users");
        }
        // Get all user documents
        const usersSnapshot = await db.collection("users").get();
        const auth = (0, auth_1.getAuth)();
        const users = await Promise.all(usersSnapshot.docs.map(async (doc) => {
            var _a, _b;
            const userData = doc.data();
            let authUser = null;
            try {
                authUser = await auth.getUser(doc.id);
            }
            catch (error) {
                firebase_functions_1.logger.warn(`Could not find auth user for ${doc.id}`);
            }
            return Object.assign(Object.assign({ uid: doc.id }, userData), { email: (authUser === null || authUser === void 0 ? void 0 : authUser.email) || userData.email, displayName: (authUser === null || authUser === void 0 ? void 0 : authUser.displayName) || userData.displayName, photoURL: (authUser === null || authUser === void 0 ? void 0 : authUser.photoURL) || userData.photoURL, emailVerified: authUser === null || authUser === void 0 ? void 0 : authUser.emailVerified, disabled: authUser === null || authUser === void 0 ? void 0 : authUser.disabled, lastSignInTime: (_a = authUser === null || authUser === void 0 ? void 0 : authUser.metadata) === null || _a === void 0 ? void 0 : _a.lastSignInTime, creationTime: (_b = authUser === null || authUser === void 0 ? void 0 : authUser.metadata) === null || _b === void 0 ? void 0 : _b.creationTime });
        }));
        return { users };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to get all users:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to get users: ${error.message}`);
    }
});
/**
 * Suspend a tenant (superadmin only)
 */
exports.suspendTenantFunction = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const { tenantId, reason } = request.data;
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "Tenant ID is required");
    }
    const db = (0, firestore_2.getFirestore)();
    try {
        // Verify caller is a superadmin
        const callerDoc = await db.collection("users").doc(callerUid).get();
        const callerData = callerDoc.data();
        const callerToken = request.auth.token;
        const callerIsSuperAdmin = callerToken.superadmin === true ||
            (callerData === null || callerData === void 0 ? void 0 : callerData.isSuperAdmin) === true;
        if (!callerIsSuperAdmin) {
            throw new https_1.HttpsError("permission-denied", "Only superadmins can suspend tenants");
        }
        // Get tenant
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        // Update tenant status
        await db.collection("tenants").doc(tenantId).update({
            status: "suspended",
            suspendedAt: firestore_2.FieldValue.serverTimestamp(),
            suspendedBy: callerUid,
            suspendedReason: reason || "No reason provided",
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Log the action
        await db.collection("adminAuditLog").add({
            action: "tenant_suspended",
            tenantId,
            tenantName: (_a = tenantDoc.data()) === null || _a === void 0 ? void 0 : _a.name,
            performedBy: callerUid,
            performedByEmail: callerData === null || callerData === void 0 ? void 0 : callerData.email,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
            details: { reason },
        });
        firebase_functions_1.logger.info(`Tenant ${tenantId} suspended by ${callerUid}`);
        return {
            success: true,
            message: `Tenant ${(_b = tenantDoc.data()) === null || _b === void 0 ? void 0 : _b.name} has been suspended`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to suspend tenant:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to suspend tenant: ${error.message}`);
    }
});
/**
 * Reactivate a suspended tenant (superadmin only)
 */
exports.reactivateTenantFunction = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const { tenantId } = request.data;
    if (!tenantId) {
        throw new https_1.HttpsError("invalid-argument", "Tenant ID is required");
    }
    const db = (0, firestore_2.getFirestore)();
    try {
        // Verify caller is a superadmin
        const callerDoc = await db.collection("users").doc(callerUid).get();
        const callerData = callerDoc.data();
        const callerToken = request.auth.token;
        const callerIsSuperAdmin = callerToken.superadmin === true ||
            (callerData === null || callerData === void 0 ? void 0 : callerData.isSuperAdmin) === true;
        if (!callerIsSuperAdmin) {
            throw new https_1.HttpsError("permission-denied", "Only superadmins can reactivate tenants");
        }
        // Get tenant
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            throw new https_1.HttpsError("not-found", "Tenant not found");
        }
        // Update tenant status
        await db.collection("tenants").doc(tenantId).update({
            status: "active",
            suspendedAt: firestore_2.FieldValue.delete(),
            suspendedBy: firestore_2.FieldValue.delete(),
            suspendedReason: firestore_2.FieldValue.delete(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Log the action
        await db.collection("adminAuditLog").add({
            action: "tenant_reactivated",
            tenantId,
            tenantName: (_a = tenantDoc.data()) === null || _a === void 0 ? void 0 : _a.name,
            performedBy: callerUid,
            performedByEmail: callerData === null || callerData === void 0 ? void 0 : callerData.email,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
        firebase_functions_1.logger.info(`Tenant ${tenantId} reactivated by ${callerUid}`);
        return {
            success: true,
            message: `Tenant ${(_b = tenantDoc.data()) === null || _b === void 0 ? void 0 : _b.name} has been reactivated`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to reactivate tenant:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to reactivate tenant: ${error.message}`);
    }
});
/**
 * Bootstrap the first superadmin account
 * Can only be called once — checks _bootstrap/initialized
 * Uses Admin SDK to bypass Firestore rules
 */
exports.bootstrapFirstAdmin = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const callerEmail = request.auth.token.email;
    const { companyName, companySlug } = request.data;
    if (!companyName || !companySlug) {
        throw new https_1.HttpsError("invalid-argument", "Company name and slug are required");
    }
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(companySlug) || companySlug.length > 50) {
        throw new https_1.HttpsError("invalid-argument", "Invalid company slug format");
    }
    const db = (0, firestore_2.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    // Check if bootstrap has already occurred
    const bootstrapDoc = await db.doc("_bootstrap/initialized").get();
    if (bootstrapDoc.exists) {
        throw new https_1.HttpsError("already-exists", "System has already been bootstrapped");
    }
    try {
        // Use a transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
            var _a, _b;
            // Double-check inside transaction
            const bootstrapRef = db.doc("_bootstrap/initialized");
            const bootstrapSnap = await transaction.get(bootstrapRef);
            if (bootstrapSnap.exists) {
                throw new https_1.HttpsError("already-exists", "System has already been bootstrapped");
            }
            const userRef = db.doc(`users/${callerUid}`);
            const tenantRef = db.doc(`tenants/${companySlug}`);
            const memberRef = db.doc(`tenants/${companySlug}/members/${callerUid}`);
            // 1. Create/update user profile as superadmin
            const userSnap = await transaction.get(userRef);
            if (userSnap.exists) {
                transaction.update(userRef, {
                    isSuperAdmin: true,
                    tenantIds: [...(((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.tenantIds) || []), companySlug].filter((v, i, a) => a.indexOf(v) === i),
                    tenantAccess: Object.assign(Object.assign({}, (((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.tenantAccess) || {})), { [companySlug]: { name: companyName, role: "owner" } }),
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
                });
            }
            else {
                transaction.set(userRef, {
                    uid: callerUid,
                    email: callerEmail,
                    displayName: (callerEmail === null || callerEmail === void 0 ? void 0 : callerEmail.split("@")[0]) || "Admin",
                    isSuperAdmin: true,
                    tenantIds: [companySlug],
                    tenantAccess: {
                        [companySlug]: { name: companyName, role: "owner" },
                    },
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
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
                createdAt: firestore_2.FieldValue.serverTimestamp(),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
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
                displayName: (callerEmail === null || callerEmail === void 0 ? void 0 : callerEmail.split("@")[0]) || "Admin",
                role: "owner",
                modules: ["hiring", "staff", "timeleave", "performance", "payroll", "money", "accounting", "reports"],
                joinedAt: firestore_2.FieldValue.serverTimestamp(),
                lastActiveAt: firestore_2.FieldValue.serverTimestamp(),
                permissions: { admin: true, write: true, read: true },
            });
            // 4. Mark bootstrap as complete
            transaction.set(bootstrapRef, {
                initializedAt: firestore_2.FieldValue.serverTimestamp(),
                initializedBy: callerUid,
                initializedEmail: callerEmail,
            });
        });
        // Set custom claims (outside transaction — Auth API is not transactional)
        const existingUser = await auth.getUser(callerUid);
        const existingClaims = existingUser.customClaims || {};
        await auth.setCustomUserClaims(callerUid, Object.assign(Object.assign({}, existingClaims), { superadmin: true, tenants: Object.assign(Object.assign({}, (existingClaims.tenants || {})), { [companySlug]: "owner" }) }));
        firebase_functions_1.logger.info(`Bootstrap complete: ${callerEmail} is now superadmin of ${companyName}`);
        return {
            success: true,
            message: `Bootstrap complete. You are now superadmin of ${companyName}.`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Bootstrap failed:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", `Bootstrap failed: ${error.message}`);
    }
});
//# sourceMappingURL=admin.js.map