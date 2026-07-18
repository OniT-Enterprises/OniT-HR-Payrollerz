/**
 * AdvancedTaxModeCard — tenant-wide opt-in for accountant-grade tax controls.
 *
 * Owner-only (firestore.rules allows tenant-doc updates only for owners).
 * Members with the 'accountant' role see the advanced controls regardless of
 * this switch, so it exists for owners who do their own books.
 */
import { useState } from "react";
import { paths } from "@/lib/paths";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { Calculator } from "lucide-react";

export function AdvancedTaxModeCard() {
  const { session, refreshSession } = useTenant();
  const tenantId = useTenantId();
  const { t } = useI18n();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  if (session?.role !== "owner") {
    return null;
  }

  const enabled = session.config?.advancedTaxMode === true;

  const handleToggle = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      // Firestore loads on demand — a static import would drag the heavy
      // vendor-firebase-firestore chunk into the initial page (entry budget).
      const [{ doc, updateDoc, serverTimestamp }, { db }] = await Promise.all([
        import("firebase/firestore"),
        import("@/lib/firebase-firestore"),
      ]);
      await updateDoc(doc(db, paths.tenant(tenantId)), {
        advancedTaxMode: next,
        updatedAt: serverTimestamp(),
      });
      await refreshSession();
      toast({
        title: t("common.success") || "Saved",
        description: next
          ? t("settings.advancedTax.enabledToast")
            || "Advanced tax controls are now visible."
          : t("settings.advancedTax.disabledToast")
            || "Back to the simple flow — Xefe applies safe defaults.",
      });
    } catch (error) {
      console.error("Failed to update advanced tax mode:", error);
      toast({
        title: t("common.error") || "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="advanced-tax-mode" className="text-sm font-medium">
              {t("settings.advancedTax.title") || "Advanced tax mode"}
            </Label>
            <p className="text-xs text-muted-foreground max-w-prose">
              {t("settings.advancedTax.description")
                || "Shows accountant-grade controls — supplier withholding, treaty rates, and ATTL filing forms — to everyone who manages this company. Leave off unless your accountant asked for it; Xefe applies safe defaults either way."}
            </p>
          </div>
        </div>
        <Switch
          id="advanced-tax-mode"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
          aria-label={t("settings.advancedTax.title") || "Advanced tax mode"}
        />
      </CardContent>
    </Card>
  );
}
