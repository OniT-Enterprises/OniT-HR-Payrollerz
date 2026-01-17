/**
 * useTaxConfig Hook
 * React Query hook for accessing TL tax configuration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTaxConfig,
  updateTaxConfig,
  clearTaxConfigCache,
  TLTaxConfig,
  DEFAULT_TAX_CONFIG,
} from '@/lib/payroll/taxConfig';
import { useAuth } from '@/contexts/AuthContext';

const TAX_CONFIG_KEY = ['system', 'taxConfig'];

/**
 * Hook to fetch TL tax configuration
 * Returns cached data immediately, refreshes in background
 */
export function useTaxConfig() {
  return useQuery({
    queryKey: TAX_CONFIG_KEY,
    queryFn: getTaxConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Always return something immediately
    placeholderData: DEFAULT_TAX_CONFIG,
  });
}

/**
 * Hook to update TL tax configuration
 * Only for admin users
 */
export function useUpdateTaxConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      updates: Partial<Omit<TLTaxConfig, 'lastUpdated' | 'version'>>
    ) => {
      if (!user?.uid) {
        throw new Error('User must be authenticated');
      }
      await updateTaxConfig(updates, user.uid);
    },
    onSuccess: () => {
      // Clear the cache and refetch
      clearTaxConfigCache();
      queryClient.invalidateQueries({ queryKey: TAX_CONFIG_KEY });
    },
  });
}

/**
 * Synchronous access to tax config values
 * Uses cached data or defaults - useful for inline calculations
 */
export function useTaxConfigValues() {
  const { data: config } = useTaxConfig();
  return config || DEFAULT_TAX_CONFIG;
}
