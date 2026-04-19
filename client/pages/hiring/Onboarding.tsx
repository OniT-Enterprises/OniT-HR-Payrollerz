import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { getTodayTL } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { useTenantId } from "@/contexts/TenantContext";
import { useCandidates } from "@/hooks/useHiring";
import { useAllEmployees } from "@/hooks/useEmployees";
import { customizeHandbook } from "@/lib/aiAssist";
import { candidateService } from "@/services/candidateService";
import { employeeService } from "@/services/employeeService";
import { fileUploadService } from "@/services/fileUploadService";
import {
  onboardingService,
  type EquipmentAsset,
  type EquipmentAssetType,
  type OnboardingBenefits,
} from "@/services/onboardingService";
import {
  UserPlus,
  FileText,
  Shield,
  Monitor,
  GraduationCap,
  Heart,
  Target,
  MessageCircle,
  CheckCircle,
  Upload,
  BookOpen,
  ArrowRight,
  Phone,
  MapPin,
  CreditCard,
  User,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";

const DEFAULT_HANDBOOK_TEMPLATE = `# Employee Handbook

## 1. Welcome
Welcome to {{COMPANY}}. This handbook introduces our culture, expectations, and the standards that apply to every employee.

## 2. Working hours and attendance
Standard hours are 08:00 to 17:00, Monday to Friday, with one hour for lunch. Report absences to your manager before the start of the working day.

## 3. Code of conduct
Treat colleagues and clients with respect. Harassment, discrimination and workplace violence are grounds for disciplinary action.

## 4. Dress code
Dress appropriately for your role. Field, kitchen, and workshop staff must wear required PPE at all times.

## 5. Leave policy
Annual leave, sick leave, and public holidays follow the Timor-Leste Labour Code. Leave requests go through your manager and HR.

## 6. Pay and benefits
Pay is processed monthly. Overtime, allowances and benefits are detailed in your individual contract.

## 7. Health and safety
Report hazards immediately. Follow site-specific safety procedures. Company vehicles and equipment must only be used by authorised staff.

## 8. Data protection
Customer and employee information is confidential. Do not share company data outside your role.

## 9. Discipline and grievance
Concerns can be raised with your line manager or HR. We aim to resolve issues fairly and promptly.

## 10. Signature
I confirm that I have read and agree to the policies in this handbook.
`;

const EQUIPMENT_TYPES: { value: EquipmentAssetType; label: string }[] = [
  { value: "laptop", label: "Laptop" },
  { value: "phone", label: "Company phone" },
  { value: "access_card", label: "Access card" },
  { value: "office_keys", label: "Office keys" },
  { value: "sim_card", label: "SIM card" },
  { value: "uniform", label: "Uniform / PPE" },
  { value: "other", label: "Other" },
];

function blankAsset(type: EquipmentAssetType = "laptop"): EquipmentAsset {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: "",
    make: "",
    model: "",
    serialNumber: "",
    assetTag: "",
    notes: "",
    returned: false,
  };
}

