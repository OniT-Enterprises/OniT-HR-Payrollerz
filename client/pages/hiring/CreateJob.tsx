import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { useTenant } from "@/contexts/TenantContext";
import {
  useTenantDepartments,
  useTenantEmployees,
  useTenantCreateJob,
  useTenantPositions
} from "@/lib/data";
import { Job } from "@/types/tenant";
import { getCurrentUser } from "@/lib/localAuth";
import {
  Briefcase,
  Building,
  Users,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";

// Validation schema
const createJobSchema = z.object({
  title: z.string().min(2, "Job title must be at least 2 characters"),
  description: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  hiringManagerId: z.string().min(1, "Hiring manager is required"),
  approverMode: z.enum(["department", "name"], {
    required_error: "Approval mode is required",
  }),
  approverDepartmentId: z.string().optional(),
  approverId: z.string().min(1, "Approver is required"),
  positionId: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  salaryRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().default("USD"),
  }).optional(),
  location: z.string().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  status: z.enum(["draft", "open", "closed"]).default("draft"),
}).refine((data) => {
  // If approver mode is department, require approver department
  if (data.approverMode === "department" && !data.approverDepartmentId) {
    return false;
  }
  return true;
}, {
  message: "Approver department is required when using department approval mode",
  path: ["approverDepartmentId"],
});

type CreateJobFormData = z.infer<typeof createJobSchema>;

