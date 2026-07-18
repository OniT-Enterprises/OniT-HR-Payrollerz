import React from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedTenantName, stopImpersonation } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = async () => {
    try {
      await stopImpersonation();
      navigate("/admin/tenants");
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      // Surface the error so the user is aware the exit failed
      throw error;
    }
  };

  return (
    <div className="border-b border-amber-950/40 bg-amber-800 text-amber-50" role="status">
      <div className="mx-auto flex min-h-11 max-w-screen-2xl items-center justify-between gap-3 px-4 py-1 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="truncate text-xs font-medium sm:text-sm">
            {t("common.viewingAs", {
              name: impersonatedTenantName || t("common.unknown"),
            })}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExit}
          className="h-9 shrink-0 border-amber-600/50 bg-amber-950/25 px-3 text-amber-50 hover:bg-amber-950/40 hover:text-white"
        >
          <X className="h-3 w-3 mr-1" />
          {t("common.exitImpersonation")}
        </Button>
      </div>
    </div>
  );
}
