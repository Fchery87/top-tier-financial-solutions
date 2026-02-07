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
      // Current step shows the step icon
      const StepIcon = step.icon;
      return (
        <motion.div
          key={`icon-${step.id}`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="text-blue-600 dark:text-blue-400"
        >
          <StepIcon className="w-6 h-6" />
        </motion.div>
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
          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
        </motion.div>
      );
    }

    if (status.hasErrors) {
      // Error state shows alert icon
      return (
        <motion.div key={`icon-${step.id}`}>
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </motion.div>
      );
    }

    if (status.hasWarnings) {
      // Warning state shows alert icon in yellow
      return (
        <motion.div key={`icon-${step.id}`}>
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </motion.div>
      );
    }

    // Pending step shows empty circle
    return (
      <motion.div key={`icon-${step.id}`}>
        <Circle className="w-6 h-6 text-gray-400 dark:text-gray-600" />
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Progress
          </h3>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {progressPercent}%
          </span>
        </div>

        {/* Animated progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
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
                    ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-blue-400 dark:hover:ring-offset-gray-900'
                    : 'cursor-default'
                } ${
                  status?.isCurrentStep
                    ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                    : status?.isComplete
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : status?.hasErrors
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : status?.hasWarnings
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-gray-100 dark:bg-gray-800'
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
                      ? 'text-blue-600 dark:text-blue-400'
                      : status?.isComplete
                        ? 'text-green-600 dark:text-green-400'
                        : status?.hasErrors
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {step.name}
                </p>

                {/* Substatus indicators */}
                {status && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {status.isComplete && <span className="text-green-600 dark:text-green-400">✓</span>}
                    {status.hasErrors && <span className="text-red-600 dark:text-red-400">Error</span>}
                    {status.hasWarnings && !status.hasErrors && (
                      <span className="text-yellow-600 dark:text-yellow-400">Warning</span>
                    )}
                  </div>
                )}
              </div>

              {/* Connector Line (not on last step) */}
              {index < steps.length - 1 && (
                <motion.div
                  className={`absolute left-[50%] top-10 w-0.5 h-8 ${
                    status?.isComplete
                      ? 'bg-green-400 dark:bg-green-600'
                      : 'bg-gray-300 dark:bg-gray-600'
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
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          <span className="font-semibold">Completed: </span>
          {completedSteps} of {maxSteps} steps
          {stepStatuses.some((s) => s.hasErrors) && (
            <span className="ml-2 text-red-600 dark:text-red-400">
              • {stepStatuses.filter((s) => s.hasErrors).length} step(s) with errors
            </span>
          )}
          {stepStatuses.some((s) => s.hasWarnings && !s.hasErrors) && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
              • {stepStatuses.filter((s) => s.hasWarnings && !s.hasErrors).length} step(s) with warnings
            </span>
          )}
        </p>
      </div>

      {/* Helpful hint */}
      {stepStatuses.some((s) => s.isComplete && !s.isCurrentStep) && onStepClick && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Click completed steps to edit
        </p>
      )}
    </div>
  );
}
