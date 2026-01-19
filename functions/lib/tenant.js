"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTenantMember = exports.provisionTenant = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const firebase_functions_1 = require("firebase-functions");
/**
 * Cloud Function to provision a new tenant
 * Creates tenant document, settings, owner member, and sets custom claims
 */
exports.provisionTenant = (0, https_1.onCall)(async (request) => {
    const { name, ownerEmail, slug, config } = request.data;
    // Validate input
    if (!name || name.trim().length < 2) {
        throw new https_1.HttpsError("invalid-argument", "Tenant name must be at least 2 characters");
    }
    if (!ownerEmail || !ownerEmail.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "Valid owner email is required");
    }
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    try {
        // Step 1: Find or create the owner user
        let ownerUser;
        try {
            ownerUser = await auth.getUserByEmail(ownerEmail);
            firebase_functions_1.logger.info(`Found existing user for email: ${ownerEmail}`);
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                // Create new user
                ownerUser = await auth.createUser({
                    email: ownerEmail,
                    emailVerified: false,
                });
                firebase_functions_1.logger.info(`Created new user for email: ${ownerEmail}`);
            }
            else {
                throw error;
            }
        }
        // Step 2: Generate tenant ID (you might want to use a more sophisticated ID generation)
        const tenantId = slug || `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Step 3: Check if tenant ID already exists
        const existingTenant = await db.collection("tenants").doc(tenantId).get();
        if (existingTenant.exists) {
            throw new https_1.HttpsError("already-exists", "Tenant ID already exists");
        }
        // Step 4: Prepare tenant data
        const tenantData = {
            id: tenantId,
            name: name.trim(),
            slug: slug || tenantId,
            branding: (config === null || config === void 0 ? void 0 : config.branding) || {},
            features: Object.assign({ hiring: true, timeleave: true, performance: true, payroll: true, reports: true }, config === null || config === void 0 ? void 0 : config.features),
            payrollPolicy: Object.assign({ overtimeThreshold: 44, overtimeRate: 1.5, payrollCycle: "monthly" }, config === null || config === void 0 ? void 0 : config.payrollPolicy),
            settings: Object.assign({ timezone: "UTC", currency: "USD", dateFormat: "YYYY-MM-DD" }, config === null || config === void 0 ? void 0 : config.settings),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Step 5: Prepare tenant config for settings subcollection
        const tenantConfig = {
            name: tenantData.name,
            branding: tenantData.branding,
            features: tenantData.features,
            payrollPolicy: tenantData.payrollPolicy,
            settings: tenantData.settings,
            createdAt: tenantData.createdAt,
            updatedAt: tenantData.updatedAt,
        };
        // Step 6: Prepare owner member data
        const ownerMemberData = {
            uid: ownerUser.uid,
            role: "owner",
            modules: ["hiring", "staff", "timeleave", "performance", "payroll", "reports"],
            email: ownerEmail,
            displayName: ownerUser.displayName || null,
            joinedAt: new Date(),
            lastActiveAt: new Date(),
            permissions: {
                admin: true,
                write: true,
                read: true,
            },
        };
        // Step 7: Use batch write for atomicity
        const batch = db.batch();
        // Create tenant document
        const tenantRef = db.collection("tenants").doc(tenantId);
        batch.set(tenantRef, tenantData);
        // Create settings subcollection document
        const settingsRef = tenantRef.collection("settings").doc("config");
        batch.set(settingsRef, tenantConfig);
        // Create owner member document
        const memberRef = tenantRef.collection("members").doc(ownerUser.uid);
        batch.set(memberRef, ownerMemberData);
        // Commit the batch
        await batch.commit();
        // Step 8: Set custom claims for the owner
        const existingClaims = ownerUser.customClaims || {};
        const existingTenants = existingClaims.tenants || [];
        const newClaims = Object.assign(Object.assign({}, existingClaims), { tenants: [...existingTenants, tenantId], role: "owner" });
        await auth.setCustomUserClaims(ownerUser.uid, newClaims);
        // Step 9: Create some default data (optional)
        try {
            await createDefaultTenantData(db, tenantId);
        }
        catch (error) {
            firebase_functions_1.logger.warn("Failed to create default tenant data:", error);
            // Don't fail the whole operation for this
        }
        firebase_functions_1.logger.info(`Successfully provisioned tenant: ${tenantId} for owner: ${ownerEmail}`);
        return {
            tenantId,
            ownerUid: ownerUser.uid,
            message: `Tenant '${name}' provisioned successfully`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to provision tenant:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to provision tenant: ${error.message}`);
    }
});
/**
 * Helper function to create default tenant data
 */
