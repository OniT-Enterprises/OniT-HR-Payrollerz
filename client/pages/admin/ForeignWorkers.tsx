/**
 * Foreign Workers Dashboard
 *
 * Track and manage foreign worker documentation, work permits,
 * and visa requirements for Timor-Leste compliance.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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


import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import {
  Globe,
  Users,
  AlertTriangle,
  Calendar,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Eye,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";
import { employeeService, Employee } from "@/services/employeeService";
import { useTenantId } from "@/contexts/TenantContext";
import type { WorkPermitStatus } from "@/types/tax-filing";

// ============================================
// TYPES
// ============================================

interface ForeignWorkerWithDetails extends Employee {
  daysUntilVisaExpiry: number;
  daysUntilPermitExpiry: number;
  alertSeverity: "none" | "info" | "warning" | "critical" | "expired";
}

interface DashboardStats {
  totalForeignWorkers: number;
  activePermits: number;
  pendingApproval: number;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
  expired: number;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG: Record<
  WorkPermitStatus,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  not_required: {
    label: "Not Required",
    className: "bg-gray-100 text-gray-700",
    icon: CheckCircle,
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  approved: {
    label: "Active",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  expired: {
    label: "Expired",
    className: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  renewal_pending: {
    label: "Renewal Pending",
    className: "bg-orange-100 text-orange-800",
    icon: RefreshCw,
  },
};

const ALERT_CONFIG = {
  none: { className: "", priority: 0 },
  info: { className: "text-blue-600", priority: 1 },
  warning: { className: "text-amber-600", priority: 2 },
  critical: { className: "text-orange-600", priority: 3 },
  expired: { className: "text-red-600", priority: 4 },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateDaysUntilExpiry(expiryDate?: string): number {
  if (!expiryDate) return Infinity;
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getAlertSeverity(days: number): "none" | "info" | "warning" | "critical" | "expired" {
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 30) return "warning";
  if (days <= 90) return "info";
  return "none";
}

function getNationality(employee: Employee): string {
  return employee.documents?.nationality || "Unknown";
}

function getVisaExpiry(employee: Employee): string | undefined {
  return employee.foreignWorker?.workVisa?.expiryDate ||
    employee.documents?.workingVisaResidency?.expiryDate;
}

function getPermitExpiry(employee: Employee): string | undefined {
  return employee.foreignWorker?.workPermit?.expiryDate;
}

// ============================================
// SKELETON LOADER
// ============================================

function ForeignWorkersSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="border-b bg-blue-50 dark:bg-blue-950/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ForeignWorkers() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const tenantId = useTenantId();

  // State
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  // Load employees
  useEffect(() => {
    loadEmployees();
  }, [tenantId]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const allEmployees = await employeeService.getAllEmployees(tenantId);
      setEmployees(allEmployees);
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

  // Process foreign workers
  const foreignWorkers = useMemo<ForeignWorkerWithDetails[]>(() => {
    return employees
      .filter(
        (emp) =>
          emp.isForeignWorker ||
          (emp.documents?.nationality &&
            emp.documents.nationality.toLowerCase() !== "timorese" &&
            emp.documents.nationality.toLowerCase() !== "timor-leste" &&
            emp.documents.nationality.toLowerCase() !== "east timor")
      )
      .map((emp) => {
        const visaDays = calculateDaysUntilExpiry(getVisaExpiry(emp));
        const permitDays = calculateDaysUntilExpiry(getPermitExpiry(emp));
        const minDays = Math.min(visaDays, permitDays);

        return {
          ...emp,
          daysUntilVisaExpiry: visaDays,
          daysUntilPermitExpiry: permitDays,
          alertSeverity: getAlertSeverity(minDays),
        };
      })
      .sort((a, b) => {
        // Sort by alert severity (highest first), then by name
        const severityDiff =
          ALERT_CONFIG[b.alertSeverity].priority -
          ALERT_CONFIG[a.alertSeverity].priority;
        if (severityDiff !== 0) return severityDiff;
        return a.personalInfo.lastName.localeCompare(b.personalInfo.lastName);
      });
  }, [employees]);

  // Get unique nationalities
  const nationalities = useMemo(() => {
    const unique = new Set(
      foreignWorkers.map((fw) => getNationality(fw)).filter((n) => n !== "Unknown")
    );
    return Array.from(unique).sort();
  }, [foreignWorkers]);

  // Calculate stats
  const stats = useMemo<DashboardStats>(() => {
    const workers = foreignWorkers;
    return {
      totalForeignWorkers: workers.length,
      activePermits: workers.filter(
        (w) => w.foreignWorker?.status === "approved"
      ).length,
      pendingApproval: workers.filter(
        (w) =>
          w.foreignWorker?.status === "pending" ||
          w.foreignWorker?.status === "renewal_pending"
      ).length,
      expiringWithin30Days: workers.filter(
        (w) =>
          Math.min(w.daysUntilVisaExpiry, w.daysUntilPermitExpiry) <= 30 &&
          Math.min(w.daysUntilVisaExpiry, w.daysUntilPermitExpiry) >= 0
      ).length,
      expiringWithin90Days: workers.filter(
        (w) =>
          Math.min(w.daysUntilVisaExpiry, w.daysUntilPermitExpiry) <= 90 &&
          Math.min(w.daysUntilVisaExpiry, w.daysUntilPermitExpiry) > 30
      ).length,
      expired: workers.filter(
        (w) =>
          w.daysUntilVisaExpiry < 0 || w.daysUntilPermitExpiry < 0
      ).length,
    };
  }, [foreignWorkers]);

  // Filter workers
  const filteredWorkers = useMemo(() => {
    return foreignWorkers.filter((worker) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${worker.personalInfo.firstName} ${worker.personalInfo.lastName}`.toLowerCase();
        if (!fullName.includes(query) && !worker.jobDetails.employeeId.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all") {
        const status = worker.foreignWorker?.status || "not_required";
        if (status !== statusFilter) return false;
      }

      // Nationality filter
      if (nationalityFilter !== "all") {
        if (getNationality(worker) !== nationalityFilter) return false;
      }

      // Tab filter
      if (activeTab === "expiring") {
        return worker.alertSeverity !== "none";
      } else if (activeTab === "expired") {
        return worker.alertSeverity === "expired";
      }

      return true;
    });
  }, [foreignWorkers, searchQuery, statusFilter, nationalityFilter, activeTab]);

  // Format days remaining text
  const formatDaysRemaining = (days: number): string => {
    if (days === Infinity) return "No expiry set";
    if (days < 0) return `Expired ${Math.abs(days)} days ago`;
    if (days === 0) return "Expires today";
    if (days === 1) return "Expires tomorrow";
    return `${days} days`;
  };

  if (loading) {
    return <ForeignWorkersSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Foreign Workers | OniT HR"
        description="Manage foreign worker documentation and permit tracking"
      />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Foreign Workers
                </h1>
                <p className="text-muted-foreground mt-1">
                  Track work permits, visas, and compliance documentation
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/people/employees")}>
              <Users className="h-4 w-4 mr-2" />
              All Employees
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alert Banner for Expired/Critical */}
        {(stats.expired > 0 || stats.expiringWithin30Days > 0) && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Action Required
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {stats.expired > 0 &&
                      `${stats.expired} worker(s) have expired documents. `}
                    {stats.expiringWithin30Days > 0 &&
                      `${stats.expiringWithin30Days} worker(s) have documents expiring within 30 days.`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => setActiveTab("expiring")}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("all")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Foreign</p>
                  <p className="text-2xl font-bold">{stats.totalForeignWorkers}</p>
                </div>
                <Globe className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("approved")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Permits</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.activePermits}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("pending")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pendingApproval}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("expiring")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">&lt;30 Days</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.expiringWithin30Days}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">30-90 Days</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {stats.expiringWithin90Days}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("expired")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Foreign Worker Registry
                </CardTitle>
                <CardDescription>
                  {filteredWorkers.length} of {foreignWorkers.length} workers
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All ({foreignWorkers.length})
                </TabsTrigger>
                <TabsTrigger value="expiring" className="text-amber-600">
                  Expiring Soon (
                  {stats.expiringWithin30Days + stats.expiringWithin90Days})
                </TabsTrigger>
                <TabsTrigger value="expired" className="text-red-600">
                  Expired ({stats.expired})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or employee ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="renewal_pending">Renewal Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All nationalities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Nationalities</SelectItem>
                  {nationalities.map((nat) => (
                    <SelectItem key={nat} value={nat}>
                      {nat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {filteredWorkers.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No foreign workers found</p>
                <p className="text-sm text-muted-foreground/70">
                  {foreignWorkers.length === 0
                    ? "No foreign workers are registered in the system."
                    : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Visa Status</TableHead>
                    <TableHead>Visa Expiry</TableHead>
                    <TableHead>Permit Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => {
                    const status = worker.foreignWorker?.status || "not_required";
                    const statusConfig = STATUS_CONFIG[status];
                    const StatusIcon = statusConfig.icon;
                    const alertConfig = ALERT_CONFIG[worker.alertSeverity];

                    return (
                      <TableRow
                        key={worker.id}
                        className={
                          worker.alertSeverity === "expired"
                            ? "bg-red-50 dark:bg-red-950/10"
                            : worker.alertSeverity === "critical"
                            ? "bg-orange-50 dark:bg-orange-950/10"
                            : ""
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                {worker.personalInfo.firstName[0]}
                                {worker.personalInfo.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">
                                {worker.personalInfo.firstName}{" "}
                                {worker.personalInfo.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {worker.jobDetails.employeeId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getNationality(worker)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {worker.jobDetails.department}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={alertConfig.className}>
                                  {formatDaysRemaining(worker.daysUntilVisaExpiry)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getVisaExpiry(worker)
                                  ? new Date(getVisaExpiry(worker)!).toLocaleDateString()
                                  : "No visa on file"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span
                                  className={
                                    ALERT_CONFIG[getAlertSeverity(worker.daysUntilPermitExpiry)]
                                      .className
                                  }
                                >
                                  {formatDaysRemaining(worker.daysUntilPermitExpiry)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getPermitExpiry(worker)
                                  ? new Date(getPermitExpiry(worker)!).toLocaleDateString()
                                  : "No permit on file"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(`/people/employees?id=${worker.id}`)
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Work Permit Requirements (Timor-Leste)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">Work Visa (Type C)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Valid for 1 year</li>
                  <li>Processing: ~15 business days</li>
                  <li>Fee: $50 USD</li>
                  <li>Requires employer sponsorship</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Required Documents</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Valid passport (6+ months)</li>
                  <li>Employment contract</li>
                  <li>Company tax certificate</li>
                  <li>Medical clearance</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Renewal Process</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Apply 30 days before expiry</li>
                  <li>Submit via Immigration Dept</li>
                  <li>Keep all original documents</li>
                  <li>Allow 2-3 weeks processing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
