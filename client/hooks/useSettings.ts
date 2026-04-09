/**
 * React Query hooks for tenant settings
 */

import { useQuery } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { settingsService } from '@/services/settingsService';

export const settingsKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'settings'] as const,
};

/** Fetch tenant settings */
export function useSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: settingsKeys.all(tenantId),
    queryFn: () => settingsService.getSettings(tenantId),
    staleTime: 10 * 60 * 1000, // Settings change rarely
    gcTime: 60 * 60 * 1000,
  });
}

