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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenantId } from "@/contexts/TenantContext";
import { departmentService, Department } from "@/services/departmentService";
import { jobService } from "@/services/jobService";
import {
  Briefcase,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Clock,
  FileText,
  Building2,
} from "lucide-react";

interface CreateJobFormData {
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  contractType: string;
  contractDuration: string;
  probationPeriod: string;
}

export default function CreateJobLocal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateJobFormData>({
    title: "",
    description: "",
    department: "",
    location: "",
    employmentType: "Full-time",
    salaryMin: "",
    salaryMax: "",
    contractType: "Permanent",
    contractDuration: "",
    probationPeriod: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const depts = await departmentService.getAllDepartments(tenantId);
        setDepartments(depts);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch departments:", err);
        setError(t("hiring.createJob.errors.loadDepartments"));
        toast({
          title: t("addEmployee.toast.errorTitle"),
          description: t("hiring.createJob.errors.loadDepartmentsToast"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tenantId, toast, t]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t("hiring.createJob.errors.jobTitleRequired");
    }

    if (!formData.department) {
      newErrors.department = t("hiring.createJob.errors.departmentRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: t("hiring.createJob.errors.validationTitle"),
        description: t("hiring.createJob.errors.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const jobData = {
        title: formData.title,
        description: formData.description,
        department: formData.department,
        location: formData.location,
        employmentType: formData.employmentType,
        contractType: formData.contractType,
        contractDuration: formData.contractDuration || undefined,
        probationPeriod: formData.probationPeriod || undefined,
        status: "open" as const,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin, 10) : undefined,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax, 10) : undefined,
      };

      await jobService.createJob(tenantId, jobData);

      toast({
        title: t("hiring.createJob.errors.createdTitle"),
        description: t("hiring.createJob.errors.createdDesc", {
          title: formData.title,
        }),
      });

      navigate("/hiring");
    } catch (error) {
      console.error("Failed to create job:", error);
      toast({
        title: t("hiring.createJob.errors.creationFailedTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("hiring.createJob.errors.creationFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateJobFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 lg:p-8">
          <AutoBreadcrumb className="mb-6" />
          <div className="max-w-4xl mx-auto">
            {/* Hero skeleton */}
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card mb-8">
              <div className="p-8">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
            </div>

            {/* Form skeleton */}
            <Card className="border-border/50">
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={() => navigate("/hiring")}
                className="mt-4 gap-2"
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("hiring.createJob.backToHiring")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.jobs} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("hiring.createJob.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("hiring.createJob.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Details Card */}
            <Card className="border-border/50 animate-fade-up stagger-1">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <FileText className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t("hiring.createJob.sectionTitle")}</CardTitle>
                    <CardDescription>{t("hiring.createJob.sectionDesc")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Job Title - Full Width */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    {t("hiring.createJob.labels.jobTitle")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder={t("hiring.createJob.placeholders.jobTitle")}
                    className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title}</p>
                  )}
                </div>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Department */}
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {t("hiring.createJob.labels.department")} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => handleInputChange("department", value)}
                    >
                      <SelectTrigger className={errors.department ? "border-destructive" : ""}>
                        <SelectValue placeholder={t("hiring.createJob.placeholders.department")} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-sm text-destructive">{errors.department}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {t("hiring.createJob.labels.location")}
                    </Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      placeholder={t("hiring.createJob.placeholders.location")}
                    />
                  </div>

                  {/* Employment Type */}
                  <div className="space-y-2">
                    <Label htmlFor="employmentType" className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {t("hiring.createJob.labels.employmentType")}
                    </Label>
                    <Select
                      value={formData.employmentType}
                      onValueChange={(value) => handleInputChange("employmentType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("hiring.createJob.placeholders.employmentType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full-time">{t("hiring.createJob.options.fullTime")}</SelectItem>
                        <SelectItem value="Part-time">{t("hiring.createJob.options.partTime")}</SelectItem>
                        <SelectItem value="Contract">{t("hiring.createJob.options.contract")}</SelectItem>
                        <SelectItem value="Intern">{t("hiring.createJob.options.intern")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contract Type */}
                  <div className="space-y-2">
                    <Label htmlFor="contractType" className="text-sm font-medium">
                      {t("hiring.createJob.labels.contractType")}
                    </Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) => handleInputChange("contractType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("hiring.createJob.placeholders.contractType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Permanent">{t("hiring.createJob.options.permanent")}</SelectItem>
                        <SelectItem value="Fixed-Term">{t("hiring.createJob.options.fixedTerm")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Contract Duration (conditional) */}
                {formData.contractType === "Fixed-Term" && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="contractDuration" className="text-sm font-medium">
                      {t("hiring.createJob.labels.contractDuration")}
                    </Label>
                    <Input
                      id="contractDuration"
                      value={formData.contractDuration}
                      onChange={(e) => handleInputChange("contractDuration", e.target.value)}
                      placeholder={t("hiring.createJob.placeholders.contractDuration")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compensation Card */}
            <Card className="border-border/50 animate-fade-up stagger-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <DollarSign className="h-5 w-5 text-teal-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Compensation & Terms</CardTitle>
                    <CardDescription>Set salary range and probation period</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Salary Min */}
                  <div className="space-y-2">
                    <Label htmlFor="salaryMin" className="text-sm font-medium">
                      {t("hiring.createJob.labels.salaryMin")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="salaryMin"
                        type="number"
                        value={formData.salaryMin}
                        onChange={(e) => handleInputChange("salaryMin", e.target.value)}
                        placeholder="0"
                        className="pl-7"
                      />
                    </div>
                  </div>

                  {/* Salary Max */}
                  <div className="space-y-2">
                    <Label htmlFor="salaryMax" className="text-sm font-medium">
                      {t("hiring.createJob.labels.salaryMax")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="salaryMax"
                        type="number"
                        value={formData.salaryMax}
                        onChange={(e) => handleInputChange("salaryMax", e.target.value)}
                        placeholder="0"
                        className="pl-7"
                      />
                    </div>
                  </div>

                  {/* Probation Period */}
                  <div className="space-y-2">
                    <Label htmlFor="probationPeriod" className="text-sm font-medium">
                      {t("hiring.createJob.labels.probationPeriod")}
                    </Label>
                    <Input
                      id="probationPeriod"
                      value={formData.probationPeriod}
                      onChange={(e) => handleInputChange("probationPeriod", e.target.value)}
                      placeholder={t("hiring.createJob.placeholders.probationPeriod")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description Card */}
            <Card className="border-border/50 animate-fade-up stagger-3">
              <CardHeader>
                <CardTitle className="text-lg">{t("hiring.createJob.labels.description")}</CardTitle>
                <CardDescription>Describe the role, responsibilities, and requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder={t("hiring.createJob.placeholders.description")}
                  rows={6}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 animate-fade-up stagger-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/hiring")}
                disabled={isSubmitting}
                className="gap-2 shadow-sm"
              >
                {t("hiring.createJob.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    {t("hiring.createJob.buttons.creating")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {t("hiring.createJob.buttons.create")}
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
