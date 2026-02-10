import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { User } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { paths } from "@/lib/paths";
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

  // Refresh functions
  refreshSession: () => Promise<void>;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

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

export function TenantProvider({ children }: TenantProviderProps) {
  const { user, isSuperAdmin, userProfile } = useAuth();
  const [session, setSession] = useState<TenantSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<
    Array<{ id: string; name: string; role: TenantRole }>
  >([]);

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(null);
  const [impersonatedTenantName, setImpersonatedTenantName] = useState<string | null>(null);

  // Get current user and custom claims
  const getCurrentUserAndClaims = async (): Promise<{
    user: User | null;
    claims: CustomClaims | null;
  }> => {
    if (!auth?.currentUser) {
      return { user: null, claims: null };
    }

    try {
      const idTokenResult = await auth.currentUser.getIdTokenResult();
      const claims = idTokenResult.claims as CustomClaims;
      return { user: auth.currentUser, claims };
    } catch (error) {
      console.error("Failed to get user claims:", error);
      return { user: auth.currentUser, claims: null };
    }
  };

  // Load available tenants for current user
  // Optimized: Uses denormalized tenantAccess when available (1 read vs N×2 reads)
  const loadAvailableTenants = async (
    firebaseUser: User,
  ): Promise<Array<{ id: string; name: string; role: TenantRole }>> => {
    if (!db) {
      console.warn("Database not available");
      return [];
    }

    try {
      // OPTIMIZED: Use denormalized tenantAccess from userProfile (1 read total)
      if (userProfile?.tenantAccess && Object.keys(userProfile.tenantAccess).length > 0) {
        const tenants = Object.entries(userProfile.tenantAccess).map(([tid, info]) => ({
          id: tid,
          name: info.name || tid,
          role: info.role as TenantRole,
        }));
        if (tenants.length > 0) {
          return tenants;
        }
      }

      // FALLBACK: Use custom claims + individual fetches (N×2 reads)
      // This path is for backwards compatibility until tenantAccess is populated
      const { claims } = await getCurrentUserAndClaims();
      if (claims?.tenants && Array.isArray(claims.tenants)) {
        const tenantPromises = claims.tenants.map(async (tid: string) => {
          try {
            // Get tenant config and member doc in parallel
            const [tenantDoc, memberDoc] = await Promise.all([
              getDoc(doc(db, paths.tenant(tid))),
              getDoc(doc(db, paths.member(tid, firebaseUser.uid))),
            ]);

            if (tenantDoc.exists() && memberDoc.exists()) {
              const tenantData = tenantDoc.data() as TenantConfig;
              const memberData = memberDoc.data() as TenantMember;

              return {
                id: tid,
                name: tenantData.name || tid,
                role: memberData.role,
              };
            }
            return null;
          } catch (error) {
            console.warn(`Failed to load tenant ${tid}:`, error);
            return null;
          }
        });

        const tenants = (await Promise.all(tenantPromises)).filter(
          Boolean,
        ) as Array<{ id: string; name: string; role: TenantRole }>;
        if (tenants.length > 0) {
          return tenants;
        }
      }

      // FALLBACK 2: Check user profile tenantIds (N×2 reads)
      if (userProfile?.tenantIds && userProfile.tenantIds.length > 0) {
        const tenantPromises = userProfile.tenantIds.map(async (tid: string) => {
          try {
            const [tenantDoc, memberDoc] = await Promise.all([
              getDoc(doc(db, paths.tenant(tid))),
              getDoc(doc(db, paths.member(tid, firebaseUser.uid))),
            ]);

            if (tenantDoc.exists() && memberDoc.exists()) {
              const tenantData = tenantDoc.data() as TenantConfig;
              const memberData = memberDoc.data() as TenantMember;

              return {
                id: tid,
                name: tenantData.name || tid,
                role: memberData.role,
              };
            }
            return null;
          } catch (error) {
            console.warn(`Failed to load tenant ${tid}:`, error);
            return null;
          }
        });

        const tenants = (await Promise.all(tenantPromises)).filter(
          Boolean,
        ) as Array<{ id: string; name: string; role: TenantRole }>;
        if (tenants.length > 0) {
          return tenants;
        }
      }

      return [];
    } catch (error) {
      console.error("Failed to load available tenants:", error);
      return [];
    }
  };

  // Load tenant session data (for superadmin impersonation, skip membership check)
  const loadTenantSession = async (
    tid: string,
    firebaseUser: User,
    bypassMembershipCheck = false,
  ): Promise<TenantSession | null> => {
    if (!db) {
      console.warn("Database not available");
      return null;
    }

    try {
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
          modules: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'reports'] as ModulePermission[],
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
  };

  // Start impersonation (superadmin only)
  const startImpersonation = useCallback(async (tenantId: string, tenantName: string) => {
    if (!user || !isSuperAdmin) {
      throw new Error("Only superadmins can impersonate");
    }

    try {
      setLoading(true);
      setError(null);

      // Load the tenant session with bypass
      const impersonatedSession = await loadTenantSession(tenantId, user, true);

      if (impersonatedSession) {
        // Update user profile in Firestore
        if (db && userProfile) {
          const userRef = doc(db, paths.user(user.uid));
          await updateDoc(userRef, {
            impersonating: {
              tenantId,
              tenantName,
              startedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          });
        }

        setSession(impersonatedSession);
        setIsImpersonating(true);
        setImpersonatedTenantId(tenantId);
        setImpersonatedTenantName(tenantName);

        // Store in sessionStorage (expires on browser close — SEC-8 safety)
        sessionStorage.setItem("impersonatingTenantId", tenantId);
        sessionStorage.setItem("impersonatingTenantName", tenantName);
      }
    } catch (error: any) {
      console.error("Failed to start impersonation:", error);
      setError(error.message || "Failed to impersonate");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, userProfile]);

  // Stop impersonation
  const stopImpersonation = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Clear impersonation in Firestore
      if (db) {
        const userRef = doc(db, paths.user(user.uid));
        await updateDoc(userRef, {
          impersonating: null,
          updatedAt: serverTimestamp(),
        });
      }

      // Clear local state
      setIsImpersonating(false);
      setImpersonatedTenantId(null);
      setImpersonatedTenantName(null);
      setSession(null);

      // Clear localStorage
      sessionStorage.removeItem("impersonatingTenantId");
      sessionStorage.removeItem("impersonatingTenantName");

      // Reload user's actual tenants
      const tenants = await loadAvailableTenants(user);
      setAvailableTenants(tenants);

      if (tenants.length > 0) {
        const savedTenantId = localStorage.getItem("currentTenantId");
        const targetTenant =
          savedTenantId && tenants.find((t) => t.id === savedTenantId)
            ? savedTenantId
            : tenants[0]?.id;

        if (targetTenant) {
          const session = await loadTenantSession(targetTenant, user);
          setSession(session);
        }
      }
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Switch to a different tenant
  const switchTenant = async (tid: string) => {
    if (!user) {
      throw new Error("No authenticated user");
    }

    // If impersonating, stop first
    if (isImpersonating) {
      await stopImpersonation();
    }

    try {
      setLoading(true);
      setError(null);

      const newSession = await loadTenantSession(tid, user);
      if (newSession) {
        setSession(newSession);
        // Store current tenant in localStorage for persistence
        localStorage.setItem("currentTenantId", tid);
      }
    } catch (error: any) {
      console.error("Failed to switch tenant:", error);
      setError(error.message || "Failed to switch tenant");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Refresh current session
  const refreshSession = async () => {
    if (!session || !user) return;

    try {
      const refreshedSession = await loadTenantSession(
        session.tid,
        user,
        isImpersonating,
      );
      if (refreshedSession) {
        setSession(refreshedSession);
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
      setError("Failed to refresh session");
    }
  };

  // Refresh available tenants
  const refreshTenants = async () => {
    if (!user) return;

    try {
      const tenants = await loadAvailableTenants(user);
      setAvailableTenants(tenants);
    } catch (error) {
      console.error("Failed to refresh tenants:", error);
    }
  };

  // Initialize tenant session
  useEffect(() => {
    const initializeTenant = async () => {
      if (!user) {
        setSession(null);
        setAvailableTenants([]);
        setIsImpersonating(false);
        setImpersonatedTenantId(null);
        setImpersonatedTenantName(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if superadmin is impersonating (from user profile or sessionStorage)
        if (isSuperAdmin && userProfile?.impersonating) {
          const { tenantId, tenantName } = userProfile.impersonating;
          const impersonatedSession = await loadTenantSession(tenantId, user, true);

          if (impersonatedSession) {
            setSession(impersonatedSession);
            setIsImpersonating(true);
            setImpersonatedTenantId(tenantId);
            setImpersonatedTenantName(tenantName || tenantId);
            setLoading(false);
            return;
          }
        }

        // Check sessionStorage for persisted impersonation
        const savedImpersonatingId = sessionStorage.getItem("impersonatingTenantId");
        const savedImpersonatingName = sessionStorage.getItem("impersonatingTenantName");

        if (isSuperAdmin && savedImpersonatingId) {
          try {
            const impersonatedSession = await loadTenantSession(savedImpersonatingId, user, true);

            if (impersonatedSession) {
              setSession(impersonatedSession);
              setIsImpersonating(true);
              setImpersonatedTenantId(savedImpersonatingId);
              setImpersonatedTenantName(savedImpersonatingName || savedImpersonatingId);
              setLoading(false);
              return;
            }
          } catch {
            // Clear invalid impersonation data
            sessionStorage.removeItem("impersonatingTenantId");
            sessionStorage.removeItem("impersonatingTenantName");
          }
        }

        // Load available tenants normally
        const tenants = await loadAvailableTenants(user);
        setAvailableTenants(tenants);

        // Try to restore previous tenant or use first available
        const savedTenantId = localStorage.getItem("currentTenantId");
        const targetTenant =
          savedTenantId && tenants.find((t) => t.id === savedTenantId)
            ? savedTenantId
            : tenants[0]?.id;

        if (targetTenant) {
          try {
            const session = await loadTenantSession(targetTenant, user);
            setSession(session);
            localStorage.setItem("currentTenantId", targetTenant);
          } catch (error) {
            console.error("Failed to load tenant session:", error);
            setError(`Failed to load tenant: ${error}`);
          }
        } else if (!isSuperAdmin) {
          // Only show error for non-superadmins
          console.warn("No tenants available for user");
          setError("No tenants available. Contact your administrator.");
        }
      } catch (error) {
        console.error("Tenant initialization error:", error);
        setError(`Tenant error: ${error}`);
      } finally {
        setLoading(false);
      }
    };

    initializeTenant();
  }, [user, isSuperAdmin, userProfile]);

  // Permission helpers
  const hasModule = (module: ModulePermission): boolean => {
    if (!session) return false;
    return hasModulePermission(session.role, session.modules, module);
  };

  const canWrite = (): boolean => {
    if (!session) return false;
    return session.role === "owner" || session.role === "hr-admin";
  };

  const canManage = (): boolean => {
    if (!session) return false;
    return session.role === "owner" || session.role === "hr-admin";
  };

  const value: TenantContextType = {
    session,
    loading,
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
    refreshSession,
    refreshTenants,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}
