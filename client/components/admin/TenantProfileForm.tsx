import React from "react";
import { TenantProfileInput } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
              <Label htmlFor="tenant-employee-count">Active Employees (billed seats)</Label>
              <Input
                id="tenant-employee-count"
                type="number"
                value={value.currentEmployeeCount ?? 0}
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Auto-synced from the tenant's active employees — Stripe checkout and the
                daily quantity sync overwrite manual edits, so this is read-only.
              </p>
            </div>
          </div>

          {/* There is no plan to pick: every feature is free and a subscription
              unlocks exactly one action (finalizing payroll). Paid access is set
              per tenant under Subscription on the tenant page — see
              docs/BILLING.md. A "Subscription Plan" dropdown used to live here
              writing plan/limits that nothing read or enforced, which read as
              the way to grant paid access and was not. */}
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">Plan &amp; billing</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every feature is free for all tenants; a subscription unlocks finalizing
              payroll runs only. Set paid access on the tenant page under{" "}
              <span className="font-medium">Subscription</span> — "Record offline payment"
              for bank transfer or cash, or "Grant free access" for testers and pilots.
            </p>
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
