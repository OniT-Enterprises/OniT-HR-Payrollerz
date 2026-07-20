/**
 * Time & Leave Settings — Leave policies per TL labor law.
 * Annual leave, sick leave, maternity, holiday overrides, etc.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
          <PageHeader
            title={t("settings.tabs.timeOff") || "Time Off Policies"}
            subtitle={t("settings.timeOff.description") || "Leave entitlements per Timor-Leste labor law"}
            icon={Settings}
            iconColor="text-cyan-500"
          />

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 mt-1" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-16 w-full rounded-lg" />

              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-24" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="space-y-2 pt-6">
                        <Skeleton className="h-6 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-80" />
                  </div>
                  <div className="w-32 space-y-2">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>

                <div className="border rounded-lg divide-y">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-40" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-48" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-9 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
