/**
 * Setup Wizard - Guided setup for new tenants
 * 5-step wizard: Company Details -> Bank Accounts -> Leave Policies -> Payroll Config -> Complete
 */

import React, { useState, useEffect, useRef } from "react";
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
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settingsService";
import { settingsKeys } from "@/hooks/useSettings";
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
import { TL_DEFAULT_LEAVE_POLICIES } from "@/types/settings";

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
  const queryClient = useQueryClient();
  const invalidateSetupData = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "setupProgress"],
      }),
      queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) }),
    ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionInFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">(
    "cash",
  );

  // Payroll Config form
  const [payrollForm, setPayrollForm] = useState<{
    payFrequency: "monthly";
    payDay: string;
    currency: string;
  }>({
    payFrequency: "monthly",
    payDay: "25",
    currency: "USD",
  });

  // Load existing progress
  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      setLoadError(false);
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

        const primaryBank = settings.paymentStructure.bankAccounts?.find(
          (account) => account.purpose === "payroll",
        );
        setPaymentMethod(
          settings.paymentStructure.primaryPaymentMethod === "bank_transfer" && primaryBank
            ? "bank_transfer"
            : "cash",
        );
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
          payFrequency: "monthly",
          payDay: String(primaryPayrollPeriod?.payDay || 25),
          currency: settings.payrollConfig.currency || "USD",
        });

        const loadedCompletedSteps = [
          progress.progress.companyDetails && progress.progress.companyStructure,
          progress.progress.paymentStructure,
          progress.progress.timeOffPolicies,
          progress.progress.payrollConfig,
          false,
        ];
        setCompletedSteps(loadedCompletedSteps);
        const firstIncompleteStep = loadedCompletedSteps
          .slice(0, STEPS.length - 1)
          .findIndex((isComplete) => !isComplete);
        setCurrentStep(firstIncompleteStep === -1 ? STEPS.length - 1 : firstIncompleteStep);
      } catch {
        // A failed read is not the same as a new account. Keep the form
        // blocked so a transient connection issue cannot overwrite settings.
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    void loadProgress();
  }, [tenantId, navigate, loadAttempt]);

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
    if (
      paymentMethod === "bank_transfer" &&
      (!bankForm.bankName.trim() || !bankForm.accountNumber.trim())
    ) {
      toast({
        title: t("setupWizard.requiredFields"),
        description: t("setupWizard.bankNameAccountRequired"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const settings = await settingsService.getSettings(tenantId);
      if (!settings) throw new Error("Settings unavailable");
      if (paymentMethod === "cash") {
        await settingsService.updatePaymentStructure(tenantId, {
          ...settings.paymentStructure,
          paymentMethods: Array.from(
            new Set([
              ...settings.paymentStructure.paymentMethods.filter(
                (method) =>
                  method !== "bank_transfer" ||
                  settings.paymentStructure.bankAccounts.length > 0,
              ),
              "cash" as const,
            ]),
          ),
          primaryPaymentMethod: "cash",
        });
        return true;
      }

      const existingPayrollAccount = settings.paymentStructure.bankAccounts.find(
        (account) => account.purpose === "payroll",
      );
      const payrollAccount = {
        id: existingPayrollAccount?.id || `bank-${Date.now()}`,
        purpose: bankForm.purpose,
        bankName: bankForm.bankName.trim(),
        accountName: bankForm.accountName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        isActive: true,
      };

      await settingsService.updatePaymentStructure(tenantId, {
        ...settings.paymentStructure,
        paymentMethods: Array.from(
          new Set([...settings.paymentStructure.paymentMethods, "bank_transfer" as const]),
        ),
        primaryPaymentMethod: "bank_transfer",
        bankAccounts: [
          payrollAccount,
          ...settings.paymentStructure.bankAccounts.filter(
            (account) => account.id !== existingPayrollAccount?.id,
          ),
        ],
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
      // Save the same complete TL defaults that the review screen describes.
      await settingsService.updateTimeOffPolicies(tenantId, TL_DEFAULT_LEAVE_POLICIES);
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
    const enteredPayDay = Number.parseInt(payrollForm.payDay, 10);
    if (!Number.isInteger(enteredPayDay) || enteredPayDay < 1 || enteredPayDay > 28) {
      toast({
        title: t("setupWizard.requiredFields"),
        description: t("setupWizard.payDayRange"),
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const settings = await settingsService.getSettings(tenantId);
      if (!settings) throw new Error("Settings unavailable");
      const frequency = payrollForm.payFrequency;
      const payDay = enteredPayDay;

      await Promise.all([
        settingsService.updatePaymentStructure(tenantId, {
          ...settings.paymentStructure,
          payrollFrequencies: [frequency],
          payrollPeriods: [
            {
              frequency,
              startDay: 1,
              endDay: frequency === "monthly" ? 31 : frequency === "bi_weekly" ? 14 : 7,
              payDay,
              isActive: true,
            },
          ],
        }),
        settingsService.updatePayrollConfig(tenantId, {
          ...settings.payrollConfig,
          currency: payrollForm.currency,
          currencySymbol:
            payrollForm.currency === "USD" ? "$" : settings.payrollConfig.currencySymbol,
        }),
      ]);
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
      await invalidateSetupData();
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
    // State updates do not synchronously block a second click. Keep a ref guard
    // for the whole transition so a slow mobile connection cannot advance two
    // setup steps from one double-tap.
    if (transitionInFlight.current) return;
    transitionInFlight.current = true;
    setTransitioning(true);

    try {
      if (currentStep < STEPS.length - 1 && completedSteps[currentStep]) {
        let nextStep = currentStep + 1;
        while (
          nextStep < STEPS.length - 1 &&
          completedSteps[nextStep]
        ) {
          nextStep += 1;
        }
        setCurrentStep(nextStep);
        return;
      }

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
        const nextCompletedSteps = [...completedSteps];
        nextCompletedSteps[currentStep] = true;
        setCompletedSteps(nextCompletedSteps);
        let nextStep = currentStep + 1;
        while (
          nextStep < STEPS.length - 1 &&
          nextCompletedSteps[nextStep]
        ) {
          nextStep += 1;
        }
        setCurrentStep(Math.min(nextStep, STEPS.length - 1));
        // The banner can refresh in the background; advancing the saved step
        // should not wait on another network round-trip.
        void invalidateSetupData();
      }
    } finally {
      transitionInFlight.current = false;
      setTransitioning(false);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };
  const progressPercent = Math.round(
    (completedSteps.slice(0, STEPS.length - 1).filter(Boolean).length /
      (STEPS.length - 1)) *
      100,
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <div className="rounded-full bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("setupWizard.loadFailedTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("setupWizard.loadFailedDesc")}
              </p>
            </div>
            <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-12">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher variant="buttons" className="justify-end" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/25 mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("setupWizard.welcome")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("setupWizard.welcomeDesc")}
          </p>
        </div>

        <div className="mb-6">
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
                  role="progressbar"
                  aria-label={t("setupWizard.progressTitle")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("setupWizard.progressHint")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 hidden items-center justify-center gap-2 sm:flex">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = completedSteps[index];
            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div className={`h-0.5 w-8 ${completedSteps[index - 1] ? "bg-green-500" : "bg-border"}`} />
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
            {currentStep < STEPS.length - 1 && completedSteps[currentStep] && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900/50 dark:bg-green-950/20">
                <CheckCircle className="mx-auto h-7 w-7 text-green-600" />
                <p className="mt-2 font-medium">{t("setupWizard.stepAlreadySaved")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("setupWizard.stepAlreadySavedDesc")}
                </p>
              </div>
            )}
            {/* Step 1: Company Details */}
            {currentStep === 0 && !completedSteps[0] && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.companyIntro")}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {/* Step 2: Salary payment */}
            {currentStep === 1 && !completedSteps[1] && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.bankIntro")}
                </p>
                <div>
                  <Label>{t("setupWizard.paymentMethod")}</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value: "cash" | "bank_transfer") =>
                      setPaymentMethod(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("setupWizard.cash")}</SelectItem>
                      <SelectItem value="bank_transfer">
                        {t("setupWizard.bankTransfer")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === "cash" ? (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    {t("setupWizard.cashInfo")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>{t("setupWizard.bankName")}</Label>
                      <Input
                        list="setup-bank-options"
                        value={bankForm.bankName}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            bankName: event.target.value,
                          }))
                        }
                        placeholder={t("setupWizard.selectBank")}
                      />
                      <datalist id="setup-bank-options">
                        <option value="BNU (Banco Nacional Ultramarino)" />
                        <option value="Bank Mandiri" />
                        <option value="ANZ" />
                        <option value="BNCTL" />
                      </datalist>
                    </div>
                    <div>
                      <Label>{t("setupWizard.accountName")}</Label>
                      <Input
                        value={bankForm.accountName}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            accountName: event.target.value,
                          }))
                        }
                        placeholder={t("setupWizard.accountNamePlaceholder")}
                      />
                    </div>
                    <div>
                      <Label>{t("setupWizard.accountNumber")}</Label>
                      <Input
                        value={bankForm.accountNumber}
                        onChange={(event) =>
                          setBankForm((previous) => ({
                            ...previous,
                            accountNumber: event.target.value,
                          }))
                        }
                        placeholder={t("setupWizard.accountNumberPlaceholder")}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Leave Policies */}
            {currentStep === 2 && !completedSteps[2] && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("setupWizard.leaveIntro")}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            {currentStep === 3 && !completedSteps[3] && (
              <div className="space-y-4">
                <div>
                  <Label>{t("setupWizard.payFrequency")}</Label>
                  <Input value={t("setupWizard.monthly")} readOnly disabled />
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
                  alt={t("setupWizard.allSet")}
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
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || saving || transitioning}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("setupWizard.back")}
            </Button>
            <Button
              variant="outline"
              className="text-muted-foreground"
              onClick={() => {
                navigate("/dashboard");
              }}
              disabled={saving || transitioning}
            >
              {t("setupWizard.doLater")}
            </Button>
          </div>
          <Button
            onClick={handleNext}
            disabled={saving || transitioning}
            className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto"
          >
            {saving || transitioning ? (
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
