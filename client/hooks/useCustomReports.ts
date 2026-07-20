/**
 * React Query hooks for saved custom report configs
 * (tenants/{tid}/customReports — wraps customReportService).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantId } from "@/contexts/TenantContext";
import {
  customReportService,
  type CustomReportInput,
} from "@/services/customReportService";

export const customReportKeys = {
  all: (tenantId: string) => ["tenants", tenantId, "customReports"] as const,
  list: (tenantId: string) =>
    [...customReportKeys.all(tenantId), "list"] as const,
};

/** Fetch the tenant's saved custom report configs. */
export function useCustomReports(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: customReportKeys.list(tenantId),
    queryFn: () => customReportService.list(tenantId),
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Persist a report built in the builder. Resolves to the new doc id. */
export function useCreateCustomReport() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (params: { config: CustomReportInput; createdBy: string }) =>
      customReportService.create(tenantId, params.config, params.createdBy),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customReportKeys.all(tenantId),
      });
    },
  });
}

/** Delete a saved report config. */
export function useDeleteCustomReport() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => customReportService.remove(tenantId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customReportKeys.all(tenantId),
      });
    },
  });
}

/**
 * Stamp lastRunAt after a successful run. Callers fire-and-forget —
 * a failure here must never break the report run itself.
 */
export function useTouchCustomReportLastRun() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => customReportService.touchLastRun(tenantId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customReportKeys.all(tenantId),
      });
    },
  });
}
