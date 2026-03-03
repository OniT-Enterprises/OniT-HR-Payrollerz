/**
 * Leave Requests Page - Timor-Leste Version
 * Manage leave requests with TL labor law compliance
 * - Annual: 12 days
 * - Sick: 30 days (6 @ 100%, 6 @ 50%)
 * - Maternity: 12 weeks
 * - Paternity: 5 days
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { timeLeaveNavConfig } from "@/lib/moduleNav";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Calendar,
  Plus,
  Check,
  X,
  Clock,
  Users,
  AlertTriangle,
  Loader2,
  Umbrella,
  Baby,
  Heart,
} from "lucide-react";
import type { Employee } from "@/services/employeeService";
import type { Department } from "@/services/departmentService";
import {
  leaveService,
  LeaveRequest,
  LeaveBalance,
  LeaveStatus,
  LeaveType,
  TL_LEAVE_TYPES,
  calculateWorkingDays,
} from "@/services/leaveService";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenant, useTenantId, useCurrentEmployeeId } from "@/contexts/TenantContext";
import { getTodayTL } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import {
  useLeaveRequests,
  useEmployeeLeaveRequests,
  useLeaveBalance,
  useAllLeaveBalances,
  useCreateLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  leaveKeys,
} from "@/hooks/useLeaveRequests";

type ViewRole = "admin" | "manager" | "employee";

export default function LeaveRequests() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { session } = useTenant();
  const currentEmployeeId = useCurrentEmployeeId();

  // Determine view role based on tenant member role
  const viewRole: ViewRole = useMemo(() => {
    const role = session?.role;
    if (role === "owner" || role === "hr-admin") return "admin";
    if (role === "manager") return "manager";
    return "employee";
  }, [session?.role]);

  const _isAdmin = viewRole === "admin";
  const isManager = viewRole === "manager";
  const isEmployee = viewRole === "employee";

  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("all");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    employeeId: "",
    leaveType: "" as LeaveType | "",
    startDate: "",
    endDate: "",
    halfDay: false,
    halfDayType: "morning" as "morning" | "afternoon",
    reason: "",
    hasCertificate: false,
  });

  // --- React Query hooks (role-aware via `enabled` conditions) ---

  // Manager departmentId for filtered requests
  const managerDepartmentId = isManager ? session?.member?.departmentId : undefined;

  // Employee view: own requests + own balance
  const employeeRequestsQuery = useEmployeeLeaveRequests(isEmployee ? (currentEmployeeId ?? undefined) : undefined);
  const myBalanceQuery = useLeaveBalance((isEmployee || isManager) ? (currentEmployeeId ?? undefined) : undefined);

  // Manager/Admin view: all requests (optionally filtered by department), employees, departments, balances
  // For employees this hook still runs (enabled: !!tenantId) but the data is not used
  const allRequestsQuery = useLeaveRequests(
    managerDepartmentId ? { departmentId: managerDepartmentId } : undefined
  );
  const allBalancesQuery = useAllLeaveBalances();
  const employeesQuery = useAllEmployees();
  const departmentsQuery = useDepartments(tenantId);

  // Combine data based on role
  const leaveRequests = useMemo(
    () => isEmployee ? (employeeRequestsQuery.data ?? []) : (allRequestsQuery.data ?? []),
    [isEmployee, employeeRequestsQuery.data, allRequestsQuery.data]
  );
  const employees: Employee[] = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const departments: Department[] = departmentsQuery.data ?? [];
  const leaveBalances: LeaveBalance[] = useMemo(() => allBalancesQuery.data ?? [], [allBalancesQuery.data]);
  const myBalance: LeaveBalance | null = myBalanceQuery.data ?? null;
  const loading = isEmployee
    ? (employeeRequestsQuery.isLoading || myBalanceQuery.isLoading)
    : (allRequestsQuery.isLoading || employeesQuery.isLoading || departmentsQuery.isLoading || allBalancesQuery.isLoading);

  // Mutation hooks
  const createLeaveRequest = useCreateLeaveRequest();
  const approveLeaveRequest = useApproveLeaveRequest();
  const rejectLeaveRequest = useRejectLeaveRequest();

  // Calculate duration when dates change
  const calculatedDuration = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const days = calculateWorkingDays(formData.startDate, formData.endDate);
    return formData.halfDay ? 0.5 : days;
  }, [formData.startDate, formData.endDate, formData.halfDay]);

  // Auto-set employeeId for employee self-service
  const effectiveEmployeeId = isEmployee && currentEmployeeId ? currentEmployeeId : formData.employeeId;

  // Get selected employee details
  const _selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === effectiveEmployeeId);
  }, [employees, effectiveEmployeeId]);

  // Get employee's leave balance
  const selectedEmployeeBalance = useMemo(() => {
    if (isEmployee && myBalance) return myBalance;
    return leaveBalances.find((b) => b.employeeId === effectiveEmployeeId);
  }, [leaveBalances, effectiveEmployeeId, isEmployee, myBalance]);

  // Get selected leave type details
  const selectedLeaveType = useMemo(() => {
    return TL_LEAVE_TYPES.find((t) => t.id === formData.leaveType);
  }, [formData.leaveType]);

  // Stats
  const stats = useMemo(() => {
    const today = getTodayTL();
    return {
      pending: leaveRequests.filter((r) => r.status === "pending").length,
      approved: leaveRequests.filter((r) => r.status === "approved").length,
      onLeaveToday: leaveRequests.filter(
        (r) =>
          r.status === "approved" && r.startDate <= today && r.endDate >= today
      ).length,
      rejected: leaveRequests.filter((r) => r.status === "rejected").length,
    };
  }, [leaveRequests]);

  // Handle form input changes
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !effectiveEmployeeId ||
      !formData.leaveType ||
      !formData.startDate ||
      !formData.endDate ||
      !formData.reason
    ) {
      toast({
        title: t("timeLeave.leaveRequests.toast.validationTitle"),
        description: t("timeLeave.leaveRequests.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast({
        title: t("timeLeave.leaveRequests.toast.validationTitle"),
        description: t("timeLeave.leaveRequests.toast.dateOrder"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const employee = employees.find((e) => e.id === effectiveEmployeeId);
      // For employee self-service, employee record may not be in local state
      const employeeName = employee
        ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        : user?.displayName || user?.email || "Employee";

      const leaveType = TL_LEAVE_TYPES.find((t) => t.id === formData.leaveType);

      // Find department ID from department name or session
      const dept = employee
        ? departments.find((d) => d.name === employee.jobDetails?.department)
        : null;
      const departmentName = employee?.jobDetails?.department
        || session?.member?.departmentId
        || t("timeLeave.leaveRequests.dialog.unassigned");

      await createLeaveRequest.mutateAsync({
        employeeId: effectiveEmployeeId,
        employeeName,
        department: departmentName,
        departmentId: dept?.id || session?.member?.departmentId || "",
        leaveType: formData.leaveType as LeaveType,
        leaveTypeLabel: getLeaveTypeLabel(formData.leaveType as LeaveType),
        startDate: formData.startDate,
        endDate: formData.endDate,
        duration: calculatedDuration,
        halfDay: formData.halfDay,
        halfDayType: formData.halfDay ? formData.halfDayType : undefined,
        reason: formData.reason,
        hasCertificate: formData.hasCertificate,
        certificateType: leaveType?.certificateType,
        // Fields required by Omit<LeaveRequest, 'id'> but set server-side
        status: "pending" as const,
        requestDate: formData.startDate,
        tenantId,
      });

      toast({
        title: t("timeLeave.leaveRequests.toast.successTitle"),
        description: t("timeLeave.leaveRequests.toast.successDesc"),
      });

      // Reset form
      setFormData({
        employeeId: "",
        leaveType: "",
        startDate: "",
        endDate: "",
        halfDay: false,
        halfDayType: "morning",
        reason: "",
        hasCertificate: false,
      });
      setShowRequestDialog(false);
    } catch (error) {
      console.error("Error creating leave request:", error);
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.submitFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle approval
  const handleApprove = async (request: LeaveRequest) => {
    setSaving(true);
    try {
      await approveLeaveRequest.mutateAsync({
        requestId: request.id!,
        approverId: user?.uid || "admin",
        approverName: user?.displayName || user?.email || "HR Admin",
      });

      toast({
        title: t("timeLeave.leaveRequests.toast.approvedTitle"),
        description: t("timeLeave.leaveRequests.toast.approvedDesc", {
          name: request.employeeName,
        }),
      });
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.approveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle rejection
  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason) {
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectionReasonMissing"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await rejectLeaveRequest.mutateAsync({
        requestId: selectedRequest.id!,
        approverId: user?.uid || "admin",
        approverName: user?.displayName || user?.email || "HR Admin",
        reason: rejectionReason,
      });

      toast({
        title: t("timeLeave.leaveRequests.toast.rejectedTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectedDesc", {
          name: selectedRequest.employeeName,
        }),
      });

      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: t("timeLeave.leaveRequests.toast.errorTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getLeaveTypeLabel = (leaveType: LeaveType) => {
    switch (leaveType) {
      case "annual":
        return t("timeLeave.leaveRequests.leaveTypes.annual");
      case "sick":
        return t("timeLeave.leaveRequests.leaveTypes.sick");
      case "maternity":
        return t("timeLeave.leaveRequests.leaveTypes.maternity");
      case "paternity":
        return t("timeLeave.leaveRequests.leaveTypes.paternity");
      case "bereavement":
        return t("timeLeave.leaveRequests.leaveTypes.bereavement");
      case "unpaid":
        return t("timeLeave.leaveRequests.leaveTypes.unpaid");
      case "marriage":
        return t("timeLeave.leaveRequests.leaveTypes.marriage");
      case "study":
        return t("timeLeave.leaveRequests.leaveTypes.study");
      case "custom":
        return t("timeLeave.leaveRequests.leaveTypes.custom");
      default:
        return leaveType;
    }
  };

  const getCertificateLabel = (certificateType?: string) => {
    if (!certificateType) return "";
    switch (certificateType) {
      case "Medical Certificate":
        return t("timeLeave.leaveRequests.certificates.medical");
      case "Birth Certificate":
        return t("timeLeave.leaveRequests.certificates.birth");
      case "Death Certificate":
        return t("timeLeave.leaveRequests.certificates.death");
      case "Marriage Certificate":
        return t("timeLeave.leaveRequests.certificates.marriage");
      default:
        return certificateType;
    }
  };

  const _getStatusLabel = (status: LeaveStatus) => {
    switch (status) {
      case "approved":
        return t("timeLeave.leaveRequests.status.approved");
      case "pending":
        return t("timeLeave.leaveRequests.status.pending");
      case "rejected":
        return t("timeLeave.leaveRequests.status.rejected");
      case "cancelled":
        return t("timeLeave.leaveRequests.status.cancelled");
      default:
        return status;
    }
  };

  // Get status badge
  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15">
            <Check className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.approved")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15">
            <Clock className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.pending")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/15">
            <X className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.rejected")}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-muted text-muted-foreground border border-border/50">
            <X className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.cancelled")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get leave type icon
  const getLeaveTypeIcon = (leaveType: LeaveType) => {
    switch (leaveType) {
      case "annual":
        return <Umbrella className="h-4 w-4" />;
      case "sick":
        return <Heart className="h-4 w-4" />;
      case "maternity":
      case "paternity":
        return <Baby className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Filter requests based on tab
  const filteredRequests = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return leaveRequests.filter((r) => r.status === "pending");
      case "approved":
        return leaveRequests.filter((r) => r.status === "approved");
      case "rejected":
        return leaveRequests.filter((r) => r.status === "rejected");
      default:
        return leaveRequests;
    }
  }, [leaveRequests, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-36 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 py-3 border-b border-border/50"
                    >
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
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
      <SEO {...seoConfig.leave} />
      <MainNavigation />
      <ModuleSectionNav config={timeLeaveNavConfig} />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("timeLeave.leaveRequests.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("timeLeave.leaveRequests.subtitle")}
                </p>
              </div>
            </div>
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("timeLeave.leaveRequests.actions.newRequest")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {t("timeLeave.leaveRequests.dialog.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("timeLeave.leaveRequests.dialog.description")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Employee Select - hidden for employee self-service */}
                  {isEmployee && currentEmployeeId ? (
                    <input type="hidden" value={currentEmployeeId} />
                  ) : (
                    <div className="space-y-2">
                      <Label>{t("timeLeave.leaveRequests.dialog.employee")}</Label>
                      <Select
                        value={formData.employeeId}
                        onValueChange={(value) =>
                          handleInputChange("employeeId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.leaveRequests.dialog.employeePlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id!}>
                              {emp.personalInfo.firstName}{" "}
                              {emp.personalInfo.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Leave Type */}
                  <div className="space-y-2">
                    <Label>{t("timeLeave.leaveRequests.dialog.leaveType")}</Label>
                    <Select
                      value={formData.leaveType}
                      onValueChange={(value) =>
                        handleInputChange("leaveType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("timeLeave.leaveRequests.dialog.leaveTypePlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {TL_LEAVE_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              {getLeaveTypeIcon(type.id as LeaveType)}
                              <span>{getLeaveTypeLabel(type.id as LeaveType)}</span>
                              <span className="text-xs text-muted-foreground">
                                {t("timeLeave.leaveRequests.dialog.daysPerYear", {
                                  days: type.daysPerYear,
                                })}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedLeaveType?.requiresCertificate && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t("timeLeave.leaveRequests.dialog.requiresCertificate", {
                          certificate: getCertificateLabel(
                            selectedLeaveType.certificateType,
                          ),
                        })}
                      </p>
                    )}
                  </div>

                  {/* Show remaining balance */}
                  {selectedEmployeeBalance && formData.leaveType && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {t("timeLeave.leaveRequests.dialog.balanceTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const balance =
                            selectedEmployeeBalance[
                              formData.leaveType as keyof LeaveBalance
                            ];
                          if (
                            typeof balance === "object" &&
                            "remaining" in balance
                          ) {
                            return t("timeLeave.leaveRequests.dialog.balanceSummary", {
                              remaining: balance.remaining,
                              used: balance.used,
                              pending: balance.pending,
                            });
                          }
                          return t("timeLeave.leaveRequests.dialog.balanceUnavailable");
                        })()}
                      </p>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("timeLeave.leaveRequests.dialog.startDate")}</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) =>
                          handleInputChange("startDate", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("timeLeave.leaveRequests.dialog.endDate")}</Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) =>
                          handleInputChange("endDate", e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  {/* Duration Display */}
                  {formData.startDate && formData.endDate && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">
                        {t("timeLeave.leaveRequests.dialog.duration")}
                      </span>
                      <span className="text-sm">
                        {t("timeLeave.leaveRequests.dialog.durationValue", {
                          days: calculatedDuration,
                        })}
                      </span>
                    </div>
                  )}

                  {/* Half Day Toggle */}
                  {calculatedDuration === 1 && (
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        id="halfDay"
                        checked={formData.halfDay}
                        onChange={(e) =>
                          handleInputChange("halfDay", e.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <Label htmlFor="halfDay" className="cursor-pointer">
                        {t("timeLeave.leaveRequests.dialog.halfDay")}
                      </Label>
                      {formData.halfDay && (
                        <Select
                          value={formData.halfDayType}
                          onValueChange={(value) =>
                            handleInputChange("halfDayType", value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">
                              {t("timeLeave.leaveRequests.dialog.halfDayMorning")}
                            </SelectItem>
                            <SelectItem value="afternoon">
                              {t("timeLeave.leaveRequests.dialog.halfDayAfternoon")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>{t("timeLeave.leaveRequests.dialog.reason")}</Label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) =>
                        handleInputChange("reason", e.target.value)
                      }
                      placeholder={t("timeLeave.leaveRequests.dialog.reasonPlaceholder")}
                      rows={3}
                      required
                    />
                  </div>

                  {/* Certificate Checkbox */}
                  {selectedLeaveType?.requiresCertificate && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasCertificate"
                        checked={formData.hasCertificate}
                        onChange={(e) =>
                          handleInputChange("hasCertificate", e.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <Label htmlFor="hasCertificate" className="cursor-pointer">
                        {t("timeLeave.leaveRequests.dialog.certificateProvided", {
                          certificate: getCertificateLabel(
                            selectedLeaveType.certificateType,
                          ),
                        })}
                      </Label>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRequestDialog(false)}
                    >
                      {t("timeLeave.leaveRequests.actions.cancel")}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {t("timeLeave.leaveRequests.actions.submit")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Employee Self-Service: Leave Balance Cards */}
          {(isEmployee || isManager) && myBalance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: "annual" as const, label: "Annual", icon: <Umbrella className="h-4 w-4" />, barColor: "bg-cyan-500", bgTint: "bg-cyan-500/10", iconColor: "text-cyan-600 dark:text-cyan-400" },
                { key: "sick" as const, label: "Sick", icon: <Heart className="h-4 w-4" />, barColor: "bg-red-500", bgTint: "bg-red-500/10", iconColor: "text-red-600 dark:text-red-400" },
                { key: "maternity" as const, label: "Maternity", icon: <Baby className="h-4 w-4" />, barColor: "bg-pink-500", bgTint: "bg-pink-500/10", iconColor: "text-pink-600 dark:text-pink-400" },
                { key: "paternity" as const, label: "Paternity", icon: <Baby className="h-4 w-4" />, barColor: "bg-blue-500", bgTint: "bg-blue-500/10", iconColor: "text-blue-600 dark:text-blue-400" },
              ].map(({ key, label, icon, barColor, bgTint, iconColor }) => {
                const bal = myBalance[key];
                if (typeof bal !== "object" || !("remaining" in bal)) return null;
                const entitled = bal.remaining + bal.used + bal.pending;
                const usedPct = entitled > 0 ? ((bal.used + bal.pending) / entitled) * 100 : 0;
                return (
                  <Card key={key} className="border-border/50 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-1.5 rounded-lg", bgTint)}>
                            <span className={iconColor}>{icon}</span>
                          </div>
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                        <span className="text-2xl font-bold tabular-nums">{bal.remaining}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                        <span>{bal.used} used</span>
                        {bal.pending > 0 && <span className="text-amber-600 dark:text-amber-400">{bal.pending} pending</span>}
                        <span>{entitled} total</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Inline stats strip */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {stats.pending > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.pending}</span>
                <span className="text-amber-600/80 dark:text-amber-400/80 text-xs">{t("timeLeave.leaveRequests.stats.pending")}</span>
              </div>
            )}
            {stats.onLeaveToday > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">{stats.onLeaveToday}</span>
                <span className="text-cyan-600/80 dark:text-cyan-400/80 text-xs">{t("timeLeave.leaveRequests.stats.onLeaveToday")}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
              <span>{stats.approved} approved</span>
              <span>&middot;</span>
              <span>{leaveRequests.length} total</span>
            </div>
          </div>

          {/* Requests */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                {t("timeLeave.leaveRequests.tabs.all")}
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{leaveRequests.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                {t("timeLeave.leaveRequests.tabs.pending")}
                {stats.pending > 0 && (
                  <Badge className="ml-2 text-[10px] px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{stats.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">
                {t("timeLeave.leaveRequests.tabs.approved")}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                {t("timeLeave.leaveRequests.tabs.rejected")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl mb-4 shadow-lg shadow-cyan-500/20">
                    <Calendar className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-muted-foreground">{t("timeLeave.leaveRequests.table.empty")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRequests.map((request) => {
                    const isPending = request.status === "pending";
                    const leaveTypeColor = {
                      annual: "border-l-cyan-500",
                      sick: "border-l-red-500",
                      maternity: "border-l-pink-500",
                      paternity: "border-l-blue-500",
                      bereavement: "border-l-gray-500",
                      unpaid: "border-l-orange-500",
                      marriage: "border-l-rose-500",
                      study: "border-l-violet-500",
                      custom: "border-l-gray-400",
                    }[request.leaveType] || "border-l-gray-400";

                    return (
                      <div
                        key={request.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card transition-all hover:shadow-sm border-l-4",
                          leaveTypeColor,
                          isPending && "bg-amber-500/[0.02] dark:bg-amber-500/[0.03]"
                        )}
                      >
                        {/* Leave type icon */}
                        <div className="flex-shrink-0 hidden sm:block">
                          <div className="p-2 rounded-lg bg-muted">
                            {getLeaveTypeIcon(request.leaveType)}
                          </div>
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{request.employeeName}</span>
                            <span className="text-xs text-muted-foreground">&middot;</span>
                            <span className="text-xs text-muted-foreground">{request.department}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground/80">{getLeaveTypeLabel(request.leaveType)}</span>
                            <span>&middot;</span>
                            <span>
                              {(() => {
                                try {
                                  const start = new Date(request.startDate + 'T12:00:00');
                                  const end = new Date(request.endDate + 'T12:00:00');
                                  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  return request.startDate === request.endDate ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
                                } catch { return `${request.startDate} – ${request.endDate}`; }
                              })()}
                            </span>
                            <span>&middot;</span>
                            <span className="font-medium">
                              {t("timeLeave.leaveRequests.table.durationValue", { days: request.duration })}
                              {request.halfDay && (
                                <span className="ml-1">
                                  ({request.halfDayType === "morning"
                                    ? t("timeLeave.leaveRequests.dialog.halfDayMorning")
                                    : t("timeLeave.leaveRequests.dialog.halfDayAfternoon")})
                                </span>
                              )}
                            </span>
                          </div>
                          {request.reason && (
                            <p className="text-xs text-muted-foreground/70 mt-1 truncate max-w-md">{request.reason}</p>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex-shrink-0">
                          {getStatusBadge(request.status)}
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0">
                          {isPending && !isEmployee && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => handleApprove(request)}
                                disabled={saving}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowRejectDialog(true);
                                }}
                                disabled={saving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {isPending && isEmployee && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-muted-foreground h-8"
                              onClick={async () => {
                                try {
                                  await leaveService.cancelLeaveRequest(tenantId, request.id!);
                                  queryClient.invalidateQueries({ queryKey: leaveKeys.requests(tenantId) });
                                  toast({ title: "Leave request cancelled" });
                                } catch {
                                  toast({ title: "Failed to cancel", variant: "destructive" });
                                }
                              }}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          )}
                          {request.status === "rejected" && request.rejectionReason && (
                            <span className="text-xs text-muted-foreground cursor-help" title={request.rejectionReason}>
                              {t("timeLeave.leaveRequests.table.viewReason")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Rejection Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("timeLeave.leaveRequests.reject.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest && (
                <span>
                  {t("timeLeave.leaveRequests.reject.description", {
                    name: selectedRequest.employeeName,
                  })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>{t("timeLeave.leaveRequests.reject.reason")}</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("timeLeave.leaveRequests.reject.placeholder")}
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowRejectDialog(false);
                setSelectedRequest(null);
                setRejectionReason("");
              }}
            >
              {t("timeLeave.leaveRequests.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !rejectionReason}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("timeLeave.leaveRequests.reject.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