export default function CreateJob() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, hasModule, canWrite } = useTenant();
  const localUser = getCurrentUser();
  const [selectedApproverMode, setSelectedApproverMode] = useState<"department" | "name">("department");

  // Check permissions - support both tenant system and local development
  const canCreateJob =
    (session && hasModule("hiring") && canWrite()) || // Tenant system
    (localUser && (localUser.role === "admin" || localUser.role === "hr")); // Local development

  // Data queries with fallback for local development
  const { data: departments = [], isLoading: loadingDepartments } = useTenantDepartments();
  const { data: employees = [], isLoading: loadingEmployees } = useTenantEmployees();
  const { data: positions = [], isLoading: loadingPositions } = useTenantPositions();
  const createJobMutation = useTenantCreateJob();

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
      personalInfo: { firstName: "John", lastName: "Smith" },
      departmentId: "dept_1",
    },
    {
      id: "emp_2",
      personalInfo: { firstName: "Sarah", lastName: "Johnson" },
      departmentId: "dept_2",
    },
    {
      id: "emp_3",
      personalInfo: { firstName: "Mike", lastName: "Davis" },
      departmentId: "dept_3",
    },
    {
      id: "emp_4",
      personalInfo: { firstName: "Lisa", lastName: "Wilson" },
      departmentId: "dept_1",
    },
  ];

  // Use fallback data when no tenant data is available
  const activeDepartments = departments.length > 0 ? departments : fallbackDepartments;
  const activeEmployees = employees.length > 0 ? employees : fallbackEmployees;

  // Form setup
  const form = useForm<CreateJobFormData>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      status: "draft",
      approverMode: "department",
      salaryRange: {
        currency: "USD",
      },
    },
  });

  const { watch, setValue } = form;
  const watchedDepartmentId = watch("departmentId");
  const watchedApproverMode = watch("approverMode");
  const watchedApproverDepartmentId = watch("approverDepartmentId");

  // Filtered employees by department for hiring manager
  const departmentEmployees = useMemo(() => {
    if (!watchedDepartmentId) return [];
    return activeEmployees.filter(emp => emp.departmentId === watchedDepartmentId);
  }, [activeEmployees, watchedDepartmentId]);

  // Filtered employees by approver department
  const approverDepartmentEmployees = useMemo(() => {
    if (watchedApproverMode !== "department" || !watchedApproverDepartmentId) return [];
    return activeEmployees.filter(emp => emp.departmentId === watchedApproverDepartmentId);
  }, [activeEmployees, watchedApproverMode, watchedApproverDepartmentId]);

  // Handle approval mode change
  const handleApproverModeChange = (mode: "department" | "name") => {
    setSelectedApproverMode(mode);
    setValue("approverMode", mode);
    setValue("approverId", ""); // Reset approver selection
    if (mode === "name") {
      setValue("approverDepartmentId", ""); // Clear department selection
    }
  };

  // Handle department change - reset hiring manager
  const handleDepartmentChange = (departmentId: string) => {
    setValue("departmentId", departmentId);
    setValue("hiringManagerId", ""); // Reset hiring manager when department changes
  };

  // Handle approver department change - reset approver
  const handleApproverDepartmentChange = (departmentId: string) => {
    setValue("approverDepartmentId", departmentId);
    setValue("approverId", ""); // Reset approver when department changes
  };

  // Submit handler
  const onSubmit = async (data: CreateJobFormData) => {
    // Check if we have either tenant session or local user
    if (!session && !localUser) {
      toast({
        title: "Error",
        description: "No active session - please sign in",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate hiring manager is in selected department
      const hiringManager = activeEmployees.find(emp => emp.id === data.hiringManagerId);
      if (!hiringManager || hiringManager.departmentId !== data.departmentId) {
        toast({
          title: "Validation Error",
          description: "Hiring manager must be an employee in the selected department",
          variant: "destructive",
        });
        return;
      }

      // Validate approver based on mode
      if (data.approverMode === "department" && data.approverDepartmentId) {
        const approver = activeEmployees.find(emp => emp.id === data.approverId);
        if (!approver || approver.departmentId !== data.approverDepartmentId) {
          toast({
            title: "Validation Error",
            description: "Approver must be an employee in the selected approver department",
            variant: "destructive",
          });
          return;
        }
      }

      // Create job payload
      const jobPayload: Omit<Job, "id"> = {
        title: data.title,
        description: data.description,
        departmentId: data.departmentId,
        hiringManagerId: data.hiringManagerId,
        approverMode: data.approverMode,
        approverDepartmentId: data.approverDepartmentId,
        approverId: data.approverId,
        status: data.status,
        positionId: data.positionId,
        requirements: data.requirements,
        benefits: data.benefits,
        salaryRange: data.salaryRange,
        location: data.location,
        employmentType: data.employmentType,
      };

      // Try to use tenant system, fallback to local development mode
      if (session && createJobMutation) {
        await createJobMutation.mutateAsync(jobPayload);
      } else {
        // Local development mode - just simulate success
        console.log("📝 Creating job in local development mode:", jobPayload);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Job Created",
        description: "Job posting has been created successfully",
      });

      navigate("/hiring");
    } catch (error: any) {
      console.error("Failed to create job:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create job posting",
        variant: "destructive",
      });
    }
  };

  // Permission check
  if (!canCreateJob) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to create job postings. Contact your administrator for access.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isLoading = loadingDepartments || loadingEmployees || loadingPositions;

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/hiring")}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hiring
            </Button>
            <Briefcase className="h-8 w-8 text-green-400" />
            <div>
              <h1 className="text-3xl font-bold">Create Job Posting</h1>
              <p className="text-muted-foreground">
                Create a new job posting for {session?.config.name || localUser?.company || "Your Company"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {session?.config.name || localUser?.company || "Your Company"}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading form data...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Job Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Job Information
                      </CardTitle>
                      <CardDescription>
                        Basic information about the position
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Title *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g. Senior Software Engineer" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe the role, responsibilities, and requirements..."
                                rows={6}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Work Location</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="remote">Remote</SelectItem>
                                  <SelectItem value="office">Office</SelectItem>
                                  <SelectItem value="hybrid">Hybrid</SelectItem>
                                  <SelectItem value="on-site">On-site</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employmentType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employment Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="full-time">Full-time</SelectItem>
                                  <SelectItem value="part-time">Part-time</SelectItem>
                                  <SelectItem value="contract">Contract</SelectItem>
                                  <SelectItem value="intern">Intern</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar - Right Column */}
                <div className="space-y-6">
                  {/* Department & Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Department & Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department *</FormLabel>
                            <Select
                              onValueChange={handleDepartmentChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {activeDepartments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id!}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hiringManagerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hiring Manager *</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              disabled={!watchedDepartmentId}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select hiring manager" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departmentEmployees.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id!}>
                                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!watchedDepartmentId && (
                              <FormDescription>
                                Select a department first
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Approval Process */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Posting Approval
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="approverMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approval Mode *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={handleApproverModeChange}
                                value={field.value}
                                className="grid grid-cols-1 gap-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="department" id="dept" />
                                  <Label htmlFor="dept" className="text-sm">
                                    By Department
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="name" id="name" />
                                  <Label htmlFor="name" className="text-sm">
                                    By Name
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {watchedApproverMode === "department" && (
                        <FormField
                          control={form.control}
                          name="approverDepartmentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approver Department *</FormLabel>
                              <Select
                                onValueChange={handleApproverDepartmentChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {activeDepartments.map((dept) => (
                                    <SelectItem key={dept.id} value={dept.id!}>
                                      {dept.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="approverId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approver *</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              disabled={
                                watchedApproverMode === "department" && !watchedApproverDepartmentId
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select approver" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(watchedApproverMode === "department"
                                  ? approverDepartmentEmployees
                                  : activeEmployees
                                ).map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id!}>
                                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                                    {watchedApproverMode === "name" && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({activeDepartments.find(d => d.id === emp.departmentId)?.name})
                                      </span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {watchedApproverMode === "department" && !watchedApproverDepartmentId && (
                              <FormDescription>
                                Select an approver department first
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={createJobMutation.isPending}
                        >
                          {createJobMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Create Job Posting
                            </>
                          )}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate("/hiring")}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
