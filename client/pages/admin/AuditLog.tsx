import React, { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollText,
  Search,
  Loader2,
  Sparkles,
  Clock,
  User,
  Building2,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle,
  Eye,
  RefreshCw,
  Filter,
} from "lucide-react";
import { useAuditLog } from "@/hooks/useAdmin";
import type { AuditLogEntry } from "@/services/adminService";
import { useI18n } from "@/i18n/I18nProvider";

const ACTION_ICON_CONFIGS: Record<
  string,
  { labelKey: string; icon: React.ReactNode; color: string }
> = {
  tenant_created: {
    labelKey: "admin.auditLog.actionTenantCreated",
    icon: <Building2 className="h-4 w-4" />,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  tenant_suspended: {
    labelKey: "admin.auditLog.actionTenantSuspended",
    icon: <Ban className="h-4 w-4" />,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  tenant_reactivated: {
    labelKey: "admin.auditLog.actionTenantReactivated",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  tenant_updated: {
    labelKey: "admin.auditLog.actionTenantUpdated",
    icon: <Building2 className="h-4 w-4" />,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  superadmin_granted: {
    labelKey: "admin.auditLog.actionSuperadminGranted",
    icon: <Shield className="h-4 w-4" />,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  superadmin_revoked: {
    labelKey: "admin.auditLog.actionSuperadminRevoked",
    icon: <ShieldOff className="h-4 w-4" />,
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  impersonation_started: {
    labelKey: "admin.auditLog.actionImpersonationStarted",
    icon: <Eye className="h-4 w-4" />,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  impersonation_ended: {
    labelKey: "admin.auditLog.actionImpersonationEnded",
    icon: <Eye className="h-4 w-4" />,
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
};

export default function AuditLog() {
  const { t } = useI18n();
  const { data: entries = [], isLoading: loading, refetch } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      searchQuery === "" ||
      entry.performedByEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.targetEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === "all" || entry.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  type FirestoreTimestampLike = { toDate: () => Date } | { seconds: number } | Date | string | null | undefined;

  const formatTimestamp = (timestamp: FirestoreTimestampLike): string => {
    if (!timestamp) return "-";
    let date: Date;
    if (typeof timestamp === "object" && "toDate" in timestamp) {
      date = timestamp.toDate();
    } else if (typeof timestamp === "object" && "seconds" in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp as Date | string);
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const getRelativeTime = (timestamp: FirestoreTimestampLike): string => {
    if (!timestamp) return "";
    let date: Date;
    if (typeof timestamp === "object" && "toDate" in timestamp) {
      date = timestamp.toDate();
    } else if (typeof timestamp === "object" && "seconds" in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp as Date | string);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return "";
  };

  const getActionConfig = (action: string) => {
    const config = ACTION_ICON_CONFIGS[action];
    if (config) {
      return {
        label: t(config.labelKey),
        icon: config.icon,
        color: config.color,
      };
    }
    return {
      label: action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: <ScrollText className="h-4 w-4" />,
      color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };
  };

  const uniqueActions = [...new Set(entries.map((e) => e.action))];

  return (
    <AdminLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative px-6 py-8 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4 animate-fade-up">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                <ScrollText className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span>Platform Management</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">{t("admin.auditLog.title")}</h1>
                <p className="text-muted-foreground">
                  {t("admin.auditLog.subtitle")}
                </p>
              </div>
            </div>

            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("admin.auditLog.refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-6">
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("admin.auditLog.activityHistory")}</CardTitle>
                <CardDescription>
                  {t("admin.auditLog.eventsFound", { count: String(filteredEntries.length) })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("admin.auditLog.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t("admin.auditLog.filterByAction")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.auditLog.allActions")}</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {getActionConfig(action).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">{t("admin.auditLog.noEntries")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("admin.auditLog.noEntriesDesc")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">{t("admin.auditLog.timestamp")}</TableHead>
                    <TableHead>{t("admin.auditLog.action")}</TableHead>
                    <TableHead>{t("admin.auditLog.performedBy")}</TableHead>
                    <TableHead>{t("admin.auditLog.target")}</TableHead>
                    <TableHead className="text-right">{t("admin.auditLog.details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const config = getActionConfig(entry.action);
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatTimestamp(entry.timestamp)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {getRelativeTime(entry.timestamp)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${config.color} border gap-1.5`}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {entry.triggeredBy === "system"
                                ? t("admin.auditLog.system")
                                : entry.performedByEmail || "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {entry.tenantName && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {entry.tenantName}
                              </div>
                            )}
                            {entry.targetEmail && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {entry.targetEmail}
                              </div>
                            )}
                            {!entry.tenantName && !entry.targetEmail && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntry && getActionConfig(selectedEntry.action).icon}
              {selectedEntry && getActionConfig(selectedEntry.action).label}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && formatTimestamp(selectedEntry.timestamp)}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">{t("admin.auditLog.performedBy")}</p>
                  <p className="font-medium">
                    {selectedEntry.triggeredBy === "system"
                      ? t("admin.auditLog.systemAutomated")
                      : selectedEntry.performedByEmail || "Unknown"}
                  </p>
                </div>
                {selectedEntry.tenantId && (
                  <div>
                    <p className="text-muted-foreground mb-1">{t("admin.auditLog.tenant")}</p>
                    <p className="font-medium">
                      {selectedEntry.tenantName || selectedEntry.tenantId}
                    </p>
                  </div>
                )}
                {selectedEntry.targetEmail && (
                  <div>
                    <p className="text-muted-foreground mb-1">{t("admin.auditLog.targetUser")}</p>
                    <p className="font-medium">{selectedEntry.targetEmail}</p>
                  </div>
                )}
                {selectedEntry.targetUserId && (
                  <div>
                    <p className="text-muted-foreground mb-1">{t("admin.auditLog.targetUserId")}</p>
                    <p className="font-mono text-xs">{selectedEntry.targetUserId}</p>
                  </div>
                )}
              </div>

              {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-sm">{t("admin.auditLog.details")}</p>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedEntry.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-muted-foreground text-xs">{t("admin.auditLog.entryId", { id: selectedEntry.id ?? "" })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
