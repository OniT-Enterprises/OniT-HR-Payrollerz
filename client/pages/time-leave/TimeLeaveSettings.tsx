/**
 * Time & Leave Settings — Leave policies per TL labor law.
 * Annual leave, sick leave, maternity, holiday overrides, etc.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/layout/PageHeader";
import { TimeOffPoliciesTab } from "@/components/settings/TimeOffPoliciesTab";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { settingsService } from "@/services/settingsService";
import { holidayService } from "@/services/holidayService";
import { Settings } from "lucide-react";

export default function TimeLeaveSettings() {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const year = new Date().getFullYear();

  const { data: settings, isLoading: settingsLoading, refetch } = useQuery({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: () => settingsService.getSettings(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: holidayOverrides = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ["tenants", tenantId, "holidayOverrides", year] as const,
    queryFn: () => holidayService.listTenantHolidayOverrides(tenantId, year),
    staleTime: 10 * 60 * 1000,
    enabled: !!tenantId,
  });

  const loading = settingsLoading || holidaysLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-screen-2xl px-6 py-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Time & Leave Settings | Meza" description="Configure leave policies per Timor-Leste labor law" />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("settings.tabs.timeOff") || "Time Off Policies"}
          subtitle={t("settings.timeOff.description") || "Leave entitlements per Timor-Leste labor law"}
          icon={Settings}
          iconColor="text-cyan-500"
        />

        {settings && (
          <TimeOffPoliciesTab
            tenantId={tenantId}
            saving={saving}
            setSaving={setSaving}
            onReload={() => void refetch()}
            t={t}
            initialTimeOff={settings.timeOffPolicies}
            initialHolidayOverrides={holidayOverrides}
            userId={user?.uid}
          />
        )}
      </div>
    </div>
  );
}
