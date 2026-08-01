'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Circle } from 'lucide-react';

export interface WizardStep {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface StepStatus {
  stepId: number;
  isComplete: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  isCurrentStep: boolean;
}

interface DisputeWizardProgressBarProps {
  steps: WizardStep[];
  currentStep: number;
  stepStatuses: StepStatus[];
  onStepClick?: (stepId: number) => void;
  maxSteps?: number;
}

/**
 * Progress indicator for dispute wizard
 * Shows completion percentage, step validation status, and allows navigation
 */
export function DisputeWizardProgressBar({
  steps,
  currentStep: _currentStep,
  stepStatuses,
  onStepClick,
  maxSteps = 4,
}: DisputeWizardProgressBarProps) {
  // Calculate progress percentage
  const completedSteps = stepStatuses.filter((s) => s.isComplete).length;
  const progressPercent = Math.round((completedSteps / maxSteps) * 100);

  // Get status for a specific step
  const getStepStatus = (stepId: number): StepStatus | undefined => {
    return stepStatuses.find((s) => s.stepId === stepId);
  };

  // Get icon for step status
  const getStatusIcon = (status: StepStatus | undefined, step: WizardStep) => {
    if (!status) return null;

    if (status.isCurrentStep) {
      // Current step shows the step icon (ring on the button conveys "active")
      const StepIcon = step.icon;
      return (
        <div key={`icon-${step.id}`} className="text-secondary">
          <StepIcon className="w-6 h-6" />
        </div>
      );
    }

    if (status.isComplete) {
      // Completed step shows checkmark
      return (
        <motion.div
          key={`icon-${step.id}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CheckCircle className="w-6 h-6 text-success" />
        </motion.div>
      );
    }

    if (status.hasErrors) {
      // Error state shows alert icon
      return (
        <motion.div key={`icon-${step.id}`}>
          <AlertCircle className="w-6 h-6 text-destructive" />
        </motion.div>
      );
    }

    if (status.hasWarnings) {
      // Warning state shows alert icon
      return (
        <motion.div key={`icon-${step.id}`}>
          <AlertCircle className="w-6 h-6 text-warning" />
        </motion.div>
      );
    }

    // Pending step shows empty circle
    return (
      <motion.div key={`icon-${step.id}`}>
        <Circle className="w-6 h-6 text-muted-foreground/50" />
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-sm font-medium text-foreground">
            Progress
          </h3>
          <span className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
            {progressPercent}%
          </span>
        </div>

        {/* Animated progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-secondary h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-start gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isClickable = status && status.isComplete && !status.isCurrentStep && onStepClick;

          return (
            <motion.div
              key={step.id}
              className="flex flex-col items-center gap-2 flex-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {/* Step Circle Button */}
              <motion.button
                onClick={() => {
                  if (isClickable) {
                    onStepClick(step.id);
                  }
                }}
                disabled={!isClickable}
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  isClickable
                    ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-secondary/60 hover:ring-offset-background'
                    : 'cursor-default'
                } ${
                  status?.isCurrentStep
                    ? 'bg-secondary/15 ring-2 ring-secondary ring-offset-2 ring-offset-background'
                    : status?.isComplete
                      ? 'bg-success/15'
                      : status?.hasErrors
                        ? 'bg-destructive/15'
                        : status?.hasWarnings
                          ? 'bg-warning/15'
                          : 'bg-muted'
                }`}
                whileHover={isClickable ? { scale: 1.05 } : undefined}
                whileTap={isClickable ? { scale: 0.95 } : undefined}
              >
                {getStatusIcon(status, step)}
              </motion.button>

              {/* Step Label */}
              <div className="text-center">
                <p
                  className={`text-xs font-semibold ${
                    status?.isCurrentStep
                      ? 'text-secondary'
                      : status?.isComplete
                        ? 'text-success'
                        : status?.hasErrors
                          ? 'text-destructive'
                          : 'text-foreground'
                  }`}
                >
                  {step.name}
                </p>

                {/* Substatus indicators */}
                {status && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {status.isComplete && <span className="text-success">✓</span>}
                    {status.hasErrors && <span className="text-destructive">Error</span>}
                    {status.hasWarnings && !status.hasErrors && (
                      <span className="text-warning">Warning</span>
                    )}
                  </div>
                )}
              </div>

              {/* Connector Line (not on last step) */}
              {index < steps.length - 1 && (
                <motion.div
                  className={`absolute left-[50%] top-10 w-0.5 h-8 ${
                    status?.isComplete
                      ? 'bg-success/60'
                      : 'bg-border'
                  }`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 + 0.1 }}
                  style={{
                    originY: 0,
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Status Summary */}
      <div className="mt-4 p-3 bg-secondary/10 rounded-lg border border-secondary/20">
        <p className="text-xs text-foreground">
          <span className="font-semibold">Completed: </span>
          {completedSteps} of {maxSteps} steps
          {stepStatuses.some((s) => s.hasErrors) && (
            <span className="ml-2 text-destructive">
              • {stepStatuses.filter((s) => s.hasErrors).length} step(s) with errors
            </span>
          )}
          {stepStatuses.some((s) => s.hasWarnings && !s.hasErrors) && (
            <span className="ml-2 text-warning">
              • {stepStatuses.filter((s) => s.hasWarnings && !s.hasErrors).length} step(s) with warnings
            </span>
          )}
        </p>
      </div>

      {/* Helpful hint */}
      {stepStatuses.some((s) => s.isComplete && !s.isCurrentStep) && onStepClick && (
        <p className="text-xs text-muted-foreground text-center">
          Click completed steps to edit
        </p>
      )}
    </div>
  );
}
