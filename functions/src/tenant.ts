import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import {
  requireAuth,
  requireSuperAdmin,
  requireTenantAdmin,
  TenantRole,
} from "./authz";

interface ProvisionTenantResponse {
  tenantId: string;
  ownerUid: string;
  message: string;
}

/**
 * Cloud Function to provision a new tenant
 * Creates tenant document, settings, owner member, and sets custom claims
 */
export const provisionTenant = onCall(
  async (request): Promise<ProvisionTenantResponse> => {
    const { name, ownerEmail, slug, config } = request.data as {
      name?: string;
      ownerEmail?: string;
      slug?: string;
      config?: {
        branding?: Record<string, unknown>;
        features?: Record<string, unknown>;
        payrollPolicy?: Record<string, unknown>;
        settings?: Record<string, unknown>;
      };
    };
    const authContext = requireAuth(request);
    await requireSuperAdmin(authContext.uid, authContext.token);

    // Validate input
    if (!name || name.trim().length < 2) {
      throw new HttpsError("invalid-argument", "Tenant name must be at least 2 characters");
    }

    if (!ownerEmail || !ownerEmail.includes("@")) {
      throw new HttpsError("invalid-argument", "Valid owner email is required");
    }

    if (slug && !/^[a-z0-9-]{3,63}$/.test(slug)) {
      throw new HttpsError(
        "invalid-argument",
        "Tenant slug must be 3-63 characters and contain only lowercase letters, numbers, and hyphens",
      );
    }

    const db = getFirestore();
    const auth = getAuth();

    try {
      // Step 1: Find or create the owner user
      let ownerUser;
      try {
        ownerUser = await auth.getUserByEmail(ownerEmail);
        logger.info(`Found existing user for email: ${ownerEmail}`);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          // Create new user
          ownerUser = await auth.createUser({
            email: ownerEmail,
            emailVerified: false,
          });
          logger.info(`Created new user for email: ${ownerEmail}`);
        } else {
          throw error;
        }
      }

      // Step 2: Generate tenant ID (you might want to use a more sophisticated ID generation)
      const tenantId = slug || `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 3: Check if tenant ID already exists
      const existingTenant = await db.collection("tenants").doc(tenantId).get();
      if (existingTenant.exists) {
        throw new HttpsError("already-exists", "Tenant ID already exists");
      }

      // Step 4: Prepare tenant data
      const tenantData = {
        id: tenantId,
        name: name.trim(),
        slug: slug || tenantId,
        branding: config?.branding || {},
        features: {
          hiring: true,
          timeleave: true,
          performance: true,
          payroll: true,
          reports: true,
          ...config?.features,
        },
        payrollPolicy: {
          overtimeThreshold: 44, // hours per week
          overtimeRate: 1.5,
          payrollCycle: "monthly" as const,
          ...config?.payrollPolicy,
        },
        settings: {
          timezone: "UTC",
          currency: "USD",
          dateFormat: "YYYY-MM-DD",
          ...config?.settings,
        },
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
        role: "owner" as const,
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

      // Step 8: Set custom claims for the owner (map format for firestore.rules fast-path)
      const existingClaims = ownerUser.customClaims || {};
      const existingTenantsMap = existingClaims.tenants || {};

      // Migrate legacy array format to map
      const tenantsMap: Record<string, string> = Array.isArray(existingTenantsMap)
        ? Object.fromEntries(existingTenantsMap.map((tid: string) => [tid, "member"]))
        : { ...existingTenantsMap };
      tenantsMap[tenantId] = "owner";

      const newClaims = {
        ...existingClaims,
        tenants: tenantsMap,
      };

      await auth.setCustomUserClaims(ownerUser.uid, newClaims);

      // Step 9: Create some default data (optional)
      try {
        await createDefaultTenantData(db, tenantId);
      } catch (error) {
        logger.warn("Failed to create default tenant data:", error);
        // Don't fail the whole operation for this
      }

      logger.info(`Successfully provisioned tenant: ${tenantId} for owner: ${ownerEmail}`);

      return {
        tenantId,
        ownerUid: ownerUser.uid,
        message: `Tenant '${name}' provisioned successfully`,
      };

    } catch (error: any) {
      logger.error("Failed to provision tenant:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", `Failed to provision tenant: ${error.message}`);
    }
  }
);

/**
 * Helper function to create default tenant data
 */
async function createDefaultTenantData(db: FirebaseFirestore.Firestore, tenantId: string) {
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
    batch.set(deptRef, {
      ...dept,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    batch.set(posRef, {
      ...position,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    batch.set(policyRef, {
      ...policy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  await batch.commit();
  logger.info(`Created default data for tenant: ${tenantId}`);
}

/**
 * Cloud Function to add a user to an existing tenant
 */
export const addTenantMember = onCall(
  async (request): Promise<{ success: boolean; message: string }> => {
    const { tenantId, userEmail, role, modules = [], employeeId, tenantName } = request.data as {
      tenantId?: string;
      userEmail?: string;
      role?: TenantRole;
      modules?: unknown[];
      employeeId?: string;
      tenantName?: string;
    };
    const authContext = requireAuth(request);

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }

    if (!userEmail || !userEmail.includes("@")) {
      throw new HttpsError("invalid-argument", "Valid userEmail is required");
    }

    const allowedRoles: TenantRole[] = ["owner", "hr-admin", "manager", "viewer"];
    if (!role || !allowedRoles.includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid role");
    }

    if (!Array.isArray(modules)) {
      throw new HttpsError("invalid-argument", "modules must be an array");
    }

    const db = getFirestore();
    const auth = getAuth();
    const normalizedEmail = userEmail.trim().toLowerCase();
    const normalizedModules = modules.filter(
      (module): module is string => typeof module === "string",
    );

    try {
      const callerMember = await requireTenantAdmin(tenantId, authContext.uid);
      if (role === "owner" && callerMember.role !== "owner") {
        throw new HttpsError("permission-denied", "Only tenant owners can assign owner role");
      }

      // Find or create the user
      let targetUser;
      let isNewUser = false;
      try {
        targetUser = await auth.getUserByEmail(normalizedEmail);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          targetUser = await auth.createUser({
            email: normalizedEmail,
            emailVerified: false,
          });
          isNewUser = true;
        } else {
          throw error;
        }
      }

      // Check if user is already a member
      const existingMemberDoc = await db
        .collection(`tenants/${tenantId}/members`)
        .doc(targetUser.uid)
        .get();

      if (existingMemberDoc.exists) {
        throw new HttpsError("already-exists", "User is already a member of this tenant");
      }

      // Create member document
      const memberData = {
        uid: targetUser.uid,
        role,
        modules: normalizedModules,
        email: normalizedEmail,
        displayName: targetUser.displayName || null,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        ...(employeeId ? { employeeId } : {}),
      };

      await db.collection(`tenants/${tenantId}/members`).doc(targetUser.uid).set(memberData);

      // Create/update user profile with tenantAccess (for Ekipa/mobile app login)
      if (tenantName) {
        const userRef = db.collection("users").doc(targetUser.uid);
        const userSnap = await userRef.get();
        const existingData = userSnap.exists ? userSnap.data() || {} : {};
        const existingAccess = existingData.tenantAccess || {};
        const existingIds: string[] = existingData.tenantIds || [];

        const profileUpdate: Record<string, unknown> = {
          uid: targetUser.uid,
          email: normalizedEmail,
          updatedAt: new Date(),
          tenantAccess: { ...existingAccess, [tenantId]: { name: tenantName, role } },
        };
        if (!existingIds.includes(tenantId)) {
          profileUpdate.tenantIds = [...existingIds, tenantId];
        }
        await userRef.set(profileUpdate, { merge: true });
      }

      // Send password reset email for newly created users
      if (isNewUser) {
        try {
          const resetLink = await auth.generatePasswordResetLink(normalizedEmail);
          logger.info(`Password reset link generated for ${normalizedEmail}: ${resetLink}`);
        } catch (resetError: any) {
          logger.warn(`Failed to generate password reset link for ${normalizedEmail}:`, resetError.message);
        }
      }

      // Update user's custom claims (map format for firestore.rules fast-path)
      const existingClaims = targetUser.customClaims || {};
      const existingTenantsMap = existingClaims.tenants || {};

      // Migrate legacy array format to map
      const tenantsMap: Record<string, string> = Array.isArray(existingTenantsMap)
        ? Object.fromEntries(existingTenantsMap.map((tid: string) => [tid, "member"]))
        : { ...existingTenantsMap };

      if (!tenantsMap[tenantId]) {
        tenantsMap[tenantId] = role;
        const newClaims = {
          ...existingClaims,
          tenants: tenantsMap,
        };
        await auth.setCustomUserClaims(targetUser.uid, newClaims);
      }

      return {
        success: true,
        message: `User ${normalizedEmail} added to tenant successfully`,
      };

    } catch (error: any) {
      logger.error("Failed to add tenant member:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", `Failed to add member: ${error.message}`);
    }
  }
);
