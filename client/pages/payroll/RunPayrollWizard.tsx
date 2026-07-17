/**
 * Run Payroll Wizard — 4-step guided payroll flow
 * Replaces the single-page RunPayroll with digestible steps.
 *
 * Step 1: Pay Period (when)
 * Step 2: Employees (who)
 * Step 3: Hours & Pay (what)
 * Step 4: Review & Submit (confirm)
 *
 * Design philosophy: "kids app" — one decision per screen, big targets,
 * smart defaults, minimal reading. All functionality preserved.
 */

import { useState, useCallback, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { StepWizard, StepContent } from "@/components/ui/StepWizard";
import type { WizardStep } from "@/components/ui/StepWizard";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useCreatePayrollRunWithRecords } from "@/hooks/usePayroll";
import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@/services/settingsService";
import { usePayrollCalculator } from "@/hooks/usePayrollCalculator";
import { PayrollLoadingSkeleton } from "@/components/payroll";
import {
  WizardStepPeriod,
  WizardStepEmployees,
  WizardStepHours,
  WizardStepReview,
} from "@/components/payroll/wizard";
import MainNavigation from "@/components/layout/MainNavigation";
import PageHeader from "@/components/layout/PageHeader";
import DashboardLoadError from "@/components/dashboard/DashboardLoadError";
import { Button } from "@/components/ui/button";
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL } from "@/lib/dateUtils";
import { Calculator, Calendar, CheckCircle, Clock, Plus, Sparkles, Users } from "lucide-react";
import { getConfiguredPayrollSchedule } from "@/lib/payroll/payroll-schedule";
import { useIsSubscribed } from "@/hooks/useBilling";

