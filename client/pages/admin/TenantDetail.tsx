import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { isTenantSubscribed } from "@/lib/packagePricing";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TenantProfileForm } from "@/components/admin/TenantProfileForm";
import { TenantMembersCard } from "@/components/admin/TenantMembersCard";
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
  useDeleteTenant,
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
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  pending: "Pending",
  cancelled: "Cancelled",
};

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
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { startImpersonation } = useTenant();
  const { data: tenant, isLoading } = useTenantDetail(id);
  // No zero-default: while stats load we fall back to the stored tenant count
  // instead of briefly showing 0. Live count wins once loaded (it's what
  // billing charges for; the stored field can be stale).
  const { data: stats } = useTenantStats(id);
  const updateTenantMutation = useUpdateTenantProfile();
  const suspendMutation = useSuspendTenant();
  const reactivateMutation = useReactivateTenant();
  const deleteMutation = useDeleteTenant();
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [formValue, setFormValue] = useState<TenantProfileInput | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
        currentEmployeeCount: stats?.employeeCount ?? tenant.currentEmployeeCount ?? 0,
        plan: tenant.plan,
      });
    }
  }, [stats?.employeeCount, tenant]);

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

  const handleDelete = async () => {
    if (!tenant || !user || !userProfile?.isSuperAdmin) return;

    try {
      await deleteMutation.mutateAsync({
        tenantId: tenant.id,
        actorUid: user.uid,
        actorEmail: userProfile.email,
      });
      toast.success(`${tenant.name} has been deleted`);
      navigate("/admin/tenants");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete this tenant.");
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
                    <Badge variant="outline">{statusLabels[tenant.status] ?? tenant.status}</Badge>
                    <Badge
                      variant="outline"
                      className={isTenantSubscribed(tenant) ? "border-primary/40 text-primary" : "text-muted-foreground"}
                    >
                      {isTenantSubscribed(tenant) ? "Subscribed" : "Free plan"}
                    </Badge>
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

              {userProfile?.isSuperAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleteMutation.isPending}
                  className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tenant.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the tenant record for {tenant.name}. Only superadmins can perform
              this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteMutation.isPending || !userProfile?.isSuperAdmin}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                      <p className="text-sm text-muted-foreground">Active Employees</p>
                      <p className="text-2xl font-bold">
                        {stats?.employeeCount ?? tenant.currentEmployeeCount ?? 0}
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
                      <p className="text-2xl font-bold">{stats?.memberCount ?? 0}</p>
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

            <TenantMembersCard tenantId={tenant.id} tenantName={tenant.name} />

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
                    <p className="text-sm text-muted-foreground">Active Employees (billed seats)</p>
                    <p className="font-medium">{stats?.employeeCount ?? tenant.currentEmployeeCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription</p>
                    <p className="font-medium">
                      {isTenantSubscribed(tenant)
                        ? `Subscribed${typeof tenant.monthlySubscriptionAmount === "number" ? ` — $${tenant.monthlySubscriptionAmount.toFixed(2)}/mo` : ""}`
                        : "Free plan"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Until</p>
                    <p className="font-medium">{formatDateValue(tenant.subscriptionPaidUntil)}</p>
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
