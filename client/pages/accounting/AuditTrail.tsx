/**
 * Accounting Audit Trail Page
 * Shows tenant-scoped audit log entries for accounting actions
 */

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { SEO, seoConfig } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { auditLogService, type AuditAction, type AuditLogEntry, type AuditSeverity } from "@/services/auditLogService";
import { ClipboardList, RefreshCw, Search, Eye } from "lucide-react";

const ACCOUNTING_ACTIONS: Array<{ value: "all" | AuditAction; labelKey: string }> = [
  { value: "all", labelKey: "accounting.auditTrail.actions.all" },
  { value: "accounting.account_create", labelKey: "accounting.auditTrail.actions.accountCreate" },
  { value: "accounting.account_update", labelKey: "accounting.auditTrail.actions.accountUpdate" },
  { value: "accounting.coa_initialize", labelKey: "accounting.auditTrail.actions.coaInitialize" },
  { value: "accounting.journal_post", labelKey: "accounting.auditTrail.actions.journalPost" },
  { value: "accounting.journal_void", labelKey: "accounting.auditTrail.actions.journalVoid" },
  { value: "accounting.period_create_year", labelKey: "accounting.auditTrail.actions.periodCreateYear" },
  { value: "accounting.period_close", labelKey: "accounting.auditTrail.actions.periodClose" },
  { value: "accounting.period_reopen", labelKey: "accounting.auditTrail.actions.periodReopen" },
  { value: "accounting.period_lock", labelKey: "accounting.auditTrail.actions.periodLock" },
  { value: "accounting.opening_balances_posted", labelKey: "accounting.auditTrail.actions.openingBalances" },
];

const SEVERITIES: Array<{ value: "all" | AuditSeverity; labelKey: string }> = [
  { value: "all", labelKey: "accounting.auditTrail.severityOptions.all" },
  { value: "info", labelKey: "accounting.auditTrail.severityOptions.info" },
  { value: "warning", labelKey: "accounting.auditTrail.severityOptions.warning" },
  { value: "critical", labelKey: "accounting.auditTrail.severityOptions.critical" },
];

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  if (typeof value !== "object" || value === null) return false;
  if (!("toDate" in value)) return false;
  const maybe = value as { toDate?: unknown };
  return typeof maybe.toDate === "function";
}

function formatTimestamp(value: unknown): string {
  if (!value) return "-";
  const date =
    value instanceof Date
      ? value
      : isTimestampLike(value)
        ? value.toDate()
        : new Date(String(value));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function severityBadgeClass(severity: AuditSeverity) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "warning":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
  }
}

export default function AccountingAuditTrail() {
  const { t } = useI18n();
  const tenantId = useTenantId();

  const [action, setAction] = useState<"all" | AuditAction>("all");
  const [severity, setSeverity] = useState<"all" | AuditSeverity>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const queryFilters = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : undefined;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : undefined;

    return {
      tenantId,
      module: "accounting" as const,
      action: action === "all" ? undefined : action,
      severity: severity === "all" ? undefined : severity,
      startDate: start,
      endDate: end,
      pageSize: 200,
    };
  }, [tenantId, action, severity, startDate, endDate]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["tenants", tenantId, "auditLogs", "accounting", queryFilters] as const,
    queryFn: () => auditLogService.getLogs(queryFilters),
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    const logs = data?.logs ?? [];
    if (!search) return logs;
    const term = search.toLowerCase();
    return logs.filter((l) => {
      const haystack = [
        l.description,
        l.userEmail,
        l.action,
        l.entityType,
        l.entityId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data?.logs, search]);

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accounting} />
      <MainNavigation />

      {/* Hero */}
      <div className="border-b bg-slate-50 dark:bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-600 to-gray-700 shadow-lg shadow-slate-500/25">
                <ClipboardList className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("accounting.auditTrail.title")}</h1>
                <p className="text-muted-foreground mt-1">{t("accounting.auditTrail.subtitle")}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {t("accounting.auditTrail.refresh")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("accounting.auditTrail.filtersTitle")}</CardTitle>
            <CardDescription>{t("accounting.auditTrail.filtersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2 md:col-span-2">
                <Label>{t("accounting.auditTrail.search")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("accounting.auditTrail.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("accounting.auditTrail.action")}</Label>
                <Select
                  value={action}
                  onValueChange={(v) => setAction(v === "all" ? "all" : (v as AuditAction))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNTING_ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {t(a.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("accounting.auditTrail.severity")}</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v === "all" ? "all" : (v as AuditSeverity))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {t(s.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("accounting.auditTrail.dateRange")}</Label>
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600 dark:text-red-400">
                {t("accounting.auditTrail.loadError")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {t("accounting.auditTrail.activityTitle")}
            </CardTitle>
            <CardDescription>
              {t("accounting.auditTrail.activityDesc", { count: filtered.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-10 ml-auto" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t("accounting.auditTrail.noResults")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[190px]">{t("accounting.auditTrail.time")}</TableHead>
                      <TableHead className="w-[120px]">{t("accounting.auditTrail.severity")}</TableHead>
                      <TableHead className="w-[220px]">{t("accounting.auditTrail.user")}</TableHead>
                      <TableHead>{t("accounting.auditTrail.description")}</TableHead>
                      <TableHead className="w-[70px] text-right">{t("common.view")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge className={severityBadgeClass(entry.severity)}>
                            {t(`accounting.auditTrail.severityOptions.${entry.severity}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.userEmail}</TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{entry.description}</div>
                          {entry.entityType && entry.entityId && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {entry.entityType}: {entry.entityId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(entry)}
                            title={t("common.view")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("accounting.auditTrail.detailsTitle")}</DialogTitle>
            <DialogDescription>
              {selected ? `${formatTimestamp(selected.timestamp)} • ${selected.userEmail}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={severityBadgeClass(selected.severity)}>
                  {t(`accounting.auditTrail.severityOptions.${selected.severity}`)}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {selected.action}
                </Badge>
                {selected.entityType && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selected.entityType}
                  </Badge>
                )}
              </div>

              <div className="text-sm">
                <div className="font-medium">{t("accounting.auditTrail.description")}</div>
                <div className="text-muted-foreground">{selected.description}</div>
              </div>

              {(selected.metadata || selected.oldValue || selected.newValue) && (
                <div className="text-sm">
                  <div className="font-medium">{t("accounting.auditTrail.data")}</div>
                  <pre className="mt-2 max-h-[320px] overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(
                      {
                        entityId: selected.entityId,
                        entityType: selected.entityType,
                        oldValue: selected.oldValue,
                        newValue: selected.newValue,
                        changes: selected.changes,
                        metadata: selected.metadata,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
