import React from "react";
import { TenantProfileInput } from "@/services/adminService";
import { TenantPlan, PLAN_LIMITS } from "@/types/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

type Props = {
  title: string;
  description: string;
  value: TenantProfileInput;
  onChange: (nextValue: TenantProfileInput) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  loading?: boolean;
  submitLabel: string;
};

const plans: { value: TenantPlan; label: string; description: string }[] = [
  { value: "free", label: "Free", description: "Entry setup for tiny teams" },
  { value: "starter", label: "Starter", description: "Small teams with paid support" },
  { value: "professional", label: "Professional", description: "Growing organizations" },
  { value: "enterprise", label: "Enterprise", description: "Large or bespoke organizations" },
];

export function TenantProfileForm({
  title,
  description,
  value,
  onChange,
  onSubmit,
  onCancel,
  loading = false,
  submitLabel,
}: Props) {
  const selectedLimits = PLAN_LIMITS[value.plan] ?? {
    maxEmployees: 0,
    maxUsers: 0,
    storageGB: 0,
  };
  const update = <K extends keyof TenantProfileInput>(field: K, nextValue: TenantProfileInput[K]) => {
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Organization Name</Label>
              <Input
                id="tenant-name"
                value={value.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Acme Corporation"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-trading-name">Trading Name</Label>
              <Input
                id="tenant-trading-name"
                value={value.tradingName || ""}
                onChange={(event) => update("tradingName", event.target.value)}
                placeholder="Acme"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-tin">Tin Number</Label>
              <Input
                id="tenant-tin"
                value={value.tinNumber || ""}
                onChange={(event) => update("tinNumber", event.target.value)}
                placeholder="12-3456-7890"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-phone">Phone Number</Label>
              <Input
                id="tenant-phone"
                value={value.phone || ""}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+670 7xx xxxx"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenant-address">Address</Label>
              <Input
                id="tenant-address"
                value={value.address || ""}
                onChange={(event) => update("address", event.target.value)}
                placeholder="Dili, Timor-Leste"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-owner-email">Owner Email</Label>
              <Input
                id="tenant-owner-email"
                type="email"
                value={value.ownerEmail}
                onChange={(event) => update("ownerEmail", event.target.value)}
                placeholder="owner@company.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-billing-email">Billing Email</Label>
              <Input
                id="tenant-billing-email"
                type="email"
                value={value.billingEmail || ""}
                onChange={(event) => update("billingEmail", event.target.value)}
                placeholder="billing@company.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-employee-count">Current Number of Employees</Label>
              <Input
                id="tenant-employee-count"
                type="number"
                min="0"
                value={value.currentEmployeeCount ?? 0}
                onChange={(event) => update("currentEmployeeCount", Number(event.target.value) || 0)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-plan">Subscription Plan</Label>
              <Select
                value={value.plan}
                onValueChange={(nextValue: TenantPlan) => update("plan", nextValue)}
                disabled={loading}
              >
                <SelectTrigger id="tenant-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{plan.label}</span>
                        <span className="text-xs text-muted-foreground">{plan.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">Plan limits</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">Max employees</p>
                <p className="font-medium">{selectedLimits.maxEmployees.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Max users</p>
                <p className="font-medium">{selectedLimits.maxUsers.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Storage</p>
                <p className="font-medium">{selectedLimits.storageGB} GB</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
