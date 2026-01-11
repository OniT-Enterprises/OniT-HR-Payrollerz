import React, { useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
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
} from "lucide-react";

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    address: "",
    mobilePhone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bankAccountNumber: "",
    taxId: "",
    idDocument: null,
  });
  const [acknowledgements, setAcknowledgements] = useState({
    dressCode: false,
    codeOfConduct: false,
    leavePolicy: false,
    safetyGuidelines: false,
    dataProtection: false,
    signed: false,
    signatureDate: "",
  });
  const [sopStatuses, setSopStatuses] = useState({});

  const steps = useMemo(
    () => [
      {
        id: 0,
        label: t("hiring.onboarding.steps.preBoarding"),
        icon: <UserPlus className="h-4 w-4" />,
      },
      {
        id: 1,
        label: t("hiring.onboarding.steps.personalLegal"),
        icon: <FileText className="h-4 w-4" />,
      },
      {
        id: 2,
        label: t("hiring.onboarding.steps.policies"),
        icon: <Shield className="h-4 w-4" />,
      },
      {
        id: 3,
        label: t("hiring.onboarding.steps.departmentSops"),
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        id: 4,
        label: t("hiring.onboarding.steps.itEquipment"),
        icon: <Monitor className="h-4 w-4" />,
      },
      {
        id: 5,
        label: t("hiring.onboarding.steps.orientation"),
        icon: <GraduationCap className="h-4 w-4" />,
      },
      {
        id: 6,
        label: t("hiring.onboarding.steps.benefits"),
        icon: <Heart className="h-4 w-4" />,
      },
      {
        id: 7,
        label: t("hiring.onboarding.steps.probation"),
        icon: <Target className="h-4 w-4" />,
      },
      {
        id: 8,
        label: t("hiring.onboarding.steps.feedback"),
        icon: <MessageCircle className="h-4 w-4" />,
      },
    ],
    [t],
  );

  // Mock SOPs data
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
      {
        id: "codeOfConduct",
        label: t("hiring.onboarding.policies.items.conduct"),
      },
      {
        id: "leavePolicy",
        label: t("hiring.onboarding.policies.items.leave"),
      },
      {
        id: "safetyGuidelines",
        label: t("hiring.onboarding.policies.items.safety"),
      },
      {
        id: "dataProtection",
        label: t("hiring.onboarding.policies.items.data"),
      },
    ],
    [t],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Saving to Firestore:", formData);
    setCurrentStep(2);
  };

  const handleAcknowledgementsSubmit = () => {
    const hasCheckedItems = Object.values(acknowledgements).some(
      (v) => v === true,
    );
    if (!hasCheckedItems || !acknowledgements.signed) {
      alert(t("hiring.onboarding.policies.alert"));
      return;
    }
    console.log("Saving acknowledgements:", acknowledgements);
    setCurrentStep(3);
  };

  const handleSOPToggle = (sopId: number) => {
    setSopStatuses((prev) => ({
      ...prev,
      [sopId]: !prev[sopId],
    }));
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
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.onboarding} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-emerald-50 dark:bg-emerald-950/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("hiring.onboarding.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("hiring.onboarding.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Horizontal Stepper */}
        <Card className="mb-8 border-border/50 animate-fade-up stagger-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center min-w-[80px] relative">
                  <button
                    onClick={() => scrollToSection(step.id)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 transition-all duration-200 ${
                      getStepStatus(step.id) === "completed"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-transparent text-white shadow-lg shadow-emerald-500/25"
                        : getStepStatus(step.id) === "current"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-transparent text-white shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-500/20"
                          : "bg-muted border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600"
                    }`}
                  >
                    {getStepStatus(step.id) === "completed" ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      step.icon
                    )}
                  </button>
                  <span
                    className={`text-xs text-center font-medium max-w-[70px] leading-tight ${
                      getStepStatus(step.id) === "current"
                        ? "text-emerald-600"
                        : getStepStatus(step.id) === "completed"
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 ${
                        getStepStatus(step.id) === "completed"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Progress</span>
                <span>{Math.round((currentStep / (steps.length - 1)) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content Sections */}
        <div className="space-y-8">
          {/* Step 0: Pre-Boarding */}
          <section id="step-0" className="animate-fade-up stagger-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                    <UserPlus className="h-5 w-5 text-emerald-600" />
                  </div>
                  {t("hiring.onboarding.preBoarding.title")}
                </CardTitle>
                <CardDescription>
                  {t("hiring.onboarding.preBoarding.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <p className="text-muted-foreground">
                    {t("hiring.onboarding.preBoarding.welcome")}
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-5 border border-border/50 rounded-xl bg-card hover:shadow-md transition-shadow">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-emerald-500" />
                        {t("hiring.onboarding.preBoarding.expectTitle")}
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          {t("hiring.onboarding.preBoarding.expect.items.info")}
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          {t("hiring.onboarding.preBoarding.expect.items.policies")}
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          {t("hiring.onboarding.preBoarding.expect.items.it")}
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          {t("hiring.onboarding.preBoarding.expect.items.orientation")}
                        </li>
                      </ul>
                    </div>
                    <div className="p-5 border border-border/50 rounded-xl bg-card hover:shadow-md transition-shadow">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-teal-500" />
                        {t("hiring.onboarding.preBoarding.timeTitle")}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {t("hiring.onboarding.preBoarding.timeDescription")}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => scrollToSection(1)}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
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
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  {t("hiring.onboarding.personal.title")}
                </CardTitle>
                <CardDescription>
                  {t("hiring.onboarding.personal.description")}
                </CardDescription>
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
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        className="border-border/50"
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
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dateOfBirth: e.target.value,
                          })
                        }
                        className="border-border/50"
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
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder={t("hiring.onboarding.personal.placeholders.address")}
                      className="border-border/50"
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
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mobilePhone: e.target.value,
                          })
                        }
                        className="border-border/50"
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
                          setFormData({
                            ...formData,
                            emergencyContactName: e.target.value,
                          })
                        }
                        className="border-border/50"
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
                          setFormData({
                            ...formData,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                        className="border-border/50"
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
                          setFormData({
                            ...formData,
                            bankAccountNumber: e.target.value,
                          })
                        }
                        className="border-border/50"
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
                        onChange={(e) =>
                          setFormData({ ...formData, taxId: e.target.value })
                        }
                        className="border-border/50"
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
                          accept=".pdf,.jpg,.png"
                          className="hidden"
                          id="idDocument"
                        />
                        <label htmlFor="idDocument" className="cursor-pointer">
                          <p className="text-sm text-muted-foreground">
                            {t("hiring.onboarding.personal.upload.cta")}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {t("hiring.onboarding.personal.upload.types")}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  >
                    {t("hiring.onboarding.personal.actions.saveContinue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Step 2: Policies & Acknowledgements */}
          <section id="step-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                    <Shield className="h-5 w-5 text-emerald-600" />
                  </div>
                  {t("hiring.onboarding.policies.title")}
                </CardTitle>
                <CardDescription>
                  {t("hiring.onboarding.policies.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PDF Viewer Placeholder */}
                <div className="border border-border/50 rounded-xl p-8 bg-muted/30 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">
                    {t("hiring.onboarding.policies.handbook.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("hiring.onboarding.policies.handbook.description")}
                  </p>
                  <Button variant="outline" className="border-border/50">
                    {t("hiring.onboarding.policies.handbook.button")}
                  </Button>
                </div>

                {/* Policy Acknowledgements */}
                <div className="space-y-4">
                  <h4 className="font-semibold">
                    {t("hiring.onboarding.policies.ackTitle")}
                  </h4>
                  <div className="space-y-3">
                    {policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          id={policy.id}
                          checked={acknowledgements[policy.id]}
                          onCheckedChange={(checked) =>
                            setAcknowledgements((prev) => ({
                              ...prev,
                              [policy.id]: checked,
                            }))
                          }
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <label
                          htmlFor={policy.id}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {t("hiring.onboarding.policies.acknowledge", {
                            policy: policy.label,
                          })}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature Pad */}
                <div className="space-y-4">
                  <h4 className="font-semibold">
                    {t("hiring.onboarding.policies.signatureTitle")}
                  </h4>
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
                            signatureDate: checked === true
                              ? new Date().toISOString().split("T")[0]
                              : "",
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
                      <p className="text-xs text-emerald-600 mt-3 flex items-center justify-center gap-1">
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
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
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
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                  </div>
                  {t("hiring.onboarding.sops.title")}
                </CardTitle>
                <CardDescription>
                  {t("hiring.onboarding.sops.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {departmentSOPs.map((sop) => (
                    <div
                      key={sop.id}
                      className={`border rounded-xl p-5 transition-all ${
                        sopStatuses[sop.id]
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                          : 'border-border/50 hover:border-emerald-200'
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
                          <p className="text-sm text-muted-foreground mt-1">
                            {sop.description}
                          </p>
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
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {t("hiring.onboarding.sops.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Placeholder sections for remaining steps */}
          {[4, 5, 6, 7, 8].map((stepId) => (
            <section key={stepId} id={`step-${stepId}`}>
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                      {React.cloneElement(steps[stepId].icon as React.ReactElement, {
                        className: "h-5 w-5 text-emerald-600"
                      })}
                    </div>
                    {steps[stepId].label}
                  </CardTitle>
                  <CardDescription>
                    {stepId === 4 &&
                      t("hiring.onboarding.placeholders.it")}
                    {stepId === 5 &&
                      t("hiring.onboarding.placeholders.orientation")}
                    {stepId === 6 &&
                      t("hiring.onboarding.placeholders.benefits")}
                    {stepId === 7 &&
                      t("hiring.onboarding.placeholders.probation")}
                    {stepId === 8 &&
                      t("hiring.onboarding.placeholders.feedback")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl bg-muted/30">
                    <div className="mb-4 p-3 rounded-full bg-muted inline-flex">
                      {React.cloneElement(steps[stepId].icon as React.ReactElement, {
                        className: "h-6 w-6 text-muted-foreground"
                      })}
                    </div>
                    <p className="text-muted-foreground">
                      {t("hiring.onboarding.placeholders.content", {
                        step: steps[stepId].label,
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
