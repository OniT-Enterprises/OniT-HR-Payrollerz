/**
 * Setup Wizard - Guided setup for new tenants
 * 5-step wizard: Company Details -> Bank Accounts -> Leave Policies -> Payroll Config -> Complete
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CreditCard,
  Calendar,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { settingsService } from "@/services/settingsService";
import { useTenantId } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import type {
  BusinessSector,
  BusinessType,
  CompanyDetails,
  CompanyStructure,
  EmployeeGradeConfig,
} from "@/types/settings";

const STEPS = [
  { id: "company", labelKey: "setupWizard.steps.companyDetails", icon: Building2 },
  { id: "bank", labelKey: "setupWizard.steps.bankAccounts", icon: CreditCard },
  { id: "leave", labelKey: "setupWizard.steps.leavePolicies", icon: Calendar },
  { id: "payroll", labelKey: "setupWizard.steps.payrollConfig", icon: Settings },
  { id: "complete", labelKey: "setupWizard.steps.complete", icon: CheckCircle },
] as const;

const BUSINESS_TYPES: { value: BusinessType; labelKey: string }[] = [
  { value: "Lda", labelKey: "settings.company.businessTypes.lda" },
  { value: "SA", labelKey: "settings.company.businessTypes.sa" },
  { value: "Unipessoal", labelKey: "settings.company.businessTypes.unipessoal" },
  { value: "ENIN", labelKey: "settings.company.businessTypes.enin" },
  { value: "NGO", labelKey: "settings.company.businessTypes.ngo" },
  { value: "Government", labelKey: "settings.company.businessTypes.government" },
  { value: "Other", labelKey: "settings.company.businessTypes.other" },
];

const BUSINESS_SECTORS: { value: BusinessSector; labelKey: string }[] = [
  { value: "security", labelKey: "settings.structure.sectors.security" },
  { value: "hotel", labelKey: "settings.structure.sectors.hotel" },
  { value: "restaurant", labelKey: "settings.structure.sectors.restaurant" },
  { value: "trading", labelKey: "settings.structure.sectors.trading" },
  { value: "manufacturing", labelKey: "settings.structure.sectors.manufacturing" },
  { value: "construction", labelKey: "settings.structure.sectors.construction" },
  { value: "retail", labelKey: "settings.structure.sectors.retail" },
  { value: "healthcare", labelKey: "settings.structure.sectors.healthcare" },
  { value: "education", labelKey: "settings.structure.sectors.education" },
  { value: "finance", labelKey: "settings.structure.sectors.finance" },
  { value: "technology", labelKey: "settings.structure.sectors.technology" },
  { value: "ngo", labelKey: "settings.structure.sectors.ngo" },
  { value: "government", labelKey: "settings.structure.sectors.government" },
  { value: "other", labelKey: "settings.structure.sectors.other" },
];

const DEFAULT_EMPLOYEE_GRADES: EmployeeGradeConfig[] = [
  { grade: "director", label: "Director", isActive: true },
  { grade: "senior_management", label: "Senior Management", isActive: true },
  { grade: "management", label: "Management", isActive: true },
  { grade: "supervisor", label: "Supervisor", isActive: true },
  { grade: "general_staff", label: "General Staff", isActive: true },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Company Details form
  const [companyForm, setCompanyForm] = useState<Partial<CompanyDetails>>({
    legalName: "",
    tradingName: "",
    registeredAddress: "",
    city: "",
    country: "Timor-Leste",
    tinNumber: "",
    businessType: "Lda",
    phone: "",
    email: "",
  });
  const [companyStructureForm, setCompanyStructureForm] = useState<{
    businessSector: BusinessSector;
    approximateEmployeeCount: string;
  }>({
    businessSector: "other",
    approximateEmployeeCount: "",
  });

  // Bank Account form
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    purpose: "payroll" as const,
  });

  // Payroll Config form
  const [payrollForm, setPayrollForm] = useState({
    payFrequency: "monthly",
    payDay: "25",
    currency: "USD",
  });

  // Load existing progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        let settings = await settingsService.getSettings(tenantId);
        if (!settings) {
          settings = await settingsService.createSettings(tenantId);
        }

        const progress = await settingsService.getSetupProgress(tenantId);
        if (progress.isComplete) {
          navigate("/dashboard");
          return;
        }

        setCompanyForm({
          legalName: settings.companyDetails.legalName || "",
          tradingName: settings.companyDetails.tradingName || "",
          registeredAddress: settings.companyDetails.registeredAddress || "",
          city: settings.companyDetails.city || "",
          country: settings.companyDetails.country || "Timor-Leste",
          tinNumber: settings.companyDetails.tinNumber || "",
          businessType: settings.companyDetails.businessType || "Lda",
          phone: settings.companyDetails.phone || "",
          email: settings.companyDetails.email || "",
        });

        setCompanyStructureForm({
          businessSector: settings.companyStructure.businessSector || "other",
          approximateEmployeeCount: settings.companyStructure.approximateEmployeeCount
            ? String(settings.companyStructure.approximateEmployeeCount)
            : "",
        });

        const primaryBank = settings.paymentStructure.bankAccounts?.[0];
        if (primaryBank) {
          setBankForm({
            bankName: primaryBank.bankName || "",
            accountName: primaryBank.accountName || "",
            accountNumber: primaryBank.accountNumber || "",
            purpose: "payroll",
          });
        }

        const primaryPayrollPeriod = settings.paymentStructure.payrollPeriods?.[0];
        setPayrollForm({
          payFrequency: primaryPayrollPeriod?.frequency === "weekly"
            ? "weekly"
            : primaryPayrollPeriod?.frequency === "bi_weekly"
              ? "biweekly"
              : "monthly",
          payDay: String(primaryPayrollPeriod?.payDay || 25),
          currency: settings.payrollConfig.currency || "USD",
        });

        if (!progress.progress.companyDetails || !progress.progress.companyStructure) {
          setCurrentStep(0);
        } else if (!progress.progress.paymentStructure) {
          setCurrentStep(1);
        } else if (!progress.progress.timeOffPolicies) {
          setCurrentStep(2);
        } else if (!progress.progress.payrollConfig) {
          setCurrentStep(3);
        } else {
          setCurrentStep(4);
        }
      } catch {
        // Settings don't exist yet - start fresh
      } finally {
        setLoading(false);
      }
    };
    loadProgress();
  }, [tenantId, navigate]);

  const handleSaveCompanyDetails = async () => {
    if (!companyForm.legalName || !companyForm.tinNumber) {
      toast({
        title: t("setupWizard.requiredFields"),
        description: t("setupWizard.companyNameTinRequired"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      let settings = await settingsService.getSettings(tenantId);
      if (!settings) {
        settings = await settingsService.createSettings(tenantId);
      }
      const existingStructure = settings?.companyStructure;
      const nextCompanyStructure: CompanyStructure = {
        businessSector: companyStructureForm.businessSector,
        businessSectorOther: existingStructure?.businessSectorOther,
        approximateEmployeeCount: companyStructureForm.approximateEmployeeCount
          ? parseInt(companyStructureForm.approximateEmployeeCount, 10)
          : existingStructure?.approximateEmployeeCount,
        workLocations: existingStructure?.workLocations ?? [],
        departments: existingStructure?.departments ?? [],
        employeeGrades: existingStructure?.employeeGrades?.length
          ? existingStructure.employeeGrades
          : DEFAULT_EMPLOYEE_GRADES,
      };

      await Promise.all([
        settingsService.updateCompanyDetails(tenantId, companyForm as CompanyDetails),
        settingsService.updateCompanyStructure(tenantId, nextCompanyStructure),
      ]);
      return true;
    } catch {
      toast({
        title: t("setupWizard.error"),
        description: t("setupWizard.failedSaveCompany"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankAccount = async () => {
    if (!bankForm.bankName || !bankForm.accountNumber) {
      toast({
        title: t("setupWizard.requiredFields"),
        description: t("setupWizard.bankNameAccountRequired"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      await settingsService.updatePaymentStructure(tenantId, {
        paymentMethods: ["bank_transfer"],
        primaryPaymentMethod: "bank_transfer",
        bankAccounts: [{
          id: `bank-${Date.now()}`,
          purpose: bankForm.purpose,
          bankName: bankForm.bankName,
          accountName: bankForm.accountName,
          accountNumber: bankForm.accountNumber,
          isActive: true,
        }],
        employmentTypes: ["full_time", "part_time", "contract"],
        payrollFrequencies: ["monthly"],
        payrollPeriods: [],
      });
      return true;
    } catch {
      toast({
        title: t("setupWizard.error"),
        description: t("setupWizard.failedSaveBank"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLeavePolicy = async () => {
    setSaving(true);
    try {
      // Use TL defaults - just mark as configured
      await settingsService.updateTimeOffPolicies(tenantId, {
        annualLeave: { daysPerYear: 12, accrualMethod: "annual", carryOverMax: 0 },
        sickLeave: { daysPerYear: 30, requiresCertificate: true, certificateAfterDays: 3 },
        maternityLeave: { weeks: 12, paidWeeks: 12 },
        paternityLeave: { days: 5 },
      });
      return true;
    } catch {
      toast({
        title: t("setupWizard.error"),
        description: t("setupWizard.failedSaveLeave"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayrollConfig = async () => {
    setSaving(true);
    try {
      await settingsService.updatePayrollConfig(tenantId, {
        payFrequency: payrollForm.payFrequency,
        payDay: parseInt(payrollForm.payDay),
        currency: payrollForm.currency,
        taxSystem: "timor_leste",
        witRate: 0.10,
        witThreshold: 500,
        inssEmployeeRate: 0.04,
        inssEmployerRate: 0.06,
        standardWeeklyHours: 44,
      });
      return true;
    } catch {
      toast({
        title: t("setupWizard.error"),
        description: t("setupWizard.failedSavePayroll"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSetup = async () => {
    setSaving(true);
    try {
      await settingsService.completeSetup(tenantId);
      toast({
        title: t("setupWizard.setupComplete"),
        description: t("setupWizard.accountReady"),
      });
      navigate("/dashboard");
    } catch {
      toast({
        title: t("setupWizard.error"),
        description: t("setupWizard.failedComplete"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    let success = true;

    switch (currentStep) {
      case 0:
        success = await handleSaveCompanyDetails();
        break;
      case 1:
        success = await handleSaveBankAccount();
        break;
      case 2:
        success = await handleSaveLeavePolicy();
        break;
      case 3:
        success = await handleSavePayrollConfig();
        break;
      case 4:
        await handleCompleteSetup();
        return;
    }

    if (success) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };
  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher variant="buttons" className="justify-end" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25 mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">{t("setupWizard.welcome")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("setupWizard.welcomeDesc")}
          </p>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <Card className="border-green-200 bg-white/80 dark:border-green-900/40 dark:bg-background/80">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("setupWizard.progressTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("setupWizard.stepOf", {
                      current: String(currentStep + 1),
                      total: String(STEPS.length),
                    })}
                  </p>
                </div>
                <p className="text-2xl font-bold text-green-600">{progressPercent}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("setupWizard.progressHint")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-white/80 dark:bg-background/80">
            <CardContent className="pt-5">
              <p className="text-sm font-semibold text-foreground">
                {t("setupWizard.savedAutomaticallyTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("setupWizard.savedAutomaticallyDesc")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div className={`h-0.5 w-8 ${isCompleted ? "bg-green-500" : "bg-border"}`} />
                )}
                <div className="flex min-w-16 flex-col items-center gap-2 text-center">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full transition-all
                      ${isActive ? "bg-green-500 text-white shadow-lg shadow-green-500/25" : ""}
                      ${isCompleted ? "bg-green-500 text-white" : ""}
                      ${!isActive && !isCompleted ? "bg-muted text-muted-foreground" : ""}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] leading-tight ${
                      isActive ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t(step.labelKey)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep].icon, { className: "h-5 w-5 text-green-600" })}
              {t(STEPS[currentStep].labelKey)}
            </CardTitle>
            <CardDescription>
              {t("setupWizard.stepOf", { current: String(currentStep + 1), total: String(STEPS.length) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Company Details */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.companyIntro")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("setupWizard.legalName")}</Label>
                    <Input
                      value={companyForm.legalName}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, legalName: e.target.value }))}
                      placeholder={t("setupWizard.legalNamePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("setupWizard.tradingName")}</Label>
                    <Input
                      value={companyForm.tradingName}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, tradingName: e.target.value }))}
                      placeholder={t("setupWizard.tradingNamePlaceholder")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("settings.company.businessType")}</Label>
                    <Select
                      value={companyForm.businessType}
                      onValueChange={(value: BusinessType) =>
                        setCompanyForm((prev) => ({ ...prev, businessType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {t(type.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("settings.structure.businessSector")}</Label>
                    <Select
                      value={companyStructureForm.businessSector}
                      onValueChange={(value: BusinessSector) =>
                        setCompanyStructureForm((prev) => ({ ...prev, businessSector: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_SECTORS.map((sector) => (
                          <SelectItem key={sector.value} value={sector.value}>
                            {t(sector.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("setupWizard.tinNumber")}</Label>
                    <Input
                      value={companyForm.tinNumber}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, tinNumber: e.target.value }))}
                      placeholder={t("setupWizard.tinPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("setupWizard.teamSize")}</Label>
                    <Select
                      value={companyStructureForm.approximateEmployeeCount}
                      onValueChange={(value) =>
                        setCompanyStructureForm((prev) => ({ ...prev, approximateEmployeeCount: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("setupWizard.selectTeamSize")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">1-5</SelectItem>
                        <SelectItem value="20">6-20</SelectItem>
                        <SelectItem value="50">21-50</SelectItem>
                        <SelectItem value="100">51+</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">{t("setupWizard.teamSizeHint")}</p>
                  </div>
                </div>
                <div>
                  <Label>{t("setupWizard.address")}</Label>
                  <Input
                    value={companyForm.registeredAddress}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, registeredAddress: e.target.value }))}
                    placeholder={t("setupWizard.addressPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("setupWizard.city")}</Label>
                    <Input
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder={t("setupWizard.cityPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("setupWizard.country")}</Label>
                    <Input value={companyForm.country} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("setupWizard.phone")}</Label>
                    <Input
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder={t("setupWizard.phonePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("setupWizard.email")}</Label>
                    <Input
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder={t("setupWizard.emailPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Bank Accounts */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.bankIntro")}
                </p>
                <div>
                  <Label>{t("setupWizard.bankName")}</Label>
                  <Select
                    value={bankForm.bankName}
                    onValueChange={(v) => setBankForm((p) => ({ ...p, bankName: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("setupWizard.selectBank")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BNU">BNU (Banco Nacional Ultramarino)</SelectItem>
                      <SelectItem value="Mandiri">Bank Mandiri</SelectItem>
                      <SelectItem value="ANZ">ANZ</SelectItem>
                      <SelectItem value="BNCTL">BNCTL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("setupWizard.accountName")}</Label>
                  <Input
                    value={bankForm.accountName}
                    onChange={(e) => setBankForm((p) => ({ ...p, accountName: e.target.value }))}
                    placeholder={t("setupWizard.accountNamePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("setupWizard.accountNumber")}</Label>
                  <Input
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))}
                    placeholder={t("setupWizard.accountNumberPlaceholder")}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Leave Policies */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.leaveIntro")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { labelKey: "setupWizard.annualLeave", valueKey: "setupWizard.annualLeaveValue" },
                    { labelKey: "setupWizard.sickLeave", valueKey: "setupWizard.sickLeaveValue" },
                    { labelKey: "setupWizard.maternityLeave", valueKey: "setupWizard.maternityLeaveValue" },
                    { labelKey: "setupWizard.paternityLeave", valueKey: "setupWizard.paternityLeaveValue" },
                  ].map((policy) => (
                    <div key={policy.labelKey} className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{t(policy.labelKey)}</p>
                      <p className="text-lg font-bold text-green-600">{t(policy.valueKey)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("setupWizard.leaveNote")}
                </p>
              </div>
            )}

            {/* Step 4: Payroll Config */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>{t("setupWizard.payFrequency")}</Label>
                  <Select
                    value={payrollForm.payFrequency}
                    onValueChange={(v) => setPayrollForm((p) => ({ ...p, payFrequency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t("setupWizard.monthly")}</SelectItem>
                      <SelectItem value="biweekly">{t("setupWizard.biWeekly")}</SelectItem>
                      <SelectItem value="weekly">{t("setupWizard.weekly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("setupWizard.payDay")}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={payrollForm.payDay}
                    onChange={(e) => setPayrollForm((p) => ({ ...p, payDay: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("setupWizard.currency")}</Label>
                  <Select
                    value={payrollForm.currency}
                    onValueChange={(v) => setPayrollForm((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">{t("setupWizard.usdCurrency")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">{t("setupWizard.usdNote")}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <p className="font-medium">{t("setupWizard.taxSettings")}</p>
                  <p className="text-muted-foreground">{t("setupWizard.witInfo")}</p>
                  <p className="text-muted-foreground">{t("setupWizard.inssInfo")}</p>
                  <p className="text-muted-foreground">{t("setupWizard.hoursInfo")}</p>
                </div>
              </div>
            )}

            {/* Step 5: Complete */}
            {currentStep === 4 && (
              <div className="text-center py-8 space-y-4">
                <img
                  src="/images/illustrations/setup-complete.webp"
                  alt="Setup complete!"
                  className="w-40 h-40 mx-auto mb-2 drop-shadow-xl"
                />
                <h3 className="text-xl font-bold">{t("setupWizard.allSet")}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t("setupWizard.allSetDesc")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || saving}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("setupWizard.back")}
            </Button>
            <Button
              variant="outline"
              className="text-muted-foreground"
              onClick={() => {
                sessionStorage.setItem("setup-dismissed", "1");
                navigate("/dashboard");
              }}
            >
              {t("setupWizard.doLater")}
            </Button>
          </div>
          <Button
            onClick={handleNext}
            disabled={saving}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("setupWizard.saving")}
              </>
            ) : currentStep === STEPS.length - 1 ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t("setupWizard.goToDashboard")}
              </>
            ) : (
              <>
                {t("setupWizard.next")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("setupWizard.savedAutomaticallyDesc")}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {t("setupWizard.finishLaterHint")}
        </p>
      </div>
    </div>
  );
}
