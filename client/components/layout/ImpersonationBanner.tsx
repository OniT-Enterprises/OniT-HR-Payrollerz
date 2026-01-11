import React from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedTenantName, stopImpersonation } = useTenant();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = async () => {
    try {
      await stopImpersonation();
      navigate("/admin/tenants");
    } catch (error) {
      console.error("Error stopping impersonation:", error);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2">
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            You are viewing as: <strong>{impersonatedTenantName || "Unknown Tenant"}</strong>
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExit}
          className="h-7 px-3 bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <X className="h-3 w-3 mr-1" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
