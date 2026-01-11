import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Building2,
  ChevronLeft,
  UserCog,
  Ban,
  CheckCircle,
  Loader2,
  Users,
  Calendar,
  Mail,
  Globe,
  CreditCard,
  Settings,
  BarChart3,
} from "lucide-react";
import { adminService } from "@/services/adminService";
import { TenantConfig, TenantStatus, TenantPlan } from "@/types/tenant";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

const statusColors: Record<TenantStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const planColors: Record<TenantPlan, string> = {
  free: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  starter: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  professional: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  enterprise: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { startImpersonation } = useTenant();
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [stats, setStats] = useState({ memberCount: 0, employeeCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [tenantData, statsData] = await Promise.all([
        adminService.getTenantById(id),
        adminService.getTenantStats(id),
      ]);

      if (!tenantData) {
        toast.error("Tenant not found");
        navigate("/admin/tenants");
        return;
      }

      setTenant(tenantData);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading tenant:", error);
      toast.error("Failed to load tenant");
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!tenant) return;

    try {
      await startImpersonation(tenant.id, tenant.name);
      toast.success(`Now viewing as ${tenant.name}`);
      navigate("/");
    } catch (error) {
      console.error("Error impersonating:", error);
      toast.error("Failed to impersonate tenant");
    }
  };

  const handleSuspend = async () => {
    if (!tenant || !user || !userProfile) return;

    try {
      await adminService.suspendTenant(
        tenant.id,
        "Suspended by admin",
        user.uid,
        userProfile.email
      );
      toast.success(`${tenant.name} has been suspended`);
      loadTenant();
    } catch (error) {
      console.error("Error suspending tenant:", error);
      toast.error("Failed to suspend tenant");
    }
  };

  const handleReactivate = async () => {
    if (!tenant || !user || !userProfile) return;

    try {
      await adminService.reactivateTenant(tenant.id, user.uid, userProfile.email);
      toast.success(`${tenant.name} has been reactivated`);
      loadTenant();
    } catch (error) {
      console.error("Error reactivating tenant:", error);
      toast.error("Failed to reactivate tenant");
    }
  };

  const formatDate = (date: any): string => {
    if (!date) return "-";
    if (date.toDate) {
      return date.toDate().toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!tenant) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Tenant not found</p>
          <Button variant="link" onClick={() => navigate("/admin/tenants")} className="mt-2">
            Back to tenants
          </Button>
        </div>
      </AdminLayout>
    );
  }

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

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
                  <Badge className={`border ${statusColors[tenant.status]}`}>
                    {tenant.status}
                  </Badge>
                  <Badge className={`border ${planColors[tenant.plan]}`}>{tenant.plan}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">ID: {tenant.id}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleImpersonate}
                disabled={tenant.status !== "active"}
                className="gap-2"
              >
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
                      <AlertDialogTitle>Suspend Tenant?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disable access for all users in {tenant.name}. They will not be
                        able to log in until the tenant is reactivated.
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
                <Button
                  onClick={handleReactivate}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Users</p>
                      <p className="text-2xl font-bold">{stats.memberCount}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-2xl font-bold">{stats.employeeCount}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Users className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Max Employees</p>
                      <p className="text-2xl font-bold">{tenant.limits?.maxEmployees || "-"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <BarChart3 className="h-5 w-5 text-violet-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-lg font-bold">{formatDate(tenant.createdAt)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Calendar className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Tenant Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Slug</p>
                      <p className="font-medium">{tenant.slug || "-"}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Email</p>
                      <p className="font-medium">{tenant.billingEmail || "-"}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stripe Customer ID</p>
                      <p className="font-medium font-mono text-sm">
                        {tenant.stripeCustomerId || "-"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Timezone</p>
                      <p className="font-medium">{tenant.settings?.timezone || "Not set"}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Currency</p>
                      <p className="font-medium">{tenant.settings?.currency || "Not set"}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date Format</p>
                      <p className="font-medium">{tenant.settings?.dateFormat || "Not set"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Features */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Enabled Features</CardTitle>
                <CardDescription>Features available to this tenant</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tenant.features?.hiring && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Hiring
                    </Badge>
                  )}
                  {tenant.features?.timeleave && (
                    <Badge className="bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                      Time & Leave
                    </Badge>
                  )}
                  {tenant.features?.performance && (
                    <Badge className="bg-orange-500/10 text-orange-600 border border-orange-500/20">
                      Performance
                    </Badge>
                  )}
                  {tenant.features?.payroll && (
                    <Badge className="bg-green-500/10 text-green-600 border border-green-500/20">
                      Payroll
                    </Badge>
                  )}
                  {tenant.features?.reports && (
                    <Badge className="bg-violet-500/10 text-violet-600 border border-violet-500/20">
                      Reports
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Suspension Info */}
            {tenant.status === "suspended" && tenant.suspendedReason && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">Suspension Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>
                    <span className="text-muted-foreground">Reason:</span> {tenant.suspendedReason}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Suspended:</span>{" "}
                    {formatDate(tenant.suspendedAt)}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Tenant Settings</CardTitle>
                <CardDescription>
                  Settings management coming soon. Use Firebase Console for now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Advanced settings like plan changes, feature toggles, and billing management will
                  be available in a future update.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
