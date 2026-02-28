import type { TenantSession } from "@/types/tenant";

export function canUseNgoReporting(
  session: TenantSession | null | undefined,
  hasReportsModule: boolean
): boolean {
  if (!session || !hasReportsModule) return false;
  if (session.config.features?.reports === false) return false;
  if (session.config.features?.ngoReporting === false) return false;
  return true;
}

export function canUseDonorExport(
  session: TenantSession | null | undefined,
  hasReportsModule: boolean,
  canManageTenant: boolean
): boolean {
  return canUseNgoReporting(session, hasReportsModule) && canManageTenant;
}