export default function RunPayrollWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const wizardSteps: WizardStep[] = [
    { id: "period", title: t("runPayroll.payPeriod"), icon: Calendar },
    { id: "employees", title: t("runPayroll.employees"), icon: Users },
    { id: "hours", title: t("runPayroll.hoursPay"), icon: Clock },
    { id: "review", title: t("common.review"), icon: CheckCircle },
  ];
  const { user } = useAuth();
  const { hasModule, canWrite, canManage } = useTenant();
  const tenantId = useTenantId();
  const canAddEmployees = hasModule("staff") && canWrite();
  const canManageTenant = canManage();
  // Pre-gate transparency: tell free tenants up front that building/reviewing
  // is free and only finalizing needs a subscription — the paywall at the end
  // of the flow should never be a surprise.
  const subscribed = useIsSubscribed(canManageTenant);

  const [currentStep, setCurrentStep] = useState(0);

  // Compliance UI state
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");

  // Data
  const {
    data: activeEmployeeData,
    isLoading: loadingEmployees,
    isError: employeesError,
    isFetching: employeesFetching,
    isSuccess: employeesLoaded,
    refetch: refetchEmployees,
  } = useEmployeeDirectory({ status: "active" });
  const activeEmployees = activeEmployeeData ?? [];

  const createPayrollMutation = useCreatePayrollRunWithRecords();
  const payrollMutationGuardRef = useRef(false);
  const [payrollMutationAction, setPayrollMutationAction] = useState<
    "draft" | "submit" | null
  >(null);

  const beginPayrollMutation = useCallback((action: "draft" | "submit") => {
    if (payrollMutationGuardRef.current) return false;

    payrollMutationGuardRef.current = true;
    setPayrollMutationAction(action);
    return true;
  }, []);

  const finishPayrollMutation = useCallback(() => {
    payrollMutationGuardRef.current = false;
    setPayrollMutationAction(null);
  }, []);

  // Solo-operator mode changes the "what happens next" copy on the review step
  const {
    data: tenantSettings,
    isLoading: loadingSettings,
    isError: settingsError,
    isFetching: settingsFetching,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: () => settingsService.getSettings(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });
  const selfApprovalAllowed = tenantSettings?.payrollConfig?.allowSelfApproval === true;
  const configuredSchedule =
    tenantSettings === undefined
      ? undefined
      : getConfiguredPayrollSchedule(tenantSettings?.paymentStructure);

  const calc = usePayrollCalculator({
    activeEmployees,
    tenantId,
    userId: user?.uid || "current-user",
    payrollConfig: tenantSettings?.payrollConfig,
    defaultPayFrequency: configuredSchedule?.frequency,
    defaultPayDay: configuredSchedule?.payDay,
  });
  const payrollDataBlocked =
    activeEmployees.length > 0 &&
    (calc.isYtdLoading ||
      calc.isYtdError ||
      calc.calculationsPending ||
      calc.attendanceSyncPending);
  const includedEmployeeCount = calc.getIncludedData().length;
  const hasIncludedEmployees = includedEmployeeCount > 0;
  const payrollMutationPending =
    payrollMutationAction !== null || createPayrollMutation.isPending;

  const notifyNoIncludedEmployees = useCallback(() => {
    toast({
      title: t("runPayroll.noEmployeesFound"),
      description: t("runPayroll.stepEmployeesDesc"),
      variant: "destructive",
    });
  }, [t, toast]);

  // ─── Step validation ─────────────────────────────────────────
  const handleBeforeNext = useCallback((): boolean => {
    if (currentStep === 0) {
      if (!calc.periodStart || !calc.periodEnd || !calc.payDate) {
        toast({
          title: t("runPayroll.toastDatesRequired"),
          description: t("runPayroll.toastDatesRequiredDesc"),
          variant: "destructive",
        });
        return false;
      }
      if (calc.periodStart >= calc.periodEnd) {
        toast({
          title: t("runPayroll.toastInvalidPeriod"),
          description: t("runPayroll.toastInvalidPeriodDesc"),
          variant: "destructive",
        });
        return false;
      }
      if (calc.payDate < calc.periodEnd) {
        toast({
          title: t("runPayroll.toastInvalidPayDate"),
          description: t("runPayroll.toastInvalidPayDateDesc"),
          variant: "destructive",
        });
        return false;
      }
      // SEC-6: Date range bounds
      const now = new Date();
      const twoYearsAgo = toDateStringTL(
        new Date(now.getFullYear() - 2, now.getMonth(), 1)
      );
      const oneMonthAhead = toDateStringTL(
        new Date(now.getFullYear(), now.getMonth() + 2, 0)
      );
      if (calc.periodStart < twoYearsAgo || calc.periodEnd > oneMonthAhead) {
        toast({
          title: t("runPayroll.toastDateOutOfBounds"),
          description: t("runPayroll.toastDateOutOfBoundsDesc"),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    if (!hasIncludedEmployees) {
      notifyNoIncludedEmployees();
      return false;
    }

    if (currentStep === 1) {
      // SEC-7: Compliance override validation
      if (
        calc.hasComplianceIssues &&
        calc.excludedEmployees.size < calc.complianceIssues.length
      ) {
        if (!complianceAcknowledged) {
          toast({
            title: t("runPayroll.toastComplianceRequired"),
            description: t("runPayroll.toastComplianceRequiredDesc"),
            variant: "destructive",
          });
          return false;
        }
        if (complianceOverrideReason.trim().length < 5) {
          toast({
            title: t("runPayroll.toastOverrideShort"),
            description: t("runPayroll.toastOverrideShortDesc"),
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }

    if (currentStep === 2) {
      const includedData = calc.getIncludedData();
      const errors = calc.validateAllEmployees(includedData);
      if (errors.length > 0) {
        toast({
          title: t("runPayroll.toastValidationErrors"),
          description:
            errors.slice(0, 3).join("\n") +
            (errors.length > 3
              ? `\n...and ${errors.length - 3} more`
              : ""),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    return true;
  }, [
    currentStep,
    calc,
    complianceAcknowledged,
    complianceOverrideReason,
    hasIncludedEmployees,
    notifyNoIncludedEmployees,
    toast,
    t,
  ]);

  // ─── Save draft ────────────────────────────────────────────
  const handleSaveDraft = useCallback(async () => {
    if (payrollDataBlocked) return;

    const includedData = calc.getIncludedData();
    if (includedData.length === 0) {
      notifyNoIncludedEmployees();
      return;
    }
    if (!beginPayrollMutation("draft")) return;

    try {
      const payrollRun = calc.buildPayrollRun(includedData);
      const records = calc.buildPayrollRecords(includedData);
      await createPayrollMutation.mutateAsync({ payrollRun, records });
      toast({
        title: t("common.success"),
        description: t("runPayroll.toastDraftSaved"),
      });
      navigate("/payroll/history");
    } catch {
      toast({
        title: t("common.error"),
        description: t("runPayroll.toastSaveFailed"),
        variant: "destructive",
      });
    } finally {
      finishPayrollMutation();
    }
  }, [
    payrollDataBlocked,
    calc,
    notifyNoIncludedEmployees,
    beginPayrollMutation,
    createPayrollMutation,
    toast,
    t,
    navigate,
    finishPayrollMutation,
  ]);

  // ─── Submit for approval ───────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (payrollDataBlocked) return;

    const includedData = calc.getIncludedData();
    if (includedData.length === 0) {
      notifyNoIncludedEmployees();
      return;
    }
    if (!beginPayrollMutation("submit")) return;

    try {
      const payrollRun = {
        ...calc.buildPayrollRun(includedData),
        status: "processing" as const,
      };
      const records = calc.buildPayrollRecords(includedData);
      const audit = {
        tenantId,
        userId: user?.uid || "current-user",
        userEmail: user?.email || "",
      };
      await createPayrollMutation.mutateAsync({ payrollRun, records, audit });
      toast({
        title: t("runPayroll.toastSubmittedTitle"),
        description: t("runPayroll.toastSubmittedDesc", {
          count: String(includedData.length),
        }),
      });
      navigate("/payroll/history");
    } catch {
      toast({
        title: t("runPayroll.toastErrorTitle"),
        description: t("runPayroll.toastErrorDesc"),
        variant: "destructive",
      });
    } finally {
      finishPayrollMutation();
    }
  }, [
    payrollDataBlocked,
    calc,
    notifyNoIncludedEmployees,
    beginPayrollMutation,
    createPayrollMutation,
    tenantId,
    user,
    toast,
    t,
    navigate,
    finishPayrollMutation,
  ]);

  if (loadingEmployees || loadingSettings) {
    return <PayrollLoadingSkeleton />;
  }

  if (settingsError && tenantSettings === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={settingsFetching}
          onRetry={() => refetchSettings()}
        />
      </div>
    );
  }

  if (tenantSettings === null) {
    return <Navigate to="/setup" replace />;
  }

  if (employeesError && activeEmployeeData === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={employeesFetching}
          onRetry={() => refetchEmployees()}
        />
      </div>
    );
  }

  if (employeesLoaded && activeEmployees.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.runPayroll} />
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-6 py-6">
          <PageHeader
            title={t("runPayroll.title")}
            icon={Calculator}
            iconColor="text-primary"
          />
          <section
            className="mx-auto mt-8 max-w-lg rounded-2xl border bg-card px-6 py-10 text-center"
            aria-labelledby="no-payroll-employees-title"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 id="no-payroll-employees-title" className="mt-4 text-lg font-semibold">
              {t("employees.empty.noEmployeesTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {canAddEmployees
                ? t("employees.empty.noEmployeesStart")
                : t("runPayroll.noEmployeesAdminHelp")}
            </p>
            {canAddEmployees ? (
              <Button className="mt-5" onClick={() => navigate("/people/add")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("employees.buttons.addFirstEmployee")}
              </Button>
            ) : (
              <Button className="mt-5" variant="outline" onClick={() => navigate("/payroll")}>
                {t("common.back")}
              </Button>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (activeEmployees.length > 0 && calc.isYtdLoading) {
    return <PayrollLoadingSkeleton />;
  }

  if (activeEmployees.length > 0 && calc.isYtdError) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <DashboardLoadError
          isRetrying={calc.isYtdFetching}
          onRetry={() => calc.refetchYtd()}
        />
      </div>
    );
  }

  const currentStepId = wizardSteps[currentStep].id;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("runPayroll.title")}
          subtitle={t("runPayroll.processPayrollFor", { count: String(activeEmployees.length) })}
          icon={Calculator}
          iconColor="text-primary"
        />
        {canManageTenant && subscribed === false && (
          <button
            type="button"
            onClick={() => navigate("/billing")}
            className="mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left text-sm transition-colors hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex-1 text-foreground/90">{t("runPayroll.freePlanNotice")}</span>
            <span className="shrink-0 font-medium text-primary">{t("runPayroll.freePlanNoticeCta")}</span>
          </button>
        )}
        <StepWizard
          steps={wizardSteps}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onBeforeNext={handleBeforeNext}
          onCancel={() => navigate("/payroll")}
          onComplete={handleSubmit}
          isSubmitting={payrollMutationPending}
          canProceed={
            !calc.calculationsPending &&
            !payrollMutationPending &&
            (currentStep === 0 || hasIncludedEmployees) &&
            (currentStep !== 2 || !calc.attendanceSyncPending)
          }
          cannotProceedMessage={
            calc.calculationsPending || calc.attendanceSyncPending
              ? t("common.loading")
              : currentStep > 0 && !hasIncludedEmployees
                ? t("runPayroll.noEmployeesFound")
                : undefined
          }
          submitLabel={t("runPayroll.submitForApproval")}
          contentClassName="min-h-0"
        >
          <StepContent stepId="period" currentStepId={currentStepId}>
            <WizardStepPeriod
              payFrequency={calc.payFrequency}
              setPayFrequency={calc.setPayFrequency}
              periodStart={calc.periodStart}
              setPeriodStart={calc.setPeriodStart}
              periodEnd={calc.periodEnd}
              setPeriodEnd={calc.setPeriodEnd}
              payDate={calc.payDate}
              setPayDate={calc.setPayDate}
              includeSubsidioAnual={calc.includeSubsidioAnual}
              setIncludeSubsidioAnual={calc.setIncludeSubsidioAnual}
              subsidioEnabled={tenantSettings?.payrollConfig?.subsidioAnual.enabled !== false}
            />
          </StepContent>

          <StepContent stepId="employees" currentStepId={currentStepId}>
            <WizardStepEmployees
              employees={activeEmployees}
              complianceIssues={calc.complianceIssues}
              excludedEmployees={calc.excludedEmployees}
              setExcludedEmployees={calc.setExcludedEmployees}
              complianceAcknowledged={complianceAcknowledged}
              setComplianceAcknowledged={setComplianceAcknowledged}
              complianceOverrideReason={complianceOverrideReason}
              setComplianceOverrideReason={setComplianceOverrideReason}
            />
          </StepContent>

          <StepContent stepId="hours" currentStepId={currentStepId}>
            <WizardStepHours
              filteredData={calc.filteredData}
              totalCount={calc.employeePayrollData.length}
              editedCount={calc.editedCount}
              expandedRows={calc.expandedRows}
              searchTerm={calc.searchTerm}
              setSearchTerm={calc.setSearchTerm}
              onToggleExpand={calc.toggleRowExpansion}
              onInputChange={calc.handleInputChange}
              onReset={calc.handleResetRow}
              onSyncAttendance={calc.handleSyncFromAttendance}
              syncingAttendance={calc.syncingAttendance}
              payrollWarnings={calc.payrollWarnings}
              totals={calc.totals}
            />
          </StepContent>

          <StepContent stepId="review" currentStepId={currentStepId}>
            <WizardStepReview
              periodStart={calc.periodStart}
              periodEnd={calc.periodEnd}
              payDate={calc.payDate}
              employeeCount={activeEmployees.length - calc.excludedEmployees.size}
              editedCount={calc.editedCount}
              totals={calc.totals}
              includedEmployees={calc.getIncludedData()}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
              saving={
                payrollMutationPending && payrollMutationAction !== "submit"
              }
              processing={payrollMutationAction === "submit"}
              selfApprovalAllowed={selfApprovalAllowed}
            />
          </StepContent>
        </StepWizard>
      </div>
    </div>
  );
}
