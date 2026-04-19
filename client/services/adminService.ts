/**
 * Admin service for superadmin operations
 * Manages tenants, users, packages, approvals, and audit logging
 */

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db, getFunctionsLazy } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import {
  EmployeePricingTier,
  ModulePrice,
  PackagesConfig,
  SuperAdminRequest,
} from "@/types/admin";
import { TenantConfig, TenantPlan, TenantStatus, PLAN_LIMITS } from "@/types/tenant";
import { AdminAuditEntry, AuditLogEntry, UserProfile } from "@/types/user";

export type { AuditLogEntry };

export interface TenantProfileInput {
  name: string;
  tradingName?: string;
  tinNumber?: string;
  address?: string;
  phone?: string;
  ownerEmail: string;
  billingEmail?: string;
  currentEmployeeCount?: number;
  plan: TenantPlan;
}

type LegacyTenantLimits = {
  employees?: number;
  members?: number;
  storage?: number;
};

type TenantSettingsDoc = {
  companyDetails?: {
    legalName?: string;
    tradingName?: string;
    tinNumber?: string;
    registeredAddress?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  subscriptionPaidUntil?: unknown;
  monthlySubscriptionAmount?: unknown;
  billing?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
};

const VALID_STATUSES: TenantStatus[] = ["active", "suspended", "pending", "cancelled"];
const VALID_PLANS: TenantPlan[] = ["free", "starter", "professional", "enterprise"];

const DEFAULT_MODULE_PRICES: ModulePrice[] = [
  { id: "people", label: "People", monthlyPrice: 75 },
  { id: "timeleave", label: "Time & Leave", monthlyPrice: 45 },
  { id: "payroll", label: "Payroll", monthlyPrice: 95 },
  { id: "money", label: "Money", monthlyPrice: 65 },
  { id: "accounting", label: "Accounting", monthlyPrice: 85 },
  { id: "reports", label: "Reports", monthlyPrice: 35 },
];

const DEFAULT_EMPLOYEE_TIERS: EmployeePricingTier[] = [
  { id: "tier-1-10", minEmployees: 1, maxEmployees: 10, pricePerEmployee: 4 },
  { id: "tier-11-20", minEmployees: 11, maxEmployees: 20, pricePerEmployee: 3.5 },
  { id: "tier-21-30", minEmployees: 21, maxEmployees: 30, pricePerEmployee: 3 },
  { id: "tier-31-50", minEmployees: 31, maxEmployees: 50, pricePerEmployee: 2.5 },
  { id: "tier-51-plus", minEmployees: 51, maxEmployees: null, pricePerEmployee: 2 },
];

function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
}

function generateTenantId(name: string): string {
  const slug = generateTenantSlug(name);
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

function isValidPlan(value: unknown): value is TenantPlan {
  return typeof value === "string" && VALID_PLANS.includes(value as TenantPlan);
}

function isValidStatus(value: unknown): value is TenantStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as TenantStatus);
}

function getTimestampCandidate(value: unknown): TenantConfig["subscriptionPaidUntil"] | undefined {
  if (!value) return undefined;

  if (
    value instanceof Timestamp ||
    value instanceof Date ||
    (typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof value.toDate === "function")
  ) {
    return value as TenantConfig["subscriptionPaidUntil"];
  }

  return undefined;
}

function getNumberCandidate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toSortTime(value: unknown): number {
  if (!value) return 0;

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }

  return 0;
}

