import React, { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Loader2, Package } from "lucide-react";
import { usePackagesConfig, useSavePackagesConfig } from "@/hooks/useAdmin";
import { PackagesConfig } from "@/types/admin";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const createEmptyTier = (index: number) => ({
  id: `tier-new-${index}`,
  minEmployees: 0,
  maxEmployees: null as number | null,
  pricePerEmployee: 0,
});

export default function PackagesPage() {
  const { user, userProfile } = useAuth();
  const { data, isLoading } = usePackagesConfig();
  const saveMutation = useSavePackagesConfig();
  const [form, setForm] = useState<PackagesConfig | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  const updateModulePrice = (moduleId: string, nextValue: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            modulePrices: current.modulePrices.map((modulePrice) =>
              modulePrice.id === moduleId
                ? { ...modulePrice, monthlyPrice: Number(nextValue) || 0 }
                : modulePrice,
            ),
          }
        : current,
    );
  };

  const updateTier = (
    tierId: string,
    field: "minEmployees" | "maxEmployees" | "pricePerEmployee",
    nextValue: string,
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            employeePricingTiers: current.employeePricingTiers.map((tier) => {
              if (tier.id !== tierId) return tier;
              if (field === "maxEmployees") {
                return {
                  ...tier,
                  maxEmployees: nextValue.trim() === "" ? null : Number(nextValue) || 0,
                };
              }
              return { ...tier, [field]: Number(nextValue) || 0 };
            }),
          }
        : current,
    );
  };

  const addTier = () => {
    setForm((current) =>
      current
        ? {
            ...current,
            employeePricingTiers: [
              ...current.employeePricingTiers,
              createEmptyTier(current.employeePricingTiers.length + 1),
            ],
          }
        : current,
    );
  };

  const removeTier = (tierId: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            employeePricingTiers: current.employeePricingTiers.filter((tier) => tier.id !== tierId),
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!form || !user) return;

    try {
      await saveMutation.mutateAsync({
        config: form,
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
            <p className="text-sm uppercase tracking-[0.24em] text-violet-500">Admin pricing</p>
            <h1 className="text-4xl font-bold tracking-tight">Packages</h1>
            <p className="text-muted-foreground mt-2">
              Set the monthly module prices and the employee sliding-scale tiers used for tenant billing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {form?.modulePrices.length || 0} modules
            </Badge>
            <Badge variant="secondary">
              {form?.employeePricingTiers.length || 0} tiers
            </Badge>
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
                  <Package className="h-5 w-5 text-violet-500" />
                  Module pricing
                </CardTitle>
                <CardDescription>One monthly price per billable module.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {form.modulePrices.map((modulePrice) => (
                    <div key={modulePrice.id} className="rounded-xl border border-border/50 p-4 space-y-3">
                      <div>
                        <p className="font-medium">{modulePrice.label}</p>
                        <p className="text-sm text-muted-foreground">Monthly module fee</p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={modulePrice.monthlyPrice}
                        onChange={(event) => updateModulePrice(modulePrice.id, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Employee sliding scale</CardTitle>
                  <CardDescription>
                    Set the per-employee cost for each employee-count band.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={addTier} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Tier
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Min employees</TableHead>
                        <TableHead>Max employees</TableHead>
                        <TableHead>Price / employee</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.employeePricingTiers.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={tier.minEmployees}
                              onChange={(event) => updateTier(tier.id, "minEmployees", event.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Leave blank for open ended"
                              value={tier.maxEmployees ?? ""}
                              onChange={(event) => updateTier(tier.id, "maxEmployees", event.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.pricePerEmployee}
                              onChange={(event) => updateTier(tier.id, "pricePerEmployee", event.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(tier.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Packages
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
