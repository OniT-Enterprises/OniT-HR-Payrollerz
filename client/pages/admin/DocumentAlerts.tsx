/**
 * Document Alerts Management Page
 * Full view of all document expiry alerts with filtering and actions
 */

import React, { useState, useEffect, useMemo } from "react";
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
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  FileWarning,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  Download,
  Mail,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { employeeService, type Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import {
  type DocumentAlert,
  type AlertSeverity,
  type DocumentType,
  extractAlerts,
  DOCUMENT_LABELS,
  SEVERITY_CONFIG,
} from "@/components/dashboard/DocumentAlertsCard";
import { SEO } from "@/components/SEO";

export default function DocumentAlerts() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [documentFilter, setDocumentFilter] = useState<string>("all");

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const result = await employeeService.getAllEmployees(tenantId);
        setEmployees(result);
      } catch (error) {
        console.error("Failed to load employees:", error);
        toast({
          title: "Error",
          description: "Failed to load employee data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, [tenantId, toast]);

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

  const handleExportCSV = () => {
    if (filteredAlerts.length === 0) {
      toast({
        title: "No Data",
        description: "No alerts to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Employee Name",
      "Document Type",
      "Expiry Date",
      "Days Until Expiry",
      "Status",
    ];

    const rows = filteredAlerts.map(alert => [
      alert.employeeName,
      alert.documentLabel,
      alert.expiryDate,
      String(alert.daysUntilExpiry),
      alert.severity.toUpperCase(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `document-alerts-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredAlerts.length} alerts to CSV.`,
    });
  };

  const formatExpiryText = (days: number) => {
    if (days < 0) {
      return `Expired ${Math.abs(days)} days ago`;
    } else if (days === 0) {
      return "Expires today";
    } else if (days === 1) {
      return "Expires tomorrow";
    } else {
      return `Expires in ${days} days`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
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
        title="Document Alerts"
        description="Monitor and manage expiring employee documents"
      />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-amber-50 dark:bg-amber-950/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
              <FileWarning className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Document Alerts</h1>
              <p className="text-muted-foreground mt-1">
                Monitor and manage expiring employee documents
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Alerts</p>
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
                  <p className="text-sm text-muted-foreground">Expired</p>
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
                  <p className="text-sm text-muted-foreground">Critical</p>
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
                  <p className="text-sm text-muted-foreground">Warning</p>
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
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-5 w-5 text-amber-600" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by employee name or document..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="critical">Critical ({"<"} 14 days)</SelectItem>
                    <SelectItem value="warning">Warning (14-30 days)</SelectItem>
                    <SelectItem value="upcoming">Upcoming (30-60 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Document Type</Label>
                <Select value={documentFilter} onValueChange={setDocumentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All documents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    <SelectItem value="bi">Bilhete de Identidade</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="work_permit">Work Permit/Visa</SelectItem>
                    <SelectItem value="electoral">Electoral Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  Document Alerts
                </CardTitle>
                <CardDescription>
                  Showing {filteredAlerts.length} of {allAlerts.length} alerts
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <FileWarning className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No alerts found</p>
                <p className="text-sm text-muted-foreground/70">
                  {allAlerts.length === 0
                    ? "All employee documents are up to date."
                    : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Time Remaining</TableHead>
                    <TableHead>Status</TableHead>
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
                        <TableCell>{alert.documentLabel}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(alert.expiryDate).toLocaleDateString()}
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
                            <span className="ml-1">{config.label}</span>
                          </Badge>
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
    </div>
  );
}
