import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TenantProfileForm } from "@/components/admin/TenantProfileForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  useReactivateTenant,
  useSuspendTenant,
  useTenantDetail,
  useTenantStats,
  useUpdateTenantProfile,
} from "@/hooks/useAdmin";
import { TenantProfileInput } from "@/services/adminService";
import { OptionalTimestamp } from "@/types/firebase";
import {
  Ban,
  Building2,
  Calendar,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Loader2,
  Pencil,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

function formatDateValue(value: OptionalTimestamp): string {
  if (!value) return "-";
  if (typeof value === "object" && "toDate" in value) {
    return formatDateTL(value.toDate()) || "-";
  }
  if (value instanceof Date) {
    return formatDateTL(value) || "-";
  }
  return "-";
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { startImpersonation } = useTenant();
  const { data: tenant, isLoading } = useTenantDetail(id);
  const { data: stats = { memberCount: 0, employeeCount: 0 } } = useTenantStats(id);
  const updateTenantMutation = useUpdateTenantProfile();
  const suspendMutation = useSuspendTenant();
  const reactivateMutation = useReactivateTenant();
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState<TenantProfileInput | null>(null);

  useEffect(() => {
    if (tenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormValue({
        name: tenant.name || "",
        tradingName: tenant.tradingName || "",
        tinNumber: tenant.tinNumber || "",
        address: tenant.address || "",
        phone: tenant.phone || "",
        ownerEmail: tenant.ownerEmail || "",
        billingEmail: tenant.billingEmail || "",
        currentEmployeeCount: tenant.currentEmployeeCount ?? stats.employeeCount ?? 0,
        plan: tenant.plan,
      });
    }
  }, [stats.employeeCount, tenant]);

  const featureBadges = useMemo(() => {
    if (!tenant) return [];
    return [
      "People",
      tenant.features?.timeleave !== false ? "Time & Leave" : null,
      tenant.features?.payroll !== false ? "Payroll" : null,
      tenant.features?.money !== false ? "Money" : null,
      tenant.features?.accounting !== false ? "Accounting" : null,
      tenant.features?.reports !== false ? "Reports" : null,
    ].filter(Boolean) as string[];
  }, [tenant]);

  const handleImpersonate = async () => {
    if (!tenant) return;

    try {
      await startImpersonation(tenant.id, tenant.name);
      toast.success(`Now viewing as ${tenant.name}`);
      navigate("/");
    } catch (error) {
      console.error(error);
      toast.error("Could not start impersonation.");
    }
  };

  const handleSuspend = async () => {
    if (!tenant || !user || !userProfile) return;

    try {
      await suspendMutation.mutateAsync({
        tenantId: tenant.id,
        reason: "Suspended by admin",
        actorUid: user.uid,
        actorEmail: userProfile.email,
      });
      toast.success(`${tenant.name} suspended`);
    } catch (error) {
      console.error(error);
      toast.error("Could not suspend this tenant.");
    }
  };

  const handleReactivate = async () => {
    if (!tenant || !user || !userProfile) return;

    try {
      await reactivateMutation.mutateAsync({
        tenantId: tenant.id,
        actorUid: user.uid,
        actorEmail: userProfile.email,
      });
      toast.success(`${tenant.name} reactivated`);
    } catch (error) {
      console.error(error);
      toast.error("Could not reactivate this tenant.");
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenant || !formValue) return;

    try {
      await updateTenantMutation.mutateAsync({ tenantId: tenant.id, input: formValue });
      toast.success("Tenant details updated");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Could not save tenant changes.");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!tenant) {
    return (
      <AdminLayout>
        <div className="px-6 py-12 lg:px-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Tenant not found.</p>
          <Button variant="link" onClick={() => navigate("/admin/tenants")}>
            Back to Tenants
          </Button>
        </div>
      </AdminLayout>
    );
  }

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

          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
                    <Badge variant="outline">{tenant.status}</Badge>
                    <Badge variant="outline">{tenant.plan}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Tenant ID: {tenant.id}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {featureBadges.map((feature) => (
                    <Badge key={feature} className="bg-primary/10 text-primary border-primary/20">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setIsEditing((current) => !current)} className="gap-2">
                <Pencil className="h-4 w-4" />
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>
              <Button variant="outline" onClick={handleImpersonate} disabled={tenant.status !== "active"} className="gap-2">
                <UserCog className="h-4 w-4" />
                Impersonate
              </Button>

              {tenant.status === "active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Ban className="h-4 w-4" />
                      Suspend
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend {tenant.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will block tenant access until the organization is reactivated.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSuspend} className="bg-red-600">
                        Suspend
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleReactivate} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        {isEditing && formValue ? (
          <div className="max-w-4xl">
            <TenantProfileForm
              title="Tenant details"
              description="Edit the same core fields used when the tenant was created."
              value={formValue}
              onChange={setFormValue}
              onSubmit={handleSave}
              onCancel={() => setIsEditing(false)}
              loading={updateTenantMutation.isPending}
              submitLabel="Save Changes"
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-2xl font-bold">
                        {tenant.currentEmployeeCount ?? stats.employeeCount ?? 0}
                      </p>
                    </div>
                    <Users className="h-5 w-5 text-cyan-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Platform Users</p>
                      <p className="text-2xl font-bold">{stats.memberCount}</p>
                    </div>
                    <Users className="h-5 w-5 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Subscription</p>
                      <p className="text-2xl font-bold">
                        {typeof tenant.monthlySubscriptionAmount === "number"
                          ? `$${tenant.monthlySubscriptionAmount.toFixed(2)}`
                          : "-"}
                      </p>
                    </div>
                    <CreditCard className="h-5 w-5 text-violet-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-lg font-bold">{formatDateValue(tenant.createdAt)}</p>
                    </div>
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Organization profile</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Organization Name</p>
                    <p className="font-medium">{tenant.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trading Name</p>
                    <p className="font-medium">{tenant.tradingName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tin Number</p>
                    <p className="font-medium">{tenant.tinNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{tenant.phone || "-"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{tenant.address || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Subscription and contacts</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Owner Email</p>
                    <p className="font-medium">{tenant.ownerEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Email</p>
                    <p className="font-medium">{tenant.billingEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Number of Employees</p>
                    <p className="font-medium">{tenant.currentEmployeeCount ?? stats.employeeCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription Plan</p>
                    <p className="font-medium">{tenant.plan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PaidUntil</p>
                    <p className="font-medium">{formatDateValue(tenant.subscriptionPaidUntil)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Machine ID</p>
                    <p className="font-medium">{tenant.id}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {tenant.status === "suspended" && tenant.suspendedReason && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-red-600">Suspension details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>
                    <span className="text-muted-foreground">Reason:</span> {tenant.suspendedReason}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Suspended on:</span>{" "}
                    {formatDateValue(tenant.suspendedAt)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
