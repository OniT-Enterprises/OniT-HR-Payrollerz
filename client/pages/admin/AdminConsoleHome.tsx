import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Shield,
  Building2,
  FileText,
  Package,
  ArrowRight,
  Database,
  Plus,
  Loader2,
} from "lucide-react";
import { useAllTenants, useAllUsers, useAuditLog, usePackagesConfig, useSuperAdminRequests } from "@/hooks/useAdmin";
import { OptionalTimestamp } from "@/types/firebase";

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

export default function AdminConsoleHome() {
  const navigate = useNavigate();
  const { data: users = [], isLoading: loadingUsers } = useAllUsers();
  const { data: tenants = [], isLoading: loadingTenants } = useAllTenants();
  const { data: auditEntries = [], isLoading: loadingAudit } = useAuditLog(8);
  const { data: packagesConfig, isLoading: loadingPackages } = usePackagesConfig();
  const { data: requests = [], isLoading: loadingRequests } = useSuperAdminRequests();

  const superAdmins = users.filter((user) => user.isSuperAdmin);
  const pendingRequests = requests.filter((request) => request.status !== "approved" && request.status !== "rejected");
  const topTenants = tenants.slice(0, 5);
  const recentAudit = auditEntries.slice(0, 5);
  const modulePrices = packagesConfig?.modulePrices ?? [];

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-500">Platform management</p>
            <h1 className="text-4xl font-bold tracking-tight">Admin Console</h1>
            <p className="text-muted-foreground mt-2">
              One place for super admins, tenants, packages, and audit activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary">{superAdmins.length} super admins</Badge>
            <Badge variant="secondary">{tenants.length} tenants</Badge>
            <Badge variant="secondary">{pendingRequests.length} approvals pending</Badge>
          </div>
        </div>

        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Super Admins
              </CardTitle>
              <CardDescription>
                Manage who can administer the whole platform. Requests stay visible until another super admin confirms them.
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/admin/users")} className="gap-2">
              Edit Superadmins
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingUsers || loadingRequests ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Tenants</TableHead>
                        <TableHead>Last login</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {superAdmins.slice(0, 5).map((user) => (
                        <TableRow key={user.uid}>
                          <TableCell>
                            <div className="font-medium">{user.displayName || user.email}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </TableCell>
                          <TableCell>{user.tenantIds?.length || 0}</TableCell>
                          <TableCell>{formatDateValue(user.lastLoginAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Pending confirmations</p>
                    <p className="text-sm text-muted-foreground">
                      These stay here until another super admin confirms them.
                    </p>
                  </div>
                  {pendingRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending super admin requests.</p>
                  ) : (
                    pendingRequests.slice(0, 4).map((request) => (
                      <div key={request.id} className="rounded-lg border border-border/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{request.targetEmail}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.type === "grant" ? "Grant access" : "Remove access"}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {request.status === "awaiting_confirmation" ? "Awaiting confirmation" : "Awaiting user"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                Tenants
              </CardTitle>
              <CardDescription>
                Manage all tenant organizations on the platform.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              {import.meta.env.DEV && (
                <Button variant="outline" onClick={() => navigate("/admin/seed")} className="gap-2">
                  <Database className="h-4 w-4" />
                  Seed & Audit
                </Button>
              )}
              <Button onClick={() => navigate("/admin/tenants/new")} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Tenant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTenants ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-xl border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>PaidUntil</TableHead>
                      <TableHead>MonthlySubscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topTenants.map((tenant) => (
                      <TableRow
                        key={tenant.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {tenant.tradingName || tenant.legalName || tenant.id}
                          </div>
                        </TableCell>
                        <TableCell>{tenant.plan}</TableCell>
                        <TableCell>{formatDateValue(tenant.subscriptionPaidUntil)}</TableCell>
                        <TableCell>
                          {typeof tenant.monthlySubscriptionAmount === "number"
                            ? `$${tenant.monthlySubscriptionAmount.toFixed(2)}`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-violet-500" />
                  Packages
                </CardTitle>
                <CardDescription>
                  Configure module pricing and employee sliding-scale pricing.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate("/admin/packages")} className="gap-2">
                Manage Packages
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPackages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {modulePrices.slice(0, 6).map((modulePrice) => (
                      <div key={modulePrice.id} className="rounded-lg border border-border/50 p-3">
                        <p className="text-sm text-muted-foreground">{modulePrice.label}</p>
                        <p className="text-xl font-semibold">${modulePrice.monthlyPrice.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employees</TableHead>
                          <TableHead>Price / employee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(packagesConfig?.employeePricingTiers || []).slice(0, 4).map((tier) => (
                          <TableRow key={tier.id}>
                            <TableCell>
                              {tier.minEmployees} - {tier.maxEmployees ?? "up"}
                            </TableCell>
                            <TableCell>${tier.pricePerEmployee.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-500" />
                  Audit Log
                </CardTitle>
                <CardDescription>
                  Review the latest superadmin actions and platform changes.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate("/admin/audit")} className="gap-2">
                Open Audit Log
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingAudit ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAudit.map((entry, index) => (
                    <div key={`${entry.action}-${entry.targetId}-${index}`} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.targetName || entry.targetId}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatDateValue(entry.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
