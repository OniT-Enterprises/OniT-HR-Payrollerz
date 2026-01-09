import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import {
  useDepartments,
  useEmployees,
  useCreateJob,
} from "@/hooks/useTenantData";
import { useTenant } from "@/contexts/TenantContext";
import { Job } from "@/types/tenant";

type CreateJobRequest = Omit<
  Job,
  "id" | "postedDate" | "closingDate" | "createdAt" | "updatedAt"
>;
import { getCurrentUser } from "@/lib/localAuth";
import {
  Building2,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Save,
  ArrowLeft,
} from "lucide-react";

export default function CreateJobTenant() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantContext = useTenant();
  const localUser = getCurrentUser();

  const { data: departments = [], isLoading: loadingDepartments } =
    useDepartments();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const createJobMutation = useCreateJob();

  // Fallback data for local development
  const fallbackDepartments = [
    { id: "dept_1", name: "Human Resources" },
    { id: "dept_2", name: "Engineering" },
    { id: "dept_3", name: "Sales" },
    { id: "dept_4", name: "Marketing" },
    { id: "dept_5", name: "Finance" },
  ];

  const fallbackEmployees = [
    {
      id: "emp_1",
      displayName: "John Smith",
      departmentId: "dept_1",
      status: "active",
    },
    {
      id: "emp_2",
      displayName: "Sarah Johnson",
      departmentId: "dept_2",
      status: "active",
    },
    {
      id: "emp_3",
      displayName: "Mike Davis",
      departmentId: "dept_3",
      status: "active",
    },
    {
      id: "emp_4",
      displayName: "Lisa Wilson",
      departmentId: "dept_1",
      status: "active",
    },
    {
      id: "emp_5",
      displayName: "Tom Brown",
      departmentId: "dept_4",
      status: "active",
    },
  ];

  // Use tenant data if available, otherwise use fallback data
  const activeDepartments =
    departments.length > 0 ? departments : fallbackDepartments;
  const activeEmployees = employees.length > 0 ? employees : fallbackEmployees;

  // Support both tenant and local user contexts
  const hasAccess = tenantContext?.session || localUser;
  const canWrite = tenantContext?.session?.member
    ? tenantContext.session.member.role !== "viewer"
    : localUser?.role === "admin" || localUser?.role === "hr";

  const [formData, setFormData] = useState<CreateJobRequest>({
    title: "",
    description: "",
    departmentId: "",
    hiringManagerId: "",
    approverMode: "department",
    approverDepartmentId: "",
    approverId: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter employees by selected department for hiring manager selection
  const eligibleManagers = activeEmployees.filter(
    (emp) =>
      emp.departmentId === formData.departmentId && emp.status === "active",
  );

  // Filter employees for specific approver selection
  const eligibleApprovers = activeEmployees.filter(
    (emp) => emp.status === "active",
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Job title is required";
    }

    if (!formData.departmentId) {
      newErrors.departmentId = "Department is required";
    }

    if (!formData.hiringManagerId) {
      newErrors.hiringManagerId = "Hiring manager is required";
    }

    if (
      formData.approverMode === "department" &&
      !formData.approverDepartmentId
    ) {
      newErrors.approverDepartmentId = "Approver department is required";
    }

    if (formData.approverMode === "name" && !formData.approverId) {
      newErrors.approverId = "Specific approver is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the form errors before submitting",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try to use tenant system, fallback to local development mode
      if (tenantContext?.session && createJobMutation) {
        const jobId = await createJobMutation.mutateAsync(formData);
      } else {
        // Local development mode - simulate job creation
        console.log("📝 Creating job in local development mode:", formData);
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      toast({
        title: "Job Created",
        description: `Job "${formData.title}" has been created successfully`,
      });

      navigate("/hiring");
    } catch (error) {
      toast({
        title: "Creation Failed",
        description:
          error instanceof Error ? error.message : "Failed to create job",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof CreateJobRequest, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Clear related fields when department changes
      if (field === "departmentId") {
        updated.hiringManagerId = "";
        if (updated.approverMode === "department") {
          updated.approverDepartmentId = "";
        }
      }

      return updated;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const selectedDepartment = activeDepartments.find(
    (d) => d.id === formData.departmentId,
  );
  const selectedManager = activeEmployees.find(
    (e) => e.id === formData.hiringManagerId,
  );

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/hiring")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Hiring
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  Create New Job
                </h1>
                <p className="text-muted-foreground">
                  Define a new position and hiring requirements
                </p>
              </div>
            </div>

            {tenantContext?.session && <TenantSwitcher showDetails />}
          </div>

          {/* User/Tenant Info */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {tenantContext?.session?.config.name ||
                      localUser?.company ||
                      "Your Company"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Creating job as{" "}
                    {tenantContext?.session?.member.role ||
                      localUser?.role ||
                      "user"}
                  </span>
                </div>
                {tenantContext?.session &&
                  !tenantContext.session.member.role && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        Limited hiring permissions
                      </span>
                    </div>
                  )}
                {!tenantContext?.session && localUser && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Local development mode</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Job Details
                </CardTitle>
                <CardDescription>
                  Basic information about the position
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="title">Job Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        handleInputChange("title", e.target.value)
                      }
                      placeholder="e.g., Senior Software Engineer"
                      className={errors.title ? "border-destructive" : ""}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.title}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Job Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Describe the role, responsibilities, and requirements..."
                      rows={4}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Department & Manager Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Department & Hiring Manager
                </CardTitle>
                <CardDescription>
                  Select the department and hiring manager for this position
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) =>
                        handleInputChange("departmentId", value)
                      }
                    >
                      <SelectTrigger
                        className={
                          errors.departmentId ? "border-destructive" : ""
                        }
                      >
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDepartments && departments.length === 0 ? (
                          <SelectItem value="loading" disabled>
                            Loading departments...
                          </SelectItem>
                        ) : (
                          activeDepartments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.departmentId && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.departmentId}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="hiringManager">Hiring Manager *</Label>
                    <Select
                      value={formData.hiringManagerId}
                      onValueChange={(value) =>
                        handleInputChange("hiringManagerId", value)
                      }
                      disabled={!formData.departmentId}
                    >
                      <SelectTrigger
                        className={
                          errors.hiringManagerId ? "border-destructive" : ""
                        }
                      >
                        <SelectValue
                          placeholder={
                            !formData.departmentId
                              ? "Select department first"
                              : "Select hiring manager"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingEmployees && employees.length === 0 ? (
                          <SelectItem value="loading" disabled>
                            Loading employees...
                          </SelectItem>
                        ) : eligibleManagers.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No managers available in this department
                          </SelectItem>
                        ) : (
                          eligibleManagers.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.displayName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.hiringManagerId && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.hiringManagerId}
                      </p>
                    )}

                    {selectedDepartment && selectedManager && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Manager belongs to {selectedDepartment.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approval Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Job Posting Approval
                </CardTitle>
                <CardDescription>
                  Configure who needs to approve this job before posting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Approval Mode</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Button
                      type="button"
                      variant={
                        formData.approverMode === "department"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        handleInputChange("approverMode", "department")
                      }
                      className="h-auto p-4 flex flex-col items-start gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">Department Approval</span>
                      </div>
                      <span className="text-sm text-left opacity-75">
                        Any manager in the selected department can approve
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant={
                        formData.approverMode === "name" ? "default" : "outline"
                      }
                      onClick={() => handleInputChange("approverMode", "name")}
                      className="h-auto p-4 flex flex-col items-start gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        <span className="font-medium">Specific Approver</span>
                      </div>
                      <span className="text-sm text-left opacity-75">
                        Choose a specific person to approve this job
                      </span>
                    </Button>
                  </div>
                </div>

                {formData.approverMode === "department" && (
                  <div>
                    <Label htmlFor="approverDepartment">
                      Approver Department *
                    </Label>
                    <Select
                      value={formData.approverDepartmentId}
                      onValueChange={(value) =>
                        handleInputChange("approverDepartmentId", value)
                      }
                    >
                      <SelectTrigger
                        className={
                          errors.approverDepartmentId
                            ? "border-destructive"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Select approver department" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.approverDepartmentId && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.approverDepartmentId}
                      </p>
                    )}
                  </div>
                )}

                {formData.approverMode === "name" && (
                  <div>
                    <Label htmlFor="approver">Specific Approver *</Label>
                    <Select
                      value={formData.approverId}
                      onValueChange={(value) =>
                        handleInputChange("approverId", value)
                      }
                    >
                      <SelectTrigger
                        className={
                          errors.approverId ? "border-destructive" : ""
                        }
                      >
                        <SelectValue placeholder="Select specific approver" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleApprovers.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            <div className="flex items-center gap-2">
                              <span>{emp.displayName}</span>
                              <Badge variant="outline" className="text-xs">
                                {
                                  activeDepartments.find(
                                    (d) => d.id === emp.departmentId,
                                  )?.name
                                }
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.approverId && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.approverId}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/hiring")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  (tenantContext?.session && createJobMutation?.isPending) ||
                  !canWrite ||
                  !hasAccess
                }
              >
                {tenantContext?.session && createJobMutation?.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Job
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
