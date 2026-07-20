import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTL } from "@/lib/dateUtils";
import { isTenantSubscribed } from "@/lib/packagePricing";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Building2,
  Calculator,
  Plus,
  Search,
  Eye,
  Pencil,
  UserCog,
  Ban,
  CheckCircle,
  Loader2,
  Sparkles,
  Calendar,
  Database,
} from "lucide-react";
import { isAccountantPartnerTenant } from "@/lib/accountantPartners";
import { useAllTenants, useTenantStats } from "@/hooks/useAdmin";
import { TenantConfig, TenantStatus } from "@/types/tenant";
import { OptionalTimestamp } from "@/types/firebase";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";

const statusColors: Record<TenantStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  pending: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

// Every module the platform offers; enabled ones get a colored fill, the rest stay grey.
const MODULE_PILLS: { key: keyof NonNullable<TenantConfig["features"]>; label: string }[] = [
  { key: "people", label: "People" },
  { key: "hiring", label: "Hiring" },
  { key: "timeleave", label: "Time" },
  { key: "performance", label: "Perf" },
  { key: "payroll", label: "Payroll" },
  { key: "money", label: "Money" },
  { key: "accounting", label: "Acct" },
  { key: "reports", label: "Reports" },
];

function ModulePillGrid({ features }: { features: TenantConfig["features"] }) {
  return (
    <div className="grid grid-cols-4 gap-1 w-fit">
      {MODULE_PILLS.map((module) => {
        const enabled = features?.[module.key] !== false;
        return (
          <span
            key={module.key}
            className={`rounded px-1.5 py-0.5 text-center text-[10px] font-medium leading-4 ${
              enabled
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground/50"
            }`}
          >
            {module.label}
          </span>
        );
      })}
    </div>
  );
}

// Accountant partner firms don't run HR/payroll for a workforce — their
// workspace is finance tools plus the defining privilege of working across
// their clients' books. Show that capability profile instead of the generic
// eight HR module pills so a superadmin reads the tenant for what it is.
function AccountantCapabilityGrid({ tenant }: { tenant: TenantConfig }) {
  const chips: { label: string; on: boolean; accent?: boolean }[] = [
    { label: "Money", on: tenant.features?.money !== false },
    { label: "Acct", on: tenant.features?.accounting !== false },
    { label: "Reports", on: tenant.features?.reports !== false },
    { label: "Clients", on: true, accent: true },
    { label: "Adv. tax", on: tenant.advancedTaxMode !== false, accent: true },
  ];
  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`rounded px-1.5 py-0.5 text-center text-[10px] font-medium leading-4 ${
            chip.accent
              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
              : chip.on
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground/50"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

// Accountant partners get an indigo calculator mark; everyone else the amber
// building. Keeps the two tenant kinds instantly distinguishable in the list.
function TenantIcon({ tenantId }: { tenantId: string }) {
  if (isAccountantPartnerTenant(tenantId)) {
    return (
      <div className="rounded-lg bg-indigo-500/10 p-2">
        <Calculator className="h-4 w-4 text-indigo-500" />
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-amber-500/10 p-2">
      <Building2 className="h-4 w-4 text-amber-500" />
    </div>
  );
}

function AccountantBadge() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] border-indigo-500/40 text-indigo-600 dark:text-indigo-300"
    >
      Accountant
    </Badge>
  );
}

function TenantModules({ tenant }: { tenant: TenantConfig }) {
  return isAccountantPartnerTenant(tenant.id)
    ? <AccountantCapabilityGrid tenant={tenant} />
    : <ModulePillGrid features={tenant.features} />;
}

function TenantUsersCell({ tenant }: { tenant: TenantConfig }) {
  const { t } = useI18n();
  const { data: stats, isLoading } = useTenantStats(tenant.id);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  const adminCount = stats?.memberCount ?? tenant.currentAdminCount ?? 0;
  const staffCount = stats?.employeeCount ?? tenant.currentEmployeeCount ?? 0;

  return (
    <div className="text-sm leading-5">
      <p className="font-medium">
        {t("admin.tenantList.usersAdmins", { count: adminCount })}
      </p>
      <p className="text-muted-foreground">
        {t("admin.tenantList.usersStaff", { count: staffCount })}
      </p>
    </div>
  );
}

function TenantRowActions({
  tenant,
  onImpersonate,
}: {
  tenant: TenantConfig;
  onImpersonate: (tenant: TenantConfig) => void;
}) {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("admin.tenantList.actions.viewDetails")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/admin/tenants/${tenant.id}?edit=1`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("admin.tenantList.actions.edit")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onImpersonate(tenant)}
            disabled={tenant.status !== "active"}
          >
            <UserCog className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("admin.tenantList.actions.impersonate")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

