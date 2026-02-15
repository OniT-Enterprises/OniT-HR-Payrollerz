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
import type { CompanyDetails } from "@/types/settings";

const STEPS = [
  { id: "company", labelKey: "setupWizard.steps.companyDetails", icon: Building2 },
  { id: "bank", labelKey: "setupWizard.steps.bankAccounts", icon: CreditCard },
  { id: "leave", labelKey: "setupWizard.steps.leavePolicies", icon: Calendar },
  { id: "payroll", labelKey: "setupWizard.steps.payrollConfig", icon: Settings },
  { id: "complete", labelKey: "setupWizard.steps.complete", icon: CheckCircle },
] as const;

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
        const progress = await settingsService.getSetupProgress(tenantId);
        if (progress.isComplete) {
          navigate("/dashboard");
          return;
        }
        // Jump to first incomplete step
        const steps = ["companyDetails", "paymentStructure", "timeOffPolicies", "payrollConfig"];
        const firstIncomplete = steps.findIndex((s) => !progress.progress[s]);
        if (firstIncomplete > 0) {
          setCurrentStep(firstIncomplete);
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
      await settingsService.updateCompanyDetails(tenantId, companyForm as CompanyDetails);
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
                <div>
                  <Label>{t("setupWizard.tinNumber")}</Label>
                  <Input
                    value={companyForm.tinNumber}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, tinNumber: e.target.value }))}
                    placeholder={t("setupWizard.tinPlaceholder")}
                  />
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
                <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
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
              variant="ghost"
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
      </div>
    </div>
  );
}
