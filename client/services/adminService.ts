/**
 * Admin service for superadmin operations
 * Manages tenants, users, packages, approvals, and audit logging
 */

import {
  collection,
  deleteDoc,
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
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getFunctionsLazy } from "@/lib/firebase";
import {
  calculatePackageEstimate,
  isTenantSubscribed,
  normalizeBillingPackagesConfig,
} from "@/lib/packagePricing";
import { roundMoney } from "@/lib/currency";
import { notificationService } from "@/services/notificationService";
import { paths } from "@/lib/paths";
import { PackagesConfig, SuperAdminRequest } from "@/types/admin";
import {
  ModulePermission,
  PLAN_LIMITS,
  TenantConfig,
  TenantMember,
  TenantPlan,
  TenantRole,
  TenantStatus,
} from "@/types/tenant";
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

const VALID_STATUSES: TenantStatus[] = [
  "active",
  "suspended",
  "pending",
  "cancelled",
];
const VALID_PLANS: TenantPlan[] = [
  "free",
  "starter",
  "professional",
  "enterprise",
];

/**
 * Tenant data lives in two generations (see CLAUDE.md "Firestore Data Layout"):
 *   (a) subcollections under tenants/{tid}/... and
 *   (b) top-level collections carrying a `tenantId` FIELD.
 * Firestore doc deletes do NOT cascade, so deleteTenant() must sweep BOTH.
 * These lists MIRROR the Admin-SDK sweeps in scripts/delete-tenant.mjs and
 * scripts/wipe-tenant-data.mjs — keep all three in sync.
 */

// (a) Known subcollections under tenants/{tid}. The client SDK cannot enumerate
//     subcollections, so they are listed explicitly (source: client/lib/paths.ts).
//     `members` is intentionally omitted here — it is deleted LAST (membership
//     drives firestore.rules access; see deleteTenant).
const TENANT_SUBCOLLECTIONS = [
  "settings",
  "departments",
  "employees",
  "positions",
  "jobs",
  "candidates",
  "interviews",
  "offers",
  "contracts",
  "employmentSnapshots",
  "shifts",
  "timesheets",
  "goals",
  "reviews",
  "trainings",
  "discipline",
  "auditLogs",
  "archives",
  "document_alerts",
  "qbExportLogs",
  "promotionSignals",
  "payruns",
  "accounts",
  "journalEntries",
  "generalLedger",
  "fiscalYears",
  "fiscalPeriods",
  "balanceSnapshots",
  "customers",
  "invoices",
  "recurring_invoices",
  "payments_received",
  "vendors",
  "bills",
  "bill_payments",
  "supplierWithholdingPeriods",
  "supplierWithholdingRemittances",
  "taxClearanceRequests",
  "cashAdvances",
  "cashAdvanceClearings",
  "expenses",
  "bankTransactions",
  "analytics",
  "holidays",
  "vatReturns",
  "face_embeddings",
];

// (b) Top-level collections keyed by a `tenantId` FIELD. Mirrors ROOT_COLLECTIONS
//     in the delete/wipe scripts. (Legacy `payruns` and `tenant_settings` are
//     handled separately in deleteTenant — see there.)
const TENANT_KEYED_ROOT_COLLECTIONS = [
  "departments",
  "employees",
  "positions",
  "jobs",
  "candidates",
  "interviews",
  "offers",
  "contracts",
  "timesheets",
  "leavePolicies",
  "leaveRequests",
  "leaveBalances",
  "leave_requests",
  "leave_balances",
  "goals",
  "reviews",
  "trainings",
  "disciplinary",
  "customers",
  "invoices",
  "recurring_invoices",
  "payments_received",
  "vendors",
  "bills",
  "bill_payments",
  "expenses",
  "holidays",
  "payrollRuns",
  "payrollRecords",
  "benefitEnrollments",
  "recurringDeductions",
  "taxReports",
  "taxFilings",
  "bankTransfers",
  "attendance",
  "attendanceImports",
  "analytics",
  "invoice_links",
  "okrs",
  "jobPrivateDetails",
  "jobApplications",
  "onboarding",
  "offboarding",
  "mail",
  "audit_logs",
];

