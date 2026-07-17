/**
 * Tenant subscription/billing status — one cached snapshot shared by the
 * billing page, user menus, and payroll surfaces (same queryKey everywhere).
 */
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { useTenantId } from "@/contexts/TenantContext";
import { isTenantSubscribed } from "@/lib/packagePricing";

export interface TenantBilling {
  currentEmployeeCount: number;
  monthlySubscriptionAmount?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  manualSubscription?: boolean;
  status?: string;
  subscriptionPaidUntil?: { toDate: () => Date } | null;
}

export function useTenantBilling(enabled = true) {
  const tenantId = useTenantId();
  return useQuery<TenantBilling>({
    queryKey: ["tenant-billing", tenantId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, paths.tenant(tenantId)));
      const d = (snap.data() ?? {}) as Record<string, unknown>;
      return {
        currentEmployeeCount: Math.max(0, (d.currentEmployeeCount as number) ?? 0),
        monthlySubscriptionAmount: d.monthlySubscriptionAmount as number | undefined,
        stripeCustomerId: d.stripeCustomerId as string | undefined,
        stripeSubscriptionId: d.stripeSubscriptionId as string | undefined,
        manualSubscription: d.manualSubscription === true,
        status: d.status as string | undefined,
        subscriptionPaidUntil: (d.subscriptionPaidUntil as TenantBilling["subscriptionPaidUntil"]) ?? null,
      };
    },
    enabled: Boolean(tenantId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether the tenant can finalize payroll (active subscription).
 * `undefined` while loading or when disabled — callers should render nothing
 * rather than guess.
 */
export function useIsSubscribed(enabled = true): boolean | undefined {
  const { data } = useTenantBilling(enabled);
  return data ? isTenantSubscribed(data) : undefined;
}
