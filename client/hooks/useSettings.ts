/**
 * React Query hooks for tenant settings
 */

import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { settingsService } from '@/services/settingsService';

export const settingsKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'settings'] as const,
};

/** Fetch tenant settings */
export function useSettings() {
  const { session, isImpersonating, impersonatedTenantId } = useTenant();
  const tenantId = isImpersonating && impersonatedTenantId ? impersonatedTenantId : session?.tid;

  return useQuery({
    queryKey: tenantId ? settingsKeys.all(tenantId) : ['tenants', 'no-tenant', 'settings'],
    queryFn: () => {
      if (!tenantId) return null;
      return settingsService.getSettings(tenantId);
    },
    enabled: Boolean(tenantId),
    staleTime: 10 * 60 * 1000, // Settings change rarely
    gcTime: 60 * 60 * 1000,
  });
}

