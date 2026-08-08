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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
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
  // Leavers whose employment covered any of the pay period get a row — prorated
  // hours, plus Art. 56 severance and netted Art. 44 subsidio when the
  // termination itself falls inside the period. The hook filters this list by its
  // own period, so passing all terminated staff is correct.
  const {
    data: terminatedEmployeeData,
    isSuccess: terminatedLoaded,
    isError: terminatedError,
  } = useEmployeeDirectory({ status: "terminated" });
  // The empty state must not be decided before the TERMINATED query settles: a
  // tenant whose only payroll member is a leaver would otherwise be told to add
  // their first employee while that leaver was still in flight.
  const terminatedSettled = terminatedLoaded || terminatedError;

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
  const isPetroleumContractor =
    tenantSettings?.payrollConfig?.petroleumContractor === true;
  const configuredSchedule =
    tenantSettings === undefined
      ? undefined
      : getConfiguredPayrollSchedule(tenantSettings?.paymentStructure);

  const calc = usePayrollCalculator({
    activeEmployees,
    terminatedEmployees: terminatedEmployeeData,
    tenantId,
    userId: user?.uid || "current-user",
    payrollConfig: tenantSettings?.payrollConfig,
    timeOffPolicies: tenantSettings?.timeOffPolicies,
    defaultPayFrequency: configuredSchedule?.frequency,
    defaultPayDay: configuredSchedule?.payDay,
  });
  // Keyed on the ROSTER, not activeEmployees: a run whose only member is a leaver
  // (the last employee has left, and their final pay is still owed) must still
  // wait for its YTD and calculation state like any other run.
  const payrollDataBlocked =
    calc.rosterEmployees.length > 0 &&
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

  // The ROSTER, not activeEmployees. A tenant whose last employee has just left
  // still has a payroll to run: their worked days, Art. 56 severance and prorated
  // Art. 44 subsidio. Keyed on activeEmployees this short-circuited to the
  // "add your first employee" empty state, and since /payroll/run is the only
  // run-creation route, money the product had already computed and promised
  // ("the next payroll run automatically pays their Art. 56 severance") could
  // never be disbursed at all.
  if (employeesLoaded && terminatedSettled && calc.rosterEmployees.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SEO {...seoConfig.runPayroll} />
        <MainNavigation />
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
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

  if (calc.rosterEmployees.length > 0 && calc.isYtdLoading) {
    return <PayrollLoadingSkeleton />;
  }

  if (calc.rosterEmployees.length > 0 && calc.isYtdError) {
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

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title={t("runPayroll.title")}
          subtitle={t("runPayroll.processPayrollFor", { count: String(calc.rosterEmployees.length) })}
          icon={Calculator}
          iconColor="text-primary"
        />
        {canManageTenant &&
          subscribed === false &&
          (currentStep === 0 || currentStep === wizardSteps.length - 1) && (
          <button
            type="button"
            onClick={() => navigate("/billing")}
            className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/10 sm:gap-3 sm:px-4 sm:text-sm"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex-1 text-foreground/90">{t("runPayroll.freePlanNotice")}</span>
            <span className="shrink-0 font-medium text-primary">{t("runPayroll.freePlanNoticeCta")}</span>
          </button>
        )}
        {/* Lei 8/2008 Sec. 72.2 sends a Contractor's employees to Schedule IX —
            a parallel regime with its own rates, depreciation (Schedule X) and
            filing desk. Xefe has not built it, and running them at Schedule V
            rates UNDER-withholds, which Sec. 25.3 makes the employer's
            liability. So the wizard stops instead of computing. Same posture as
            withholding-tl.ts, which throws rather than guess. */}
        {isPetroleumContractor ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 space-y-2 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium">
                  {t("runPayroll.petroleumBlockTitle")}
                </p>
                <p>{t("runPayroll.petroleumBlockBody")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/payroll/settings")}
                >
                  {t("runPayroll.petroleumBlockCta")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
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
              employees={calc.rosterEmployees}
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
              onBonusCategoryChange={calc.handleBonusCategoryChange}
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
              employeeCount={calc.rosterEmployees.length - calc.excludedEmployees.size}
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
              inssEmployerRatePercent={calc.inssEmployerRatePercent}
            />
          </StepContent>
        </StepWizard>
        )}

        {/* A sync that would DOCK people is never applied silently: absence is
            measured against a full-month expectation, so any working day nobody
            recorded becomes an unpaid deduction. */}
        <AlertDialog
          open={Boolean(calc.pendingAttendanceSync)}
          onOpenChange={(open) => {
            if (!open) calc.cancelAttendanceSync();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("runPayroll.syncDock.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("runPayroll.syncDock.description", {
                  count: calc.pendingAttendanceSync?.docked.length ?? 0,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3">
              {calc.pendingAttendanceSync?.docked.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{row.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t("runPayroll.syncDock.hours", { hours: row.hours })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium">
              {t("runPayroll.syncDock.total", {
                amount: formatCurrencyTL(
                  (calc.pendingAttendanceSync?.docked ?? []).reduce(
                    (sum, row) => sum + row.amount,
                    0,
                  ),
                ),
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("runPayroll.syncDock.hint")}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={calc.cancelAttendanceSync}>
                {t("runPayroll.syncDock.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={calc.confirmAttendanceSync}>
                {t("runPayroll.syncDock.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
