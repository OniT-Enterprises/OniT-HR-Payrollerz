/**
 * StepWizard - Multi-step form wizard component
 * Reduces cognitive load by breaking forms into digestible steps
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  onComplete?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  canProceed?: boolean;
  cannotProceedMessage?: string;
  className?: string;
}

export function StepWizard({
  steps,
  currentStep,
  onStepChange,
  children,
  onComplete,
  onCancel,
  isSubmitting = false,
  submitLabel = "Complete",
  canProceed = true,
  cannotProceedMessage,
  className,
}: StepWizardProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    // Only allow clicking on completed steps or the next step
    if (stepIndex <= currentStep) {
      onStepChange(stepIndex);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Step Indicator */}
      <div className="relative">
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
            const isClickable = index <= currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
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
                    isCurrent && "bg-primary/10 border-primary text-primary",
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
                      isCurrent && "text-primary",
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
        <CardHeader>
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
        <CardContent>{children}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {!canProceed && cannotProceedMessage && (
              <p className="text-sm text-amber-500">{cannotProceedMessage}</p>
            )}
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isLastStep ? (
                submitLabel
              ) : (
                <>
                  Next
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