function normalizePackagesConfig(raw: Record<string, unknown> | undefined): PackagesConfig {
  const rawModulePrices = Array.isArray(raw?.modulePrices) ? raw.modulePrices : [];
  const rawEmployeePricingTiers = Array.isArray(raw?.employeePricingTiers)
    ? raw.employeePricingTiers
    : [];

  const modulePrices = DEFAULT_MODULE_PRICES.map((defaultModule) => {
    const match = rawModulePrices.find(
      (item) => typeof item === "object" && item !== null && (item as ModulePrice).id === defaultModule.id,
    ) as Partial<ModulePrice> | undefined;

    return {
      ...defaultModule,
      ...match,
      monthlyPrice: getNumberCandidate(match?.monthlyPrice) ?? defaultModule.monthlyPrice,
    };
  });

  const employeePricingTiers = (
    rawEmployeePricingTiers.length > 0 ? rawEmployeePricingTiers : DEFAULT_EMPLOYEE_TIERS
  )
    .map((tier, index) => {
      const typedTier = (tier ?? {}) as Partial<EmployeePricingTier>;
      return {
        id: typedTier.id || `tier-${index + 1}`,
        minEmployees: Math.max(0, getNumberCandidate(typedTier.minEmployees) ?? 0),
        maxEmployees:
          typedTier.maxEmployees === null
            ? null
            : Math.max(0, getNumberCandidate(typedTier.maxEmployees) ?? 0) || null,
        pricePerEmployee: Math.max(0, getNumberCandidate(typedTier.pricePerEmployee) ?? 0),
      };
    })
    .sort((left, right) => left.minEmployees - right.minEmployees);

  return {
    modulePrices,
    employeePricingTiers,
    updatedAt: getTimestampCandidate(raw?.updatedAt),
    updatedBy: typeof raw?.updatedBy === "string" ? raw.updatedBy : undefined,
    updatedByEmail: typeof raw?.updatedByEmail === "string" ? raw.updatedByEmail : undefined,
  };
}

function resolveEmployeeTierPrice(config: PackagesConfig, employeeCount: number): number {
  if (employeeCount <= 0) return 0;

  const tier = config.employeePricingTiers.find((candidate) => {
    const withinMin = employeeCount >= candidate.minEmployees;
    const withinMax = candidate.maxEmployees === null || employeeCount <= candidate.maxEmployees;
    return withinMin && withinMax;
  });

  return tier?.pricePerEmployee ?? 0;
}

function getBillableModulesForTenant(tenant: TenantConfig): ModulePrice["id"][] {
  const billableModules: ModulePrice["id"][] = ["people"];

  if (tenant.features?.timeleave !== false) billableModules.push("timeleave");
  if (tenant.features?.payroll !== false) billableModules.push("payroll");
  if (tenant.features?.money !== false) billableModules.push("money");
  if (tenant.features?.accounting !== false) billableModules.push("accounting");
  if (tenant.features?.reports !== false) billableModules.push("reports");

  return billableModules;
}

function calculateMonthlySubscription(tenant: TenantConfig, packagesConfig: PackagesConfig): number {
  const moduleTotal = getBillableModulesForTenant(tenant).reduce((sum, moduleId) => {
    const modulePrice = packagesConfig.modulePrices.find((item) => item.id === moduleId)?.monthlyPrice ?? 0;
    return sum + modulePrice;
  }, 0);

  const employeeCount = Math.max(0, tenant.currentEmployeeCount ?? 0);
  const employeeRate = resolveEmployeeTierPrice(packagesConfig, employeeCount);
  const total = moduleTotal + employeeCount * employeeRate;

  return Math.round(total * 100) / 100;
}

function normalizeTenantConfig(tenantId: string, data: Record<string, unknown>): TenantConfig {
  const rawLimits = data.limits as TenantConfig["limits"] | LegacyTenantLimits | undefined;
  let limits = rawLimits;

  if (
    rawLimits &&
    typeof rawLimits === "object" &&
    ("employees" in rawLimits || "members" in rawLimits || "storage" in rawLimits)
  ) {
    const legacy = rawLimits as LegacyTenantLimits;
    limits = {
      maxEmployees: (rawLimits as TenantConfig["limits"])?.maxEmployees ?? legacy.employees ?? 0,
      maxUsers: (rawLimits as TenantConfig["limits"])?.maxUsers ?? legacy.members ?? 0,
      storageGB: (rawLimits as TenantConfig["limits"])?.storageGB ?? legacy.storage ?? 0,
    };
  }

  const plan = isValidPlan(data.plan) ? data.plan : "free";
  const status = isValidStatus(data.status) ? data.status : "active";

  return {
    ...data,
    id: tenantId,
    plan,
    status,
    name: typeof data.name === "string" ? data.name : tenantId,
    slug: typeof data.slug === "string" ? data.slug : tenantId,
    legalName: typeof data.legalName === "string" ? data.legalName : undefined,
    tradingName: typeof data.tradingName === "string" ? data.tradingName : undefined,
    tinNumber: typeof data.tinNumber === "string" ? data.tinNumber : undefined,
    address: typeof data.address === "string" ? data.address : undefined,
    phone: typeof data.phone === "string" ? data.phone : undefined,
    ownerEmail: typeof data.ownerEmail === "string" ? data.ownerEmail : undefined,
    billingEmail: typeof data.billingEmail === "string" ? data.billingEmail : undefined,
    currentEmployeeCount: Math.max(0, getNumberCandidate(data.currentEmployeeCount) ?? 0),
    ...(limits ? { limits } : {}),
  } as TenantConfig;
}

