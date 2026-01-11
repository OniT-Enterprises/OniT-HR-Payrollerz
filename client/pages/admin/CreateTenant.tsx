import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ChevronLeft, Loader2, CheckCircle } from "lucide-react";
import { adminService } from "@/services/adminService";
import { TenantPlan, PLAN_LIMITS } from "@/types/tenant";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const plans: { value: TenantPlan; label: string; description: string }[] = [
  { value: "free", label: "Free", description: "Up to 5 employees, 2 users" },
  { value: "starter", label: "Starter", description: "Up to 25 employees, 5 users" },
  { value: "professional", label: "Professional", description: "Up to 100 employees, 20 users" },
  { value: "enterprise", label: "Enterprise", description: "Unlimited employees and users" },
];

export default function CreateTenant() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    ownerEmail: "",
    plan: "free" as TenantPlan,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !userProfile) {
      toast.error("You must be logged in");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Tenant name is required");
      return;
    }

    if (!formData.ownerEmail.trim()) {
      toast.error("Owner email is required");
      return;
    }

    try {
      setLoading(true);

      // For now, we'll create the tenant with the current user as owner
      // In a full implementation, you'd look up the user by email or send an invite
      const tenantId = await adminService.createTenant(
        formData.name,
        formData.ownerEmail,
        user.uid, // Using current user as owner for now
        formData.plan,
        user.uid
      );

      toast.success("Tenant created successfully!");
      navigate(`/admin/tenants/${tenantId}`);
    } catch (error) {
      console.error("Error creating tenant:", error);
      toast.error("Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="border-b border-border/50">
        <div className="px-6 py-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/tenants")}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create Tenant</h1>
              <p className="text-muted-foreground mt-1">
                Add a new organization to the platform
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 lg:px-8 py-6">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Tenant Details</CardTitle>
                <CardDescription>
                  Enter the basic information for the new tenant organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    placeholder="Acme Corp"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be displayed throughout the application
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Owner Email *</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    placeholder="admin@acme.com"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    The user who will be the tenant owner with full access
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan">Subscription Plan</Label>
                  <Select
                    value={formData.plan}
                    onValueChange={(value: TenantPlan) =>
                      setFormData({ ...formData, plan: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.value} value={plan.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{plan.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {plan.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan Limits Preview */}
                {formData.plan && (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">Plan Limits</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Max Employees</p>
                        <p className="font-medium">
                          {PLAN_LIMITS[formData.plan]?.maxEmployees?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Max Users</p>
                        <p className="font-medium">
                          {PLAN_LIMITS[formData.plan]?.maxUsers?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Storage</p>
                        <p className="font-medium">{PLAN_LIMITS[formData.plan]?.storageGB} GB</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/tenants")}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Create Tenant
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
