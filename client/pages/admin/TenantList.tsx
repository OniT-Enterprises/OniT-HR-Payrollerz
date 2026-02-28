import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  UserCog,
  Ban,
  CheckCircle,
  Loader2,
  Sparkles,
  Calendar,
  Database,
} from "lucide-react";
import { useAllTenants, useSuspendTenant, useReactivateTenant } from "@/hooks/useAdmin";
import { TenantConfig, TenantStatus, TenantPlan } from "@/types/tenant";
import { OptionalTimestamp } from "@/types/firebase";
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

export default function TenantList() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { startImpersonation } = useTenant();
  const { data: tenants = [], isLoading: loading } = useAllTenants();
  const suspendMutation = useSuspendTenant();
  const reactivateMutation = useReactivateTenant();
  const [searchQuery, setSearchQuery] = useState("");

  const handleImpersonate = async (tenant: TenantConfig) => {
    try {
      await startImpersonation(tenant.id, tenant.name);
      toast.success(`Now viewing as ${tenant.name}`);
      navigate("/");
    } catch (_error) {
      toast.error("Failed to impersonate tenant");
    }
  };

  const handleSuspend = async (tenant: TenantConfig) => {
    if (!user || !userProfile) return;

    try {
      await suspendMutation.mutateAsync({
        tenantId: tenant.id,
        reason: "Suspended by admin",
        actorUid: user.uid,
        actorEmail: userProfile.email,
      });
      toast.success(`${tenant.name} has been suspended`);
    } catch (_error) {
      toast.error("Failed to suspend tenant");
    }
  };

  const handleReactivate = async (tenant: TenantConfig) => {
    if (!user || !userProfile) return;

    try {
      await reactivateMutation.mutateAsync({
        tenantId: tenant.id,
        actorUid: user.uid,
        actorEmail: userProfile.email,
      });
      toast.success(`${tenant.name} has been reactivated`);
    } catch (_error) {
      toast.error("Failed to reactivate tenant");
    }
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: OptionalTimestamp): string => {
    if (!date) return "-";
    if (typeof date === "object" && "toDate" in date) {
      return formatDateTL(date.toDate()) || "-";
    }
    if (date instanceof Date) {
      return formatDateTL(date) || "-";
    }
    return "-";
  };

  return (
    <AdminLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative px-6 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4 animate-fade-up">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Platform Management</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">Tenants</h1>
                <p className="text-muted-foreground">
                  Manage all tenant organizations on the platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 animate-fade-up stagger-2">
              {/* DEV ONLY: Seed & Audit button */}
              {import.meta.env.DEV && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/seed")}
                  className="gap-2"
                >
                  <Database className="h-4 w-4" />
                  Seed & Audit
                </Button>
              )}
              <Button
                onClick={() => navigate("/admin/tenants/new")}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25"
              >
                <Plus className="h-4 w-4" />
                Add Tenant
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Building2 className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {tenants.filter((t) => t.status === "active").length}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                  <p className="text-2xl font-bold text-red-600">
                    {tenants.filter((t) => t.status === "suspended").length}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Ban className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enterprise</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {tenants.filter((t) => t.plan === "enterprise").length}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">All Tenants</CardTitle>
                <CardDescription>
                  {filteredTenants.length} tenant{filteredTenants.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No tenants found</p>
                <Button
                  variant="link"
                  onClick={() => navigate("/admin/tenants/new")}
                  className="mt-2"
                >
                  Create your first tenant
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <Building2 className="h-4 w-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${statusColors[tenant.status]}`}>
                          {tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${planColors[tenant.plan]}`}>
                          {tenant.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(tenant.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleImpersonate(tenant)}
                              disabled={tenant.status !== "active"}
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Impersonate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {tenant.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => handleSuspend(tenant)}
                                className="text-red-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleReactivate(tenant)}
                                className="text-emerald-600"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
