/**
 * Document Alerts Management Page
 * Full view of all document expiry alerts with filtering and actions
 */

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import MoreDetailsSection from "@/components/MoreDetailsSection";
import {
  FileWarning,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  Download,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAllEmployees } from "@/hooks/useEmployees";
import {
  extractAlerts,
  SEVERITY_CONFIG,
} from "@/components/dashboard/DocumentAlertsCard";
import { SEO } from "@/components/SEO";
import { getTodayTL, formatDateTL } from "@/lib/dateUtils";
import { useI18n } from "@/i18n/I18nProvider";

export default function DocumentAlerts() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { data: employees = [], isLoading: loading } = useAllEmployees();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [documentFilter, setDocumentFilter] = useState<string>("all");

  const allAlerts = useMemo(() => extractAlerts(employees), [employees]);

  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(alert => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !alert.employeeName.toLowerCase().includes(search) &&
          !alert.documentLabel.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== "all" && alert.severity !== severityFilter) {
        return false;
      }

      // Document type filter
      if (documentFilter !== "all" && alert.documentType !== documentFilter) {
        return false;
      }

      return true;
    });
  }, [allAlerts, searchTerm, severityFilter, documentFilter]);

  const stats = useMemo(() => ({
    total: allAlerts.length,
    expired: allAlerts.filter(a => a.severity === "expired").length,
    critical: allAlerts.filter(a => a.severity === "critical").length,
    warning: allAlerts.filter(a => a.severity === "warning").length,
    upcoming: allAlerts.filter(a => a.severity === "upcoming").length,
  }), [allAlerts]);

  const getDocumentLabel = (documentType: string) => {
    const labels: Record<string, string> = {
      bi: t("documentAlerts.types.bi"),
      passport: t("documentAlerts.types.passport"),
      work_permit: t("documentAlerts.types.workPermit"),
      work_visa: t("documentAlerts.types.workVisa"),
      residence_permit: t("documentAlerts.types.residencePermit"),
      electoral: t("documentAlerts.types.electoral"),
      inss: t("documentAlerts.types.inssCard"),
      contract: t("documentAlerts.types.contract"),
    };
    return labels[documentType] || documentType;
  };

  const handleExportCSV = () => {
    if (filteredAlerts.length === 0) {
      toast({
        title: t("documentAlerts.toast.noDataTitle"),
        description: t("documentAlerts.toast.noDataDesc"),
        variant: "destructive",
      });
      return;
    }

    const headers = [
      t("timeLeave.attendance.csv.employeeName"),
      t("documentAlerts.table.document"),
      t("documentAlerts.table.expiryDate"),
      t("documentAlerts.table.timeRemaining"),
      t("documentAlerts.table.status"),
    ];

    const rows = filteredAlerts.map(alert => [
      alert.employeeName,
      getDocumentLabel(alert.documentType),
      alert.expiryDate,
      formatExpiryText(alert.daysUntilExpiry),
      t(`documentAlerts.severity.${alert.severity}`),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-alerts-${getTodayTL()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t("documentAlerts.toast.exportTitle"),
      description: t("documentAlerts.toast.exportDesc", { count: filteredAlerts.length }),
    });
  };

  const formatExpiryText = (days: number) => {
    if (days < 0) {
      return t("documentAlerts.expiredDaysAgo", { count: Math.abs(days) });
    } else if (days === 0) {
      return t("documentAlerts.expiresToday");
    } else if (days === 1) {
      return t("documentAlerts.expiresTomorrow");
    } else {
      return t("documentAlerts.expiresInDays", { count: days });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="mx-auto max-w-screen-2xl">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("documentAlerts.title")}
        description={t("documentAlerts.subtitle")}
      />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("documentAlerts.title")}
          subtitle={t("documentAlerts.subtitle")}
          icon={FileWarning}
          iconColor="text-amber-500"
        />
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentAlerts.stats.total")}</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileWarning className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentAlerts.stats.expired")}</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentAlerts.stats.critical")}</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.critical}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentAlerts.stats.warning")}</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentAlerts.stats.upcoming")}</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="relative mb-4 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("documentAlerts.filters.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <MoreDetailsSection className="mb-6" title={t("documentAlerts.filters.title")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>{t("documentAlerts.filters.severityLabel")}</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("documentAlerts.filters.allSeverities")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("documentAlerts.filters.allSeverities")}</SelectItem>
                  <SelectItem value="expired">{t("documentAlerts.filters.severityOptions.expired")}</SelectItem>
                  <SelectItem value="critical">{t("documentAlerts.filters.severityOptions.critical")}</SelectItem>
                  <SelectItem value="warning">{t("documentAlerts.filters.severityOptions.warning")}</SelectItem>
                  <SelectItem value="upcoming">{t("documentAlerts.filters.severityOptions.upcoming")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("documentAlerts.filters.documentTypeLabel")}</Label>
              <Select value={documentFilter} onValueChange={setDocumentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("documentAlerts.filters.allDocuments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("documentAlerts.filters.allDocuments")}</SelectItem>
                  <SelectItem value="bi">{t("documentAlerts.types.bi")}</SelectItem>
                  <SelectItem value="passport">{t("documentAlerts.types.passport")}</SelectItem>
                  <SelectItem value="work_permit">{t("documentAlerts.types.workPermit")}</SelectItem>
                  <SelectItem value="work_visa">{t("documentAlerts.types.workVisa")}</SelectItem>
                  <SelectItem value="residence_permit">{t("documentAlerts.types.residencePermit")}</SelectItem>
                  <SelectItem value="electoral">{t("documentAlerts.types.electoral")}</SelectItem>
                  <SelectItem value="inss">{t("documentAlerts.types.inssCard")}</SelectItem>
                  <SelectItem value="contract">{t("documentAlerts.types.contract")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </MoreDetailsSection>

        {/* Alerts Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  {t("documentAlerts.title")}
                </CardTitle>
                <CardDescription>
                  {t("documentAlerts.table.showing", { shown: filteredAlerts.length, total: allAlerts.length })}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                {t("documentAlerts.actions.export")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <FileWarning className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">{t("documentAlerts.noAlerts")}</p>
                <p className="text-sm text-muted-foreground/70">
                  {allAlerts.length === 0
                    ? t("documentAlerts.noAlertsDesc")
                    : t("documentAlerts.table.adjustFilters")}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredAlerts.map((alert) => {
                    const config = SEVERITY_CONFIG[alert.severity];
                    return (
                      <div key={alert.id} className="rounded-lg border border-border/50 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{alert.employeeName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{getDocumentLabel(alert.documentType)}</p>
                          </div>
                          <Badge className={config.className}>
                            {config.icon}
                            <span className="ml-1">{t(`documentAlerts.severity.${alert.severity}`)}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDateTL(new Date(alert.expiryDate))}
                        </div>
                        <p className={alert.daysUntilExpiry < 0 ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
                          {formatExpiryText(alert.daysUntilExpiry)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("documentAlerts.table.employee")}</TableHead>
                      <TableHead>{t("documentAlerts.table.document")}</TableHead>
                      <TableHead>{t("documentAlerts.table.expiryDate")}</TableHead>
                      <TableHead>{t("documentAlerts.table.timeRemaining")}</TableHead>
                      <TableHead>{t("documentAlerts.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.map((alert) => {
                      const config = SEVERITY_CONFIG[alert.severity];
                      return (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{alert.employeeName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getDocumentLabel(alert.documentType)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDateTL(new Date(alert.expiryDate))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={alert.daysUntilExpiry < 0 ? "text-red-600 font-medium" : ""}>
                              {formatExpiryText(alert.daysUntilExpiry)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={config.className}>
                              {config.icon}
                              <span className="ml-1">{t(`documentAlerts.severity.${alert.severity}`)}</span>
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
