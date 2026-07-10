import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Building2,
  FileText,
  Package,
  ArrowRight,
  AlertTriangle,
  Database,
  Plus,
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

interface SectionCardProps {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  description: string;
  loading: boolean;
  value: React.ReactNode;
  detail: string;
  onClick: () => void;
}

function SectionCard({ icon: Icon, iconClass, title, description, loading, value, detail, onClick }: SectionCardProps) {
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer border-border/50 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg p-2 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <h2 className="mt-4 font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {loading ? (
          <Skeleton className="mt-4 h-8 w-24" />
        ) : (
          <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{loading ? " " : detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminConsoleHome() {
  const navigate = useNavigate();
  const { data: users = [], isLoading: loadingUsers } = useAllUsers();
  const { data: tenants = [], isLoading: loadingTenants } = useAllTenants();
  const { data: auditEntries = [], isLoading: loadingAudit } = useAuditLog(1);
  const { data: packagesConfig, isLoading: loadingPackages } = usePackagesConfig();
  const { data: requests = [], isLoading: loadingRequests } = useSuperAdminRequests();

  const superAdmins = users.filter((user) => user.isSuperAdmin);
  const pendingRequests = requests.filter((request) => request.status !== "approved" && request.status !== "rejected");
  const payingTenants = tenants.filter(
    (tenant) => typeof tenant.monthlySubscriptionAmount === "number" && tenant.monthlySubscriptionAmount > 0,
  );
  const pricePerEmployee = packagesConfig?.pricePerEmployee ?? 0;
  const latestAudit = auditEntries[0];

  return (
    <AdminLayout>
      <div className="px-6 py-8 lg:px-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-500">Platform management</p>
            <h1 className="text-4xl font-bold tracking-tight">Admin Console</h1>
            <p className="text-muted-foreground mt-2">
              Platform overview — open a section for the details.
            </p>
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
        </div>

        {!loadingRequests && pendingRequests.length > 0 && (
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="flex w-full items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <span className="text-sm">
              <span className="font-semibold">
                {pendingRequests.length} super admin {pendingRequests.length === 1 ? "request" : "requests"} pending
              </span>{" "}
              <span className="text-muted-foreground">— needs confirmation from another super admin.</span>
            </span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-amber-500" />
          </button>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SectionCard
            icon={Building2}
            iconClass="bg-emerald-500/10 text-emerald-500"
            title="Tenants"
            description="Organizations, plans & billing"
            loading={loadingTenants}
            value={tenants.length}
            detail={`${payingTenants.length} with an active subscription`}
            onClick={() => navigate("/admin/tenants")}
          />
          <SectionCard
            icon={Shield}
            iconClass="bg-amber-500/10 text-amber-500"
            title="Super Admins"
            description="Platform access & approvals"
            loading={loadingUsers || loadingRequests}
            value={superAdmins.length}
            detail={
              pendingRequests.length > 0
                ? `${pendingRequests.length} pending confirmation`
                : "No pending requests"
            }
            onClick={() => navigate("/admin/users")}
          />
          <SectionCard
            icon={Package}
            iconClass="bg-violet-500/10 text-violet-500"
            title="Packages"
            description="Per-employee pricing"
            loading={loadingPackages}
            value={`$${pricePerEmployee.toFixed(2)}`}
            detail="per employee / month, all features"
            onClick={() => navigate("/admin/packages")}
          />
          <SectionCard
            icon={FileText}
            iconClass="bg-cyan-500/10 text-cyan-500"
            title="Audit Log"
            description="Super admin activity"
            loading={loadingAudit}
            value={
              latestAudit ? (
                <span className="text-lg leading-tight">{latestAudit.action.replace(/_/g, " ")}</span>
              ) : (
                <span className="text-lg text-muted-foreground">No entries</span>
              )
            }
            detail={latestAudit ? `Latest — ${formatDateValue(latestAudit.timestamp)}` : "Nothing recorded yet"}
            onClick={() => navigate("/admin/audit")}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
