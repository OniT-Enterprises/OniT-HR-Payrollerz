import React, { useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calculator, CheckCircle2, Film, Loader2, Save, Users } from "lucide-react";
import { usePackagesConfig, useSavePackagesConfig } from "@/hooks/useAdmin";
import { BillableModuleId, PackagePlanDefinition, PackagesConfig } from "@/types/admin";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { calculatePackageEstimate, DEFAULT_PACKAGES_CONFIG, normalizeBillingPackagesConfig } from "@/lib/packagePricing";

// Example headcount used only to preview monthly totals in the editor.
const DEMO_EMPLOYEES = 20;

// Modules a plan can unlock. These are feature toggles now — pricing is purely
// per-employee, so modules no longer carry individual prices.
const MODULE_OPTIONS: { id: BillableModuleId; label: string }[] = [
  { id: "people", label: "People" },
  { id: "timeleave", label: "Time & Leave" },
  { id: "payroll", label: "Payroll" },
  { id: "money", label: "Money" },
  { id: "accounting", label: "Accounting" },
  { id: "reports", label: "Reports" },
];

export default function PackagesPage() {
  const { user, userProfile } = useAuth();
  const { data, isLoading } = usePackagesConfig();
  const saveMutation = useSavePackagesConfig();
  const [form, setForm] = useState<PackagesConfig | null>(null);

  // Sync server config into the editable form whenever the query data changes.
  // Done during render (with a source guard) rather than in an effect to avoid
  // the cascading-render lint rule and an extra render pass.
  const [syncedData, setSyncedData] = useState<typeof data>(undefined);
  if (data && data !== syncedData) {
    setSyncedData(data);
    setForm(normalizeBillingPackagesConfig(data));
  }

  const previewEstimates = useMemo(() => {
    const config = form ?? DEFAULT_PACKAGES_CONFIG;
    return config.planDefinitions.map((plan) =>
      calculatePackageEstimate(config, { planId: plan.id, employeeCount: DEMO_EMPLOYEES }),
    );
  }, [form]);

  const updatePlan = <K extends keyof PackagePlanDefinition>(
    planId: string,
    field: K,
    value: PackagePlanDefinition[K],
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            planDefinitions: current.planDefinitions.map((plan) =>
              plan.id === planId ? { ...plan, [field]: value } : plan,
            ),
          }
        : current,
    );
  };

  const updatePlanCompliance = (
    planId: string,
    field: keyof PackagePlanDefinition["complianceNotes"],
    value: boolean,
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            planDefinitions: current.planDefinitions.map((plan) =>
              plan.id === planId
                ? { ...plan, complianceNotes: { ...plan.complianceNotes, [field]: value } }
                : plan,
            ),
          }
        : current,
    );
  };

  const togglePlanModule = (planId: string, moduleId: BillableModuleId, checked: boolean) => {
    setForm((current) =>
      current
        ? {
            ...current,
            planDefinitions: current.planDefinitions.map((plan) => {
              if (plan.id !== planId) return plan;
              const modules = checked
                ? Array.from(new Set([...plan.includedModules, moduleId]))
                : plan.includedModules.filter((item) => item !== moduleId);
              return { ...plan, includedModules: modules };
            }),
          }
        : current,
    );
  };

  const updateHighlights = (planId: string, value: string) => {
    updatePlan(
      planId,
      "highlights",
      value.split("\n").map((line) => line.trim()).filter(Boolean),
    );
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

  const handleSave = async () => {
    if (!form || !user) return;
    try {
      await saveMutation.mutateAsync({
        config: normalizeBillingPackagesConfig(form),
        actorUid: user.uid,
        actorEmail: user.email || userProfile?.email || "",
      });
      toast.success("Packages saved");
    } catch (error) {
      console.error(error);
      toast.error("Could not save packages");
    }
  };

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-600">Admin pricing</p>
            <h1 className="text-4xl font-bold tracking-tight">Package price matrix</h1>
            <p className="text-muted-foreground mt-2">
              Pricing is per employee. Set each plan's monthly rate per employee, the features it
              unlocks, staff-app access, and the training-video handoff.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{form?.planDefinitions.length || 0} packages</Badge>
          </div>
        </div>

        {isLoading || !form ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-600" />
                  Plan preview
                </CardTitle>
                <CardDescription>
                  Example monthly totals for {DEMO_EMPLOYEES} employees. Each tenant is billed its
                  plan rate × its employee count.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {previewEstimates.map((estimate) => (
                  <div key={estimate.plan.id} className="rounded-lg border border-border/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{estimate.plan.label}</p>
                      <Badge variant={estimate.plan.staffAppIncluded ? "default" : "outline"}>
                        {estimate.plan.staffAppIncluded
                          ? "Staff app"
                          : estimate.plan.maxAdmins === null
                            ? "Unlimited admins"
                            : `${estimate.plan.maxAdmins} admin${estimate.plan.maxAdmins === 1 ? "" : "s"}`}
                      </Badge>
                    </div>
                    <p className="mt-4 text-2xl font-bold">
                      {estimate.monthlyTotal === 0 ? "Free" : formatMoney(estimate.monthlyTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.pricePerEmployee === 0
                        ? "No monthly cost"
                        : `${formatMoney(estimate.pricePerEmployee)}/employee × ${DEMO_EMPLOYEES}`}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {form.planDefinitions.map((plan) => (
                <Card key={plan.id} className="border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>{plan.label}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </div>
                      <Badge variant="outline">{plan.id}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${plan.id}-label`}>Package label</Label>
                        <Input
                          id={`${plan.id}-label`}
                          value={plan.label}
                          onChange={(event) => updatePlan(plan.id, "label", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${plan.id}-pricePerEmployee`} className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Price / employee
                        </Label>
                        <Input
                          id={`${plan.id}-pricePerEmployee`}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={plan.id === "free"}
                          value={plan.id === "free" ? 0 : plan.pricePerEmployee}
                          onChange={(event) =>
                            updatePlan(plan.id, "pricePerEmployee", Number(event.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${plan.id}-maxAdmins`}>Admin limit</Label>
                        <Input
                          id={`${plan.id}-maxAdmins`}
                          type="number"
                          min="0"
                          value={plan.maxAdmins ?? ""}
                          placeholder="No limit"
                          onChange={(event) =>
                            updatePlan(
                              plan.id,
                              "maxAdmins",
                              event.target.value.trim() === "" ? null : Number(event.target.value) || 0,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${plan.id}-description`}>Description</Label>
                      <Textarea
                        id={`${plan.id}-description`}
                        rows={2}
                        value={plan.description}
                        onChange={(event) => updatePlan(plan.id, "description", event.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Included features</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {MODULE_OPTIONS.map((moduleOption) => (
                          <label
                            key={moduleOption.id}
                            className="flex items-center gap-3 rounded-lg border border-border/50 p-3 text-sm"
                          >
                            <Checkbox
                              checked={plan.includedModules.includes(moduleOption.id)}
                              onCheckedChange={(checked) => togglePlanModule(plan.id, moduleOption.id, checked === true)}
                            />
                            <span className="flex-1">{moduleOption.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <div>
                          <p className="text-sm font-medium">Staff app</p>
                          <p className="text-xs text-muted-foreground">Included with this package</p>
                        </div>
                        <Switch
                          checked={plan.staffAppIncluded}
                          onCheckedChange={(checked) => updatePlan(plan.id, "staffAppIncluded", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <div>
                          <p className="text-sm font-medium">Sick days</p>
                          <p className="text-xs text-muted-foreground">Show leave tracking support</p>
                        </div>
                        <Switch
                          checked={plan.complianceNotes.sickDays}
                          onCheckedChange={(checked) => updatePlanCompliance(plan.id, "sickDays", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <div>
                          <p className="text-sm font-medium">Maternity leave</p>
                          <p className="text-xs text-muted-foreground">Show maternity leave support</p>
                        </div>
                        <Switch
                          checked={plan.complianceNotes.maternityLeave}
                          onCheckedChange={(checked) => updatePlanCompliance(plan.id, "maternityLeave", checked)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${plan.id}-trainingVideoUrl`} className="flex items-center gap-2">
                          <Film className="h-4 w-4" />
                          Training video URL
                        </Label>
                        <Input
                          id={`${plan.id}-trainingVideoUrl`}
                          value={plan.trainingVideoUrl ?? ""}
                          placeholder="Add once the video is ready"
                          onChange={(event) => updatePlan(plan.id, "trainingVideoUrl", event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${plan.id}-highlights`}>Website highlights</Label>
                      <Textarea
                        id={`${plan.id}-highlights`}
                        rows={4}
                        value={plan.highlights.join("\n")}
                        onChange={(event) => updateHighlights(plan.id, event.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Changes apply to billing after save.
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="sticky bottom-4 flex justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 shadow-lg">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save price matrix
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
