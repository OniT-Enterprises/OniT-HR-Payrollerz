/**
 * Time & Leave Settings — Leave policies per TL labor law.
 * Annual leave, sick leave, maternity, holiday overrides, etc.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
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
import { ArrowLeft, Settings } from "lucide-react";

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
      <div className="bg-background">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("settings.tabs.timeOff") || "Time Off Policies"}
            subtitle={t("settings.timeOff.description") || "Leave entitlements per Timor-Leste labor law"}
            icon={Settings}
            iconColor="text-cyan-500"
          />

          {/* Mirrors the loaded layout: an intro line, then two eyebrow-headed
              groups of collapsed policy rows, then Save. */}
          <div className="space-y-6">
            <div className="space-y-1">
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-2/3 max-w-md" />
            </div>

            {[4, 8].map((rowCount, group) => (
              <div key={group}>
                <Skeleton className="mb-2 h-3 w-40" />
                {group === 1 && <Skeleton className="mb-3 h-3 w-64" />}
                <div className="space-y-3">
                  {Array.from({ length: rowCount }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-14 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5"
                    >
                      <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56 max-w-full" />
                      </div>
                      <Skeleton className="h-4 w-4 shrink-0 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Skeleton className="h-11 w-full sm:w-44" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <SEO
        title={t("settings.tabs.timeOff")}
        description={t("settings.timeOff.description")}
        noIndex
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
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
