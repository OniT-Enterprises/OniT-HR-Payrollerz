import { db } from "./firebase";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import { paths } from "./paths";

/**
 * Sets up a default tenant for a user who doesn't have any tenant access
 * This fixes the "No access" issue in the tenant switcher
 */

export interface TenantSetupConfig {
  tenantId: string;
  tenantName: string;
  userEmail: string;
  userId: string;
  role: "owner" | "hr-admin";
}

/**
 * Create a default tenant for a user
 */
export const createDefaultTenant = async (
  config: TenantSetupConfig,
): Promise<boolean> => {
  if (!db) {
    console.error("❌ Database not available");
    return false;
  }

  try {
    console.log("🏢 Creating default tenant for user:", config.userEmail);

    // 1. Create tenant document
    const tenantData = {
      id: config.tenantId,
      name: config.tenantName,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        modules: [
          "hiring",
          "staff",
          "timeleave",
          "performance",
          "payroll",
          "reports",
        ],
        currency: "USD",
        timezone: "UTC",
      },
    };

    await setDoc(doc(db, paths.tenant(config.tenantId)), tenantData);
    console.log("✅ Tenant document created");

    // 2. Create member document
    const memberData = {
      uid: config.userId,
      role: config.role,
      modules: [
        "hiring",
        "staff",
        "timeleave",
        "performance",
        "payroll",
        "reports",
      ],
      email: config.userEmail,
      displayName: config.userEmail.split("@")[0], // Use email prefix as display name
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      status: "active",
    };

    await setDoc(
      doc(db, paths.member(config.tenantId, config.userId)),
      memberData,
    );
    console.log("✅ Member document created");

    // 3. Create some sample departments
    const departments = [
      {
        name: "Engineering",
        description: "Software development team",
        headCount: 0,
      },
      {
        name: "Human Resources",
        description: "HR and people operations",
        headCount: 0,
      },
      {
        name: "Marketing",
        description: "Marketing and communications",
        headCount: 0,
      },
    ];

    for (const dept of departments) {
      await addDoc(collection(db, paths.departments(config.tenantId)), {
        ...dept,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log("✅ Sample departments created");

    console.log("🎉 Default tenant setup completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to create default tenant:", error);
    return false;
  }
};

/**
 * Generate a unique tenant ID
 */
export const generateTenantId = (userEmail: string): string => {
  const emailPrefix = userEmail.split("@")[0];
  const timestamp = Date.now().toString().slice(-6);
  return `tenant-${emailPrefix}-${timestamp}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
};

/**
 * Generate tenant name from user email
 */
export const generateTenantName = (userEmail: string): string => {
  const emailPrefix = userEmail.split("@")[0];
  return `${emailPrefix}'s Company`;
};

/**
 * Auto-setup tenant for authenticated user if they don't have access
 */
export const autoSetupTenantForUser = async (
  userId: string,
  userEmail: string,
): Promise<boolean> => {
  try {
    const tenantId = generateTenantId(userEmail);
    const tenantName = generateTenantName(userEmail);

    const config: TenantSetupConfig = {
      tenantId,
      tenantName,
      userEmail,
      userId,
      role: "owner",
    };

    const success = await createDefaultTenant(config);

    if (success) {
      console.log(
        "✅ Auto-setup completed. User should now have tenant access.",
      );
      // Store the tenant ID in localStorage for quick access
      localStorage.setItem("currentTenantId", tenantId);
    }

    return success;
  } catch (error) {
    console.error("❌ Auto-setup failed:", error);
    return false;
  }
};