function enrichTenantConfig(
  tenant: TenantConfig,
  settingsRaw: Record<string, unknown> | undefined,
  packagesConfig?: PackagesConfig,
): TenantConfig {
  const tenantRecord = tenant as TenantConfig & {
    billing?: Record<string, unknown>;
    subscription?: Record<string, unknown>;
  };

  const settings = (settingsRaw ?? {}) as TenantSettingsDoc;
  const companyDetails = settings.companyDetails ?? {};
  const billing = settings.billing ?? tenantRecord.billing ?? {};
  const subscription = settings.subscription ?? tenantRecord.subscription ?? {};
  const addressParts = [
    companyDetails.registeredAddress,
    companyDetails.city,
    companyDetails.country,
  ].filter(Boolean);

  const enriched: TenantConfig = {
    ...tenant,
    legalName: companyDetails.legalName?.trim() || tenant.legalName,
    tradingName: companyDetails.tradingName?.trim() || tenant.tradingName,
    tinNumber: companyDetails.tinNumber?.trim() || tenant.tinNumber,
    phone: companyDetails.phone?.trim() || tenant.phone,
    address: addressParts.length > 0 ? addressParts.join(", ") : tenant.address,
    billingEmail: companyDetails.email?.trim() || tenant.billingEmail,
    subscriptionPaidUntil:
      getTimestampCandidate(tenant.subscriptionPaidUntil) ??
      getTimestampCandidate(settings.subscriptionPaidUntil) ??
      getTimestampCandidate(subscription.paidUntil) ??
      getTimestampCandidate(subscription.currentPeriodEnd) ??
      getTimestampCandidate(subscription.renewsAt) ??
      getTimestampCandidate(billing.paidUntil) ??
      getTimestampCandidate(billing.currentPeriodEnd),
    monthlySubscriptionAmount:
      getNumberCandidate(tenant.monthlySubscriptionAmount) ??
      getNumberCandidate(settings.monthlySubscriptionAmount) ??
      getNumberCandidate(subscription.monthlyAmount) ??
      getNumberCandidate(subscription.amount) ??
      getNumberCandidate(subscription.price) ??
      getNumberCandidate(billing.monthlyAmount) ??
      getNumberCandidate(billing.amount) ??
      getNumberCandidate(billing.price),
  };

  if (typeof enriched.monthlySubscriptionAmount !== "number" && packagesConfig) {
    enriched.monthlySubscriptionAmount = calculateMonthlySubscription(enriched, packagesConfig);
  }

  return enriched;
}

function normalizeSuperAdminRequest(docId: string, data: Record<string, unknown>): SuperAdminRequest {
  return {
    id: docId,
    type: data.type === "revoke" ? "revoke" : "grant",
    status:
      data.status === "awaiting_user" || data.status === "approved" || data.status === "rejected"
        ? data.status
        : "awaiting_confirmation",
    targetEmail: typeof data.targetEmail === "string" ? data.targetEmail : "",
    targetUid: typeof data.targetUid === "string" ? data.targetUid : undefined,
    targetDisplayName: typeof data.targetDisplayName === "string" ? data.targetDisplayName : undefined,
    requestedByUid: typeof data.requestedByUid === "string" ? data.requestedByUid : "",
    requestedByEmail: typeof data.requestedByEmail === "string" ? data.requestedByEmail : "",
    requestedByName: typeof data.requestedByName === "string" ? data.requestedByName : undefined,
    requestedAt: getTimestampCandidate(data.requestedAt),
    approvedByUid: typeof data.approvedByUid === "string" ? data.approvedByUid : undefined,
    approvedByEmail: typeof data.approvedByEmail === "string" ? data.approvedByEmail : undefined,
    approvedAt: getTimestampCandidate(data.approvedAt),
    note: typeof data.note === "string" ? data.note : undefined,
  };
}

