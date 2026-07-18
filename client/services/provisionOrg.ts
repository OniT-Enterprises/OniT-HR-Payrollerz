import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { db, getFunctionsLazy } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { PLAN_LIMITS, TenantPlan } from "@/types/tenant";
import {
  forgetAccountantPartner,
  PRIMOS_BOOT_PARTNER,
  type AccountantPartnerId,
} from "@/lib/accountantPartners";

/** Thrown when the chosen company slug already belongs to another tenant. */
export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Company URL "${slug}" is already taken`);
    this.name = "SlugTakenError";
  }
}

/**
 * Thrown when provisioning writes don't complete in time. Firestore queues
 * writes indefinitely when offline (or when its IndexedDB cache is broken),
 * which would otherwise leave the signup button spinning forever.
 */
export class ProvisioningTimeoutError extends Error {
  constructor() {
    super("Provisioning timed out");
    this.name = "ProvisioningTimeoutError";
  }
}

const PROVISION_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProvisioningTimeoutError()), PROVISION_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const OWNER_MODULES = [
  "hiring",
  "staff",
  "timeleave",
  "performance",
  "payroll",
  "money",
  "accounting",
  "reports",
] as const;

export interface ProvisionOrgParams {
  user: User;
  /** Display name for the owner. Falls back to the auth profile / existing doc. */
  displayName?: string;
  companyName: string;
  /** Slug becomes the tenant id. Generated if omitted. */
  companySlug?: string;
  /** Optional consultation request. Selection alone never grants data access. */
  accountantPartnerId?: AccountantPartnerId | null;
}

/**
 * Creates a brand-new organization for `user`: the tenant document, an owner
 * membership, and the owner's slice of their user profile. Shared by the
 * email signup flow and the Google self-serve onboarding flow.
 *
 * The user profile is written with merge semantics so a user who already has a
 * profile (e.g. an invited member who has no tenant of their own yet) keeps
 * their existing tenant access instead of having it overwritten.
 *
 * Write order matters: tenant → member → user profile. Non-members can't read
 * other tenants, so the rejected create IS the slug-availability check (rules
 * treat a write to an existing tenant as an update only its owner may make).
 * The profile is written last so a collision leaves no ghost tenantAccess
 * entry — which would lock the user out of onboarding and point TenantContext
 * at a tenant they can't read.
 */
export async function provisionOrganization(
  params: ProvisionOrgParams,
): Promise<string> {
  return withTimeout(provisionOrgWrites(params));
}

async function provisionOrgWrites({
  user,
  displayName,
  companyName,
  companySlug,
  accountantPartnerId,
}: ProvisionOrgParams): Promise<string> {
  const name = companyName.trim();
  const slug = (companySlug || "").trim();
  const tenantId =
    slug || `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const resolvedName =
    (displayName || "").trim() || user.displayName || user.email || null;

  const plan: TenantPlan = "free";
  try {
    await setDoc(doc(db, paths.tenant(tenantId)), {
      id: tenantId,
      name,
      slug: slug || tenantId,
      status: "active",
      plan,
      limits: PLAN_LIMITS[plan],
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      branding: {},
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: "USD",
        dateFormat: "YYYY-MM-DD",
      },
      ...(accountantPartnerId === PRIMOS_BOOT_PARTNER.id
        ? {
            accountantPartner: {
              partnerId: PRIMOS_BOOT_PARTNER.id,
              partnerName: PRIMOS_BOOT_PARTNER.name,
              status: "selected",
              selectedBy: user.uid,
              selectedAt: serverTimestamp(),
            },
          }
        : {}),
    });
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "permission-denied") {
      throw new SlugTakenError(tenantId);
    }
    throw err;
  }

  await setDoc(doc(db, paths.member(tenantId, user.uid)), {
    uid: user.uid,
    email: user.email,
    displayName: resolvedName,
    role: "owner",
    modules: [...OWNER_MODULES],
    joinedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    permissions: {
      admin: true,
      write: true,
      read: true,
    },
  });

  // Merge into any existing user profile (don't clobber prior tenant access).
  const userRef = doc(db, paths.user(user.uid));
  const existingSnap = await getDoc(userRef);
  const existing = existingSnap.exists() ? existingSnap.data() : {};
  const existingIds: string[] = Array.isArray(existing.tenantIds)
    ? existing.tenantIds
    : [];
  const existingAccess =
    existing.tenantAccess && typeof existing.tenantAccess === "object"
      ? existing.tenantAccess
      : {};

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email,
      displayName: resolvedName,
      isSuperAdmin: existing.isSuperAdmin === true,
      tenantIds: existingIds.includes(tenantId)
        ? existingIds
        : [...existingIds, tenantId],
      tenantAccess: {
        ...existingAccess,
        [tenantId]: { name, role: "owner" },
      },
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Seed the standard TL chart of accounts so invoices, bills, and expenses
  // post journals from day one. Non-fatal: the owner can still initialize it
  // from the Chart of Accounts page if this write is rejected.
  try {
    const { accountService } = await import("./accountingService");
    await accountService.initializeChartOfAccounts(tenantId);
  } catch (err) {
    console.warn("Chart of accounts seeding failed during onboarding:", err);
  }

  // Send the branded welcome (+ email verification link for password signups).
  // Non-fatal: a failed/blocked email must never break account creation.
  try {
    const [{ httpsCallable }, functions] = await Promise.all([
      import("firebase/functions"),
      getFunctionsLazy(),
    ]);
    const sendWelcome = httpsCallable<{ tenantName: string }, { sent: boolean }>(
      functions,
      "sendWelcomeEmail",
    );
    await sendWelcome({ tenantName: name });
  } catch (err) {
    console.warn("Welcome email send failed during onboarding:", err);
  }

  // The consultation request is deliberately separate from organization
  // creation. While the partnership is pre-launch, save only the customer's
  // preference; do not call the backend or share any contact details.
  if (accountantPartnerId === PRIMOS_BOOT_PARTNER.id) {
    try {
      if (PRIMOS_BOOT_PARTNER.connectionsOpen) {
        const { accountantPartnerService } = await import(
          "./accountantPartnerService"
        );
        await accountantPartnerService.requestConnection(
          tenantId,
          accountantPartnerId,
        );
      }
    } catch (err) {
      // Keep the tenant in "selected" state so the owner can retry from
      // Settings. A partner notification must never break signup.
      console.warn("Accountant consultation request failed during onboarding:", err);
    } finally {
      forgetAccountantPartner();
    }
  }

  return tenantId;
}
