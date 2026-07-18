import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import type { User } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/firebase-core";
import { paths } from "@/lib/paths";
import { clearPersistedQueryCache } from "@/lib/queryCache";
import {
  TenantConfig,
  TenantMember,
  TenantSession,
  TenantRole,
  ModulePermission,
  CustomClaims,
  DEFAULT_ROLE_PERMISSIONS,
  hasModulePermission,
} from "@/types/tenant";
import { useAuth } from "@/contexts/AuthContext";

interface TenantContextType {
  // Current session
  session: TenantSession | null;
  loading: boolean;
  /** True once the initial tenant-session restore has finished. Guards must
   *  not treat session===null as final until this flips true (a partial cache
   *  can leave loading=false with session still null on a cold deep-link). */
  tenantResolved: boolean;
  error: string | null;

  // Available tenants for current user
  availableTenants: Array<{ id: string; name: string; role: TenantRole }>;

  // Impersonation (superadmin only)
  isImpersonating: boolean;
  impersonatedTenantId: string | null;
  impersonatedTenantName: string | null;
  startImpersonation: (tenantId: string, tenantName: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;

  // Tenant switching
  switchTenant: (tid: string) => Promise<void>;

  // Permission helpers
  hasModule: (module: ModulePermission) => boolean;
  canWrite: () => boolean;
  canManage: () => boolean;
  /** Single source of truth for the accountant/simple UI split. */
  showAdvancedTax: boolean;

  // Refresh functions
  refreshSession: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  retryInitialization: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

async function getFirestoreClient() {
  const [{ doc, getDoc }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("@/lib/firebase-firestore"),
  ]);
  return { db, doc, getDoc };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenantId(): string {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenantId must be used within a TenantProvider");
  }

  // If impersonating, return the impersonated tenant ID
  if (context.isImpersonating && context.impersonatedTenantId) {
    return context.impersonatedTenantId;
  }

  if (!context.session?.tid) {
    // Only allow fallback in development mode - throw in production
    if (import.meta.env.DEV) {
      console.warn("No tenant session - using local-dev-tenant fallback (DEV only)");
      return "local-dev-tenant";
    }
    // In production, throw an error to prevent data leaks
    throw new Error("No tenant session available. Please log in again.");
  }

  return context.session.tid;
}

/**
 * Whether the current user should see accountant-grade tax controls
 * (supplier withholding, treaty rates, ATTL filing forms, VAT).
 * True for the 'accountant' role, or for any user of a tenant that opted in
 * via `advancedTaxMode`. Everyone else gets the simple flow with safe
 * defaults that produce no withholding.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAdvancedTax(): boolean {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useAdvancedTax must be used within a TenantProvider");
  }
  return context.showAdvancedTax;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentEmployeeId(): string | null {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useCurrentEmployeeId must be used within a TenantProvider");
  }
  return context.session?.member?.employeeId || null;
}

interface TenantProviderProps {
  children: ReactNode;
}

const TENANT_CACHE_KEY = 'meza-tenant-cache';
const TENANT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface TenantCache {
  uid: string;
  session: TenantSession | null;
  availableTenants: Array<{ id: string; name: string; role: TenantRole }>;
  timestamp: number;
}

function readTenantCache(expectedUid: string): TenantCache | null {
  try {
    const raw = localStorage.getItem(TENANT_CACHE_KEY);
    if (!raw) return null;
    const data: TenantCache = JSON.parse(raw);
    if (
      data.uid !== expectedUid ||
      typeof data.timestamp !== "number" ||
      Date.now() - data.timestamp > TENANT_CACHE_TTL
    ) {
      localStorage.removeItem(TENANT_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(TENANT_CACHE_KEY);
    return null;
  }
}

function writeTenantCache(uid: string, session: TenantSession | null, availableTenants: Array<{ id: string; name: string; role: TenantRole }>): void {
  try {
    localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify({
      uid,
      session,
      availableTenants,
      timestamp: Date.now(),
    }));
  } catch {
    // Storage full or unavailable — ignore
  }
}

const currentTenantKey = (uid: string) => `currentTenantId:${uid}`;

function readCurrentTenantId(
  uid: string,
  tenants: Array<{ id: string }>,
): string | null {
  const scopedKey = currentTenantKey(uid);
  const scopedTenantId = localStorage.getItem(scopedKey);
  if (scopedTenantId && tenants.some((tenant) => tenant.id === scopedTenantId)) {
    return scopedTenantId;
  }
  if (scopedTenantId) {
    localStorage.removeItem(scopedKey);
  }

  // One-time migration from the old global selection. It is accepted only
  // after the authenticated user's tenant list confirms access.
  const legacyTenantId = localStorage.getItem("currentTenantId");
  localStorage.removeItem("currentTenantId");
  if (legacyTenantId && tenants.some((tenant) => tenant.id === legacyTenantId)) {
    localStorage.setItem(scopedKey, legacyTenantId);
    return legacyTenantId;
  }
  return null;
}

function clearImpersonationStorage(): void {
  sessionStorage.removeItem("impersonatingUid");
  sessionStorage.removeItem("impersonatingTenantId");
  sessionStorage.removeItem("impersonatingTenantName");
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { user, isSuperAdmin, userProfile, authResolved } = useAuth();
  const queryClient = useQueryClient();

  // Persisted tenant state cannot be read safely until AuthProvider supplies
  // the authenticated UID that owns it.
  const [session, setSession] = useState<TenantSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantResolved, setTenantResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<
    Array<{ id: string; name: string; role: TenantRole }>
  >([]);
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(null);
  const [impersonatedTenantName, setImpersonatedTenantName] = useState<string | null>(null);
  const tenantOwnerUidRef = React.useRef<string | null>(null);

  // Clear account-owned state as soon as Firebase changes users. The
  // initialization effect below may then restore only a matching UID cache.
  useEffect(() => {
    const nextUid = user?.uid ?? null;
    const previousUid = tenantOwnerUidRef.current;
    if (previousUid === nextUid) return;

    tenantOwnerUidRef.current = nextUid;
    setSession(null);
    setAvailableTenants([]);
    setError(null);
    setTenantResolved(false);
    setLoading(true);
    setIsImpersonating(false);
    setImpersonatedTenantId(null);
    setImpersonatedTenantName(null);

    // Preserve a same-account page-refresh impersonation (null -> UID), but
    // clear it on sign-out or a direct account switch.
    if (previousUid !== null || nextUid === null) {
      clearImpersonationStorage();
    }
  }, [user?.uid]);

  // Get current user and custom claims
  const getCurrentUserAndClaims = useCallback(async (): Promise<{
    user: User | null;
    claims: CustomClaims | null;
  }> => {
    if (!auth?.currentUser) {
      throw new Error("Authenticated session is unavailable");
    }

    try {
      const idTokenResult = await auth.currentUser.getIdTokenResult();
      const claims = idTokenResult.claims as CustomClaims;
      return { user: auth.currentUser, claims };
    } catch (error) {
      console.error("Failed to get user claims:", error);
      throw error;
    }
  }, []);

  // Load available tenants for current user. Profile and token membership lists
  // are discovery hints only; each candidate is verified against the tenant and
  // member documents before it is shown or restored.
  const loadAvailableTenants = useCallback(async (
    firebaseUser: User,
  ): Promise<Array<{ id: string; name: string; role: TenantRole }>> => {
    try {
      const { db, doc, getDoc } = await getFirestoreClient();
      const { claims } = await getCurrentUserAndClaims();
      const claimTenantIds = claims?.tenants
        ? (Array.isArray(claims.tenants)
            ? claims.tenants as string[]
            : Object.keys(claims.tenants))
        : [];
      const candidateTenantIds = Array.from(new Set([
        ...Object.keys(userProfile?.tenantAccess ?? {}),
        ...(userProfile?.tenantIds ?? []),
        ...claimTenantIds,
      ]));

      const tenantResults = await Promise.allSettled(
        candidateTenantIds.map(async (tid) => {
          const [tenantDoc, memberDoc] = await Promise.all([
            getDoc(doc(db, paths.tenant(tid))),
            getDoc(doc(db, paths.member(tid, firebaseUser.uid))),
          ]);

          if (!tenantDoc.exists() || !memberDoc.exists()) return null;
          const tenantData = tenantDoc.data() as TenantConfig;
          const memberData = memberDoc.data() as TenantMember;
          return {
            id: tid,
            name: tenantData.name || tid,
            role: memberData.role,
          };
        }),
      );

      const tenants = tenantResults.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      );
      if (tenants.length > 0) return tenants;

      const rejectedResult = tenantResults.find(
        (result) => result.status === "rejected",
      );
      if (rejectedResult?.status === "rejected") throw rejectedResult.reason;
      return [];
    } catch (error) {
      console.error("Failed to load available tenants:", error);
      throw error;
    }
  }, [getCurrentUserAndClaims, userProfile]);

  // Load tenant session data (for superadmin impersonation, skip membership check)
  const loadTenantSession = useCallback(async (
    tid: string,
    firebaseUser: User,
    bypassMembershipCheck = false,
  ): Promise<TenantSession | null> => {
    try {
      const { db, doc, getDoc } = await getFirestoreClient();
      // Load tenant config
      const tenantDoc = await getDoc(doc(db, paths.tenant(tid)));

      if (!tenantDoc.exists()) {
        throw new Error(`Tenant ${tid} not found`);
      }

      const config = { id: tid, ...tenantDoc.data() } as TenantConfig;

      // For superadmin impersonation, create a virtual "owner" session
      if (bypassMembershipCheck) {
        return {
          tid,
          role: 'owner' as TenantRole,
          modules: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'] as ModulePermission[],
          config,
          member: {
            uid: firebaseUser.uid,
            role: 'owner' as TenantRole,
            email: firebaseUser.email || undefined,
            displayName: firebaseUser.displayName || undefined,
          },
        };
      }

      // Regular member check
      const memberDoc = await getDoc(doc(db, paths.member(tid, firebaseUser.uid)));

      if (!memberDoc.exists()) {
        throw new Error(`User is not a member of tenant ${tid}`);
      }

      const member = memberDoc.data() as TenantMember;

      // Determine modules based on role and explicit permissions
      const defaultModules = DEFAULT_ROLE_PERMISSIONS[member.role] || [];
      const modules = member.modules || defaultModules;

      return {
        tid,
        role: member.role,
        modules,
        config,
        member,
      };
    } catch (error) {
      console.error(`Failed to load tenant session for ${tid}:`, error);
      throw error;
    }
  }, []);

  // Start impersonation (superadmin only)
  const startImpersonation = useCallback(async (tenantId: string, tenantName: string) => {
    if (!user || !isSuperAdmin) {
      throw new Error("Only superadmins can impersonate");
    }
    const operationUid = user.uid;
    const isCurrentAccount = () => tenantOwnerUidRef.current === operationUid;

    try {
      queryClient.clear();
      await clearPersistedQueryCache(user.uid);
      if (!isCurrentAccount()) return;
      setLoading(true);
      setTenantResolved(false);
      setError(null);

      // Load the tenant session with bypass
      const impersonatedSession = await loadTenantSession(tenantId, user, true);

      if (impersonatedSession && isCurrentAccount()) {
        // Audit trail: superadmin access to tenant data must be accountable
        const [{ adminService }, { Timestamp }] = await Promise.all([
          import("@/services/adminService"),
          import("firebase/firestore"),
        ]);
        await adminService.logAdminAction({
          action: "impersonation_started",
          actorUid: user.uid,
          actorEmail: user.email || "",
          targetType: "tenant",
          targetId: tenantId,
          targetName: tenantName,
          timestamp: Timestamp.now(),
        });

        if (!isCurrentAccount()) return;
        setSession(impersonatedSession);
        setIsImpersonating(true);
        setImpersonatedTenantId(tenantId);
        setImpersonatedTenantName(tenantName);

        // Session-only: expires when browser closes (no Firestore write — prevents cross-device lock-in)
        sessionStorage.setItem("impersonatingUid", user.uid);
        sessionStorage.setItem("impersonatingTenantId", tenantId);
        sessionStorage.setItem("impersonatingTenantName", tenantName);
      }
    } catch (error: unknown) {
      console.error("Failed to start impersonation:", error);
      if (!isCurrentAccount()) throw error;
      const message = error instanceof Error ? error.message : "Failed to impersonate";
      setError(message);
      throw error;
    } finally {
      if (isCurrentAccount()) setLoading(false);
      if (isCurrentAccount()) setTenantResolved(true);
    }
  }, [user, isSuperAdmin, loadTenantSession, queryClient]);

  // Stop impersonation
  const stopImpersonation = useCallback(async () => {
    if (!user) return;
    const operationUid = user.uid;
    const isCurrentAccount = () => tenantOwnerUidRef.current === operationUid;

    try {
      queryClient.clear();
      await clearPersistedQueryCache(user.uid);
      if (!isCurrentAccount()) return;
      setLoading(true);
      setTenantResolved(false);

      const endedTenantId = impersonatedTenantId;
      const endedTenantName = impersonatedTenantName;

      // Clear local state
      setIsImpersonating(false);
      setImpersonatedTenantId(null);
      setImpersonatedTenantName(null);
      setSession(null);

      // Clear sessionStorage
      clearImpersonationStorage();

      if (endedTenantId) {
        const [{ adminService }, { Timestamp }] = await Promise.all([
          import("@/services/adminService"),
          import("firebase/firestore"),
        ]);
        try {
          await adminService.logAdminAction({
            action: "impersonation_ended",
            actorUid: user.uid,
            actorEmail: user.email || "",
            targetType: "tenant",
            targetId: endedTenantId,
            targetName: endedTenantName || undefined,
            timestamp: Timestamp.now(),
          });
        } catch (auditError) {
          // Restoring the administrator's real session is more important than
          // leaving the app unusable when the audit endpoint is unavailable.
          console.error("Failed to record impersonation end:", auditError);
        }
      }

      // Reload user's actual tenants
      const tenants = await loadAvailableTenants(user);
      if (!isCurrentAccount()) return;
      setAvailableTenants(tenants);

      if (tenants.length > 0) {
        const savedTenantId = readCurrentTenantId(user.uid, tenants);
        const targetTenant =
          savedTenantId && tenants.find((t) => t.id === savedTenantId)
            ? savedTenantId
            : tenants[0]?.id;

        if (targetTenant) {
          const restoredSession = await loadTenantSession(targetTenant, user);
          if (!isCurrentAccount()) return;
          setSession(restoredSession);
          localStorage.setItem(currentTenantKey(user.uid), targetTenant);
          writeTenantCache(user.uid, restoredSession, tenants);
        }
      } else {
        writeTenantCache(user.uid, null, tenants);
      }
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
    } finally {
      if (isCurrentAccount()) setLoading(false);
      if (isCurrentAccount()) setTenantResolved(true);
    }
  }, [user, loadAvailableTenants, loadTenantSession, impersonatedTenantId, impersonatedTenantName, queryClient]);

  // Switch to a different tenant
  // Guard against re-entrancy: stopImpersonation loads tenants which could
  // theoretically trigger another switchTenant call.
  const switchingRef = React.useRef(false);

  const switchTenant = useCallback(async (tid: string) => {
    if (!user) {
      throw new Error("No authenticated user");
    }

    if (switchingRef.current) return;
    switchingRef.current = true;
    const operationUid = user.uid;
    const isCurrentAccount = () => tenantOwnerUidRef.current === operationUid;

    try {
      setLoading(true);
      setTenantResolved(false);
      setError(null);
      queryClient.clear();
      await clearPersistedQueryCache(user.uid);
      if (!isCurrentAccount()) return;

      const newSession = await loadTenantSession(tid, user);
      if (newSession && isCurrentAccount()) {
        // Commit the replacement atomically. A failed load must leave the
        // impersonation banner and virtual-owner session intact.
        if (isImpersonating) {
          setIsImpersonating(false);
          setImpersonatedTenantId(null);
          setImpersonatedTenantName(null);
          clearImpersonationStorage();
        }
        setSession(newSession);
        // Store current tenant in localStorage for persistence
        localStorage.setItem(currentTenantKey(user.uid), tid);
        // Update cache with new session
        writeTenantCache(user.uid, newSession, availableTenants);
      }
    } catch (error: unknown) {
      console.error("Failed to switch tenant:", error);
      if (!isCurrentAccount()) throw error;
      const message = error instanceof Error ? error.message : "Failed to switch tenant";
      setError(message);
      throw error;
    } finally {
      switchingRef.current = false;
      if (isCurrentAccount()) setLoading(false);
      if (isCurrentAccount()) setTenantResolved(true);
    }
  }, [user, isImpersonating, loadTenantSession, availableTenants, queryClient]);

  // Refresh current session
  const refreshSession = useCallback(async () => {
    if (!session || !user) return;
    const operationUid = user.uid;

    try {
      const refreshedSession = await loadTenantSession(
        session.tid,
        user,
        isImpersonating,
      );
      if (refreshedSession && tenantOwnerUidRef.current === operationUid) {
        setSession(refreshedSession);
        writeTenantCache(user.uid, refreshedSession, availableTenants);
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
      if (tenantOwnerUidRef.current !== operationUid) return;
      setError("Failed to refresh session");
    }
  }, [session, user, isImpersonating, loadTenantSession, availableTenants]);

  // Refresh available tenants
  const refreshTenants = useCallback(async () => {
    if (!user) return;
    const operationUid = user.uid;

    try {
      const tenants = await loadAvailableTenants(user);
      if (tenantOwnerUidRef.current !== operationUid) return;
      setAvailableTenants(tenants);
      writeTenantCache(user.uid, session, tenants);
    } catch (error) {
      console.error("Failed to refresh tenants:", error);
    }
  }, [user, session, loadAvailableTenants]);

  const retryInitialization = useCallback(() => {
    setError(null);
    setTenantResolved(false);
    setLoading(true);
    setInitializationAttempt((attempt) => attempt + 1);
  }, []);

  // Initialize tenant session
  useEffect(() => {
    if (!authResolved) return;

    let cancelled = false;
    const expectedUid = user?.uid ?? null;
    const isCurrentAccount = () =>
      !cancelled && tenantOwnerUidRef.current === expectedUid;

    const initializeTenant = async () => {
      if (!user) {
        if (!isCurrentAccount()) return;
        setSession(null);
        setAvailableTenants([]);
        setIsImpersonating(false);
        setImpersonatedTenantId(null);
        setImpersonatedTenantName(null);
        setLoading(false);
        setTenantResolved(true);
        localStorage.removeItem(TENANT_CACHE_KEY);
        return;
      }

      const cached = readTenantCache(user.uid);
      if (!isCurrentAccount()) return;
      setLoading(!cached?.session);

      if (cached) {
        setSession(cached.session);
        setAvailableTenants(cached.availableTenants);
        setTenantResolved(Boolean(cached.session));
      } else {
        setSession(null);
        setAvailableTenants([]);
        setTenantResolved(false);
      }

      try {
        setError(null);
        // Check sessionStorage for persisted impersonation (session-only, no Firestore)
        const savedImpersonatingUid = sessionStorage.getItem("impersonatingUid");
        const savedImpersonatingId = sessionStorage.getItem("impersonatingTenantId");
        const savedImpersonatingName = sessionStorage.getItem("impersonatingTenantName");

        if (
          savedImpersonatingId &&
          savedImpersonatingUid !== user.uid
        ) {
          clearImpersonationStorage();
        }

        if (
          isSuperAdmin &&
          savedImpersonatingUid === user.uid &&
          savedImpersonatingId
        ) {
          try {
            const impersonatedSession = await loadTenantSession(savedImpersonatingId, user, true);
            if (impersonatedSession && isCurrentAccount()) {
              setSession(impersonatedSession);
              setIsImpersonating(true);
              setImpersonatedTenantId(savedImpersonatingId);
              setImpersonatedTenantName(savedImpersonatingName || savedImpersonatingId);
              // Don't cache impersonation sessions
              setLoading(false);
              setTenantResolved(true);
              return;
            }
          } catch (impersonationError) {
            clearImpersonationStorage();
            throw impersonationError;
          }
        }

        // Load available tenants normally
        const tenants = await loadAvailableTenants(user);
        if (!isCurrentAccount()) return;
        setAvailableTenants(tenants);

        // Prefer the saved tenant, but continue through verified memberships if
        // it became stale between discovery and session restoration.
        const savedTenantId = readCurrentTenantId(user.uid, tenants);
        const orderedTenantIds = [
          ...(savedTenantId ? [savedTenantId] : []),
          ...tenants
            .map((tenant) => tenant.id)
            .filter((tenantId) => tenantId !== savedTenantId),
        ];

        if (orderedTenantIds.length > 0) {
          let lastSessionError: unknown;
          let restored = false;

          for (const tenantId of orderedTenantIds) {
            try {
              const restoredSession = await loadTenantSession(tenantId, user);
              if (!isCurrentAccount()) return;
              if (!restoredSession) continue;
              setSession(restoredSession);
              localStorage.setItem(currentTenantKey(user.uid), tenantId);
              writeTenantCache(user.uid, restoredSession, tenants);
              restored = true;
              break;
            } catch (sessionError) {
              if (!isCurrentAccount()) return;
              lastSessionError = sessionError;
            }
          }

          if (!restored) {
            throw lastSessionError ?? new Error("No tenant session could be restored");
          }
        } else {
          setSession(null);
          writeTenantCache(user.uid, null, tenants);

          const expectedTenantCount = Math.max(
            userProfile?.tenantIds?.length ?? 0,
            Object.keys(userProfile?.tenantAccess ?? {}).length,
          );
          if (!isSuperAdmin && expectedTenantCount > 0) {
            console.warn("No tenant membership could be restored for user");
            setError("No tenant membership could be loaded.");
          }
        }
      } catch (initializationError) {
        if (!isCurrentAccount()) return;
        console.error("Tenant initialization error:", initializationError);
        if (!cached?.session) {
          setSession(null);
        }
        setError(
          initializationError instanceof Error
            ? initializationError.message
            : "Failed to restore tenant session",
        );
      } finally {
        if (isCurrentAccount()) setLoading(false);
        if (isCurrentAccount()) setTenantResolved(true);
      }
    };

    void initializeTenant();
    return () => {
      cancelled = true;
    };
  }, [
    authResolved,
    user,
    userProfile,
    isSuperAdmin,
    loadAvailableTenants,
    loadTenantSession,
    initializationAttempt,
  ]);

  // Permission helpers
  const hasModule = (module: ModulePermission): boolean => {
    if (!session) return false;
    return hasModulePermission(session.role, session.modules, module);
  };

  const canWrite = (): boolean => {
    if (!session) return false;
    return (
      session.role === "owner" ||
      session.role === "hr-admin" ||
      session.role === "accountant"
    );
  };

  const canManage = (): boolean => {
    if (!session) return false;
    return (
      session.role === "owner" ||
      session.role === "hr-admin" ||
      session.role === "accountant"
    );
  };

  const showAdvancedTax =
    session?.role === "accountant" || session?.config?.advancedTaxMode === true;

  const value: TenantContextType = {
    session,
    loading,
    tenantResolved,
    error,
    availableTenants,
    isImpersonating,
    impersonatedTenantId,
    impersonatedTenantName,
    startImpersonation,
    stopImpersonation,
    switchTenant,
    hasModule,
    canWrite,
    canManage,
    showAdvancedTax,
    refreshSession,
    refreshTenants,
    retryInitialization,
  };

  // Dismiss the HTML splash overlay once we're past the loading gate
  useEffect(() => {
    if (loading) return;

    let removeTimer: number | null = null;

    // Use requestAnimationFrame to ensure React content has painted before fading splash
    const frame = requestAnimationFrame(() => {
      const splash = document.getElementById("splash");
      if (splash) {
        splash.style.opacity = "0";
        removeTimer = window.setTimeout(() => {
          splash.remove();
          removeTimer = null;
        }, 300);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (removeTimer !== null) {
        window.clearTimeout(removeTimer);
      }
    };
  }, [loading]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}
