import React, { useMemo, useState } from "react";
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
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useDepartments } from "@/hooks/useDepartments";
import { useCreateJob } from "@/hooks/useHiring";
import {
  Briefcase,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Clock,
  FileText,
  Building2,
  Sparkles,
  Info,
  Share2,
} from "lucide-react";
import { JobPostImage } from "@/components/hiring/JobPostImage";
import {
  deriveProbation,
  type ContractType,
  type PermanentProbationOption,
} from "@/lib/probation";
import { polishJobDescription } from "@/lib/aiAssist";
import { jobPrivateDetailsService } from "@/services/jobPrivateDetailsService";

interface CreateJobFormData {
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  contractType: ContractType;
  contractDurationMonths: string;
  permanentProbation: PermanentProbationOption;
}

export default function CreateJobLocal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { session } = useTenant();

  const { data: departments = [], isLoading, error: deptError } = useDepartments(tenantId);
  const createJobMutation = useCreateJob();

  const [formData, setFormData] = useState<CreateJobFormData>({
    title: "",
    description: "",
    department: "",
    location: "",
    employmentType: "Full-time",
    salaryMin: "",
    salaryMax: "",
    contractType: "Permanent",
    contractDurationMonths: "",
    permanentProbation: "30_days",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const companyName =
    session?.config.tradingName || session?.config.legalName || session?.config.name || "Your Company";
  const companyLogoUrl = session?.config.branding?.logoUrl || "";

  const probation = useMemo(() => {
    const months = parseFloat(formData.contractDurationMonths);
    return deriveProbation({
      contractType: formData.contractType,
      contractDurationMonths: Number.isFinite(months) ? months : undefined,
      permanentProbation: formData.permanentProbation,
    });
  }, [formData.contractType, formData.contractDurationMonths, formData.permanentProbation]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t("hiring.createJob.errors.jobTitleRequired");
    }

    if (!formData.department) {
      newErrors.department = t("hiring.createJob.errors.departmentRequired");
    }

    if (formData.contractType === "Fixed-Term" && !formData.contractDurationMonths) {
      newErrors.contractDurationMonths = "Required for fixed-term contracts";
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

    const months = parseFloat(formData.contractDurationMonths);
    const publicJobData = {
      title: formData.title,
      description: formData.description,
      department: formData.department,
      location: formData.location,
      employmentType: formData.employmentType,
      status: "open" as const,
      salaryMin: formData.salaryMin ? parseInt(formData.salaryMin, 10) : 0,
      salaryMax: formData.salaryMax ? parseInt(formData.salaryMax, 10) : 0,
    };
    try {
      const jobId = await createJobMutation.mutateAsync(publicJobData);
      await jobPrivateDetailsService.saveForJob(tenantId, jobId, {
        contractType: formData.contractType,
        contractDuration:
          formData.contractType === "Fixed-Term" && formData.contractDurationMonths
            ? `${formData.contractDurationMonths} months`
            : "",
        contractDurationMonths:
          formData.contractType === "Fixed-Term" && Number.isFinite(months) ? months : undefined,
        permanentProbation:
          formData.contractType === "Permanent" ? formData.permanentProbation : undefined,
        probationDays: probation.days,
        probationPeriod: probation.label,
      });
      setCreatedJobId(jobId);
      toast({
        title: t("hiring.createJob.errors.createdTitle"),
        description: t("hiring.createJob.errors.createdDesc", {
          title: formData.title,
        }),
      });
      setShareOpen(true);
    } catch (error) {
      toast({
        title: t("hiring.createJob.errors.creationFailedTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("hiring.createJob.errors.creationFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof CreateJobFormData, value: string) => {
    setCreatedJobId(null);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleAiPolish = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Add a job title first",
        description: "The AI needs a title to work with.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.description.trim()) {
      toast({
        title: "Write a rough description first",
        description: "Drop a few bullet points and I'll polish them into a full JD.",
        variant: "destructive",
      });
      return;
    }
    if (!tenantId) return;

    setIsAiLoading(true);
    try {
      const department = departments.find((d) => d.id === formData.department)?.name;
      const polished = await polishJobDescription({
        tenantId,
        title: formData.title,
        rough: formData.description,
        department,
        location: formData.location,
      });
      setCreatedJobId(null);
      setFormData((prev) => ({ ...prev, description: polished }));
      toast({
        title: "Description polished",
        description: "Review and tweak before posting.",
      });
    } catch (error) {
      toast({
        title: "AI polish failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not reach AI service. Check OpenAI key in Settings.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 lg:p-8">
          <div className="max-w-5xl">
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

  if (deptError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 lg:p-8 max-w-5xl">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive">{t("hiring.createJob.errors.loadDepartments")}</p>
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

      <div className="mx-auto max-w-screen-2xl px-6 py-5">
        <PageHeader
          title={t("hiring.createJob.title")}
          subtitle={t("hiring.createJob.subtitle")}
          icon={Briefcase}
          iconColor="text-blue-500"
        />

        <div className="mt-6 max-w-5xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Advert Basics — outward-facing only */}
            <Card className="border-border/50 animate-fade-up stagger-1">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Advert basics</CardTitle>
                    <CardDescription>
                      What candidates will see on the job post
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    {t("hiring.createJob.labels.jobTitle")}
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder={t("hiring.createJob.placeholders.jobTitle")}
                    className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {t("hiring.createJob.labels.department")}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="salaryMin" className="text-sm font-medium">
                        {t("hiring.createJob.labels.salaryMin")}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
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
                    <div className="space-y-2">
                      <Label htmlFor="salaryMax" className="text-sm font-medium">
                        {t("hiring.createJob.labels.salaryMax")}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract — internal, drives probation automatically */}
            <Card className="border-border/50 animate-fade-up stagger-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Contract type</CardTitle>
                    <CardDescription>
                      Probation is set by law based on contract type and duration
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="contractType" className="text-sm font-medium">
                      {t("hiring.createJob.labels.contractType")}
                    </Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) =>
                        handleInputChange("contractType", value as ContractType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("hiring.createJob.placeholders.contractType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Permanent">
                          {t("hiring.createJob.options.permanent")}
                        </SelectItem>
                        <SelectItem value="Fixed-Term">
                          {t("hiring.createJob.options.fixedTerm")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.contractType === "Fixed-Term" ? (
                    <div className="space-y-2 animate-fade-in">
                      <Label htmlFor="contractDurationMonths" className="text-sm font-medium">
                        Contract duration (months)
                        <span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="contractDurationMonths"
                        type="number"
                        min={1}
                        value={formData.contractDurationMonths}
                        onChange={(e) =>
                          handleInputChange("contractDurationMonths", e.target.value)
                        }
                        placeholder="e.g. 6"
                        className={
                          errors.contractDurationMonths ? "border-destructive" : ""
                        }
                      />
                      {errors.contractDurationMonths && (
                        <p className="text-sm text-destructive">
                          {errors.contractDurationMonths}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 animate-fade-in">
                      <Label className="text-sm font-medium">Probation length</Label>
                      <Select
                        value={formData.permanentProbation}
                        onValueChange={(value) =>
                          handleInputChange(
                            "permanentProbation",
                            value as PermanentProbationOption,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30_days">30 days (standard)</SelectItem>
                          <SelectItem value="90_days">
                            90 days (manager / complex role)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 flex items-start gap-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">Probation: {probation.label}</div>
                    <p className="text-muted-foreground">{probation.rationale}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description with AI assist */}
            <Card className="border-border/50 animate-fade-up stagger-3">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">
                      {t("hiring.createJob.labels.description")}
                    </CardTitle>
                    <CardDescription>
                      Describe the role, responsibilities, and requirements
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiPolish}
                    disabled={isAiLoading}
                    className="gap-2 shrink-0"
                  >
                    {isAiLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-current/30 border-t-current" />
                        Polishing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Write with AI
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Drop a few bullet points — then click 'Write with AI' to turn it into a polished description."
                  rows={10}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-4 animate-fade-up stagger-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/hiring")}
                disabled={createJobMutation.isPending}
                className="gap-2 shadow-sm"
              >
                {t("hiring.createJob.buttons.cancel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShareOpen(true)}
                disabled={!createdJobId}
                className="gap-2 shadow-sm"
              >
                <Share2 className="h-4 w-4" />
                Share live post
              </Button>
              <Button
                type="submit"
                disabled={createJobMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createJobMutation.isPending ? (
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

      <JobPostImage
        open={shareOpen}
        onOpenChange={setShareOpen}
        job={{
          title: formData.title,
          department: departments.find((d) => d.id === formData.department)?.name,
          location: formData.location,
          salaryMin: formData.salaryMin ? parseInt(formData.salaryMin, 10) : undefined,
          salaryMax: formData.salaryMax ? parseInt(formData.salaryMax, 10) : undefined,
          employmentType: formData.employmentType,
        }}
        companyName={companyName}
        logoUrl={companyLogoUrl}
        applyUrl={createdJobId ? `${window.location.origin}/apply/${createdJobId}` : ""}
      />
    </div>
  );
}
