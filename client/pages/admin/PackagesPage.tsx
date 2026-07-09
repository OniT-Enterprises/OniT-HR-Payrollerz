import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, CheckCircle2, Loader2, Save, Users } from "lucide-react";
import { usePackagesConfig, useSavePackagesConfig } from "@/hooks/useAdmin";
import { PackagesConfig } from "@/types/admin";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ALL_FEATURES,
  DEFAULT_PACKAGES_CONFIG,
  normalizeBillingPackagesConfig,
} from "@/lib/packagePricing";

// Example headcounts used to preview monthly totals.
const PREVIEW_COUNTS = [5, 20, 50, 100];

export default function PackagesPage() {
  const { user, userProfile } = useAuth();
  const { data, isLoading } = usePackagesConfig();
  const saveMutation = useSavePackagesConfig();
  const [form, setForm] = useState<PackagesConfig | null>(null);

  // Sync server config into the editable form during render (source guard).
  const [syncedData, setSyncedData] = useState<typeof data>(undefined);
  if (data && data !== syncedData) {
    setSyncedData(data);
    setForm(normalizeBillingPackagesConfig(data));
  }

  const rate = form?.pricePerEmployee ?? DEFAULT_PACKAGES_CONFIG.pricePerEmployee;

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

  const previews = useMemo(
    () => PREVIEW_COUNTS.map((count) => ({ count, total: rate * count })),
    [rate],
  );

  const handleSave = async () => {
    if (!form || !user) return;
    try {
      await saveMutation.mutateAsync({
        config: normalizeBillingPackagesConfig(form),
        actorUid: user.uid,
        actorEmail: user.email || userProfile?.email || "",
      });
      toast.success("Pricing saved");
    } catch (error) {
      console.error(error);
      toast.error("Could not save pricing");
    }
  };

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-600">Admin pricing</p>
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            One flat rate per employee, per month. Every account gets every feature — paying is
            what unlocks finalizing a payroll run.
          </p>
        </div>

        {isLoading || !form ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    Rate
                  </CardTitle>
                  <CardDescription>Charged per employee, per month.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-w-[200px]">
                    <Label htmlFor="pricePerEmployee">Price / employee / month (USD)</Label>
                    <Input
                      id="pricePerEmployee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pricePerEmployee}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, pricePerEmployee: Number(event.target.value) || 0 } : current,
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-emerald-600" />
                    Monthly preview
                  </CardTitle>
                  <CardDescription>What tenants pay at different headcounts.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {previews.map((preview) => (
                    <div key={preview.count} className="rounded-lg border border-border/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">{preview.count} employees</p>
                      <p className="text-2xl font-bold">{formatMoney(preview.total)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Included with every account</CardTitle>
                <CardDescription>
                  Free and paid accounts alike. Free accounts can do everything except finalize a
                  payroll run.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="sticky bottom-4 flex justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 shadow-lg">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save pricing
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
