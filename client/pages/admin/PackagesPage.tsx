import { useState } from "react";
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
  calculatePackageEstimate,
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

  const pricing = normalizeBillingPackagesConfig(form ?? DEFAULT_PACKAGES_CONFIG);

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

  const previews = PREVIEW_COUNTS.map((count) => ({
    count,
    estimate: calculatePackageEstimate(pricing, { employeeCount: count }),
  }));

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
            One per-employee rate, a small-team minimum, and one annual discount. Every account
            gets every feature — paying is what unlocks finalizing a payroll run.
          </p>
        </div>

        {isLoading || !form ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    Rate
                  </CardTitle>
                  <CardDescription>The same simple rules used by the app and Stripe.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="pricePerEmployee">Price / employee / month (USD)</Label>
                    <Input
                      id="pricePerEmployee"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.pricePerEmployee}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, pricePerEmployee: Number(event.target.value) || 0 } : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumEmployees">Minimum billed employees</Label>
                    <Input
                      id="minimumEmployees"
                      type="number"
                      min="1"
                      step="1"
                      value={form.minimumEmployees}
                      onChange={(event) =>
                        setForm((current) => current ? {
                          ...current,
                          minimumEmployees: Number(event.target.value) || 1,
                        } : current)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annualMonthsCharged">Months charged for annual access</Label>
                    <Input
                      id="annualMonthsCharged"
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      value={form.annualMonthsCharged}
                      onChange={(event) =>
                        setForm((current) => current ? {
                          ...current,
                          annualMonthsCharged: Number(event.target.value) || 1,
                        } : current)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {12 - pricing.annualMonthsCharged} month{12 - pricing.annualMonthsCharged === 1 ? "" : "s"} free.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-emerald-600" />
                    Price preview
                  </CardTitle>
                  <CardDescription>Monthly and annual totals at different headcounts.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {previews.map((preview) => (
                    <div key={preview.count} className="rounded-lg border border-border/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">{preview.count} employees</p>
                      <p className="text-2xl font-bold">{formatMoney(preview.estimate.monthlyTotal)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(preview.estimate.annualTotal)}/year
                      </p>
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
