/**
 * StepWizard - Multi-step form wizard component
 * Reduces cognitive load by breaking forms into digestible steps
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isOptional?: boolean;
}

interface StepWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: React.ReactNode;
  onComplete?: () => void | Promise<void>;
  onCancel?: () => void;
  /** Called before advancing to the next step. Return false to block navigation. */
  onBeforeNext?: () => boolean | Promise<boolean>;
  isSubmitting?: boolean;
  submitLabel?: string;
  canProceed?: boolean;
  cannotProceedMessage?: string;
  className?: string;
  /** Override min-height on the content card (e.g. "min-h-0" for wizard steps that manage their own height) */
  contentClassName?: string;
}

export function StepWizard({
  steps,
  currentStep,
  onStepChange,
  children,
  onComplete,
  onCancel,
  onBeforeNext,
  isSubmitting = false,
  submitLabel = "Complete",
  canProceed = true,
  cannotProceedMessage,
  className,
  contentClassName,
}: StepWizardProps) {
  const { t } = useI18n();
  const actionInFlight = React.useRef(false);
  const [actionPending, setActionPending] = React.useState(false);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];
  const busy = isSubmitting || actionPending;

  const handleNext = async () => {
    // React state alone cannot block a second click before the next render.
    // Keep a synchronous guard so slow validations/submissions only run once.
    if (actionInFlight.current || isSubmitting || !canProceed) return;
    actionInFlight.current = true;
    setActionPending(true);

    try {
      if (onBeforeNext) {
        const ok = await onBeforeNext();
        if (!ok) return;
      }
      if (isLastStep) {
        await onComplete?.();
      } else {
        onStepChange(currentStep + 1);
      }
    } finally {
      actionInFlight.current = false;
      setActionPending(false);
    }
  };

  const handleBack = () => {
    if (!isFirstStep && !busy) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Only allow clicking on completed steps or the next step
    if (stepIndex <= currentStep && !busy) {
      onStepChange(stepIndex);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* On phones, name the current decision instead of squeezing a four-step
          diagram into the available width. */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 sm:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </p>
          <p className="truncate text-sm font-semibold">{currentStepData.title}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {currentStepData.icon ? (
            <currentStepData.icon className="h-5 w-5" />
          ) : (
            <span className="text-sm font-semibold">{currentStep + 1}</span>
          )}
        </span>
      </div>

      {/* Step Indicator */}
      <div className="relative hidden sm:block">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = index <= currentStep && !busy;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center gap-2 bg-background px-2",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-primary/10 border-primary text-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
                    !isCompleted && !isCurrent && "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : StepIcon ? (
                    <StepIcon className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Step Label */}
                <div className="text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent && "font-bold text-primary",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.isOptional && (
                    <p className="text-xs text-muted-foreground">Optional</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <Card>
        <CardHeader className="hidden sm:block">
          <CardTitle className="flex items-center gap-2">
            {currentStepData.icon && (
              <currentStepData.icon className="h-5 w-5 text-primary" />
            )}
            {currentStepData.title}
            {currentStepData.isOptional && (
              <span className="text-sm font-normal text-muted-foreground">
                (Optional)
              </span>
            )}
          </CardTitle>
          {currentStepData.description && (
            <CardDescription>{currentStepData.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className={cn("min-h-[420px]", contentClassName)}>{children}</CardContent>
      </Card>

      {/* Sticky Bottom Navigation Bar */}
      <div className="sticky bottom-0 z-30 -mx-4 -mb-6 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                {t("common.cancel")}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!canProceed && cannotProceedMessage && (
              <p className="text-sm text-amber-500 hidden sm:block">{cannotProceedMessage}</p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep || busy}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("common.back")}
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : isLastStep ? (
                submitLabel
              ) : (
                <>
                  {t("common.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * StepContent - Wrapper for individual step content
 * Use this to conditionally render step content based on current step
 */
interface StepContentProps {
  stepId: string;
  currentStepId: string;
  children: React.ReactNode;
}

export function StepContent({ stepId, currentStepId, children }: StepContentProps) {
  if (stepId !== currentStepId) return null;
  return <>{children}</>;
}