/** Escape user-controlled values interpolated into email HTML (emails can
 * legally contain &, quotes and other specials). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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
  return (
    typeof value === "string" && VALID_STATUSES.includes(value as TenantStatus)
  );
}

function getTimestampCandidate(
  value: unknown,
): TenantConfig["subscriptionPaidUntil"] | undefined {
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

function normalizePackagesConfig(
  raw: Record<string, unknown> | undefined,
): PackagesConfig {
  const normalized = normalizeBillingPackagesConfig(raw);
  return {
    ...normalized,
    updatedAt: getTimestampCandidate(raw?.updatedAt),
    updatedBy: typeof raw?.updatedBy === "string" ? raw.updatedBy : undefined,
    updatedByEmail:
      typeof raw?.updatedByEmail === "string" ? raw.updatedByEmail : undefined,
  };
}

function calculateMonthlySubscription(
  tenant: TenantConfig,
  packagesConfig: PackagesConfig,
): number {
  // Flat per-employee billing: employees × the single rate.
  const estimate = calculatePackageEstimate(packagesConfig, {
    employeeCount: tenant.currentEmployeeCount ?? 0,
  });

  return estimate.monthlyTotal;
}

function normalizeTenantConfig(
  tenantId: string,
  data: Record<string, unknown>,
): TenantConfig {
  const rawLimits = data.limits as
    | TenantConfig["limits"]
    | LegacyTenantLimits
    | undefined;
  let limits = rawLimits;

  if (
    rawLimits &&
    typeof rawLimits === "object" &&
    ("employees" in rawLimits ||
      "members" in rawLimits ||
      "storage" in rawLimits)
  ) {
    const legacy = rawLimits as LegacyTenantLimits;
    limits = {
      maxEmployees:
        (rawLimits as TenantConfig["limits"])?.maxEmployees ??
        legacy.employees ??
        0,
      maxUsers:
        (rawLimits as TenantConfig["limits"])?.maxUsers ?? legacy.members ?? 0,
      storageGB:
        (rawLimits as TenantConfig["limits"])?.storageGB ?? legacy.storage ?? 0,
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
    tradingName:
      typeof data.tradingName === "string" ? data.tradingName : undefined,
    tinNumber: typeof data.tinNumber === "string" ? data.tinNumber : undefined,
    address: typeof data.address === "string" ? data.address : undefined,
    phone: typeof data.phone === "string" ? data.phone : undefined,
    ownerEmail:
      typeof data.ownerEmail === "string" ? data.ownerEmail : undefined,
    billingEmail:
      typeof data.billingEmail === "string" ? data.billingEmail : undefined,
    currentEmployeeCount: Math.max(
      0,
      getNumberCandidate(data.currentEmployeeCount) ?? 0,
    ),
    currentAdminCount: Math.max(
      0,
      getNumberCandidate(data.currentAdminCount) ?? 1,
    ),
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

  // Only estimate a missing amount for tenants that actually HAVE a live
  // subscription — fabricating one for free tenants made them look like
  // paying customers in the admin console.
  if (
    typeof enriched.monthlySubscriptionAmount !== "number" &&
    packagesConfig &&
    isTenantSubscribed(enriched)
  ) {
    enriched.monthlySubscriptionAmount = calculateMonthlySubscription(
      enriched,
      packagesConfig,
    );
  }

  return enriched;
}

function normalizeSuperAdminRequest(
  docId: string,
  data: Record<string, unknown>,
): SuperAdminRequest {
  return {
    id: docId,
    type: data.type === "revoke" ? "revoke" : "grant",
    status:
      data.status === "awaiting_user" ||
      data.status === "approved" ||
      data.status === "rejected"
        ? data.status
        : "awaiting_confirmation",
    targetEmail: typeof data.targetEmail === "string" ? data.targetEmail : "",
    targetUid: typeof data.targetUid === "string" ? data.targetUid : undefined,
    targetDisplayName:
      typeof data.targetDisplayName === "string"
        ? data.targetDisplayName
        : undefined,
    requestedByUid:
      typeof data.requestedByUid === "string" ? data.requestedByUid : "",
    requestedByEmail:
      typeof data.requestedByEmail === "string" ? data.requestedByEmail : "",
    requestedByName:
      typeof data.requestedByName === "string"
        ? data.requestedByName
        : undefined,
    requestedAt: getTimestampCandidate(data.requestedAt),
    approvedByUid:
      typeof data.approvedByUid === "string" ? data.approvedByUid : undefined,
    approvedByEmail:
      typeof data.approvedByEmail === "string"
        ? data.approvedByEmail
        : undefined,
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
    // Internal admin recipients — a shared "to" is fine here (perRecipient: false)
    await notificationService.queueEmail({
      tenantId: "platform",
      to: params.to,
      subject: params.subject,
      html: params.html,
      createdBy: params.createdBy,
      purpose: "notification",
      relatedId: params.relatedId,
      perRecipient: false,
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
      return normalizePackagesConfig(
        snapshot.exists() ? snapshot.data() : undefined,
      );
    } catch (error) {
      console.error("Error fetching packages config:", error);
      return normalizePackagesConfig(undefined);
    }
  }

  async savePackagesConfig(
    config: PackagesConfig,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    const sanitized: PackagesConfig = {
      ...normalizeBillingPackagesConfig(config),
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
          const settingsSnap = await getDoc(
            doc(db, paths.settings(tenantDoc.id)),
          );
          return enrichTenantConfig(
            tenant,
            settingsSnap.exists() ? settingsSnap.data() : undefined,
            packagesConfig,
          );
        }),
      );

      return tenants.sort(
        (left, right) =>
          toSortTime(right.createdAt) - toSortTime(left.createdAt),
      );
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

  async createTenant(
    input: TenantProfileInput,
    createdBy: string,
    actorEmail: string,
  ): Promise<string> {
    if (!db) throw new Error("Database not available");

    const name = input.name.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const billingEmail = (input.billingEmail || input.ownerEmail)
      .trim()
      .toLowerCase();
    const address = input.address?.trim() || "";
    const currentEmployeeCount = Math.max(
      0,
      Number(input.currentEmployeeCount || 0),
    );

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
        people: true,
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

      // Seed the standard TL chart of accounts so the tenant's money module
      // posts journals from day one. Non-fatal: the owner can initialize it
      // from the Chart of Accounts page if this fails.
      try {
        const { accountService } = await import("./accountingService");
        await accountService.initializeChartOfAccounts(createdTenantId);
      } catch (err) {
        console.warn(
          "Chart of accounts seeding failed during tenant creation:",
          err,
        );
      }

      await this.logAdminAction({
        action: "tenant_created",
        actorUid: createdBy,
        actorEmail,
        targetType: "tenant",
        targetId: createdTenantId,
        targetName: name,
        details: {
          plan: input.plan,
          ownerUid,
          ownerEmail,
          billingEmail,
          currentEmployeeCount,
        },
        timestamp: Timestamp.now(),
      });

      return createdTenantId;
    } catch (error) {
      console.error("Error creating tenant:", error);
      throw error;
    }
  }

  async updateTenantProfile(
    tenantId: string,
    input: TenantProfileInput,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    const tenantRef = doc(db, paths.tenant(tenantId));
    const settingsRef = doc(db, paths.settings(tenantId));
    const address = input.address?.trim() || "";
    const billingEmail = (input.billingEmail || input.ownerEmail)
      .trim()
      .toLowerCase();

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
        currentEmployeeCount: Math.max(
          0,
          Number(input.currentEmployeeCount || 0),
        ),
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

  async updateTenant(
    tenantId: string,
    updates: Partial<TenantConfig>,
  ): Promise<void> {
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

  /**
   * Record an offline (bank transfer / cash) subscription payment. Manual
   * subscriptions are never open-ended: paid-until extends from
   * max(now, current paid-until) by the given number of months. Mirrors the
   * manual path in isTenantSubscribed() / firestore.rules.
   */
  async recordManualSubscription(
    tenantId: string,
    input: { months: number; amountReceived: number },
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    const months = input.months === 12 ? 12 : 1;
    if (!Number.isFinite(input.amountReceived) || input.amountReceived <= 0) {
      throw new Error("Amount received must be greater than zero");
    }
    const tenantRef = doc(db, paths.tenant(tenantId));
    const tenantSnap = await getDoc(tenantRef);
    if (!tenantSnap.exists()) throw new Error("Tenant not found");
    if (tenantSnap.data().stripeSubscriptionId) {
      throw new Error(
        "End the active Stripe subscription before recording an offline payment",
      );
    }

    const [packagesConfigSnapshot, activeEmployeeSnapshot] = await Promise.all([
      getDoc(doc(db, paths.packagesConfig())),
      getCountFromServer(
        query(
          collection(db, paths.employees(tenantId)),
          where("status", "==", "active"),
        ),
      ),
    ]);
    const packagesConfig = normalizeBillingPackagesConfig(
      packagesConfigSnapshot.exists()
        ? packagesConfigSnapshot.data()
        : undefined,
    );
    const activeEmployees = activeEmployeeSnapshot.data().count;
    const estimate = calculatePackageEstimate(packagesConfig, {
      employeeCount: activeEmployees,
    });
    const expectedAmount =
      months === 12 ? estimate.annualTotal : estimate.monthlyTotal;
    const amountReceived = roundMoney(input.amountReceived);
    if (amountReceived < expectedAmount) {
      throw new Error(
        `Amount received must be at least $${expectedAmount.toFixed(2)}`,
      );
    }

    const current = tenantSnap.data()?.subscriptionPaidUntil as
      | { toDate?: () => Date }
      | undefined;
    const currentDate =
      typeof current?.toDate === "function" ? current.toDate() : null;
    const base =
      currentDate && currentDate.getTime() > Date.now()
        ? currentDate
        : new Date();
    const paidUntil = new Date(base);
    paidUntil.setMonth(paidUntil.getMonth() + months);

    await updateDoc(tenantRef, {
      manualSubscription: true,
      subscriptionPaidUntil: Timestamp.fromDate(paidUntil),
      monthlySubscriptionAmount: estimate.monthlyTotal,
      subscriptionBillingAmount: amountReceived,
      subscriptionBillingInterval: months === 12 ? "year" : "month",
      subscriptionBillingMonths: months,
      subscriptionBilledSeats: estimate.billedEmployees,
      subscriptionAnnualMonthsCharged: estimate.annualMonthsCharged,
      currentEmployeeCount: activeEmployees,
      updatedAt: serverTimestamp(),
    });

    await this.logAdminAction({
      action: "manual_subscription_recorded",
      actorUid,
      actorEmail,
      targetType: "tenant",
      targetId: tenantId,
      targetName: tenantSnap.data()?.name,
      details: {
        months,
        activeEmployees,
        billedSeats: estimate.billedEmployees,
        monthlyAmount: estimate.monthlyTotal,
        expectedAmount,
        amountReceived,
        paidUntil: paidUntil.toISOString(),
      },
      timestamp: Timestamp.now(),
    });
  }

  /** End a manual subscription (paid-until stays for the record; gate closes). */
  async cancelManualSubscription(
    tenantId: string,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    const tenantRef = doc(db, paths.tenant(tenantId));
    const tenantSnap = await getDoc(tenantRef);
    if (!tenantSnap.exists()) throw new Error("Tenant not found");

    await updateDoc(tenantRef, {
      manualSubscription: false,
      updatedAt: serverTimestamp(),
    });

    await this.logAdminAction({
      action: "manual_subscription_cancelled",
      actorUid,
      actorEmail,
      targetType: "tenant",
      targetId: tenantId,
      targetName: tenantSnap.data()?.name,
      details: {},
      timestamp: Timestamp.now(),
    });
  }

  async suspendTenant(
    tenantId: string,
    reason: string,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
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

  async reactivateTenant(
    tenantId: string,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
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

  /**
   * Delete all docs in a top-level collection matching this tenantId, chunked
   * into batches (Firestore caps a write batch at 500; we chunk at 450 for
   * headroom) and re-queried until empty. Non-fatal by design: some legacy
   * collections (e.g. `mail`, `audit_logs`) are immutable to clients by
   * firestore.rules, so a failure here is logged and skipped — residue must be
   * swept by a superadmin running scripts/delete-tenant.mjs (Admin SDK).
   */
  private async sweepRootCollection(
    name: string,
    tenantId: string,
    field: string = "tenantId",
  ): Promise<void> {
    if (!db) return;
    try {
      // Guard bound is pure paranoia against an unexpected non-terminating loop.
      for (let guard = 0; guard < 100000; guard++) {
        const snap = await getDocs(
          query(collection(db, name), where(field, "==", tenantId), limit(450)),
        );
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        if (snap.size < 450) break;
      }
    } catch (error) {
      console.warn(
        `deleteTenant: sweep of top-level '${name}' incomplete:`,
        error,
      );
    }
  }

  /**
   * Delete all docs in a tenant subcollection, chunked. The client SDK has no
   * recursiveDelete, so this does NOT recurse into nested subcollections
   * (e.g. payruns/{yyyymm}/payslips, promotionSignals/{q}/*) — that residue
   * needs scripts/delete-tenant.mjs. When `critical` is true (the `members`
   * subcollection, whose docs grant firestore.rules access), failures propagate
   * so we never report success while access is still live.
   */
  private async sweepTenantSubcollection(
    tenantId: string,
    sub: string,
    critical = false,
  ): Promise<void> {
    if (!db) return;
    try {
      for (let guard = 0; guard < 100000; guard++) {
        const snap = await getDocs(
          query(collection(db, `${paths.tenant(tenantId)}/${sub}`), limit(450)),
        );
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        if (snap.size < 450) break;
      }
    } catch (error) {
      if (critical) throw error;
      console.warn(
        `deleteTenant: sweep of subcollection '${sub}' incomplete:`,
        error,
      );
    }
  }

  /**
   * Fully delete a tenant and ALL its data. Firestore doc deletes do NOT
   * cascade, so a bare deleteDoc(tenants/{tid}) would leave every subcollection
   * AND every top-level tenant-keyed collection behind — and because
   * firestore.rules derives membership from tenants/{tid}/members/{uid}, former
   * owner/admins would keep full access. So we sweep everything, delete the
   * `members` subcollection LAST (an interrupted delete must not strip access
   * before the data is gone), and only then delete the root doc.
   *
   * Best-effort: the client SDK has no recursiveDelete, and some legacy
   * collections (`mail`, `audit_logs`) are immutable to clients by rules, so
   * nested subcollections (payslips, promotionSignals children) and those
   * immutable collections survive. A superadmin must run
   * scripts/delete-tenant.mjs (Admin SDK) to guarantee complete removal of any
   * residue. Superadmin-only (enforced by firestore.rules isSuperAdmin()).
   */
  async deleteTenant(
    tenantId: string,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
    if (!db) throw new Error("Database not available");

    try {
      const tenantRef = doc(db, paths.tenant(tenantId));
      const tenantSnap = await getDoc(tenantRef);

      if (!tenantSnap.exists()) {
        throw new Error("Tenant not found");
      }

      const tenantName = tenantSnap.data()?.name;

      // 1) Top-level collections keyed by a `tenantId` FIELD.
      for (const name of TENANT_KEYED_ROOT_COLLECTIONS) {
        await this.sweepRootCollection(name, tenantId);
      }
      // Legacy top-level `payruns` holds a `payslips` subcollection the client
      // SDK cannot reach; its payrun docs go here, payslips residue needs the script.
      await this.sweepRootCollection("payruns", tenantId);
      // Accountant-partner connection requests reference a tenant from BOTH
      // sides: as the requesting client (tenantId) and as the accountant's
      // practice (partnerTenantId). Sweep both so no PII or dangling
      // "connected" link survives the tenant.
      await this.sweepRootCollection("accountantPartnerRequests", tenantId);
      await this.sweepRootCollection(
        "accountantPartnerRequests",
        tenantId,
        "partnerTenantId",
      );
      // `tenant_settings` is keyed by tenantId as the DOC ID (not a field), so a
      // where('tenantId','==') sweep can't find it — delete it by doc id.
      try {
        await deleteDoc(doc(db, "tenant_settings", tenantId));
      } catch (error) {
        console.warn(
          "deleteTenant: could not delete tenant_settings doc:",
          error,
        );
      }

      // 2) Tenant subcollections (everything except members).
      for (const sub of TENANT_SUBCOLLECTIONS) {
        await this.sweepTenantSubcollection(tenantId, sub);
      }

      // 3) members LAST (revokes rules access), then the tenant root doc. These
      //    are security-critical — a failure must surface, not be swallowed.
      await this.sweepTenantSubcollection(tenantId, "members", true);
      await deleteDoc(tenantRef);

      await this.logAdminAction({
        action: "tenant_deleted",
        actorUid,
        actorEmail,
        targetType: "tenant",
        targetId: tenantId,
        targetName: tenantName,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      throw error;
    }
  }

  async getTenantStats(
    tenantId: string,
  ): Promise<{ memberCount: number; employeeCount: number }> {
    if (!db) return { memberCount: 0, employeeCount: 0 };

    try {
      const [membersSnap, employeesSnap] = await Promise.all([
        getCountFromServer(query(collection(db, paths.members(tenantId)))),
        // ACTIVE only — this is the number billing charges for (checkout +
        // daily quantity sync both count status == 'active').
        getCountFromServer(
          query(
            collection(db, paths.employees(tenantId)),
            where("status", "==", "active"),
          ),
        ),
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

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(collection(db, paths.members(tenantId)));
      const members = snapshot.docs.map((memberDoc) => ({
        ...(memberDoc.data() as TenantMember),
        uid: memberDoc.id,
      }));

      const roleOrder: Record<string, number> = {
        owner: 0,
        "hr-admin": 1,
        manager: 2,
        viewer: 3,
      };
      return members.sort((left, right) => {
        const byRole =
          (roleOrder[left.role] ?? 9) - (roleOrder[right.role] ?? 9);
        if (byRole !== 0) return byRole;
        return (left.email || "").localeCompare(right.email || "");
      });
    } catch (error) {
      console.error("Error fetching tenant members:", error);
      throw error;
    }
  }

  async addTenantMember(params: {
    tenantId: string;
    tenantName: string;
    userEmail: string;
    role: TenantRole;
    modules?: ModulePermission[];
  }): Promise<void> {
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<
      typeof params,
      { success: boolean; message: string }
    >(await getFunctionsLazy(), "addTenantMember");
    await callable(params);
  }

  async updateTenantMember(params: {
    tenantId: string;
    memberUid: string;
    role?: TenantRole;
    modules?: ModulePermission[];
  }): Promise<void> {
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<
      typeof params,
      { success: boolean; message: string }
    >(await getFunctionsLazy(), "updateTenantMember");
    await callable(params);
  }

  async removeTenantMember(params: {
    tenantId: string;
    memberUid: string;
  }): Promise<void> {
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<
      typeof params,
      { success: boolean; message: string }
    >(await getFunctionsLazy(), "removeTenantMember");
    await callable(params);
  }

  async sendTenantMemberPasswordReset(params: {
    tenantId: string;
    memberUid: string;
  }): Promise<string> {
    const { httpsCallable } = await import("firebase/functions");
    const callable = httpsCallable<
      typeof params,
      { success: boolean; message: string }
    >(await getFunctionsLazy(), "sendTenantMemberPasswordReset");
    const result = await callable(params);
    return result.data.message;
  }

  async getAllUsers(maxResults = 500): Promise<UserProfile[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(
          collection(db, paths.users()),
          orderBy("createdAt", "desc"),
          limit(maxResults),
        ),
      );
      return snapshot.docs.map((userDoc) => ({
        uid: userDoc.id,
        ...userDoc.data(),
      })) as UserProfile[];
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

  async setUserSuperadmin(
    targetUid: string,
    isSuperAdmin: boolean,
    actorUid: string,
    actorEmail: string,
  ): Promise<void> {
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
        action: isSuperAdmin
          ? "user_superadmin_granted"
          : "user_superadmin_revoked",
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
        query(
          collection(db, paths.superAdminRequests()),
          orderBy("requestedAt", "desc"),
        ),
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
          <p>${escapeHtml(params.requestedByEmail)} requested to ${
            params.type === "grant" ? "grant" : "remove"
          } superadmin access for <strong>${escapeHtml(targetEmail)}</strong>.</p>
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

    const request = normalizeSuperAdminRequest(
      requestSnap.id,
      requestSnap.data(),
    );
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
          subject: "Your Xefe superadmin access is waiting",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2>Superadmin access is ready</h2>
              <p>An existing superadmin approved access for <strong>${escapeHtml(request.targetEmail)}</strong>.</p>
              <p>Please sign in to Xefe with this email address, then ask an existing superadmin to complete the activation from the Super Admins page.</p>
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
      const revokeUser =
        matchedUser ?? users.find((user) => user.uid === request.targetUid);
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

  async startImpersonation(
    actorUid: string,
    actorEmail: string,
    tenantId: string,
    tenantName: string,
  ): Promise<void> {
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

  async stopImpersonation(
    actorUid: string,
    actorEmail: string,
    tenantId: string,
    tenantName: string,
  ): Promise<void> {
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
    try {
      const [{ httpsCallable }, functions] = await Promise.all([
        import("firebase/functions"),
        getFunctionsLazy(),
      ]);
      const recordAdminAuditEvent = httpsCallable<
        Pick<
          AdminAuditEntry,
          "action" | "targetType" | "targetId" | "targetName" | "details"
        >,
        { id: string }
      >(functions, "recordAdminAuditEvent");
      await recordAdminAuditEvent({
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetName: entry.targetName,
        details: entry.details,
      });
    } catch (error) {
      console.error("Error logging admin action:", error);
    }
  }

  async getAuditLog(maxResults = 50): Promise<AdminAuditEntry[]> {
    if (!db) return [];

    try {
      const snapshot = await getDocs(
        query(
          collection(db, paths.adminAuditLog()),
          orderBy("timestamp", "desc"),
          limit(maxResults),
        ),
      );
      return snapshot.docs.map((logDoc) => logDoc.data() as AdminAuditEntry);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