async function queuePlatformEmail(params: {
  to: string[];
  subject: string;
  html: string;
  createdBy: string;
  relatedId?: string;
}): Promise<void> {
  if (!db || params.to.length === 0) return;

  try {
    await addDoc(collection(db, "mail"), {
      tenantId: "platform",
      to: params.to,
      subject: params.subject,
      html: params.html,
      status: "pending",
      createdAt: serverTimestamp(),
      createdBy: params.createdBy,
      purpose: "notification",
      relatedId: params.relatedId,
    });
  } catch (error) {
    console.warn("Admin notification email could not be queued:", error);
  }
}

class AdminService {
  async getPackagesConfig(): Promise<PackagesConfig> {
    if (!db) {
      return normalizePackagesConfig(undefined);
    }

    try {
      const configRef = doc(db, paths.packagesConfig());
      const snapshot = await getDoc(configRef);
      return normalizePackagesConfig(snapshot.exists() ? snapshot.data() : undefined);
    } catch (error) {
      console.error("Error fetching packages config:", error);
      return normalizePackagesConfig(undefined);
    }
  }

  async savePackagesConfig(config: PackagesConfig, actorUid: string, actorEmail: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    const sanitized: PackagesConfig = {
      modulePrices: config.modulePrices.map((modulePrice) => ({
        ...modulePrice,
        monthlyPrice: Math.max(0, modulePrice.monthlyPrice),
      })),
      employeePricingTiers: config.employeePricingTiers
        .map((tier) => ({
          ...tier,
          minEmployees: Math.max(0, tier.minEmployees),
          maxEmployees: tier.maxEmployees === null ? null : Math.max(0, tier.maxEmployees),
          pricePerEmployee: Math.max(0, tier.pricePerEmployee),
        }))
        .sort((left, right) => left.minEmployees - right.minEmployees),
      updatedBy: actorUid,
      updatedByEmail: actorEmail,
    };

    await setDoc(
      doc(db, paths.packagesConfig()),
      {
        ...sanitized,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async getAllTenants(): Promise<TenantConfig[]> {
    if (!db) return [];

    try {
      const [packagesConfig, snapshot] = await Promise.all([
        this.getPackagesConfig(),
        getDocs(collection(db, paths.tenants())),
      ]);

      const tenants = await Promise.all(
        snapshot.docs.map(async (tenantDoc) => {
          const tenant = normalizeTenantConfig(tenantDoc.id, tenantDoc.data());
          const settingsSnap = await getDoc(doc(db, paths.settings(tenantDoc.id)));
          return enrichTenantConfig(
            tenant,
            settingsSnap.exists() ? settingsSnap.data() : undefined,
            packagesConfig,
          );
        }),
      );

      return tenants.sort((left, right) => toSortTime(right.createdAt) - toSortTime(left.createdAt));
    } catch (error) {
      console.error("Error fetching tenants:", error);
      throw error;
    }
  }

  async getTenantById(tenantId: string): Promise<TenantConfig | null> {
    if (!db) return null;

    try {
      const [packagesConfig, snapshot] = await Promise.all([
        this.getPackagesConfig(),
        getDoc(doc(db, paths.tenant(tenantId))),
      ]);

      if (!snapshot.exists()) return null;

      const tenant = normalizeTenantConfig(snapshot.id, snapshot.data());
      const settingsSnap = await getDoc(doc(db, paths.settings(tenantId)));

      return enrichTenantConfig(
        tenant,
        settingsSnap.exists() ? settingsSnap.data() : undefined,
        packagesConfig,
      );
    } catch (error) {
      console.error("Error fetching tenant:", error);
      throw error;
    }
  }

  async createTenant(input: TenantProfileInput, createdBy: string, actorEmail: string): Promise<string> {
    if (!db) throw new Error("Database not available");

    const name = input.name.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const billingEmail = (input.billingEmail || input.ownerEmail).trim().toLowerCase();
    const address = input.address?.trim() || "";
    const currentEmployeeCount = Math.max(0, Number(input.currentEmployeeCount || 0));

    try {
      const tenantId = generateTenantId(name);
      const { httpsCallable } = await import("firebase/functions");
      const provisionTenant = httpsCallable<
        {
          name: string;
          ownerEmail: string;
          slug: string;
          config: {
            features: TenantConfig["features"];
            settings: TenantConfig["settings"];
            companyDetails: Record<string, unknown>;
          };
        },
        { tenantId: string; ownerUid: string; message: string }
      >(await getFunctionsLazy(), "provisionTenant");

      const features: TenantConfig["features"] = {
        hiring: true,
        timeleave: true,
        performance: true,
        payroll: input.plan !== "free",
        money: true,
        accounting: true,
        reports: true,
      };
      const settings: TenantConfig["settings"] = {
        timezone: "Asia/Dili",
        currency: "USD",
        dateFormat: "DD/MM/YYYY",
      };
      const companyDetails = {
        legalName: name,
        tradingName: input.tradingName?.trim() || "",
        tinNumber: input.tinNumber?.trim() || "",
        registeredAddress: address,
        city: "",
        country: "Timor-Leste",
        phone: input.phone?.trim() || "",
        email: billingEmail,
      };

      const result = await provisionTenant({
        name,
        ownerEmail,
        slug: tenantId,
        config: { features, settings, companyDetails },
      });

      const createdTenantId = result.data.tenantId;
      const ownerUid = result.data.ownerUid;
      const tenantRef = doc(db, paths.tenant(createdTenantId));
      const tenantSettingsRef = doc(db, paths.settings(createdTenantId));

      await Promise.all([
        updateDoc(tenantRef, {
          status: "active",
          plan: input.plan,
          limits: PLAN_LIMITS[input.plan],
          ownerEmail,
          billingEmail,
          currentEmployeeCount,
          phone: input.phone?.trim() || "",
          address,
          tinNumber: input.tinNumber?.trim() || "",
          legalName: name,
          tradingName: input.tradingName?.trim() || "",
          createdBy,
          features,
          settings,
          updatedAt: serverTimestamp(),
        }),
        setDoc(
          tenantSettingsRef,
          {
            companyDetails,
            features,
            settings,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      await this.logAdminAction({
        action: "tenant_created",
        actorUid: createdBy,
        actorEmail,
        targetType: "tenant",
        targetId: createdTenantId,
        targetName: name,
        details: { plan: input.plan, ownerUid, ownerEmail, billingEmail, currentEmployeeCount },
        timestamp: Timestamp.now(),
      });

      return createdTenantId;
    } catch (error) {
      console.error("Error creating tenant:", error);
      throw error;
    }
  }

  async updateTenantProfile(tenantId: string, input: TenantProfileInput): Promise<void> {
    if (!db) throw new Error("Database not available");

    const tenantRef = doc(db, paths.tenant(tenantId));
    const settingsRef = doc(db, paths.settings(tenantId));
    const address = input.address?.trim() || "";
    const billingEmail = (input.billingEmail || input.ownerEmail).trim().toLowerCase();

    await Promise.all([
      updateDoc(tenantRef, {
        name: input.name.trim(),
        legalName: input.name.trim(),
        tradingName: input.tradingName?.trim() || "",
        tinNumber: input.tinNumber?.trim() || "",
        address,
        phone: input.phone?.trim() || "",
        ownerEmail: input.ownerEmail.trim().toLowerCase(),
        billingEmail,
        currentEmployeeCount: Math.max(0, Number(input.currentEmployeeCount || 0)),
        plan: input.plan,
        limits: PLAN_LIMITS[input.plan],
        updatedAt: serverTimestamp(),
      }),
      setDoc(
        settingsRef,
        {
          companyDetails: {
            legalName: input.name.trim(),
            tradingName: input.tradingName?.trim() || "",
            tinNumber: input.tinNumber?.trim() || "",
            registeredAddress: address,
            city: "",
            country: "Timor-Leste",
            phone: input.phone?.trim() || "",
            email: billingEmail,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  }

  async updateTenant(tenantId: string, updates: Partial<TenantConfig>): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      await updateDoc(doc(db, paths.tenant(tenantId)), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating tenant:", error);
      throw error;
    }
  }

  async suspendTenant(tenantId: string, reason: string, actorUid: string, actorEmail: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        throw new Error("Tenant not found");
      }

      await updateDoc(tenantRef, {
        status: "suspended" as TenantStatus,
        suspendedAt: serverTimestamp(),
        suspendedBy: actorUid,
        suspendedReason: reason,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: "tenant_suspended",
        actorUid,
        actorEmail,
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantSnap.data()?.name,
        details: { reason },
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error suspending tenant:", error);
      throw error;
    }
  }

  async reactivateTenant(tenantId: string, actorUid: string, actorEmail: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        throw new Error("Tenant not found");
      }

      await updateDoc(tenantRef, {
        status: "active" as TenantStatus,
        suspendedAt: null,
        suspendedBy: null,
        suspendedReason: null,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: "tenant_reactivated",
        actorUid,
        actorEmail,
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantSnap.data()?.name,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error reactivating tenant:", error);
      throw error;
    }
  }

  async getTenantStats(tenantId: string): Promise<{ memberCount: number; employeeCount: number }> {
    if (!db) return { memberCount: 0, employeeCount: 0 };

    try {
      const [membersSnap, employeesSnap] = await Promise.all([
        getCountFromServer(query(collection(db, paths.members(tenantId)))),
        getCountFromServer(query(collection(db, paths.employees(tenantId)))),
      ]);

      return {
        memberCount: membersSnap.data().count,
        employeeCount: employeesSnap.data().count,
      };
    } catch (error) {
      console.error("Error fetching tenant stats:", error);
      return { memberCount: 0, employeeCount: 0 };
    }
  }

  async getAllUsers(maxResults = 500): Promise<UserProfile[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(collection(db, paths.users()), orderBy("createdAt", "desc"), limit(maxResults)),
      );
      return snapshot.docs.map((userDoc) => ({ uid: userDoc.id, ...userDoc.data() })) as UserProfile[];
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  async getUserById(uid: string): Promise<UserProfile | null> {
    if (!db) return null;

    try {
      const snapshot = await getDoc(doc(db, paths.user(uid)));
      if (!snapshot.exists()) return null;
      return { uid: snapshot.id, ...snapshot.data() } as UserProfile;
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  }

  async setUserSuperadmin(targetUid: string, isSuperAdmin: boolean, actorUid: string, actorEmail: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      const userRef = doc(db, paths.user(targetUid));
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User not found");
      }

      await updateDoc(userRef, {
        isSuperAdmin,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: isSuperAdmin ? "user_superadmin_granted" : "user_superadmin_revoked",
        actorUid,
        actorEmail,
        targetType: "user",
        targetId: targetUid,
        targetName: userSnap.data()?.email,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error setting user superadmin status:", error);
      throw error;
    }
  }

  async setSuperadmin(targetUid: string, isSuperAdmin: boolean): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      const userRef = doc(db, paths.user(targetUid));
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User not found");
      }

      await updateDoc(userRef, {
        isSuperAdmin,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error setting superadmin status:", error);
      throw error;
    }
  }

  async getSuperAdminRequests(): Promise<SuperAdminRequest[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(collection(db, paths.superAdminRequests()), orderBy("requestedAt", "desc")),
      );
      return snapshot.docs.map((requestDoc) =>
        normalizeSuperAdminRequest(requestDoc.id, requestDoc.data()),
      );
    } catch (error) {
      console.error("Error fetching superadmin requests:", error);
      return [];
    }
  }

  async requestSuperAdminChange(params: {
    type: "grant" | "revoke";
    targetEmail: string;
    targetUid?: string;
    targetDisplayName?: string;
    requestedByUid: string;
    requestedByEmail: string;
    requestedByName?: string;
  }): Promise<string> {
    if (!db) throw new Error("Database not available");

    const targetEmail = params.targetEmail.trim().toLowerCase();
    const requestsRef = collection(db, paths.superAdminRequests());
    const requestRef = doc(requestsRef);

    await setDoc(requestRef, {
      type: params.type,
      status: "awaiting_confirmation",
      targetEmail,
      targetUid: params.targetUid || null,
      targetDisplayName: params.targetDisplayName || null,
      requestedByUid: params.requestedByUid,
      requestedByEmail: params.requestedByEmail,
      requestedByName: params.requestedByName || null,
      requestedAt: serverTimestamp(),
    });

    const users = await this.getAllUsers();
    const approverEmails = users
      .filter(
        (user) =>
          user.isSuperAdmin &&
          user.email &&
          user.email.toLowerCase() !== params.requestedByEmail.toLowerCase(),
      )
      .map((user) => user.email);

    await queuePlatformEmail({
      to: approverEmails,
      subject:
        params.type === "grant"
          ? "Superadmin access approval requested"
          : "Superadmin removal approval requested",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2>Admin Console approval needed</h2>
          <p>${params.requestedByEmail} requested to ${
            params.type === "grant" ? "grant" : "remove"
          } superadmin access for <strong>${targetEmail}</strong>.</p>
          <p>Please review the request in the Admin Console.</p>
        </div>
      `,
      createdBy: params.requestedByUid,
      relatedId: requestRef.id,
    });

    return requestRef.id;
  }

  async approveSuperAdminRequest(params: {
    requestId: string;
    approverUid: string;
    approverEmail: string;
  }): Promise<SuperAdminRequest> {
    if (!db) throw new Error("Database not available");

    const requestRef = doc(db, paths.superAdminRequest(params.requestId));
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error("Approval request not found");
    }

    const request = normalizeSuperAdminRequest(requestSnap.id, requestSnap.data());
    if (request.requestedByUid === params.approverUid) {
      throw new Error("A different superadmin must confirm this request");
    }

    const users = await this.getAllUsers();
    const matchedUser = users.find(
      (user) => user.email?.toLowerCase() === request.targetEmail.toLowerCase(),
    );

    if (request.type === "grant") {
      if (!matchedUser) {
        await updateDoc(requestRef, {
          status: "awaiting_user",
          approvedByUid: params.approverUid,
          approvedByEmail: params.approverEmail,
          approvedAt: serverTimestamp(),
        });

        await queuePlatformEmail({
          to: [request.targetEmail],
          subject: "Your Meza superadmin access is waiting",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2>Superadmin access is ready</h2>
              <p>An existing superadmin approved access for <strong>${request.targetEmail}</strong>.</p>
              <p>Please sign in to Meza with this email address, then ask an existing superadmin to complete the activation from the Super Admins page.</p>
            </div>
          `,
          createdBy: params.approverUid,
          relatedId: request.id,
        });
      } else {
        await this.setUserSuperadmin(
          matchedUser.uid,
          true,
          params.approverUid,
          params.approverEmail,
        );
        await updateDoc(requestRef, {
          status: "approved",
          targetUid: matchedUser.uid,
          approvedByUid: params.approverUid,
          approvedByEmail: params.approverEmail,
          approvedAt: serverTimestamp(),
        });
      }
    } else {
      const revokeUser = matchedUser ?? users.find((user) => user.uid === request.targetUid);
      if (!revokeUser?.uid) {
        throw new Error("Target superadmin could not be found");
      }

      await this.setUserSuperadmin(
        revokeUser.uid,
        false,
        params.approverUid,
        params.approverEmail,
      );
      await updateDoc(requestRef, {
        status: "approved",
        targetUid: revokeUser.uid,
        approvedByUid: params.approverUid,
        approvedByEmail: params.approverEmail,
        approvedAt: serverTimestamp(),
      });
    }

    const finalSnap = await getDoc(requestRef);
    return normalizeSuperAdminRequest(finalSnap.id, finalSnap.data() || {});
  }

  async startImpersonation(actorUid: string, actorEmail: string, tenantId: string, tenantName: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      await updateDoc(doc(db, paths.user(actorUid)), {
        impersonating: {
          tenantId,
          tenantName,
          startedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: "impersonation_started",
        actorUid,
        actorEmail,
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      throw error;
    }
  }

  async stopImpersonation(actorUid: string, actorEmail: string, tenantId: string, tenantName: string): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      await updateDoc(doc(db, paths.user(actorUid)), {
        impersonating: null,
        updatedAt: serverTimestamp(),
      });

      await this.logAdminAction({
        action: "impersonation_ended",
        actorUid,
        actorEmail,
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      throw error;
    }
  }

  async logAdminAction(entry: AdminAuditEntry): Promise<void> {
    if (!db) return;

    try {
      const logRef = collection(db, paths.adminAuditLog());
      const docRef = doc(logRef);
      await setDoc(docRef, {
        ...entry,
        id: docRef.id,
      });
    } catch (error) {
      console.error("Error logging admin action:", error);
    }
  }

  async getAuditLog(maxResults = 50): Promise<AdminAuditEntry[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(collection(db, paths.adminAuditLog()), orderBy("timestamp", "desc"), limit(maxResults)),
      );
      return snapshot.docs.map((logDoc) => logDoc.data() as AdminAuditEntry);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