async function createDefaultTenantData(db, tenantId) {
    const batch = db.batch();
    // Create default departments
    const defaultDepartments = [
        { name: "Engineering", description: "Software development and technical operations" },
        { name: "Human Resources", description: "People operations and talent management" },
        { name: "Sales", description: "Revenue generation and customer acquisition" },
        { name: "Marketing", description: "Brand management and lead generation" },
        { name: "Finance", description: "Financial planning and accounting" },
    ];
    defaultDepartments.forEach((dept) => {
        const deptRef = db.collection(`tenants/${tenantId}/departments`).doc();
        batch.set(deptRef, Object.assign(Object.assign({}, dept), { createdAt: new Date(), updatedAt: new Date() }));
    });
    // Create default positions
    const defaultPositions = [
        {
            title: "Software Engineer",
            grade: "IC3",
            baseMonthlyUSD: 5000,
            leaveDaysPerYear: 25,
            description: "Develops and maintains software applications",
        },
        {
            title: "Senior Software Engineer",
            grade: "IC4",
            baseMonthlyUSD: 7000,
            leaveDaysPerYear: 25,
            description: "Senior-level software development and technical leadership",
        },
        {
            title: "HR Manager",
            grade: "M3",
            baseMonthlyUSD: 6000,
            leaveDaysPerYear: 25,
            description: "Manages human resources operations and policies",
        },
        {
            title: "Sales Representative",
            grade: "IC2",
            baseMonthlyUSD: 4000,
            leaveDaysPerYear: 20,
            description: "Responsible for sales and customer relationship management",
        },
    ];
    defaultPositions.forEach((position) => {
        const posRef = db.collection(`tenants/${tenantId}/positions`).doc();
        batch.set(posRef, Object.assign(Object.assign({}, position), { createdAt: new Date(), updatedAt: new Date() }));
    });
    // Create default leave policies
    const defaultLeavePolicies = [
        {
            name: "Annual Leave",
            type: "vacation",
            daysPerYear: 25,
            carryOverDays: 5,
            description: "Standard annual vacation leave",
        },
        {
            name: "Sick Leave",
            type: "sick",
            daysPerYear: 10,
            carryOverDays: 0,
            description: "Medical and health-related leave",
        },
        {
            name: "Personal Leave",
            type: "personal",
            daysPerYear: 3,
            carryOverDays: 0,
            description: "Personal time off for various needs",
        },
    ];
    defaultLeavePolicies.forEach((policy) => {
        const policyRef = db.collection(`tenants/${tenantId}/leavePolicies`).doc();
        batch.set(policyRef, Object.assign(Object.assign({}, policy), { createdAt: new Date(), updatedAt: new Date() }));
    });
    await batch.commit();
    firebase_functions_1.logger.info(`Created default data for tenant: ${tenantId}`);
}
/**
 * Cloud Function to add a user to an existing tenant
 */
exports.addTenantMember = (0, https_1.onCall)(async (request) => {
    const { tenantId, userEmail, role, modules = [] } = request.data;
    // Validate caller permissions (should be owner or hr-admin of the tenant)
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    try {
        // Check if caller has permission to add members
        const callerMemberDoc = await db
            .collection(`tenants/${tenantId}/members`)
            .doc(request.auth.uid)
            .get();
        if (!callerMemberDoc.exists) {
            throw new https_1.HttpsError("permission-denied", "You are not a member of this tenant");
        }
        const callerMember = callerMemberDoc.data();
        if (!callerMember || !["owner", "hr-admin"].includes(callerMember.role)) {
            throw new https_1.HttpsError("permission-denied", "Insufficient permissions to add members");
        }
        // Find or create the user
        let targetUser;
        try {
            targetUser = await auth.getUserByEmail(userEmail);
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                targetUser = await auth.createUser({
                    email: userEmail,
                    emailVerified: false,
                });
            }
            else {
                throw error;
            }
        }
        // Check if user is already a member
        const existingMemberDoc = await db
            .collection(`tenants/${tenantId}/members`)
            .doc(targetUser.uid)
            .get();
        if (existingMemberDoc.exists) {
            throw new https_1.HttpsError("already-exists", "User is already a member of this tenant");
        }
        // Create member document
        const memberData = {
            uid: targetUser.uid,
            role,
            modules,
            email: userEmail,
            displayName: targetUser.displayName || null,
            joinedAt: new Date(),
            lastActiveAt: new Date(),
        };
        await db.collection(`tenants/${tenantId}/members`).doc(targetUser.uid).set(memberData);
        // Update user's custom claims
        const existingClaims = targetUser.customClaims || {};
        const existingTenants = existingClaims.tenants || [];
        if (!existingTenants.includes(tenantId)) {
            const newClaims = Object.assign(Object.assign({}, existingClaims), { tenants: [...existingTenants, tenantId] });
            await auth.setCustomUserClaims(targetUser.uid, newClaims);
        }
        return {
            success: true,
            message: `User ${userEmail} added to tenant successfully`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to add tenant member:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to add member: ${error.message}`);
    }
});
//# sourceMappingURL=tenant.js.map