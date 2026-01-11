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

export default function LeaveRequests() {
  const { toast } = useToast();
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
          title: "Error",
          description: "Failed to load leave data. Please try again.",
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
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date.",
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
        department: employee.jobDetails?.department || "Unassigned",
        departmentId: dept?.id || "",
        leaveType: formData.leaveType as LeaveType,
        leaveTypeLabel: leaveType?.name || formData.leaveType,
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
        title: "Success",
        description: "Leave request submitted successfully.",
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
        title: "Error",
        description: "Failed to submit leave request. Please try again.",
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
        title: "Success",
        description: `Leave request for ${request.employeeName} has been approved.`,
      });

      // Refresh data
      const requestsData = await leaveService.getLeaveRequests();
      setLeaveRequests(requestsData);
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: "Failed to approve leave request.",
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
        title: "Error",
        description: "Please provide a rejection reason.",
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
        title: "Success",
        description: `Leave request for ${selectedRequest.employeeName} has been rejected.`,
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
        title: "Error",
        description: "Failed to reject leave request.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <X className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <X className="h-3 w-3 mr-1" />
            Cancelled
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
      <MainNavigation />

      <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Leave Requests
              </h1>
              <p className="text-muted-foreground">
                Manage employee leave requests and approvals
              </p>
            </div>
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Submit Leave Request</DialogTitle>
                  <DialogDescription>
                    Create a new leave request for an employee
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Employee Select */}
                  <div className="space-y-2">
                    <Label>Employee *</Label>
                    <Select
                      value={formData.employeeId}
                      onValueChange={(value) =>
                        handleInputChange("employeeId", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee..." />
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
                    <Label>Leave Type *</Label>
                    <Select
                      value={formData.leaveType}
                      onValueChange={(value) =>
                        handleInputChange("leaveType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TL_LEAVE_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              {getLeaveTypeIcon(type.id as LeaveType)}
                              <span>{type.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({type.daysPerYear} days/year)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedLeaveType?.requiresCertificate && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Requires {selectedLeaveType.certificateType}
                      </p>
                    )}
                  </div>

                  {/* Show remaining balance */}
                  {selectedEmployeeBalance && formData.leaveType && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Leave Balance</p>
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
                            return `${balance.remaining} days remaining (${balance.used} used, ${balance.pending} pending)`;
                          }
                          return "Balance not available";
                        })()}
                      </p>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date *</Label>
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
                      <Label>End Date *</Label>
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
                      <span className="text-sm font-medium">Duration</span>
                      <span className="text-sm">
                        {calculatedDuration} working day(s)
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
                        Half day only
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
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>Reason *</Label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) =>
                        handleInputChange("reason", e.target.value)
                      }
                      placeholder="Please provide a reason for the leave request..."
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
                        {selectedLeaveType.certificateType} will be provided
                      </Label>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRequestDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Submit Request
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-yellow-600">
                      {stats.pending}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pending Approval
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.approved}
                    </p>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                  <CalendarCheck className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {stats.onLeaveToday}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      On Leave Today
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-red-600">
                      {stats.rejected}
                    </p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                  <CalendarX className="h-8 w-8 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests Table */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                All Requests
                <Badge variant="secondary" className="ml-2">
                  {leaveRequests.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                {stats.pending > 0 && (
                  <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                    {stats.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Leave Requests
                  </CardTitle>
                  <CardDescription>
                    {filteredRequests.length} request(s) found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredRequests.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No leave requests found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Leave Type</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
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
                                <span>{request.leaveTypeLabel}</span>
                              </div>
                            </TableCell>
                            <TableCell>{request.startDate}</TableCell>
                            <TableCell>{request.endDate}</TableCell>
                            <TableCell>
                              {request.duration} day(s)
                              {request.halfDay && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({request.halfDayType})
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
                                    View reason
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
            <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRequest && (
                <span>
                  Are you sure you want to reject the leave request for{" "}
                  <strong>{selectedRequest.employeeName}</strong>?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Rejection Reason *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Please provide a reason for rejection..."
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
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={saving || !rejectionReason}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
