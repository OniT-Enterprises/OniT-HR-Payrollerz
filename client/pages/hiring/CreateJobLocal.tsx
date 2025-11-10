import React, { useState, useEffect } from "react";
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
import { getCurrentUser } from "@/lib/localAuth";
import {
  getDepartments,
  getEmployees,
  createJob,
  Department,
  Employee,
} from "@/lib/sqliteApiService";
import {
  Building2,
  Users,
  UserCheck,
  CheckCircle,
  Save,
  ArrowLeft,
} from "lucide-react";

interface CreateJobFormData {
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
}

export default function CreateJobLocal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const localUser = getCurrentUser();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateJobFormData>({
    title: "",
    description: "",
    departmentId: "",
    hiringManagerId: "",
    approverMode: "department",
    approverDepartmentId: "",
    approverId: "",
    location: "office",
    employmentType: "full-time",
    salaryMin: "",
    salaryMax: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter employees by selected department for hiring manager selection
  const eligibleManagers = allEmployees.filter(
    (emp) => emp.departmentId === formData.departmentId,
  );

  // Filter employees for approver selection based on mode
  const eligibleApprovers =
    formData.approverMode === "department"
      ? allEmployees.filter(
          (emp) => emp.departmentId === formData.approverDepartmentId,
        )
      : allEmployees;

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

    if (!formData.approverId) {
      newErrors.approverId = "Approver is required";
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

    setIsSubmitting(true);

    try {
      // Create job data
      const jobData: Omit<LocalJob, "id" | "createdAt" | "updatedAt"> = {
        title: formData.title,
        description: formData.description,
        departmentId: formData.departmentId,
        hiringManagerId: formData.hiringManagerId,
        approverMode: formData.approverMode,
        approverDepartmentId: formData.approverDepartmentId || undefined,
        approverId: formData.approverId,
        status: "draft",
        location: formData.location,
        employmentType: formData.employmentType,
        salaryRange:
          formData.salaryMin && formData.salaryMax
            ? {
                min: parseInt(formData.salaryMin),
                max: parseInt(formData.salaryMax),
                currency: "USD",
              }
            : undefined,
      };

      // Save job locally
      const newJob = createJob(jobData);

      toast({
        title: "Job Created Successfully! 🎉",
        description: `"${newJob.title}" has been created and saved locally`,
      });

      navigate("/hiring");
    } catch (error) {
      console.error("Failed to create job:", error);
      toast({
        title: "Creation Failed",
        description: "Failed to create job posting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateJobFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Clear related fields when department changes
      if (field === "departmentId") {
        updated.hiringManagerId = "";
      }

      if (field === "approverDepartmentId") {
        updated.approverId = "";
      }

      if (field === "approverMode") {
        updated.approverDepartmentId = "";
        updated.approverId = "";
      }

      return updated;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const selectedDepartment = departments.find(
    (d) => d.id === formData.departmentId,
  );
  const selectedManager = allEmployees.find(
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
                  <Building2 className="h-8 w-8 text-green-600" />
                  Create New Job
                </h1>
                <p className="text-muted-foreground">
                  Define a new position and hiring requirements
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {localUser?.company || "Your Company"}
              </Badge>
              <Badge variant="outline" className="text-green-600">
                Local Development
              </Badge>
            </div>
          </div>

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

                  <div>
                    <Label htmlFor="location">Work Location</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) =>
                        handleInputChange("location", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="on-site">On-site</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="employmentType">Employment Type</Label>
                    <Select
                      value={formData.employmentType}
                      onValueChange={(value: any) =>
                        handleInputChange("employmentType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="salaryMin">Salary Min (USD)</Label>
                    <Input
                      id="salaryMin"
                      type="number"
                      value={formData.salaryMin}
                      onChange={(e) =>
                        handleInputChange("salaryMin", e.target.value)
                      }
                      placeholder="50000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="salaryMax">Salary Max (USD)</Label>
                    <Input
                      id="salaryMax"
                      type="number"
                      value={formData.salaryMax}
                      onChange={(e) =>
                        handleInputChange("salaryMax", e.target.value)
                      }
                      placeholder="80000"
                    />
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
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
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
                        {eligibleManagers.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No managers in this department
                          </SelectItem>
                        ) : (
                          eligibleManagers.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} - {emp.position}
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
                        {departments.map((dept) => (
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

                <div>
                  <Label htmlFor="approver">
                    {formData.approverMode === "department"
                      ? "Approver from Department *"
                      : "Specific Approver *"}
                  </Label>
                  <Select
                    value={formData.approverId}
                    onValueChange={(value) =>
                      handleInputChange("approverId", value)
                    }
                    disabled={
                      formData.approverMode === "department" &&
                      !formData.approverDepartmentId
                    }
                  >
                    <SelectTrigger
                      className={errors.approverId ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="Select approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleApprovers.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex items-center gap-2">
                            <span>
                              {emp.firstName} {emp.lastName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {
                                departments.find(
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
              </CardContent>
            </Card>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/hiring")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
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
