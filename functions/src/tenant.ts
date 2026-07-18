import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import {
  isSuperAdmin,
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

const ALLOWED_MODULES = [
  "hiring",
  "staff",
  "timeleave",
  "performance",
  "payroll",
  "money",
  "accounting",
  "reports",
] as const;

type AllowedModule = (typeof ALLOWED_MODULES)[number];

const ALLOWED_MODULE_SET = new Set<AllowedModule>(ALLOWED_MODULES);

const DEFAULT_MODULES_BY_ROLE: Record<TenantRole, AllowedModule[]> = {
  owner: ["hiring", "staff", "timeleave", "performance", "payroll", "money", "accounting", "reports"],
  "hr-admin": ["hiring", "staff", "timeleave", "performance", "payroll", "money", "accounting", "reports"],
  // Mirrors client DEFAULT_ROLE_PERMISSIONS: finance power role; staff +
  // timeleave are the read paths payroll needs.
  accountant: ["staff", "timeleave", "payroll", "money", "accounting", "reports"],
  manager: ["staff", "timeleave", "performance"],
  viewer: [],
};

function getModulesForFeatures(features?: Record<string, unknown>): AllowedModule[] {
  const enabled = new Set<AllowedModule>(["staff"]);

  if (features?.hiring !== false) enabled.add("hiring");
  if (features?.timeleave !== false) enabled.add("timeleave");
  if (features?.performance !== false) enabled.add("performance");
  if (features?.payroll !== false) enabled.add("payroll");
  if (features?.money !== false) enabled.add("money");
  if (features?.accounting !== false) enabled.add("accounting");
  if (features?.reports !== false) enabled.add("reports");

  return ALLOWED_MODULES.filter((module) => enabled.has(module));
}

function limitModulesToFeatures(
  modules: AllowedModule[],
  features?: Record<string, unknown>,
): AllowedModule[] {
  const enabledModules = new Set(getModulesForFeatures(features));
  return modules.filter((module) => enabledModules.has(module));
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
          money: true,
          accounting: true,
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
          timezone: "Asia/Dili",
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
        modules: limitModulesToFeatures(DEFAULT_MODULES_BY_ROLE.owner, tenantData.features),
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

interface MemberCallerContext {
  superadmin: boolean;
  callerRole: TenantRole | null;
}

/**
 * Superadmins manage members on any tenant; everyone else must be a tenant
 * owner or hr-admin.
 */
async function requireTenantAdminOrSuperAdmin(
  tenantId: string,
  authContext: { uid: string; token: Record<string, unknown> },
): Promise<MemberCallerContext> {
  if (await isSuperAdmin(authContext.uid, authContext.token)) {
    return { superadmin: true, callerRole: null };
  }

  const member = await requireTenantAdmin(tenantId, authContext.uid);
  return {
    superadmin: false,
    callerRole: typeof member.role === "string" ? (member.role as TenantRole) : null,
  };
}

function tenantsClaimMap(existingClaims: Record<string, unknown>): Record<string, string> {
  const existing = existingClaims.tenants || {};
  // Migrate legacy array format to map
  return Array.isArray(existing)
    ? Object.fromEntries(existing.map((tid: string) => [tid, "member"]))
    : { ...(existing as Record<string, string>) };
}

async function writeAdminAudit(entry: {
  action: string;
  actorUid: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getFirestore().collection("adminAuditLog").add({
      ...entry,
      targetName: entry.targetName ?? null,
      details: entry.details ?? null,
      timestamp: FieldValue.serverTimestamp(),
      triggeredBy: "function",
    });
  } catch (error) {
    logger.warn("Failed to write admin audit entry:", error);
  }
}

/**
 * Generates a Firebase password reset link and queues it on the `mail`
 * collection (sent via Resend by sendQueuedEmail).
 */
async function queuePasswordSetupEmail(params: {
  email: string;
  tenantName?: string;
  createdBy: string;
  isNewUser: boolean;
}): Promise<void> {
  const resetLink = await getAuth().generatePasswordResetLink(params.email);
  const orgLine = params.tenantName
    ? `<p>You have been given access to <strong>${params.tenantName}</strong> on Xefe.</p>`
    : "";
  const subject = params.isNewUser
    ? params.tenantName
      ? `You've been invited to ${params.tenantName} on Xefe`
      : "Your Xefe account is ready"
    : "Reset your Xefe password";
  const intro = params.isNewUser
    ? "An account has been created for this email address."
    : "A password reset was requested for your account.";

  await getFirestore().collection("mail").add({
    tenantId: "platform",
    to: [params.email],
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>${params.isNewUser ? "Welcome to Xefe" : "Password reset"}</h2>
        ${orgLine}
        <p>${intro} Use the link below to ${params.isNewUser ? "set" : "reset"} your password:</p>
        <p><a href="${resetLink}">${params.isNewUser ? "Set your password" : "Reset your password"}</a></p>
        <p>If you were not expecting this email, you can safely ignore it.</p>
      </div>
    `,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: params.createdBy,
    purpose: "password-reset",
  });
}

/**
 * Cloud Function to add a user to an existing tenant
 */
export const addTenantMember = onCall(
  async (request): Promise<{ success: boolean; message: string }> => {
    const { tenantId, userEmail, role, modules, employeeId, tenantName } = request.data as {
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

    if (modules !== undefined && !Array.isArray(modules)) {
      throw new HttpsError("invalid-argument", "modules must be an array");
    }

    const db = getFirestore();
    const auth = getAuth();
    const normalizedEmail = userEmail.trim().toLowerCase();
    const requestedModules = Array.isArray(modules)
      ? modules.map((module) => {
          if (typeof module !== "string") {
            throw new HttpsError("invalid-argument", "modules must only include strings");
          }
          return module.trim();
        })
      : [];

    if (requestedModules.some((module) => !ALLOWED_MODULE_SET.has(module as AllowedModule))) {
      throw new HttpsError("invalid-argument", "modules contains invalid entries");
    }

    const normalizedModules = Array.from(new Set(requestedModules)) as AllowedModule[];

    try {
      const caller = await requireTenantAdminOrSuperAdmin(tenantId, authContext);
      if (role === "owner" && !caller.superadmin && caller.callerRole !== "owner") {
        throw new HttpsError("permission-denied", "Only tenant owners can assign owner role");
      }

      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (!tenantSnap.exists) {
        throw new HttpsError("not-found", "Tenant not found");
      }
      const tenantFeatures = tenantSnap.data()?.features;
      const effectiveTenantName =
        tenantName || (tenantSnap.data()?.name as string | undefined) || tenantId;
      const effectiveModules = limitModulesToFeatures(
        Array.isArray(modules)
          ? normalizedModules
          : DEFAULT_MODULES_BY_ROLE[role],
        tenantFeatures,
      );

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
        modules: effectiveModules,
        email: normalizedEmail,
        displayName: targetUser.displayName || null,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        ...(employeeId ? { employeeId } : {}),
      };

      await db.collection(`tenants/${tenantId}/members`).doc(targetUser.uid).set(memberData);

      // Create/update user profile with tenantAccess (for Ekipa/mobile app login)
      const userRef = db.collection("users").doc(targetUser.uid);
      const userSnap = await userRef.get();
      const existingData = userSnap.exists ? userSnap.data() || {} : {};
      const existingAccess = existingData.tenantAccess || {};
      const existingIds: string[] = existingData.tenantIds || [];

      const profileUpdate: Record<string, unknown> = {
        uid: targetUser.uid,
        email: normalizedEmail,
        updatedAt: new Date(),
        tenantAccess: { ...existingAccess, [tenantId]: { name: effectiveTenantName, role } },
      };
      if (!existingIds.includes(tenantId)) {
        profileUpdate.tenantIds = [...existingIds, tenantId];
      }
      await userRef.set(profileUpdate, { merge: true });

      // Email newly created users a link to set their password
      if (isNewUser) {
        try {
          await queuePasswordSetupEmail({
            email: normalizedEmail,
            tenantName: effectiveTenantName,
            createdBy: authContext.uid,
            isNewUser: true,
          });
        } catch (resetError: any) {
          logger.warn(`Failed to queue password setup email for ${normalizedEmail}:`, resetError.message);
        }
      }

      // Update user's custom claims (map format for firestore.rules fast-path)
      const existingClaims = targetUser.customClaims || {};
      const tenantsMap = tenantsClaimMap(existingClaims);

      if (!tenantsMap[tenantId]) {
        tenantsMap[tenantId] = role;
        const newClaims = {
          ...existingClaims,
          tenants: tenantsMap,
        };
        await auth.setCustomUserClaims(targetUser.uid, newClaims);
      }

      await writeAdminAudit({
        action: "user_added_to_tenant",
        actorUid: authContext.uid,
        actorEmail: typeof authContext.token.email === "string" ? authContext.token.email : "",
        targetType: "tenant",
        targetId: tenantId,
        targetName: effectiveTenantName,
        details: { memberEmail: normalizedEmail, memberUid: targetUser.uid, role, modules: effectiveModules, isNewUser },
      });

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

/**
 * Cloud Function to change a tenant member's role and/or modules.
 * Keeps the member doc, custom claims, and users/{uid}.tenantAccess in sync.
 */
export const updateTenantMember = onCall(
  async (request): Promise<{ success: boolean; message: string }> => {
    const { tenantId, memberUid, role, modules } = request.data as {
      tenantId?: string;
      memberUid?: string;
      role?: TenantRole;
      modules?: unknown[];
    };
    const authContext = requireAuth(request);

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    if (!memberUid) {
      throw new HttpsError("invalid-argument", "memberUid is required");
    }

    const allowedRoles: TenantRole[] = ["owner", "hr-admin", "manager", "viewer"];
    if (role !== undefined && !allowedRoles.includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid role");
    }
    if (modules !== undefined && !Array.isArray(modules)) {
      throw new HttpsError("invalid-argument", "modules must be an array");
    }
    if (role === undefined && modules === undefined) {
      throw new HttpsError("invalid-argument", "Nothing to update");
    }

    const normalizedModules = Array.isArray(modules)
      ? (Array.from(
          new Set(
            modules.map((module) => {
              if (typeof module !== "string" || !ALLOWED_MODULE_SET.has(module.trim() as AllowedModule)) {
                throw new HttpsError("invalid-argument", "modules contains invalid entries");
              }
              return module.trim();
            }),
          ),
        ) as AllowedModule[])
      : undefined;

    const db = getFirestore();
    const auth = getAuth();

    try {
      const caller = await requireTenantAdminOrSuperAdmin(tenantId, authContext);
      if (!caller.superadmin && memberUid === authContext.uid) {
        throw new HttpsError("permission-denied", "You cannot change your own access");
      }

      const memberRef = db.collection(`tenants/${tenantId}/members`).doc(memberUid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        throw new HttpsError("not-found", "Member not found in this tenant");
      }
      const currentRole = memberSnap.data()?.role as TenantRole | undefined;

      // Only owners (or superadmins) may grant or revoke the owner role
      if (
        !caller.superadmin &&
        caller.callerRole !== "owner" &&
        (role === "owner" || currentRole === "owner")
      ) {
        throw new HttpsError("permission-denied", "Only tenant owners can manage owner access");
      }

      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      const tenantFeatures = tenantSnap.exists ? tenantSnap.data()?.features : undefined;
      const tenantName = (tenantSnap.data()?.name as string | undefined) || tenantId;

      const nextRole = role ?? currentRole ?? "viewer";
      // Explicit modules win; a bare role change resets modules to that role's defaults
      const nextModules = limitModulesToFeatures(
        normalizedModules ?? DEFAULT_MODULES_BY_ROLE[nextRole],
        tenantFeatures,
      );

      await memberRef.update({
        role: nextRole,
        modules: nextModules,
        updatedAt: new Date(),
      });

      if (role !== undefined && role !== currentRole) {
        const targetUser = await auth.getUser(memberUid);
        const existingClaims = targetUser.customClaims || {};
        const tenantsMap = tenantsClaimMap(existingClaims);
        tenantsMap[tenantId] = role;
        await auth.setCustomUserClaims(memberUid, { ...existingClaims, tenants: tenantsMap });

        await db.collection("users").doc(memberUid).set(
          {
            updatedAt: new Date(),
            tenantAccess: { [tenantId]: { name: tenantName, role } },
          },
          { merge: true },
        );
      }

      await writeAdminAudit({
        action: "user_tenant_access_updated",
        actorUid: authContext.uid,
        actorEmail: typeof authContext.token.email === "string" ? authContext.token.email : "",
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantName,
        details: {
          memberUid,
          memberEmail: memberSnap.data()?.email ?? null,
          previousRole: currentRole ?? null,
          role: nextRole,
          modules: nextModules,
        },
      });

      return { success: true, message: "Member access updated" };
    } catch (error: any) {
      logger.error("Failed to update tenant member:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", `Failed to update member: ${error.message}`);
    }
  }
);

/**
 * Cloud Function to remove a user from a tenant.
 * Deletes the member doc and strips the tenant from claims and the user profile.
 */
export const removeTenantMember = onCall(
  async (request): Promise<{ success: boolean; message: string }> => {
    const { tenantId, memberUid } = request.data as {
      tenantId?: string;
      memberUid?: string;
    };
    const authContext = requireAuth(request);

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    if (!memberUid) {
      throw new HttpsError("invalid-argument", "memberUid is required");
    }

    const db = getFirestore();
    const auth = getAuth();

    try {
      const caller = await requireTenantAdminOrSuperAdmin(tenantId, authContext);
      if (!caller.superadmin && memberUid === authContext.uid) {
        throw new HttpsError("permission-denied", "You cannot remove yourself from the tenant");
      }

      const memberRef = db.collection(`tenants/${tenantId}/members`).doc(memberUid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        throw new HttpsError("not-found", "Member not found in this tenant");
      }
      const memberRole = memberSnap.data()?.role as TenantRole | undefined;
      const memberEmail = memberSnap.data()?.email as string | undefined;

      if (!caller.superadmin && caller.callerRole !== "owner" && memberRole === "owner") {
        throw new HttpsError("permission-denied", "Only tenant owners can remove an owner");
      }

      await memberRef.delete();

      // Strip the tenant from custom claims (skip silently if the auth user is gone)
      try {
        const targetUser = await auth.getUser(memberUid);
        const existingClaims = targetUser.customClaims || {};
        const tenantsMap = tenantsClaimMap(existingClaims);
        if (tenantsMap[tenantId]) {
          delete tenantsMap[tenantId];
          await auth.setCustomUserClaims(memberUid, { ...existingClaims, tenants: tenantsMap });
        }
      } catch (claimsError: any) {
        if (claimsError?.code !== "auth/user-not-found") {
          throw claimsError;
        }
      }

      // Strip the tenant from the user profile (profile may not exist)
      try {
        await db.collection("users").doc(memberUid).update({
          [`tenantAccess.${tenantId}`]: FieldValue.delete(),
          tenantIds: FieldValue.arrayRemove(tenantId),
          updatedAt: new Date(),
        });
      } catch (profileError) {
        logger.warn(`Could not update user profile for removed member ${memberUid}:`, profileError);
      }

      const tenantSnap = await db.collection("tenants").doc(tenantId).get();

      await writeAdminAudit({
        action: "user_removed_from_tenant",
        actorUid: authContext.uid,
        actorEmail: typeof authContext.token.email === "string" ? authContext.token.email : "",
        targetType: "tenant",
        targetId: tenantId,
        targetName: (tenantSnap.data()?.name as string | undefined) ?? tenantId,
        details: { memberUid, memberEmail: memberEmail ?? null, previousRole: memberRole ?? null },
      });

      return { success: true, message: "Member removed from tenant" };
    } catch (error: any) {
      logger.error("Failed to remove tenant member:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", `Failed to remove member: ${error.message}`);
    }
  }
);

/**
 * Cloud Function to (re)send a password reset email to a tenant member.
 * The reset link is delivered through the Resend mail queue.
 */
export const sendTenantMemberPasswordReset = onCall(
  async (request): Promise<{ success: boolean; message: string }> => {
    const { tenantId, memberUid } = request.data as {
      tenantId?: string;
      memberUid?: string;
    };
    const authContext = requireAuth(request);

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }
    if (!memberUid) {
      throw new HttpsError("invalid-argument", "memberUid is required");
    }

    const db = getFirestore();

    try {
      await requireTenantAdminOrSuperAdmin(tenantId, authContext);

      // The target must actually be a member of this tenant — prevents using
      // this endpoint to email arbitrary addresses.
      const memberSnap = await db.collection(`tenants/${tenantId}/members`).doc(memberUid).get();
      if (!memberSnap.exists) {
        throw new HttpsError("not-found", "Member not found in this tenant");
      }

      const memberEmail = memberSnap.data()?.email;
      if (typeof memberEmail !== "string" || !memberEmail.includes("@")) {
        throw new HttpsError("failed-precondition", "Member has no email address on file");
      }

      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      const tenantName = (tenantSnap.data()?.name as string | undefined) || tenantId;

      await queuePasswordSetupEmail({
        email: memberEmail,
        tenantName,
        createdBy: authContext.uid,
        isNewUser: false,
      });

      await writeAdminAudit({
        action: "user_password_reset_sent",
        actorUid: authContext.uid,
        actorEmail: typeof authContext.token.email === "string" ? authContext.token.email : "",
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantName,
        details: { memberUid, memberEmail },
      });

      return { success: true, message: `Password reset email sent to ${memberEmail}` };
    } catch (error: any) {
      logger.error("Failed to send member password reset:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", `Failed to send password reset: ${error.message}`);
    }
  }
);
