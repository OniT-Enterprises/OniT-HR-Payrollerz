import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { PLAN_LIMITS, TenantPlan } from "@/types/tenant";

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
}

/**
 * Creates a brand-new organization for `user`: the tenant document, an owner
 * membership, and the owner's slice of their user profile. Shared by the
 * email signup flow and the Google self-serve onboarding flow.
 *
 * The user profile is written with merge semantics so a user who already has a
 * profile (e.g. an invited member who has no tenant of their own yet) keeps
 * their existing tenant access instead of having it overwritten.
 */
export async function provisionOrganization({
  user,
  displayName,
  companyName,
  companySlug,
}: ProvisionOrgParams): Promise<string> {
  const name = companyName.trim();
  const slug = (companySlug || "").trim();
  const tenantId = slug || `tenant_${Date.now()}`;
  const resolvedName =
    (displayName || "").trim() || user.displayName || user.email || null;

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

  const plan: TenantPlan = "free";
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
  });

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

  return tenantId;
}