// Columns the tenant table can be sorted by (Actions is not sortable; Modules
// and Users render composite content, so they sort on a derived numeric proxy)
type TenantSortKey =
  | "tenant"
  | "status"
  | "modules"
  | "users"
  | "created"
  | "paidUntil"
  | "subscription";

export default function TenantList() {
  const navigate = useNavigate();
  const { startImpersonation } = useTenant();
  const { t } = useI18n();
  const { data: tenants = [], isLoading: loading } = useAllTenants();
  const [searchQuery, setSearchQuery] = useState("");

  const handleImpersonate = async (tenant: TenantConfig) => {
    try {
      await startImpersonation(tenant.id, tenant.name);
      toast.success(t("admin.tenantList.toastViewingAs", { name: tenant.name }));
      navigate("/");
    } catch (_error) {
      toast.error(t("admin.tenantList.toastImpersonateFailed"));
    }
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.legalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.tradingName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const getStatusLabel = (status: TenantStatus) => t(`admin.tenantList.status.${status}`);
  const formatSubscription = (tenant: TenantConfig): string => {
    const amount = tenant.subscriptionBillingAmount ?? tenant.monthlySubscriptionAmount;
    if (typeof amount !== "number" || Number.isNaN(amount)) {
      return "-";
    }

    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
    return `${formatted}/${tenant.subscriptionBillingInterval === "year" ? "yr" : "mo"}`;
  };

  // Firestore Timestamp | Date | undefined -> Date | null, for sort accessors
  const toSortableDate = (date: OptionalTimestamp): Date | null => {
    if (!date) return null;
    if (typeof date === "object" && "toDate" in date) return date.toDate();
    if (date instanceof Date) return date;
    return null;
  };

  // Column sorting (asc → desc → off)
  const { sorted: sortedTenants, sort, toggleSort } = useTableSort<TenantConfig, TenantSortKey>(
    filteredTenants,
    {
      tenant: (tenant) => tenant.name,
      status: (tenant) => tenant.status,
      modules: (tenant) =>
        MODULE_PILLS.filter((module) => tenant.features?.[module.key] !== false).length,
      users: (tenant) => (tenant.currentAdminCount ?? 0) + (tenant.currentEmployeeCount ?? 0),
      created: (tenant) => toSortableDate(tenant.createdAt),
      paidUntil: (tenant) => toSortableDate(tenant.subscriptionPaidUntil),
      subscription: (tenant) =>
        tenant.subscriptionBillingAmount ?? tenant.monthlySubscriptionAmount,
    },
  );

  // Renders a sortable shadcn <TableHead> wired to the sort state above
  const sortableHead = (key: TenantSortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort?.key === key;
    return (
      <TableHead
        aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
        className={align === "right" ? "text-right" : undefined}
      >
        <SortableColumnHeader
          label={label}
          active={active}
          direction={active ? sort!.direction : "asc"}
          onSort={() => toggleSort(key)}
          align={align}
        />
      </TableHead>
    );
  };

  return (
    <AdminLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">

        <div className="relative px-6 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4 animate-fade-up">
              <div className="p-3 rounded-xl bg-amber-500">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>{t("admin.platformManagement")}</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">{t("admin.tenantList.title")}</h1>
                <p className="text-muted-foreground">
                  {t("admin.tenantList.subtitle")}
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
                  {t("admin.tenantList.seedAudit")}
                </Button>
              )}
              <Button
                onClick={() => navigate("/admin/tenants/new")}
                className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
              >
                <Plus className="h-4 w-4" />
                {t("admin.tenantList.addTenant")}
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
                  <p className="text-sm text-muted-foreground">{t("admin.tenantList.stats.totalTenants")}</p>
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
                  <p className="text-sm text-muted-foreground">{t("admin.tenantList.stats.active")}</p>
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
                  <p className="text-sm text-muted-foreground">{t("admin.tenantList.stats.suspended")}</p>
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
                  <p className="text-sm text-muted-foreground">{t("admin.tenantList.stats.paying")}</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {tenants.filter((tenant) => isTenantSubscribed(tenant)).length}
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">{t("admin.tenantList.allTenants")}</CardTitle>
                <CardDescription>
                  {t("admin.tenantList.tenantsFound", { count: String(filteredTenants.length) })}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.tenantList.searchPlaceholder")}
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
                <p className="text-muted-foreground">{t("admin.tenantList.noTenants")}</p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  {searchQuery && (
                    <Button variant="outline" onClick={() => setSearchQuery("")}>
                      {t("admin.tenantList.clearSearch")}
                    </Button>
                  )}
                  <Button
                    variant="link"
                    onClick={() => navigate("/admin/tenants/new")}
                  >
                    {t("admin.tenantList.createFirstTenant")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredTenants.map((tenant) => (
                    <Card key={tenant.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <TenantIcon tenantId={tenant.id} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{tenant.name}</p>
                                {isAccountantPartnerTenant(tenant.id) && <AccountantBadge />}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {tenant.legalName || t("admin.tenantList.legalNameNotSet")}
                              </p>
                              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                            </div>
                          </div>
                          <Badge className={`border ${statusColors[tenant.status]}`}>
                            {getStatusLabel(tenant.status)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap items-start gap-4">
                          <TenantModules tenant={tenant} />
                          <TenantUsersCell tenant={tenant} />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(tenant.createdAt)}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${isTenantSubscribed(tenant) ? "border-primary/40 text-primary" : "text-muted-foreground"}`}
                          >
                            {isTenantSubscribed(tenant) ? t("nav.planActive") : t("nav.planFree")}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatSubscription(tenant)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {t("admin.tenantList.table.paidUntil")}: {formatDate(tenant.subscriptionPaidUntil)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex justify-end border-t border-border/50 pt-2">
                          <TenantRowActions tenant={tenant} onImpersonate={handleImpersonate} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      {sortableHead("tenant", t("admin.tenantList.table.tenant"))}
                      {sortableHead("status", t("admin.tenantList.table.status"))}
                      {sortableHead("modules", t("admin.tenantList.table.modules"))}
                      {sortableHead("users", t("admin.tenantList.table.users"))}
                      {sortableHead("created", t("admin.tenantList.table.created"))}
                      {sortableHead("paidUntil", t("admin.tenantList.table.paidUntil"))}
                      {sortableHead("subscription", t("admin.tenantList.table.monthlySubscription"))}
                      <TableHead className="text-right">{t("admin.tenantList.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTenants.map((tenant) => (
                      <TableRow key={tenant.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <TenantIcon tenantId={tenant.id} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{tenant.name}</p>
                                {isAccountantPartnerTenant(tenant.id) && <AccountantBadge />}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {tenant.legalName || t("admin.tenantList.legalNameNotSet")}
                              </p>
                              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border ${statusColors[tenant.status]}`}>
                            {getStatusLabel(tenant.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TenantModules tenant={tenant} />
                        </TableCell>
                        <TableCell>
                          <TenantUsersCell tenant={tenant} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(tenant.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(tenant.subscriptionPaidUntil)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${isTenantSubscribed(tenant) ? "border-primary/40 text-primary" : "text-muted-foreground"}`}
                            >
                              {isTenantSubscribed(tenant) ? t("nav.planActive") : t("nav.planFree")}
                            </Badge>
                            <span className="text-sm font-medium">
                              {formatSubscription(tenant)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <TenantRowActions tenant={tenant} onImpersonate={handleImpersonate} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