export default function Onboarding() {
  const { t } = useI18n();
  const { toast } = useToast();
  const tenantId = useTenantId();
  const [searchParams] = useSearchParams();
  const candidateIdFromUrl = searchParams.get("candidateId");
  const employeeIdFromUrl = searchParams.get("employeeId");

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    candidateIdFromUrl ?? "",
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    employeeIdFromUrl ?? "",
  );
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [selectedJobId] = useState<string>("");

  const { data: candidatesList = [] } = useCandidates();
  const { data: employees = [] } = useAllEmployees();

  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    address: "",
    mobilePhone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bankAccountNumber: "",
    taxId: "",
    companyEmail: "",
    tempPassword: "",
    idDocument: null as File | null,
  });
  const [acknowledgements, setAcknowledgements] = useState({
    dressCode: false,
    codeOfConduct: false,
    leavePolicy: false,
    safetyGuidelines: false,
    dataProtection: false,
    handbookRead: false,
    signed: false,
    signatureDate: "",
  });
  const [sopStatuses, setSopStatuses] = useState<Record<number, boolean>>({});
  const [equipment, setEquipment] = useState<EquipmentAsset[]>([]);
  const [benefits, setBenefits] = useState<OnboardingBenefits>({
    healthCardNumber: "",
    retirementPlanNumber: "",
    lifeInsurancePolicy: "",
    leaveEntitlementDays: undefined,
    notes: "",
  });
  const [feedbackNotes, setFeedbackNotes] = useState("");

  const [handbookContent, setHandbookContent] = useState<string>(DEFAULT_HANDBOOK_TEMPLATE);
  const [industryHint, setIndustryHint] = useState<string>("");
  const [companyNameHint, setCompanyNameHint] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const approvedCandidates = useMemo(
    () => candidatesList.filter((candidate) => ["Shortlisted", "Hired"].includes(candidate.status)),
    [candidatesList],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== "terminated"),
    [employees],
  );

  // Prefill from candidate
  useEffect(() => {
    if (!selectedCandidateId) return;
    const candidate = approvedCandidates.find((c) => c.id === selectedCandidateId);
    if (!candidate) return;
    setFormData((prev) => ({
      ...prev,
      fullName: candidate.name || prev.fullName,
      mobilePhone: candidate.phone || prev.mobilePhone,
    }));
    const matchedEmployee = activeEmployees.find((employee) => {
      const emailMatches =
        candidate.email &&
        employee.personalInfo.email &&
        candidate.email.toLowerCase() === employee.personalInfo.email.toLowerCase();
      const nameMatches =
        candidate.name.trim().toLowerCase() ===
        `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`.trim().toLowerCase();
      return emailMatches || nameMatches;
    });
    if (matchedEmployee?.id) {
      setSelectedEmployeeId(matchedEmployee.id);
    }
  }, [selectedCandidateId, approvedCandidates, activeEmployees]);

  const steps = useMemo(
    () => [
      { id: 0, label: t("hiring.onboarding.steps.preBoarding"), icon: <UserPlus className="h-4 w-4" /> },
      { id: 1, label: t("hiring.onboarding.steps.personalLegal"), icon: <FileText className="h-4 w-4" /> },
      { id: 2, label: t("hiring.onboarding.steps.policies"), icon: <Shield className="h-4 w-4" /> },
      { id: 3, label: t("hiring.onboarding.steps.departmentSops"), icon: <BookOpen className="h-4 w-4" /> },
      { id: 4, label: t("hiring.onboarding.steps.itEquipment"), icon: <Monitor className="h-4 w-4" /> },
      { id: 5, label: t("hiring.onboarding.steps.orientation"), icon: <GraduationCap className="h-4 w-4" /> },
      { id: 6, label: t("hiring.onboarding.steps.benefits"), icon: <Heart className="h-4 w-4" /> },
      { id: 7, label: t("hiring.onboarding.steps.probation"), icon: <Target className="h-4 w-4" /> },
      { id: 8, label: t("hiring.onboarding.steps.feedback"), icon: <MessageCircle className="h-4 w-4" /> },
    ],
    [t],
  );

  const departmentSOPs = useMemo(
    () => [
      {
        id: 1,
        title: t("hiring.onboarding.sops.items.codeReview.title"),
        description: t("hiring.onboarding.sops.items.codeReview.description"),
        department: t("hiring.onboarding.sops.department"),
      },
      {
        id: 2,
        title: t("hiring.onboarding.sops.items.deployment.title"),
        description: t("hiring.onboarding.sops.items.deployment.description"),
        department: t("hiring.onboarding.sops.department"),
      },
      {
        id: 3,
        title: t("hiring.onboarding.sops.items.security.title"),
        description: t("hiring.onboarding.sops.items.security.description"),
        department: t("hiring.onboarding.sops.department"),
      },
    ],
    [t],
  );

  const policies = useMemo(
    () => [
      { id: "dressCode", label: t("hiring.onboarding.policies.items.dress") },
      { id: "codeOfConduct", label: t("hiring.onboarding.policies.items.conduct") },
      { id: "leavePolicy", label: t("hiring.onboarding.policies.items.leave") },
      { id: "safetyGuidelines", label: t("hiring.onboarding.policies.items.safety") },
      { id: "dataProtection", label: t("hiring.onboarding.policies.items.data") },
    ],
    [t],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(2);
  };

  const handleAcknowledgementsSubmit = () => {
    const allAcked =
      acknowledgements.dressCode &&
      acknowledgements.codeOfConduct &&
      acknowledgements.leavePolicy &&
      acknowledgements.safetyGuidelines &&
      acknowledgements.dataProtection &&
      acknowledgements.handbookRead;
    if (!allAcked || !acknowledgements.signed) {
      toast({
        title: "Acknowledgement required",
        description: "Tick each policy, confirm you've read the handbook, then sign.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(3);
  };

  const handleSOPToggle = (sopId: number) => {
    setSopStatuses((prev) => ({ ...prev, [sopId]: !prev[sopId] }));
  };

  const allSOPsCompleted = departmentSOPs.every((sop) => sopStatuses[sop.id]);

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed";
    if (stepId === currentStep) return "current";
    return "upcoming";
  };

  const scrollToSection = (stepId: number) => {
    setCurrentStep(stepId);
    const element = document.getElementById(`step-${stepId}`);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const addEquipment = () => {
    setEquipment((prev) => [...prev, blankAsset("laptop")]);
  };

  const updateEquipment = (id: string, patch: Partial<EquipmentAsset>) => {
    setEquipment((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeEquipment = (id: string) => {
    setEquipment((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCustomizeHandbook = async () => {
    if (!tenantId) return;
    if (!companyNameHint.trim()) {
      toast({
        title: "Company name needed",
        description: "Enter your company name so the handbook can be personalised.",
        variant: "destructive",
      });
      return;
    }
    setIsAiLoading(true);
    try {
      const customized = await customizeHandbook({
        tenantId,
        companyName: companyNameHint,
        industry: industryHint,
        baseHandbook: DEFAULT_HANDBOOK_TEMPLATE,
      });
      setHandbookContent(customized);
      toast({
        title: "Handbook personalised",
        description: "Review the updated handbook below.",
      });
    } catch (error) {
      toast({
        title: "AI customisation failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not reach AI. Check OpenAI key in Settings.",
        variant: "destructive",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!tenantId) return;
    if (!selectedEmployeeId) {
      toast({
        title: "Link an employee record",
        description: "Choose the employee record so onboarding can update the org chart and offboarding can recover assets later.",
        variant: "destructive",
      });
      return;
    }

    const manager = activeEmployees.find((e) => e.id === selectedManagerId);
    const employee = activeEmployees.find((e) => e.id === selectedEmployeeId);
    if (!employee?.id) {
      toast({
        title: "Employee record not found",
        description: "Select a valid employee record before saving onboarding.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const caseId = await onboardingService.createCase(tenantId, {
        candidateId: selectedCandidateId || undefined,
        employeeId: selectedEmployeeId,
        jobId: selectedJobId || undefined,
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        mobilePhone: formData.mobilePhone,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        bankAccountNumber: formData.bankAccountNumber,
        taxId: formData.taxId,
        companyEmail: formData.companyEmail || undefined,
        tempPassword: formData.tempPassword || undefined,
        managerEmployeeId: selectedManagerId || undefined,
        managerName: manager
          ? `${manager.personalInfo?.firstName ?? ""} ${manager.personalInfo?.lastName ?? ""}`.trim()
          : undefined,
        equipment,
        benefits,
        acknowledgements: {
          dressCode: acknowledgements.dressCode,
          codeOfConduct: acknowledgements.codeOfConduct,
          leavePolicy: acknowledgements.leavePolicy,
          safetyGuidelines: acknowledgements.safetyGuidelines,
          dataProtection: acknowledgements.dataProtection,
          handbookRead: acknowledgements.handbookRead,
        },
        handbookSignatureDate: acknowledgements.signatureDate,
        handbookContent,
        feedbackNotes,
        status: "completed",
        completedAt: new Date(),
      });

      if (formData.idDocument) {
        const validation = fileUploadService.validateDocumentFile(
          formData.idDocument,
          ["image/jpeg", "image/png", "image/webp", "application/pdf"],
          10,
        );
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        const fileExtension = formData.idDocument.name.split(".").pop() || "pdf";
        const idDocumentUrl = await fileUploadService.uploadFile(
          formData.idDocument,
          `tenants/${tenantId}/onboarding/${caseId}/documents/id_document_${Date.now()}.${fileExtension}`,
        );
        await onboardingService.updateCase(tenantId, caseId, { idDocumentUrl });
      }

      if (selectedManagerId) {
        await employeeService.updateEmployee(tenantId, selectedEmployeeId, {
          jobDetails: {
            ...employee.jobDetails,
            manager: manager
              ? `${manager.personalInfo.firstName} ${manager.personalInfo.lastName}`.trim()
              : "",
          },
        });
      }

      if (selectedCandidateId) {
        await candidateService.updateCandidate(tenantId, selectedCandidateId, {
          status: "Hired",
        });
      }

      toast({
        title: "Onboarding saved",
        description: "Record is linked to the employee file and ready for offboarding asset tracking later.",
      });
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.onboarding} />

      <div className="mx-auto max-w-screen-2xl px-6 py-5">
        <PageHeader
          title={t("hiring.onboarding.title")}
          subtitle={t("hiring.onboarding.subtitle")}
          icon={UserPlus}
          iconColor="text-blue-500"
        />

        {/* Stepper */}
        <Card className="mb-8 border-border/50 animate-fade-up stagger-1">
          <CardContent className="p-6">
            <div className="relative">
              {/* Connector track — sits behind the circles at vertical center (top-5 = 20px = h-10 / 2) */}
              <div className="pointer-events-none absolute left-5 right-5 top-5 h-0.5 -translate-y-1/2 bg-border" />
              <div
                className="pointer-events-none absolute left-5 top-5 h-0.5 -translate-y-1/2 bg-blue-600 transition-all duration-500"
                style={{
                  width: `calc((100% - 2.5rem) * ${currentStep / Math.max(steps.length - 1, 1)})`,
                }}
              />
              <div className="relative flex items-start justify-between">
                {steps.map((step) => {
                  const status = getStepStatus(step.id);
                  return (
                    <div key={step.id} className="flex flex-1 flex-col items-center">
                      <button
                        onClick={() => scrollToSection(step.id)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                          status === "completed"
                            ? "border-transparent bg-blue-600 text-white hover:bg-blue-700"
                            : status === "current"
                              ? "border-transparent bg-blue-600 text-white ring-4 ring-blue-500/25 hover:bg-blue-700"
                              : "border-border bg-background text-muted-foreground hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {status === "completed" ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          step.icon
                        )}
                      </button>
                      <span
                        className={`mt-2 max-w-[80px] text-center text-xs font-medium leading-tight ${
                          status === "current"
                            ? "text-blue-600"
                            : status === "completed"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("hiring.onboarding.progress")}</span>
                <span>{Math.round((currentStep / (steps.length - 1)) * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* Step 0: Pre-Boarding */}
          <section id="step-0" className="animate-fade-up stagger-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  Select approved candidate
                </CardTitle>
                <CardDescription>
                  Pick an approved candidate, then link the employee record used for onboarding and offboarding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Candidate</Label>
                      <Select
                        value={selectedCandidateId}
                        onValueChange={setSelectedCandidateId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Search candidates…" />
                        </SelectTrigger>
                        <SelectContent>
                          {approvedCandidates.length === 0 && (
                            <SelectItem value="none" disabled>
                              No approved candidates yet
                            </SelectItem>
                          )}
                          {approvedCandidates.map((c) => (
                            <SelectItem key={c.id} value={c.id || ""}>
                              {c.name} · {c.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Approved means shortlisted or already marked hired.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Employee record</Label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Link the employee file…" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeEmployees.length === 0 && (
                            <SelectItem value="none" disabled>
                              No employee records yet
                            </SelectItem>
                          )}
                          {activeEmployees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id || ""}>
                              {employee.personalInfo.firstName} {employee.personalInfo.lastName} ·{" "}
                              {employee.jobDetails.position || employee.jobDetails.employeeId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        We auto-match by email/name when possible so equipment and offboarding stay linked.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Reports to</Label>
                      <Select
                        value={selectedManagerId}
                        onValueChange={setSelectedManagerId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick the line manager…" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeEmployees.length === 0 && (
                            <SelectItem value="none" disabled>
                              No employees yet
                            </SelectItem>
                          )}
                          {activeEmployees.map((e) => (
                            <SelectItem key={e.id} value={e.id || ""}>
                              {e.personalInfo?.firstName} {e.personalInfo?.lastName} ·{" "}
                              {e.jobDetails?.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        This updates `jobDetails.manager` on the employee record when onboarding is saved.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => scrollToSection(1)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {t("hiring.onboarding.preBoarding.start")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Step 1: Personal & Legal */}
          <section id="step-1" className="animate-fade-up stagger-3">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.personal.title")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.personal.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.fullName")}
                      </Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.dob")}
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {t("hiring.onboarding.personal.fields.address")}
                    </Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder={t("hiring.onboarding.personal.placeholders.address")}
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobilePhone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.mobile")}
                      </Label>
                      <Input
                        id="mobilePhone"
                        type="tel"
                        value={formData.mobilePhone}
                        onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactName" className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.emergencyName")}
                      </Label>
                      <Input
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e) =>
                          setFormData({ ...formData, emergencyContactName: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.emergencyPhone")}
                      </Label>
                      <Input
                        id="emergencyContactPhone"
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) =>
                          setFormData({ ...formData, emergencyContactPhone: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountNumber" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.bankAccount")}
                      </Label>
                      <Input
                        id="bankAccountNumber"
                        value={formData.bankAccountNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, bankAccountNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxId" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.taxId")}
                      </Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idDocument" className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        {t("hiring.onboarding.personal.fields.idDocument")}
                      </Label>
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-emerald-300 transition-colors cursor-pointer bg-muted/30">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          id="idDocument"
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              idDocument: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <label htmlFor="idDocument" className="cursor-pointer">
                          <p className="text-sm text-muted-foreground">
                            {t("hiring.onboarding.personal.upload.cta")}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {t("hiring.onboarding.personal.upload.types")}
                          </p>
                          {formData.idDocument && (
                            <p className="text-xs text-foreground mt-2">{formData.idDocument.name}</p>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    {t("hiring.onboarding.personal.actions.saveContinue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Step 2: Policies & Handbook */}
          <section id="step-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.policies.title")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.policies.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI handbook customiser */}
                <div className="border border-border/50 rounded-xl p-5 bg-muted/20 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        Company handbook
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Start from our generic TL-compliant template, then personalise with AI.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCustomizeHandbook}
                      disabled={isAiLoading}
                      className="gap-2 shrink-0"
                    >
                      {isAiLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-current/30 border-t-current" />
                          Personalising…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Personalise with AI
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyNameHint" className="text-xs">
                        Company name
                      </Label>
                      <Input
                        id="companyNameHint"
                        value={companyNameHint}
                        onChange={(e) => setCompanyNameHint(e.target.value)}
                        placeholder="e.g. Naroman Ltd"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="industryHint" className="text-xs">
                        Industry
                      </Label>
                      <Input
                        id="industryHint"
                        value={industryHint}
                        onChange={(e) => setIndustryHint(e.target.value)}
                        placeholder="e.g. hospitality, construction, oil & gas"
                      />
                    </div>
                  </div>
                  <Textarea
                    value={handbookContent}
                    onChange={(e) => setHandbookContent(e.target.value)}
                    rows={14}
                    className="font-mono text-xs"
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="handbookRead"
                      checked={acknowledgements.handbookRead}
                      onCheckedChange={(v) =>
                        setAcknowledgements((prev) => ({ ...prev, handbookRead: v === true }))
                      }
                    />
                    <label htmlFor="handbookRead" className="text-sm cursor-pointer">
                      I confirm I have read the handbook above.
                    </label>
                  </div>
                </div>

                {/* Policy Acknowledgements */}
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("hiring.onboarding.policies.ackTitle")}</h4>
                  <div className="space-y-3">
                    {policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          id={policy.id}
                          checked={!!acknowledgements[policy.id as keyof typeof acknowledgements]}
                          onCheckedChange={(checked) =>
                            setAcknowledgements((prev) => ({
                              ...prev,
                              [policy.id]: checked === true,
                            }))
                          }
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <label
                          htmlFor={policy.id}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {t("hiring.onboarding.policies.acknowledge", { policy: policy.label })}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature */}
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("hiring.onboarding.policies.signatureTitle")}</h4>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("hiring.onboarding.policies.signaturePrompt")}
                    </p>
                    <div className="flex items-center justify-center space-x-3">
                      <Checkbox
                        id="signature"
                        checked={acknowledgements.signed}
                        onCheckedChange={(checked) =>
                          setAcknowledgements((prev) => ({
                            ...prev,
                            signed: checked === true,
                            signatureDate: checked === true ? getTodayTL() : "",
                          }))
                        }
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <label htmlFor="signature" className="font-medium cursor-pointer">
                        {t("hiring.onboarding.policies.signatureLabel", {
                          name:
                            formData.fullName ||
                            t("hiring.onboarding.policies.signaturePlaceholder"),
                        })}
                      </label>
                    </div>
                    {acknowledgements.signed && (
                      <p className="text-xs text-blue-600 mt-3 flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {t("hiring.onboarding.policies.signedOn", {
                          date: acknowledgements.signatureDate,
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleAcknowledgementsSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {t("hiring.onboarding.policies.confirm")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 3: Department SOPs */}
          <section id="step-3">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.sops.title")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.sops.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {departmentSOPs.map((sop) => (
                    <div
                      key={sop.id}
                      className={`border rounded-xl p-5 transition-all ${
                        sopStatuses[sop.id]
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                          : "border-border/50 hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold flex items-center gap-2">
                            {sopStatuses[sop.id] && (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            )}
                            {sop.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">{sop.description}</p>
                          <Badge
                            variant="outline"
                            className="mt-3 bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
                          >
                            {sop.department}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`sop-${sop.id}`}
                            checked={sopStatuses[sop.id] || false}
                            onCheckedChange={() => handleSOPToggle(sop.id)}
                            className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          <label
                            htmlFor={`sop-${sop.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {t("hiring.onboarding.sops.markRead")}
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setCurrentStep(4)}
                  disabled={!allSOPsCompleted}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {t("hiring.onboarding.sops.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 4: IT Equipment — asset capture */}
          <section id="step-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Monitor className="h-5 w-5 text-blue-600" />
                  </div>
                  IT equipment & access
                </CardTitle>
                <CardDescription>
                  Record the serial number, asset tag and details of every item issued — we'll
                  pull this list into offboarding when the employee leaves.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Company email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                      placeholder="employee@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tempPassword">One-time password</Label>
                    <Input
                      id="tempPassword"
                      value={formData.tempPassword}
                      onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                      placeholder="Share with employee securely"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {equipment.length === 0 && (
                    <div className="text-sm text-muted-foreground p-6 rounded-lg border border-dashed border-border/50 text-center">
                      No equipment issued yet. Add a laptop, phone, access card or other item.
                    </div>
                  )}
                  {equipment.map((asset) => (
                    <div
                      key={asset.id}
                      className="rounded-lg border border-border/50 p-4 space-y-3 bg-card"
                    >
                      <div className="grid md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={asset.type}
                            onValueChange={(v) =>
                              updateEquipment(asset.id, { type: v as EquipmentAssetType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_TYPES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Make</Label>
                          <Input
                            value={asset.make || ""}
                            onChange={(e) => updateEquipment(asset.id, { make: e.target.value })}
                            placeholder="e.g. Dell"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Model</Label>
                          <Input
                            value={asset.model || ""}
                            onChange={(e) => updateEquipment(asset.id, { model: e.target.value })}
                            placeholder="e.g. Latitude 5540"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Serial number</Label>
                          <Input
                            value={asset.serialNumber || ""}
                            onChange={(e) =>
                              updateEquipment(asset.id, { serialNumber: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Asset tag / company #</Label>
                          <Input
                            value={asset.assetTag || ""}
                            onChange={(e) =>
                              updateEquipment(asset.id, { assetTag: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Notes</Label>
                          <Input
                            value={asset.notes || ""}
                            onChange={(e) => updateEquipment(asset.id, { notes: e.target.value })}
                            placeholder="Condition, accessories…"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(asset.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addEquipment}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add equipment
                  </Button>
                </div>

                <Button
                  onClick={() => setCurrentStep(5)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 5: Orientation */}
          <section id="step-5">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.steps.orientation")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.placeholders.orientation")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    {
                      day: t("hiring.onboarding.orientation.day1"),
                      items: [
                        t("hiring.onboarding.orientation.day1_tour"),
                        t("hiring.onboarding.orientation.day1_team"),
                        t("hiring.onboarding.orientation.day1_hr"),
                      ],
                    },
                    {
                      day: t("hiring.onboarding.orientation.day2_3"),
                      items: [
                        t("hiring.onboarding.orientation.day2_dept"),
                        t("hiring.onboarding.orientation.day2_systems"),
                        t("hiring.onboarding.orientation.day2_project"),
                      ],
                    },
                    {
                      day: t("hiring.onboarding.orientation.week1"),
                      items: [
                        t("hiring.onboarding.orientation.week1_lunch"),
                        t("hiring.onboarding.orientation.week1_buddy"),
                        t("hiring.onboarding.orientation.week1_checkin"),
                      ],
                    },
                  ].map((schedule) => (
                    <div key={schedule.day} className="p-4 rounded-lg border border-border/50">
                      <Badge className="mb-3 bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                        {schedule.day}
                      </Badge>
                      <ul className="space-y-2">
                        {schedule.items.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setCurrentStep(6)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {t("hiring.onboarding.orientation.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 6: Benefits — data capture */}
          <section id="step-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Heart className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.steps.benefits")}
                </CardTitle>
                <CardDescription>
                  Capture the actual enrolment numbers so HR can reach the right provider later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="healthCard">Health insurance card #</Label>
                    <Input
                      id="healthCard"
                      value={benefits.healthCardNumber || ""}
                      onChange={(e) =>
                        setBenefits((prev) => ({ ...prev, healthCardNumber: e.target.value }))
                      }
                      placeholder="Leave blank if not enrolled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retirementNum">Social security / retirement #</Label>
                    <Input
                      id="retirementNum"
                      value={benefits.retirementPlanNumber || ""}
                      onChange={(e) =>
                        setBenefits((prev) => ({ ...prev, retirementPlanNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lifePolicy">Life insurance policy #</Label>
                    <Input
                      id="lifePolicy"
                      value={benefits.lifeInsurancePolicy || ""}
                      onChange={(e) =>
                        setBenefits((prev) => ({ ...prev, lifeInsurancePolicy: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leaveDays">Annual leave entitlement (days)</Label>
                    <Input
                      id="leaveDays"
                      type="number"
                      min={0}
                      value={benefits.leaveEntitlementDays ?? ""}
                      onChange={(e) =>
                        setBenefits((prev) => ({
                          ...prev,
                          leaveEntitlementDays: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      placeholder="e.g. 12"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="benefitNotes">Notes</Label>
                  <Textarea
                    id="benefitNotes"
                    value={benefits.notes || ""}
                    onChange={(e) => setBenefits((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any special benefit arrangements…"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() => setCurrentStep(7)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {t("hiring.onboarding.benefits.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 7: Probation */}
          <section id="step-7">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.steps.probation")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.placeholders.probation")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("hiring.onboarding.probation.periodLabel")}</Label>
                    <Input
                      type="text"
                      value={t("hiring.onboarding.probation.periodValue")}
                      disabled
                      className="border-border/50 bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("hiring.onboarding.probation.endDateLabel")}</Label>
                    <Input type="date" className="border-border/50" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("hiring.onboarding.probation.milestonesTitle")}</h4>
                  {[
                    { week: t("hiring.onboarding.probation.week2"), milestone: t("hiring.onboarding.probation.week2Milestone") },
                    { week: t("hiring.onboarding.probation.month1"), milestone: t("hiring.onboarding.probation.month1Milestone") },
                    { week: t("hiring.onboarding.probation.month2"), milestone: t("hiring.onboarding.probation.month2Milestone") },
                    { week: t("hiring.onboarding.probation.month3"), milestone: t("hiring.onboarding.probation.month3Milestone") },
                  ].map((item) => (
                    <div
                      key={item.week}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {item.week}
                      </Badge>
                      <span className="text-sm">{item.milestone}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setCurrentStep(8)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {t("hiring.onboarding.probation.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Step 8: Feedback & Complete */}
          <section id="step-8">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("hiring.onboarding.steps.feedback")}
                </CardTitle>
                <CardDescription>{t("hiring.onboarding.placeholders.feedback")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { day: t("hiring.onboarding.feedback.day30"), title: t("hiring.onboarding.feedback.day30Title"), status: t("hiring.onboarding.feedback.day30Status") },
                    { day: t("hiring.onboarding.feedback.day60"), title: t("hiring.onboarding.feedback.day60Title"), status: t("hiring.onboarding.feedback.day60Status") },
                    { day: t("hiring.onboarding.feedback.day90"), title: t("hiring.onboarding.feedback.day90Title"), status: t("hiring.onboarding.feedback.day90Status") },
                  ].map((fb) => (
                    <div key={fb.day} className="p-4 rounded-lg border border-border/50 text-center">
                      <Badge className="mb-2 bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                        {fb.day}
                      </Badge>
                      <h4 className="font-semibold text-sm mb-1">{fb.title}</h4>
                      <p className="text-xs text-muted-foreground">{fb.status}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("hiring.onboarding.feedback.initialTitle")}</h4>
                  <Textarea
                    placeholder={t("hiring.onboarding.feedback.placeholder")}
                    rows={4}
                    className="border-border/50"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleComplete}
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSaving ? "Saving…" : "Save & finish onboarding"}
                  {!isSaving && <CheckCircle className="ml-2 h-4 w-4" />}
                </Button>
                <div className="p-6 rounded-xl bg-blue-500/10 border border-emerald-200 dark:border-emerald-800 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">
                    {t("hiring.onboarding.feedback.completeTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("hiring.onboarding.feedback.completeDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
