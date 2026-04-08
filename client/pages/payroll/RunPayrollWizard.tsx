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

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StepWizard, StepContent } from "@/components/ui/StepWizard";
import type { WizardStep } from "@/components/ui/StepWizard";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { useCreatePayrollRunWithRecords } from "@/hooks/usePayroll";
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
import { SEO, seoConfig } from "@/components/SEO";
import { toDateStringTL } from "@/lib/dateUtils";
import { Calculator, Calendar, CheckCircle, Clock, Users } from "lucide-react";

const WIZARD_STEPS: WizardStep[] = [
  { id: "period", title: "Pay Period", icon: Calendar },
  { id: "employees", title: "Employees", icon: Users },
  { id: "hours", title: "Hours & Pay", icon: Clock },
  { id: "review", title: "Review", icon: CheckCircle },
];

export default function RunPayrollWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [currentStep, setCurrentStep] = useState(0);

  // Compliance UI state
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");

  // Data
  const { data: activeEmployees = [], isLoading: loadingEmployees } =
    useEmployeeDirectory({ status: "active" });

  const createPayrollMutation = useCreatePayrollRunWithRecords();

  const calc = usePayrollCalculator({
    activeEmployees,
    tenantId,
    userId: user?.uid || "current-user",
  });

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
  }, [currentStep, calc, complianceAcknowledged, complianceOverrideReason, toast, t]);

  // ─── Save draft ────────────────────────────────────────────
  const handleSaveDraft = useCallback(() => {
    const includedData = calc.getIncludedData();
    const payrollRun = calc.buildPayrollRun(includedData);
    const records = calc.buildPayrollRecords(includedData);

    createPayrollMutation.mutate(
      { payrollRun, records },
      {
        onSuccess: () => {
          toast({
            title: t("common.success"),
            description: t("runPayroll.toastDraftSaved"),
          });
          navigate("/payroll/history");
        },
        onError: () => {
          toast({
            title: t("common.error"),
            description: t("runPayroll.toastSaveFailed"),
            variant: "destructive",
          });
        },
      }
    );
  }, [calc, createPayrollMutation, toast, t, navigate]);

  // ─── Submit for approval ───────────────────────────────────
  const handleSubmit = useCallback(() => {
    const includedData = calc.getIncludedData();
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

    createPayrollMutation.mutate(
      { payrollRun, records, audit },
      {
        onSuccess: () => {
          toast({
            title: t("runPayroll.toastSubmittedTitle"),
            description: t("runPayroll.toastSubmittedDesc", {
              count: String(includedData.length),
            }),
          });
          navigate("/payroll/history");
        },
        onError: () => {
          toast({
            title: t("runPayroll.toastErrorTitle"),
            description: t("runPayroll.toastErrorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  }, [calc, createPayrollMutation, tenantId, user, toast, t, navigate]);

  if (loadingEmployees) {
    return <PayrollLoadingSkeleton />;
  }

  const currentStepId = WIZARD_STEPS[currentStep].id;

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.runPayroll} />
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-6 py-6">
        <PageHeader
          title={t("runPayroll.title")}
          subtitle={t("runPayroll.processPayrollFor", { count: String(activeEmployees.length) })}
          icon={Calculator}
          iconColor="text-green-500"
        />
        <StepWizard
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onBeforeNext={handleBeforeNext}
          onCancel={() => navigate("/payroll")}
          onComplete={handleSubmit}
          isSubmitting={createPayrollMutation.isPending}
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
              saving={createPayrollMutation.isPending}
              processing={createPayrollMutation.isPending}
            />
          </StepContent>
        </StepWizard>
      </div>
    </div>
  );
}
