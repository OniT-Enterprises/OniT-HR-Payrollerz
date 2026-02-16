"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireTenantMember = requireTenantMember;
exports.requireTenantRoles = requireTenantRoles;
exports.requireTenantAdmin = requireTenantAdmin;
exports.requireTenantManagerOrAdmin = requireTenantManagerOrAdmin;
exports.hasModuleAccess = hasModuleAccess;
exports.isSuperAdmin = isSuperAdmin;
exports.requireSuperAdmin = requireSuperAdmin;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
function requireAuth(request) {
    var _a, _b;
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    return {
        uid: request.auth.uid,
        token: ((_b = request.auth.token) !== null && _b !== void 0 ? _b : {}),
    };
}
async function requireTenantMember(tenantId, uid) {
    const memberDoc = await (0, firestore_1.getFirestore)()
        .doc(`tenants/${tenantId}/members/${uid}`)
        .get();
    if (!memberDoc.exists) {
        throw new https_1.HttpsError("permission-denied", "User is not a member of this tenant");
    }
    return memberDoc.data();
}
async function requireTenantRoles(tenantId, uid, allowedRoles, errorMessage = "Insufficient permissions for this tenant operation") {
    const member = await requireTenantMember(tenantId, uid);
    const role = member.role;
    if (typeof role !== "string" || !allowedRoles.includes(role)) {
        throw new https_1.HttpsError("permission-denied", errorMessage);
    }
    return member;
}
async function requireTenantAdmin(tenantId, uid) {
    return requireTenantRoles(tenantId, uid, ["owner", "hr-admin"], "Only tenant owners or HR admins can perform this action");
}
async function requireTenantManagerOrAdmin(tenantId, uid) {
    return requireTenantRoles(tenantId, uid, ["owner", "hr-admin", "manager"], "Only tenant managers or admins can perform this action");
}
function hasModuleAccess(member, moduleName) {
    if (!Array.isArray(member.modules)) {
        return false;
    }
    return member.modules.some((module) => typeof module === "string" && module === moduleName);
}
async function isSuperAdmin(uid, token = {}) {
    var _a;
    if (token.superadmin === true) {
        return true;
    }
    const userDoc = await (0, firestore_1.getFirestore)().collection("users").doc(uid).get();
    return ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.isSuperAdmin) === true;
}
async function requireSuperAdmin(uid, token = {}) {
    const superadmin = await isSuperAdmin(uid, token);
    if (!superadmin) {
        throw new https_1.HttpsError("permission-denied", "Only superadmins can perform this action");
    }
}
//# sourceMappingURL=authz.js.map