/**
 * Leave Requests Page - Timor-Leste Version
 * Manage leave requests with TL labor law compliance
 * - Annual: 12 days
 * - Sick: 30 days (6 @ 100%, 6 @ 50%)
 * - Maternity: 12 weeks
 * - Paternity: 5 days
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Calendar,
  Plus,
  Check,
  X,
  Clock,
  FileText,
  Users,
  CalendarCheck,
  CalendarX,
  AlertTriangle,
  Loader2,
  Umbrella,
  Baby,
  Heart,
  Briefcase,
} from "lucide-react";
import { employeeService, Employee } from "@/services/employeeService";
import { departmentService, Department } from "@/services/departmentService";
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

export default function LeaveRequests() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("all");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);

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

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [empData, deptData, requestsData, balancesData] = await Promise.all([
          employeeService.getAllEmployees(),
          departmentService.getAllDepartments(),
          leaveService.getLeaveRequests(),
          leaveService.getAllBalances(),
        ]);

        setEmployees(empData);
        setDepartments(deptData);
        setLeaveRequests(requestsData);
        setLeaveBalances(balancesData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: t("timeLeave.leaveRequests.toast.errorTitle"),
          description: t("timeLeave.leaveRequests.toast.loadFailed"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate duration when dates change
  const calculatedDuration = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const days = calculateWorkingDays(formData.startDate, formData.endDate);
    return formData.halfDay ? 0.5 : days;
  }, [formData.startDate, formData.endDate, formData.halfDay]);

  // Get selected employee details
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === formData.employeeId);
  }, [employees, formData.employeeId]);

  // Get employee's leave balance
  const selectedEmployeeBalance = useMemo(() => {
    return leaveBalances.find((b) => b.employeeId === formData.employeeId);
  }, [leaveBalances, formData.employeeId]);

  // Get selected leave type details
  const selectedLeaveType = useMemo(() => {
    return TL_LEAVE_TYPES.find((t) => t.id === formData.leaveType);
  }, [formData.leaveType]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
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
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.employeeId ||
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
      const employee = employees.find((e) => e.id === formData.employeeId);
      if (!employee) throw new Error("Employee not found");

      const leaveType = TL_LEAVE_TYPES.find((t) => t.id === formData.leaveType);

      // Find department ID from department name
      const dept = departments.find(
        (d) => d.name === employee.jobDetails?.department
      );

      await leaveService.createLeaveRequest({
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department:
          employee.jobDetails?.department ||
          t("timeLeave.leaveRequests.dialog.unassigned"),
        departmentId: dept?.id || "",
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
      });

      toast({
        title: t("timeLeave.leaveRequests.toast.successTitle"),
        description: t("timeLeave.leaveRequests.toast.successDesc"),
      });

      // Refresh data
      const [requestsData, balancesData] = await Promise.all([
        leaveService.getLeaveRequests(),
        leaveService.getAllBalances(),
      ]);
      setLeaveRequests(requestsData);
      setLeaveBalances(balancesData);

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
      // TODO: Get actual approver from auth context
      await leaveService.approveLeaveRequest(
        request.id!,
        "admin",
        "HR Admin"
      );

      toast({
        title: t("timeLeave.leaveRequests.toast.approvedTitle"),
        description: t("timeLeave.leaveRequests.toast.approvedDesc", {
          name: request.employeeName,
        }),
      });

      // Refresh data
      const requestsData = await leaveService.getLeaveRequests();
      setLeaveRequests(requestsData);
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
      await leaveService.rejectLeaveRequest(
        selectedRequest.id!,
        "admin",
        "HR Admin",
        rejectionReason
      );

      toast({
        title: t("timeLeave.leaveRequests.toast.rejectedTitle"),
        description: t("timeLeave.leaveRequests.toast.rejectedDesc", {
          name: selectedRequest.employeeName,
        }),
      });

      // Refresh data
      const requestsData = await leaveService.getLeaveRequests();
      setLeaveRequests(requestsData);

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

  const getStatusLabel = (status: LeaveStatus) => {
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
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <Check className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.approved")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.pending")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <X className="h-3 w-3 mr-1" />
            {t("timeLeave.leaveRequests.status.rejected")}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
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

      {/* Hero Section */}
      <div className="border-b bg-card">
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
                  {/* Employee Select */}
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
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 -mt-8">
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("timeLeave.leaveRequests.stats.pending")}
                    </p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("timeLeave.leaveRequests.stats.approved")}
                    </p>
                    <p className="text-2xl font-bold">{stats.approved}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                    <CalendarCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("timeLeave.leaveRequests.stats.onLeaveToday")}
                    </p>
                    <p className="text-2xl font-bold">{stats.onLeaveToday}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("timeLeave.leaveRequests.stats.rejected")}
                    </p>
                    <p className="text-2xl font-bold">{stats.rejected}</p>
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                    <CalendarX className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests Table */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                {t("timeLeave.leaveRequests.tabs.all")}
                <Badge variant="secondary" className="ml-2">
                  {leaveRequests.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                {t("timeLeave.leaveRequests.tabs.pending")}
                {stats.pending > 0 && (
                  <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                    {stats.pending}
                  </Badge>
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
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    {t("timeLeave.leaveRequests.table.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("timeLeave.leaveRequests.table.summary", {
                      count: filteredRequests.length,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl mb-4">
                        <Calendar className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-muted-foreground">{t("timeLeave.leaveRequests.table.empty")}</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("timeLeave.leaveRequests.table.employee")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.type")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.startDate")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.endDate")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.duration")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.status")}</TableHead>
                          <TableHead>{t("timeLeave.leaveRequests.table.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {request.employeeName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.department}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getLeaveTypeIcon(request.leaveType)}
                                <span>
                                  {getLeaveTypeLabel(request.leaveType)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{request.startDate}</TableCell>
                            <TableCell>{request.endDate}</TableCell>
                            <TableCell>
                              {t("timeLeave.leaveRequests.table.durationValue", {
                                days: request.duration,
                              })}
                              {request.halfDay && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({t("timeLeave.leaveRequests.table.halfDay", {
                                    type:
                                      request.halfDayType === "morning"
                                        ? t("timeLeave.leaveRequests.dialog.halfDayMorning")
                                        : t("timeLeave.leaveRequests.dialog.halfDayAfternoon"),
                                  })})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(request.status)}
                            </TableCell>
                            <TableCell>
                              {request.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(request)}
                                    disabled={saving}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                              {request.status === "rejected" &&
                                request.rejectionReason && (
                                  <span
                                    className="text-xs text-muted-foreground cursor-help"
                                    title={request.rejectionReason}
                                  >
                                    {t("timeLeave.leaveRequests.table.viewReason")}
                                  </span>
                                )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
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
