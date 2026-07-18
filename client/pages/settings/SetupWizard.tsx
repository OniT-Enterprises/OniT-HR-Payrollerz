/**
 * Setup Wizard - Guided setup for new tenants
 * Focused wizard: Company -> Salary payment -> Payroll basics -> Complete.
 * Optional profile details stay in Settings so first-run setup remains short.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
  CompanyDetails,
  CompanyStructure,
  EmployeeGradeConfig,
} from "@/types/settings";
import { TL_DEFAULT_LEAVE_POLICIES } from "@/types/settings";

const STEPS = [
  { id: "company", labelKey: "setupWizard.steps.companyDetails", icon: Building2 },
  { id: "bank", labelKey: "setupWizard.steps.bankAccounts", icon: CreditCard },
  { id: "payroll", labelKey: "setupWizard.steps.payrollConfig", icon: Settings },
  { id: "complete", labelKey: "setupWizard.steps.complete", icon: CheckCircle },
] as const;

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
          progress.progress.timeOffPolicies && progress.progress.payrollConfig,
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
        // TL defaults are safe to apply without making a new user decode a
        // separate policy screen. They remain editable in Settings.
        settingsService.updateTimeOffPolicies(tenantId, TL_DEFAULT_LEAVE_POLICIES),
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
          success = await handleSavePayrollConfig();
          break;
        case 3:
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{t("setupWizard.welcome")}</h1>
              <p className="text-sm text-muted-foreground">{t("setupWizard.welcomeDesc")}</p>
            </div>
          </div>
          <LocaleSwitcher className="shrink-0" />
        </div>

        {/* One progress signal is enough; the step card below names the task. */}
        <div className="mb-4" aria-label={t("setupWizard.progressTitle")}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">
              {t("setupWizard.stepOf", {
                current: String(currentStep + 1),
                total: String(STEPS.length),
              })}
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              role="progressbar"
              aria-label={t("setupWizard.progressTitle")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep].icon, { className: "h-5 w-5 text-primary" })}
              {t(STEPS[currentStep].labelKey)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStep < STEPS.length - 1 && completedSteps[currentStep] && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
                <CheckCircle className="mx-auto h-7 w-7 text-primary" />
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
                    <Label>{t("setupWizard.tinNumber")}</Label>
                    <Input
                      value={companyForm.tinNumber}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, tinNumber: e.target.value }))}
                      placeholder={t("setupWizard.tinPlaceholder")}
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

            {/* Step 3: Payroll basics + safe TL leave defaults */}
            {currentStep === 2 && !completedSteps[2] && (
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
                <p className="text-xs text-muted-foreground">
                  {t("setupWizard.leaveIntro")} {t("setupWizard.leaveNote")}
                </p>
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 3 && (
              <div className="space-y-4 py-6 text-center">
                <img
                  src="/images/illustrations/setup-complete.webp"
                  alt={t("setupWizard.allSet")}
                  className="mx-auto mb-2 h-32 w-32"
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
            className="w-full sm:w-auto"
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
      </div>
    </div>
  );
}
