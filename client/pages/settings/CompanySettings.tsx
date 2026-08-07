/**
 * Company Settings — business details, work locations, and teams on one
 * scrolling page.
 *
 * The old Company/Structure tab bar is gone: "Structure" is untranslatable
 * jargon for a first-time TL owner, and hiding locations and teams behind a
 * second tab is why nobody found them. Both sections are now visible, each
 * with its own heading, under one page-level Save.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { useTenantId } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useSettings, settingsKeys } from "@/hooks/useSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO } from "@/components/SEO";
import { ArrowLeft, Building, Loader2, Save } from "lucide-react";
import {
  SettingsSkeleton,
  CompanyDetailsTab,
  CompanyStructureTab,
} from "@/components/settings";

type SaveFn = () => Promise<boolean>;

export default function CompanySettings() {
  const tenantId = useTenantId();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useSettings();
  const { data: settings, isLoading } = settingsQuery;

  const [saving, setSaving] = useState(false);
  // The page owns the button's busy state so it stays disabled across BOTH
  // section saves — the shared `saving` flag flips false between them.
  const [pageSaving, setPageSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const detailsSaveRef = useRef<SaveFn | null>(null);
  const structureSaveRef = useRef<SaveFn | null>(null);

  // Stable identities: the children register on every save-callback change,
  // and a new function each render would loop.
  const registerDetailsSave = useCallback((fn: SaveFn) => {
    detailsSaveRef.current = fn;
  }, []);
  const registerStructureSave = useCallback((fn: SaveFn) => {
    structureSaveRef.current = fn;
  }, []);

  const handleReload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
  }, [queryClient, tenantId]);

  // Legacy deep link (/settings/company?tab=structure) now scrolls to the
  // section instead of selecting a tab.
  const wantsStructure = searchParams.get("tab") === "structure";
  useEffect(() => {
    // Only consume the param once the sections are actually on screen. On the
    // error and redirect branches there is no #places to scroll to, and
    // stripping the param there would lose the deep link across a Retry.
    if (!wantsStructure || !settings) return;
    document.getElementById("places")?.scrollIntoView({ block: "start" });
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [wantsStructure, settings, searchParams, setSearchParams]);

  const handleSaveAll = useCallback(async () => {
    if (pageSaving) return;
    setPageSaving(true);
    try {
      // Details first: it validates. A validation failure must not leave the
      // page half-saved, so stop before touching structure.
      // A missing registration is a bug, not a no-op: reporting success while
      // writing nothing is the worst possible outcome here.
      if (!detailsSaveRef.current || !structureSaveRef.current) {
        throw new Error("Company settings sections did not register their save");
      }
      const detailsOk = await detailsSaveRef.current();
      if (!detailsOk) return;
      const structureOk = await structureSaveRef.current();
      // The sections stay quiet when the page owns Save, so confirm once here.
      // Failures already surfaced their own destructive toast.
      if (structureOk) {
        toast({
          title: t("settings.notifications.savedTitle"),
          description: t("settings.notifications.companySaved"),
        });
      }
    } finally {
      setPageSaving(false);
    }
  }, [pageSaving, toast, t]);

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (settingsQuery.isError && settings === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={settingsQuery.isFetching}
          onRetry={() => settingsQuery.refetch()}
        />
      </div>
    );
  }

  if (!settings) {
    return <Navigate to="/setup" replace />;
  }

  const busy = pageSaving || saving;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Business details | Xefe"
        description="Company details, work locations, and teams"
        noIndex
      />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <Link
          to="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.allSettings")}
        </Link>
        <PageHeader
          title={t("settings.hub.companyLabel") || "Business details"}
          subtitle={
            t("settings.hub.companyDesc") ||
            "Your company name, address, phone, and logo."
          }
          icon={Building}
          iconColor="text-primary"
        />

        <div className="space-y-6">
          <CompanyDetailsTab
            tenantId={tenantId}
            saving={busy}
            setSaving={setSaving}
            onReload={handleReload}
            t={t}
            initialData={settings.companyDetails}
            hideSaveButton
            registerSave={registerDetailsSave}
            onRequestSave={() => {
              void handleSaveAll();
            }}
          />

          <CompanyStructureTab
            tenantId={tenantId}
            saving={busy}
            setSaving={setSaving}
            onReload={handleReload}
            t={t}
            initialData={settings.companyStructure}
            hideSaveButton
            registerSave={registerStructureSave}
          />

          {/* One Save for the page. On a phone this is the last thing in the
              scroll, which is where the thumb already is. */}
          <div className="flex justify-end pb-2">
            <Button
              onClick={() => {
                void handleSaveAll();
              }}
              disabled={busy}
              className="min-h-11 w-full sm:w-auto"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("settings.company.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
