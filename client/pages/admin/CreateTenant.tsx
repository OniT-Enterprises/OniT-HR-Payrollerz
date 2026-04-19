import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TenantProfileForm } from "@/components/admin/TenantProfileForm";
import { TenantProfileInput } from "@/services/adminService";
import { useCreateTenant } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const initialValue: TenantProfileInput = {
  name: "",
  tradingName: "",
  tinNumber: "",
  address: "",
  phone: "",
  ownerEmail: "",
  billingEmail: "",
  currentEmployeeCount: 0,
  plan: "free",
};

export default function CreateTenant() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const createTenantMutation = useCreateTenant();
  const [formValue, setFormValue] = useState<TenantProfileInput>(initialValue);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      toast.error("You must be signed in to create a tenant.");
      return;
    }

    if (!formValue.name.trim() || !formValue.ownerEmail.trim()) {
      toast.error("Organization name and owner email are required.");
      return;
    }

    try {
      const tenantId = await createTenantMutation.mutateAsync({
        input: formValue,
        createdBy: user.uid,
        actorEmail: user.email || userProfile?.email || "",
      });
      toast.success("Tenant created");
      navigate(`/admin/tenants/${tenantId}`);
    } catch (error) {
      console.error(error);
      toast.error("We could not create that tenant yet.");
    }
  };

  return (
    <AdminLayout>
      <div className="border-b border-border/50">
        <div className="px-6 py-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/tenants")} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Tenants
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create Tenant</h1>
              <p className="text-muted-foreground mt-1">
                Create the tenant once, with the same core organization information used throughout the Admin Console.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="max-w-4xl">
          <TenantProfileForm
            title="Tenant details"
            description="Use the same core organization fields here that appear later on the tenant details page."
            value={formValue}
            onChange={setFormValue}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/admin/tenants")}
            loading={createTenantMutation.isPending}
            submitLabel="Create Tenant"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
